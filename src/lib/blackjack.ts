import { type Card, createDeck, handValue, isBlackjack, isBust } from "./cards";

export type PlayerAction = "hit" | "stand";
export type HandResult = "win" | "lose" | "push" | "blackjack" | "double_aces" | "five_card" | "triple_sevens" | "pending";

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
  roundProfit: number;
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

/** Check if a hand is exactly two aces */
function hasDoubleAces(cards: Card[]): boolean {
  return cards.length === 2 && cards[0].rank === "A" && cards[1].rank === "A";
}

/** Check if a hand is three 7s */
function hasTripleSevens(cards: Card[]): boolean {
  return cards.length === 3 && cards.every((c) => c.rank === "7");
}

/**
 * Opening hand strength: double_aces (3x) > blackjack (2x) > normal (0)
 */
function openingStrength(cards: Card[]): number {
  if (hasDoubleAces(cards)) return 3;
  if (isBlackjack(cards)) return 2;
  return 0;
}

export function initGameState(
  playerNames: { id: string; name: string }[],
  hostId: string
): BJGameState {
  return {
    deck: createDeck(1),
    players: playerNames.map((p) => ({
      playerId: p.id,
      name: p.name,
      netProfit: 0,
      roundProfit: 0,
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
  if (state.deck.length < 5) {
    state.deck = createDeck(1);
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
    p.roundProfit = 0;
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

  // --- Opening hand rules ---
  const dealer = s.players.find((p) => p.isDealer);
  const dealerStrength = dealer ? openingStrength(dealer.hands[0].cards) : 0;

  // Check each non-dealer player for opening specials
  for (const p of s.players) {
    if (p.isDealer) continue;
    const playerStrength = openingStrength(p.hands[0].cards);

    if (dealerStrength > 0 && playerStrength > 0) {
      // Both have specials — higher strength wins, equal = push
      if (playerStrength > dealerStrength) {
        // Player's hand beats dealer's
        p.hands[0].result = playerStrength === 3 ? "double_aces" : "blackjack";
        p.hands[0].revealed = true;
        settleHand(s, p, p.hands[0], dealer);
        p.done = true;
      } else if (playerStrength < dealerStrength) {
        // Dealer's hand beats player's
        p.hands[0].result = "lose";
        p.hands[0].revealed = true;
        const mult = dealerStrength; // 2 for blackjack, 3 for double aces
        p.netProfit -= p.hands[0].bet * mult;
        p.roundProfit -= p.hands[0].bet * mult;
        if (dealer) { dealer.netProfit += p.hands[0].bet * mult; dealer.roundProfit += p.hands[0].bet * mult; }
        p.done = true;
      } else {
        // Equal — push
        p.hands[0].result = "push";
        p.hands[0].revealed = true;
        p.done = true;
      }
      if (!s.revealedPlayerIds.includes(p.playerId)) {
        s.revealedPlayerIds.push(p.playerId);
      }
    } else if (dealerStrength > 0 && playerStrength === 0) {
      // Dealer has special, player doesn't — player loses
      p.hands[0].result = "lose";
      p.hands[0].revealed = true;
      const mult = dealerStrength;
      p.netProfit -= p.hands[0].bet * mult;
      p.roundProfit -= p.hands[0].bet * mult;
      if (dealer) { dealer.netProfit += p.hands[0].bet * mult; dealer.roundProfit += p.hands[0].bet * mult; }
      p.done = true;
      if (!s.revealedPlayerIds.includes(p.playerId)) {
        s.revealedPlayerIds.push(p.playerId);
      }
    } else if (playerStrength > 0) {
      // Player has special, dealer doesn't — player wins immediately
      p.hands[0].result = playerStrength === 3 ? "double_aces" : "blackjack";
      p.hands[0].revealed = true;
      settleHand(s, p, p.hands[0], dealer);
      p.done = true;
      if (!s.revealedPlayerIds.includes(p.playerId)) {
        s.revealedPlayerIds.push(p.playerId);
      }
    }
  }

  // If dealer had a special, mark dealer hand result but DON'T auto-end
  // Instead, go to dealer_turn so dealer can press "Done" and reveal/settle
  if (dealer && dealerStrength > 0) {
    dealer.hands[0].result = dealerStrength === 3 ? "double_aces" : "blackjack";
    // Auto-reveal dealer's cards
    dealer.hands[0].revealed = true;
    for (const c of dealer.hands[0].cards) c.faceUp = true;
    if (!s.revealedPlayerIds.includes(dealer.playerId)) {
      s.revealedPlayerIds.push(dealer.playerId);
    }
    // Don't mark dealer as done — go to dealer_turn so they press "Done"
    // But first settle any non-dealer players that already have specials
    // (those are already settled above)
    s.phase = "dealer_turn";
    s.activePlayerIndex = s.players.indexOf(dealer);
    dealer.done = false;
    return s;
  }

  // Check if all players are done (all had opening specials)
  const allNonDealerDone = s.players.filter((p) => !p.isDealer).every((p) => p.done);
  if (allNonDealerDone) {
    s.phase = "results";
    for (const p of s.players) {
      p.done = true;
    }
    return s;
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
  if (!hand) return s;
  
  // Allow dealer with resolved hand (ban luck/ban ban/bust) to press "stand" (Done)
  const dealerHasResolved = player.isDealer && (hand.result === "blackjack" || hand.result === "double_aces" || hand.result === "lose");
  if (hand.result !== "pending" && !dealerHasResolved) return s;

  switch (action) {
    case "hit": {
      hand.cards.push(draw(s));

      // --- Triple sevens check (non-dealer only) ---
      if (!player.isDealer && hasTripleSevens(hand.cards)) {
        hand.result = "triple_sevens";
        hand.revealed = true;
        const dealer = s.players.find((p) => p.isDealer);
        player.netProfit += hand.bet * 3;
        player.roundProfit += hand.bet * 3;
        if (dealer) { dealer.netProfit -= hand.bet * 3; dealer.roundProfit -= hand.bet * 3; }
        if (!s.revealedPlayerIds.includes(player.playerId)) {
          s.revealedPlayerIds.push(player.playerId);
        }
        advanceHand(s, player);
        break;
      }

      // --- 5-card rule (non-dealer only) ---
      if (!player.isDealer && hand.cards.length >= 5) {
        hand.revealed = true;
        if (!s.revealedPlayerIds.includes(player.playerId)) {
          s.revealedPlayerIds.push(player.playerId);
        }
        const val = handValue(hand.cards);
        if (val <= 21) {
          hand.result = "five_card";
          const dealer = s.players.find((p) => p.isDealer);
          player.netProfit += hand.bet * 2;
          player.roundProfit += hand.bet * 2;
          if (dealer) { dealer.netProfit -= hand.bet * 2; dealer.roundProfit -= hand.bet * 2; }
        } else {
          hand.result = "lose";
          const dealer = s.players.find((p) => p.isDealer);
          player.netProfit -= hand.bet * 2;
          player.roundProfit -= hand.bet * 2;
          if (dealer) { dealer.netProfit += hand.bet * 2; dealer.roundProfit += hand.bet * 2; }
        }
        advanceHand(s, player);
        break;
      }

      // --- Dealer 5-card rule ---
      if (player.isDealer && hand.cards.length >= 5) {
        const dealerVal = handValue(hand.cards);
        
        if (dealerVal <= 21) {
          // Dealer wins x2 from all remaining (unrevealed) players
          hand.result = "five_card";
          for (const p of s.players) {
            if (p.isDealer || s.revealedPlayerIds.includes(p.playerId)) continue;
            for (const h of p.hands) {
              if (h.result !== "pending") continue;
              h.result = "lose";
              h.revealed = true;
              p.netProfit -= h.bet * 2;
              p.roundProfit -= h.bet * 2;
              player.netProfit += h.bet * 2;
              player.roundProfit += h.bet * 2;
            }
            if (!s.revealedPlayerIds.includes(p.playerId)) {
              s.revealedPlayerIds.push(p.playerId);
            }
          }
        } else {
          // Dealer busts with 5 cards - loses x2 to all remaining players (except those who also busted)
          hand.result = "lose";
          for (const p of s.players) {
            if (p.isDealer || s.revealedPlayerIds.includes(p.playerId)) continue;
            for (const h of p.hands) {
              if (h.result !== "pending") continue;
              const pVal = handValue(h.cards);
              h.revealed = true;
              if (pVal > 21) {
                // Both busted — push, no money exchanged
                h.result = "push";
              } else {
                // Player didn't bust - wins x2
                h.result = "win";
                p.netProfit += h.bet * 2;
                p.roundProfit += h.bet * 2;
                player.netProfit -= h.bet * 2;
                player.roundProfit -= h.bet * 2;
              }
            }
            if (!s.revealedPlayerIds.includes(p.playerId)) {
              s.revealedPlayerIds.push(p.playerId);
            }
          }
        }
        finishDealerTurn(s);
        break;
      }

      // Dealer auto-busts — mark result but don't finish yet; dealer presses "Done"
      if (player.isDealer && isBust(hand.cards)) {
        hand.result = "lose";
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
    enterDealerTurn(state);
  }
}

function enterDealerTurn(state: BJGameState): BJGameState {
  state.phase = "dealer_turn";
  // Don't reset revealedPlayerIds — keep opening reveals
  const dealer = state.players.find((p) => p.isDealer);
  if (dealer) {
    state.activePlayerIndex = state.players.indexOf(dealer);
    dealer.done = false;
  }
  return state;
}

export function revealPlayer(state: BJGameState, playerId: string): BJGameState {
  const s = structuredClone(state);
  if (s.phase !== "dealer_turn") return s;
  if (s.revealedPlayerIds.includes(playerId)) return s;

  const dealer = s.players.find((p) => p.isDealer);
  const dealerVal = dealer ? handValue(dealer.hands[0]?.cards ?? []) : 0;

  // Dealer must have at least 15 points to reveal hands (unless they have a natural)
  const dealerHasNatural = dealer?.hands[0] && (dealer.hands[0].result === "blackjack" || dealer.hands[0].result === "double_aces");
  if (dealerVal < 15 && !dealerHasNatural) return s;

  s.revealedPlayerIds.push(playerId);
  const player = s.players.find((p) => p.playerId === playerId);
  if (!player) return s;

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
  }

  return s;
}

export function revealAll(state: BJGameState): BJGameState {
  const s = structuredClone(state);
  if (s.phase !== "dealer_turn") return s;

  // Dealer must have at least 15 points to reveal hands (unless they have a natural)
  const dealerCheck = s.players.find((p) => p.isDealer);
  const dealerCheckVal = dealerCheck ? handValue(dealerCheck.hands[0]?.cards ?? []) : 0;
  const dealerCheckNatural = dealerCheck?.hands[0] && (dealerCheck.hands[0].result === "blackjack" || dealerCheck.hands[0].result === "double_aces");
  if (dealerCheckVal < 15 && !dealerCheckNatural) return s;

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
      player.netProfit += hand.bet * 2;
      player.roundProfit += hand.bet * 2;
      if (dealer) { dealer.netProfit -= hand.bet * 2; dealer.roundProfit -= hand.bet * 2; }
      break;
    case "double_aces":
      player.netProfit += hand.bet * 3;
      player.roundProfit += hand.bet * 3;
      if (dealer) { dealer.netProfit -= hand.bet * 3; dealer.roundProfit -= hand.bet * 3; }
      break;
    case "triple_sevens":
      break;
    case "five_card":
      break;
    case "win":
      player.netProfit += hand.bet;
      player.roundProfit += hand.bet;
      if (dealer) { dealer.netProfit -= hand.bet; dealer.roundProfit -= hand.bet; }
      break;
    case "lose":
      player.netProfit -= hand.bet;
      player.roundProfit -= hand.bet;
      if (dealer) { dealer.netProfit += hand.bet; dealer.roundProfit += hand.bet; }
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
  if (!state.revealedPlayerIds.includes(dealer.playerId)) {
    state.revealedPlayerIds.push(dealer.playerId);
  }
  // Ensure all dealer cards are face-up for everyone to see
  for (const h of dealer.hands) {
    h.revealed = true;
    for (const c of h.cards) {
      c.faceUp = true;
    }
  }

  const dealerHand = dealer.hands[0];
  const dealerVal = handValue(dealerHand.cards);
  const dealerBust = isBust(dealerHand.cards);

  if (dealerBust) {
    dealerHand.result = "lose";
  }

  for (const p of state.players) {
    if (p.isDealer) continue;
    if (!state.revealedPlayerIds.includes(p.playerId)) {
      state.revealedPlayerIds.push(p.playerId);
    }
    for (const h of p.hands) {
      h.revealed = true;
      if (h.result !== "pending") continue;
      const pVal = handValue(h.cards);
      const playerBust = isBust(h.cards);

      if (playerBust && dealerBust) {
        // Both busted — push, no money exchanged
        h.result = "push";
      } else if (playerBust) {
        h.result = "lose";
      } else if (dealerBust) {
        h.result = "win";
      } else if (pVal < 15) {
        // Player under 15 and dealer didn't bust — player loses
        h.result = "lose";
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
    // Set dealer hand result based on net outcome
    if (dealer.roundProfit > 0) {
      dealerHand.result = "win";
    } else if (dealer.roundProfit < 0) {
      dealerHand.result = "lose";
    } else {
      dealerHand.result = "push";
    }
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

export function transferDealer(state: BJGameState, fromPlayerId: string, toPlayerId: string): BJGameState {
  const s = structuredClone(state);
  
  const oldDealer = s.players.find((p) => p.playerId === fromPlayerId);
  const newDealer = s.players.find((p) => p.playerId === toPlayerId);
  
  if (oldDealer) oldDealer.isDealer = false;
  if (newDealer) newDealer.isDealer = true;
  
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
    if (!hand || hand.result !== "pending") {
      // Dealer has a resolved hand (ban luck/ban ban/bust) — only allow "stand" (Done)
      if (hand && (hand.result === "blackjack" || hand.result === "double_aces" || hand.result === "lose")) {
        return ["stand"];
      }
      return [];
    }
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
    if (s.revealedPlayerIds.includes(p.playerId)) {
      continue;
    }
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
