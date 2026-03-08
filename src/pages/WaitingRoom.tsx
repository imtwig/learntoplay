import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Crown, Users, Copy, Play, LogOut, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRoom, leaveRoom, startGame, sessionId, toggleReady } from "@/hooks/useRoom";
import { getGame, type GameId } from "@/lib/gameData";
import { toast } from "@/hooks/use-toast";

const WaitingRoom = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const { room, players, loading } = useRoom(roomId);
  const [myPlayerId, setMyPlayerId] = useState<string | null>(null);

  const game = room ? getGame(room.game_type as GameId) : null;

  useEffect(() => {
    const me = players.find((p) => p.session_id === sessionId);
    if (me) setMyPlayerId(me.id);
  }, [players]);

  useEffect(() => {
    if (room?.status === "closed") {
      toast({ title: "Room closed", description: "The host has closed the room." });
      navigate(game ? `/game/${game.id}` : "/");
    }
    if (room?.status === "in_progress") {
      navigate(`/play/${roomId}`);
    }
  }, [room?.status, navigate, game, roomId]);

  const minPlayers = game?.minPlayers ?? 2;
  const canStart = players.length >= minPlayers;
  const myPlayer = players.find((p) => p.session_id === sessionId);
  const iAmReady = (myPlayer?.player_state as any)?.ready === true;
  const allReady = players.length > 0 && players.every((p) => (p.player_state as any)?.ready === true);

  const handleLeave = async () => {
    if (myPlayerId && roomId) {
      await leaveRoom(myPlayerId, roomId);
      navigate(game ? `/game/${game.id}` : "/");
    }
  };

  const handleToggleReady = async () => {
    if (myPlayerId) {
      await toggleReady(myPlayerId, !iAmReady);
    }
  };

  const handleStart = async () => {
    if (roomId) {
      await startGame(roomId);
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    toast({ title: "Link copied!", description: "Share it with friends to join." });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground font-display tracking-wider">
          Loading...
        </div>
      </div>
    );
  }

  if (!room || !game) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-muted-foreground">Room not found</p>
          <Button onClick={() => navigate("/")}>Back to Home</Button>
        </div>
      </div>
    );
  }

  const Icon = game.icon;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/30">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Icon className={`h-5 w-5 ${game.color}`} />
            <h1 className="font-display text-lg tracking-wider">{room.room_name}</h1>
          </div>
          <Button variant="ghost" size="sm" onClick={handleLeave} className="gap-2 text-destructive">
            <LogOut className="h-4 w-4" />
            Leave
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-md space-y-8">
        {/* Status */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center space-y-2"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-secondary text-sm">
            <div className="h-2 w-2 rounded-full bg-primary animate-pulse-glow" />
            <span className="font-display text-xs tracking-wider">WAITING FOR PLAYERS</span>
          </div>
          <p className="text-muted-foreground text-sm">
            {players.length}/{game.maxPlayers} players •{" "}
            {canStart
              ? allReady
                ? "Everyone is ready!"
                : "Waiting for everyone to ready up"
              : `Need ${minPlayers - players.length} more`}
          </p>
        </motion.div>

        {/* Players */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Users className="h-4 w-4" />
            <span className="font-display text-xs tracking-wider">PLAYERS</span>
          </div>
          <div className="space-y-2">
            {players.map((player, i) => {
              const isReady = (player.player_state as any)?.ready === true;
              return (
                <motion.div
                  key={player.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className={`flex items-center gap-3 p-3 rounded-xl border ${
                    isReady
                      ? "border-primary/50 bg-primary/5"
                      : player.session_id === sessionId
                        ? "border-border/50 bg-card/50"
                        : "border-border/50 bg-card/50"
                  }`}
                >
                  <div className="h-10 w-10 rounded-lg bg-secondary flex items-center justify-center font-display text-sm font-bold">
                    {player.display_name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-sm">
                      {player.display_name}
                      {player.session_id === sessionId && (
                        <span className="text-primary ml-2 text-xs">(You)</span>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {player.is_host && (
                      <Crown className="h-4 w-4 text-game-gold" />
                    )}
                    {isReady ? (
                      <Check className="h-4 w-4 text-primary" />
                    ) : (
                      <span className="text-xs text-muted-foreground">not ready</span>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-3">
          <Button
            variant="outline"
            className="w-full gap-2 font-display text-xs tracking-wider"
            onClick={handleCopyLink}
          >
            <Copy className="h-4 w-4" />
            Copy Invite Link
          </Button>

          {!iAmReady ? (
            <Button
              className="w-full gap-2 font-display text-sm tracking-wider"
              onClick={handleToggleReady}
            >
              <Check className="h-4 w-4" />
              Ready
            </Button>
          ) : (
            <Button
              variant="outline"
              className="w-full gap-2 font-display text-sm tracking-wider"
              onClick={handleToggleReady}
            >
              <X className="h-4 w-4" />
              Unready
            </Button>
          )}

          {canStart && allReady && (
            <Button
              className="w-full gap-2 font-display text-sm tracking-wider bg-primary"
              onClick={handleStart}
            >
              <Play className="h-4 w-4" />
              Start Game
            </Button>
          )}
        </div>
      </main>
    </div>
  );
};

export default WaitingRoom;
