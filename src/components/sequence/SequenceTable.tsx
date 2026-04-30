import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, RotateCcw, Crown, Trash2, UserX } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SeqGameState, SeqTeam } from "@/lib/sequence";
import { teamsBalanced, isValidPlayerCount, normalizeHouseRules, anyHouseRuleActive } from "@/lib/sequence";
import type { SeqPlayer } from "@/lib/sequence";
import type { Player } from "@/hooks/useRoom";
import { SEQUENCE_BOARD, parseCard, isCorner, isOneEyedJack, isTwoEyedJack, isJack, getBoardPositions } from "@/lib/sequenceBoard";
import SequenceResultOverlay from "./SequenceResultOverlay";

interface Props {
  gameState: SeqGameState;
  mySeqPlayer: SeqPlayer | undefined;
  isHost: boolean;
  isMyTurn: boolean;
  selectedCardIndex: number | null;
  validPlacements: [number, number][];
  selectedCardIsDead: boolean;
  onSelectCard: (idx: number | null) => void;
  previewPlacements: [number, number][];
  onPlayCard: (cardIndex: number, row: number, col: number) => void;
  onDiscardDead: (cardIndex: number) => void;
  onSetTeam: (playerId: string, team: SeqTeam) => void;
  onStartGame: () => void;
  onRematch: () => void;
  onKickPlayer: (playerId: string) => void;
  onLeave: () => void;
  players: Player[];
  myPlayerId: string | undefined;
}

const TEAM_COLORS: Record<string, string> = {
  A: "bg-game-red",
  B: "bg-game-blue",
  C: "bg-game-green",
};

const TEAM_BORDER: Record<string, string> = {
  A: "border-game-red",
  B: "border-game-blue",
  C: "border-game-green",
};

function chipColorClass(owner: string): string {
  if (owner === "A") return "bg-game-red";
  if (owner === "B") return "bg-game-blue";
  if (owner === "C") return "bg-game-green";
  const colors = ["bg-game-red", "bg-game-blue", "bg-game-green"];
  let hash = 0;
  for (const ch of owner) hash = (hash * 31 + ch.charCodeAt(0)) & 0xfff;
  return colors[hash % colors.length];
}

const SequenceTable = ({
  gameState,
  mySeqPlayer,
  isHost,
  isMyTurn,
  selectedCardIndex,
  validPlacements,
  previewPlacements,
  selectedCardIsDead,
  onSelectCard,
  onPlayCard,
  onDiscardDead,
  onSetTeam,
  onStartGame,
  onRematch,
  onKickPlayer,
  onLeave,
  players,
  myPlayerId,
}: Props) => {
  const { phase, players: seqPlayers, currentPlayerIndex, winner, isTeamGame, teams, sequences, message, teamCount } = gameState;
  const validSet = new Set(validPlacements.map(([r, c]) => `${r},${c}`));
  const previewSet = new Set(previewPlacements.map(([r, c]) => `${r},${c}`));
  const currentPlayer = seqPlayers[currentPlayerIndex];

  // Compute occupied cells matching the selected card (show orange outline)
  const occupiedMatchSet = (() => {
    if (selectedCardIndex === null || !mySeqPlayer) return new Set<string>();
    const card = mySeqPlayer.hand[selectedCardIndex];
    if (!card || card === "HIDDEN") return new Set<string>();
    const hr = normalizeHouseRules(gameState.houseRules);
    // Skip occupied highlights for jokers and wild (two-eyed) jacks — only show available spots
    if (card.startsWith("JKR") || (!hr.allJacksRemove && isTwoEyedJack(card))) return new Set<string>();
    let allPositions = getBoardPositions(card);
    // For jacks (wild/remove), match all non-corner board cells
    if (allPositions.length === 0 && isJack(card)) {
      allPositions = [];
      for (let r = 0; r < 10; r++) {
        for (let c = 0; c < 10; c++) {
          if (!isCorner(r, c)) allPositions.push([r, c]);
        }
      }
    }
    const set = new Set<string>();
    const myTeam = mySeqPlayer.team;
    for (const [r, c] of allPositions) {
      const key = `${r},${c}`;
      const cellOccupant = gameState.board[r][c];
      if (!validSet.has(key) && !previewSet.has(key) && cellOccupant !== null) {
        // For jacks used as removal, don't highlight your own team's chips
        if (isJack(card) && cellOccupant.owner === myTeam) continue;
        set.add(key);
      }
    }
    return set;
  })();

  // Track last move for highlight
  const [lastMoveCell, setLastMoveCell] = useState<string | null>(null);
  const lastMoveRef = useState<string | null>(null);

  useEffect(() => {
    const key = gameState.lastMove ? `${gameState.lastMove.row},${gameState.lastMove.col}` : null;
    if (key && key !== lastMoveRef[0]) {
      lastMoveRef[0] = key;
      setLastMoveCell(key);
    }
  }, [gameState.lastMove]);

  // Flash animation when it becomes your turn
  const [turnFlash, setTurnFlash] = useState(false);
  useEffect(() => {
    if (isMyTurn && phase === "playing") {
      setTurnFlash(true);
      const t = setTimeout(() => setTurnFlash(false), 1500);
      return () => clearTimeout(t);
    } else {
      setTurnFlash(false);
    }
  }, [isMyTurn, currentPlayerIndex]);

  // Hand state for drag-and-drop
  const [hand, setHand] = useState<Array<{ card: string; idx: number }>>([]);
  const [manuallyOrdered, setManuallyOrdered] = useState(false);
  const [draggedCard, setDraggedCard] = useState<string | null>(null);
  const [activeDropZone, setActiveDropZone] = useState<number | null>(null);
  const dropZoneRefs = useRef<{ [key: number]: HTMLDivElement | null }>({});

  // Sync hand with player's hand (but preserve manual arrangement when cards are removed)
  useEffect(() => {
    if (!mySeqPlayer) return;

    const sortCards = () => {
      const suitOrder: Record<string, number> = { "♠": 0, "♥": 1, "♣": 2, "♦": 3 };
      const rankOrder: Record<string, number> = { A: 14, K: 13, Q: 12, J: 11, "10": 10, "9": 9, "8": 8, "7": 7, "6": 6, "5": 5, "4": 4, "3": 3, "2": 2 };
      return mySeqPlayer.hand
        .map((c, i) => ({ card: c, idx: i }))
        .filter((e) => e.card !== "HIDDEN")
        .sort((a, b) => {
          const aJkr = a.card.startsWith("JKR");
          const bJkr = b.card.startsWith("JKR");
          if (aJkr && !bJkr) return -1;
          if (!aJkr && bJkr) return 1;
          if (aJkr && bJkr) return 0;
          const aJack = isJack(a.card);
          const bJack = isJack(b.card);
          if (aJack && !bJack) return -1;
          if (!aJack && bJack) return 1;
          const aP = parseCard(a.card);
          const bP = parseCard(b.card);
          const aSuit = suitOrder[aP.suitSymbol] ?? 9;
          const bSuit = suitOrder[bP.suitSymbol] ?? 9;
          if (aSuit !== bSuit) return aSuit - bSuit;
          return (rankOrder[bP.rank] ?? 0) - (rankOrder[aP.rank] ?? 0);
        });
    };

    // If hand length increased or is a completely new hand, reset arrangement
    if (mySeqPlayer.hand.length > hand.length || hand.length === 0) {
      setHand(sortCards());
      setManuallyOrdered(false);
      return;
    }

    // If hand length decreased, remove missing cards while preserving order
    if (mySeqPlayer.hand.length < hand.length) {
      const newHand = hand.filter(h => mySeqPlayer.hand.includes(h.card));
      setHand(newHand);
      return;
    }

    // If same length but different cards (cards were swapped/drawn), reset
    const sameCards = hand.every(h => mySeqPlayer.hand.includes(h.card));
    if (!sameCards) {
      setHand(sortCards());
      setManuallyOrdered(false);
    }
  }, [mySeqPlayer?.hand.length, mySeqPlayer?.hand.join(",")]);

  const updateActiveDropZone = (dragX: number, dragY: number, isTouchEvent: boolean) => {
    let closestZone = -1;
    let closestDistance = Infinity;

    // Adjust touch position upward to compensate for finger offset (touch registers lower)
    // On desktop/mouse, use minimal offset for better cursor alignment
    const adjustedY = isTouchEvent ? dragY - 70 : dragY;

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

    const originalIndex = hand.findIndex(c => c.card === draggedCard);

    // If dropping in the same position, don't do anything
    if (dropZoneIndex === originalIndex || dropZoneIndex === originalIndex + 1) {
      setDraggedCard(null);
      setActiveDropZone(null);
      return;
    }

    // Remove the dragged card from its current position
    const filteredHand = hand.filter(c => c.card !== draggedCard);

    // Adjust drop zone index if dropping after the original position
    // (because removing the card shifts all subsequent indices down by 1)
    let adjustedDropZone = dropZoneIndex;
    if (dropZoneIndex > originalIndex) {
      adjustedDropZone = dropZoneIndex - 1;
    }

    // Insert at the adjusted position
    const newHand = [...filteredHand];
    const draggedCardObj = hand.find(c => c.card === draggedCard);
    if (!draggedCardObj) return;

    newHand.splice(adjustedDropZone, 0, draggedCardObj);

    setHand(newHand);
    setDraggedCard(null);
    setActiveDropZone(null);
    setManuallyOrdered(true);
  };

  // Determine win/loss for overlay
  const isFinished = phase === "finished" && winner;
  const myTeam = mySeqPlayer?.team;
  const iWon = isFinished && myTeam === winner;
  const winnerPlayerNames = isFinished
    ? seqPlayers.filter((p) => p.team === winner).map((p) => p.name)
    : [];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Result overlay */}
      {isFinished && (
        <SequenceResultOverlay
          visible
          isWinner={!!iWon}
          winnerNames={winnerPlayerNames}
          teamColor={winner ?? undefined}
        />
      )}
      {/* Header */}
      <header className="border-b border-border/30 px-3 py-2 flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={onLeave} className="gap-1 text-muted-foreground text-xs">
          <ArrowLeft className="h-3.5 w-3.5" />
          Leave
        </Button>
        <div className="flex items-center gap-2">
          <span className="font-display text-[10px] tracking-widest text-muted-foreground">SEQUENCE</span>
          {anyHouseRuleActive(gameState.houseRules) && (
            <span className="text-[9px] font-display tracking-wider font-bold px-2 py-0.5 rounded-full bg-game-gold/30 text-game-gold border border-game-gold/40">🏠 HOUSE RULES</span>
          )}
          {mySeqPlayer?.team && phase !== "team_setup" && (
            <span className={`w-3 h-3 rounded-full ${TEAM_COLORS[mySeqPlayer.team]}`} title={`You: Team ${mySeqPlayer.team === "A" ? "Red" : mySeqPlayer.team === "B" ? "Blue" : "Green"}`} />
          )}
        </div>
        <div className="w-16" />
      </header>

      {/* Team setup phase */}
      {phase === "team_setup" && (
        <div className="flex-1 flex flex-col items-center justify-center px-4 gap-6">
          <h2 className="font-display text-sm tracking-widest text-muted-foreground">PICK YOUR TEAM</h2>
          <p className="text-xs text-muted-foreground">{teamCount} teams &middot; {seqPlayers.length} players</p>
          {!isValidPlayerCount(seqPlayers.length) && (
            <p className="text-xs text-destructive font-medium">
              ⚠ {seqPlayers.length} players can't be split evenly into teams. Need an even number or a multiple of 3.
            </p>
          )}
          <div className="w-full max-w-sm space-y-2">
            {seqPlayers.map((p) => {
              const isMe = p.playerId === myPlayerId;
              return (
                <div
                  key={p.playerId}
                  className={`flex items-center justify-between px-3 py-2 rounded-lg border ${
                    p.team ? TEAM_BORDER[p.team] + "/50" : "border-border/50"
                  } bg-card/50`}
                >
                  <span className="text-sm font-medium">
                    {p.name}
                    {isMe && " (You)"}
                  </span>
                  {isMe ? (
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant={p.team === "C" ? "default" : "outline"}
                        className={`text-xs h-7 px-3 ${p.team === "C" ? "bg-game-green hover:bg-game-green/90 text-white" : ""}`}
                        onClick={() => onSetTeam(p.playerId, "C")}
                      >
                        Green
                      </Button>
                      <Button
                        size="sm"
                        variant={p.team === "B" ? "default" : "outline"}
                        className={`text-xs h-7 px-3 ${p.team === "B" ? "bg-game-blue hover:bg-game-blue/90 text-white" : ""}`}
                        onClick={() => onSetTeam(p.playerId, "B")}
                      >
                        Blue
                      </Button>
                      {teamCount >= 3 && (
                        <Button
                          size="sm"
                          variant={p.team === "A" ? "default" : "outline"}
                          className={`text-xs h-7 px-3 ${p.team === "A" ? "bg-game-red hover:bg-game-red/90 text-white" : ""}`}
                          onClick={() => onSetTeam(p.playerId, "A")}
                        >
                          Red
                        </Button>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-display ${p.team ? "" : "text-muted-foreground"}`}>
                        {p.team === "A" ? "🔴 Red" : p.team === "B" ? "🔵 Blue" : p.team === "C" ? "🟢 Green" : "Choosing..."}
                      </span>
                      {isHost && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                          onClick={() => onKickPlayer(p.playerId)}
                          title="Kick player"
                        >
                          <UserX className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <Button
            onClick={onStartGame}
            disabled={!teamsBalanced(gameState) || !isValidPlayerCount(seqPlayers.length)}
            className="font-display tracking-wider"
          >
            Start Game
          </Button>
        </div>
      )}

      {/* Playing / Finished */}
      {(phase === "playing" || phase === "finished") && (
        <div className="flex-1 flex flex-col">
          {/* Turn indicator */}
          <AnimatePresence mode="wait">
            <motion.div
              key={isMyTurn ? "my-turn" : "other-turn"}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="px-3 py-1.5 text-center border-b border-border/20"
            >
              {phase === "playing" && (
                isMyTurn ? (
                  <motion.p
                    className="text-sm font-display tracking-wider font-bold text-primary"
                    animate={{ scale: [1, 1.15, 1] }}
                    transition={{ duration: 0.5, ease: "easeInOut" }}
                  >
                    🎯 YOUR TURN
                  </motion.p>
                ) : (
                  <p className="text-xs font-display tracking-wider text-muted-foreground">
                    {currentPlayer?.name}'s turn
                  </p>
                )
              )}
              {phase === "finished" && (
                <p className="text-xs font-display tracking-wider text-primary">
                  {isTeamGame ? `TEAM ${winner} WINS!` : `${seqPlayers.find((p) => p.playerId === winner)?.name || winner} WINS!`}
                </p>
              )}
              {message && (
                <p className="text-[10px] text-muted-foreground mt-0.5">{message}</p>
              )}
            </motion.div>
          </AnimatePresence>

          {/* Last Played Card Indicator */}
          <AnimatePresence>
            {gameState.lastMove && (
              <motion.div
                key={`${gameState.lastMove.row}-${gameState.lastMove.col}-${gameState.lastMove.card}`}
                initial={{ opacity: 0, scale: 0.8, y: -10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.8, y: -10 }}
                transition={{ duration: 0.3 }}
                className="px-3 py-2 mb-2 bg-accent/10 border border-accent/30 rounded-lg"
              >
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-muted-foreground">
                    {seqPlayers.find((p) => p.playerId === gameState.lastMove?.playerId)?.name || "Player"} played:
                  </span>
                  {(() => {
                    const card = gameState.lastMove.card;
                    const isJokerCard = card.startsWith("JKR");
                    if (isJokerCard) {
                      return (
                        <div className="flex items-center gap-1 px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 border border-purple-300 dark:border-purple-700 rounded font-bold text-purple-700 dark:text-purple-300">
                          <span>🃏</span>
                          <span>JOKER</span>
                        </div>
                      );
                    }
                    const { rank, suitSymbol, suitColor } = parseCard(card);
                    return (
                      <div className="flex items-center gap-0.5 px-2 py-0.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded font-bold">
                        <span style={{ color: suitColor === "red" ? "#dc2626" : "#000000" }}>
                          {rank}
                        </span>
                        <span style={{ color: suitColor === "red" ? "#dc2626" : "#000000" }}>
                          {suitSymbol}
                        </span>
                      </div>
                    );
                  })()}
                  <span className="text-muted-foreground text-[10px]">
                    at {SEQUENCE_BOARD[gameState.lastMove.row][gameState.lastMove.col]}
                  </span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Board */}
          <div className="flex-1 flex items-center justify-center p-2 overflow-auto">
            <div className="flex flex-col items-center w-full max-w-[520px]">
              <div
                className={`
                  grid gap-[1px] w-full aspect-square bg-white rounded-lg p-1
                  transition-all duration-300
                  ${isMyTurn ? `ring-[3px] ${mySeqPlayer?.team === "A" ? "ring-game-red shadow-[0_0_35px_rgba(239,68,68,0.45)]" : mySeqPlayer?.team === "B" ? "ring-game-blue shadow-[0_0_35px_rgba(59,130,246,0.45)]" : "ring-game-green shadow-[0_0_35px_rgba(34,197,94,0.45)]"}` : ""}
                `}
                style={{ gridTemplateColumns: "repeat(10, 1fr)" }}
              >
                {SEQUENCE_BOARD.map((row, r) =>
                  row.map((cell, c) => {
                    const chip = gameState.board[r][c];
                    const isFree = isCorner(r, c);
                    const isValid = validSet.has(`${r},${c}`);
                    const isPreview = previewSet.has(`${r},${c}`);
                    const isOccupiedMatch = occupiedMatchSet.has(`${r},${c}`);
                    const cellKey = `${r},${c}`;
                    const isLastPlaced = lastMoveCell === cellKey && gameState.lastMove?.type === "place";
                    const isLastRemoved = lastMoveCell === cellKey && gameState.lastMove?.type === "remove";
                    const { rank, suitSymbol, suitColor } = parseCard(cell);
                    const isSeqCell = chip?.partOfSequence;

                    const teamBgClass = isLastPlaced && chip
                      ? `${chipColorClass(chip.owner).replace("bg-", "bg-")}/30`
                      : "";

                    return (
                      <motion.button
                        key={`${r}-${c}`}
                        disabled={!isValid || !isMyTurn}
                        onClick={() => {
                          if (isValid && selectedCardIndex !== null) {
                            onPlayCard(selectedCardIndex, r, c);
                          }
                        }}
                        className={`
                          relative flex flex-col items-center justify-center rounded-[3px] leading-tight
                          transition-all duration-300 aspect-square overflow-visible
                          ${isFree
                            ? "bg-game-gold/20 border border-game-gold/30"
                            : "border border-gray-200"
                          }
                          ${!isFree && !isLastPlaced ? "bg-white" : ""}
                          ${isValid ? `ring-2 cursor-pointer ${mySeqPlayer?.team === "A" ? "ring-game-red bg-red-50" : mySeqPlayer?.team === "B" ? "ring-game-blue bg-blue-50" : "ring-game-green bg-green-50"}` : ""}
                          ${isPreview ? `ring-2 ${mySeqPlayer?.team === "A" ? "ring-game-red bg-red-50" : mySeqPlayer?.team === "B" ? "ring-game-blue bg-blue-50" : "ring-game-green bg-green-50"}` : ""}
                          ${isOccupiedMatch ? "!ring-2 !ring-black !bg-gray-300" : ""}
                          ${isSeqCell ? "ring-1 ring-game-gold" : ""}
                          ${""}
                        `}
                        style={isLastPlaced && chip ? {
                          backgroundColor: chip.owner === "A" ? "rgba(239,68,68,0.25)"
                            : chip.owner === "B" ? "rgba(59,130,246,0.25)"
                            : chip.owner === "C" ? "rgba(34,197,94,0.25)"
                            : undefined
                        } : undefined}
                      >
                        {isFree ? (
                          <span className="text-game-gold font-bold text-sm">★</span>
                        ) : (
                          <>
                            <span
                              className="font-display font-bold leading-none text-[11px]"
                              style={{ color: suitColor === "red" ? "#dc2626" : "#000000" }}
                            >
                              {rank}
                            </span>
                            <span
                              className="leading-none text-[9px]"
                              style={{ color: suitColor === "red" ? "#dc2626" : "#000000" }}
                            >
                              {suitSymbol}
                            </span>
                          </>
                        )}
                        {chip && (
                          <div
                            className={`absolute inset-[15%] rounded-full ${chipColorClass(chip.owner)} opacity-60 ${
                              isSeqCell ? "opacity-75 ring-1 ring-white/50" : ""
                            }`}
                          />
                        )}
                        {isLastRemoved && !chip && (
                          <div
                            className="absolute inset-[15%] rounded-full border-2 border-dashed opacity-60"
                            style={{
                              borderColor: gameState.lastMove?.type === "remove"
                                ? "rgba(239,68,68,0.6)"
                                : undefined
                            }}
                          />
                        )}
                        {isFree && (
                          <div className="absolute inset-[20%] rounded-full bg-game-gold/30" />
                        )}
                      </motion.button>
                    );
                  })
                )}
              </div>
              {/* Team banner */}
              {mySeqPlayer?.team && phase === "playing" && (
                <div className={`w-full mt-2 py-1.5 text-center text-xs font-display font-bold tracking-wider text-white ${TEAM_COLORS[mySeqPlayer.team]}`}>
                  You are team {mySeqPlayer.team === "A" ? "Red" : mySeqPlayer.team === "B" ? "Blue" : "Green"}!
                </div>
              )}
            </div>
          </div>

          {/* Player hand */}
          {mySeqPlayer && phase === "playing" && (
            <div className="border-t border-border/30 px-3 py-3 bg-card/30">
              <div className="flex items-center gap-2 mb-2">
                <div className="flex items-center gap-1.5 flex-1">
                  {mySeqPlayer.team && (
                    <span className={`w-2.5 h-2.5 rounded-full ${TEAM_COLORS[mySeqPlayer.team]}`} />
                  )}
                  <p className="text-[10px] font-display tracking-widest text-muted-foreground">
                    YOUR HAND ({mySeqPlayer.hand.length} cards)
                  </p>
                </div>
                {selectedCardIsDead && selectedCardIndex !== null && (
                  <Button
                    size="sm"
                    variant="destructive"
                    className="text-xs h-7 gap-1"
                    onClick={() => onDiscardDead(selectedCardIndex)}
                  >
                    <Trash2 className="h-3 w-3" />
                    Dead Card
                  </Button>
                )}
              </div>
              <div className="flex gap-0 flex-wrap justify-start pb-1">
                {/* Drop zone at the beginning */}
                {draggedCard && (
                  <div
                    ref={(el) => (dropZoneRefs.current[0] = el)}
                    className={`w-2 h-16 flex items-center justify-center flex-shrink-0 transition-all ${
                      activeDropZone === 0 ? 'w-14 bg-primary/20' : 'bg-transparent'
                    }`}
                  >
                    {activeDropZone === 0 && (
                      <div className="w-full h-full rounded-lg border-2 border-dashed border-primary bg-primary/10" />
                    )}
                  </div>
                )}

                {hand.map(({ card, idx: i }, handIdx) => {
                  if (card === "HIDDEN") return null;
                  const { rank, suitSymbol, suitColor } = parseCard(card);
                  const isSelected = selectedCardIndex === i;
                  const isJokerCard = card.startsWith("JKR");
                  const isSpecial = isJack(card) || isJokerCard;
                  const isDragging = draggedCard === card;
                  const hr = normalizeHouseRules(gameState.houseRules);

                  // Label logic
                  let label: { text: string; color: string } | null = null;
                  if (isJokerCard) {
                    label = { text: "WILD", color: "text-primary" };
                  } else if (hr.allJacksRemove && isJack(card)) {
                    label = { text: "REM", color: "text-destructive" };
                  } else if (!hr.allJacksRemove && isTwoEyedJack(card)) {
                    label = { text: "WILD", color: "text-primary" };
                  } else if (!hr.allJacksRemove && isOneEyedJack(card)) {
                    label = { text: "REM", color: "text-destructive" };
                  }

                  return (
                    <>
                      <motion.div
                        key={i}
                        drag
                        dragElastic={0}
                        dragMomentum={false}
                        dragSnapToOrigin
                        dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
                        dragTransition={{ bounceStiffness: 600, bounceDamping: 20 }}
                        onDragStart={() => setDraggedCard(card)}
                        onDrag={(event, info) => {
                          const isTouch = event.type.includes('touch');
                          updateActiveDropZone(info.point.x, info.point.y, isTouch);
                        }}
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
                        whileTap={{ scale: 0.95 }}
                        style={{ cursor: "grab", touchAction: "none" }}
                        onClick={(e) => {
                          if (draggedCard) return;
                          onSelectCard(isSelected ? null : i);
                        }}
                        className={`
                          flex-shrink-0 w-12 h-16 rounded-lg border-2 flex flex-col items-center justify-center
                          transition-all duration-150 bg-white cursor-pointer
                          ${isSelected
                            ? "border-primary shadow-lg -translate-y-2 scale-105"
                            : "border-border/50 hover:border-border"
                          }
                          ${isSpecial ? "bg-secondary/50" : ""}
                          ${!isMyTurn ? "opacity-70" : ""}
                        `}
                      >
                        <span
                          className="font-display font-bold text-sm leading-none"
                          style={{ color: isJokerCard ? "#7c3aed" : suitColor === "red" ? "#dc2626" : "#000000" }}
                        >
                          {isJokerCard ? "JKR" : rank}
                        </span>
                        {!isJokerCard && (
                          <span
                            className="text-xs leading-none"
                            style={{ color: suitColor === "red" ? "#dc2626" : "#000000" }}
                          >
                            {suitSymbol}
                          </span>
                        )}
                        {label && (
                          <span className={`text-[6px] ${label.color} font-display mt-0.5`}>{label.text}</span>
                        )}
                      </motion.div>

                      {/* Drop zone after this card */}
                      {draggedCard && (
                        <div
                          ref={(el) => (dropZoneRefs.current[handIdx + 1] = el)}
                          className={`w-2 h-16 flex items-center justify-center flex-shrink-0 transition-all ${
                            activeDropZone === handIdx + 1 ? 'w-14 bg-primary/20' : 'bg-transparent'
                          }`}
                        >
                          {activeDropZone === handIdx + 1 && (
                            <div className="w-full h-full rounded-lg border-2 border-dashed border-primary bg-primary/10" />
                          )}
                        </div>
                      )}
                    </>
                  );
                })}
              </div>
            </div>
          )}

          {/* Other players info */}
          {phase === "playing" && (
            <div className="border-t border-border/20 px-3 py-2">
              <div className="flex gap-3 overflow-x-auto text-[10px]">
                {seqPlayers.map((p) => (
                  <div
                    key={p.playerId}
                    className={`flex items-center gap-1 shrink-0 px-2 py-1 rounded-full ${
                      seqPlayers[currentPlayerIndex]?.playerId === p.playerId
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground"
                    }`}
                  >
                    {p.team && (
                      <div className={`w-2 h-2 rounded-full ${TEAM_COLORS[p.team]}`} />
                    )}
                    <span className="font-display">
                      {p.name}
                      {p.playerId === myPlayerId ? " (You)" : ""}
                    </span>
                    <span className="opacity-60">({p.hand.length})</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Finished actions */}
          {phase === "finished" && isHost && (
            <div className="border-t border-border/30 px-4 py-4">
              <Button onClick={onRematch} className="w-full gap-2 font-display tracking-wider">
                <RotateCcw className="h-4 w-4" />
                Rematch
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SequenceTable;
