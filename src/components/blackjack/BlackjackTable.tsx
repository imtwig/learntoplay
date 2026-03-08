import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, RotateCcw, TrendingUp, TrendingDown, Minus, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import HandDisplay from "./HandDisplay";
import type { BJGameState, PlayerAction } from "@/lib/blackjack";
import type { BJPlayerState } from "@/lib/blackjack";
import type { Player } from "@/hooks/useRoom";

interface Props {
  gameState: BJGameState;
  myBJPlayer: BJPlayerState | undefined;
  availableActions: PlayerAction[];
  isHost: boolean;
  myBet: number;
  setMyBet: (v: number) => void;
  onAction: (a: PlayerAction) => void;
  onStartRound: (allBets: Record<string, number>) => void;
  onNextRound: () => void;
  onLeave: () => void;
  onTransferHost: (playerId: string) => void;
  players: Player[];
  myPlayerId: string | undefined;
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
  onTransferHost,
  players,
  myPlayerId,
}: Props) => {
  const { phase, dealer, players: bjPlayers, roundNumber } = gameState;
  const [showTransfer, setShowTransfer] = useState(false);

  const handleDeal = () => {
    // Collect bets: use myBet for current player, 0 for others (they set their own via sync)
    // For now, all players use the host's bet amount as default
    const bets: Record<string, number> = {};
    for (const p of bjPlayers) {
      bets[p.playerId] = p.playerId === myPlayerId ? myBet : myBet;
    }
    onStartRound(bets);
  };

  const ProfitDisplay = ({ profit }: { profit: number }) => {
    if (profit > 0) return (
      <span className="flex items-center gap-1 text-primary font-display text-sm">
        <TrendingUp className="h-3.5 w-3.5" />+${profit}
      </span>
    );
    if (profit < 0) return (
      <span className="flex items-center gap-1 text-destructive font-display text-sm">
        <TrendingDown className="h-3.5 w-3.5" />${profit}
      </span>
    );
    return (
      <span className="flex items-center gap-1 text-muted-foreground font-display text-sm">
        <Minus className="h-3.5 w-3.5" />$0
      </span>
    );
  };

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
        <div className="flex items-center gap-3">
          {myBJPlayer && <ProfitDisplay profit={myBJPlayer.netProfit} />}
          {isHost && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowTransfer(!showTransfer)}
              className="text-game-gold"
              title="Transfer host"
            >
              <Crown className="h-4 w-4" />
            </Button>
          )}
        </div>
      </header>

      {/* Host transfer dropdown */}
      {showTransfer && isHost && (
        <div className="border-b border-border/30 px-4 py-2 bg-secondary/30">
          <p className="text-xs text-muted-foreground font-display mb-2">Transfer host to:</p>
          <div className="flex gap-2 flex-wrap">
            {players.filter((p) => p.id !== myPlayerId).map((p) => (
              <Button
                key={p.id}
                variant="outline"
                size="sm"
                onClick={() => { onTransferHost(p.id); setShowTransfer(false); }}
                className="text-xs"
              >
                {p.display_name}
              </Button>
            ))}
          </div>
        </div>
      )}

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
          {bjPlayers.map((p) => (
            <div key={p.playerId} className="flex flex-col items-center gap-1">
              {p.hands.map((hand, hi) => (
                <HandDisplay
                  key={hi}
                  cards={hand.cards}
                  label={p.playerId === myPlayerId ? `${p.name} (You)` : p.name}
                  result={hand.result}
                  bet={hand.bet}
                  active={
                    phase === "player_turns" &&
                    gameState.activePlayerIndex === bjPlayers.indexOf(p) &&
                    p.activeHandIndex === hi
                  }
                  compact={bjPlayers.length > 3}
                />
              ))}
              <ProfitDisplay profit={p.netProfit} />
            </div>
          ))}
        </div>

        {/* Controls */}
        <div className="w-full max-w-sm space-y-4">
          {phase === "betting" && isHost && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
              <div className="flex items-center gap-3 justify-center">
                <label className="text-sm font-display text-muted-foreground">Bet $</label>
                <Input
                  type="number"
                  min={0}
                  value={myBet}
                  onChange={(e) => setMyBet(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-28 text-center font-display"
                />
              </div>
              <Button onClick={handleDeal} className="w-full font-display tracking-wider">
                Deal Cards
              </Button>
            </motion.div>
          )}

          {phase === "betting" && !isHost && (
            <p className="text-center text-muted-foreground text-sm font-display tracking-wider">
              Waiting for host to deal...
            </p>
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
