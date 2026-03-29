import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { sessionId, type Player } from "./useRoom";
import {
  type DDGameState,
  initDDGame,
  dealDDRound,
  ddPlayCards,
  ddPass,
  filterDDStateForPlayer,
  rematchDDGame,
  type DDHouseRules,
  type DDPenaltyMultipliers,
  DEFAULT_DD_HOUSE_RULES,
  DEFAULT_DD_PENALTIES,
} from "@/lib/daiDi";

function normalizeState(gs: DDGameState): DDGameState {
  if (!gs.discardPile) gs.discardPile = [];
  if (!gs.houseRules) gs.houseRules = DEFAULT_DD_HOUSE_RULES;
  if (!gs.penalties) gs.penalties = DEFAULT_DD_PENALTIES;
  return gs;
}

export function useDaiDi(roomId: string | undefined, players: Player[]) {
  const [rawGameState, setRawGameState] = useState<DDGameState | null>(null);
  const [selectedCards, setSelectedCards] = useState<number[]>([]);
  const initialized = useRef(false);

  const myPlayer = players.find((p) => p.session_id === sessionId);
  const isHost = myPlayer?.is_host ?? false;

  useEffect(() => {
    if (!roomId) return;
    const load = async () => {
      const { data } = await supabase
        .from("rooms")
        .select("game_state")
        .eq("id", roomId)
        .single();
      if (data?.game_state && typeof data.game_state === "object" && "phase" in (data.game_state as any)) {
        const gs = normalizeState(data.game_state as unknown as DDGameState);
        if (gs.players) {
          setRawGameState(gs);
          initialized.current = true;
        }
      }
    };
    load();
  }, [roomId]);

  useEffect(() => {
    if (!roomId) return;
    const channel = supabase
      .channel(`daidi-${roomId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "rooms", filter: `id=eq.${roomId}` },
        (payload) => {
          const gs = payload.new?.game_state;
          if (gs && typeof gs === "object" && "phase" in (gs as any)) {
            setRawGameState(normalizeState(gs as unknown as DDGameState));
            setSelectedCards([]);
          }
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [roomId]);

  const saveState = useCallback(async (state: DDGameState) => {
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
    const hr = (settings?.houseRules as DDHouseRules) || DEFAULT_DD_HOUSE_RULES;
    const pen = (settings?.penalties as DDPenaltyMultipliers) || DEFAULT_DD_PENALTIES;
    const state = initDDGame(
      players.map((p) => ({ id: p.id, name: p.display_name })),
      turnTimer,
      hr,
      pen,
    );
    initialized.current = true;
    await saveState(state);
  }, [roomId, isHost, players, saveState]);

  const doDeal = useCallback(async () => {
    if (!rawGameState) return;
    const next = dealDDRound(rawGameState);
    await saveState(next);
  }, [rawGameState, saveState]);

  const doPlay = useCallback(async (cardIndices: number[]) => {
    if (!rawGameState || !myPlayer) return;
    const next = ddPlayCards(rawGameState, myPlayer.id, cardIndices);
    setSelectedCards([]);
    await saveState(next);
  }, [rawGameState, myPlayer, saveState]);

  const doPass = useCallback(async () => {
    if (!rawGameState || !myPlayer) return;
    const next = ddPass(rawGameState, myPlayer.id);
    setSelectedCards([]);
    await saveState(next);
  }, [rawGameState, myPlayer, saveState]);

  const doRematch = useCallback(async () => {
    if (!rawGameState || !isHost) return;
    const next = rematchDDGame(rawGameState);
    await saveState(next);
  }, [rawGameState, isHost, saveState]);

  const gameState = rawGameState && myPlayer
    ? filterDDStateForPlayer(rawGameState, myPlayer.id)
    : rawGameState;

  const myDDPlayer = gameState?.players.find((p) => p.playerId === myPlayer?.id);

  const isMyTurn = gameState
    ? gameState.phase === "playing" &&
      gameState.currentPlayerIndex === gameState.players.findIndex((p) => p.playerId === myPlayer?.id) &&
      (myDDPlayer?.finishOrder === 0)
    : false;

  // Can always pass during your turn
  const canPass = isMyTurn;

  return {
    gameState,
    myDDPlayer,
    isHost,
    isMyTurn,
    canPass,
    selectedCards,
    setSelectedCards,
    initGame,
    doDeal,
    doPlay,
    doPass,
    doRematch,
  };
}
