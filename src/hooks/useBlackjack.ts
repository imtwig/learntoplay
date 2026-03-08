import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { sessionId, type Player } from "./useRoom";
import {
  type BJGameState,
  type PlayerAction,
  initGameState,
  startDeal,
  setPlayerReady,
  setPlayerUnready,
  allPlayersReady,
  playerAction,
  newRound,
  getAvailableActions,
  filterStateForPlayer,
  revealPlayer,
  revealAll,
} from "@/lib/blackjack";

export function useBlackjack(roomId: string | undefined, players: Player[]) {
  const [rawGameState, setRawGameState] = useState<BJGameState | null>(null);
  const [myBetInput, setMyBetInput] = useState<string>("");
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
        const gs = data.game_state as unknown as BJGameState;
        setRawGameState(gs);
        initialized.current = true;
        // Restore bet input from previous round
        if (myPlayer) {
          const myBJ = gs.players.find((p) => p.playerId === myPlayer.id);
          if (myBJ && myBJ.currentBet > 0) {
            setMyBetInput(String(myBJ.currentBet));
          }
        }
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

  // Player marks ready with their bet
  const markReady = useCallback(async () => {
    if (!rawGameState || !myPlayer) return;
    const bet = parseInt(myBetInput) || 0;
    const next = setPlayerReady(rawGameState, myPlayer.id, bet);
    await saveState(next);
  }, [rawGameState, myPlayer, myBetInput, saveState]);

  // Player unreadies
  const markUnready = useCallback(async () => {
    if (!rawGameState || !myPlayer) return;
    const next = setPlayerUnready(rawGameState, myPlayer.id);
    await saveState(next);
  }, [rawGameState, myPlayer, saveState]);

  // Start dealing (anyone can press once all ready)
  const startRound = useCallback(async () => {
    if (!rawGameState) return;
    if (!allPlayersReady(rawGameState)) return;
    const next = startDeal(rawGameState);
    await saveState(next);
  }, [rawGameState, saveState]);

  // Player action
  const doAction = useCallback(async (action: PlayerAction) => {
    if (!rawGameState || !myPlayer) return;
    const next = playerAction(rawGameState, myPlayer.id, action);
    await saveState(next);
  }, [rawGameState, myPlayer, saveState]);

  // Host reveals a player
  const doRevealPlayer = useCallback(async (playerId: string) => {
    if (!rawGameState || !isHost) return;
    const next = revealPlayer(rawGameState, playerId);
    await saveState(next);
  }, [rawGameState, isHost, saveState]);

  // Host reveals all
  const doRevealAll = useCallback(async () => {
    if (!rawGameState || !isHost) return;
    const next = revealAll(rawGameState);
    await saveState(next);
  }, [rawGameState, isHost, saveState]);

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
    myBetInput,
    setMyBetInput,
    initGame,
    markReady,
    markUnready,
    startRound,
    doAction,
    doRevealPlayer,
    doRevealAll,
    nextRound,
  };
}
