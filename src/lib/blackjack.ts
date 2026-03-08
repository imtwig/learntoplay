import { type Card, createDeck, handValue, isBlackjack, isBust } from "./cards";

export type PlayerAction = "hit" | "stand";
export type HandResult = "win" | "lose" | "push" | "blackjack" | "pending";

export interface BJHand {
  cards: Card[];
  bet: number;
  result: HandResult;
  stood: boolean;
  revealed: boolean; // whether hand has been revealed to all players
}

export interface BJPlayerState {
  playerId: string;
  name: string;
  netProfit: number;
  hands: BJHand[];
  activeHandIndex: number;
  done: boolean;
  currentBet: number;
  ready: boolean; // ready to start round
}

export interface BJGameState {
  deck: Card[];
  dealer: Card[];
  players: BJPlayerState[];
  activePlayerIndex: number;
  phase: "betting" | "dealing" | "player_turns" | "dealer_turn" | "results" | "reveal";
  roundNumber: number;
  revealedPlayerIds: string[]; // which players' hands have been revealed by host
}

export function initGameState(playerNames: { id: string; name: string }[]): BJGameState {
  return {
    deck: createDeck(6),
    dealer: [],
    players: playerNames.map((p) => ({
      playerId: p.id,
      name: p.name,
      netProfit: 0,
      hands: [],
      activeHandIndex: 0,
      done: false,
      currentBet: 0,
      ready: false,
    })),
    activePlayerIndex: 0,
    phase: "betting",
    roundNumber: 1,
    revealedPlayerIds: [],
  };
}

function draw(state: BJGameState, faceUp = true): Card {
  if (state.deck.length < 20) {
    state.deck = createDeck(6);
  }
  const card = state.deck.pop()!;
  card.faceUp = faceUp;
  return card;
}

/** Mark a player as ready with their bet */
export function setPlayerReady(state: BJGameState, playerId: string, bet: number): BJGameState {
  const s = structuredClone(state);
  const player = s.players.find((p) => p.playerId === playerId);
  if (!player) return s;
  player.currentBet = Math.max(bet, 0);
  player.ready = true;
  return s;
}

/** Unready a player */
export function setPlayerUnready(state: BJGameState, playerId: string): BJGameState {
  const s = structuredClone(state);
  const player = s.players.find((p) => p.playerId === playerId);
  if (!player) return s;
  player.ready = false;
  return s;
}

/** Check if all players are ready */
export function allPlayersReady(state: BJGameState): boolean {
  return state.players.every((p) => p.ready);
}

/** Start dealing — called when everyone is ready and someone presses start */
export function startDeal(state: BJGameState): BJGameState {
  const s = structuredClone(state);
  for (const p of s.players) {
    p.hands = [{ cards: [], bet: p.currentBet, result: "pending", stood: false, revealed: false }];
    p.activeHandIndex = 0;
    p.done = false;
  }
  s.phase = "dealing";
  return dealInitial(s);
}

/**
 * Deal cards clockwise. All player cards are face-up in the raw state
 * (owners see their own hand). filterStateForPlayer hides others' cards.
 * Dealer gets 1 up, 1 down.
 */
function dealInitial(state: BJGameState): BJGameState {
  const s = state;

  // Round 1: first card to each player clockwise (face-up in raw state)
  for (const p of s.players) {
    p.hands[0].cards.push(draw(s, true));
  }

  // Round 2: second card to each player clockwise (face-up in raw state)
  for (const p of s.players) {
    p.hands[0].cards.push(draw(s, true));
  }

  // Dealer gets 1 face-up, 1 face-down
  s.dealer = [draw(s, true), draw(s, false)];

  // Check for dealer blackjack
  const dealerFull = s.dealer.map((c) => ({ ...c, faceUp: true }));
  if (isBlackjack(dealerFull)) {
    s.dealer[1].faceUp = true;
    for (const p of s.players) {
      for (const h of p.hands) {
        h.revealed = true;
        h.result = isBlackjack(h.cards) ? "push" : "lose";
      }
      p.done = true;
    }
    s.phase = "results";
    return settleRound(s);
  }

  // Check for player blackjacks
  for (const p of s.players) {
    if (isBlackjack(p.hands[0].cards)) {
      p.hands[0].result = "blackjack";
      p.hands[0].revealed = true;
      p.done = true;
    }
  }

  s.phase = "player_turns";
  s.activePlayerIndex = s.players.findIndex((p) => !p.done);
  if (s.activePlayerIndex === -1) {
    return startDealerTurn(s);
  }

  return s;
}

// No longer needed — all cards are face-up in raw state, visibility controlled by filter

export function playerAction(state: BJGameState, playerId: string, action: PlayerAction): BJGameState {
  const s = structuredClone(state);
  if (s.phase !== "player_turns") return s;

  const player = s.players.find((p) => p.playerId === playerId);
  if (!player || player.done) return s;

  const hand = player.hands[player.activeHandIndex];
  if (!hand || hand.result !== "pending") return s;

  switch (action) {
    case "hit": { // Draw
      hand.cards.push(draw(s));
      if (isBust(hand.cards)) {
        hand.result = "lose";
        advanceHand(s, player);
      }
      break;
    }
    case "stand": { // Done
      hand.stood = true;
      advanceHand(s, player);
      break;
    }
  }

  return s;
}

function advanceHand(state: BJGameState, player: BJPlayerState) {
  const nextHand = player.hands.findIndex(
    (h, i) => i > player.activeHandIndex && h.result === "pending" && !h.stood
  );
  if (nextHand !== -1) {
    player.activeHandIndex = nextHand;
    return;
  }
  player.done = true;

  const nextPlayer = state.players.findIndex((p, i) => i > state.activePlayerIndex && !p.done);
  if (nextPlayer !== -1) {
    state.activePlayerIndex = nextPlayer;
    // Cards already face-up in raw state, filter handles visibility
  } else {
    // All players done — move to reveal phase instead of dealer turn
    state.phase = "reveal";
    state.revealedPlayerIds = [];
  }
}

/** Host reveals a specific player's hand */
export function revealPlayer(state: BJGameState, playerId: string): BJGameState {
  const s = structuredClone(state);
  if (s.phase !== "reveal") return s;
  if (!s.revealedPlayerIds.includes(playerId)) {
    s.revealedPlayerIds.push(playerId);
    // Reveal the player's cards
    const player = s.players.find((p) => p.playerId === playerId);
    if (player) {
      for (const h of player.hands) {
        h.cards = h.cards.map((c) => ({ ...c, faceUp: true }));
        h.revealed = true;
      }
    }
  }
  return s;
}

/** Host reveals all hands */
export function revealAll(state: BJGameState): BJGameState {
  const s = structuredClone(state);
  if (s.phase !== "reveal") return s;
  for (const p of s.players) {
    if (!s.revealedPlayerIds.includes(p.playerId)) {
      s.revealedPlayerIds.push(p.playerId);
    }
    for (const h of p.hands) {
      h.cards = h.cards.map((c) => ({ ...c, faceUp: true }));
      h.revealed = true;
    }
  }
  // Now do dealer turn
  return startDealerTurn(s);
}

function startDealerTurn(state: BJGameState): BJGameState {
  state.phase = "dealer_turn";
  state.dealer[1].faceUp = true;

  // Reveal all player cards
  for (const p of state.players) {
    for (const h of p.hands) {
      h.cards = h.cards.map((c) => ({ ...c, faceUp: true }));
      h.revealed = true;
    }
  }

  const anyPending = state.players.some((p) => p.hands.some((h) => h.result === "pending"));

  if (anyPending) {
    while (handValue(state.dealer) < 17) {
      state.dealer.push(draw(state));
    }
  }

  const dealerVal = handValue(state.dealer);
  const dealerBust = dealerVal > 21;

  for (const p of state.players) {
    for (const h of p.hands) {
      if (h.result !== "pending") continue;
      const pVal = handValue(h.cards);
      if (dealerBust) {
        h.result = "win";
      } else if (pVal > dealerVal) {
        h.result = "win";
      } else if (pVal < dealerVal) {
        h.result = "lose";
      } else {
        h.result = "push";
      }
    }
  }

  state.phase = "results";
  return settleRound(state);
}

function settleRound(state: BJGameState): BJGameState {
  for (const p of state.players) {
    for (const h of p.hands) {
      switch (h.result) {
        case "blackjack":
          p.netProfit += Math.floor(h.bet * 1.5);
          break;
        case "win":
          p.netProfit += h.bet;
          break;
        case "push":
          break;
        case "lose":
          p.netProfit -= h.bet;
          break;
      }
    }
  }
  return state;
}

export function newRound(state: BJGameState): BJGameState {
  const s = structuredClone(state);
  s.dealer = [];
  s.activePlayerIndex = 0;
  s.phase = "betting";
  s.roundNumber++;
  s.revealedPlayerIds = [];
  for (const p of s.players) {
    p.hands = [];
    p.activeHandIndex = 0;
    p.done = false;
    p.ready = false;
    // Keep currentBet from previous round so it persists
  }
  return s;
}

export function getAvailableActions(state: BJGameState, playerId: string): PlayerAction[] {
  if (state.phase !== "player_turns") return [];
  const player = state.players.find((p) => p.playerId === playerId);
  if (!player || player.done) return [];
  const hand = player.hands[player.activeHandIndex];
  if (!hand || hand.result !== "pending") return [];

  return ["hit", "stand"];
}

/**
 * Filter game state for a specific viewer — hides other players' hands completely
 * unless they've been revealed by the host.
 */
export function filterStateForPlayer(state: BJGameState, viewerPlayerId: string): BJGameState {
  const s = structuredClone(state);
  for (const p of s.players) {
    if (p.playerId === viewerPlayerId) continue;
    // In reveal/results/dealer_turn phase, show revealed players
    if ((s.phase === "reveal" || s.phase === "results" || s.phase === "dealer_turn") && 
        s.revealedPlayerIds.includes(p.playerId)) {
      continue;
    }
    // Hide ALL of other players' cards — they only see card backs
    for (const h of p.hands) {
      h.cards = h.cards.map(() => ({ rank: "A" as any, suit: "spades" as any, faceUp: false }));
    }
  }
  return s;
}
