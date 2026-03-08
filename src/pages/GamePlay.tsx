import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useCallback } from "react";
import { useRoom, leaveRoom, sessionId, transferHost } from "@/hooks/useRoom";
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
    rawSettings,
    myBJPlayer,
    availableActions,
    isHost,
    myBetInput,
    setMyBetInput,
    initGame,
    markReady,
    markUnready,
    startRound,
    doAction,
    doRevealPlayer,
    doRevealAll,
    nextRound,
    doToggleShowFirstCard,
  } = useBlackjack(roomId, players);

  const myPlayer = players.find((p) => p.session_id === sessionId);

  useEffect(() => {
    if (isHost && players.length > 0 && !gameState) {
      initGame();
    }
  }, [isHost, players.length, gameState, initGame]);

  const handleLeave = async () => {
    if (myPlayer && roomId) {
      await leaveRoom(myPlayer.id, roomId);
    }
    navigate(game ? `/game/${game.id}` : "/");
  };

  const handleTransferHost = useCallback(async (targetPlayerId: string) => {
    if (!roomId || !myPlayer) return;
    await transferHost(roomId, myPlayer.id, targetPlayerId);
  }, [roomId, myPlayer]);

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
        myBetInput={myBetInput}
        setMyBetInput={setMyBetInput}
        onAction={doAction}
        onMarkReady={markReady}
        onMarkUnready={markUnready}
        onStartRound={startRound}
        onNextRound={nextRound}
        onRevealPlayer={doRevealPlayer}
        onRevealAll={doRevealAll}
        onLeave={handleLeave}
        onTransferHost={handleTransferHost}
        players={players}
        myPlayerId={myPlayer?.id}
      />
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center space-y-4">
        <h1 className="text-2xl font-display font-bold tracking-wider">{game.name}</h1>
        <p className="text-muted-foreground">Game in progress — {players.length} players</p>
      </div>
    </div>
  );
};

export default GamePlay;
