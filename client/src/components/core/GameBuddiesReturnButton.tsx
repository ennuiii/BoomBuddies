/**
 * GameBuddies Return Button
 *
 * Button to return to GameBuddies.io platform.
 * Only shown when the game was launched from GameBuddies.
 */

import React from 'react';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import socketService from '../../services/socketService';

interface GameBuddiesReturnButtonProps {
  roomCode: string;
  playerId?: string;
  isHost?: boolean;
  variant?: 'inline' | 'floating';
  className?: string;
}

const GameBuddiesReturnButton: React.FC<GameBuddiesReturnButtonProps> = ({
  roomCode,
  playerId,
  isHost = false,
  variant = 'inline',
  className = ''
}) => {
  const handleReturn = () => {
    const socket = socketService.getSocket();
    if (socket) {
      socket.emit('gamebuddies:return', {
        roomCode,
        playerId,
        mode: isHost ? 'group' : 'individual'
      });
    } else {
      // Fallback: redirect directly
      window.location.href = 'https://gamebuddies.io';
    }
  };

  if (variant === 'floating') {
    return (
      <button
        onClick={handleReturn}
        className={`gamebuddies-return-btn floating ${className}`}
        title={isHost ? "Return all players to GameBuddies.io" : "Return to GameBuddies.io"}
      >
        <ArrowLeft className="w-4 h-4" />
        <span>{isHost ? 'Return All' : 'Back to GameBuddies'}</span>
      </button>
    );
  }

  return (
    <button
      onClick={handleReturn}
      className={`gamebuddies-return-btn inline ${className}`}
      title={isHost ? "Return all players to GameBuddies.io" : "Return to GameBuddies.io"}
    >
      <ExternalLink className="w-4 h-4" />
      <span>{isHost ? 'Return All' : 'GameBuddies.io'}</span>
    </button>
  );
};

export default GameBuddiesReturnButton;
