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
        "Beat the dealer by getting a hand value as close to 21 as possible without going over. Number cards = face value, Face cards = 10, Ace = 1 or 11.",
    },
    {
      title: "Your Options",
      content:
        "Hit (draw a card), Stand (keep your hand), Double Down (double bet, get one card), Split (if same-value pair, play two hands).",
    },
    {
      title: "Dealer Rules",
      content:
        "The dealer must hit on 16 or below and stand on 17 or above. If the dealer busts, all remaining players win.",
    },
    {
      title: "Payouts",
      content:
        "Win: 1:1. Blackjack (Ace + 10-value): 3:2. Push (tie): bet returned. Insurance pays 2:1 if dealer has Blackjack.",
    },
  ],
};
