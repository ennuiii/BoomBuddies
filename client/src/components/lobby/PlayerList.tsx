/**
 * Player List
 *
 * Displays the list of players in the lobby/game.
 */

import React, { useState } from 'react';
import { Crown, Wifi, WifiOff, UserMinus, X } from 'lucide-react';
import type { Player, Team } from '../../types';

interface PlayerListProps {
  players: Player[];
  mySocketId: string;
  showStatus?: boolean;
  compact?: boolean;
  className?: string;
  teams?: Team[];
  isHost?: boolean;
  onKickPlayer?: (playerId: string) => void;
}

// Normalize tier values (API returns 'lifetime' but CSS uses 'premium')
const getNormalizedTier = (tier?: string): 'premium' | 'pro' | null => {
  if (!tier || tier === 'free') return null;
  if (tier === 'pro') return 'pro';
  // lifetime and monthly are both "premium" tier
  if (tier === 'lifetime' || tier === 'monthly' || tier === 'premium') return 'premium';
  return null; // unknown tier
};

const PlayerList: React.FC<PlayerListProps> = ({
  players,
  mySocketId,
  showStatus = true,
  compact = false,
  className = '',
  teams = [],
  isHost = false,
  onKickPlayer
}) => {
  // State for inline kick confirmation
  const [pendingKickId, setPendingKickId] = useState<string | null>(null);

  // Handle kick confirmation
  const handleKickClick = (playerId: string) => {
    console.log('[KICK-CLIENT] Kick button clicked for player:', playerId);
    setPendingKickId(playerId);
  };

  const handleConfirmKick = (playerId: string) => {
    console.log('[KICK-CLIENT] ===== CONFIRMING KICK =====');
    console.log('[KICK-CLIENT] Target playerId:', playerId);
    if (onKickPlayer) {
      console.log('[KICK-CLIENT] Calling onKickPlayer callback');
      onKickPlayer(playerId);
    } else {
      console.log('[KICK-CLIENT] ERROR: No onKickPlayer callback provided');
    }
    setPendingKickId(null);
  };

  const handleCancelKick = () => {
    console.log('[KICK-CLIENT] Kick cancelled');
    setPendingKickId(null);
  };

  // Helper to find a player's team
  const getPlayerTeam = (playerId: string): Team | undefined => {
    return teams.find(t => t.playerIds.includes(playerId));
  };

  // Sort: Host first, then by name
  const sortedPlayers = [...players].sort((a, b) => {
    if (a.isHost && !b.isHost) return -1;
    if (!a.isHost && b.isHost) return 1;
    return a.name.localeCompare(b.name);
  });

  if (compact) {
    return (
      <div className={`player-list compact ${className}`}>
        {sortedPlayers.map((player) => {
          const playerTeam = getPlayerTeam(player.socketId);
          return (
            <div
              key={player.socketId}
              className={`player-list-item compact ${player.socketId === mySocketId ? 'is-me' : ''} ${!player.connected ? 'disconnected' : ''}`}
            >
              {player.avatarUrl && (
                <img src={player.avatarUrl} alt="" className="player-avatar compact" />
              )}
              <span className="player-name">{player.name}</span>
              {player.isHost && <Crown className="w-3 h-3 host-icon" />}
              {playerTeam && (
                <span
                  className="player-team-badge compact"
                  style={{ backgroundColor: playerTeam.color }}
                >
                  {playerTeam.name.replace('Team ', '')}
                </span>
              )}
              {(() => {
                const tier = getNormalizedTier(player.premiumTier);
                return tier && (
                  <span className={`player-premium-badge compact ${tier}`}>
                    {tier === 'pro' ? 'Pro' : 'Premium'}
                  </span>
                );
              })()}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className={`player-list ${className}`}>
      <div className="player-list-header">
        <h3 className="player-list-title">Players</h3>
        <span className="player-list-count">
          {players.filter(p => p.connected).length}/{players.length}
        </span>
      </div>

      <ul className="player-list-items">
        {sortedPlayers.map((player) => {
          const isMe = player.socketId === mySocketId;
          const isConnected = player.connected;
          const playerTeam = getPlayerTeam(player.socketId);

          return (
            <li
              key={player.socketId}
              className={`player-list-item ${isMe ? 'is-me' : ''} ${!isConnected ? 'disconnected' : ''}`}
            >
              {/* Avatar */}
              <div className="player-avatar-container">
                {player.avatarUrl ? (
                  <img src={player.avatarUrl} alt="" className="player-avatar" />
                ) : (
                  <div className="player-avatar placeholder">
                    {player.name.charAt(0).toUpperCase()}
                  </div>
                )}
                {showStatus && (
                  <span className={`player-status ${isConnected ? 'online' : 'offline'}`}>
                    {isConnected ? (
                      <Wifi className="w-3 h-3" />
                    ) : (
                      <WifiOff className="w-3 h-3" />
                    )}
                  </span>
                )}
              </div>

              {/* Player Info */}
              <div className="player-info">
                <span className="player-name">
                  {player.name}
                  {isMe && <span className="player-me-tag">(You)</span>}
                </span>
                {player.isHost && (
                  <span className="player-host-badge">
                    <Crown className="w-3 h-3" />
                    Host
                  </span>
                )}
                {playerTeam && (
                  <span
                    className="player-team-badge"
                    style={{ backgroundColor: playerTeam.color }}
                  >
                    {playerTeam.name.replace('Team ', '')}
                  </span>
                )}
                {(() => {
                  const tier = getNormalizedTier(player.premiumTier);
                  return tier && (
                    <span className={`player-premium-badge ${tier}`}>
                      {tier === 'pro' ? 'Pro' : 'Premium'}
                    </span>
                  );
                })()}
              </div>

              {/* Kick Button (host only, not self, connected players) */}
              {isHost && !isMe && isConnected && onKickPlayer && (
                pendingKickId === player.id ? (
                  <div className="kick-confirm-buttons">
                    <button
                      className="kick-confirm-btn confirm"
                      onClick={() => handleConfirmKick(player.id ?? player.socketId)}
                      title="Confirm kick"
                      type="button"
                    >
                      Kick
                    </button>
                    <button
                      className="kick-confirm-btn cancel"
                      onClick={handleCancelKick}
                      title="Cancel"
                      type="button"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <button
                    className="kick-button"
                    onClick={() => handleKickClick(player.id ?? player.socketId)}
                    title="Kick player"
                    type="button"
                  >
                    <UserMinus className="w-4 h-4" />
                  </button>
                )
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default PlayerList;
