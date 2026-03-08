export type Suit = "hearts" | "diamonds" | "clubs" | "spades";
export type Rank = "A" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "10" | "J" | "Q" | "K";

export interface Card {
  suit: Suit;
  rank: Rank;
  faceUp: boolean;
}

export const SUITS: Suit[] = ["hearts", "diamonds", "clubs", "spades"];
export const RANKS: Rank[] = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

export const suitSymbol: Record<Suit, string> = {
  hearts: "♥",
  diamonds: "♦",
  clubs: "♣",
  spades: "♠",
};

export const suitColor: Record<Suit, "red" | "black"> = {
  hearts: "red",
  diamonds: "red",
  clubs: "black",
  spades: "black",
};

export function createDeck(numDecks = 6): Card[] {
  const deck: Card[] = [];
  for (let d = 0; d < numDecks; d++) {
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        deck.push({ suit, rank, faceUp: true });
      }
    }
  }
  return shuffle(deck);
}

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function cardValue(rank: Rank): number {
  if (rank === "A") return 11;
  if (["K", "Q", "J"].includes(rank)) return 10;
  return parseInt(rank);
}

export function handValue(cards: Card[]): number {
  let total = 0;
  let softAces = 0; // aces counted as 11 (only from first 2 cards)
  for (let i = 0; i < cards.length; i++) {
    const c = cards[i];
    if (!c.faceUp) continue;
    if (c.rank === "A") {
      if (i < 2) {
        // First 2 cards: ace starts as 11, can be reduced to 1 (diff of 10)
        total += 11;
        softAces++;
      } else {
        // 3rd+ card: ace can only be 10 or 1, start at 10
        total += 10;
        // Track separately — can reduce to 1 (diff of 9)
        softAces++; // we'll handle the reduction below
      }
    } else {
      total += cardValue(c.rank);
    }
  }
  // Reduce aces to fit under 21
  // Process from last ace backwards: 3rd+ aces drop by 9 (10→1), first-2 aces drop by 10 (11→1)
  for (let i = cards.length - 1; i >= 0 && total > 21 && softAces > 0; i--) {
    if (!cards[i].faceUp || cards[i].rank !== "A") continue;
    const reduction = i < 2 ? 10 : 9;
    total -= reduction;
    softAces--;
  }
  return total;
}

export function isBlackjack(cards: Card[]): boolean {
  return cards.length === 2 && handValue(cards) === 21;
}

export function isBust(cards: Card[]): boolean {
  return handValue(cards) > 21;
}
