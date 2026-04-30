import { motion, AnimatePresence } from "framer-motion";
import { X, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { parseCard, SEQUENCE_BOARD } from "@/lib/sequenceBoard";
import type { SeqPlayHistory, SeqPlayer } from "@/lib/sequence";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  playHistory: SeqPlayHistory[];
  players: SeqPlayer[];
}

const PlayHistoryModal = ({ isOpen, onClose, playHistory, players }: Props) => {
  const getPlayerName = (playerId: string) => {
    return players.find((p) => p.playerId === playerId)?.name || "Unknown";
  };

  const formatTime = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);

    if (minutes < 1) return `${seconds}s ago`;
    if (minutes < 60) return `${minutes}m ago`;
    return `${Math.floor(minutes / 60)}h ago`;
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", duration: 0.3 }}
            className="fixed inset-4 md:inset-10 bg-background border border-border rounded-2xl shadow-2xl z-50 flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 md:p-6 border-b border-border">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-primary" />
                <h2 className="text-xl md:text-2xl font-bold font-display">Play History</h2>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="rounded-full"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>

            {/* History List */}
            <div className="flex-1 overflow-y-auto p-4 md:p-6">
              {playHistory.length === 0 ? (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  <p>No moves played yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {playHistory.map((play, index) => {
                    const isJokerCard = play.card.startsWith("JKR");
                    const { rank, suitSymbol, suitColor } = isJokerCard
                      ? { rank: "", suitSymbol: "", suitColor: "" }
                      : parseCard(play.card);

                    return (
                      <motion.div
                        key={`${play.playerId}-${play.timestamp}`}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.02 }}
                        className="flex items-center gap-3 p-3 md:p-4 bg-card border border-border rounded-lg hover:border-accent/50 transition-colors"
                      >
                        {/* Player & Time */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-semibold text-foreground truncate">
                              {getPlayerName(play.playerId)}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {formatTime(play.timestamp)}
                            </span>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {play.type === "place" ? "Placed at" : "Removed from"}{" "}
                            <span className="font-mono font-semibold text-foreground">
                              {SEQUENCE_BOARD[play.row][play.col]}
                            </span>
                          </div>
                        </div>

                        {/* Card Display */}
                        <div className="flex-shrink-0">
                          {isJokerCard ? (
                            <div className="flex items-center gap-1 px-3 py-2 bg-purple-100 dark:bg-purple-900/30 border-2 border-purple-300 dark:border-purple-700 rounded-lg font-bold text-purple-700 dark:text-purple-300">
                              <span className="text-xl">🃏</span>
                              <span className="text-sm">JOKER</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 px-3 py-2 bg-white dark:bg-gray-800 border-2 border-gray-300 dark:border-gray-600 rounded-lg font-bold text-lg">
                              <span style={{ color: suitColor === "red" ? "#dc2626" : "#000000" }}>
                                {rank}
                              </span>
                              <span
                                className="text-xl"
                                style={{ color: suitColor === "red" ? "#dc2626" : "#000000" }}
                              >
                                {suitSymbol}
                              </span>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default PlayHistoryModal;
