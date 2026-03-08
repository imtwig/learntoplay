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
  chips: number;
  hands: BJHand[];
  activeHandIndex: number;
  done: boolean;
}

export interface BJGameState {
  deck: Card[];
  dealer: Card[];
  players: BJPlayerState[];
  activePlayerIndex: number;
  phase: "betting" | "dealing" | "player_turns" | "dealer_turn" | "results";
  roundNumber: number;
}

export function initGameState(playerNames: { id: string; name: string }[], startingChips = 1000): BJGameState {
  return {
    deck: createDeck(6),
    dealer: [],
    players: playerNames.map((p) => ({
      playerId: p.id,
      name: p.name,
      chips: startingChips,
      hands: [],
      activeHandIndex: 0,
      done: false,
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

export function placeBets(state: BJGameState, bets: Record<string, number>): BJGameState {
  const s = structuredClone(state);
  for (const p of s.players) {
    const bet = bets[p.playerId] ?? 50;
    const actualBet = Math.min(bet, p.chips);
    p.chips -= actualBet;
    p.hands = [{ cards: [], bet: actualBet, result: "pending", doubled: false, stood: false }];
    p.activeHandIndex = 0;
    p.done = false;
  }
  s.phase = "dealing";
  return dealInitial(s);
}

function dealInitial(state: BJGameState): BJGameState {
  const s = state;
  // Deal 2 cards to each player
  for (let round = 0; round < 2; round++) {
    for (const p of s.players) {
      p.hands[0].cards.push(draw(s));
    }
  }
  // Dealer gets 2 cards (second face down)
  s.dealer = [draw(s), draw(s, false)];
  
  // Check for dealer blackjack
  const dealerFull = s.dealer.map(c => ({ ...c, faceUp: true }));
  if (isBlackjack(dealerFull)) {
    s.dealer[1].faceUp = true;
    for (const p of s.players) {
      for (const h of p.hands) {
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
      p.done = true;
    }
  }

  s.phase = "player_turns";
  s.activePlayerIndex = s.players.findIndex(p => !p.done);
  if (s.activePlayerIndex === -1) {
    return startDealerTurn(s);
  }
  return s;
}

export function playerAction(state: BJGameState, playerId: string, action: PlayerAction): BJGameState {
  const s = structuredClone(state);
  if (s.phase !== "player_turns") return s;
  
  const player = s.players.find(p => p.playerId === playerId);
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
      if (hand.cards.length === 2 && player.chips >= hand.bet) {
        player.chips -= hand.bet;
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
      if (hand.cards.length === 2 && hand.cards[0].rank === hand.cards[1].rank && player.chips >= hand.bet) {
        player.chips -= hand.bet;
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
  // Move to next hand or next player
  const nextHand = player.hands.findIndex((h, i) => i > player.activeHandIndex && h.result === "pending" && !h.stood);
  if (nextHand !== -1) {
    player.activeHandIndex = nextHand;
    return;
  }
  player.done = true;
  
  // Find next active player
  const nextPlayer = state.players.findIndex((p, i) => i > state.activePlayerIndex && !p.done);
  if (nextPlayer !== -1) {
    state.activePlayerIndex = nextPlayer;
  } else {
    // All players done, dealer's turn
    startDealerTurn(state);
  }
}

function startDealerTurn(state: BJGameState): BJGameState {
  state.phase = "dealer_turn";
  state.dealer[1].faceUp = true;
  
  // Check if any hands are still pending (not busted/blackjack)
  const anyPending = state.players.some(p => p.hands.some(h => h.result === "pending"));
  
  if (anyPending) {
    // Dealer hits until 17+
    while (handValue(state.dealer) < 17) {
      state.dealer.push(draw(state));
    }
  }

  // Resolve hands
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
          p.chips += Math.floor(h.bet * 2.5); // 3:2 payout
          break;
        case "win":
          p.chips += h.bet * 2;
          break;
        case "push":
          p.chips += h.bet;
          break;
        // lose: chips already deducted
      }
    }
  }
  return state;
}

export function newRound(state: BJGameState): BJGameState {
  const s = structuredClone(state);
  // Remove players with 0 chips
  s.players = s.players.filter(p => p.chips > 0);
  s.dealer = [];
  s.activePlayerIndex = 0;
  s.phase = "betting";
  s.roundNumber++;
  for (const p of s.players) {
    p.hands = [];
    p.activeHandIndex = 0;
    p.done = false;
  }
  return s;
}

export function getAvailableActions(state: BJGameState, playerId: string): PlayerAction[] {
  if (state.phase !== "player_turns") return [];
  const player = state.players.find(p => p.playerId === playerId);
  if (!player || player.done) return [];
  const hand = player.hands[player.activeHandIndex];
  if (!hand || hand.result !== "pending") return [];

  const actions: PlayerAction[] = ["hit", "stand"];
  
  if (hand.cards.length === 2 && !hand.doubled) {
    if (player.chips >= hand.bet) {
      actions.push("double");
    }
    if (hand.cards[0].rank === hand.cards[1].rank && player.chips >= hand.bet) {
      actions.push("split");
    }
  }
  
  return actions;
}
