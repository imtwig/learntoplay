import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { sessionId, type Player } from "./useRoom";
import {
  type ADDGameState,
  initADDGame,
  dealRound,
  playCards,
  passPlay,
  autoPlay,
  startSwapPhase,
  submitSwapReturn,
  finishSwapAndPlay,
  filterADDStateForPlayer,
  rematchADDGame,
  type ADDHouseRules,
  DEFAULT_ADD_HOUSE_RULES,
} from "@/lib/assholeDaiDi";

function normalizeState(gs: ADDGameState): ADDGameState {
  if (!gs.discardPile) gs.discardPile = [];
  if (!gs.swapPending) gs.swapPending = [];
  if (!gs.houseRules) gs.houseRules = DEFAULT_ADD_HOUSE_RULES;
  // Remove deprecated fields from old game states
  delete (gs as any).allowTwosToEnd;
  return gs;
}

export function useAssholeDaiDi(roomId: string | undefined, players: Player[]) {
  const [rawGameState, setRawGameState] = useState<ADDGameState | null>(null);
  const [selectedCards, setSelectedCards] = useState<number[]>([]);
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
        const gs = normalizeState(data.game_state as unknown as ADDGameState);
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
      .channel(`asshole-daidi-${roomId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "rooms", filter: `id=eq.${roomId}` },
        (payload) => {
          const gs = payload.new?.game_state;
          if (gs && typeof gs === "object" && "phase" in (gs as any)) {
            setRawGameState(normalizeState(gs as unknown as ADDGameState));
            setSelectedCards([]);
          }
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [roomId]);

  const saveState = useCallback(async (state: ADDGameState) => {
    if (!roomId) return;
    setRawGameState(state);
    await supabase
      .from("rooms")
      .update({ game_state: state as any })
      .eq("id", roomId);
  }, [roomId]);

  const initGame = useCallback(async (settings?: Record<string, unknown>) => {
    if (!roomId || !isHost || initialized.current) return;
    const turnTimer = (settings?.turnTimer as number) || 30;
    const hr = (settings?.houseRules as ADDHouseRules) || DEFAULT_ADD_HOUSE_RULES;
    const state = initADDGame(
      players.map((p) => ({ id: p.id, name: p.display_name })),
      turnTimer,
      hr
    );
    initialized.current = true;
    await saveState(state);
  }, [roomId, isHost, players, saveState]);

  const doDeal = useCallback(async () => {
    if (!rawGameState) return;
    const next = dealRound(rawGameState);
    await saveState(next);
  }, [rawGameState, saveState]);

  const doPlay = useCallback(async (cardIndices: number[]) => {
    if (!rawGameState || !myPlayer) return;
    const next = playCards(rawGameState, myPlayer.id, cardIndices);
    setSelectedCards([]);
    await saveState(next);
  }, [rawGameState, myPlayer, saveState]);

  const doPass = useCallback(async () => {
    if (!rawGameState || !myPlayer) return;
    const next = passPlay(rawGameState, myPlayer.id);
    setSelectedCards([]);
    await saveState(next);
  }, [rawGameState, myPlayer, saveState]);

  const doStartSwap = useCallback(async () => {
    if (!rawGameState || !isHost) return;
    const next = startSwapPhase(rawGameState);
    await saveState(next);
  }, [rawGameState, isHost, saveState]);

  const doSubmitSwapReturn = useCallback(async (cardIndices: number[]) => {
    if (!rawGameState || !myPlayer) return;
    const next = submitSwapReturn(rawGameState, myPlayer.id, cardIndices);
    setSelectedCards([]);
    await saveState(next);
  }, [rawGameState, myPlayer, saveState]);

  const doFinishSwap = useCallback(async () => {
    if (!rawGameState) return;
    const next = finishSwapAndPlay(rawGameState);
    await saveState(next);
  }, [rawGameState, saveState]);

  const doRematch = useCallback(async () => {
    if (!rawGameState || !isHost) return;
    const next = rematchADDGame(rawGameState);
    await saveState(next);
  }, [rawGameState, isHost, saveState]);

  // Filtered state
  const gameState = rawGameState && myPlayer
    ? filterADDStateForPlayer(rawGameState, myPlayer.id)
    : rawGameState;

  const myADDPlayer = gameState?.players.find((p) => p.playerId === myPlayer?.id);

  const isMyTurn = gameState
    ? gameState.phase === "playing" &&
      gameState.currentPlayerIndex === gameState.players.findIndex((p) => p.playerId === myPlayer?.id) &&
      (myADDPlayer?.finishOrder === 0)
    : false;

  const canPass = isMyTurn && !!gameState?.currentCombination;

  // Check if I need to submit swap return
  const mySwapPending = gameState?.swapPending.find(
    (sw) => sw.toId === myPlayer?.id && sw.returnedCards.length === 0
  );

  return {
    gameState,
    myADDPlayer,
    isHost,
    isMyTurn,
    canPass,
    selectedCards,
    setSelectedCards,
    mySwapPending,
    initGame,
    doDeal,
    doPlay,
    doPass,
    doStartSwap,
    doSubmitSwapReturn,
    doFinishSwap,
    doRematch,
  };
}
