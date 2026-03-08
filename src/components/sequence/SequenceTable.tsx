import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, RotateCcw, Crown, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SeqGameState, SeqTeam } from "@/lib/sequence";
import { teamsBalanced } from "@/lib/sequence";
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
    const allPositions = getBoardPositions(card);
    const set = new Set<string>();
    for (const [r, c] of allPositions) {
      const key = `${r},${c}`;
      if (!validSet.has(key) && !previewSet.has(key) && gameState.board[r][c] !== null) {
        set.add(key);
      }
    }
    return set;
  })();

  // Track last move for pop animation
  const [animatingCell, setAnimatingCell] = useState<string | null>(null);
  const lastMoveRef = useState<string | null>(null);

  useEffect(() => {
    const key = gameState.lastMove ? `${gameState.lastMove.row},${gameState.lastMove.col}` : null;
    if (key && key !== lastMoveRef[0]) {
      lastMoveRef[0] = key;
      setAnimatingCell(key);
      const t = setTimeout(() => setAnimatingCell(null), 500);
      return () => clearTimeout(t);
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
          {gameState.houseRules && (
            <span className="text-[8px] font-display tracking-wider px-1.5 py-0.5 rounded bg-game-gold/20 text-game-gold">HOUSE RULES</span>
          )}
        </div>
        <div className="text-xs text-muted-foreground font-display">
          {sequences.length > 0 && (
            <span>
              🔴{sequences.filter((s) => s.owner === "A").length}
              {" | "}🔵{sequences.filter((s) => s.owner === "B").length}
              {teamCount >= 3 && <>{" | "}🟢{sequences.filter((s) => s.owner === "C").length}</>}
            </span>
          )}
        </div>
      </header>

      {/* Team setup phase */}
      {phase === "team_setup" && (
        <div className="flex-1 flex flex-col items-center justify-center px-4 gap-6">
          <h2 className="font-display text-sm tracking-widest text-muted-foreground">PICK YOUR TEAM</h2>
          <p className="text-xs text-muted-foreground">{teamCount} teams &middot; {seqPlayers.length} players</p>
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
                        variant={p.team === "A" ? "default" : "outline"}
                        className={`text-xs h-7 px-3 ${p.team === "A" ? "bg-game-red hover:bg-game-red/90 text-white" : ""}`}
                        onClick={() => onSetTeam(p.playerId, "A")}
                      >
                        Red
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
                          variant={p.team === "C" ? "default" : "outline"}
                          className={`text-xs h-7 px-3 ${p.team === "C" ? "bg-game-green hover:bg-game-green/90 text-white" : ""}`}
                          onClick={() => onSetTeam(p.playerId, "C")}
                        >
                          Green
                        </Button>
                      )}
                    </div>
                  ) : (
                    <span className={`text-xs font-display ${p.team ? "" : "text-muted-foreground"}`}>
                      {p.team === "A" ? "🔴 Red" : p.team === "B" ? "🔵 Blue" : p.team === "C" ? "🟢 Green" : "Choosing..."}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
          {isHost && (
            <Button
              onClick={onStartGame}
              disabled={!teamsBalanced(gameState)}
              className="font-display tracking-wider"
            >
              Start Game
            </Button>
          )}
          {!isHost && (
            <p className="text-xs text-muted-foreground font-display">Pick your team, then wait for host to start...</p>
          )}
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

          {/* Board */}
          <div className="flex-1 flex items-center justify-center p-2 overflow-auto">
            <div
              className={`
                grid gap-[1px] w-full max-w-[520px] aspect-square bg-white rounded-lg p-1
                transition-all duration-300
                ${isMyTurn ? "ring-[3px] ring-green-500 shadow-[0_0_35px_rgba(34,197,94,0.45)]" : ""}
              `}
              style={{ gridTemplateColumns: "repeat(10, 1fr)" }}
            >
              {SEQUENCE_BOARD.map((row, r) =>
                row.map((cell, c) => {
                  const chip = gameState.board[r][c];
                  const isFree = isCorner(r, c);
                  const isValid = validSet.has(`${r},${c}`);
                  const isPreview = previewSet.has(`${r},${c}`);
                  const cellKey = `${r},${c}`;
                  const isAnimating = animatingCell === cellKey;
                  const isLastMove = gameState.lastMove?.row === r && gameState.lastMove?.col === c;
                  const { rank, suitSymbol, suitColor } = parseCard(cell);
                  const isSeqCell = chip?.partOfSequence;

                  return (
                    <motion.button
                      key={`${r}-${c}`}
                      disabled={!isValid || !isMyTurn}
                      onClick={() => {
                        if (isValid && selectedCardIndex !== null) {
                          onPlayCard(selectedCardIndex, r, c);
                        }
                      }}
                      animate={isAnimating ? { scale: [1, 1.3, 1] } : {}}
                      transition={{ duration: 0.4, ease: "easeOut" }}
                      className={`
                        relative flex flex-col items-center justify-center rounded-[3px] leading-tight
                        transition-all duration-150 aspect-square
                        ${isFree
                          ? "bg-game-gold/20 border border-game-gold/30"
                          : "bg-white border border-gray-200"
                        }
                        ${isValid ? "ring-2 ring-primary/70 bg-green-50 cursor-pointer" : ""}
                        ${isPreview ? "ring-1 ring-green-400/50 bg-green-50/50" : ""}
                        ${isLastMove && !isAnimating ? "ring-2 ring-accent" : ""}
                        ${isSeqCell ? "ring-1 ring-game-gold" : ""}
                      `}
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
                      {/* Chip */}
                      {chip && (
                        <motion.div
                          initial={isAnimating ? { scale: 0 } : false}
                          animate={{ scale: 1 }}
                          transition={{ duration: 0.3, type: "spring" }}
                          className={`absolute inset-[15%] rounded-full ${chipColorClass(chip.owner)} opacity-75 ${
                            isSeqCell ? "opacity-90 ring-1 ring-white/50" : ""
                          }`}
                        />
                      )}
                      {/* Free corner chip indicator */}
                      {isFree && (
                        <div className="absolute inset-[20%] rounded-full bg-game-gold/30" />
                      )}
                    </motion.button>
                  );
                })
              )}
            </div>
          </div>

          {/* Player hand */}
          {mySeqPlayer && phase === "playing" && (
            <div className="border-t border-border/30 px-3 py-3 bg-card/30">
              <div className="flex items-center gap-2 mb-2">
                <p className="text-[10px] font-display tracking-widest text-muted-foreground flex-1">
                  YOUR HAND ({mySeqPlayer.hand.length} cards)
                </p>
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
              <div className="flex gap-1.5 overflow-x-auto pb-1">
                {mySeqPlayer.hand.map((card, i) => {
                  if (card === "HIDDEN") return null;
                  const { rank, suitSymbol, suitColor } = parseCard(card);
                  const isSelected = selectedCardIndex === i;
                  const isJokerCard = card.startsWith("JKR");
                  const isSpecial = isJack(card) || isJokerCard;
                  const hr = gameState.houseRules;

                  // Label logic
                  let label: { text: string; color: string } | null = null;
                  if (isJokerCard) {
                    label = { text: "WILD", color: "text-primary" };
                  } else if (hr && isJack(card)) {
                    label = { text: "REM", color: "text-destructive" };
                  } else if (!hr && isTwoEyedJack(card)) {
                    label = { text: "WILD", color: "text-primary" };
                  } else if (!hr && isOneEyedJack(card)) {
                    label = { text: "REM", color: "text-destructive" };
                  }

                  return (
                    <motion.button
                      key={`${card}-${i}`}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => onSelectCard(isSelected ? null : i)}
                      className={`
                        flex-shrink-0 w-12 h-16 rounded-lg border-2 flex flex-col items-center justify-center
                        transition-all duration-150 bg-card
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
                        style={{ color: suitColor === "red" ? "hsl(var(--destructive))" : "hsl(var(--foreground))" }}
                      >
                        {rank}
                      </span>
                      <span
                        className="text-xs leading-none"
                        style={{ color: suitColor === "red" ? "hsl(var(--destructive))" : "hsl(var(--foreground))" }}
                      >
                        {suitSymbol}
                      </span>
                      {label && (
                        <span className={`text-[6px] ${label.color} font-display mt-0.5`}>{label.text}</span>
                      )}
                    </motion.button>
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
