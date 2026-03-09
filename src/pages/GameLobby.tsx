import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Plus, Lock, Users, Play, Unlock } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { type SeqHouseRules, DEFAULT_HOUSE_RULES } from "@/lib/sequence";
import { type ADDHouseRules, DEFAULT_ADD_HOUSE_RULES } from "@/lib/assholeDaiDi";
import { type DDHouseRules, type DDPenaltyMultipliers, DEFAULT_DD_HOUSE_RULES, DEFAULT_DD_PENALTIES } from "@/lib/daiDi";
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
import { useRooms, createRoom, joinRoom, sessionId } from "@/hooks/useRoom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

const GameLobby = () => {
  const { gameId } = useParams<{ gameId: string }>();
  const navigate = useNavigate();
  const game = getGame(gameId as GameId);
  const { rooms, loading } = useRooms(gameId as GameId);
  const [roomName, setRoomName] = useState("");
  const [roomPassword, setRoomPassword] = useState("");
  const [playerName, setPlayerName] = useState(() => localStorage.getItem("player_name") || "");
  const [createOpen, setCreateOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [joinRoomId, setJoinRoomId] = useState("");
  const [joinPassword, setJoinPassword] = useState("");
  const [creating, setCreating] = useState(false);
  const [houseRules, setHouseRules] = useState<SeqHouseRules>({ jokers: false, allJacksRemove: false, removeFromSequence: false });
  const [addHouseRules, setAddHouseRules] = useState<ADDHouseRules>({ allowEndOn2: false });
  const [ddHouseRules, setDdHouseRules] = useState<DDHouseRules>({ ...DEFAULT_DD_HOUSE_RULES });
  const [ddPenalties, setDdPenalties] = useState<DDPenaltyMultipliers>({ ...DEFAULT_DD_PENALTIES });
  const [bjShowFirstCard, setBjShowFirstCard] = useState(false);

  if (!game) {
    navigate("/");
    return null;
  }

  const Icon = game.icon;
  const rules = gameRules[game.id];

  const handleCreate = async () => {
    if (!roomName.trim() || !playerName.trim()) return;
    setCreating(true);
    try {
      localStorage.setItem("player_name", playerName);
      const settings: Record<string, unknown> = {};
      const anyActive = houseRules.jokers || houseRules.allJacksRemove || houseRules.removeFromSequence;
      if (game.id === "sequence" && anyActive) {
        settings.houseRules = houseRules;
      }
      if (game.id === "asshole_daidi") {
        if (addHouseRules.allowEndOn2) {
          settings.houseRules = addHouseRules;
        }
      }
      if (game.id === "dai_di") {
        settings.houseRules = ddHouseRules;
        settings.penalties = ddPenalties;
      }
      if (game.id === "blackjack") {
        settings.showFirstCard = bjShowFirstCard;
      }
      const { room } = await createRoom(
        game.id,
        roomName.trim(),
        playerName.trim(),
        roomPassword || undefined,
        settings,
        game.maxPlayers
      );
      setCreateOpen(false);
      navigate(`/room/${room.id}`);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  const handleJoin = async (roomId: string, hasPassword: boolean, status: string) => {
    // In-progress games: go directly to play page (useRoom reconnect handles the rest)
    if (status === "in_progress") {
      if (!playerName.trim()) {
        toast({ title: "Enter your name", description: "Set your display name first.", variant: "destructive" });
        return;
      }
      localStorage.setItem("player_name", playerName);
      // Try to reconnect existing player, or create a new one
      try {
        const { data: existing } = await supabase
          .from("players")
          .select("id")
          .eq("room_id", roomId)
          .eq("session_id", sessionId)
          .limit(1);
        if (existing && existing.length > 0) {
          await supabase
            .from("players")
            .update({ connected: true })
            .eq("id", existing[0].id);
        } else {
          // New player joining in-progress game
          const { count } = await supabase
            .from("players")
            .select("*", { count: "exact", head: true })
            .eq("room_id", roomId);
          await supabase.from("players").insert({
            room_id: roomId,
            display_name: playerName.trim(),
            session_id: sessionId,
            is_host: false,
            join_order: count ?? 0,
          });
        }
      } catch (err: any) {
        toast({ title: "Error", description: err.message, variant: "destructive" });
        return;
      }
      navigate(`/play/${roomId}`);
      return;
    }
    if (hasPassword) {
      setJoinRoomId(roomId);
      setJoinOpen(true);
      return;
    }
    await doJoin(roomId);
  };

  const doJoin = async (roomId: string, password?: string) => {
    if (!playerName.trim()) {
      toast({ title: "Enter your name", description: "Set your display name first.", variant: "destructive" });
      return;
    }
    try {
      localStorage.setItem("player_name", playerName);
      await joinRoom(roomId, playerName.trim(), password);
      setJoinOpen(false);
      navigate(`/room/${roomId}`);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/30">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-3">
            <Icon className={`h-6 w-6 ${game.color}`} />
            <h1 className="text-xl font-display font-bold tracking-wider">{game.name}</h1>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-2xl space-y-8">
        {/* Player name input */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="space-y-2">
            <Label className="font-display text-xs tracking-wider">YOUR NAME</Label>
            <Input
              placeholder="Enter your display name"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              maxLength={20}
              className="max-w-xs"
            />
          </div>
        </motion.div>

        {/* How to Play */}
        <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <Accordion type="single" collapsible>
            <AccordionItem value="rules" className="border-border/50">
              <AccordionTrigger className="font-display text-sm tracking-wider hover:no-underline">
                HOW TO PLAY
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-3 text-muted-foreground">
                  {rules.map((section, i) => (
                    <div key={i}>
                      <h4 className="text-foreground font-display text-xs tracking-wider mb-1">{section.title}</h4>
                      <p className="text-sm leading-relaxed">{section.content}</p>
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </motion.section>

        {/* Active Rooms */}
        <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
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
                  <DialogTitle className="font-display tracking-wider">Create Room</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-2">
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
                  {game.id === "sequence" && (
                    <div className="rounded-lg border border-border/50 px-3 py-2 space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-medium">House Rules</Label>
                        <button
                          type="button"
                          className="text-[10px] font-display tracking-wider text-primary hover:underline"
                          onClick={() => {
                            const allOn = houseRules.jokers && houseRules.allJacksRemove && houseRules.removeFromSequence;
                            if (allOn) {
                              setHouseRules({ jokers: false, allJacksRemove: false, removeFromSequence: false });
                            } else {
                              setHouseRules({ ...DEFAULT_HOUSE_RULES });
                            }
                          }}
                        >
                          {houseRules.jokers && houseRules.allJacksRemove && houseRules.removeFromSequence ? "Deselect All" : "Select All"}
                        </button>
                      </div>
                      <div className="space-y-1.5">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <Checkbox
                            checked={houseRules.jokers}
                            onCheckedChange={(v) => setHouseRules((prev) => ({ ...prev, jokers: !!v }))}
                          />
                          <span className="text-[11px] text-muted-foreground">4 Jokers as wild cards</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <Checkbox
                            checked={houseRules.allJacksRemove}
                            onCheckedChange={(v) => setHouseRules((prev) => ({ ...prev, allJacksRemove: !!v }))}
                          />
                          <span className="text-[11px] text-muted-foreground">All Jacks are removal cards</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <Checkbox
                            checked={houseRules.removeFromSequence}
                            onCheckedChange={(v) => setHouseRules((prev) => ({ ...prev, removeFromSequence: !!v }))}
                          />
                          <span className="text-[11px] text-muted-foreground">Can remove chips from sequences</span>
                        </label>
                      </div>
                    </div>
                  )}
                  {game.id === "asshole_daidi" && (
                    <div className="rounded-lg border border-border/50 px-3 py-2 space-y-2">
                      <Label className="text-sm font-medium">House Rules</Label>
                      <div className="space-y-1.5">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <Checkbox
                            checked={addHouseRules.allowEndOn2}
                            onCheckedChange={(v) => setAddHouseRules((prev) => ({ ...prev, allowEndOn2: !!v }))}
                          />
                          <span className="text-[11px] text-muted-foreground">Allow ending round on a 2</span>
                        </label>
                      </div>
                    </div>
                  )}
                  {game.id === "dai_di" && (
                    <div className="rounded-lg border border-border/50 px-3 py-2 space-y-3">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-medium">House Rules</Label>
                        <button
                          type="button"
                          className="text-[10px] font-display tracking-wider text-primary hover:underline"
                          onClick={() => {
                            const allOn = ddHouseRules.allowEndOn2 && ddHouseRules.allowTriples;
                            setDdHouseRules({ allowEndOn2: !allOn, allowTriples: !allOn });
                          }}
                        >
                          {ddHouseRules.allowEndOn2 && ddHouseRules.allowTriples ? "Deselect All" : "Select All"}
                        </button>
                      </div>
                      <div className="space-y-1.5">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <Checkbox
                            checked={ddHouseRules.allowEndOn2}
                            onCheckedChange={(v) => setDdHouseRules((prev) => ({ ...prev, allowEndOn2: !!v }))}
                          />
                          <span className="text-[11px] text-muted-foreground">Allow ending round on a 2</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <Checkbox
                            checked={ddHouseRules.allowTriples}
                            onCheckedChange={(v) => setDdHouseRules((prev) => ({ ...prev, allowTriples: !!v }))}
                          />
                          <span className="text-[11px] text-muted-foreground">Allow triples</span>
                        </label>
                      </div>
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-medium">Penalty Multipliers</Label>
                        <button
                          type="button"
                          className="text-[10px] font-display tracking-wider text-primary hover:underline"
                          onClick={() => {
                            const allOn = ddPenalties.tenPlusCards && ddPenalties.thirteenCards && ddPenalties.twosSurcharge;
                            setDdPenalties({ tenPlusCards: !allOn, thirteenCards: !allOn, twosSurcharge: !allOn });
                          }}
                        >
                          {ddPenalties.tenPlusCards && ddPenalties.thirteenCards && ddPenalties.twosSurcharge ? "Deselect All" : "Select All"}
                        </button>
                      </div>
                      <div className="space-y-1.5">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <Checkbox
                            checked={ddPenalties.tenPlusCards}
                            onCheckedChange={(v) => setDdPenalties((prev) => ({ ...prev, tenPlusCards: !!v }))}
                          />
                          <span className="text-[11px] text-muted-foreground">10+ cards ×2 penalty</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <Checkbox
                            checked={ddPenalties.thirteenCards}
                            onCheckedChange={(v) => setDdPenalties((prev) => ({ ...prev, thirteenCards: !!v }))}
                          />
                          <span className="text-[11px] text-muted-foreground">13 cards ×3 penalty</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <Checkbox
                            checked={ddPenalties.twosSurcharge}
                            onCheckedChange={(v) => setDdPenalties((prev) => ({ ...prev, twosSurcharge: !!v }))}
                          />
                          <span className="text-[11px] text-muted-foreground">+2 per 2 held surcharge</span>
                        </label>
                      </div>
                    </div>
                  )}
                  {game.id === "blackjack" && (
                    <div className="rounded-lg border border-border/50 px-3 py-2 space-y-2">
                      <Label className="text-sm font-medium">House Rules</Label>
                      <div className="space-y-1.5">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <Checkbox
                            checked={bjShowFirstCard}
                            onCheckedChange={(v) => setBjShowFirstCard(!!v)}
                          />
                          <span className="text-[11px] text-muted-foreground">Show everyone's first card</span>
                        </label>
                      </div>
                    </div>
                  )}
                  <Button
                    onClick={handleCreate}
                    className="w-full font-display text-sm tracking-wider"
                    disabled={!roomName.trim() || !playerName.trim() || creating}
                  >
                    {creating ? "Creating..." : "Create & Enter Room"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {loading ? (
            <div className="text-center py-12 text-muted-foreground text-sm">Loading rooms...</div>
          ) : rooms.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border/50 p-12 text-center">
              <Play className="h-8 w-8 mx-auto text-muted-foreground/50 mb-3" />
              <p className="text-muted-foreground text-sm">No active rooms yet. Create one to get started!</p>
            </div>
          ) : (
            <div className="space-y-2">
              {rooms.map((room) => (
                <button
                  key={room.id}
                  onClick={() => handleJoin(room.id, !!room.password_hash, room.status)}
                  className="w-full flex items-center gap-4 p-4 rounded-xl border border-border/50 bg-card/50 hover:bg-card/80 transition-colors text-left"
                >
                  {room.password_hash ? (
                    <Lock className="h-4 w-4 text-game-gold shrink-0" />
                  ) : (
                    <Unlock className="h-4 w-4 text-muted-foreground shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{room.room_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {room.status === "waiting" ? "Waiting" : "In Progress"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {room.status === "in_progress" && (
                      <span className="text-xs font-display tracking-wider text-primary bg-primary/10 px-2 py-1 rounded">
                        RESUME
                      </span>
                    )}
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Users className="h-4 w-4" />
                      <span>{room.player_count}/{room.max_players}</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </motion.section>

        {/* Join password dialog */}
        <Dialog open={joinOpen} onOpenChange={setJoinOpen}>
          <DialogContent className="glass">
            <DialogHeader>
              <DialogTitle className="font-display tracking-wider">Enter Password</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <Input
                type="password"
                placeholder="Room password"
                value={joinPassword}
                onChange={(e) => setJoinPassword(e.target.value)}
              />
              <Button
                onClick={() => doJoin(joinRoomId, joinPassword)}
                className="w-full font-display text-sm tracking-wider"
                disabled={!joinPassword}
              >
                Join Room
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
};

export default GameLobby;
