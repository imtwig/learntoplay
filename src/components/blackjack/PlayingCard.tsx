import { motion } from "framer-motion";
import { type Card, suitSymbol, suitColor } from "@/lib/cards";

interface PlayingCardProps {
  card: Card;
  index?: number;
  small?: boolean;
}

const PlayingCard = ({ card, index = 0, small = false }: PlayingCardProps) => {
  const isRed = suitColor[card.suit] === "red";

  if (!card.faceUp) {
    return (
      <motion.div
        initial={{ rotateY: 180, opacity: 0 }}
        animate={{ rotateY: 0, opacity: 1 }}
        transition={{ duration: 0.3, delay: index * 0.1 }}
        className={`${small ? "w-12 h-[72px]" : "w-[66px] h-[96px]"} rounded-lg bg-gradient-to-br from-primary/80 to-accent/60 border border-border/50 flex items-center justify-center shadow-lg`}
      >
        <div className="w-[80%] h-[80%] rounded border border-primary-foreground/20 bg-primary/40 flex items-center justify-center">
          <span className="text-primary-foreground/50 text-xs font-display">♠♥</span>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ rotateY: 180, opacity: 0, y: -20 }}
      animate={{ rotateY: 0, opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.1 }}
      className={`${small ? "w-12 h-[68px] text-xs" : "w-16 h-[92px] text-sm"} rounded-lg bg-foreground border border-border/30 shadow-lg flex flex-col justify-between p-1.5 select-none`}
    >
      <div className={`font-bold leading-none ${isRed ? "text-game-red" : "text-background"}`}>
        <div>{card.rank}</div>
        <div className={small ? "text-[10px]" : "text-xs"}>{suitSymbol[card.suit]}</div>
      </div>
      <div className={`text-center ${isRed ? "text-game-red" : "text-background"} ${small ? "text-lg" : "text-2xl"}`}>
        {suitSymbol[card.suit]}
      </div>
      <div className={`font-bold leading-none self-end rotate-180 ${isRed ? "text-game-red" : "text-background"}`}>
        <div>{card.rank}</div>
        <div className={small ? "text-[10px]" : "text-xs"}>{suitSymbol[card.suit]}</div>
      </div>
    </motion.div>
  );
};

export default PlayingCard;
