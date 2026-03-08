import type { GameId } from "./gameData";

interface RuleSection {
  title: string;
  content: string;
}

export const gameRules: Record<GameId, RuleSection[]> = {
  poker: [
    {
      title: "Overview",
      content:
        "Texas Hold'em is a community card poker game. Each player receives 2 private hole cards, and 5 community cards are dealt face-up. Make the best 5-card hand from any combination.",
    },
    {
      title: "Betting Rounds",
      content:
        "There are 4 betting rounds: Pre-Flop (after hole cards), Flop (3 community cards), Turn (4th card), and River (5th card). You can Check, Call, Raise, or Fold on each round.",
    },
    {
      title: "Hand Rankings",
      content:
        "Royal Flush > Straight Flush > Four of a Kind > Full House > Flush > Straight > Three of a Kind > Two Pair > One Pair > High Card.",
    },
    {
      title: "Winning",
      content:
        "The last player with chips wins. Players with 0 chips are eliminated. Side pots are created automatically for all-in situations.",
    },
  ],
  sequence: [
    {
      title: "Overview",
      content:
        "Sequence is a strategy board-and-card game played on a 10×10 grid. Play cards from your hand to place chips on matching board spaces. Form rows of 5 chips to make a Sequence.",
    },
    {
      title: "Jacks Are Special",
      content:
        "Two-Eyed Jacks (♦ ♣) are wild — place a chip anywhere. One-Eyed Jacks (♥ ♠) are anti-wild — remove any opponent's chip (not part of a completed Sequence).",
    },
    {
      title: "Dead Cards",
      content:
        "If both matching board spaces for a card in your hand are occupied, it's a dead card. Show it, discard it, draw a new card. This counts as your turn.",
    },
    {
      title: "Winning",
      content:
        "2–3 players: first to complete 2 Sequences wins. Team games: first team to complete 2 Sequences wins. Corner spaces are free and count for any player.",
    },
  ],
  blackjack: [
    {
      title: "Overview",
      content:
        "Ban Luck — beat the dealer by getting a hand value as close to 21 as possible without going over. Number cards = face value, Face cards = 10, Ace = 1 or 11.",
    },
    {
      title: "Your Options",
      content:
        "Draw (hit a card), Done (keep your hand). Try to get as close to 21 as possible without busting.",
    },
    {
      title: "Special Hands",
      content:
        "Ban Luck (Ace + 10-value): pays 2x. Ban Ban (Double Aces): pays 3x. Triple Sevens (7-7-7): pays 3x. Five Card Charlie (5 cards without busting): pays 2x.",
    },
    {
      title: "Payouts",
      content:
        "Win: 1:1. Ban Luck: 2:1. Ban Ban: 3:1. Push (tie): bet returned.",
    },
  ],
  asshole_daidi: [
    {
      title: "Overview",
      content:
        "Shed all your cards by playing combinations (singles, pairs, triples, or 5-card hands) that beat the current play. Last player with cards is the Asshole!",
    },
    {
      title: "Card Ranking",
      content:
        "Ranks: 3 < 4 < … < K < A < 2. Suits: ♦ < ♣ < ♥ < ♠. The 2 of Spades is the highest card.",
    },
    {
      title: "Ranks & Swaps",
      content:
        "After each round, players are ranked (President → Asshole). Before the next round, the Asshole must give their best cards to the President, who returns their worst.",
    },
    {
      title: "Scoring",
      content:
        "The President earns points equal to the total cards remaining in all other players' hands. Highest cumulative score wins the session.",
    },
  ],
  dai_di: [
    {
      title: "Overview",
      content:
        "Dai Di (Big 2) is a 4-player shedding card game. Be the first to play all 13 cards by beating each previous play with a higher combination.",
    },
    {
      title: "Card Ranking",
      content:
        "Ranks: 3 < 4 < … < K < A < 2. Suits: ♦ < ♣ < ♥ < ♠. The 2 of Spades is the single highest card.",
    },
    {
      title: "Combinations",
      content:
        "Singles, Pairs, and 5-card combos (Straight < Flush < Full House < Four of a Kind < Straight Flush). Triples available as a house rule.",
    },
    {
      title: "Scoring",
      content:
        "Losers score penalties based on cards remaining (with optional multipliers: 10+ cards ×2, 13 cards ×3, +2 per 2 held). The winner earns the sum of all penalties.",
    },
  ],
};
