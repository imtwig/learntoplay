import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, RotateCcw, TrendingUp, TrendingDown, Minus, Crown, Eye, Check, X, Settings, ChevronDown, ChevronUp, UserX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import HandDisplay from "./HandDisplay";
import LeaderboardButton from "./LeaderboardButton";
import RoundResultOverlay from "./RoundResultOverlay";
import type { BJGameState, PlayerAction, BJSettings } from "@/lib/blackjack";
import type { BJPlayerState } from "@/lib/blackjack";
import type { Player } from "@/hooks/useRoom";
import { Switch } from "@/components/ui/switch";

interface Props {
  gameState: BJGameState;
  rawSettings: BJSettings | undefined;
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
  onKickPlayer: (playerId: string) => void;
  onToggleShowFirstCard: () => void;
  players: Player[];
  myPlayerId: string | undefined;
}

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

const BlackjackTable = ({
  gameState,
  rawSettings,
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
  onKickPlayer,
  onToggleShowFirstCard,
  players,
  myPlayerId,
}: Props) => {
  const { phase, players: bjPlayers, roundNumber, revealedPlayerIds = [] } = gameState;
  const allReady = bjPlayers.every((p) => p.ready);
  const iAmReady = myBJPlayer?.ready ?? false;
  const iAmDealer = myBJPlayer?.isDealer ?? false;

  const [showTransfer, setShowTransfer] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showResultOverlay, setShowResultOverlay] = useState(false);
  const [showAllWinnings, setShowAllWinnings] = useState(false);
  const [prevPhase, setPrevPhase] = useState(phase);

  // Show result overlay when phase transitions to "results" (skip for dealer)
  useEffect(() => {
    if (phase === "results" && prevPhase !== "results" && !iAmDealer) {
      setShowResultOverlay(true);
      const timer = setTimeout(() => setShowResultOverlay(false), 4000);
      return () => clearTimeout(timer);
    }
    setPrevPhase(phase);
  }, [phase, prevPhase, iAmDealer]);

  const dealerPlayer = bjPlayers.find((p) => p.isDealer);
  const nonDealerPlayers = bjPlayers.filter((p) => !p.isDealer);
  const unrevealed = nonDealerPlayers.filter((p) => !(revealedPlayerIds || []).includes(p.playerId));

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
          {isHost && (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setShowSettings(!showSettings); setShowTransfer(false); }}
                className="text-muted-foreground"
                title="Game settings"
              >
                <Settings className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setShowTransfer(!showTransfer); setShowSettings(false); }}
                className="text-game-gold"
                title="Transfer host"
              >
                <Crown className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      </header>

      {/* Overall winnings display */}
      {myBJPlayer && (
        <div className="border-b border-border/30 bg-card/50">
          <button
            onClick={() => setShowAllWinnings(!showAllWinnings)}
            className="w-full px-4 py-3 flex items-center justify-between hover:bg-card/70 transition-colors"
          >
            <div className="flex items-center gap-2">
              <span className="text-xs font-display text-muted-foreground tracking-wider">YOUR OVERALL WINNINGS</span>
              <ProfitDisplay profit={myBJPlayer.netProfit} />
            </div>
            {showAllWinnings ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </button>
          
          <AnimatePresence>
            {showAllWinnings && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden border-t border-border/30"
              >
                <div className="px-4 py-3 space-y-2">
                  <p className="text-xs font-display text-muted-foreground tracking-wider mb-3">ALL PLAYERS</p>
                  {bjPlayers.map((p) => (
                    <div
                      key={p.playerId}
                      className={`flex items-center justify-between px-3 py-2 rounded-lg border ${
                        p.playerId === myPlayerId ? "border-primary/50 bg-primary/5" : "border-border/50 bg-card/50"
                      }`}
                    >
                      <span className="text-sm font-medium">
                        {p.name}
                        {p.playerId === myPlayerId && " (You)"}
                        {p.isDealer && (
                          <span className="ml-1 text-game-gold text-xs font-display">• Dealer</span>
                        )}
                      </span>
                      <ProfitDisplay profit={p.netProfit} />
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Settings panel */}
      {showSettings && isHost && (
        <div className="border-b border-border/30 px-4 py-3 bg-secondary/30">
          <p className="text-xs text-muted-foreground font-display mb-3 tracking-wider">GAME SETTINGS</p>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Show first card</p>
              <p className="text-xs text-muted-foreground">
                Everyone can see each other's first card
                {rawSettings && rawSettings.showFirstCard !== rawSettings.showFirstCardNextRound && (
                  <span className="text-primary ml-1">(changes next round)</span>
                )}
              </p>
            </div>
            <Switch
              checked={rawSettings?.showFirstCardNextRound ?? false}
              onCheckedChange={onToggleShowFirstCard}
            />
          </div>
        </div>
      )}

      {/* Host transfer dropdown */}
      {showTransfer && isHost && (
        <div className="border-b border-border/30 px-4 py-2 bg-secondary/30">
          <p className="text-xs text-muted-foreground font-display mb-2">Transfer host to:</p>
          <div className="flex gap-2 flex-wrap">
            {players.filter((p) => p.id !== myPlayerId).map((p) => (
              <div key={p.id} className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { onTransferHost(p.id); setShowTransfer(false); }}
                  className="text-xs"
                >
                  {p.display_name}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onKickPlayer(p.id)}
                  className="text-destructive h-7 w-7 p-0"
                >
                  <UserX className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Table */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-6 gap-8">

        {/* Betting phase */}
        {phase === "betting" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="w-full max-w-sm space-y-6">
            {/* Bet input — not for dealer */}
            {!iAmDealer ? (
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
                    Confirm Bet
                  </Button>
                ) : (
                  <Button
                    onClick={onMarkUnready}
                    variant="outline"
                    className="w-full gap-2 font-display tracking-wider"
                  >
                    <X className="h-4 w-4" />
                    Change Bet
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-center text-sm font-display text-muted-foreground">
                  You are the <span className="text-game-gold">Dealer</span>
                </p>
                {!iAmReady ? (
                  <Button
                    onClick={onMarkReady}
                    className="w-full gap-2 font-display tracking-wider"
                  >
                    <Check className="h-4 w-4" />
                    Ready to Deal
                  </Button>
                ) : (
                  <Button
                    onClick={onMarkUnready}
                    variant="outline"
                    className="w-full gap-2 font-display tracking-wider"
                  >
                    <X className="h-4 w-4" />
                    Not Ready
                  </Button>
                )}
              </div>
            )}

            {/* Player bet status */}
            <div className="space-y-2">
              <p className="text-xs font-display text-muted-foreground tracking-wider text-center">BETS</p>
              {bjPlayers.map((p) => (
                <div
                  key={p.playerId}
                  className={`flex items-center justify-between px-3 py-2 rounded-lg border ${
                    p.ready ? "border-primary/50 bg-primary/5" : "border-border/50 bg-card/50"
                  }`}
                >
                  <span className="text-sm font-medium">
                    {p.name}
                    {p.playerId === myPlayerId && " (You)"}
                    {p.isDealer && (
                      <span className="ml-1 text-game-gold text-xs font-display">• Dealer</span>
                    )}
                  </span>
                  <div className="flex items-center gap-2">
                    {p.ready && !p.isDealer && p.currentBet > 0 && (
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

            {allReady && (
              <Button onClick={onStartRound} className="w-full gap-2 font-display tracking-wider">
                Deal Cards
              </Button>
            )}
          </motion.div>
        )}

        {/* Dealing animation */}
        {phase === "dealing" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center">
            <p className="text-muted-foreground font-display tracking-wider animate-pulse">
              Dealing cards...
            </p>
          </motion.div>
        )}

        {/* Active game phases */}
        {(phase === "player_turns" || phase === "results" || phase === "dealer_turn") && (
          <>
            {/* Dealer's hand at the top */}
            {dealerPlayer && dealerPlayer.hands.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col items-center gap-2"
              >
                {dealerPlayer.hands.map((hand, hi) => (
                  <HandDisplay
                    key={hi}
                    cards={hand.cards}
                    label={`${dealerPlayer.name} (Dealer)${dealerPlayer.playerId === myPlayerId ? " — You" : ""}`}
                    result={phase === "results" ? hand.result : undefined}
                    active={phase === "dealer_turn" && dealerPlayer.playerId === myPlayerId}
                  />
                ))}
                <ProfitDisplay profit={dealerPlayer.roundProfit} />
              </motion.div>
            )}

            <div className="w-full max-w-lg border-t border-dashed border-border/30" />

            {/* My hand (if not dealer — dealer shown above) */}
            {myBJPlayer && !iAmDealer && myBJPlayer.hands.length > 0 && (
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
                      gameState.activePlayerIndex === bjPlayers.indexOf(myBJPlayer) &&
                      myBJPlayer.activeHandIndex === hi
                    }
                  />
                ))}
                <ProfitDisplay profit={myBJPlayer.roundProfit} />
              </motion.div>
            )}

            {/* Other players (non-dealer, non-me) */}
            {nonDealerPlayers.filter((p) => p.playerId !== myPlayerId).length > 0 && (
              <div className="flex flex-wrap justify-center gap-4">
                {nonDealerPlayers.filter((p) => p.playerId !== myPlayerId).map((p) => (
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
                      <ProfitDisplay profit={p.roundProfit} />
                    )}
                  </motion.div>
                ))}
              </div>
            )}
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
              {iAmDealer ? "Waiting for players to finish..." : "Waiting for your turn..."}
            </p>
          )}

          {/* Dealer turn: draw/done + reveal controls combined */}
          {phase === "dealer_turn" && iAmDealer && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
              {/* Draw/Done buttons */}
              {availableActions.length > 0 && (
                <div className="space-y-2">
                  <p className="text-center text-xs font-display text-game-gold tracking-wider">YOUR TURN (DEALER)</p>
                  <div className="flex gap-3 justify-center">
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
                  </div>
                </div>
              )}

              {/* Reveal controls */}
              {unrevealed.length > 0 && (
                <div className="space-y-2">
                  <p className="text-center text-xs font-display text-muted-foreground tracking-wider">REVEAL HANDS</p>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {unrevealed.map((p) => (
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
                </div>
              )}
            </motion.div>
          )}

          {phase === "dealer_turn" && !iAmDealer && (
            <p className="text-center text-muted-foreground text-sm font-display tracking-wider">
              Dealer is playing...
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
              Waiting for dealer to start next round...
            </p>
          )}
        </div>
      </main>
      <RoundResultOverlay
        roundProfit={myBJPlayer?.roundProfit ?? 0}
        visible={showResultOverlay}
      />
    </div>
  );
};

export default BlackjackTable;
