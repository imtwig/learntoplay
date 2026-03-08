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

export interface BJSettings {
  showFirstCard: boolean;
  showFirstCardNextRound: boolean;
}

export interface BJGameState {
  deck: Card[];
  players: BJPlayerState[];
  activePlayerIndex: number;
  phase: "betting" | "dealing" | "player_turns" | "dealer_turn" | "results";
  roundNumber: number;
  revealedPlayerIds: string[];
  settings: BJSettings;
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
    settings: { showFirstCard: false, showFirstCardNextRound: false },
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

export function toggleShowFirstCard(state: BJGameState): BJGameState {
  const s = structuredClone(state);
  s.settings.showFirstCardNextRound = !s.settings.showFirstCardNextRound;
  return s;
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

  for (const p of s.players) {
    p.hands[0].cards.push(draw(s, true));
  }
  for (const p of s.players) {
    p.hands[0].cards.push(draw(s, true));
  }

  s.phase = "player_turns";
  s.activePlayerIndex = s.players.findIndex((p) => !p.isDealer && !p.done);
  if (s.activePlayerIndex === -1) {
    return enterDealerTurn(s);
  }

  return s;
}

export function playerAction(state: BJGameState, playerId: string, action: PlayerAction): BJGameState {
  const s = structuredClone(state);
  const currentPhase = s.phase;
  if (currentPhase !== "player_turns" && currentPhase !== "dealer_turn") return s;

  const player = s.players.find((p) => p.playerId === playerId);
  if (!player || player.done) return s;

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

  const nextPlayer = state.players.findIndex(
    (p, i) => i > state.activePlayerIndex && !p.done && !p.isDealer
  );
  if (nextPlayer !== -1) {
    state.activePlayerIndex = nextPlayer;
  } else {
    // All non-dealer players done — dealer's turn (draw + reveal combined)
    enterDealerTurn(state);
  }
}

/**
 * Enter dealer turn phase. Dealer can draw/done AND reveal players simultaneously.
 */
function enterDealerTurn(state: BJGameState): BJGameState {
  state.phase = "dealer_turn";
  state.revealedPlayerIds = [];
  const dealer = state.players.find((p) => p.isDealer);
  if (dealer) {
    state.activePlayerIndex = state.players.indexOf(dealer);
    dealer.done = false;
  }
  return state;
}

/**
 * Dealer reveals a specific player's hand.
 * If the revealed player's hand beats the dealer's current hand, the player wins immediately.
 * If the player busted, they lose immediately.
 */
export function revealPlayer(state: BJGameState, playerId: string): BJGameState {
  const s = structuredClone(state);
  if (s.phase !== "dealer_turn") return s;
  if (s.revealedPlayerIds.includes(playerId)) return s;

  s.revealedPlayerIds.push(playerId);
  const player = s.players.find((p) => p.playerId === playerId);
  if (!player) return s;

  const dealer = s.players.find((p) => p.isDealer);
  const dealerVal = dealer ? handValue(dealer.hands[0]?.cards ?? []) : 0;

  for (const h of player.hands) {
    h.revealed = true;
    if (h.result !== "pending") continue;

    const playerVal = handValue(h.cards);
    const playerBust = isBust(h.cards);

    if (playerBust) {
      h.result = "lose";
      settleHand(s, player, h, dealer);
    } else if (playerVal > dealerVal) {
      h.result = "win";
      settleHand(s, player, h, dealer);
    }
    // If dealer >= player, stays pending until dealer finishes
  }

  return s;
}

/** Reveal all players' hands */
export function revealAll(state: BJGameState): BJGameState {
  const s = structuredClone(state);
  if (s.phase !== "dealer_turn") return s;

  const dealer = s.players.find((p) => p.isDealer);
  const dealerVal = dealer ? handValue(dealer.hands[0]?.cards ?? []) : 0;

  for (const p of s.players) {
    if (p.isDealer) continue;
    if (s.revealedPlayerIds.includes(p.playerId)) continue;

    s.revealedPlayerIds.push(p.playerId);
    for (const h of p.hands) {
      h.revealed = true;
      if (h.result !== "pending") continue;

      const playerVal = handValue(h.cards);
      const playerBust = isBust(h.cards);

      if (playerBust) {
        h.result = "lose";
        settleHand(s, p, h, dealer);
      } else if (playerVal > dealerVal) {
        h.result = "win";
        settleHand(s, p, h, dealer);
      }
    }
  }

  return s;
}

function settleHand(state: BJGameState, player: BJPlayerState, hand: BJHand, dealer: BJPlayerState | undefined) {
  switch (hand.result) {
    case "blackjack":
      player.netProfit += Math.floor(hand.bet * 1.5);
      if (dealer) dealer.netProfit -= Math.floor(hand.bet * 1.5);
      break;
    case "win":
      player.netProfit += hand.bet;
      if (dealer) dealer.netProfit -= hand.bet;
      break;
    case "lose":
      player.netProfit -= hand.bet;
      if (dealer) dealer.netProfit += hand.bet;
      break;
    case "push":
      break;
  }
}

/** Called when dealer stands or busts — settle all remaining pending hands */
function finishDealerTurn(state: BJGameState) {
  const dealer = state.players.find((p) => p.isDealer);
  if (!dealer) return;
  dealer.done = true;

  const dealerHand = dealer.hands[0];
  const dealerVal = handValue(dealerHand.cards);
  const dealerBust = isBust(dealerHand.cards);

  if (dealerBust) {
    dealerHand.result = "lose";
  }

  // Reveal and settle all remaining
  for (const p of state.players) {
    if (p.isDealer) continue;
    if (!state.revealedPlayerIds.includes(p.playerId)) {
      state.revealedPlayerIds.push(p.playerId);
    }
    for (const h of p.hands) {
      h.revealed = true;
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
      settleHand(state, p, h, dealer);
    }
  }

  if (!dealerBust) {
    dealerHand.result = "push";
  }

  state.phase = "results";
}

export function newRound(state: BJGameState): BJGameState {
  const s = structuredClone(state);
  s.activePlayerIndex = 0;
  s.phase = "betting";
  s.roundNumber++;
  s.revealedPlayerIds = [];
  s.settings.showFirstCard = s.settings.showFirstCardNextRound;
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
  if (!s.revealedPlayerIds) s.revealedPlayerIds = [];
  if (!s.settings) s.settings = { showFirstCard: false, showFirstCardNextRound: false };
  for (const p of s.players) {
    if (p.playerId === viewerPlayerId) continue;
    // Show revealed players fully
    if ((s.phase === "dealer_turn" || s.phase === "results") && 
        s.revealedPlayerIds.includes(p.playerId)) {
      continue;
    }
    // Show first card if setting is on, hide the rest
    for (const h of p.hands) {
      h.cards = h.cards.map((c, i) => {
        if (i === 0 && s.settings.showFirstCard) {
          return c;
        }
        return { rank: "A" as any, suit: "spades" as any, faceUp: false };
      });
    }
  }
  return s;
}
