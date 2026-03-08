import PlayingCard from "./PlayingCard";
import { type Card, handValue } from "@/lib/cards";
import type { HandResult } from "@/lib/blackjack";

interface HandDisplayProps {
  cards: Card[];
  label?: string;
  result?: HandResult;
  bet?: number;
  active?: boolean;
  compact?: boolean;
}

const resultBadge: Record<string, { text: string; class: string }> = {
  blackjack: { text: "BLACKJACK! x2", class: "bg-game-gold text-background" },
  double_aces: { text: "DOUBLE ACES! x3", class: "bg-game-gold text-background" },
  triple_sevens: { text: "7-7-7! x3", class: "bg-game-gold text-background" },
  five_card: { text: "5 CARDS! x2", class: "bg-primary text-primary-foreground" },
  win: { text: "WIN", class: "bg-primary text-primary-foreground" },
  lose: { text: "LOSE", class: "bg-destructive text-destructive-foreground" },
  push: { text: "PUSH", class: "bg-muted text-muted-foreground" },
};

const HandDisplay = ({ cards, label, result, bet, active, compact }: HandDisplayProps) => {
  const val = handValue(cards);
  const badge = result && result !== "pending" ? resultBadge[result] : null;

  return (
    <div className={`flex flex-col items-center gap-2 ${active ? "scale-105" : ""} transition-transform`}>
      {label && (
        <span className="text-xs font-display tracking-wider text-muted-foreground uppercase">
          {label}
        </span>
      )}
      <div className="flex gap-1 -space-x-3">
        {cards.map((card, i) => (
          <PlayingCard key={i} card={card} index={i} small={compact} />
        ))}
      </div>
      <div className="flex items-center gap-2">
        <span className={`text-sm font-display font-bold ${val > 21 ? "text-destructive" : "text-foreground"}`}>
          {cards.some(c => !c.faceUp) ? "?" : val}
        </span>
        {bet !== undefined && (
          <span className="text-xs text-game-gold font-display">${bet}</span>
        )}
        {badge && (
          <span className={`text-[10px] font-display font-bold px-2 py-0.5 rounded-full ${badge.class}`}>
            {badge.text}
          </span>
        )}
      </div>
    </div>
  );
};

export default HandDisplay;
