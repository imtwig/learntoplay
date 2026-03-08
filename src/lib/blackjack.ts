import { type Card, createDeck, handValue, isBlackjack, isBust } from "./cards";

export type PlayerAction = "hit" | "stand" | "double" | "split";
export type HandResult = "win" | "lose" | "push" | "blackjack" | "pending";

export interface BJHand {
  cards: Card[];
  bet: number;
  result: HandResult;
  doubled: boolean;
  stood: boolean;
}

export interface BJPlayerState {
  playerId: string;
  name: string;
  netProfit: number; // cumulative profit/loss
  hands: BJHand[];
  activeHandIndex: number;
  done: boolean;
  currentBet: number; // what they chose to bet this round
}

export interface BJGameState {
  deck: Card[];
  dealer: Card[];
  players: BJPlayerState[];
  activePlayerIndex: number;
  phase: "betting" | "dealing" | "player_turns" | "dealer_turn" | "results";
  roundNumber: number;
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
    })),
    activePlayerIndex: 0,
    phase: "betting",
    roundNumber: 1,
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

/** Each player sets their own bet */
export function placeBets(state: BJGameState, bets: Record<string, number>): BJGameState {
  const s = structuredClone(state);
  for (const p of s.players) {
    const bet = Math.max(bets[p.playerId] ?? 0, 0);
    p.currentBet = bet;
    p.hands = [{ cards: [], bet, result: "pending", doubled: false, stood: false }];
    p.activeHandIndex = 0;
    p.done = false;
  }
  s.phase = "dealing";
  return dealInitial(s);
}

/**
 * Deal cards clockwise: first card face-up to each player, then second card face-down.
 * Dealer also gets 1 up, 1 down.
 */
function dealInitial(state: BJGameState): BJGameState {
  const s = state;

  // Round 1: first card face-up to each player clockwise
  for (const p of s.players) {
    p.hands[0].cards.push(draw(s, true));
  }

  // Round 2: second card face-down to each player clockwise
  for (const p of s.players) {
    p.hands[0].cards.push(draw(s, false));
  }

  // Dealer gets 1 face-up, 1 face-down
  s.dealer = [draw(s, true), draw(s, false)];

  // Check for dealer blackjack
  const dealerFull = s.dealer.map((c) => ({ ...c, faceUp: true }));
  if (isBlackjack(dealerFull)) {
    s.dealer[1].faceUp = true;
    for (const p of s.players) {
      // Reveal player cards for results
      for (const h of p.hands) {
        h.cards = h.cards.map((c) => ({ ...c, faceUp: true }));
        h.result = isBlackjack(h.cards) ? "push" : "lose";
      }
      p.done = true;
    }
    s.phase = "results";
    return settleRound(s);
  }

  // Check for player blackjacks (need to check with both cards visible)
  for (const p of s.players) {
    const fullHand = p.hands[0].cards.map((c) => ({ ...c, faceUp: true }));
    if (isBlackjack(fullHand)) {
      p.hands[0].cards = fullHand; // reveal both cards
      p.hands[0].result = "blackjack";
      p.done = true;
    }
  }

  s.phase = "player_turns";
  s.activePlayerIndex = s.players.findIndex((p) => !p.done);
  if (s.activePlayerIndex === -1) {
    return startDealerTurn(s);
  }

  // Reveal the active player's own hand (face-down card) so they can play
  revealActivePlayerHand(s);

  return s;
}

/** Reveal the current active player's face-down cards so they can see their hand */
function revealActivePlayerHand(state: BJGameState) {
  const player = state.players[state.activePlayerIndex];
  if (!player) return;
  const hand = player.hands[player.activeHandIndex];
  if (hand) {
    hand.cards = hand.cards.map((c) => ({ ...c, faceUp: true }));
  }
}

export function playerAction(state: BJGameState, playerId: string, action: PlayerAction): BJGameState {
  const s = structuredClone(state);
  if (s.phase !== "player_turns") return s;

  const player = s.players.find((p) => p.playerId === playerId);
  if (!player || player.done) return s;

  const hand = player.hands[player.activeHandIndex];
  if (!hand || hand.result !== "pending") return s;

  switch (action) {
    case "hit": {
      hand.cards.push(draw(s));
      if (isBust(hand.cards)) {
        hand.result = "lose";
        advanceHand(s, player);
      }
      break;
    }
    case "stand": {
      hand.stood = true;
      advanceHand(s, player);
      break;
    }
    case "double": {
      if (hand.cards.length === 2) {
        hand.bet *= 2;
        hand.doubled = true;
        hand.cards.push(draw(s));
        if (isBust(hand.cards)) {
          hand.result = "lose";
        }
        hand.stood = true;
        advanceHand(s, player);
      }
      break;
    }
    case "split": {
      if (hand.cards.length === 2 && hand.cards[0].rank === hand.cards[1].rank) {
        const secondCard = hand.cards.pop()!;
        hand.cards.push(draw(s));
        player.hands.splice(player.activeHandIndex + 1, 0, {
          cards: [secondCard, draw(s)],
          bet: hand.bet,
          result: "pending",
          doubled: false,
          stood: false,
        });
      }
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
    // Reveal next player's hand
    revealActivePlayerHand(state);
  } else {
    startDealerTurn(state);
  }
}

function startDealerTurn(state: BJGameState): BJGameState {
  state.phase = "dealer_turn";
  state.dealer[1].faceUp = true;

  // Reveal all remaining face-down player cards
  for (const p of state.players) {
    for (const h of p.hands) {
      h.cards = h.cards.map((c) => ({ ...c, faceUp: true }));
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
          p.netProfit += Math.floor(h.bet * 1.5); // 3:2 payout (profit only)
          break;
        case "win":
          p.netProfit += h.bet;
          break;
        case "push":
          // no change
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
  for (const p of s.players) {
    p.hands = [];
    p.activeHandIndex = 0;
    p.done = false;
    p.currentBet = 0;
  }
  return s;
}

export function getAvailableActions(state: BJGameState, playerId: string): PlayerAction[] {
  if (state.phase !== "player_turns") return [];
  const player = state.players.find((p) => p.playerId === playerId);
  if (!player || player.done) return [];
  const hand = player.hands[player.activeHandIndex];
  if (!hand || hand.result !== "pending") return [];

  const actions: PlayerAction[] = ["hit", "stand"];

  if (hand.cards.length === 2 && !hand.doubled) {
    actions.push("double");
    if (hand.cards[0].rank === hand.cards[1].rank) {
      actions.push("split");
    }
  }

  return actions;
}

/**
 * Filter game state for a specific viewer — hides other players' face-down cards.
 * The viewer can see their own full hand, dealer cards as-is, and only face-up cards of others.
 */
export function filterStateForPlayer(state: BJGameState, viewerPlayerId: string): BJGameState {
  const s = structuredClone(state);
  for (const p of s.players) {
    if (p.playerId === viewerPlayerId) continue;
    for (const h of p.hands) {
      h.cards = h.cards.map((c) =>
        c.faceUp ? c : { ...c, rank: "A" as any, suit: "spades" as any, faceUp: false }
      );
    }
  }
  return s;
}
