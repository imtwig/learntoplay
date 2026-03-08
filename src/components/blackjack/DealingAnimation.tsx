import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import PlayingCard from "./PlayingCard";
import type { BJPlayerState } from "@/lib/blackjack";

interface Props {
  players: BJPlayerState[];
  showFirstCard?: boolean;
  myPlayerId?: string;
  onComplete: () => void;
}

const DealingAnimation = ({ players, showFirstCard = false, myPlayerId, onComplete }: Props) => {
  const [phase, setPhase] = useState<"shuffle" | "deal">("shuffle");
  // Each deal step: [roundIndex, playerIndex] — deal 2 rounds, each round goes through all players
  const [dealStep, setDealStep] = useState(-1);

  // Order: non-dealer players first (by array order), dealer last
  const dealOrder = [
    ...players.filter((p) => !p.isDealer),
    ...players.filter((p) => p.isDealer),
  ];
  const totalSteps = dealOrder.length * 2; // 2 cards each

  // Shuffle phase → deal phase
  useEffect(() => {
    const timer = setTimeout(() => setPhase("deal"), 1200);
    return () => clearTimeout(timer);
  }, []);

  // Deal cards one by one
  useEffect(() => {
    if (phase !== "deal") return;
    if (dealStep >= totalSteps - 1) {
      const timer = setTimeout(onComplete, 400);
      return () => clearTimeout(timer);
    }
    const timer = setTimeout(
      () => setDealStep((s) => s + 1),
      dealStep === -1 ? 100 : 200
    );
    return () => clearTimeout(timer);
  }, [phase, dealStep, totalSteps, onComplete]);

  // Calculate which cards each player has been dealt so far
  const getDealtCards = (playerIndex: number) => {
    const count = Math.max(
      0,
      // Round 1: steps 0..n-1, Round 2: steps n..2n-1
      (dealStep >= playerIndex ? 1 : 0) +
        (dealStep >= dealOrder.length + playerIndex ? 1 : 0)
    );
    return count;
  };

  return (
    <div className="flex flex-col items-center gap-6 py-8">
      {/* Shuffle animation */}
      <AnimatePresence mode="wait">
        {phase === "shuffle" && (
          <motion.div
            key="shuffle"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center gap-4"
          >
            <div className="relative w-20 h-28">
              {[0, 1, 2, 3, 4].map((i) => (
                <motion.div
                  key={i}
                  className="absolute inset-0"
                  animate={{
                    x: [0, (i % 2 === 0 ? 1 : -1) * 15, 0, (i % 2 === 0 ? -1 : 1) * 10, 0],
                    y: [i * -2, i * -3, i * -2],
                    rotate: [0, (i % 2 === 0 ? 3 : -3), 0, (i % 2 === 0 ? -2 : 2), 0],
                  }}
                  transition={{
                    duration: 0.8,
                    repeat: 1,
                    delay: i * 0.05,
                    ease: "easeInOut",
                  }}
                  style={{ zIndex: 5 - i }}
                >
                  <div className="w-[66px] h-[96px] rounded-lg bg-gradient-to-br from-primary/80 to-accent/60 border border-border/50 shadow-lg flex items-center justify-center">
                    <div className="w-[80%] h-[80%] rounded border border-primary-foreground/20 bg-primary/40" />
                  </div>
                </motion.div>
              ))}
            </div>
            <motion.p
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 1, repeat: Infinity }}
              className="text-sm font-display text-muted-foreground tracking-wider"
            >
              Shuffling...
            </motion.p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Deal animation */}
      {phase === "deal" && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center gap-6 w-full"
        >
          {/* Dealer (last) */}
          {dealOrder.filter((p) => p.isDealer).map((p) => {
            const idx = dealOrder.indexOf(p);
            const count = getDealtCards(idx);
            return (
              <div key={p.playerId} className="flex flex-col items-center gap-1">
                <span className="text-[10px] font-display tracking-wider text-game-gold uppercase">
                  {p.name} (Dealer)
                </span>
                <div className="flex -space-x-3 h-[96px] items-center">
                  {Array.from({ length: count }).map((_, ci) => {
                    const isFaceUp = showFirstCard && ci === 0;
                    const actualCard = p.hands[0]?.cards[ci];
                    return (
                      <motion.div
                        key={ci}
                        initial={{ opacity: 0, y: -60, x: 0, scale: 0.5 }}
                        animate={{ opacity: 1, y: 0, x: 0, scale: 1 }}
                        transition={{ type: "spring", damping: 15, stiffness: 200 }}
                      >
                        <PlayingCard
                          card={isFaceUp && actualCard ? { ...actualCard, faceUp: true } : { rank: "A", suit: "spades", faceUp: false }}
                          index={ci}
                        />
                      </motion.div>
                    );
                  })}
                  {count === 0 && (
                    <div className="w-[66px] h-[96px] rounded-lg border border-dashed border-border/30" />
                  )}
                </div>
              </div>
            );
          })}

          <div className="w-full max-w-lg border-t border-dashed border-border/30" />

          {/* Players (in order) */}
          <div className="flex flex-wrap justify-center gap-6">
            {dealOrder.filter((p) => !p.isDealer).map((p) => {
              const idx = dealOrder.indexOf(p);
              const count = getDealtCards(idx);
              return (
                <div key={p.playerId} className="flex flex-col items-center gap-1">
                  <span className="text-[10px] font-display tracking-wider text-muted-foreground uppercase">
                    {p.name}
                  </span>
                  <div className="flex -space-x-3 h-[96px] items-center">
                    {Array.from({ length: count }).map((_, ci) => {
                      const isFaceUp = showFirstCard && ci === 0;
                      const actualCard = p.hands[0]?.cards[ci];
                      return (
                        <motion.div
                          key={ci}
                          initial={{ opacity: 0, y: -60, scale: 0.5 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          transition={{ type: "spring", damping: 15, stiffness: 200 }}
                        >
                          <PlayingCard
                            card={isFaceUp && actualCard ? { ...actualCard, faceUp: true } : { rank: "A", suit: "spades", faceUp: false }}
                            index={ci}
                          />
                        </motion.div>
                      );
                    })}
                    {count === 0 && (
                      <div className="w-[66px] h-[96px] rounded-lg border border-dashed border-border/30" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default DealingAnimation;
