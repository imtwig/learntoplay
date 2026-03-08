import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Plus, Lock, Users, Play } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { getGame, type GameId } from "@/lib/gameData";
import { gameRules } from "@/lib/gameRules";

const GameLobby = () => {
  const { gameId } = useParams<{ gameId: string }>();
  const navigate = useNavigate();
  const game = getGame(gameId as GameId);
  const [roomName, setRoomName] = useState("");
  const [roomPassword, setRoomPassword] = useState("");
  const [playerName, setPlayerName] = useState("");
  const [createOpen, setCreateOpen] = useState(false);

  if (!game) {
    navigate("/");
    return null;
  }

  const Icon = game.icon;
  const rules = gameRules[game.id];

  const handleCreate = () => {
    if (!roomName.trim() || !playerName.trim()) return;
    // TODO: create room via Supabase
    setCreateOpen(false);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/30">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-3">
            <Icon className={`h-6 w-6 ${game.color}`} />
            <h1 className="text-xl font-display font-bold tracking-wider">
              {game.name}
            </h1>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-2xl space-y-8">
        {/* How to Play */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Accordion type="single" collapsible>
            <AccordionItem value="rules" className="border-border/50">
              <AccordionTrigger className="font-display text-sm tracking-wider hover:no-underline">
                HOW TO PLAY
              </AccordionTrigger>
              <AccordionContent>
                <div className="prose prose-sm prose-invert max-w-none space-y-3 text-muted-foreground">
                  {rules.map((section, i) => (
                    <div key={i}>
                      <h4 className="text-foreground font-display text-xs tracking-wider mb-1">
                        {section.title}
                      </h4>
                      <p className="text-sm leading-relaxed">{section.content}</p>
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </motion.section>

        {/* Active Rooms */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-sm tracking-wider">ACTIVE ROOMS</h2>
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="font-display text-xs tracking-wider gap-2">
                  <Plus className="h-4 w-4" />
                  Create Room
                </Button>
              </DialogTrigger>
              <DialogContent className="glass">
                <DialogHeader>
                  <DialogTitle className="font-display tracking-wider">
                    Create Room
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-2">
                  <div className="space-y-2">
                    <Label>Your Name</Label>
                    <Input
                      placeholder="Enter your display name"
                      value={playerName}
                      onChange={(e) => setPlayerName(e.target.value)}
                      maxLength={20}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Room Name</Label>
                    <Input
                      placeholder="e.g. Friday Night Poker"
                      value={roomName}
                      onChange={(e) => setRoomName(e.target.value)}
                      maxLength={30}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Password (optional)</Label>
                    <Input
                      type="password"
                      placeholder="Leave blank for public"
                      value={roomPassword}
                      onChange={(e) => setRoomPassword(e.target.value)}
                    />
                  </div>
                  <Button
                    onClick={handleCreate}
                    className="w-full font-display text-sm tracking-wider"
                    disabled={!roomName.trim() || !playerName.trim()}
                  >
                    Create &amp; Enter Room
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {/* Empty state */}
          <div className="rounded-xl border border-dashed border-border/50 p-12 text-center">
            <Play className="h-8 w-8 mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-muted-foreground text-sm">
              No active rooms yet. Create one to get started!
            </p>
          </div>
        </motion.section>
      </main>
    </div>
  );
};

export default GameLobby;
