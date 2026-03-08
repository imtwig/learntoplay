import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Crown, ChevronDown, ChevronUp, UserX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { PokerGameState, PokerAction } from "@/lib/poker";
import type { PokerPlayer } from "@/lib/poker";
import { parsePokerCardDisplay } from "@/lib/poker";
import type { Player } from "@/hooks/useRoom";

interface Props {
  gameState: PokerGameState;
  myPokerPlayer: PokerPlayer | undefined;
  availableActions: { action: PokerAction; minAmount?: number; maxAmount?: number }[];
  isHost: boolean;
  isMyTurn: boolean;
  raiseAmount: string;
  setRaiseAmount: (v: string) => void;
  onAction: (action: PokerAction, raiseTo?: number) => void;
  onDeal: () => void;
  onNextHand: () => void;
  onLeave: () => void;
  onKickPlayer: (playerId: string) => void;
  players: Player[];
  myPlayerId: string | undefined;
}

const PokerCard = ({ card, small = false }: { card: string; small?: boolean }) => {
  const { rank, suitSymbol, suitColor } = parsePokerCardDisplay(card);
  const isHidden = card === "HIDDEN";
  return (
    <div
      className={`
        ${small ? "w-10 h-14" : "w-12 h-16"} rounded-lg border-2 flex flex-col items-center justify-center
        ${isHidden ? "bg-primary/20 border-primary/30" : "bg-white border-border/50"}
      `}
    >
      {isHidden ? (
        <span className="text-primary/50 text-lg">?</span>
      ) : (
        <>
          <span
            className={`font-display font-bold ${small ? "text-xs" : "text-sm"} leading-none`}
            style={{ color: suitColor === "red" ? "#dc2626" : "#000000" }}
          >
            {rank}
          </span>
          <span
            className={`${small ? "text-[8px]" : "text-xs"} leading-none`}
            style={{ color: suitColor === "red" ? "#dc2626" : "#000000" }}
          >
            {suitSymbol}
          </span>
        </>
      )}
    </div>
  );
};

const PHASE_LABELS: Record<string, string> = {
  waiting: "WAITING",
  pre_flop: "PRE-FLOP",
  flop: "FLOP",
  turn: "TURN",
  river: "RIVER",
  showdown: "SHOWDOWN",
  hand_over: "HAND OVER",
};

const PokerTable = ({
  gameState,
  myPokerPlayer,
  availableActions,
  isHost,
  isMyTurn,
  raiseAmount,
  setRaiseAmount,
  onAction,
  onDeal,
  onNextHand,
  onLeave,
  players,
  myPlayerId,
}: Props) => {
  const { phase, communityCards, pot, handNumber, winners, message, smallBlind, bigBlind, dealerIndex } = gameState;
  const pokerPlayers = gameState.players;
  const [showPlayers, setShowPlayers] = useState(false);

  const raiseAction = availableActions.find((a) => a.action === "raise");
  const callAction = availableActions.find((a) => a.action === "call");
  const canCheck = availableActions.some((a) => a.action === "check");
  const canFold = availableActions.some((a) => a.action === "fold");
  const canAllIn = availableActions.some((a) => a.action === "all_in");

  const otherPlayers = pokerPlayers.filter((p) => p.playerId !== myPlayerId);
  const isGameOver = phase === "hand_over" && pokerPlayers.filter((p) => p.chips > 0).length <= 1;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border/30 px-3 py-2 flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={onLeave} className="gap-1 text-muted-foreground text-xs">
          <ArrowLeft className="h-3.5 w-3.5" />
          Leave
        </Button>
        <div className="flex items-center gap-2">
          <span className="font-display text-[10px] tracking-widest text-muted-foreground">
            POKER • HAND {handNumber}
          </span>
          <span className="text-[9px] font-display tracking-wider px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">
            {PHASE_LABELS[phase] || phase}
          </span>
        </div>
        <span className="text-[10px] font-display text-muted-foreground">
          Blinds ${smallBlind}/${bigBlind}
        </span>
      </header>

      {/* Player chips overview */}
      <button
        onClick={() => setShowPlayers(!showPlayers)}
        className="border-b border-border/30 px-3 py-2 flex items-center justify-between hover:bg-card/50 transition-colors"
      >
        <span className="text-[10px] font-display tracking-widest text-muted-foreground">
          PLAYERS ({pokerPlayers.filter((p) => !p.eliminated).length})
        </span>
        {showPlayers ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
      </button>

      <AnimatePresence>
        {showPlayers && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-b border-border/30"
          >
            <div className="px-3 py-2 space-y-1">
              {pokerPlayers.map((p, i) => (
                <div
                  key={p.playerId}
                  className={`flex items-center justify-between px-2 py-1.5 rounded text-xs ${
                    p.playerId === myPlayerId ? "bg-primary/5 border border-primary/20" : "bg-card/30"
                  } ${p.eliminated ? "opacity-40" : ""} ${p.folded ? "opacity-60" : ""}`}
                >
                  <div className="flex items-center gap-1.5">
                    {i === dealerIndex && <span className="text-game-gold text-[9px] font-bold">D</span>}
                    <span className="font-medium">{p.name}</span>
                    {p.playerId === myPlayerId && <span className="text-primary text-[9px]">(You)</span>}
                    {p.folded && <span className="text-muted-foreground text-[9px]">Folded</span>}
                    {p.allIn && <span className="text-game-gold text-[9px] font-bold">ALL-IN</span>}
                    {p.eliminated && <span className="text-destructive text-[9px]">Out</span>}
                  </div>
                  <span className="font-display text-game-gold">${p.chips}</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main game area */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-4 gap-4">

        {/* Waiting phase */}
        {phase === "waiting" && (
          <div className="text-center space-y-4">
            <p className="text-muted-foreground font-display text-sm tracking-wider">
              {handNumber === 0 ? "Ready to start?" : "Hand complete"}
            </p>
            <Button onClick={onDeal} className="font-display tracking-wider">
              {handNumber === 0 ? "Deal First Hand" : "Deal Next Hand"}
            </Button>
          </div>
        )}

        {/* Hand over phase */}
        {phase === "hand_over" && (
          <div className="text-center space-y-3">
            {/* Show community cards */}
            {communityCards.length > 0 && (
              <div className="flex gap-1.5 justify-center mb-3">
                {communityCards.map((card, i) => (
                  <PokerCard key={i} card={card} />
                ))}
              </div>
            )}

            {/* Show all hands */}
            <div className="space-y-2 w-full max-w-sm">
              {pokerPlayers.filter((p) => !p.eliminated && !p.folded && p.holeCards.length > 0).map((p) => (
                <div key={p.playerId} className={`flex items-center justify-between px-3 py-2 rounded-lg border ${
                  winners?.some((w) => w.playerId === p.playerId)
                    ? "border-game-gold/50 bg-game-gold/10"
                    : "border-border/30 bg-card/30"
                }`}>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium">{p.name}</span>
                    <div className="flex gap-0.5">
                      {p.holeCards.map((c, i) => <PokerCard key={i} card={c} small />)}
                    </div>
                  </div>
                  <span className="text-xs font-display text-game-gold">${p.chips}</span>
                </div>
              ))}
            </div>

            {/* Winner message */}
            {message && (
              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-sm font-display text-primary tracking-wider"
              >
                {message}
              </motion.p>
            )}

            {/* Pot info */}
            <p className="text-xs text-muted-foreground font-display">Pot: ${pot}</p>

            {!isGameOver && (
              <Button onClick={onNextHand} className="font-display tracking-wider">
                Next Hand
              </Button>
            )}
            {isGameOver && (
              <div className="space-y-2">
                <p className="text-lg font-display font-bold text-primary tracking-wider">GAME OVER</p>
                <Button variant="outline" onClick={onLeave} className="font-display tracking-wider">
                  Leave Table
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Active gameplay phases */}
        {(phase === "pre_flop" || phase === "flop" || phase === "turn" || phase === "river" || phase === "showdown") && (
          <>
            {/* Other players */}
            <div className="flex flex-wrap justify-center gap-3 w-full max-w-lg">
              {otherPlayers.filter((p) => !p.eliminated).map((p, i) => {
                const isCurrent = gameState.currentPlayerIndex === pokerPlayers.indexOf(p);
                const isDealer = pokerPlayers.indexOf(p) === dealerIndex;
                return (
                  <motion.div
                    key={p.playerId}
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className={`flex flex-col items-center gap-1 p-2 rounded-lg border transition-all ${
                      isCurrent ? "border-primary/50 bg-primary/5" : "border-border/20 bg-card/30"
                    } ${p.folded ? "opacity-40" : ""}`}
                  >
                    <div className="flex items-center gap-1">
                      {isDealer && <span className="text-game-gold text-[9px] font-bold bg-game-gold/20 rounded px-1">D</span>}
                      <span className="text-[10px] font-medium">{p.name}</span>
                    </div>
                    <div className="flex gap-0.5">
                      {p.holeCards.map((c, ci) => <PokerCard key={ci} card={c} small />)}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-display text-game-gold">${p.chips}</span>
                      {p.currentBet > 0 && (
                        <span className="text-[9px] font-display text-primary">Bet ${p.currentBet}</span>
                      )}
                    </div>
                    {p.lastAction && (
                      <span className="text-[8px] font-display text-muted-foreground">{p.lastAction}</span>
                    )}
                    {p.allIn && <span className="text-[8px] font-display text-game-gold font-bold">ALL-IN</span>}
                    {p.folded && <span className="text-[8px] font-display text-muted-foreground">Folded</span>}
                  </motion.div>
                );
              })}
            </div>

            {/* Pot */}
            <div className="text-center">
              <span className="text-xs font-display text-muted-foreground tracking-wider">POT</span>
              <p className="text-xl font-display font-bold text-game-gold">${pot}</p>
            </div>

            {/* Community cards */}
            <div className="flex gap-1.5 justify-center min-h-[64px]">
              {communityCards.length > 0 ? (
                communityCards.map((card, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: -10, rotateY: 90 }}
                    animate={{ opacity: 1, y: 0, rotateY: 0 }}
                    transition={{ delay: i * 0.1 }}
                  >
                    <PokerCard card={card} />
                  </motion.div>
                ))
              ) : (
                <div className="flex gap-1.5">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="w-12 h-16 rounded-lg border-2 border-dashed border-border/30" />
                  ))}
                </div>
              )}
            </div>

            {/* My hand */}
            {myPokerPlayer && !myPokerPlayer.eliminated && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col items-center gap-2"
              >
                <div className="flex gap-2">
                  {myPokerPlayer.holeCards.map((card, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2 + i * 0.1 }}
                    >
                      <PokerCard card={card} />
                    </motion.div>
                  ))}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-medium">
                    {myPokerPlayer.name} (You)
                    {pokerPlayers.indexOf(myPokerPlayer) === dealerIndex && (
                      <span className="ml-1 text-game-gold text-[9px] font-bold">D</span>
                    )}
                  </span>
                  <span className="text-xs font-display text-game-gold">${myPokerPlayer.chips}</span>
                  {myPokerPlayer.currentBet > 0 && (
                    <span className="text-xs font-display text-primary">Bet ${myPokerPlayer.currentBet}</span>
                  )}
                </div>
                {myPokerPlayer.folded && (
                  <span className="text-xs font-display text-muted-foreground">Folded</span>
                )}
                {myPokerPlayer.allIn && (
                  <span className="text-xs font-display text-game-gold font-bold">ALL-IN</span>
                )}
              </motion.div>
            )}

            {/* Turn indicator */}
            <AnimatePresence mode="wait">
              <motion.div
                key={isMyTurn ? "my" : "other"}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-center"
              >
                {isMyTurn ? (
                  <motion.p
                    className="text-sm font-display tracking-wider font-bold text-primary"
                    animate={{ scale: [1, 1.1, 1] }}
                    transition={{ duration: 0.5 }}
                  >
                    🎯 YOUR TURN
                  </motion.p>
                ) : (
                  <p className="text-[10px] font-display tracking-wider text-muted-foreground">
                    {pokerPlayers[gameState.currentPlayerIndex]?.name}'s turn
                  </p>
                )}
              </motion.div>
            </AnimatePresence>

            {/* Action buttons */}
            {isMyTurn && availableActions.length > 0 && !myPokerPlayer?.folded && !myPokerPlayer?.allIn && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-sm space-y-3"
              >
                <div className="flex gap-2 justify-center flex-wrap">
                  {canFold && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onAction("fold")}
                      className="font-display text-xs tracking-wider text-destructive border-destructive/30"
                    >
                      Fold
                    </Button>
                  )}
                  {canCheck && (
                    <Button
                      size="sm"
                      onClick={() => onAction("check")}
                      className="font-display text-xs tracking-wider"
                    >
                      Check
                    </Button>
                  )}
                  {callAction && (
                    <Button
                      size="sm"
                      onClick={() => onAction("call")}
                      className="font-display text-xs tracking-wider"
                    >
                      Call ${callAction.minAmount}
                    </Button>
                  )}
                  {canAllIn && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onAction("all_in")}
                      className="font-display text-xs tracking-wider text-game-gold border-game-gold/30"
                    >
                      All-In ${myPokerPlayer?.chips}
                    </Button>
                  )}
                </div>

                {/* Raise controls */}
                {raiseAction && (
                  <div className="flex items-center gap-2 justify-center">
                    <Input
                      type="number"
                      min={raiseAction.minAmount}
                      max={raiseAction.maxAmount}
                      placeholder={`Raise to $${raiseAction.minAmount}`}
                      value={raiseAmount}
                      onChange={(e) => setRaiseAmount(e.target.value)}
                      className="w-32 text-center font-display text-sm h-8"
                    />
                    <Button
                      size="sm"
                      onClick={() => {
                        const amt = parseInt(raiseAmount) || raiseAction.minAmount!;
                        onAction("raise", amt);
                      }}
                      disabled={!raiseAmount || parseInt(raiseAmount) < (raiseAction.minAmount ?? 0)}
                      className="font-display text-xs tracking-wider"
                    >
                      Raise
                    </Button>
                  </div>
                )}
              </motion.div>
            )}
          </>
        )}
      </main>
    </div>
  );
};

export default PokerTable;
