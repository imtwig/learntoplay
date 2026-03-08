import { useParams } from "react-router-dom";
import { useRoom } from "@/hooks/useRoom";
import { getGame, type GameId } from "@/lib/gameData";

const GamePlay = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const { room, players } = useRoom(roomId);
  const game = room ? getGame(room.game_type as GameId) : null;

  if (!room || !game) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground font-display">Loading game...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center space-y-4">
        <h1 className="text-2xl font-display font-bold tracking-wider">
          {game.name}
        </h1>
        <p className="text-muted-foreground">
          Game in progress — {players.length} players
        </p>
        <p className="text-sm text-muted-foreground">
          Game UI coming next! 🎮
        </p>
      </div>
    </div>
  );
};

export default GamePlay;
