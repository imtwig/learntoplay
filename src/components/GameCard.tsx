import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { GameInfo } from "@/lib/gameData";

interface GameCardProps {
  game: GameInfo;
  index: number;
}

const GameCard = ({ game, index }: GameCardProps) => {
  const navigate = useNavigate();
  const Icon = game.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.15 }}
      className="card-hover"
    >
      <div
        className={`relative overflow-hidden rounded-2xl border border-border/50 bg-gradient-to-br ${game.gradient} backdrop-blur-sm`}
        style={{ boxShadow: "var(--shadow-card)" }}
      >
        <div className="absolute inset-0 bg-card/60" />
        <div className="relative p-6 md:p-8">
          <div className="flex items-start justify-between mb-6">
            <div
              className={`flex h-14 w-14 items-center justify-center rounded-xl bg-secondary/80 ${game.color}`}
            >
              <Icon className="h-7 w-7" />
            </div>
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Users className="h-4 w-4" />
              <span>
                {game.minPlayers}–{game.maxPlayers}
              </span>
            </div>
          </div>

          <h3 className="text-xl font-display font-bold tracking-wide mb-1">
            {game.name}
          </h3>
          <p className="text-xs uppercase tracking-widest text-muted-foreground mb-3">
            {game.tagline}
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed mb-6">
            {game.description}
          </p>

          <Button
            onClick={() => navigate(`/game/${game.id}`)}
            className="w-full font-display text-sm tracking-wider"
          >
            Enter Lobby
          </Button>
        </div>
      </div>
    </motion.div>
  );
};

export default GameCard;
