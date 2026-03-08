import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { DollarSign, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { BJPlayerState } from "@/lib/blackjack";

interface Props {
  players: BJPlayerState[];
  myPlayerId: string | undefined;
}

const LeaderboardButton = ({ players, myPlayerId }: Props) => {
  const [open, setOpen] = useState(false);

  const sorted = [...players].sort((a, b) => b.roundProfit - a.roundProfit);

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpen(!open)}
        className="gap-1 text-muted-foreground"
        title="Round winnings"
      >
        <DollarSign className="h-4 w-4" />
      </Button>

      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: -5, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -5, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className="absolute right-0 top-full mt-2 z-50 min-w-[200px] rounded-lg border border-border bg-card shadow-lg p-3 space-y-2"
            >
              <p className="text-[10px] font-display tracking-widest text-muted-foreground">ROUND WINNINGS</p>
              {sorted.map((p) => (
                <div
                  key={p.playerId}
                  className="flex items-center justify-between gap-4 py-1"
                >
                  <span className="text-sm font-medium truncate">
                    {p.name}
                    {p.playerId === myPlayerId && (
                      <span className="text-xs text-muted-foreground ml-1">(You)</span>
                    )}
                    {p.isDealer && (
                      <span className="text-xs text-game-gold ml-1">• D</span>
                    )}
                  </span>
                  <span className="flex items-center gap-1 font-display text-sm whitespace-nowrap">
                    {p.roundProfit > 0 && (
                      <>
                        <TrendingUp className="h-3 w-3 text-primary" />
                        <span className="text-primary">+${p.roundProfit}</span>
                      </>
                    )}
                    {p.roundProfit < 0 && (
                      <>
                        <TrendingDown className="h-3 w-3 text-destructive" />
                        <span className="text-destructive">${p.roundProfit}</span>
                      </>
                    )}
                    {p.roundProfit === 0 && (
                      <>
                        <Minus className="h-3 w-3 text-muted-foreground" />
                        <span className="text-muted-foreground">$0</span>
                      </>
                    )}
                  </span>
                </div>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default LeaderboardButton;
