import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useCallback } from "react";
import { useRoom, leaveRoom, sessionId, transferHost } from "@/hooks/useRoom";
import { useBlackjack } from "@/hooks/useBlackjack";
import { useSequence } from "@/hooks/useSequence";
import { usePoker } from "@/hooks/usePoker";
import { getGame, type GameId } from "@/lib/gameData";
import BlackjackTable from "@/components/blackjack/BlackjackTable";
import SequenceTable from "@/components/sequence/SequenceTable";
import PokerTable from "@/components/poker/PokerTable";

const GamePlay = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const { room, players, loading } = useRoom(roomId);
  const game = room ? getGame(room.game_type as GameId) : null;
  const isSequence = room?.game_type === "sequence";
  const isPoker = room?.game_type === "poker";

  const blackjack = useBlackjack(roomId, (isSequence || isPoker) ? [] : players);
  const sequence = useSequence(roomId, isSequence ? players : []);
  const poker = usePoker(roomId, isPoker ? players : []);

  const myPlayer = players.find((p) => p.session_id === sessionId);

  // Init game
  useEffect(() => {
    if (isSequence) {
      if (sequence.isHost && players.length > 0 && !sequence.gameState) {
        sequence.initGame(room?.settings as Record<string, unknown> | undefined);
      }
    } else if (isPoker) {
      if (poker.isHost && players.length > 0 && !poker.gameState) {
        poker.initGame(room?.settings as Record<string, unknown> | undefined);
      }
    } else {
      if (blackjack.isHost && players.length > 0 && !blackjack.gameState) {
        blackjack.initGame();
      }
    }
  }, [isSequence, isPoker, sequence.isHost, blackjack.isHost, poker.isHost, players.length, sequence.gameState, blackjack.gameState, poker.gameState, sequence.initGame, blackjack.initGame, poker.initGame, room?.settings]);

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

  // Sequence game
  if (isSequence) {
    if (!sequence.gameState) {
      return (
        <div className="min-h-screen bg-background flex items-center justify-center">
          <p className="text-muted-foreground font-display animate-pulse">Setting up board...</p>
        </div>
      );
    }

    return (
      <SequenceTable
        gameState={sequence.gameState}
        mySeqPlayer={sequence.mySeqPlayer}
        isHost={sequence.isHost}
        isMyTurn={sequence.isMyTurn}
        selectedCardIndex={sequence.selectedCardIndex}
        validPlacements={sequence.validPlacements}
        previewPlacements={sequence.previewPlacements}
        selectedCardIsDead={sequence.selectedCardIsDead}
        onSelectCard={sequence.setSelectedCardIndex}
        onPlayCard={sequence.doPlayCard}
        onDiscardDead={sequence.doDiscardDead}
        onSetTeam={sequence.doSetTeam}
        onStartGame={sequence.doStartGame}
        onRematch={sequence.doRematch}
        onLeave={handleLeave}
        players={players}
        myPlayerId={myPlayer?.id}
      />
    );
  }

  // Blackjack game
  if (!blackjack.gameState) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground font-display animate-pulse">Setting up table...</p>
      </div>
    );
  }

  if (room.game_type === "blackjack") {
    return (
      <BlackjackTable
        gameState={blackjack.gameState}
        rawSettings={blackjack.rawSettings}
        myBJPlayer={blackjack.myBJPlayer}
        availableActions={blackjack.availableActions}
        isHost={blackjack.isHost}
        myBetInput={blackjack.myBetInput}
        setMyBetInput={blackjack.setMyBetInput}
        onAction={blackjack.doAction}
        onMarkReady={blackjack.markReady}
        onMarkUnready={blackjack.markUnready}
        onStartRound={blackjack.startRound}
        onNextRound={blackjack.nextRound}
        onRevealPlayer={blackjack.doRevealPlayer}
        onRevealAll={blackjack.doRevealAll}
        onLeave={handleLeave}
        onTransferHost={handleTransferHost}
        onToggleShowFirstCard={blackjack.doToggleShowFirstCard}
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
