import { motion } from "framer-motion";
import { ArrowLeft, RotateCcw, Coins } from "lucide-react";
import { Button } from "@/components/ui/button";
import HandDisplay from "./HandDisplay";
import type { BJGameState, PlayerAction } from "@/lib/blackjack";
import type { BJPlayerState } from "@/lib/blackjack";
import { sessionId } from "@/hooks/useRoom";

interface Props {
  gameState: BJGameState;
  myBJPlayer: BJPlayerState | undefined;
  availableActions: PlayerAction[];
  isHost: boolean;
  myBet: number;
  setMyBet: (v: number) => void;
  onAction: (a: PlayerAction) => void;
  onStartRound: () => void;
  onNextRound: () => void;
  onLeave: () => void;
}

const actionLabel: Record<PlayerAction, string> = {
  hit: "Hit",
  stand: "Stand",
  double: "Double",
  split: "Split",
};

const actionStyle: Record<PlayerAction, string> = {
  hit: "bg-primary text-primary-foreground hover:bg-primary/90",
  stand: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
  double: "bg-game-gold/90 text-background hover:bg-game-gold",
  split: "bg-accent text-accent-foreground hover:bg-accent/90",
};

const BlackjackTable = ({
  gameState,
  myBJPlayer,
  availableActions,
  isHost,
  myBet,
  setMyBet,
  onAction,
  onStartRound,
  onNextRound,
  onLeave,
}: Props) => {
  const { phase, dealer, players, roundNumber } = gameState;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border/30 px-4 py-3 flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={onLeave} className="gap-2 text-muted-foreground">
          <ArrowLeft className="h-4 w-4" />
          Leave
        </Button>
        <span className="font-display text-xs tracking-widest text-muted-foreground">
          BLACKJACK • ROUND {roundNumber}
        </span>
        {myBJPlayer && (
          <div className="flex items-center gap-1.5 text-game-gold font-display text-sm">
            <Coins className="h-4 w-4" />
            ${myBJPlayer.chips}
          </div>
        )}
      </header>

      {/* Table */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-6 gap-8">
        {/* Dealer */}
        {dealer.length > 0 && (
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
            <HandDisplay cards={dealer} label="Dealer" />
          </motion.div>
        )}

        {/* Felt divider */}
        <div className="w-full max-w-lg border-t border-dashed border-border/30" />

        {/* Players */}
        <div className="flex flex-wrap justify-center gap-6">
          {players.map((p) => (
            <div key={p.playerId} className="flex flex-col items-center gap-1">
              {p.hands.map((hand, hi) => (
                <HandDisplay
                  key={hi}
                  cards={hand.cards}
                  label={p.name}
                  result={hand.result}
                  bet={hand.bet}
                  active={
                    phase === "player_turns" &&
                    gameState.activePlayerIndex === players.indexOf(p) &&
                    p.activeHandIndex === hi
                  }
                  compact={players.length > 3}
                />
              ))}
            </div>
          ))}
        </div>

        {/* Controls */}
        <div className="w-full max-w-sm space-y-4">
          {phase === "betting" && isHost && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
              <div className="flex items-center justify-center gap-3">
                {[25, 50, 100, 200].map((amt) => (
                  <button
                    key={amt}
                    onClick={() => setMyBet(amt)}
                    className={`w-12 h-12 rounded-full font-display text-xs font-bold border-2 transition-all ${
                      myBet === amt
                        ? "border-game-gold bg-game-gold/20 text-game-gold scale-110"
                        : "border-border bg-secondary text-muted-foreground hover:border-game-gold/50"
                    }`}
                  >
                    ${amt}
                  </button>
                ))}
              </div>
              <Button onClick={onStartRound} className="w-full font-display tracking-wider">
                Deal Cards
              </Button>
            </motion.div>
          )}

          {phase === "player_turns" && availableActions.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex gap-2 justify-center">
              {availableActions.map((a) => (
                <Button
                  key={a}
                  onClick={() => onAction(a)}
                  className={`font-display text-sm tracking-wider px-6 ${actionStyle[a]}`}
                >
                  {actionLabel[a]}
                </Button>
              ))}
            </motion.div>
          )}

          {phase === "player_turns" && availableActions.length === 0 && myBJPlayer && (
            <p className="text-center text-muted-foreground text-sm font-display tracking-wider">
              Waiting for other players...
            </p>
          )}

          {phase === "results" && isHost && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <Button onClick={onNextRound} className="w-full gap-2 font-display tracking-wider">
                <RotateCcw className="h-4 w-4" />
                Next Round
              </Button>
            </motion.div>
          )}

          {phase === "results" && !isHost && (
            <p className="text-center text-muted-foreground text-sm font-display tracking-wider">
              Waiting for host to start next round...
            </p>
          )}
        </div>
      </main>
    </div>
  );
};

export default BlackjackTable;
