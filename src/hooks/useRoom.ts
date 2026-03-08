import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { GameId } from "@/lib/gameData";

// Generate a persistent session ID for this browser tab
const getSessionId = () => {
  let id = sessionStorage.getItem("game_session_id");
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem("game_session_id", id);
  }
  return id;
};

export const sessionId = getSessionId();

export interface Room {
  id: string;
  game_type: GameId;
  room_name: string;
  password_hash: string | null;
  status: string;
  host_player_id: string | null;
  settings: Record<string, unknown>;
  max_players: number;
  created_at: string;
}

export interface Player {
  id: string;
  room_id: string;
  display_name: string;
  session_id: string;
  is_host: boolean;
  join_order: number;
  player_state: Record<string, unknown>;
  connected: boolean;
  created_at: string;
}

export function useRooms(gameType: GameId) {
  const [rooms, setRooms] = useState<(Room & { player_count: number })[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRooms = useCallback(async () => {
    const { data: roomsData } = await supabase
      .from("rooms")
      .select("*")
      .eq("game_type", gameType)
      .neq("status", "closed")
      .order("created_at", { ascending: false });

    if (roomsData) {
      // Get player counts
      const roomsWithCounts = await Promise.all(
        roomsData.map(async (room) => {
          const { count } = await supabase
            .from("players")
            .select("*", { count: "exact", head: true })
            .eq("room_id", room.id)
            .eq("connected", true);
          return { ...room, player_count: count ?? 0 } as Room & { player_count: number };
        })
      );
      setRooms(roomsWithCounts);
    }
    setLoading(false);
  }, [gameType]);

  useEffect(() => {
    fetchRooms();

    const channel = supabase
      .channel(`rooms-${gameType}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "rooms", filter: `game_type=eq.${gameType}` },
        () => fetchRooms()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [gameType, fetchRooms]);

  return { rooms, loading, refetch: fetchRooms };
}

export function useRoom(roomId: string | undefined) {
  const [room, setRoom] = useState<Room | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!roomId) return;

    const fetchRoom = async () => {
      const { data } = await supabase
        .from("rooms")
        .select("*")
        .eq("id", roomId)
        .single();
      if (data) setRoom(data as unknown as Room);
    };

    const fetchPlayers = async () => {
      const { data } = await supabase
        .from("players")
        .select("*")
        .eq("room_id", roomId)
        .eq("connected", true)
        .order("join_order");
      if (data) setPlayers(data as unknown as Player[]);
      setLoading(false);
    };

    fetchRoom();
    fetchPlayers();

    const roomChannel = supabase
      .channel(`room-${roomId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "rooms", filter: `id=eq.${roomId}` },
        () => fetchRoom()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "players", filter: `room_id=eq.${roomId}` },
        () => fetchPlayers()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(roomChannel);
    };
  }, [roomId]);

  return { room, players, loading };
}

export async function createRoom(
  gameType: GameId,
  roomName: string,
  playerName: string,
  password?: string,
  settings: Record<string, unknown> = {},
  maxPlayers: number = 9
) {
  const passwordHash = password ? password : null; // Simple for now, can hash later

  const { data: room, error: roomError } = await supabase
    .from("rooms")
    .insert({
      game_type: gameType as string,
      room_name: roomName,
      password_hash: passwordHash,
      settings: settings as any,
      max_players: maxPlayers,
    } as any)
    .select()
    .single();

  if (roomError || !room) throw roomError;

  // Add the host as first player
  const { data: player, error: playerError } = await supabase
    .from("players")
    .insert({
      room_id: room.id,
      display_name: playerName,
      session_id: sessionId,
      is_host: true,
      join_order: 0,
    })
    .select()
    .single();

  if (playerError || !player) throw playerError;

  // Set host reference
  await supabase
    .from("rooms")
    .update({ host_player_id: player.id })
    .eq("id", room.id);

  return { room, player };
}

export async function joinRoom(
  roomId: string,
  playerName: string,
  password?: string
) {
  // Check room
  const { data: room } = await supabase
    .from("rooms")
    .select("*")
    .eq("id", roomId)
    .single();

  if (!room) throw new Error("Room not found");
  if (room.status !== "waiting") throw new Error("Game already in progress");
  if (room.password_hash && room.password_hash !== password) {
    throw new Error("Incorrect password");
  }

  // Check player count
  const { count } = await supabase
    .from("players")
    .select("*", { count: "exact", head: true })
    .eq("room_id", roomId)
    .eq("connected", true);

  if ((count ?? 0) >= room.max_players) throw new Error("Room is full");

  const { data: player, error } = await supabase
    .from("players")
    .insert({
      room_id: roomId,
      display_name: playerName,
      session_id: sessionId,
      is_host: false,
      join_order: (count ?? 0),
    })
    .select()
    .single();

  if (error) throw error;
  return player;
}

export async function leaveRoom(playerId: string, roomId: string) {
  const { data: player } = await supabase
    .from("players")
    .select("is_host")
    .eq("id", playerId)
    .single();

  if (player?.is_host) {
    // Host leaving = close room
    await supabase
      .from("rooms")
      .update({ status: "closed" })
      .eq("id", roomId);
  }

  await supabase
    .from("players")
    .update({ connected: false })
    .eq("id", playerId);
}

export async function startGame(roomId: string) {
  await supabase
    .from("rooms")
    .update({ status: "in_progress" })
    .eq("id", roomId);
}
