import { motion } from "framer-motion";
import { Gamepad2 } from "lucide-react";
import GameCard from "@/components/GameCard";
import { games } from "@/lib/gameData";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <header className="relative overflow-hidden border-b border-border/30">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent" />
        <div className="relative container mx-auto px-4 py-16 md:py-24 text-center">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="flex items-center justify-center gap-3 mb-6"
          >
            <Gamepad2 className="h-8 w-8 text-primary" />
            <h1 className="text-3xl md:text-5xl font-display font-black tracking-wider text-glow">
              GAME NIGHT
            </h1>
          </motion.div>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-muted-foreground text-lg max-w-md mx-auto"
          >
            Play classic card &amp; board games with friends — right in your browser.
          </motion.p>
        </div>
      </header>

      {/* Games Grid */}
      <main className="container mx-auto px-4 py-12 md:py-16">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 max-w-5xl mx-auto">
          {games.map((game, i) => (
            <GameCard key={game.id} game={game} index={i} />
          ))}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/30 bg-card/30">
        <div className="container mx-auto px-4 py-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Gamepad2 className="h-5 w-5 text-primary" />
            <span className="font-display font-bold tracking-wider text-sm">GAME NIGHT</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            <Link to="/prd" className="hover:text-foreground transition-colors">
              PRDs
            </Link>
            <span>© {new Date().getFullYear()} Game Night</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
