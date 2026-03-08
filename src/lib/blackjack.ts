import { type Card, createDeck, handValue, isBlackjack, isBust } from "./cards";

export type PlayerAction = "hit" | "stand";
export type HandResult = "win" | "lose" | "push" | "blackjack" | "pending";

export interface BJHand {
  cards: Card[];
  bet: number;
  result: HandResult;
  stood: boolean;
  revealed: boolean;
}

export interface BJPlayerState {
  playerId: string;
  name: string;
  netProfit: number;
  hands: BJHand[];
  activeHandIndex: number;
  done: boolean;
  currentBet: number;
  ready: boolean;
  isDealer: boolean;
}

export interface BJGameState {
  deck: Card[];
  players: BJPlayerState[]; // includes the dealer (host) as a player with isDealer=true
  activePlayerIndex: number;
  phase: "betting" | "dealing" | "player_turns" | "dealer_turn" | "results" | "reveal";
  roundNumber: number;
  revealedPlayerIds: string[];
}

export function initGameState(
  playerNames: { id: string; name: string }[],
  hostId: string
): BJGameState {
  return {
    deck: createDeck(6),
    players: playerNames.map((p) => ({
      playerId: p.id,
      name: p.name,
      netProfit: 0,
      hands: [],
      activeHandIndex: 0,
      done: false,
      currentBet: 0,
      ready: false,
      isDealer: p.id === hostId,
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

export function setPlayerReady(state: BJGameState, playerId: string, bet: number): BJGameState {
  const s = structuredClone(state);
  const player = s.players.find((p) => p.playerId === playerId);
  if (!player) return s;
  player.currentBet = player.isDealer ? 0 : Math.max(bet, 0);
  player.ready = true;
  return s;
}

export function setPlayerUnready(state: BJGameState, playerId: string): BJGameState {
  const s = structuredClone(state);
  const player = s.players.find((p) => p.playerId === playerId);
  if (!player) return s;
  player.ready = false;
  return s;
}

export function allPlayersReady(state: BJGameState): boolean {
  return state.players.every((p) => p.ready);
}

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

function dealInitial(state: BJGameState): BJGameState {
  const s = state;

  // Round 1: first card to each player clockwise (including dealer)
  for (const p of s.players) {
    p.hands[0].cards.push(draw(s, true));
  }

  // Round 2: second card to each player clockwise
  for (const p of s.players) {
    p.hands[0].cards.push(draw(s, true));
  }

  // Non-dealer players go first, then dealer goes last
  // Find first non-dealer, non-done player
  s.phase = "player_turns";
  s.activePlayerIndex = s.players.findIndex((p) => !p.isDealer && !p.done);
  if (s.activePlayerIndex === -1) {
    // All non-dealer players done, dealer's turn
    return startDealerTurn(s);
  }

  return s;
}

export function playerAction(state: BJGameState, playerId: string, action: PlayerAction): BJGameState {
  const s = structuredClone(state);
  const currentPhase = s.phase;
  if (currentPhase !== "player_turns" && currentPhase !== "dealer_turn") return s;

  const player = s.players.find((p) => p.playerId === playerId);
  if (!player || player.done) return s;

  // During player_turns, only non-dealer can act. During dealer_turn, only dealer can act.
  if (currentPhase === "player_turns" && player.isDealer) return s;
  if (currentPhase === "dealer_turn" && !player.isDealer) return s;

  const hand = player.hands[player.activeHandIndex];
  if (!hand || hand.result !== "pending") return s;

  switch (action) {
    case "hit": {
      hand.cards.push(draw(s));
      if (isBust(hand.cards)) {
        hand.result = "lose";
        if (player.isDealer) {
          // Dealer busted — all pending players win
          finishDealerTurn(s);
        } else {
          advanceHand(s, player);
        }
      }
      break;
    }
    case "stand": {
      hand.stood = true;
      if (player.isDealer) {
        finishDealerTurn(s);
      } else {
        advanceHand(s, player);
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

  // Find next non-dealer player
  const nextPlayer = state.players.findIndex(
    (p, i) => i > state.activePlayerIndex && !p.done && !p.isDealer
  );
  if (nextPlayer !== -1) {
    state.activePlayerIndex = nextPlayer;
  } else {
    // All non-dealer players done — move to reveal phase
    state.phase = "reveal";
    state.revealedPlayerIds = [];
  }
}

export function revealPlayer(state: BJGameState, playerId: string): BJGameState {
  const s = structuredClone(state);
  if (s.phase !== "reveal") return s;
  if (!s.revealedPlayerIds.includes(playerId)) {
    s.revealedPlayerIds.push(playerId);
    const player = s.players.find((p) => p.playerId === playerId);
    if (player) {
      for (const h of player.hands) {
        h.revealed = true;
      }
    }
  }
  return s;
}

export function revealAll(state: BJGameState): BJGameState {
  const s = structuredClone(state);
  if (s.phase !== "reveal") return s;
  for (const p of s.players) {
    if (!s.revealedPlayerIds.includes(p.playerId)) {
      s.revealedPlayerIds.push(p.playerId);
    }
    for (const h of p.hands) {
      h.revealed = true;
    }
  }
  // After revealing all, dealer plays
  return startDealerTurn(s);
}

function startDealerTurn(state: BJGameState): BJGameState {
  state.phase = "dealer_turn";
  const dealer = state.players.find((p) => p.isDealer);
  if (!dealer) {
    state.phase = "results";
    return settleRound(state);
  }
  // Reveal all player hands
  for (const p of state.players) {
    for (const h of p.hands) {
      h.revealed = true;
    }
  }
  state.revealedPlayerIds = state.players.map((p) => p.playerId);

  // Dealer is now active — they draw/done manually
  state.activePlayerIndex = state.players.indexOf(dealer);
  dealer.done = false;
  return state;
}

/** Called when dealer finishes (stood or busted) */
function finishDealerTurn(state: BJGameState) {
  const dealer = state.players.find((p) => p.isDealer);
  if (!dealer) return;
  dealer.done = true;

  const dealerHand = dealer.hands[0];
  const dealerVal = handValue(dealerHand.cards);
  const dealerBust = isBust(dealerHand.cards);

  // If dealer busted, mark it
  if (dealerBust) {
    dealerHand.result = "lose";
  }

  // Settle each non-dealer player
  for (const p of state.players) {
    if (p.isDealer) continue;
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

  // Set dealer result based on net outcome
  if (!dealerBust) {
    dealerHand.result = "push"; // neutral display for dealer
  }

  state.phase = "results";
  settleRound(state);
}

function settleRound(state: BJGameState): BJGameState {
  const dealer = state.players.find((p) => p.isDealer);
  let dealerNet = 0;

  for (const p of state.players) {
    if (p.isDealer) continue;
    for (const h of p.hands) {
      switch (h.result) {
        case "blackjack":
          p.netProfit += Math.floor(h.bet * 1.5);
          dealerNet -= Math.floor(h.bet * 1.5);
          break;
        case "win":
          p.netProfit += h.bet;
          dealerNet -= h.bet;
          break;
        case "push":
          break;
        case "lose":
          p.netProfit -= h.bet;
          dealerNet += h.bet;
          break;
      }
    }
  }

  if (dealer) {
    dealer.netProfit += dealerNet;
  }

  return state;
}

export function newRound(state: BJGameState): BJGameState {
  const s = structuredClone(state);
  s.activePlayerIndex = 0;
  s.phase = "betting";
  s.roundNumber++;
  s.revealedPlayerIds = [];
  for (const p of s.players) {
    p.hands = [];
    p.activeHandIndex = 0;
    p.done = false;
    p.ready = false;
  }
  return s;
}

export function getAvailableActions(state: BJGameState, playerId: string): PlayerAction[] {
  const player = state.players.find((p) => p.playerId === playerId);
  if (!player || player.done) return [];

  if (state.phase === "player_turns" && !player.isDealer) {
    const hand = player.hands[player.activeHandIndex];
    if (!hand || hand.result !== "pending") return [];
    if (state.players[state.activePlayerIndex]?.playerId !== playerId) return [];
    return ["hit", "stand"];
  }

  if (state.phase === "dealer_turn" && player.isDealer) {
    const hand = player.hands[player.activeHandIndex];
    if (!hand || hand.result !== "pending") return [];
    return ["hit", "stand"];
  }

  return [];
}

export function filterStateForPlayer(state: BJGameState, viewerPlayerId: string): BJGameState {
  const s = structuredClone(state);
  for (const p of s.players) {
    if (p.playerId === viewerPlayerId) continue;
    if ((s.phase === "reveal" || s.phase === "results" || s.phase === "dealer_turn") && 
        s.revealedPlayerIds.includes(p.playerId)) {
      continue;
    }
    // Hide ALL of other players' cards
    for (const h of p.hands) {
      h.cards = h.cards.map(() => ({ rank: "A" as any, suit: "spades" as any, faceUp: false }));
    }
  }
  return s;
}
