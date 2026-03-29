/* ── Asshole Dai Di — Game Logic ───────────────────────── */

/* ── Card Ranking (Dai Di) ─────────────────────────────── */
// Rank order: 3 < 4 < … < K < A < 2
// Suit order: D < C < H < S

const RANK_ORDER = ["3","4","5","6","7","8","9","10","J","Q","K","A","2"] as const;
const SUIT_ORDER = ["D","C","H","S"] as const;

export type ADDSuit = typeof SUIT_ORDER[number];
export type ADDRank = typeof RANK_ORDER[number];

export function cardRankValue(r: string): number {
  return RANK_ORDER.indexOf(r as any);
}

export function cardSuitValue(s: string): number {
  return SUIT_ORDER.indexOf(s as any);
}

/** Compare two individual cards. Higher = better. */
export function compareCards(a: string, b: string): number {
  const ra = cardRankValue(parseCard(a).rank);
  const rb = cardRankValue(parseCard(b).rank);
  if (ra !== rb) return ra - rb;
  return cardSuitValue(parseCard(a).suit) - cardSuitValue(parseCard(b).suit);
}

export function parseCard(card: string): { rank: string; suit: string } {
  const suit = card.slice(-1);
  const rank = card.slice(0, -1);
  return { rank, suit };
}

export function cardDisplay(card: string): { rank: string; suitSymbol: string; suitColor: "red" | "black" } {
  const { rank, suit } = parseCard(card);
  const symbols: Record<string, string> = { D: "♦", C: "♣", H: "♥", S: "♠" };
  const colors: Record<string, "red" | "black"> = { D: "red", C: "black", H: "red", S: "black" };
  return { rank, suitSymbol: symbols[suit] || "?", suitColor: colors[suit] || "black" };
}

/* ── Types ─────────────────────────────────────────────── */

export type ADDPhase =
  | "waiting"        // lobby, waiting for enough players
  | "playing"        // cards are being played
  | "round_end"      // round ended, showing scores
  | "swap_give"      // president/VP choosing cards to return
  | "swap_summary"   // showing swap results
  | "game_over";     // session ended

export type ADDRankTitle = "President" | "Vice President" | "Citizen" | "Vice Asshole" | "Asshole" | null;

export type CombinationType = "single" | "pair" | "triple" | "straight" | "flush" | "full_house" | "four_kind" | "straight_flush";

export interface ADDPlayer {
  playerId: string;
  name: string;
  hand: string[];         // only sent to owner
  cardCount: number;      // visible to all
  rank: ADDRankTitle;
  finishOrder: number;    // 0 = not yet finished
  passed: boolean;
  cumulativeScore: number;
  roundScore: number;
  swapCardsToGive: string[];   // cards selected to return during swap
  swapCardsReceived: string[]; // cards received during swap
}

export interface PlayedCombination {
  cards: string[];
  type: CombinationType;
  tier: number;            // for 5-card combos
  playerId: string;
  playerName: string;
}

export interface ADDHouseRules {
  // Future house rules can go here
}

export const DEFAULT_ADD_HOUSE_RULES: ADDHouseRules = {
  // No house rules by default
};

export interface ADDGameState {
  deck: string[];
  players: ADDPlayer[];
  phase: ADDPhase;
  roundNumber: number;
  currentPlayerIndex: number;
  currentCombination: PlayedCombination | null;  // what's on the table
  consecutivePasses: number;
  lastPlayerId: string | null;       // who last played cards
  finishCounter: number;             // how many have finished this round
  turnTimerSeconds: number;
  houseRules: ADDHouseRules;
  message: string | null;
  discardPile: string[][];           // history of plays this round-of-play
  roundLeaderId: string | null;      // who leads the current round-of-play
  swapPending: { fromId: string; toId: string; count: number; autoCards: string[]; returnedCards: string[] }[];
}

/* ── Deck ──────────────────────────────────────────────── */

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

/* ── Sort hand ─────────────────────────────────────────── */

export function sortHand(cards: string[]): string[] {
  return [...cards].sort(compareCards);
}

/* ── Combination Detection ─────────────────────────────── */

function isStraight(ranks: number[]): boolean {
  const sorted = [...ranks].sort((a, b) => a - b);
  // Normal consecutive
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] !== sorted[i - 1] + 1) return false;
  }
  return true;
}

function isFlush(suits: string[]): boolean {
  return suits.every((s) => s === suits[0]);
}

export function detectCombination(cards: string[]): { type: CombinationType; tier: number; highCard: string } | null {
  if (cards.length === 0) return null;

  const parsed = cards.map(parseCard);
  const ranks = parsed.map((c) => cardRankValue(c.rank));
  const suits = parsed.map((c) => c.suit);

  if (cards.length === 1) {
    return { type: "single", tier: 0, highCard: cards[0] };
  }

  if (cards.length === 2) {
    if (ranks[0] === ranks[1]) {
      const high = compareCards(cards[0], cards[1]) >= 0 ? cards[0] : cards[1];
      return { type: "pair", tier: 0, highCard: high };
    }
    return null;
  }

  if (cards.length === 3) {
    if (ranks[0] === ranks[1] && ranks[1] === ranks[2]) {
      return { type: "triple", tier: 0, highCard: sortHand(cards)[2] };
    }
    return null;
  }

  if (cards.length === 5) {
    const sorted = sortHand(cards);
    const sortedParsed = sorted.map(parseCard);
    const sortedRanks = sortedParsed.map((c) => cardRankValue(c.rank));
    const sortedSuits = sortedParsed.map((c) => c.suit);

    const straight = isStraight(sortedRanks);
    const flush = isFlush(sortedSuits);

    // Straight flush (tier 5)
    if (straight && flush) {
      return { type: "straight_flush", tier: 5, highCard: sorted[4] };
    }

    // Four of a kind + 1 (tier 4)
    const rankCounts: Record<number, string[]> = {};
    for (const card of sorted) {
      const r = cardRankValue(parseCard(card).rank);
      if (!rankCounts[r]) rankCounts[r] = [];
      rankCounts[r].push(card);
    }
    for (const [r, group] of Object.entries(rankCounts)) {
      if (group.length === 4) {
        return { type: "four_kind", tier: 4, highCard: sortHand(group)[3] };
      }
    }

    // Full house (tier 3)
    const counts = Object.values(rankCounts).map((g) => g.length).sort();
    if (counts.length === 2 && counts[0] === 2 && counts[1] === 3) {
      const tripleRank = Object.entries(rankCounts).find(([, g]) => g.length === 3)!;
      return { type: "full_house", tier: 3, highCard: sortHand(tripleRank[1])[2] };
    }

    // Flush (tier 2)
    if (flush) {
      return { type: "flush", tier: 2, highCard: sorted[4] };
    }

    // Straight (tier 1)
    if (straight) {
      return { type: "straight", tier: 1, highCard: sorted[4] };
    }

    return null;
  }

  return null;
}

/* ── Combination Comparison ────────────────────────────── */

/** Returns true if `play` beats `current` */
export function beats(play: string[], current: PlayedCombination): boolean {
  const playComb = detectCombination(play);
  if (!playComb) return false;

  // Must be same length
  if (play.length !== current.cards.length) {
    // Exception: 5-card combos can beat singles/pairs of 2s
    if (play.length === 5 && current.type === "single") {
      const currentRank = cardRankValue(parseCard(current.cards[0]).rank);
      if (currentRank === cardRankValue("2")) {
        // Four-of-a-kind or straight flush beats single 2
        if (playComb.tier >= 4) return true;
      }
    }
    if (play.length === 5 && current.type === "pair") {
      const currentRank = cardRankValue(parseCard(current.cards[0]).rank);
      if (currentRank === cardRankValue("2")) {
        // Straight flush beats pair of 2s
        if (playComb.tier >= 5) return true;
      }
    }
    if (play.length === 5 && current.type === "triple") {
      const currentRank = cardRankValue(parseCard(current.cards[0]).rank);
      if (currentRank === cardRankValue("2")) {
        // Straight flush beats triple 2s
        if (playComb.tier >= 5) return true;
      }
    }
    return false;
  }

  // For 5-card combos, higher tier always wins
  if (play.length === 5) {
    if (playComb.tier > (detectCombination(current.cards)?.tier ?? 0)) return true;
    if (playComb.tier < (detectCombination(current.cards)?.tier ?? 0)) return false;
  }

  // Same type/length: compare high cards
  return compareCards(playComb.highCard, detectCombination(current.cards)!.highCard) > 0;
}

/* ── Rank Titles ───────────────────────────────────────── */

function getRankTitles(playerCount: number): ADDRankTitle[] {
  switch (playerCount) {
    case 3: return ["President", "Citizen", "Asshole"];
    case 4: return ["President", "Vice President", "Vice Asshole", "Asshole"];
    case 5: return ["President", "Vice President", "Citizen", "Vice Asshole", "Asshole"];
    case 6: return ["President", "Vice President", "Citizen", "Citizen", "Vice Asshole", "Asshole"];
    case 7: return ["President", "Vice President", "Citizen", "Citizen", "Citizen", "Vice Asshole", "Asshole"];
    default: return Array(playerCount).fill("Citizen");
  }
}

/* ── Init Game ─────────────────────────────────────────── */

export function initADDGame(
  playerNames: { id: string; name: string }[],
  turnTimer: number = 30,
  houseRules: ADDHouseRules = DEFAULT_ADD_HOUSE_RULES
): ADDGameState {
  return {
    deck: [],
    players: playerNames.map((p) => ({
      playerId: p.id,
      name: p.name,
      hand: [],
      cardCount: 0,
      rank: null,
      finishOrder: 0,
      passed: false,
      cumulativeScore: 0,
      roundScore: 0,
      swapCardsToGive: [],
      swapCardsReceived: [],
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
    message: null,
    discardPile: [],
    roundLeaderId: null,
    swapPending: [],
  };
}

/* ── Deal ──────────────────────────────────────────────── */

export function dealRound(state: ADDGameState): ADDGameState {
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
  s.swapPending = [];

  const n = s.players.length;
  const cardsEach = Math.floor(52 / n);
  const remainder = 52 % n;

  // Reset player round state
  for (const p of s.players) {
    p.hand = [];
    p.cardCount = 0;
    p.finishOrder = 0;
    p.passed = false;
    p.roundScore = 0;
    p.swapCardsToGive = [];
    p.swapCardsReceived = [];
  }

  // Deal cards
  for (const p of s.players) {
    for (let i = 0; i < cardsEach; i++) {
      p.hand.push(s.deck.pop()!);
    }
  }

  // Distribute remainder cards
  if (remainder > 0) {
    if (s.roundNumber === 1) {
      // Round 1: extra cards go to whoever has 3♦, then next players
      // Simple: give extra cards to lowest-index players
      for (let i = 0; i < remainder; i++) {
        s.players[i % n].hand.push(s.deck.pop()!);
      }
    } else {
      // Subsequent rounds: extra cards go to lowest-ranked players (Asshole first)
      const byFinishReverse = [...s.players]
        .map((p, i) => ({ p, i, rank: p.rank }))
        .sort((a, b) => {
          // Asshole last, so sort by rank title priority (worst first)
          const rankPriority: Record<string, number> = {
            "Asshole": 0, "Vice Asshole": 1, "Citizen": 2, "Vice President": 3, "President": 4
          };
          return (rankPriority[a.rank || "Citizen"] || 2) - (rankPriority[b.rank || "Citizen"] || 2);
        });
      for (let i = 0; i < remainder; i++) {
        byFinishReverse[i].p.hand.push(s.deck.pop()!);
      }
    }
  }

  // Sort hands initially so players start organized
  for (const p of s.players) {
    p.hand = sortHand(p.hand);
    p.cardCount = p.hand.length;
  }

  // Determine first player - whoever has 3♦
  const idx = s.players.findIndex((p) => p.hand.includes("3D"));
  s.currentPlayerIndex = idx >= 0 ? idx : 0;

  s.roundLeaderId = s.players[s.currentPlayerIndex].playerId;
  s.phase = "playing";

  return s;
}

/* ── Play Cards ────────────────────────────────────────── */

export function playCards(state: ADDGameState, playerId: string, cardIndices: number[]): ADDGameState {
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

  // Round 1, first play must include 3♦
  if (s.roundNumber === 1 && s.discardPile.length === 0 && !s.currentCombination && !s.lastPlayerId) {
    if (!cards.includes("3D")) return s;
  }

  // If there's a current combination, must beat it
  if (s.currentCombination) {
    if (!beats(cards, s.currentCombination)) return s;
  }

  // Play the cards
  // Remove cards from hand (by value, in reverse index order to maintain indices)
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

  // Check if player has shed all cards
  if (player.hand.length === 0) {
    s.finishCounter++;
    player.finishOrder = s.finishCounter;

    // Check if round is over
    const remaining = s.players.filter((p) => p.finishOrder === 0);
    if (remaining.length <= 1) {
      // Last player gets assigned
      if (remaining.length === 1) {
        s.finishCounter++;
        remaining[0].finishOrder = s.finishCounter;
      }
      return endRound(s);
    }

    // Player finished - clear the table so next player can play any cards
    s.currentCombination = null;
    s.discardPile = [];
    s.consecutivePasses = 0;

    // Reset all passes for remaining players
    for (const p of s.players) {
      if (p.finishOrder === 0) p.passed = false;
    }

    // Move to next active player and they lead
    s.currentPlayerIndex = nextActivePlayer(s, pIdx);
    s.roundLeaderId = s.players[s.currentPlayerIndex].playerId;
    // Keep lastPlayerId set so round 1 3♦ rule doesn't re-trigger

    return s;
  }

  // Move to next active player
  s.currentPlayerIndex = nextActivePlayer(s, pIdx);

  // If next player is the one who played last (everyone else passed/finished), they lead
  if (s.players[s.currentPlayerIndex].playerId === s.lastPlayerId) {
    s.currentCombination = null;
    s.discardPile = [];
    s.roundLeaderId = s.players[s.currentPlayerIndex].playerId;
  }

  return s;
}

/* ── Pass ──────────────────────────────────────────────── */

export function passPlay(state: ADDGameState, playerId: string): ADDGameState {
  const s = structuredClone(state);
  if (s.phase !== "playing") return s;

  const pIdx = s.players.findIndex((p) => p.playerId === playerId);
  if (pIdx === -1 || pIdx !== s.currentPlayerIndex) return s;

  const player = s.players[pIdx];
  if (player.finishOrder > 0) return s;

  // Can't pass if you're the round leader (no combination on table)
  if (!s.currentCombination) return s;

  player.passed = true;
  s.consecutivePasses++;

  // Check if all other active players have passed
  const activePlayers = s.players.filter((p) => p.finishOrder === 0 && !p.passed);

  if (activePlayers.length <= 1) {
    // The last player who played wins this round of play
    // Clear the table, they lead next
    const leaderId = s.lastPlayerId;
    s.currentCombination = null;
    s.discardPile = [];
    s.consecutivePasses = 0;

    // Reset passes
    for (const p of s.players) {
      if (p.finishOrder === 0) p.passed = false;
    }

    // Set the winner of the round of play as current player
    if (leaderId) {
      const leaderIdx = s.players.findIndex((p) => p.playerId === leaderId);
      if (leaderIdx >= 0 && s.players[leaderIdx].finishOrder === 0) {
        s.currentPlayerIndex = leaderIdx;
        s.roundLeaderId = leaderId;
      } else {
        // Leader already finished, next active player leads
        s.currentPlayerIndex = nextActivePlayer(s, leaderIdx >= 0 ? leaderIdx : pIdx);
        s.roundLeaderId = s.players[s.currentPlayerIndex].playerId;
      }
    }
    return s;
  }

  // Move to next active player
  s.currentPlayerIndex = nextActivePlayer(s, pIdx);
  return s;
}

/* ── Auto-play (timer expired, must play) ──────────────── */

export function autoPlay(state: ADDGameState, playerId: string): ADDGameState {
  const s = structuredClone(state);
  const pIdx = s.players.findIndex((p) => p.playerId === playerId);
  if (pIdx === -1) return s;

  const player = s.players[pIdx];

  if (s.currentCombination) {
    // Auto-pass
    return passPlay(s, playerId);
  } else {
    // Must play — play lowest single card
    if (s.roundNumber === 1 && s.discardPile.length === 0 && !s.lastPlayerId) {
      // Must include 3♦
      const idx3d = player.hand.indexOf("3D");
      if (idx3d >= 0) {
        return playCards(s, playerId, [idx3d]);
      }
    }
    return playCards(s, playerId, [0]); // lowest card
  }
}

/* ── Helpers ───────────────────────────────────────────── */

function nextActivePlayer(state: ADDGameState, fromIdx: number): number {
  const n = state.players.length;
  for (let i = 1; i <= n; i++) {
    const idx = (fromIdx + i) % n;
    const p = state.players[idx];
    if (p.finishOrder === 0 && !p.passed) return idx;
  }
  // Fallback: find any unfinished player
  for (let i = 1; i <= n; i++) {
    const idx = (fromIdx + i) % n;
    if (state.players[idx].finishOrder === 0) return idx;
  }
  return fromIdx;
}

/* ── End Round ─────────────────────────────────────────── */

function endRound(state: ADDGameState): ADDGameState {
  const s = state;
  s.phase = "round_end";

  // Assign rank titles
  const titles = getRankTitles(s.players.length);
  const byFinish = [...s.players].sort((a, b) => a.finishOrder - b.finishOrder);
  for (let i = 0; i < byFinish.length; i++) {
    byFinish[i].rank = titles[i];
  }

  // Scoring: Placement-based points
  // 1st = +2, 2nd = +1, last = -2, second-to-last = -1, middle = 0
  const n = s.players.length;
  const byFinishOrder = [...s.players].sort((a, b) => a.finishOrder - b.finishOrder);

  for (let i = 0; i < byFinishOrder.length; i++) {
    const player = byFinishOrder[i];
    let points = 0;

    if (i === 0) {
      // 1st place
      points = 2;
    } else if (i === 1) {
      // 2nd place
      points = 1;
    } else if (i === n - 1) {
      // Last place
      points = -2;
    } else if (i === n - 2) {
      // Second to last
      points = -1;
    } else {
      // Middle positions
      points = 0;
    }

    player.roundScore = points;
    player.cumulativeScore += points;
  }

  const winner = byFinishOrder[0];
  s.message = `${winner?.name || "Winner"} wins! Scores updated.`;

  return s;
}

/* ── Start Next Round (with swap) ──────────────────────── */

export function startSwapPhase(state: ADDGameState): ADDGameState {
  const s = structuredClone(state);
  if (s.roundNumber < 1) return dealRound(s);

  // Deal new cards first
  const dealt = dealRound(s);

  // Setup and execute swaps automatically
  const n = dealt.players.length;
  const president = dealt.players.find((p) => p.rank === "President");
  const asshole = dealt.players.find((p) => p.rank === "Asshole");
  const vp = dealt.players.find((p) => p.rank === "Vice President");
  const va = dealt.players.find((p) => p.rank === "Vice Asshole");

  dealt.swapPending = [];

  // President <-> Asshole swap
  if (president && asshole) {
    const swapCount = n === 3 ? 1 : 2;

    // Take asshole's best cards
    const assholeSorted = sortHand(asshole.hand);
    const assholeBest = assholeSorted.slice(-swapCount);

    // Take president's worst cards
    const presidentSorted = sortHand(president.hand);
    const presidentWorst = presidentSorted.slice(0, swapCount);

    // Execute swap
    // Remove cards from each player
    for (const card of assholeBest) {
      const idx = asshole.hand.indexOf(card);
      if (idx >= 0) asshole.hand.splice(idx, 1);
    }
    for (const card of presidentWorst) {
      const idx = president.hand.indexOf(card);
      if (idx >= 0) president.hand.splice(idx, 1);
    }

    // Give cards to opposite player
    president.hand.push(...assholeBest);
    asshole.hand.push(...presidentWorst);

    // Sort hands after swap so players can start fresh
    president.hand = sortHand(president.hand);
    asshole.hand = sortHand(asshole.hand);
    president.cardCount = president.hand.length;
    asshole.cardCount = asshole.hand.length;

    // Record for display
    president.swapCardsReceived = assholeBest;
    president.swapCardsToGive = presidentWorst;
    asshole.swapCardsReceived = presidentWorst;
    asshole.swapCardsToGive = assholeBest;

    dealt.swapPending.push({
      fromId: asshole.playerId,
      toId: president.playerId,
      count: swapCount,
      autoCards: assholeBest,
      returnedCards: presidentWorst,
    });
  }

  // VP <-> Vice Asshole swap
  if (vp && va && n >= 4) {
    const vaSorted = sortHand(va.hand);
    const vaBest = vaSorted.slice(-1);

    const vpSorted = sortHand(vp.hand);
    const vpWorst = vpSorted.slice(0, 1);

    // Execute swap
    for (const card of vaBest) {
      const idx = va.hand.indexOf(card);
      if (idx >= 0) va.hand.splice(idx, 1);
    }
    for (const card of vpWorst) {
      const idx = vp.hand.indexOf(card);
      if (idx >= 0) vp.hand.splice(idx, 1);
    }

    vp.hand.push(...vaBest);
    va.hand.push(...vpWorst);

    // Sort hands after swap so players can start fresh
    vp.hand = sortHand(vp.hand);
    va.hand = sortHand(va.hand);
    vp.cardCount = vp.hand.length;
    va.cardCount = va.hand.length;

    vp.swapCardsReceived = vaBest;
    vp.swapCardsToGive = vpWorst;
    va.swapCardsReceived = vpWorst;
    va.swapCardsToGive = vaBest;

    dealt.swapPending.push({
      fromId: va.playerId,
      toId: vp.playerId,
      count: 1,
      autoCards: vaBest,
      returnedCards: vpWorst,
    });
  }

  dealt.phase = "swap_summary";
  dealt.message = "Card swap complete!";

  return dealt;
}

/* ── Submit Swap Return Cards ──────────────────────────── */

export function submitSwapReturn(state: ADDGameState, playerId: string, cardIndices: number[]): ADDGameState {
  const s = structuredClone(state);
  if (s.phase !== "swap_give") return s;

  const swap = s.swapPending.find((sw) => sw.toId === playerId && sw.returnedCards.length === 0);
  if (!swap) return s;

  const player = s.players.find((p) => p.playerId === playerId);
  if (!player) return s;

  if (cardIndices.length !== swap.count) return s;

  const returnCards = cardIndices.map((i) => player.hand[i]).filter(Boolean);

  // Validate: returned cards must be lower rank than lowest card received
  const lowestReceived = sortHand(swap.autoCards)[0];
  for (const rc of returnCards) {
    if (compareCards(rc, lowestReceived) >= 0) return s; // Card too high
  }

  swap.returnedCards = returnCards;

  // Execute the swap
  const fromPlayer = s.players.find((p) => p.playerId === swap.fromId)!;
  const toPlayer = player;

  // Remove auto cards from asshole/VA and give to president/VP
  for (const card of swap.autoCards) {
    const idx = fromPlayer.hand.indexOf(card);
    if (idx >= 0) fromPlayer.hand.splice(idx, 1);
    toPlayer.hand.push(card);
  }

  // Remove return cards from president/VP and give to asshole/VA
  for (const card of returnCards) {
    const idx = toPlayer.hand.indexOf(card);
    if (idx >= 0) toPlayer.hand.splice(idx, 1);
    fromPlayer.hand.push(card);
  }

  // Update counts (no sorting - let players arrange their own cards)
  fromPlayer.cardCount = fromPlayer.hand.length;
  toPlayer.cardCount = toPlayer.hand.length;

  // Record received cards for display
  fromPlayer.swapCardsReceived = returnCards;
  toPlayer.swapCardsReceived = swap.autoCards;
  fromPlayer.swapCardsToGive = swap.autoCards;
  toPlayer.swapCardsToGive = returnCards;

  // Check if all swaps are complete
  const allDone = s.swapPending.every((sw) => sw.returnedCards.length > 0);
  if (allDone) {
    s.phase = "swap_summary";
    s.message = "Card swap complete!";
  }

  return s;
}

/* ── Finalize Swap and Start Playing ───────────────────── */

export function finishSwapAndPlay(state: ADDGameState): ADDGameState {
  const s = structuredClone(state);
  s.phase = "playing";
  s.currentCombination = null;
  s.consecutivePasses = 0;
  s.lastPlayerId = null;
  s.discardPile = [];
  s.swapPending = [];
  s.message = null;
  s.finishCounter = 0;

  // Reset per-round state
  for (const p of s.players) {
    p.finishOrder = 0;
    p.passed = false;
    p.roundScore = 0;
    p.swapCardsToGive = [];
    p.swapCardsReceived = [];
  }

  // Player with 3♦ leads
  const idx = s.players.findIndex((p) => p.hand.includes("3D"));
  s.currentPlayerIndex = idx >= 0 ? idx : 0;
  s.roundLeaderId = s.players[s.currentPlayerIndex].playerId;

  return s;
}

/* ── Filter State for Player ───────────────────────────── */

export function filterADDStateForPlayer(state: ADDGameState, playerId: string): ADDGameState {
  const s = structuredClone(state);
  for (const p of s.players) {
    if (p.playerId !== playerId) {
      p.hand = []; // Hide other players' hands
      p.swapCardsToGive = [];
      p.swapCardsReceived = [];
    }
  }
  // Hide swap auto cards unless it involves this player
  s.swapPending = s.swapPending.map((sw) => ({
    ...sw,
    autoCards: sw.fromId === playerId || sw.toId === playerId ? sw.autoCards : [],
    returnedCards: sw.fromId === playerId || sw.toId === playerId ? sw.returnedCards : [],
  }));
  return s;
}

/* ── Get Valid Plays ───────────────────────────────────── */

export function getValidSinglePlays(state: ADDGameState, playerId: string): number[][] {
  const player = state.players.find((p) => p.playerId === playerId);
  if (!player) return [];

  const validPlays: number[][] = [];
  const hand = player.hand;

  // Generate all possible combinations
  // Singles
  for (let i = 0; i < hand.length; i++) {
    validPlays.push([i]);
  }

  // Pairs
  for (let i = 0; i < hand.length; i++) {
    for (let j = i + 1; j < hand.length; j++) {
      if (parseCard(hand[i]).rank === parseCard(hand[j]).rank) {
        validPlays.push([i, j]);
      }
    }
  }

  // Triples
  for (let i = 0; i < hand.length; i++) {
    for (let j = i + 1; j < hand.length; j++) {
      for (let k = j + 1; k < hand.length; k++) {
        const ri = parseCard(hand[i]).rank;
        const rj = parseCard(hand[j]).rank;
        const rk = parseCard(hand[k]).rank;
        if (ri === rj && rj === rk) {
          validPlays.push([i, j, k]);
        }
      }
    }
  }

  // 5-card combinations (more complex - we'll just check if selected cards form a valid combo)
  // This is for UI hints; actual validation happens in playCards

  return validPlays.filter((indices) => {
    const cards = indices.map((i) => hand[i]);
    const combo = detectCombination(cards);
    if (!combo) return false;
    if (state.currentCombination) {
      return beats(cards, state.currentCombination);
    }
    // No current combination, any valid combo works
    // But round 1 first play must include 3D
    if (state.roundNumber === 1 && state.discardPile.length === 0 && !state.lastPlayerId) {
      return cards.includes("3D");
    }
    return true;
  });
}

/* ── Rematch ───────────────────────────────────────────── */

export function rematchADDGame(state: ADDGameState): ADDGameState {
  const s = structuredClone(state);
  s.roundNumber = 0;
  s.phase = "waiting";
  for (const p of s.players) {
    p.hand = [];
    p.cardCount = 0;
    p.rank = null;
    p.finishOrder = 0;
    p.passed = false;
    p.cumulativeScore = 0;
    p.roundScore = 0;
    p.swapCardsToGive = [];
    p.swapCardsReceived = [];
  }
  s.currentCombination = null;
  s.consecutivePasses = 0;
  s.lastPlayerId = null;
  s.finishCounter = 0;
  s.message = null;
  s.discardPile = [];
  s.roundLeaderId = null;
  s.swapPending = [];
  return s;
}
