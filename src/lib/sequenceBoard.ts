// Official Sequence board layout (10x10)
// Each non-Jack card appears exactly twice. Corners are FREE spaces.
// Card format: "RS" where R=rank (A,2-10,Q,K) and S=suit letter (S,C,D,H)

export const SEQUENCE_BOARD: string[][] = [
  ["FREE", "2S", "3S", "4S", "5S", "6S", "7S", "8S", "9S", "FREE"],
  ["6C", "5C", "4C", "3C", "2C", "AH", "KH", "QH", "10H", "10S"],
  ["7C", "AS", "2D", "3D", "4D", "5D", "6D", "7D", "9H", "QS"],
  ["8C", "KS", "6C", "5C", "4C", "3C", "2C", "8D", "8H", "KS"],
  ["9C", "QS", "7C", "6H", "5H", "4H", "AH", "9D", "7H", "AS"],
  ["10C", "10S", "8C", "7H", "2H", "3H", "KH", "10D", "6H", "2D"],
  ["QC", "9S", "9C", "8H", "9H", "10H", "QH", "QD", "5H", "3D"],
  ["KC", "8S", "10C", "QC", "KC", "AC", "AD", "KD", "4H", "4D"],
  ["AC", "7S", "6S", "5S", "4S", "3S", "2S", "2H", "3H", "5D"],
  ["FREE", "AD", "KD", "QD", "10D", "9D", "8D", "7D", "6D", "FREE"],
];

/** Get all board positions matching a card code */
export function getBoardPositions(card: string): [number, number][] {
  if (card.startsWith("J")) return []; // Jacks don't appear on board
  const positions: [number, number][] = [];
  for (let r = 0; r < 10; r++) {
    for (let c = 0; c < 10; c++) {
      if (SEQUENCE_BOARD[r][c] === card) positions.push([r, c]);
    }
  }
  return positions;
}

export function isCorner(r: number, c: number): boolean {
  return SEQUENCE_BOARD[r][c] === "FREE";
}

export function isTwoEyedJack(card: string): boolean {
  return card === "JD" || card === "JC";
}

export function isOneEyedJack(card: string): boolean {
  return card === "JH" || card === "JS";
}

export function isJack(card: string): boolean {
  return card.startsWith("J");
}

const SUIT_SYMBOLS: Record<string, string> = { S: "♠", C: "♣", D: "♦", H: "♥" };
const SUIT_COLORS: Record<string, "red" | "black"> = { S: "black", C: "black", D: "red", H: "red" };

export function parseCard(card: string): { rank: string; suitSymbol: string; suitColor: "red" | "black" } {
  if (card === "FREE") return { rank: "★", suitSymbol: "", suitColor: "black" };
  const suit = card[card.length - 1];
  const rank = card.slice(0, -1);
  return {
    rank,
    suitSymbol: SUIT_SYMBOLS[suit] || "",
    suitColor: SUIT_COLORS[suit] || "black",
  };
}
