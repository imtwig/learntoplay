import { motion, AnimatePresence } from "framer-motion";
import { PartyPopper, Frown, Shield } from "lucide-react";

interface Props {
  roundProfit: number;
  visible: boolean;
}

const RoundResultOverlay = ({ roundProfit, visible }: Props) => {
  if (!visible) return null;

  const isWin = roundProfit > 0;
  const isLoss = roundProfit < 0;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none bg-background/70 backdrop-blur-sm"
        >
          <motion.div
            initial={{ scale: 0.5, opacity: 0, y: 30 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.8, opacity: 0, y: -20 }}
            transition={{ type: "spring", damping: 12, stiffness: 200 }}
            className="flex flex-col items-center gap-3"
          >
            {isWin && (
              <>
                {/* Confetti-like particles */}
                {[...Array(8)].map((_, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 1, x: 0, y: 0 }}
                    animate={{
                      opacity: 0,
                      x: (Math.random() - 0.5) * 200,
                      y: (Math.random() - 0.5) * 200,
                      rotate: Math.random() * 360,
                    }}
                    transition={{ duration: 1.5, delay: i * 0.05 }}
                    className="absolute w-3 h-3 rounded-full"
                    style={{
                      backgroundColor: ["hsl(var(--primary))", "hsl(var(--game-gold, 45 100% 60%))", "hsl(var(--accent))"][i % 3],
                    }}
                  />
                ))}
                <motion.div
                  animate={{ rotate: [0, -10, 10, -10, 0] }}
                  transition={{ duration: 0.5, delay: 0.2 }}
                >
                  <PartyPopper className="h-16 w-16 text-primary" />
                </motion.div>
                <motion.p
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="text-3xl font-display font-bold text-primary tracking-wider"
                >
                  +${roundProfit}
                </motion.p>
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 }}
                  className="text-sm font-display text-muted-foreground tracking-wider"
                >
                  YOU WON!
                </motion.p>
              </>
            )}

            {isLoss && (
              <>
                <motion.div
                  animate={{ y: [0, 5, 0] }}
                  transition={{ duration: 1, repeat: 1 }}
                >
                  <Frown className="h-16 w-16 text-destructive" />
                </motion.div>
                <motion.p
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="text-3xl font-display font-bold text-destructive tracking-wider"
                >
                  ${roundProfit}
                </motion.p>
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 }}
                  className="text-sm font-display text-muted-foreground tracking-wider"
                >
                  BETTER LUCK NEXT TIME
                </motion.p>
              </>
            )}

            {!isWin && !isLoss && (
              <>
                <motion.div
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ duration: 0.8, repeat: 1 }}
                >
                  <Shield className="h-16 w-16 text-muted-foreground" />
                </motion.div>
                <motion.p
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="text-xl font-display font-bold text-muted-foreground tracking-wider"
                >
                  $0
                </motion.p>
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 }}
                  className="text-sm font-display text-muted-foreground tracking-wider"
                >
                  PHEW, YOU LIVED TO SEE ANOTHER DAY
                </motion.p>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default RoundResultOverlay;
