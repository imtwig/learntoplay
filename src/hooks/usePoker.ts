import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { sessionId, type Player } from "./useRoom";
import {
  type PokerGameState,
  type PokerAction,
  initPokerGame,
  dealNewHand,
  doPokerAction,
  getAvailableActions,
  filterPokerStateForPlayer,
  startNextHand,
} from "@/lib/poker";

function normalizePokerState(gs: PokerGameState): PokerGameState {
  if (!gs.actedThisRound) gs.actedThisRound = [];
  if (!gs.winners) gs.winners = null;
  if (!gs.sidePots) gs.sidePots = [];
  return gs;
}

export function usePoker(roomId: string | undefined, players: Player[]) {
  const [rawGameState, setRawGameState] = useState<PokerGameState | null>(null);
  const [raiseAmount, setRaiseAmount] = useState<string>("");
  const initialized = useRef(false);

  const myPlayer = players.find((p) => p.session_id === sessionId);
  const isHost = myPlayer?.is_host ?? false;

  // Load initial state
  useEffect(() => {
    if (!roomId) return;
    const load = async () => {
      const { data } = await supabase
        .from("rooms")
        .select("game_state")
        .eq("id", roomId)
        .single();
      if (data?.game_state && typeof data.game_state === "object" && "phase" in (data.game_state as any)) {
        const gs = normalizePokerState(data.game_state as unknown as PokerGameState);
        if (gs.players) {
          setRawGameState(gs);
          initialized.current = true;
        }
      }
    };
    load();
  }, [roomId]);

  // Realtime subscription
  useEffect(() => {
    if (!roomId) return;
    const channel = supabase
      .channel(`poker-${roomId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "rooms", filter: `id=eq.${roomId}` },
        (payload) => {
          const gs = payload.new?.game_state;
          if (gs && typeof gs === "object" && "phase" in (gs as any)) {
            setRawGameState(normalizePokerState(gs as unknown as PokerGameState));
          }
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [roomId]);

  const saveState = useCallback(async (state: PokerGameState) => {
    if (!roomId) return;
    setRawGameState(state);
    await supabase
      .from("rooms")
      .update({ game_state: state as any })
      .eq("id", roomId);
  }, [roomId]);

  const initGame = useCallback(async (settings?: Record<string, unknown>) => {
    if (!roomId || !isHost || initialized.current) return;
    const smallBlind = (settings?.smallBlind as number) || 10;
    const startingChips = (settings?.startingChips as number) || 1000;
    const state = initPokerGame(
      players.map((p) => ({ id: p.id, name: p.display_name })),
      smallBlind,
      startingChips
    );
    initialized.current = true;
    await saveState(state);
  }, [roomId, isHost, players, saveState]);

  const doDeal = useCallback(async () => {
    if (!rawGameState) return;
    const next = dealNewHand(rawGameState);
    await saveState(next);
  }, [rawGameState, saveState]);

  const doAction = useCallback(async (action: PokerAction, raiseTo?: number) => {
    if (!rawGameState || !myPlayer) return;
    const next = doPokerAction(rawGameState, myPlayer.id, action, raiseTo);
    await saveState(next);
    setRaiseAmount("");
  }, [rawGameState, myPlayer, saveState]);

  const doNextHand = useCallback(async () => {
    if (!rawGameState) return;
    const next = startNextHand(rawGameState);
    await saveState(next);
  }, [rawGameState, saveState]);

  // Filtered state for the viewer
  const gameState = rawGameState && myPlayer
    ? filterPokerStateForPlayer(rawGameState, myPlayer.id)
    : rawGameState;

  const myPokerPlayer = gameState?.players.find((p) => p.playerId === myPlayer?.id);

  const availableActions = gameState && myPlayer
    ? getAvailableActions(gameState, myPlayer.id)
    : [];

  const isMyTurn = gameState
    ? gameState.currentPlayerIndex === gameState.players.findIndex((p) => p.playerId === myPlayer?.id)
      && gameState.phase !== "waiting"
      && gameState.phase !== "showdown"
      && gameState.phase !== "hand_over"
    : false;

  return {
    gameState,
    myPokerPlayer,
    availableActions,
    isHost,
    isMyTurn,
    raiseAmount,
    setRaiseAmount,
    initGame,
    doDeal,
    doAction,
    doNextHand,
  };
}
