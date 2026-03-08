import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, RotateCcw, TrendingUp, TrendingDown, Minus, Crown, Eye, EyeOff, Check, X } from "lucide-react";
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
  myBetInput: string;
  setMyBetInput: (v: string) => void;
  onAction: (a: PlayerAction) => void;
  onMarkReady: () => void;
  onMarkUnready: () => void;
  onStartRound: () => void;
  onNextRound: () => void;
  onRevealPlayer: (playerId: string) => void;
  onRevealAll: () => void;
  onLeave: () => void;
  onTransferHost: (playerId: string) => void;
  players: Player[];
  myPlayerId: string | undefined;
}

const BlackjackTable = ({
  gameState,
  myBJPlayer,
  availableActions,
  isHost,
  myBetInput,
  setMyBetInput,
  onAction,
  onMarkReady,
  onMarkUnready,
  onStartRound,
  onNextRound,
  onRevealPlayer,
  onRevealAll,
  onLeave,
  onTransferHost,
  players,
  myPlayerId,
}: Props) => {
  const { phase, dealer, players: bjPlayers, roundNumber, revealedPlayerIds } = gameState;
  const [showTransfer, setShowTransfer] = useState(false);

  const allReady = bjPlayers.every((p) => p.ready);
  const iAmReady = myBJPlayer?.ready ?? false;

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
        {dealer.length > 0 && (
          <div className="w-full max-w-lg border-t border-dashed border-border/30" />
        )}

        {/* Betting phase */}
        {phase === "betting" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="w-full max-w-sm space-y-6">
            {/* My bet input */}
            <div className="space-y-3">
              <div className="flex items-center gap-3 justify-center">
                <label className="text-sm font-display text-muted-foreground">Your Bet $</label>
                <Input
                  type="number"
                  min={0}
                  placeholder="Enter bet"
                  value={myBetInput}
                  onChange={(e) => setMyBetInput(e.target.value)}
                  className="w-28 text-center font-display"
                  disabled={iAmReady}
                />
              </div>
              {!iAmReady ? (
                <Button
                  onClick={onMarkReady}
                  className="w-full gap-2 font-display tracking-wider"
                  disabled={!myBetInput || parseInt(myBetInput) <= 0}
                >
                  <Check className="h-4 w-4" />
                  Ready
                </Button>
              ) : (
                <Button
                  onClick={onMarkUnready}
                  variant="outline"
                  className="w-full gap-2 font-display tracking-wider"
                >
                  <X className="h-4 w-4" />
                  Unready
                </Button>
              )}
            </div>

            {/* Player ready status */}
            <div className="space-y-2">
              <p className="text-xs font-display text-muted-foreground tracking-wider text-center">PLAYERS</p>
              {bjPlayers.map((p) => (
                <div
                  key={p.playerId}
                  className={`flex items-center justify-between px-3 py-2 rounded-lg border ${
                    p.ready ? "border-primary/50 bg-primary/5" : "border-border/50 bg-card/50"
                  }`}
                >
                  <span className="text-sm font-medium">
                    {p.name}{p.playerId === myPlayerId && " (You)"}
                  </span>
                  <div className="flex items-center gap-2">
                    {p.ready && p.currentBet > 0 && (
                      <span className="text-xs text-game-gold font-display">${p.currentBet}</span>
                    )}
                    {p.ready ? (
                      <Check className="h-4 w-4 text-primary" />
                    ) : (
                      <span className="text-xs text-muted-foreground">waiting...</span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Start button — anyone can press when all ready */}
            {allReady && (
              <Button
                onClick={onStartRound}
                className="w-full gap-2 font-display tracking-wider"
              >
                Deal Cards
              </Button>
            )}
          </motion.div>
        )}

        {/* Dealing animation */}
        {phase === "dealing" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center"
          >
            <p className="text-muted-foreground font-display tracking-wider animate-pulse">
              Dealing cards...
            </p>
          </motion.div>
        )}

        {/* Player turns / reveal / results — show hands */}
        {(phase === "player_turns" || phase === "reveal" || phase === "results" || phase === "dealer_turn") && (
          <>
            {/* My hand */}
            {myBJPlayer && myBJPlayer.hands.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col items-center gap-2"
              >
                {myBJPlayer.hands.map((hand, hi) => (
                  <HandDisplay
                    key={hi}
                    cards={hand.cards}
                    label={`${myBJPlayer.name} (You)`}
                    result={hand.result}
                    bet={hand.bet}
                    active={
                      phase === "player_turns" &&
                      gameState.activePlayerIndex === bjPlayers.findIndex((p) => p.playerId === myPlayerId) &&
                      myBJPlayer.activeHandIndex === hi
                    }
                  />
                ))}
                <ProfitDisplay profit={myBJPlayer.netProfit} />
              </motion.div>
            )}

            {/* Other players — only show face-up card(s) or revealed hands */}
            <div className="flex flex-wrap justify-center gap-4">
              {bjPlayers.filter((p) => p.playerId !== myPlayerId).map((p) => (
                <motion.div
                  key={p.playerId}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex flex-col items-center gap-1"
                >
                  {p.hands.map((hand, hi) => (
                    <HandDisplay
                      key={hi}
                      cards={hand.cards}
                      label={p.name}
                      result={hand.revealed ? hand.result : undefined}
                      bet={hand.bet}
                      compact
                    />
                  ))}
                  {(phase === "results" || phase === "dealer_turn") && (
                    <ProfitDisplay profit={p.netProfit} />
                  )}
                </motion.div>
              ))}
            </div>
          </>
        )}

        {/* Controls */}
        <div className="w-full max-w-sm space-y-4">
          {/* Player turn actions: Draw / Done */}
          {phase === "player_turns" && availableActions.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex gap-3 justify-center">
              <Button
                onClick={() => onAction("hit")}
                className="font-display text-sm tracking-wider px-8 bg-primary text-primary-foreground hover:bg-primary/90"
              >
                Draw
              </Button>
              <Button
                onClick={() => onAction("stand")}
                className="font-display text-sm tracking-wider px-8 bg-secondary text-secondary-foreground hover:bg-secondary/80"
              >
                Done
              </Button>
            </motion.div>
          )}

          {phase === "player_turns" && availableActions.length === 0 && myBJPlayer && (
            <p className="text-center text-muted-foreground text-sm font-display tracking-wider">
              Waiting for other players...
            </p>
          )}

          {/* Reveal phase — host controls */}
          {phase === "reveal" && isHost && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
              <p className="text-center text-xs font-display text-muted-foreground tracking-wider">
                REVEAL HANDS
              </p>
              <div className="flex flex-wrap gap-2 justify-center">
                {bjPlayers.filter((p) => p.playerId !== myPlayerId && !revealedPlayerIds.includes(p.playerId)).map((p) => (
                  <Button
                    key={p.playerId}
                    variant="outline"
                    size="sm"
                    onClick={() => onRevealPlayer(p.playerId)}
                    className="gap-1 text-xs"
                  >
                    <Eye className="h-3 w-3" />
                    {p.name}
                  </Button>
                ))}
              </div>
              <Button
                onClick={onRevealAll}
                className="w-full gap-2 font-display tracking-wider"
              >
                <Eye className="h-4 w-4" />
                Reveal All & Finish
              </Button>
            </motion.div>
          )}

          {phase === "reveal" && !isHost && (
            <p className="text-center text-muted-foreground text-sm font-display tracking-wider">
              Waiting for host to reveal hands...
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
