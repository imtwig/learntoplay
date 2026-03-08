import { useParams, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { useRoom, leaveRoom, sessionId } from "@/hooks/useRoom";
import { useBlackjack } from "@/hooks/useBlackjack";
import { getGame, type GameId } from "@/lib/gameData";
import BlackjackTable from "@/components/blackjack/BlackjackTable";

const GamePlay = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const { room, players, loading } = useRoom(roomId);
  const game = room ? getGame(room.game_type as GameId) : null;

  const {
    gameState,
    myBJPlayer,
    availableActions,
    isHost,
    myBet,
    setMyBet,
    initGame,
    startRound,
    doAction,
    nextRound,
  } = useBlackjack(roomId, players);

  // Host initializes the game on first load
  useEffect(() => {
    if (isHost && players.length > 0 && !gameState) {
      initGame();
    }
  }, [isHost, players.length, gameState, initGame]);

  const handleLeave = async () => {
    const me = players.find((p) => p.session_id === sessionId);
    if (me && roomId) {
      await leaveRoom(me.id, roomId);
    }
    navigate(game ? `/game/${game.id}` : "/");
  };

  if (loading || !room || !game) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground font-display animate-pulse">Loading game...</p>
      </div>
    );
  }

  if (!gameState) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground font-display animate-pulse">Setting up table...</p>
      </div>
    );
  }

  if (room.game_type === "blackjack") {
    return (
      <BlackjackTable
        gameState={gameState}
        myBJPlayer={myBJPlayer}
        availableActions={availableActions}
        isHost={isHost}
        myBet={myBet}
        setMyBet={setMyBet}
        onAction={doAction}
        onStartRound={startRound}
        onNextRound={nextRound}
        onLeave={handleLeave}
      />
    );
  }

  // Fallback for other games
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center space-y-4">
        <h1 className="text-2xl font-display font-bold tracking-wider">{game.name}</h1>
        <p className="text-muted-foreground">Game in progress — {players.length} players</p>
        <p className="text-sm text-muted-foreground">Game UI coming next! 🎮</p>
      </div>
    </div>
  );
};

export default GamePlay;
