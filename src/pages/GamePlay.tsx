import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useCallback } from "react";
import { useRoom, leaveRoom, sessionId, transferHost, kickPlayer } from "@/hooks/useRoom";
import { useBlackjack } from "@/hooks/useBlackjack";
import { useSequence } from "@/hooks/useSequence";
import { usePoker } from "@/hooks/usePoker";
import { useAssholeDaiDi } from "@/hooks/useAssholeDaiDi";
import { useDaiDi } from "@/hooks/useDaiDi";
import { getGame, type GameId } from "@/lib/gameData";
import BlackjackTable from "@/components/blackjack/BlackjackTable";
import SequenceTable from "@/components/sequence/SequenceTable";
import PokerTable from "@/components/poker/PokerTable";
import AssholeDaiDiTable from "@/components/asshole-daidi/AssholeDaiDiTable";
import DaiDiTable from "@/components/dai-di/DaiDiTable";

const GamePlay = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const { room, players, loading } = useRoom(roomId);
  const game = room ? getGame(room.game_type as GameId) : null;
  const isSequence = room?.game_type === "sequence";
  const isPoker = room?.game_type === "poker";
  const isADD = room?.game_type === "asshole_daidi";
  const isDD = room?.game_type === "dai_di";

  const blackjack = useBlackjack(roomId, (isSequence || isPoker || isADD || isDD) ? [] : players);
  const sequence = useSequence(roomId, isSequence ? players : []);
  const poker = usePoker(roomId, isPoker ? players : []);
  const add = useAssholeDaiDi(roomId, isADD ? players : []);
  const dd = useDaiDi(roomId, isDD ? players : []);

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
    } else if (isADD) {
      if (add.isHost && players.length > 0 && !add.gameState) {
        add.initGame(room?.settings as Record<string, unknown> | undefined);
      }
    } else if (isDD) {
      if (dd.isHost && players.length > 0 && !dd.gameState) {
        dd.initGame(room?.settings as Record<string, unknown> | undefined);
      }
    } else {
      if (blackjack.isHost && players.length > 0 && !blackjack.gameState) {
        blackjack.initGame();
      }
    }
  }, [isSequence, isPoker, isADD, isDD, sequence.isHost, blackjack.isHost, poker.isHost, add.isHost, dd.isHost, players.length, sequence.gameState, blackjack.gameState, poker.gameState, add.gameState, dd.gameState, sequence.initGame, blackjack.initGame, poker.initGame, add.initGame, dd.initGame, room?.settings]);

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

  const handleKickPlayer = useCallback(async (playerId: string) => {
    if (!roomId) return;
    await kickPlayer(roomId, playerId);
  }, [roomId]);

  if (loading || !room || !game) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground font-display animate-pulse">Loading game...</p>
      </div>
    );
  }

  // Dai Di game
  if (isDD) {
    if (!dd.gameState) {
      return (
        <div className="min-h-screen bg-background flex items-center justify-center">
          <p className="text-muted-foreground font-display animate-pulse">Setting up game...</p>
        </div>
      );
    }

    return (
      <DaiDiTable
        gameState={dd.gameState}
        myDDPlayer={dd.myDDPlayer}
        isHost={dd.isHost}
        isMyTurn={dd.isMyTurn}
        canPass={dd.canPass}
        selectedCards={dd.selectedCards}
        setSelectedCards={dd.setSelectedCards}
        onDeal={dd.doDeal}
        onPlay={dd.doPlay}
        onPass={dd.doPass}
        onRematch={dd.doRematch}
        onLeave={handleLeave}
        onKickPlayer={handleKickPlayer}
        players={players}
        myPlayerId={myPlayer?.id}
      />
    );
  }

  // Asshole Dai Di game
  if (isADD) {
    if (!add.gameState) {
      return (
        <div className="min-h-screen bg-background flex items-center justify-center">
          <p className="text-muted-foreground font-display animate-pulse">Setting up game...</p>
        </div>
      );
    }

    return (
      <AssholeDaiDiTable
        gameState={add.gameState}
        myADDPlayer={add.myADDPlayer}
        isHost={add.isHost}
        isMyTurn={add.isMyTurn}
        canPass={add.canPass}
        selectedCards={add.selectedCards}
        setSelectedCards={add.setSelectedCards}
        mySwapPending={add.mySwapPending}
        onDeal={add.doDeal}
        onPlay={add.doPlay}
        onPass={add.doPass}
        onStartSwap={add.doStartSwap}
        onSubmitSwapReturn={add.doSubmitSwapReturn}
        onFinishSwap={add.doFinishSwap}
        onRematch={add.doRematch}
        onLeave={handleLeave}
        onKickPlayer={handleKickPlayer}
        players={players}
        myPlayerId={myPlayer?.id}
      />
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
        onKickPlayer={sequence.doKickPlayer}
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
        onKickPlayer={handleKickPlayer}
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
