import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { sessionId, type Player } from "./useRoom";
import {
  type BJGameState,
  type PlayerAction,
  initGameState,
  placeBets,
  playerAction,
  newRound,
  getAvailableActions,
  filterStateForPlayer,
} from "@/lib/blackjack";

export function useBlackjack(roomId: string | undefined, players: Player[]) {
  const [rawGameState, setRawGameState] = useState<BJGameState | null>(null);
  const [myBet, setMyBet] = useState(0);
  const initialized = useRef(false);

  const myPlayer = players.find((p) => p.session_id === sessionId);
  const isHost = myPlayer?.is_host ?? false;

  // Load game state from room
  useEffect(() => {
    if (!roomId) return;
    const load = async () => {
      const { data } = await supabase
        .from("rooms")
        .select("game_state")
        .eq("id", roomId)
        .single();
      if (data?.game_state && typeof data.game_state === "object" && "phase" in (data.game_state as any)) {
        setRawGameState(data.game_state as unknown as BJGameState);
        initialized.current = true;
      }
    };
    load();
  }, [roomId]);

  // Subscribe to game_state changes
  useEffect(() => {
    if (!roomId) return;
    const channel = supabase
      .channel(`blackjack-${roomId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "rooms", filter: `id=eq.${roomId}` },
        (payload) => {
          const gs = payload.new?.game_state;
          if (gs && typeof gs === "object" && "phase" in (gs as any)) {
            setRawGameState(gs as unknown as BJGameState);
          }
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [roomId]);

  const saveState = useCallback(async (state: BJGameState) => {
    if (!roomId) return;
    setRawGameState(state);
    await supabase
      .from("rooms")
      .update({ game_state: state as any })
      .eq("id", roomId);
  }, [roomId]);

  // Initialize game (host only)
  const initGame = useCallback(async () => {
    if (!roomId || !isHost || initialized.current) return;
    const state = initGameState(
      players.map((p) => ({ id: p.id, name: p.display_name }))
    );
    initialized.current = true;
    await saveState(state);
  }, [roomId, isHost, players, saveState]);

  // Place bets and start round (host triggers, uses collected bets)
  const startRound = useCallback(async (allBets: Record<string, number>) => {
    if (!rawGameState || !isHost) return;
    const next = placeBets(rawGameState, allBets);
    await saveState(next);
  }, [rawGameState, isHost, saveState]);

  // Player action
  const doAction = useCallback(async (action: PlayerAction) => {
    if (!rawGameState || !myPlayer) return;
    const next = playerAction(rawGameState, myPlayer.id, action);
    await saveState(next);
  }, [rawGameState, myPlayer, saveState]);

  // New round
  const nextRound = useCallback(async () => {
    if (!rawGameState || !isHost) return;
    const next = newRound(rawGameState);
    await saveState(next);
  }, [rawGameState, isHost, saveState]);

  // Filter state for current viewer
  const gameState = rawGameState && myPlayer
    ? filterStateForPlayer(rawGameState, myPlayer.id)
    : rawGameState;

  const availableActions = gameState && myPlayer
    ? getAvailableActions(gameState, myPlayer.id)
    : [];

  const myBJPlayer = gameState?.players.find((p) => p.playerId === myPlayer?.id);

  return {
    gameState,
    myBJPlayer,
    availableActions,
    isHost,
    myBet,
    setMyBet,
    initGame,
    startRound,
    doAction,
    nextRound,
  };
}
