/**
 * Lobby Page
 *
 * Waiting room before game starts.
 * Desktop: Two-column layout (game area + sidebar)
 * Mobile: Full-width with hamburger menu for drawer access
 */

import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { Play, Users, Copy, Check, UserPlus, ArrowRightLeft } from 'lucide-react';
import type { Lobby, ChatMessage, Team } from '../types';
import type { GameBuddiesSession } from '../services/gameBuddiesSession';
import type { WebcamPlayer } from '../config/WebcamConfig';
import { t } from '../utils/translations';
import { useWebRTC } from '../contexts/WebRTCContext';
import { useIsMobile } from '../hooks/useIsMobile';
import { GameHeader } from '../components/core';
import { ChatWindow, PlayerList } from '../components/lobby';
import { MobileDrawer } from '../components/mobile';
import type { DrawerContent } from '../components/mobile';
import socketService from '../services/socketService';

interface LobbyPageProps {
  lobby: Lobby;
  messages: ChatMessage[];
  gameBuddiesSession?: GameBuddiesSession | null;
  onStartGame: () => void;
  onLeave: () => void;
}

const LobbyPage: React.FC<LobbyPageProps> = ({
  lobby,
  messages,
  gameBuddiesSession,
  onStartGame,
  onLeave: _onLeave
}) => {
  const [drawerContent, setDrawerContent] = useState<DrawerContent>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const hasAutoOpenedVideoRef = useRef(false);

  const { prepareVideoChat, isVideoChatActive, disableVideoChat } = useWebRTC();
  const isMobile = useIsMobile();

  const myPlayer = lobby.players.find(p => p.socketId === lobby.mySocketId);
  const isHost = myPlayer?.isHost || false;
  const connectedPlayers = lobby.players.filter(p => p.connected);
  const minPlayers = lobby.settings?.minPlayers || 2;
  const canStart = isHost && connectedPlayers.length >= minPlayers;
  const hideRoomCode = lobby.hideRoomCode || lobby.isStreamerMode;

  // Teams mode state
  const teams: Team[] = lobby.gameData?.teams || [];
  const isTeamsMode = (lobby.settings as any)?.gameMode === 'teams';
  const myTeam = teams.find(t => t.playerIds.includes(lobby.mySocketId));

  // Handle game mode change (host only)
  const handleGameModeChange = useCallback((gameMode: 'classic' | 'teams') => {
    console.log('[LobbyPage] handleGameModeChange called with:', gameMode);
    const socket = socketService.getSocket();
    console.log('[LobbyPage] socket:', socket ? 'connected' : 'NULL');
    if (socket) {
      console.log('[LobbyPage] Emitting settings:update with roomCode:', lobby.code);
      socket.emit('settings:update', { roomCode: lobby.code, settings: { gameMode } });
    } else {
      console.error('[LobbyPage] Cannot emit - socket is null!');
    }
  }, [lobby.code]);

  // Handle shuffle teams (host only)
  const handleShuffleTeams = useCallback(() => {
    const socket = socketService.getSocket();
    if (socket) {
      socket.emit('game:shuffle-teams', { roomCode: lobby.code });
    }
  }, [lobby.code]);

  // Handle switching teams
  const handleSwitchTeam = useCallback((teamId: string) => {
    const socket = socketService.getSocket();
    if (socket) {
      socket.emit('game:switch-team', { roomCode: lobby.code, teamId });
    }
  }, [lobby.code]);

  // Handle kicking a player (host only)
  const handleKickPlayer = useCallback((playerId: string) => {
    console.log('[KICK-CLIENT] handleKickPlayer called');
    console.log('[KICK-CLIENT] Target playerId:', playerId);
    console.log('[KICK-CLIENT] Room code:', lobby.code);
    const socket = socketService.getSocket();
    console.log('[KICK-CLIENT] Socket connected:', socket?.connected);
    if (socket) {
      socket.emit('player:kick', { roomCode: lobby.code, playerId });
      console.log('[KICK-CLIENT] Emitted player:kick event');
    } else {
      console.log('[KICK-CLIENT] ERROR: No socket available');
    }
  }, [lobby.code]);


  // Build webcam players list for video modal (exclude self - local stream handled separately)
  const webcamPlayers: WebcamPlayer[] = useMemo(() =>
    lobby.players
      .filter(p => p.socketId !== lobby.mySocketId)
      .map(p => ({
        id: p.socketId,
        name: p.name,
        avatarUrl: p.avatarUrl
      })),
    [lobby.players, lobby.mySocketId]
  );

  const handleCopyLink = useCallback(async () => {
    const baseUrl = window.location.origin;
    const basePath = import.meta.env.BASE_URL || '/';
    const joinUrl = `${baseUrl}${basePath}?invite=${lobby.code}`;

    try {
      await navigator.clipboard.writeText(joinUrl);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }, [lobby.code]);

  const handleOpenChat = useCallback(() => {
    setDrawerContent('chat');
  }, []);

  const handleOpenPlayers = useCallback(() => {
    setDrawerContent('players');
  }, []);

  const handleOpenVideo = useCallback(() => {
    if (isVideoChatActive) {
      // Already in video chat, just open the drawer
      setDrawerContent('video');
    } else {
      // Not in video chat yet, trigger setup modal first
      prepareVideoChat();
    }
  }, [isVideoChatActive, prepareVideoChat]);

  const handleCloseDrawer = useCallback(() => {
    setDrawerContent(null);
  }, []);

  // Reset auto-open flag when video becomes inactive
  useEffect(() => {
    if (!isVideoChatActive) {
      hasAutoOpenedVideoRef.current = false;
    }
  }, [isVideoChatActive]);

  // Auto-open video drawer ONCE when video becomes active on mobile
  useEffect(() => {
    if (isMobile && isVideoChatActive && !hasAutoOpenedVideoRef.current) {
      hasAutoOpenedVideoRef.current = true;
      setDrawerContent('video');
    }
  }, [isMobile, isVideoChatActive]);

  return (
    <div className="lobby-page">
      {/* Header */}
      <GameHeader
        lobby={lobby}
        gameBuddiesSession={gameBuddiesSession}
        onOpenChat={handleOpenChat}
        onOpenPlayers={handleOpenPlayers}
        onOpenVideo={handleOpenVideo}
      />

      <div className="lobby-content">
        {/* Main Area */}
        <main className="lobby-main">
          {/* Waiting Room Card */}
          <div className="lobby-waiting-card">
            <div className="lobby-waiting-header">
              <h2>{t('lobby.waitingForPlayers')}</h2>
              <p className="lobby-player-count">
                <Users className="w-4 h-4" />
                {connectedPlayers.length}/{lobby.settings?.maxPlayers || 8} {t('lobby.players')}
              </p>
            </div>

            {/* Room Code / Streamer Mode */}
            <div className="lobby-room-code-section">
              {!hideRoomCode ? (
                <>
                  <p className="lobby-room-label">{t('lobby.shareCode')}</p>
                  <div className="lobby-room-code-box">
                    <span className="lobby-room-code">{lobby.code}</span>
                    <button
                      onClick={handleCopyLink}
                      className="lobby-copy-btn"
                      title="Copy invite link"
                    >
                      {linkCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p className="lobby-room-label">{t('lobby.copyLink')}</p>
                  <div className="lobby-room-code-box streamer-mode">
                    <span className="lobby-streamer-badge">Streamer Mode</span>
                    <button
                      onClick={handleCopyLink}
                      className="lobby-copy-btn"
                      title="Copy invite link"
                    >
                      {linkCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* Player List (compact, mobile only) */}
            <div className="lobby-players-compact mobile-only">
              <PlayerList
                players={lobby.players}
                mySocketId={lobby.mySocketId}
                teams={teams}
                isHost={isHost}
                onKickPlayer={handleKickPlayer}
                compact
              />
            </div>

            {/* Start Game Button (Host only) */}
            {isHost && (
              <div className="lobby-start-section">
                <button
                  onClick={onStartGame}
                  disabled={!canStart}
                  className="lobby-start-btn"
                >
                  <Play className="w-5 h-5" />
                  {t('lobby.startGame')}
                </button>
                {!canStart && (
                  <p className="lobby-start-hint">
                    {t('lobby.minPlayersRequired', { min: minPlayers })}
                  </p>
                )}
              </div>
            )}

            {!isHost && (
              <p className="lobby-waiting-host">{t('lobby.waitingForHost')}</p>
            )}
          </div>

          {/* Game-specific lobby content - Teams Mode */}
          <div className="lobby-game-area">
            {/* Game Mode Selector (Host only) */}
            {isHost && (
              <div className="game-mode-section">
                <label className="game-mode-label">
                  <Users className="w-4 h-4" />
                  Game Mode
                </label>
                <div className="game-mode-controls">
                  <select
                    className="game-mode-select"
                    value={isTeamsMode ? 'teams' : 'classic'}
                    onChange={(e) => handleGameModeChange(e.target.value as 'classic' | 'teams')}
                  >
                    <option value="classic">Classic (FFA)</option>
                    <option value="teams">Teams</option>
                  </select>
                  {isTeamsMode && (
                    <button
                      className="shuffle-teams-btn"
                      onClick={handleShuffleTeams}
                      title="Shuffle Teams"
                    >
                      <ArrowRightLeft className="w-4 h-4" />
                      Shuffle
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Teams Grid (when teams mode is enabled) */}
            {isTeamsMode && teams.length > 0 && (
              <div className="teams-grid">
                {teams.map((team) => {
                  const teamPlayers = lobby.players.filter(p =>
                    team.playerIds.includes(p.socketId)
                  );
                  const isMyTeam = team.id === myTeam?.id;
                  const canSwitch = !isMyTeam && teams.every((t) => {
                    if (t.id === team.id) {
                      // Target team would gain 1
                      const newSize = t.playerIds.length + 1;
                      const otherTeam = teams.find(ot => ot.id !== t.id);
                      if (otherTeam) {
                        // Other team would lose 1
                        const otherNewSize = otherTeam.playerIds.length - 1;
                        return newSize - otherNewSize <= 1;
                      }
                    }
                    return true;
                  });

                  return (
                    <div
                      key={team.id}
                      className={`team-column ${isMyTeam ? 'my-team' : ''}`}
                      style={{
                        borderColor: team.color,
                        backgroundColor: `${team.color}10`
                      }}
                    >
                      <div
                        className="team-header"
                        style={{ backgroundColor: team.color }}
                      >
                        <span className="team-name">{team.name}</span>
                        <span className="team-count">{teamPlayers.length}</span>
                      </div>

                      <div className="team-players">
                        {teamPlayers.length === 0 ? (
                          <div className="team-empty">
                            <UserPlus className="w-5 h-5" />
                            <span>No players yet</span>
                          </div>
                        ) : (
                          teamPlayers.map((player) => (
                            <div
                              key={player.socketId}
                              className={`team-player ${player.socketId === lobby.mySocketId ? 'is-me' : ''}`}
                            >
                              {player.avatarUrl ? (
                                <img
                                  src={player.avatarUrl}
                                  alt={player.name}
                                  className="team-player-avatar"
                                />
                              ) : (
                                <div className="team-player-avatar-placeholder">
                                  {player.name.charAt(0).toUpperCase()}
                                </div>
                              )}
                              <span className="team-player-name">
                                {player.name}
                                {player.isHost && <span className="host-badge">Host</span>}
                              </span>
                            </div>
                          ))
                        )}
                      </div>

                      {/* Switch Team Button */}
                      {!isMyTeam && (
                        <button
                          className="switch-team-btn"
                          onClick={() => handleSwitchTeam(team.id)}
                          disabled={!canSwitch}
                          style={{
                            backgroundColor: team.color,
                            opacity: canSwitch ? 1 : 0.5
                          }}
                        >
                          <ArrowRightLeft className="w-4 h-4" />
                          Join {team.name.replace('Team ', '')}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </main>

        {/* Sidebar (Desktop) */}
        <aside className="lobby-sidebar desktop-only">
          <div className="lobby-sidebar-section">
            <PlayerList
              players={lobby.players}
              mySocketId={lobby.mySocketId}
              teams={teams}
              isHost={isHost}
              onKickPlayer={handleKickPlayer}
            />
          </div>
          <div className="lobby-sidebar-section chat-section">
            <ChatWindow
              messages={messages}
              roomCode={lobby.code}
              mySocketId={lobby.mySocketId}
            />
          </div>
        </aside>
      </div>

      {/* Mobile Overlay Modal */}
      <MobileDrawer
        isOpen={drawerContent !== null}
        content={drawerContent}
        onClose={handleCloseDrawer}
        messages={messages}
        roomCode={lobby.code}
        mySocketId={lobby.mySocketId}
        players={lobby.players}
        webcamPlayers={webcamPlayers}
        localPlayerName={myPlayer?.name}
        onLeaveVideo={disableVideoChat}
        teams={lobby.gameData?.teams || []}
      />
    </div>
  );
};

export default LobbyPage;
