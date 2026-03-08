import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, ChevronDown, ChevronUp, Trophy, UserX } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { DDGameState, DDPlayer, PlayedCombination } from "@/lib/daiDi";
import { cardDisplay, detectCombination } from "@/lib/daiDi";
import type { Player } from "@/hooks/useRoom";

interface Props {
  gameState: DDGameState;
  myDDPlayer: DDPlayer | undefined;
  isHost: boolean;
  isMyTurn: boolean;
  canPass: boolean;
  selectedCards: number[];
  setSelectedCards: (cards: number[]) => void;
  onDeal: () => void;
  onPlay: (cardIndices: number[]) => void;
  onPass: () => void;
  onRematch: () => void;
  onLeave: () => void;
  players: Player[];
  myPlayerId: string | undefined;
}

const DDCard = ({ card, small = false, selected = false, onClick }: {
  card: string; small?: boolean; selected?: boolean; onClick?: () => void;
}) => {
  const { rank, suitSymbol, suitColor } = cardDisplay(card);
  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        ${small ? "w-9 h-13" : "w-11 h-[60px]"} rounded-lg border-2 flex flex-col items-center justify-center
        transition-all shrink-0
        ${selected ? "border-primary bg-primary/10 -translate-y-2 shadow-md" : "border-border/50 bg-white hover:border-primary/30"}
        ${onClick ? "cursor-pointer" : "cursor-default"}
      `}
    >
      <span
        className={`font-display font-bold ${small ? "text-[10px]" : "text-xs"} leading-none`}
        style={{ color: suitColor === "red" ? "#dc2626" : "#000000" }}
      >
        {rank}
      </span>
      <span
        className={`${small ? "text-[7px]" : "text-[10px]"} leading-none`}
        style={{ color: suitColor === "red" ? "#dc2626" : "#000000" }}
      >
        {suitSymbol}
      </span>
    </button>
  );
};

const COMBO_LABELS: Record<string, string> = {
  single: "Single",
  pair: "Pair",
  triple: "Triple",
  straight: "Straight",
  flush: "Flush",
  full_house: "Full House",
  four_kind: "Four of a Kind",
  straight_flush: "Straight Flush",
};

const DaiDiTable = ({
  gameState,
  myDDPlayer,
  isHost,
  isMyTurn,
  canPass,
  selectedCards,
  setSelectedCards,
  onDeal,
  onPlay,
  onPass,
  onRematch,
  onLeave,
  players,
  myPlayerId,
}: Props) => {
  const { phase, roundNumber, currentCombination, currentPlayerIndex, message, houseRules, penalties } = gameState;
  const ddPlayers = gameState.players;
  const [showPlayers, setShowPlayers] = useState(false);

  const otherPlayers = ddPlayers.filter((p) => p.playerId !== myPlayerId);

  const toggleCard = (idx: number) => {
    setSelectedCards(
      selectedCards.includes(idx)
        ? selectedCards.filter((i) => i !== idx)
        : [...selectedCards, idx]
    );
  };

  const selectedCombo = myDDPlayer && selectedCards.length > 0
    ? detectCombination(selectedCards.map((i) => myDDPlayer.hand[i]))
    : null;

  // Reject triples if house rule is off
  const comboValid = selectedCombo && (selectedCombo.type !== "triple" || houseRules.allowTriples);
  const canPlay = isMyTurn && comboValid;

  const activeBadges: string[] = [];
  if (houseRules.allowEndOn2) activeBadges.push("END ON 2");
  if (houseRules.allowTriples) activeBadges.push("TRIPLES");
  if (penalties.tenPlusCards) activeBadges.push("10+ ×2");
  if (penalties.thirteenCards) activeBadges.push("13 ×3");
  if (penalties.twosSurcharge) activeBadges.push("2s +2");

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
            DAI DI • RND {roundNumber}
          </span>
          <span className="text-[9px] font-display tracking-wider px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">
            {phase === "playing" ? "PLAYING" : phase === "round_end" ? "ROUND END" : "WAITING"}
          </span>
        </div>
        <div className="flex gap-1">
          {activeBadges.slice(0, 2).map((b) => (
            <span key={b} className="text-[7px] font-display tracking-wider text-game-gold bg-game-gold/10 px-1 py-0.5 rounded">
              {b}
            </span>
          ))}
        </div>
      </header>

      {/* Players panel */}
      <button
        onClick={() => setShowPlayers(!showPlayers)}
        className="border-b border-border/30 px-3 py-2 flex items-center justify-between hover:bg-card/50 transition-colors"
      >
        <span className="text-[10px] font-display tracking-widest text-muted-foreground">
          PLAYERS ({ddPlayers.length})
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
              {ddPlayers.map((p) => (
                <div
                  key={p.playerId}
                  className={`flex items-center justify-between px-2 py-1.5 rounded text-xs ${
                    p.playerId === myPlayerId ? "bg-primary/5 border border-primary/20" : "bg-card/30"
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium">{p.name}</span>
                    {p.playerId === myPlayerId && <span className="text-primary text-[9px]">(You)</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] text-muted-foreground">{p.cardCount} cards</span>
                    <span className="text-[9px] text-destructive">-{p.cumulativeScore}</span>
                    <span className="font-display text-game-gold">+{p.cumulativeEarnings}</span>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main game area */}
      <main className="flex-1 flex flex-col items-center justify-between px-4 py-3 gap-3 overflow-hidden">

        {/* Waiting phase */}
        {phase === "waiting" && (
          <div className="flex-1 flex flex-col items-center justify-center space-y-4">
            <p className="text-muted-foreground font-display text-sm tracking-wider">
              {roundNumber === 0 ? "Ready to deal?" : "Deal next round?"}
            </p>
            {isHost && (
              <Button onClick={onDeal} className="font-display tracking-wider">
                {roundNumber === 0 ? "Deal Cards" : "Deal Next Round"}
              </Button>
            )}
          </div>
        )}

        {/* Round end */}
        {phase === "round_end" && (
          <div className="flex-1 flex flex-col items-center justify-center space-y-4 w-full max-w-sm">
            <Trophy className="h-8 w-8 text-game-gold" />
            <h2 className="font-display font-bold text-lg tracking-wider">ROUND {roundNumber} COMPLETE</h2>

            <div className="w-full space-y-1.5">
              {[...ddPlayers]
                .sort((a, b) => {
                  if (a.finishOrder === 1) return -1;
                  if (b.finishOrder === 1) return 1;
                  return b.penaltyScore - a.penaltyScore;
                })
                .map((p) => (
                  <div key={p.playerId} className={`flex items-center justify-between px-3 py-2 rounded-lg border ${
                    p.finishOrder === 1 ? "border-game-gold/50 bg-game-gold/10" : "border-border/30 bg-card/30"
                  }`}>
                    <div className="flex items-center gap-2">
                      {p.finishOrder === 1 && <span className="text-game-gold text-xs">👑</span>}
                      <span className="text-xs font-medium">{p.name}</span>
                      {p.playerId === myPlayerId && <span className="text-primary text-[9px]">(You)</span>}
                    </div>
                    <div className="flex items-center gap-3">
                      {p.finishOrder === 1 ? (
                        <span className="text-xs font-display text-game-gold">+{p.cumulativeEarnings - (p.cumulativeEarnings - ddPlayers.filter((x) => x.finishOrder !== 1).reduce((sum, x) => sum + x.penaltyScore, 0))} earned</span>
                      ) : (
                        <>
                          <span className="text-[9px] text-muted-foreground">{p.cardCount} left</span>
                          <span className="text-xs font-display text-destructive">-{p.penaltyScore}</span>
                        </>
                      )}
                    </div>
                  </div>
                ))}
            </div>

            {message && (
              <p className="text-sm font-display text-primary tracking-wider">{message}</p>
            )}

            {isHost && (
              <div className="flex gap-2">
                <Button onClick={onDeal} className="font-display tracking-wider">
                  Next Round
                </Button>
                <Button variant="outline" onClick={onRematch} className="font-display tracking-wider">
                  Rematch
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Active gameplay */}
        {phase === "playing" && (
          <>
            {/* Other players */}
            <div className="flex flex-wrap justify-center gap-2 w-full">
              {otherPlayers.map((p, i) => {
                const isCurrent = currentPlayerIndex === ddPlayers.indexOf(p);
                return (
                  <motion.div
                    key={p.playerId}
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className={`flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg border transition-all min-w-[60px] ${
                      isCurrent ? "border-primary/50 bg-primary/5" : "border-border/20 bg-card/30"
                    }`}
                  >
                    <span className="text-[9px] font-medium truncate max-w-[70px]">{p.name}</span>
                    <span className="text-[9px] text-muted-foreground">{p.cardCount} cards</span>
                    {p.passed && <span className="text-[7px] text-muted-foreground">Passed</span>}
                  </motion.div>
                );
              })}
            </div>

            {/* Current combination on table */}
            <div className="flex flex-col items-center gap-1">
              <span className="text-[10px] font-display tracking-wider text-muted-foreground">TABLE</span>
              {currentCombination ? (
                <div className="flex flex-col items-center gap-1">
                  <div className="flex gap-1 justify-center">
                    {currentCombination.cards.map((card, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: i * 0.05 }}
                      >
                        <DDCard card={card} />
                      </motion.div>
                    ))}
                  </div>
                  <span className="text-[9px] text-muted-foreground">
                    {COMBO_LABELS[currentCombination.type]} by {currentCombination.playerName}
                  </span>
                </div>
              ) : (
                <div className="w-11 h-[60px] rounded-lg border-2 border-dashed border-border/30 flex items-center justify-center">
                  <span className="text-[9px] text-muted-foreground">Empty</span>
                </div>
              )}
            </div>

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
                    {ddPlayers[currentPlayerIndex]?.name}'s turn
                  </p>
                )}
              </motion.div>
            </AnimatePresence>

            {/* My hand */}
            {myDDPlayer && (
              <div className="w-full space-y-2">
                <div className="flex gap-1 justify-center flex-wrap">
                  {myDDPlayer.hand.map((card, i) => (
                    <DDCard
                      key={`${card}-${i}`}
                      card={card}
                      selected={selectedCards.includes(i)}
                      onClick={() => toggleCard(i)}
                    />
                  ))}
                </div>

                {selectedCards.length > 0 && (
                  <div className="text-center text-[10px] font-display text-muted-foreground">
                    {selectedCombo
                      ? (comboValid ? COMBO_LABELS[selectedCombo.type] : "Triples not allowed")
                      : "Invalid combination"}
                  </div>
                )}

                {isMyTurn && (
                  <div className="flex gap-2 justify-center">
                    {canPass && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={onPass}
                        className="font-display text-xs tracking-wider"
                      >
                        Pass
                      </Button>
                    )}
                    <Button
                      size="sm"
                      onClick={() => onPlay(selectedCards)}
                      disabled={!canPlay}
                      className="font-display text-xs tracking-wider"
                    >
                      Play {selectedCards.length > 0 ? `(${selectedCards.length})` : ""}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
};

export default DaiDiTable;
