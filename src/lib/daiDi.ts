/* ── Dai Di (Big 2) — Game Logic ───────────────────────── */
/* Re-uses card ranking & combination logic from assholeDaiDi */

import {
  compareCards,
  parseCard,
  cardDisplay,
  sortHand,
  detectCombination,
  beats,
  cardRankValue,
  type CombinationType,
  type PlayedCombination,
} from "./assholeDaiDi";

// Re-export for convenience
export { compareCards, parseCard, cardDisplay, sortHand, detectCombination, beats, cardRankValue };
export type { CombinationType, PlayedCombination };

/* ── Types ─────────────────────────────────────────────── */

export type DDPhase =
  | "waiting"     // between rounds
  | "playing"     // active gameplay
  | "round_end";  // showing scores

export interface DDPlayer {
  playerId: string;
  name: string;
  hand: string[];
  cardCount: number;
  finishOrder: number;  // 0 = not yet finished
  passed: boolean;
  penaltyScore: number;      // this round penalty
  cumulativeScore: number;   // total across rounds (for winner: earnings; for loser: penalties)
  cumulativeEarnings: number; // winner earnings tracked separately
}

export interface DDHouseRules {
  allowEndOn2: boolean;
  allowTriples: boolean;
}

export interface DDPenaltyMultipliers {
  tenPlusCards: boolean;      // x2 for 10+ cards (default on)
  thirteenCards: boolean;     // x3 for all 13 cards
  twosSurcharge: boolean;    // +2 per 2 held
}

export const DEFAULT_DD_HOUSE_RULES: DDHouseRules = {
  allowEndOn2: false,
  allowTriples: false,
};

export const DEFAULT_DD_PENALTIES: DDPenaltyMultipliers = {
  tenPlusCards: true,
  thirteenCards: false,
  twosSurcharge: false,
};

export interface DDGameState {
  deck: string[];
  players: DDPlayer[];
  phase: DDPhase;
  roundNumber: number;
  currentPlayerIndex: number;
  currentCombination: PlayedCombination | null;
  consecutivePasses: number;
  lastPlayerId: string | null;
  finishCounter: number;
  turnTimerSeconds: number;
  houseRules: DDHouseRules;
  penalties: DDPenaltyMultipliers;
  message: string | null;
  discardPile: string[][];
  roundLeaderId: string | null;
  lastRoundWinnerId: string | null;
}

/* ── Deck ──────────────────────────────────────────────── */

const RANK_ORDER = ["3","4","5","6","7","8","9","10","J","Q","K","A","2"] as const;
const SUIT_ORDER = ["D","C","H","S"] as const;

function createDeck(): string[] {
  const deck: string[] = [];
  for (const suit of SUIT_ORDER) {
    for (const rank of RANK_ORDER) {
      deck.push(rank + suit);
    }
  }
  return shuffle(deck);
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* ── Init Game ─────────────────────────────────────────── */

export function initDDGame(
  playerNames: { id: string; name: string }[],
  turnTimer: number = 30,
  houseRules: DDHouseRules = DEFAULT_DD_HOUSE_RULES,
  penalties: DDPenaltyMultipliers = DEFAULT_DD_PENALTIES,
): DDGameState {
  return {
    deck: [],
    players: playerNames.map((p) => ({
      playerId: p.id,
      name: p.name,
      hand: [],
      cardCount: 0,
      finishOrder: 0,
      passed: false,
      penaltyScore: 0,
      cumulativeScore: 0,
      cumulativeEarnings: 0,
    })),
    phase: "waiting",
    roundNumber: 0,
    currentPlayerIndex: 0,
    currentCombination: null,
    consecutivePasses: 0,
    lastPlayerId: null,
    finishCounter: 0,
    turnTimerSeconds: turnTimer,
    houseRules,
    penalties,
    message: null,
    discardPile: [],
    roundLeaderId: null,
    lastRoundWinnerId: null,
  };
}

/* ── Deal ──────────────────────────────────────────────── */

export function dealDDRound(state: DDGameState): DDGameState {
  const s = structuredClone(state);
  s.deck = createDeck();
  s.roundNumber++;
  s.currentCombination = null;
  s.consecutivePasses = 0;
  s.lastPlayerId = null;
  s.finishCounter = 0;
  s.message = null;
  s.discardPile = [];
  s.roundLeaderId = null;

  // Reset player round state
  for (const p of s.players) {
    p.hand = [];
    p.cardCount = 0;
    p.finishOrder = 0;
    p.passed = false;
    p.penaltyScore = 0;
  }

  // Deal 13 cards each (4 players × 13 = 52)
  for (const p of s.players) {
    for (let i = 0; i < 13; i++) {
      p.hand.push(s.deck.pop()!);
    }
    p.hand = sortHand(p.hand);
    p.cardCount = p.hand.length;
  }

  // Determine first player
  if (s.roundNumber === 1 || !s.lastRoundWinnerId) {
    // Player with 3♦ goes first
    const idx = s.players.findIndex((p) => p.hand.includes("3D"));
    s.currentPlayerIndex = idx >= 0 ? idx : 0;
  } else {
    // Previous round winner leads
    const idx = s.players.findIndex((p) => p.playerId === s.lastRoundWinnerId);
    s.currentPlayerIndex = idx >= 0 ? idx : 0;
  }

  s.roundLeaderId = s.players[s.currentPlayerIndex].playerId;
  s.phase = "playing";
  return s;
}

/* ── Play Cards ────────────────────────────────────────── */

export function ddPlayCards(state: DDGameState, playerId: string, cardIndices: number[]): DDGameState {
  const s = structuredClone(state);
  if (s.phase !== "playing") return s;

  const pIdx = s.players.findIndex((p) => p.playerId === playerId);
  if (pIdx === -1 || pIdx !== s.currentPlayerIndex) return s;

  const player = s.players[pIdx];
  if (player.finishOrder > 0 || player.passed) return s;

  const cards = cardIndices.map((i) => player.hand[i]).filter(Boolean);
  if (cards.length === 0) return s;

  // Validate combination
  const combo = detectCombination(cards);
  if (!combo) return s;

  // Reject triples if house rule is off
  if (combo.type === "triple" && !s.houseRules.allowTriples) return s;

  // Round 1, first play must include 3♦
  if (s.roundNumber === 1 && s.discardPile.length === 0 && !s.currentCombination && !s.lastPlayerId) {
    if (!cards.includes("3D")) return s;
  }

  // Must beat current combination
  if (s.currentCombination) {
    if (!beats(cards, s.currentCombination)) return s;
  }

  // End-on-2 restriction
  if (!s.houseRules.allowEndOn2) {
    const remainingAfter = player.hand.length - cards.length;
    if (remainingAfter === 0) {
      const allTwos = cards.every((c) => parseCard(c).rank === "2");
      if (allTwos && cards.length <= 3) return s;
    }
  }

  // Remove cards from hand
  const sortedIndices = [...cardIndices].sort((a, b) => b - a);
  for (const idx of sortedIndices) {
    player.hand.splice(idx, 1);
  }
  player.cardCount = player.hand.length;

  s.currentCombination = {
    cards,
    type: combo.type,
    tier: combo.tier,
    playerId,
    playerName: player.name,
  };
  s.lastPlayerId = playerId;
  s.consecutivePasses = 0;
  s.discardPile.push(cards);

  // Reset all passes
  for (const p of s.players) {
    if (p.finishOrder === 0) p.passed = false;
  }

  // Check if player shed all cards
  if (player.hand.length === 0) {
    s.finishCounter++;
    player.finishOrder = s.finishCounter;

    // First to finish is the winner
    if (s.finishCounter === 1) {
      s.lastRoundWinnerId = playerId;
    }

    // Check if round is over (only 1 player needs to win for Dai Di)
    // Actually all remaining players get penalties, game stops immediately
    return endDDRound(s);
  }

  // Move to next active player
  s.currentPlayerIndex = nextActivePlayer(s, pIdx);

  // If next player is the one who played last, they lead again
  if (s.players[s.currentPlayerIndex].playerId === s.lastPlayerId) {
    s.currentCombination = null;
    s.discardPile = [];
    s.roundLeaderId = s.players[s.currentPlayerIndex].playerId;
  }

  return s;
}

/* ── Pass ──────────────────────────────────────────────── */

export function ddPass(state: DDGameState, playerId: string): DDGameState {
  const s = structuredClone(state);
  if (s.phase !== "playing") return s;

  const pIdx = s.players.findIndex((p) => p.playerId === playerId);
  if (pIdx === -1 || pIdx !== s.currentPlayerIndex) return s;

  const player = s.players[pIdx];
  if (player.finishOrder > 0) return s;

  // Can't pass if you're the round leader
  if (!s.currentCombination) return s;

  player.passed = true;
  s.consecutivePasses++;

  // Check if all other active players passed
  const activePlayers = s.players.filter((p) => p.finishOrder === 0 && !p.passed);

  if (activePlayers.length <= 1) {
    const leaderId = s.lastPlayerId;
    s.currentCombination = null;
    s.discardPile = [];
    s.consecutivePasses = 0;

    for (const p of s.players) {
      if (p.finishOrder === 0) p.passed = false;
    }

    if (leaderId) {
      const leaderIdx = s.players.findIndex((p) => p.playerId === leaderId);
      if (leaderIdx >= 0 && s.players[leaderIdx].finishOrder === 0) {
        s.currentPlayerIndex = leaderIdx;
        s.roundLeaderId = leaderId;
      } else {
        s.currentPlayerIndex = nextActivePlayer(s, leaderIdx >= 0 ? leaderIdx : pIdx);
        s.roundLeaderId = s.players[s.currentPlayerIndex].playerId;
      }
    }
    return s;
  }

  s.currentPlayerIndex = nextActivePlayer(s, pIdx);
  return s;
}

/* ── Helpers ───────────────────────────────────────────── */

function nextActivePlayer(state: DDGameState, fromIdx: number): number {
  const n = state.players.length;
  for (let i = 1; i <= n; i++) {
    const idx = (fromIdx + i) % n;
    const p = state.players[idx];
    if (p.finishOrder === 0 && !p.passed) return idx;
  }
  for (let i = 1; i <= n; i++) {
    const idx = (fromIdx + i) % n;
    if (state.players[idx].finishOrder === 0) return idx;
  }
  return fromIdx;
}

/* ── End Round ─────────────────────────────────────────── */

function endDDRound(state: DDGameState): DDGameState {
  const s = state;
  s.phase = "round_end";

  const winner = s.players.find((p) => p.finishOrder === 1);

  // Calculate penalties for losers
  let totalPenalty = 0;
  for (const p of s.players) {
    if (p.finishOrder === 1) continue; // winner
    let penalty = p.cardCount; // base = cards remaining

    // Apply multipliers
    if (s.penalties.thirteenCards && p.cardCount === 13) {
      penalty = p.cardCount * 3;
    } else if (s.penalties.tenPlusCards && p.cardCount >= 10) {
      penalty = p.cardCount * 2;
    }

    // 2s surcharge
    if (s.penalties.twosSurcharge) {
      const twosCount = p.hand.filter((c) => parseCard(c).rank === "2").length;
      penalty += twosCount * 2;
    }

    p.penaltyScore = penalty;
    p.cumulativeScore += penalty;
    totalPenalty += penalty;
  }

  // Winner earns sum of all penalties
  if (winner) {
    winner.penaltyScore = 0;
    winner.cumulativeEarnings += totalPenalty;
    s.message = `${winner.name} wins and earns ${totalPenalty} points!`;
  }

  return s;
}

/* ── Filter State for Player ───────────────────────────── */

export function filterDDStateForPlayer(state: DDGameState, playerId: string): DDGameState {
  const s = structuredClone(state);
  for (const p of s.players) {
    if (p.playerId !== playerId) {
      p.hand = [];
    }
  }
  return s;
}

/* ── Rematch ───────────────────────────────────────────── */

export function rematchDDGame(state: DDGameState): DDGameState {
  const s = structuredClone(state);
  s.roundNumber = 0;
  s.phase = "waiting";
  s.lastRoundWinnerId = null;
  for (const p of s.players) {
    p.hand = [];
    p.cardCount = 0;
    p.finishOrder = 0;
    p.passed = false;
    p.penaltyScore = 0;
    p.cumulativeScore = 0;
    p.cumulativeEarnings = 0;
  }
  s.currentCombination = null;
  s.consecutivePasses = 0;
  s.lastPlayerId = null;
  s.finishCounter = 0;
  s.message = null;
  s.discardPile = [];
  s.roundLeaderId = null;
  return s;
}
