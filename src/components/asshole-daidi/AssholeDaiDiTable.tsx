import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, ChevronDown, ChevronUp, Trophy, Crown, UserX } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ADDGameState, ADDPlayer, PlayedCombination } from "@/lib/assholeDaiDi";
import { cardDisplay, sortHand, detectCombination } from "@/lib/assholeDaiDi";
import type { Player } from "@/hooks/useRoom";

interface Props {
  gameState: ADDGameState;
  myADDPlayer: ADDPlayer | undefined;
  isHost: boolean;
  isMyTurn: boolean;
  canPass: boolean;
  selectedCards: number[];
  setSelectedCards: (cards: number[]) => void;
  mySwapPending: { fromId: string; toId: string; count: number; autoCards: string[]; returnedCards: string[] } | undefined;
  onDeal: () => void;
  onPlay: (cardIndices: number[]) => void;
  onPass: () => void;
  onStartSwap: () => void;
  onSubmitSwapReturn: (cardIndices: number[]) => void;
  onFinishSwap: () => void;
  onRematch: () => void;
  onLeave: () => void;
  onKickPlayer: (playerId: string) => void;
  players: Player[];
  myPlayerId: string | undefined;
}

const RANK_BADGES: Record<string, { label: string; color: string }> = {
  "President": { label: "👑 PRES", color: "bg-game-gold/20 text-game-gold" },
  "Vice President": { label: "⭐ VP", color: "bg-game-blue/20 text-game-blue" },
  "Citizen": { label: "🙂 CIT", color: "bg-secondary text-muted-foreground" },
  "Vice Asshole": { label: "😬 VA", color: "bg-game-red/20 text-game-red" },
  "Asshole": { label: "💩 ASS", color: "bg-destructive/20 text-destructive" },
};

const ADDCard = ({ card, small = false, selected = false }: {
  card: string; small?: boolean; selected?: boolean;
}) => {
  const { rank, suitSymbol, suitColor } = cardDisplay(card);
  return (
    <div
      className={`
        ${small ? "w-9 h-13" : "w-11 h-[60px]"} rounded-lg border-2 flex flex-col items-center justify-center
        transition-all shrink-0
        ${selected ? "border-primary bg-primary/10 -translate-y-2 shadow-md" : "border-border/50 bg-white hover:border-primary/30"}
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
    </div>
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

const AssholeDaiDiTable = ({
  gameState,
  myADDPlayer,
  isHost,
  isMyTurn,
  canPass,
  selectedCards,
  setSelectedCards,
  mySwapPending,
  onDeal,
  onPlay,
  onPass,
  onStartSwap,
  onSubmitSwapReturn,
  onFinishSwap,
  onRematch,
  onLeave,
  onKickPlayer,
  players,
  myPlayerId,
}: Props) => {
  const { phase, roundNumber, currentCombination, currentPlayerIndex, message, houseRules } = gameState;
  const addPlayers = gameState.players;
  const [showPlayers, setShowPlayers] = useState(false);
  const [hand, setHand] = useState<string[]>([]);
  const [draggedCard, setDraggedCard] = useState<string | null>(null);
  const [activeDropZone, setActiveDropZone] = useState<number | null>(null);
  const dropZoneRefs = useRef<{ [key: number]: HTMLDivElement | null }>({});

  const otherPlayers = addPlayers.filter((p) => p.playerId !== myPlayerId);

  // Sync hand with player's hand
  useEffect(() => {
    if (myADDPlayer) {
      setHand(myADDPlayer.hand);
    }
  }, [myADDPlayer?.hand.length, myADDPlayer?.hand.join(",")]);

  const toggleCard = (displayIdx: number) => {
    // Find the card value at this display position
    const cardValue = hand[displayIdx];
    // Find its original index in the player's hand
    const originalIdx = myADDPlayer?.hand.indexOf(cardValue) ?? -1;

    if (originalIdx === -1) return;

    setSelectedCards(
      selectedCards.includes(originalIdx)
        ? selectedCards.filter((i) => i !== originalIdx)
        : [...selectedCards, originalIdx]
    );
  };

  const updateActiveDropZone = (dragX: number, dragY: number) => {
    let closestZone = -1;
    let closestDistance = Infinity;

    // Adjust touch position to account for finger offset (touch registers higher than visual position)
    const adjustedY = dragY + 40;

    Object.entries(dropZoneRefs.current).forEach(([zoneIndex, el]) => {
      if (!el) return;
      const rect = el.getBoundingClientRect();

      const zoneCenterX = rect.left + rect.width / 2;
      const zoneCenterY = rect.top + rect.height / 2;

      // Check if drag is within the same row (vertical range) as this drop zone
      const verticalDistance = Math.abs(adjustedY - zoneCenterY);
      const inSameRow = verticalDistance < 40; // Within same row if less than 40px vertical distance

      const horizontalDistance = Math.abs(dragX - zoneCenterX);

      let distance;
      if (inSameRow) {
        // In same row: only consider horizontal distance, ignore vertical
        distance = horizontalDistance;
      } else {
        // Different row: heavily penalize to prevent jumping between rows
        distance = horizontalDistance + verticalDistance * 10;
      }

      if (distance < closestDistance) {
        closestDistance = distance;
        closestZone = parseInt(zoneIndex);
      }
    });

    if (closestZone !== -1) {
      setActiveDropZone(closestZone);
    }
  };

  const handleDrop = (dropZoneIndex: number) => {
    if (!draggedCard) return;

    const originalIndex = hand.indexOf(draggedCard);

    // If dropping in the same position, don't do anything
    if (dropZoneIndex === originalIndex || dropZoneIndex === originalIndex + 1) {
      setDraggedCard(null);
      setActiveDropZone(null);
      return;
    }

    // Remove the dragged card from its current position
    const filteredHand = hand.filter(c => c !== draggedCard);

    // Adjust drop zone index if dropping after the original position
    // (because removing the card shifts all subsequent indices down by 1)
    let adjustedDropZone = dropZoneIndex;
    if (dropZoneIndex > originalIndex) {
      adjustedDropZone = dropZoneIndex - 1;
    }

    // Insert at the adjusted position
    const newHand = [...filteredHand];
    newHand.splice(adjustedDropZone, 0, draggedCard);

    setHand(newHand);
    setDraggedCard(null);
    setActiveDropZone(null);
  };

  const selectedCombo = myADDPlayer && selectedCards.length > 0
    ? detectCombination(selectedCards.map((i) => myADDPlayer.hand[i]))
    : null;

  const canPlay = isMyTurn && selectedCombo !== null;

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
            ASSHOLE DAI DI • RND {roundNumber}
          </span>
          <span className="text-[9px] font-display tracking-wider px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">
            {phase === "playing" ? "PLAYING" : phase === "round_end" ? "ROUND END" : phase === "swap_give" ? "CARD SWAP" : phase === "swap_summary" ? "SWAP DONE" : phase === "waiting" ? "WAITING" : phase.toUpperCase()}
          </span>
        </div>
        {houseRules.allowEndOn2 && (
          <span className="text-[8px] font-display tracking-wider text-game-gold bg-game-gold/10 px-1.5 py-0.5 rounded">
            END ON 2
          </span>
        )}
      </header>

      {/* Players panel */}
      <button
        onClick={() => setShowPlayers(!showPlayers)}
        className="border-b border-border/30 px-3 py-2 flex items-center justify-between hover:bg-card/50 transition-colors"
      >
        <span className="text-[10px] font-display tracking-widest text-muted-foreground">
          PLAYERS ({addPlayers.length})
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
              {addPlayers.map((p) => (
                <div
                  key={p.playerId}
                  className={`flex items-center justify-between px-2 py-1.5 rounded text-xs ${
                    p.playerId === myPlayerId ? "bg-primary/5 border border-primary/20" : "bg-card/30"
                  } ${p.finishOrder > 0 ? "opacity-50" : ""}`}
                >
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium">{p.name}</span>
                    {p.playerId === myPlayerId && <span className="text-primary text-[9px]">(You)</span>}
                    {p.rank && (
                      <span className={`text-[8px] font-display px-1.5 py-0.5 rounded ${RANK_BADGES[p.rank]?.color || ""}`}>
                        {RANK_BADGES[p.rank]?.label || p.rank}
                      </span>
                    )}
                    {p.finishOrder > 0 && <span className="text-[9px] text-primary">✓ Done</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] text-muted-foreground">{p.cardCount} cards</span>
                    <span className="font-display text-game-gold">{p.cumulativeScore}pts</span>
                    {isHost && p.playerId !== myPlayerId && (
                      <Button variant="ghost" size="sm" onClick={() => onKickPlayer(p.playerId)} className="text-destructive h-6 w-6 p-0">
                        <UserX className="h-3 w-3" />
                      </Button>
                    )}
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
              {roundNumber === 0 ? "Ready to deal?" : "Ready for next round?"}
            </p>
            {isHost && (
              <Button onClick={roundNumber === 0 ? onDeal : onStartSwap} className="font-display tracking-wider">
                {roundNumber === 0 ? "Deal Cards" : "Next Round"}
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
              {[...addPlayers]
                .sort((a, b) => a.finishOrder - b.finishOrder)
                .map((p) => (
                  <div key={p.playerId} className={`flex items-center justify-between px-3 py-2 rounded-lg border ${
                    p.rank === "President" ? "border-game-gold/50 bg-game-gold/10" : "border-border/30 bg-card/30"
                  }`}>
                    <div className="flex items-center gap-2">
                      {p.rank && (
                        <span className={`text-[9px] font-display px-1.5 py-0.5 rounded ${RANK_BADGES[p.rank]?.color || ""}`}>
                          {RANK_BADGES[p.rank]?.label}
                        </span>
                      )}
                      <span className="text-xs font-medium">{p.name}</span>
                      {p.playerId === myPlayerId && <span className="text-primary text-[9px]">(You)</span>}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-[9px] text-muted-foreground">{p.cardCount} left</span>
                      {p.roundScore > 0 && (
                        <span className="text-xs font-display text-game-gold">+{p.roundScore}</span>
                      )}
                      <span className="text-xs font-display text-foreground">{p.cumulativeScore}pts</span>
                    </div>
                  </div>
                ))}
            </div>

            {message && (
              <p className="text-sm font-display text-primary tracking-wider">{message}</p>
            )}

            {isHost && (
              <div className="flex gap-2">
                <Button onClick={onStartSwap} className="font-display tracking-wider">
                  Next Round
                </Button>
                <Button variant="outline" onClick={onRematch} className="font-display tracking-wider">
                  Rematch
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Swap phase */}
        {(phase === "swap_give" || phase === "swap_summary") && (
          <div className="flex-1 flex flex-col items-center justify-center space-y-4 w-full max-w-sm">
            <h2 className="font-display font-bold text-sm tracking-wider">CARD SWAP</h2>

            {phase === "swap_give" && mySwapPending && (
              <div className="space-y-3 text-center">
                <p className="text-xs text-muted-foreground">
                  You received {mySwapPending.count} card{mySwapPending.count > 1 ? "s" : ""}.
                  Select {mySwapPending.count} card{mySwapPending.count > 1 ? "s" : ""} to return (must be lower rank).
                </p>
                {/* Show received cards */}
                <div className="flex gap-1 justify-center">
                  {mySwapPending.autoCards.map((c, i) => (
                    <ADDCard key={i} card={c} small />
                  ))}
                </div>

                {/* Your hand for selecting return cards */}
                {myADDPlayer && (
                  <>
                    <p className="text-[10px] font-display tracking-wider text-muted-foreground">YOUR HAND — TAP TO SELECT</p>
                    <div className="flex gap-0 justify-center flex-wrap px-2">
                      {/* Drop zone at the beginning */}
                      {draggedCard && (
                        <div
                          ref={(el) => (dropZoneRefs.current[0] = el)}
                          className={`w-2 h-13 flex items-center justify-center shrink-0 transition-all ${
                            activeDropZone === 0 ? 'w-12 bg-primary/20' : 'bg-transparent'
                          }`}
                        >
                          {activeDropZone === 0 && (
                            <div className="w-full h-full rounded-lg border-2 border-dashed border-primary bg-primary/10" />
                          )}
                        </div>
                      )}

                      {hand.map((card, i) => {
                        const originalIdx = myADDPlayer?.hand.indexOf(card) ?? -1;
                        const isSelected = originalIdx !== -1 && selectedCards.includes(originalIdx);
                        const isDragging = draggedCard === card;

                        return (
                          <>
                            <motion.div
                              key={card}
                              drag
                              dragElastic={0}
                              dragMomentum={false}
                              dragSnapToOrigin
                              dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
                              dragTransition={{ bounceStiffness: 600, bounceDamping: 20 }}
                              onDragStart={() => setDraggedCard(card)}
                              onDrag={(event, info) => updateActiveDropZone(info.point.x, info.point.y)}
                              onDragEnd={() => {
                                if (activeDropZone !== null) {
                                  handleDrop(activeDropZone);
                                }
                                setDraggedCard(null);
                                setActiveDropZone(null);
                              }}
                              animate={{ opacity: isDragging ? 0.3 : 1 }}
                              transition={{ type: "spring", stiffness: 500, damping: 30 }}
                              whileDrag={{ scale: 1.05, zIndex: 50, cursor: "grabbing" }}
                              style={{ cursor: "grab", touchAction: "none" }}
                              onClick={(e) => {
                                if (draggedCard) return;
                                toggleCard(i);
                              }}
                              className="shrink-0"
                            >
                              <ADDCard
                                card={card}
                                small
                                selected={isSelected}
                              />
                            </motion.div>

                            {/* Drop zone after this card */}
                            {draggedCard && (
                              <div
                                ref={(el) => (dropZoneRefs.current[i + 1] = el)}
                                className={`w-2 h-13 flex items-center justify-center shrink-0 transition-all ${
                                  activeDropZone === i + 1 ? 'w-12 bg-primary/20' : 'bg-transparent'
                                }`}
                              >
                                {activeDropZone === i + 1 && (
                                  <div className="w-full h-full rounded-lg border-2 border-dashed border-primary bg-primary/10" />
                                )}
                              </div>
                            )}
                          </>
                        );
                      })}
                    </div>
                    <Button
                      onClick={() => onSubmitSwapReturn(selectedCards)}
                      disabled={selectedCards.length !== mySwapPending.count}
                      className="font-display tracking-wider text-xs"
                      size="sm"
                    >
                      Confirm Return
                    </Button>
                  </>
                )}
              </div>
            )}

            {phase === "swap_give" && !mySwapPending && (
              <p className="text-xs text-muted-foreground">Waiting for other players to complete the swap...</p>
            )}

            {phase === "swap_summary" && (
              <div className="space-y-3 text-center">
                <p className="text-sm text-primary font-display">{message}</p>
                {myADDPlayer?.swapCardsReceived && myADDPlayer.swapCardsReceived.length > 0 && (
                  <div>
                    <p className="text-[10px] font-display text-muted-foreground mb-1">YOU RECEIVED</p>
                    <div className="flex gap-1 justify-center">
                      {myADDPlayer.swapCardsReceived.map((c, i) => (
                        <ADDCard key={i} card={c} small />
                      ))}
                    </div>
                  </div>
                )}
                {isHost && (
                  <Button onClick={onFinishSwap} className="font-display tracking-wider">
                    Start Playing
                  </Button>
                )}
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
                const isCurrent = currentPlayerIndex === addPlayers.indexOf(p);
                return (
                  <motion.div
                    key={p.playerId}
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className={`flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg border transition-all min-w-[60px] ${
                      isCurrent ? "border-primary/50 bg-primary/5" : "border-border/20 bg-card/30"
                    } ${p.finishOrder > 0 ? "opacity-40" : ""}`}
                  >
                    <span className="text-[9px] font-medium truncate max-w-[70px]">{p.name}</span>
                    {p.rank && (
                      <span className={`text-[7px] font-display px-1 py-0.5 rounded ${RANK_BADGES[p.rank]?.color || ""}`}>
                        {RANK_BADGES[p.rank]?.label}
                      </span>
                    )}
                    <span className="text-[9px] text-muted-foreground">{p.cardCount} cards</span>
                    {p.passed && <span className="text-[7px] text-muted-foreground">Passed</span>}
                    {p.finishOrder > 0 && <span className="text-[7px] text-primary font-bold">✓</span>}
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
                        <ADDCard card={card} />
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
                    {addPlayers[currentPlayerIndex]?.name}'s turn
                  </p>
                )}
              </motion.div>
            </AnimatePresence>

            {/* My hand */}
            {myADDPlayer && myADDPlayer.finishOrder === 0 && (
              <div className="w-full space-y-2">
                <div className="flex gap-0 justify-center flex-wrap px-2">
                  {/* Drop zone at the beginning */}
                  {draggedCard && (
                    <div
                      ref={(el) => (dropZoneRefs.current[0] = el)}
                      className={`w-3 h-[60px] flex items-center justify-center shrink-0 transition-all ${
                        activeDropZone === 0 ? 'w-16 bg-primary/20' : 'bg-transparent'
                      }`}
                    >
                      {activeDropZone === 0 && (
                        <div className="w-full h-full rounded-lg border-2 border-dashed border-primary bg-primary/10" />
                      )}
                    </div>
                  )}

                  {hand.map((card, i) => {
                    const originalIdx = myADDPlayer?.hand.indexOf(card) ?? -1;
                    const isSelected = originalIdx !== -1 && selectedCards.includes(originalIdx);
                    const isDragging = draggedCard === card;

                    return (
                      <>
                        <motion.div
                          key={card}
                          drag
                          dragElastic={0}
                          dragMomentum={false}
                          dragSnapToOrigin
                          dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
                          dragTransition={{ bounceStiffness: 600, bounceDamping: 20 }}
                          onDragStart={() => setDraggedCard(card)}
                          onDrag={(event, info) => updateActiveDropZone(info.point.x, info.point.y)}
                          onDragEnd={() => {
                            if (activeDropZone !== null) {
                              handleDrop(activeDropZone);
                            }
                            setDraggedCard(null);
                            setActiveDropZone(null);
                          }}
                          animate={{ opacity: isDragging ? 0.3 : 1 }}
                          transition={{ type: "spring", stiffness: 500, damping: 30 }}
                          whileDrag={{ scale: 1.05, zIndex: 50, cursor: "grabbing" }}
                          style={{ cursor: "grab", touchAction: "none" }}
                          onClick={(e) => {
                            if (draggedCard) return;
                            toggleCard(i);
                          }}
                          className="shrink-0"
                        >
                          <ADDCard
                            card={card}
                            selected={isSelected}
                          />
                        </motion.div>

                        {/* Drop zone after this card */}
                        {draggedCard && (
                          <div
                            ref={(el) => (dropZoneRefs.current[i + 1] = el)}
                            className={`w-3 h-[60px] flex items-center justify-center shrink-0 transition-all ${
                              activeDropZone === i + 1 ? 'w-16 bg-primary/20' : 'bg-transparent'
                            }`}
                          >
                            {activeDropZone === i + 1 && (
                              <div className="w-full h-full rounded-lg border-2 border-dashed border-primary bg-primary/10" />
                            )}
                          </div>
                        )}
                      </>
                    );
                  })}
                </div>

                {selectedCards.length > 0 && (
                  <div className="text-center text-[10px] font-display text-muted-foreground">
                    {selectedCombo
                      ? `${COMBO_LABELS[selectedCombo.type] || "Invalid"}`
                      : "Invalid combination"}
                  </div>
                )}

                {/* Action buttons */}
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

            {myADDPlayer && myADDPlayer.finishOrder > 0 && (
              <p className="text-sm font-display text-primary tracking-wider">
                You finished #{myADDPlayer.finishOrder}! Waiting for others...
              </p>
            )}
          </>
        )}
      </main>
    </div>
  );
};

export default AssholeDaiDiTable;
