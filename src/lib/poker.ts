/* ── Texas Hold'em Poker — Game Logic ─────────────────── */

/* ── Types ─────────────────────────────────────────────── */

export interface PokerPlayer {
  playerId: string;
  name: string;
  chips: number;
  holeCards: string[];       // e.g. ["AS", "KH"]
  currentBet: number;        // bet in current betting round
  totalBetThisHand: number;  // total across all rounds this hand
  folded: boolean;
  allIn: boolean;
  eliminated: boolean;
  lastAction: string | null;
  sittingOut: boolean;
}

export interface SidePot {
  amount: number;
  eligiblePlayerIds: string[];
}

export type PokerPhase =
  | "waiting"     // between hands, waiting for next deal
  | "pre_flop"
  | "flop"
  | "turn"
  | "river"
  | "showdown"
  | "hand_over";

export interface PokerGameState {
  deck: string[];
  communityCards: string[];
  players: PokerPlayer[];
  dealerIndex: number;
  currentPlayerIndex: number;
  phase: PokerPhase;
  pot: number;
  sidePots: SidePot[];
  currentBet: number;       // highest bet this round
  minRaise: number;          // minimum raise amount
  smallBlind: number;
  bigBlind: number;
  startingChips: number;
  lastRaiserIndex: number | null;  // who last raised (to know when action is complete)
  handNumber: number;
  winners: { playerId: string; amount: number; hand?: string }[] | null;
  message: string | null;
  actedThisRound: Set<number> | number[];  // serialized as array
}

/* ── Helpers ───────────────────────────────────────────── */

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function createPokerDeck(): string[] {
  const ranks = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
  const suits = ["S", "C", "D", "H"];
  const deck: string[] = [];
  for (const suit of suits) {
    for (const rank of ranks) {
      deck.push(rank + suit);
    }
  }
  return shuffle(deck);
}

function getActedSet(state: PokerGameState): Set<number> {
  if (state.actedThisRound instanceof Set) return state.actedThisRound;
  return new Set(state.actedThisRound as number[]);
}

function setActed(state: PokerGameState, set: Set<number>) {
  state.actedThisRound = Array.from(set);
}

/* ── Init ──────────────────────────────────────────────── */

export function initPokerGame(
  playerNames: { id: string; name: string }[],
  smallBlind: number = 10,
  startingChips: number = 1000
): PokerGameState {
  return {
    deck: [],
    communityCards: [],
    players: playerNames.map((p) => ({
      playerId: p.id,
      name: p.name,
      chips: startingChips,
      holeCards: [],
      currentBet: 0,
      totalBetThisHand: 0,
      folded: false,
      allIn: false,
      eliminated: false,
      lastAction: null,
      sittingOut: false,
    })),
    dealerIndex: 0,
    currentPlayerIndex: 0,
    phase: "waiting",
    pot: 0,
    sidePots: [],
    currentBet: 0,
    minRaise: smallBlind * 2,
    smallBlind,
    bigBlind: smallBlind * 2,
    startingChips,
    lastRaiserIndex: null,
    handNumber: 0,
    winners: null,
    message: null,
    actedThisRound: [],
  };
}

/* ── Active player helpers ─────────────────────────────── */

function activePlayers(state: PokerGameState): PokerPlayer[] {
  return state.players.filter((p) => !p.folded && !p.eliminated && !p.sittingOut);
}

function activeNonAllIn(state: PokerGameState): PokerPlayer[] {
  return state.players.filter((p) => !p.folded && !p.eliminated && !p.sittingOut && !p.allIn);
}

function nextActiveIndex(state: PokerGameState, fromIndex: number): number {
  const n = state.players.length;
  for (let i = 1; i <= n; i++) {
    const idx = (fromIndex + i) % n;
    const p = state.players[idx];
    if (!p.folded && !p.eliminated && !p.sittingOut && !p.allIn) return idx;
  }
  return fromIndex;
}

/* ── Deal a new hand ───────────────────────────────────── */

export function dealNewHand(state: PokerGameState): PokerGameState {
  const s = structuredClone(state);
  s.deck = createPokerDeck();
  s.communityCards = [];
  s.pot = 0;
  s.sidePots = [];
  s.currentBet = 0;
  s.minRaise = s.bigBlind;
  s.lastRaiserIndex = null;
  s.winners = null;
  s.message = null;
  s.handNumber++;
  s.actedThisRound = [];

  // Reset player states
  for (const p of s.players) {
    p.holeCards = [];
    p.currentBet = 0;
    p.totalBetThisHand = 0;
    p.folded = false;
    p.allIn = false;
    p.lastAction = null;
    if (p.chips <= 0) {
      p.eliminated = true;
      p.sittingOut = true;
    }
  }

  // Move dealer
  if (s.handNumber > 1) {
    s.dealerIndex = nextActivePlayerFrom(s, s.dealerIndex);
  }

  // Post blinds
  const sbIdx = nextActivePlayerFrom(s, s.dealerIndex);
  const bbIdx = nextActivePlayerFrom(s, sbIdx);

  const sbPlayer = s.players[sbIdx];
  const bbPlayer = s.players[bbIdx];

  // Small blind
  const sbAmount = Math.min(s.smallBlind, sbPlayer.chips);
  sbPlayer.chips -= sbAmount;
  sbPlayer.currentBet = sbAmount;
  sbPlayer.totalBetThisHand = sbAmount;
  s.pot += sbAmount;
  if (sbPlayer.chips === 0) sbPlayer.allIn = true;

  // Big blind
  const bbAmount = Math.min(s.bigBlind, bbPlayer.chips);
  bbPlayer.chips -= bbAmount;
  bbPlayer.currentBet = bbAmount;
  bbPlayer.totalBetThisHand = bbAmount;
  s.pot += bbAmount;
  if (bbPlayer.chips === 0) bbPlayer.allIn = true;

  s.currentBet = s.bigBlind;

  // Deal hole cards
  for (const p of s.players) {
    if (!p.eliminated && !p.sittingOut) {
      p.holeCards.push(s.deck.pop()!);
      p.holeCards.push(s.deck.pop()!);
    }
  }

  s.phase = "pre_flop";
  // Action starts left of big blind
  s.currentPlayerIndex = nextActiveIndex(s, bbIdx);
  s.lastRaiserIndex = bbIdx; // BB is considered the last raiser pre-flop

  return s;
}

function nextActivePlayerFrom(state: PokerGameState, fromIndex: number): number {
  const n = state.players.length;
  for (let i = 1; i <= n; i++) {
    const idx = (fromIndex + i) % n;
    const p = state.players[idx];
    if (!p.eliminated && !p.sittingOut) return idx;
  }
  return fromIndex;
}

/* ── Player actions ────────────────────────────────────── */

export type PokerAction = "fold" | "check" | "call" | "raise" | "all_in";

export function getAvailableActions(state: PokerGameState, playerId: string): { action: PokerAction; minAmount?: number; maxAmount?: number }[] {
  if (state.phase === "waiting" || state.phase === "showdown" || state.phase === "hand_over") return [];

  const pIdx = state.players.findIndex((p) => p.playerId === playerId);
  if (pIdx === -1 || pIdx !== state.currentPlayerIndex) return [];

  const player = state.players[pIdx];
  if (player.folded || player.allIn || player.eliminated) return [];

  const actions: { action: PokerAction; minAmount?: number; maxAmount?: number }[] = [];
  const toCall = state.currentBet - player.currentBet;

  // Fold is always available
  actions.push({ action: "fold" });

  if (toCall === 0) {
    // Can check
    actions.push({ action: "check" });
  } else {
    // Can call
    if (player.chips >= toCall) {
      actions.push({ action: "call", minAmount: toCall });
    }
  }

  // Can raise if they have enough chips
  const minRaiseTotal = state.currentBet + state.minRaise;
  const raiseAmount = minRaiseTotal - player.currentBet;
  if (player.chips > toCall && player.chips >= raiseAmount) {
    actions.push({
      action: "raise",
      minAmount: minRaiseTotal,          // minimum raise TO amount
      maxAmount: player.chips + player.currentBet,  // max (all-in)
    });
  }

  // All-in is always available if they have chips
  if (player.chips > 0) {
    actions.push({ action: "all_in" });
  }

  return actions;
}

export function doPokerAction(
  state: PokerGameState,
  playerId: string,
  action: PokerAction,
  raiseToAmount?: number
): PokerGameState {
  const s = structuredClone(state);
  if (s.phase === "waiting" || s.phase === "showdown" || s.phase === "hand_over") return s;

  const pIdx = s.players.findIndex((p) => p.playerId === playerId);
  if (pIdx === -1 || pIdx !== s.currentPlayerIndex) return s;

  const player = s.players[pIdx];
  if (player.folded || player.allIn || player.eliminated) return s;

  const acted = getActedSet(s);

  switch (action) {
    case "fold": {
      player.folded = true;
      player.lastAction = "Fold";
      break;
    }
    case "check": {
      if (s.currentBet > player.currentBet) return s; // can't check
      player.lastAction = "Check";
      acted.add(pIdx);
      break;
    }
    case "call": {
      const toCall = Math.min(s.currentBet - player.currentBet, player.chips);
      player.chips -= toCall;
      player.currentBet += toCall;
      player.totalBetThisHand += toCall;
      s.pot += toCall;
      player.lastAction = `Call $${toCall}`;
      if (player.chips === 0) player.allIn = true;
      acted.add(pIdx);
      break;
    }
    case "raise": {
      const raiseTo = raiseToAmount ?? (s.currentBet + s.minRaise);
      const raiseBy = raiseTo - s.currentBet;
      if (raiseBy < s.minRaise && (raiseTo - player.currentBet) < player.chips) return s; // raise too small (unless all-in)
      
      const totalNeeded = raiseTo - player.currentBet;
      const actualPay = Math.min(totalNeeded, player.chips);
      player.chips -= actualPay;
      player.currentBet += actualPay;
      player.totalBetThisHand += actualPay;
      s.pot += actualPay;
      
      s.minRaise = Math.max(s.minRaise, raiseBy);
      s.currentBet = player.currentBet;
      s.lastRaiserIndex = pIdx;
      player.lastAction = `Raise to $${s.currentBet}`;
      if (player.chips === 0) player.allIn = true;
      
      // Reset acted — everyone needs to act again
      acted.clear();
      acted.add(pIdx);
      break;
    }
    case "all_in": {
      const amount = player.chips;
      player.currentBet += amount;
      player.totalBetThisHand += amount;
      s.pot += amount;
      player.chips = 0;
      player.allIn = true;
      
      if (player.currentBet > s.currentBet) {
        const raiseBy = player.currentBet - s.currentBet;
        if (raiseBy >= s.minRaise) {
          s.minRaise = raiseBy;
        }
        s.currentBet = player.currentBet;
        s.lastRaiserIndex = pIdx;
        // Reset acted
        acted.clear();
        acted.add(pIdx);
      } else {
        acted.add(pIdx);
      }
      player.lastAction = `All-In $${amount}`;
      break;
    }
  }

  setActed(s, acted);

  // Check if hand is over (only 1 player left)
  const remaining = activePlayers(s);
  if (remaining.length <= 1) {
    return resolveHand(s);
  }

  // Check if betting round is complete
  if (isBettingRoundComplete(s)) {
    return advancePhase(s);
  }

  // Move to next player
  s.currentPlayerIndex = nextActiveIndex(s, pIdx);
  return s;
}

function isBettingRoundComplete(state: PokerGameState): boolean {
  const acted = getActedSet(state);
  const canAct = state.players.filter((p, i) => !p.folded && !p.eliminated && !p.sittingOut && !p.allIn);
  
  // All players who can act must have acted
  for (let i = 0; i < state.players.length; i++) {
    const p = state.players[i];
    if (p.folded || p.eliminated || p.sittingOut || p.allIn) continue;
    if (!acted.has(i)) return false;
    // Also check if their bet matches current bet
    if (p.currentBet < state.currentBet) return false;
  }
  
  return canAct.length === 0 || acted.size >= canAct.length;
}

/* ── Phase advancement ─────────────────────────────────── */

function advancePhase(state: PokerGameState): PokerGameState {
  const s = state;

  // Build side pots before advancing
  buildSidePots(s);

  // Reset round bets
  for (const p of s.players) {
    p.currentBet = 0;
    p.lastAction = null;
  }
  s.currentBet = 0;
  s.minRaise = s.bigBlind;
  s.lastRaiserIndex = null;
  s.actedThisRound = [];

  // If only non-all-in players left is <=1, deal remaining community cards and resolve
  const canStillAct = activeNonAllIn(s);
  
  switch (s.phase) {
    case "pre_flop":
      s.phase = "flop";
      s.deck.pop(); // burn
      s.communityCards.push(s.deck.pop()!, s.deck.pop()!, s.deck.pop()!);
      break;
    case "flop":
      s.phase = "turn";
      s.deck.pop(); // burn
      s.communityCards.push(s.deck.pop()!);
      break;
    case "turn":
      s.phase = "river";
      s.deck.pop(); // burn
      s.communityCards.push(s.deck.pop()!);
      break;
    case "river":
      return resolveHand(s);
  }

  // If 0 or 1 players can still bet, run out remaining cards
  if (canStillAct.length <= 1) {
    // Auto-advance to showdown
    while (s.communityCards.length < 5) {
      s.deck.pop(); // burn
      s.communityCards.push(s.deck.pop()!);
    }
    return resolveHand(s);
  }

  // Set action to first player after dealer
  s.currentPlayerIndex = nextActiveIndex(s, s.dealerIndex);
  return s;
}

/* ── Side pot building ─────────────────────────────────── */

function buildSidePots(state: PokerGameState) {
  // Collect all bets per player for the entire hand
  const playerBets: { idx: number; total: number }[] = [];
  for (let i = 0; i < state.players.length; i++) {
    const p = state.players[i];
    if (p.eliminated || p.sittingOut) continue;
    if (p.totalBetThisHand > 0 || !p.folded) {
      playerBets.push({ idx: i, total: p.totalBetThisHand });
    }
  }

  // Sort by total bet
  const sorted = [...playerBets].sort((a, b) => a.total - b.total);
  
  const pots: SidePot[] = [];
  let processedAmount = 0;

  for (let i = 0; i < sorted.length; i++) {
    const level = sorted[i].total;
    if (level <= processedAmount) continue;

    const contribution = level - processedAmount;
    const eligible = playerBets
      .filter((pb) => pb.total >= level && !state.players[pb.idx].folded)
      .map((pb) => state.players[pb.idx].playerId);

    const contributors = playerBets.filter((pb) => pb.total >= level);
    const potAmount = contribution * contributors.length;

    if (potAmount > 0 && eligible.length > 0) {
      pots.push({ amount: potAmount, eligiblePlayerIds: eligible });
    }

    processedAmount = level;
  }

  if (pots.length > 0) {
    state.sidePots = pots;
  }
}

/* ── Hand resolution ───────────────────────────────────── */

function resolveHand(state: PokerGameState): PokerGameState {
  const s = state;
  s.phase = "showdown";

  const remaining = activePlayers(s);

  // If only one player left, they win everything
  if (remaining.length === 1) {
    const winner = remaining[0];
    winner.chips += s.pot;
    s.winners = [{ playerId: winner.playerId, amount: s.pot }];
    s.message = `${winner.name} wins $${s.pot}`;
    s.phase = "hand_over";
    return s;
  }

  // Build side pots if not already done
  if (s.sidePots.length === 0) {
    buildSidePots(s);
  }

  // Evaluate hands and distribute pots
  const winners: { playerId: string; amount: number; hand?: string }[] = [];
  
  // If no side pots, create one main pot
  const pots = s.sidePots.length > 0 ? s.sidePots : [{ amount: s.pot, eligiblePlayerIds: remaining.map((p) => p.playerId) }];

  for (const pot of pots) {
    const eligible = pot.eligiblePlayerIds
      .map((id) => s.players.find((p) => p.playerId === id))
      .filter((p): p is PokerPlayer => !!p && !p.folded);

    if (eligible.length === 0) continue;
    if (eligible.length === 1) {
      eligible[0].chips += pot.amount;
      const existing = winners.find((w) => w.playerId === eligible[0].playerId);
      if (existing) existing.amount += pot.amount;
      else winners.push({ playerId: eligible[0].playerId, amount: pot.amount });
      continue;
    }

    // Evaluate hands
    const evaluated = eligible.map((p) => ({
      player: p,
      score: evaluateHand([...p.holeCards, ...s.communityCards]),
    }));

    // Find best hand
    evaluated.sort((a, b) => compareHands(b.score, a.score));
    const bestScore = evaluated[0].score;

    // Find all players tied for best
    const tiedWinners = evaluated.filter((e) => compareHands(e.score, bestScore) === 0);

    const share = Math.floor(pot.amount / tiedWinners.length);
    const remainder = pot.amount - share * tiedWinners.length;

    for (let i = 0; i < tiedWinners.length; i++) {
      const won = share + (i === 0 ? remainder : 0);
      tiedWinners[i].player.chips += won;
      const existing = winners.find((w) => w.playerId === tiedWinners[i].player.playerId);
      if (existing) {
        existing.amount += won;
      } else {
        winners.push({
          playerId: tiedWinners[i].player.playerId,
          amount: won,
          hand: handRankName(tiedWinners[i].score.rank),
        });
      }
    }
  }

  s.winners = winners;
  s.message = winners.map((w) => {
    const p = s.players.find((pl) => pl.playerId === w.playerId);
    return `${p?.name} wins $${w.amount}${w.hand ? ` (${w.hand})` : ""}`;
  }).join(", ");
  s.phase = "hand_over";

  return s;
}

/* ── Hand evaluation ───────────────────────────────────── */

interface HandScore {
  rank: number;   // 0=high card, 1=pair, ..., 9=royal flush
  values: number[]; // tiebreaker values
}

const RANK_VALUES: Record<string, number> = {
  "2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "7": 7, "8": 8,
  "9": 9, "10": 10, "J": 11, "Q": 12, "K": 13, "A": 14,
};

function parsePokerCard(card: string): { rank: number; suit: string } {
  const suit = card[card.length - 1];
  const rankStr = card.slice(0, -1);
  return { rank: RANK_VALUES[rankStr] || 0, suit };
}

function combinations(arr: any[], k: number): any[][] {
  if (k === 0) return [[]];
  if (arr.length < k) return [];
  const [first, ...rest] = arr;
  const withFirst = combinations(rest, k - 1).map((c) => [first, ...c]);
  const withoutFirst = combinations(rest, k);
  return [...withFirst, ...withoutFirst];
}

function evaluate5Cards(cards: { rank: number; suit: string }[]): HandScore {
  const ranks = cards.map((c) => c.rank).sort((a, b) => b - a);
  const suits = cards.map((c) => c.suit);
  const isFlush = suits.every((s) => s === suits[0]);

  // Check straight
  let isStraight = false;
  let straightHigh = 0;

  // Normal straight
  if (ranks[0] - ranks[4] === 4 && new Set(ranks).size === 5) {
    isStraight = true;
    straightHigh = ranks[0];
  }
  // Ace-low straight (A-2-3-4-5)
  if (ranks[0] === 14 && ranks[1] === 5 && ranks[2] === 4 && ranks[3] === 3 && ranks[4] === 2) {
    isStraight = true;
    straightHigh = 5;
  }

  // Count rank frequencies
  const freq: Record<number, number> = {};
  for (const r of ranks) freq[r] = (freq[r] || 0) + 1;
  const counts = Object.entries(freq)
    .map(([r, c]) => ({ rank: parseInt(r), count: c }))
    .sort((a, b) => b.count - a.count || b.rank - a.rank);

  // Royal flush
  if (isFlush && isStraight && straightHigh === 14) {
    return { rank: 9, values: [14] };
  }
  // Straight flush
  if (isFlush && isStraight) {
    return { rank: 8, values: [straightHigh] };
  }
  // Four of a kind
  if (counts[0].count === 4) {
    return { rank: 7, values: [counts[0].rank, counts[1].rank] };
  }
  // Full house
  if (counts[0].count === 3 && counts[1].count === 2) {
    return { rank: 6, values: [counts[0].rank, counts[1].rank] };
  }
  // Flush
  if (isFlush) {
    return { rank: 5, values: ranks };
  }
  // Straight
  if (isStraight) {
    return { rank: 4, values: [straightHigh] };
  }
  // Three of a kind
  if (counts[0].count === 3) {
    const kickers = counts.filter((c) => c.count === 1).map((c) => c.rank).sort((a, b) => b - a);
    return { rank: 3, values: [counts[0].rank, ...kickers] };
  }
  // Two pair
  if (counts[0].count === 2 && counts[1].count === 2) {
    const pairs = [counts[0].rank, counts[1].rank].sort((a, b) => b - a);
    const kicker = counts[2].rank;
    return { rank: 2, values: [...pairs, kicker] };
  }
  // One pair
  if (counts[0].count === 2) {
    const kickers = counts.filter((c) => c.count === 1).map((c) => c.rank).sort((a, b) => b - a);
    return { rank: 1, values: [counts[0].rank, ...kickers] };
  }
  // High card
  return { rank: 0, values: ranks };
}

function evaluateHand(cards: string[]): HandScore {
  const parsed = cards.map(parsePokerCard);
  const combos = combinations(parsed, 5);
  let best: HandScore = { rank: -1, values: [] };

  for (const combo of combos) {
    const score = evaluate5Cards(combo);
    if (compareHands(score, best) > 0) {
      best = score;
    }
  }

  return best;
}

function compareHands(a: HandScore, b: HandScore): number {
  if (a.rank !== b.rank) return a.rank - b.rank;
  for (let i = 0; i < Math.max(a.values.length, b.values.length); i++) {
    const av = a.values[i] ?? 0;
    const bv = b.values[i] ?? 0;
    if (av !== bv) return av - bv;
  }
  return 0;
}

function handRankName(rank: number): string {
  const names = [
    "High Card", "Pair", "Two Pair", "Three of a Kind",
    "Straight", "Flush", "Full House", "Four of a Kind",
    "Straight Flush", "Royal Flush"
  ];
  return names[rank] || "Unknown";
}

/* ── Visibility filter ─────────────────────────────────── */

export function filterPokerStateForPlayer(state: PokerGameState, viewerPlayerId: string): PokerGameState {
  const s = structuredClone(state);
  for (const p of s.players) {
    if (p.playerId === viewerPlayerId) continue;
    // Hide hole cards unless showdown/hand_over
    if (s.phase !== "showdown" && s.phase !== "hand_over") {
      p.holeCards = p.holeCards.map(() => "HIDDEN");
    }
  }
  return s;
}

/* ── Next hand (continue game) ─────────────────────────── */

export function startNextHand(state: PokerGameState): PokerGameState {
  // Check if game is over (only 1 player with chips)
  const playersWithChips = state.players.filter((p) => p.chips > 0 && !p.eliminated);
  if (playersWithChips.length <= 1) {
    // Game over
    const s = structuredClone(state);
    s.phase = "hand_over";
    s.message = playersWithChips.length === 1
      ? `${playersWithChips[0].name} wins the game!`
      : "Game over!";
    return s;
  }

  return dealNewHand(state);
}

/* ── Card display helper ───────────────────────────────── */

export function parsePokerCardDisplay(card: string): { rank: string; suitSymbol: string; suitColor: "red" | "black" } {
  if (card === "HIDDEN") return { rank: "?", suitSymbol: "", suitColor: "black" };
  const suit = card[card.length - 1];
  const rank = card.slice(0, -1);
  const symbols: Record<string, string> = { S: "♠", C: "♣", D: "♦", H: "♥" };
  const colors: Record<string, "red" | "black"> = { S: "black", C: "black", D: "red", H: "red" };
  return { rank, suitSymbol: symbols[suit] || "", suitColor: colors[suit] || "black" };
}
