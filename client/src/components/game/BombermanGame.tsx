/**
 * BombermanGame - React wrapper for PixiJS game
 *
 * Embeds the PixiJS game canvas in the React app and handles:
 * - Game initialization and cleanup
 * - Keyboard event forwarding
 * - Window resize handling
 * - Socket event emission
 */

import React, { useRef, useEffect, useCallback } from 'react';
import { Game } from '../../game/bomberman';
import type { GameCallbacks } from '../../game/bomberman';
import type { Lobby } from '../../types';
import socketService from '../../services/socketService';

interface BombermanGameProps {
  lobby: Lobby;
}

const BombermanGame: React.FC<BombermanGameProps> = ({ lobby }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Game | null>(null);

  // Initialize game
  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    let cancelled = false;

    // Use requestAnimationFrame to ensure DOM layout is complete
    const rafId = requestAnimationFrame(() => {
      if (cancelled || !container) return;

      console.log('[BombermanGame] Initializing game...');
      console.log('[BombermanGame] Container size:', container.clientWidth, 'x', container.clientHeight);

      const game = new Game();
      gameRef.current = game;

      // Set up callbacks for game actions
      const callbacks: GameCallbacks = {
        onMove: (direction: number) => {
          socketService.emit('player:move', { direction });
        },
        onBomb: () => {
          socketService.emit('player:bomb', {});
        },
        onThrow: () => {
          socketService.emit('player:throw', {});
        },
        onStart: () => {
          socketService.emit('game:start', {});
        },
      };

      game.setCallbacks(callbacks);

      // Initialize PixiJS (async)
      game.init(container).then(() => {
        console.log('[BombermanGame] PixiJS initialized successfully');
      }).catch((err) => {
        console.error('[BombermanGame] PixiJS init failed:', err);
      });
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
      console.log('[BombermanGame] Destroying game');
      if (gameRef.current) {
        gameRef.current.destroy();
        gameRef.current = null;
      }
    };
  }, []);

  // Update game when lobby changes
  useEffect(() => {
    if (gameRef.current && lobby) {
      gameRef.current.updateFromLobby(lobby);
    }
  }, [lobby]);

  // Handle keyboard events
  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    gameRef.current?.handleKeyDown(event.nativeEvent);
  }, []);

  const handleKeyUp = useCallback((event: React.KeyboardEvent) => {
    gameRef.current?.handleKeyUp(event.nativeEvent);
  }, []);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current && gameRef.current) {
        gameRef.current.resize(
          containerRef.current.clientWidth,
          containerRef.current.clientHeight
        );
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onKeyUp={handleKeyUp}
      style={{
        width: '100%',
        flex: 1,
        minHeight: 0, // Critical for flex children
        outline: 'none',
        cursor: 'default',
      }}
    />
  );
};

export default BombermanGame;
