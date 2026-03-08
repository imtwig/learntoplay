import { Spade, Grid3X3, Club, Flame } from "lucide-react";

export type GameId = "poker" | "sequence" | "blackjack" | "asshole_daidi";

export interface GameInfo {
  id: GameId;
  name: string;
  tagline: string;
  description: string;
  icon: typeof Spade;
  minPlayers: number;
  maxPlayers: number;
  color: string;
  gradient: string;
}

export const games: GameInfo[] = [
  {
    id: "poker",
    name: "Texas Hold'em",
    tagline: "No-Limit Poker",
    description: "The king of card games. Bluff, bet, and outplay your opponents in this classic no-limit poker experience.",
    icon: Spade,
    minPlayers: 2,
    maxPlayers: 9,
    color: "text-game-red",
    gradient: "from-game-red/20 to-game-gold/10",
  },
  {
    id: "sequence",
    name: "Sequence",
    tagline: "Strategy Board Game",
    description: "Form sequences of 5 on the board by playing matching cards. Team up or go solo in this strategic classic.",
    icon: Grid3X3,
    minPlayers: 2,
    maxPlayers: 12,
    color: "text-game-blue",
    gradient: "from-game-blue/20 to-accent/10",
  },
  {
    id: "blackjack",
    name: "Blackjack",
    tagline: "Beat the Dealer",
    description: "Get as close to 21 as possible without going over. Hit, stand, split, or double down against the dealer.",
    icon: Club,
    minPlayers: 1,
    maxPlayers: 7,
    color: "text-game-gold",
    gradient: "from-game-gold/20 to-primary/10",
  },
  {
    id: "asshole_daidi",
    name: "Asshole Dai Di",
    tagline: "Shedding Card Game",
    description: "Get rid of your cards by playing higher combinations. Earn ranks like President or Asshole, then swap cards before the next round.",
    icon: Flame,
    minPlayers: 3,
    maxPlayers: 7,
    color: "text-game-red",
    gradient: "from-game-red/20 to-game-gold/10",
  },
];

export const getGame = (id: GameId) => games.find((g) => g.id === id);
