import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { sessionId, type Player } from "./useRoom";
import {
  type BJGameState,
  type PlayerAction,
  type DealOverrides,
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
  toggleShowFirstCard,
} from "@/lib/blackjack";

/** Ensure game state loaded from DB has all required fields */
function normalizeGameState(gs: BJGameState): BJGameState {
  if (!gs.revealedPlayerIds) gs.revealedPlayerIds = [];
  if (!gs.settings) gs.settings = { showFirstCard: false, showFirstCardNextRound: false };
  if (gs.settings.showFirstCard === undefined) gs.settings.showFirstCard = false;
  if (gs.settings.showFirstCardNextRound === undefined) gs.settings.showFirstCardNextRound = false;
  return gs;
}

export function useBlackjack(roomId: string | undefined, players: Player[]) {
  const [rawGameState, setRawGameState] = useState<BJGameState | null>(null);
  const [myBetInput, setMyBetInput] = useState<string>("");
  const initialized = useRef(false);
  const roomIdRef = useRef(roomId);
  roomIdRef.current = roomId;

  const myPlayer = players.find((p) => p.session_id === sessionId);
  const isHost = myPlayer?.is_host ?? false;
  const isBJDealer = rawGameState?.players.find((p) => p.playerId === myPlayer?.id)?.isDealer ?? false;

  // Single effect: load + subscribe + poll fallback
  useEffect(() => {
    if (!roomId) return;
    let active = true;
    let pollTimer: ReturnType<typeof setTimeout>;

    const isValidBJState = (gs: any): boolean =>
      gs && typeof gs === "object" && "phase" in gs && "players" in gs;

    const fetchState = async () => {
      const { data } = await supabase
        .from("rooms")
        .select("game_state")
        .eq("id", roomId)
        .single();
      if (!active) return;
      if (data?.game_state && isValidBJState(data.game_state)) {
        const gs = normalizeGameState(data.game_state as unknown as BJGameState);
        setRawGameState(gs);
        initialized.current = true;
      }
    };

    // Initial load
    fetchState();

    // Realtime subscription
    const channel = supabase
      .channel(`blackjack-${roomId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "rooms", filter: `id=eq.${roomId}` },
        (payload) => {
          if (!active) return;
          const gs = payload.new?.game_state;
          if (isValidBJState(gs)) {
            setRawGameState(normalizeGameState(gs as unknown as BJGameState));
          }
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED" && active) {
          fetchState();
        }
      });

    // Polling fallback: retry every 2s until state is loaded, then every 10s
    const poll = () => {
      if (!active) return;
      fetchState().then(() => {
        if (active) {
          pollTimer = setTimeout(poll, rawGameState ? 10000 : 2000);
        }
      });
    };
    pollTimer = setTimeout(poll, 2000);

    return () => {
      active = false;
      clearTimeout(pollTimer);
      supabase.removeChannel(channel);
    };
  }, [roomId]);

  const saveState = useCallback(async (state: BJGameState) => {
    if (!roomId) return;
    setRawGameState(state);
    await supabase
      .from("rooms")
      .update({ game_state: state as any })
      .eq("id", roomId);
  }, [roomId]);

  const initGame = useCallback(async (settings?: Record<string, unknown>) => {
    if (!roomId || !isHost || initialized.current) return;
    const hostPlayer = players.find((p) => p.is_host);
    const state = initGameState(
      players.map((p) => ({ id: p.id, name: p.display_name })),
      hostPlayer?.id ?? players[0].id
    );
    // Apply room-level settings
    if (settings?.showFirstCard) {
      state.settings.showFirstCard = true;
      state.settings.showFirstCardNextRound = true;
    }
    initialized.current = true;
    await saveState(state);
  }, [roomId, isHost, players, saveState]);

  const markReady = useCallback(async () => {
    if (!rawGameState || !myPlayer) return;
    const bet = parseInt(myBetInput) || 0;
    const next = setPlayerReady(rawGameState, myPlayer.id, bet);
    await saveState(next);
  }, [rawGameState, myPlayer, myBetInput, saveState]);

  const markUnready = useCallback(async () => {
    if (!rawGameState || !myPlayer) return;
    const next = setPlayerUnready(rawGameState, myPlayer.id);
    await saveState(next);
  }, [rawGameState, myPlayer, saveState]);

  const startRound = useCallback(async (overrides?: DealOverrides) => {
    if (!rawGameState) return;
    if (!allPlayersReady(rawGameState)) return;
    const next = startDeal(rawGameState, overrides);
    await saveState(next);
  }, [rawGameState, saveState]);

  const doAction = useCallback(async (action: PlayerAction) => {
    if (!rawGameState || !myPlayer) return;
    const next = playerAction(rawGameState, myPlayer.id, action);
    await saveState(next);
  }, [rawGameState, myPlayer, saveState]);

  const doRevealPlayer = useCallback(async (playerId: string) => {
    if (!rawGameState || !isBJDealer) return;
    const next = revealPlayer(rawGameState, playerId);
    await saveState(next);
  }, [rawGameState, isBJDealer, saveState]);

  const doRevealAll = useCallback(async () => {
    if (!rawGameState || !isBJDealer) return;
    const next = revealAll(rawGameState);
    await saveState(next);
  }, [rawGameState, isBJDealer, saveState]);

  const nextRound = useCallback(async () => {
    if (!rawGameState || !isHost) return;
    const next = newRound(rawGameState);
    await saveState(next);
  }, [rawGameState, isHost, saveState]);

  const doToggleShowFirstCard = useCallback(async () => {
    if (!rawGameState || !isHost) return;
    const next = toggleShowFirstCard(rawGameState);
    await saveState(next);
  }, [rawGameState, isHost, saveState]);

  const gameState = rawGameState && myPlayer
    ? filterStateForPlayer(rawGameState, myPlayer.id)
    : rawGameState;

  const availableActions = gameState && myPlayer
    ? getAvailableActions(gameState, myPlayer.id)
    : [];

  const myBJPlayer = gameState?.players.find((p) => p.playerId === myPlayer?.id);

  return {
    gameState,
    rawSettings: rawGameState?.settings,
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
    doToggleShowFirstCard,
  };
}
