/**
 * Game Placeholder Component
 *
 * TODO: Replace this with your game's actual game component.
 *
 * This placeholder demonstrates:
 * - How to receive lobby state
 * - How to emit game actions via socket
 * - Basic game UI structure
 * - XP notification system (via Test XP button)
 */

import React, { useState, useEffect, useCallback } from 'react';
import type { Lobby } from '../../types';
import socketService from '../../services/socketService';
import { XpToast } from '../ui/XpToast';

interface GamePlaceholderProps {
  lobby: Lobby;
}

interface XpReward {
  reward: {
    totalXp: number;
    summary: string;
    breakdown: any;
  };
  progress: {
    newLevel: number;
    previousLevel: number;
    leveledUp: boolean;
    percentage: number;
  };
}

const GamePlaceholder: React.FC<GamePlaceholderProps> = ({ lobby }) => {
  const myPlayer = lobby.players.find(p => p.socketId === lobby.mySocketId);
  const isHost = myPlayer?.isHost || false;
  const gameData = lobby.gameData;

  // XP test state
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [xpReward, setXpReward] = useState<XpReward | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Listen for XP reward events
  useEffect(() => {
    const socket = socketService.getSocket();
    if (!socket) return;

    const handleReward = (data: XpReward) => {
      console.log('[GamePlaceholder] Received XP reward:', data);
      setXpReward(data);
    };

    const handleError = (data: { message: string }) => {
      console.error('[GamePlaceholder] Error:', data.message);
      setPasswordError(data.message);
      setIsSubmitting(false);
    };

    socket.on('player:reward', handleReward);
    socket.on('error', handleError);

    return () => {
      socket.off('player:reward', handleReward);
      socket.off('error', handleError);
    };
  }, []);

  // Example: Emit a game action
  const handleGameAction = (action: string, data?: Record<string, unknown>) => {
    const socket = socketService.getSocket();
    if (socket) {
      socket.emit('game:action', {
        roomCode: lobby.code,
        action,
        ...data
      });
    }
  };

  // Example: End the game (host only)
  const handleEndGame = () => {
    const socket = socketService.getSocket();
    if (socket && isHost) {
      socket.emit('game:end', { roomCode: lobby.code });
    }
  };

  // Test XP button handler
  const handleTestXpClick = () => {
    setShowPasswordModal(true);
    setPassword('');
    setPasswordError('');
  };

  // Submit password to grant XP
  const handlePasswordSubmit = useCallback(() => {
    if (isSubmitting) return;

    const socket = socketService.getSocket();
    if (!socket) {
      setPasswordError('Not connected to server');
      return;
    }

    setIsSubmitting(true);
    setPasswordError('');

    socket.emit('debug:grant-xp', {
      roomCode: lobby.code,
      password: password
    });

    // Close modal after a short delay (reward will trigger toast)
    setTimeout(() => {
      setShowPasswordModal(false);
      setPassword('');
      setIsSubmitting(false);
    }, 500);
  }, [password, lobby.code, isSubmitting]);

  // Handle XP toast close
  const handleXpToastClose = useCallback(() => {
    setXpReward(null);
  }, []);

  return (
    <div className="game-placeholder">
      <div className="game-placeholder-card">
        <h2 className="game-placeholder-title">
          Game In Progress
        </h2>

        <div className="game-placeholder-info">
          <p>State: {lobby.state || 'unknown'}</p>
          <p>Players: {lobby.players.length}</p>
        </div>

        {/* TODO: Replace with your game's UI */}
        <div className="game-placeholder-content">
          <p className="game-placeholder-hint">
            Replace this component with your game's actual gameplay UI.
          </p>

          {/* Example action buttons */}
          <div className="game-placeholder-actions">
            <button
              onClick={() => handleGameAction('example-action')}
              className="game-placeholder-btn"
            >
              Example Action
            </button>

            {isHost && (
              <button
                onClick={handleEndGame}
                className="game-placeholder-btn danger"
              >
                End Game
              </button>
            )}
          </div>
        </div>

        {/* Game state debug info (remove in production) */}
        <details className="game-placeholder-debug">
          <summary>Debug: Game State</summary>
          <pre>{JSON.stringify(gameData, null, 2)}</pre>

          {/* Test XP Button */}
          <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
            <button
              onClick={handleTestXpClick}
              className="game-placeholder-btn"
              style={{ background: 'linear-gradient(135deg, #4ade80, #22c55e)' }}
            >
              Test XP
            </button>
            <p style={{ fontSize: '12px', color: '#94a3b8', marginTop: '8px' }}>
              Grant test XP to trigger XpToast notification
            </p>
          </div>
        </details>
      </div>

      {/* Password Modal */}
      {showPasswordModal && (
        <div
          className="password-modal-overlay"
          onClick={() => setShowPasswordModal(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999
          }}
        >
          <div
            className="password-modal"
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'linear-gradient(135deg, rgba(21, 27, 48, 0.98), rgba(13, 15, 26, 0.98))',
              borderRadius: '16px',
              padding: '24px',
              minWidth: '300px',
              border: '2px solid rgba(74, 222, 128, 0.3)',
              boxShadow: '0 10px 40px rgba(0, 0, 0, 0.5)'
            }}
          >
            <h3 style={{ color: '#fff', marginBottom: '16px', fontSize: '18px' }}>
              Enter Password
            </h3>

            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handlePasswordSubmit()}
              placeholder="Password..."
              autoFocus
              style={{
                width: '100%',
                padding: '12px 16px',
                borderRadius: '8px',
                border: passwordError ? '2px solid #ef4444' : '2px solid rgba(255,255,255,0.1)',
                background: 'rgba(0,0,0,0.3)',
                color: '#fff',
                fontSize: '16px',
                outline: 'none'
              }}
            />

            {passwordError && (
              <p style={{ color: '#ef4444', fontSize: '13px', marginTop: '8px' }}>
                {passwordError}
              </p>
            )}

            <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
              <button
                onClick={() => setShowPasswordModal(false)}
                style={{
                  flex: 1,
                  padding: '12px',
                  borderRadius: '8px',
                  border: 'none',
                  background: 'rgba(255,255,255,0.1)',
                  color: '#fff',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handlePasswordSubmit}
                disabled={isSubmitting || !password}
                style={{
                  flex: 1,
                  padding: '12px',
                  borderRadius: '8px',
                  border: 'none',
                  background: isSubmitting || !password
                    ? 'rgba(74, 222, 128, 0.3)'
                    : 'linear-gradient(135deg, #4ade80, #22c55e)',
                  color: '#fff',
                  cursor: isSubmitting || !password ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  fontWeight: 600
                }}
              >
                {isSubmitting ? 'Submitting...' : 'Submit'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* XP Toast Notification */}
      <XpToast reward={xpReward} onClose={handleXpToastClose} />
    </div>
  );
};

export default GamePlaceholder;
