import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { sessionId, type Player } from "./useRoom";
import {
  type SeqGameState,
  type SeqTeam,
  initSequenceGame,
  setTeam,
  startSequenceGame,
  teamsBalanced,
  playCard,
  discardDeadCard,
  filterSeqStateForPlayer,
  newSequenceRound,
  getValidPlacements,
  isDeadCard,
} from "@/lib/sequence";

export function useSequence(roomId: string | undefined, players: Player[]) {
  const [rawGameState, setRawGameState] = useState<SeqGameState | null>(null);
  const [selectedCardIndex, setSelectedCardIndex] = useState<number | null>(null);
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
        const gs = data.game_state as unknown as SeqGameState;
        if (gs.board) {
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
      .channel(`sequence-${roomId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "rooms", filter: `id=eq.${roomId}` },
        (payload) => {
          const gs = payload.new?.game_state;
          if (gs && typeof gs === "object" && "board" in (gs as any)) {
            setRawGameState(gs as unknown as SeqGameState);
          }
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId]);

  const saveState = useCallback(
    async (state: SeqGameState) => {
      if (!roomId) return;
      setRawGameState(state);
      await supabase
        .from("rooms")
        .update({ game_state: state as any })
        .eq("id", roomId);
    },
    [roomId]
  );

  const initGame = useCallback(async () => {
    if (!roomId || !isHost || initialized.current) return;
    const state = initSequenceGame(
      players.map((p) => ({ id: p.id, name: p.display_name }))
    );
    initialized.current = true;
    await saveState(state);
  }, [roomId, isHost, players, saveState]);

  const doSetTeam = useCallback(
    async (playerId: string, team: SeqTeam) => {
      if (!rawGameState) return;
      // Players can only set their own team
      if (playerId !== myPlayer?.id) return;
      const next = setTeam(rawGameState, playerId, team);
      await saveState(next);
    },
    [rawGameState, myPlayer, saveState]
  );

  const doStartGame = useCallback(async () => {
    if (!rawGameState || !isHost) return;
    if (rawGameState.isTeamGame && !teamsBalanced(rawGameState)) return;
    const next = startSequenceGame(rawGameState);
    await saveState(next);
  }, [rawGameState, isHost, saveState]);

  const doPlayCard = useCallback(
    async (cardIndex: number, row: number, col: number) => {
      if (!rawGameState || !myPlayer) return;
      const next = playCard(rawGameState, myPlayer.id, cardIndex, row, col);
      await saveState(next);
      setSelectedCardIndex(null);
    },
    [rawGameState, myPlayer, saveState]
  );

  const doDiscardDead = useCallback(
    async (cardIndex: number) => {
      if (!rawGameState || !myPlayer) return;
      const next = discardDeadCard(rawGameState, myPlayer.id, cardIndex);
      await saveState(next);
      setSelectedCardIndex(null);
    },
    [rawGameState, myPlayer, saveState]
  );

  const doRematch = useCallback(async () => {
    if (!rawGameState || !isHost) return;
    const next = newSequenceRound(rawGameState);
    await saveState(next);
  }, [rawGameState, isHost, saveState]);

  // Filtered state for the viewer
  const gameState =
    rawGameState && myPlayer
      ? filterSeqStateForPlayer(rawGameState, myPlayer.id)
      : rawGameState;

  const mySeqPlayer = gameState?.players.find((p) => p.playerId === myPlayer?.id);
  const isMyTurn =
    gameState?.phase === "playing" &&
    gameState.players[gameState.currentPlayerIndex]?.playerId === myPlayer?.id;

  // Valid placements for selected card
  const validPlacements =
    gameState && myPlayer && selectedCardIndex !== null && isMyTurn
      ? getValidPlacements(rawGameState!, myPlayer.id, mySeqPlayer!.hand[selectedCardIndex])
      : [];

  // Check if selected card is dead
  const selectedCardIsDead =
    rawGameState && myPlayer && selectedCardIndex !== null && isMyTurn && mySeqPlayer
      ? isDeadCard(rawGameState, mySeqPlayer.hand[selectedCardIndex])
      : false;

  return {
    gameState,
    mySeqPlayer,
    isHost,
    isMyTurn,
    selectedCardIndex,
    setSelectedCardIndex,
    validPlacements,
    selectedCardIsDead,
    initGame,
    doSetTeam,
    doStartGame,
    doPlayCard,
    doDiscardDead,
    doRematch,
  };
}
