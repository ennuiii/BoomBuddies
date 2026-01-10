/**
 * Game Header
 *
 * Header component for in-game view.
 * Shows game branding, room code, player info, and controls.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Copy, Users, Crown, ArrowLeft, Settings, Check } from 'lucide-react';
import type { Lobby, Player } from '../../types';
import type { GameBuddiesSession } from '../../services/gameBuddiesSession';
import socketService from '../../services/socketService';
import { useVideoUI } from '../../contexts/VideoUIContext';
import { useWebRTC } from '../../contexts/WebRTCContext';
import { useIsMobile } from '../../hooks/useIsMobile';
import { GAME_META } from '../../config/gameMeta';
import MobileGameMenu from './MobileGameMenu';
import SettingsModal from './SettingsModal';
import GameBuddiesReturnButton from './GameBuddiesReturnButton';
import { VideoControlCluster } from '../video';
import { t } from '../../utils/translations';

interface GameHeaderProps {
  lobby: Lobby;
  gameBuddiesSession?: GameBuddiesSession | null;
  onOpenChat?: () => void;
  onOpenPlayers?: () => void;
  onOpenVideo?: () => void;
  unreadChatCount?: number;
}

const GameHeader: React.FC<GameHeaderProps> = ({
  lobby,
  gameBuddiesSession,
  onOpenChat,
  onOpenPlayers,
  onOpenVideo,
  unreadChatCount = 0
}) => {
  // DEBUG: Log session status
  console.log('[GameHeader] gameBuddiesSession:', gameBuddiesSession);
  console.log('[GameHeader] gameBuddiesSession exists?', !!gameBuddiesSession);

  const hideRoomCode = gameBuddiesSession?.hideRoomCode || lobby.hideRoomCode || lobby.isStreamerMode || false;
  const myPlayer = lobby.players.find((p: Player) => p.socketId === lobby.mySocketId);
  const isHost = myPlayer?.isHost || false;
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [_copyError, setCopyError] = useState(false);
  const feedbackTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    };
  }, []);

  // Helper to copy text with fallback
  const copyToClipboard = useCallback(async (text: string): Promise<boolean> => {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (err) {
      // Fallback for older browsers or when clipboard API is unavailable
      console.warn('Clipboard API failed, using fallback:', err);
      try {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-9999px';
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        return true;
      } catch (fallbackErr) {
        console.error('Clipboard fallback also failed:', fallbackErr);
        return false;
      }
    }
  }, []);

  const socket = socketService.getSocket();
  const videoUI = useVideoUI();
  const webrtc = useWebRTC();
  const isMobile = useIsMobile();

  // Listen for invite token response
  useEffect(() => {
    if (!socket) return;

    const onInviteCreated = async (data: { inviteToken: string }) => {
      const baseUrl = window.location.origin;
      const basePath = import.meta.env.BASE_URL || '/';
      const joinUrl = `${baseUrl}${basePath}?invite=${data.inviteToken}`;

      const success = await copyToClipboard(joinUrl);
      if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);

      if (success) {
        setCopyFeedback(true);
        setCopyError(false);
        feedbackTimerRef.current = setTimeout(() => setCopyFeedback(false), 2000);
      } else {
        setCopyError(true);
        feedbackTimerRef.current = setTimeout(() => setCopyError(false), 2000);
      }
    };

    socket.on('room:invite-created', onInviteCreated);

    return () => {
      socket.off('room:invite-created', onInviteCreated);
    };
  }, [socket, copyToClipboard]);

  const copyRoomLink = useCallback(async () => {
    const baseUrl = window.location.origin;
    const basePath = import.meta.env.BASE_URL || '/';

    if (!gameBuddiesSession && !hideRoomCode) {
      const joinUrl = `${baseUrl}${basePath}?invite=${lobby.code}`;
      const success = await copyToClipboard(joinUrl);
      if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);

      if (success) {
        setCopyFeedback(true);
        setCopyError(false);
        feedbackTimerRef.current = setTimeout(() => setCopyFeedback(false), 2000);
      } else {
        setCopyError(true);
        feedbackTimerRef.current = setTimeout(() => setCopyError(false), 2000);
      }
      return;
    }

    if (!socket) return;
    socket.emit('room:create-invite');
  }, [socket, gameBuddiesSession, hideRoomCode, lobby.code, copyToClipboard]);

  const handleLeave = useCallback(() => {
    socketService.clearReconnectionData();
    sessionStorage.removeItem('gameSessionToken');
    window.location.href = window.location.pathname;
  }, []);

  // TODO: Customize phase display for your game
  const getPhaseDisplay = (state: string) => {
    switch (state) {
      case 'lobby':
        return t('gameHeader.waitingForPlayers');
      case 'playing':
        return t('gameHeader.inProgress');
      case 'finished':
        return t('gameHeader.gameOver');
      default:
        return '';
    }
  };

  const connectedCount = lobby.players.filter((p: Player) => p.connected).length;

  return (
    <header className="game-header">
      <div className="game-header-container">
        {/* Left side - Branding and Room Info */}
        <div className="game-header-left">
          {/* Game Branding */}
          <a href="/" className="game-header-logo">
            <img
              src={`${import.meta.env.BASE_URL}mascot.webp`}
              alt={GAME_META.mascotAlt}
              className="game-header-logo-icon"
            />
            <div className="game-header-logo-text-container">
              <span className="game-header-logo-text">
                {GAME_META.namePrefix}<span className="game-header-accent">{GAME_META.nameAccent}</span>
              </span>
              <span className="game-header-gb-branding">
                <span className="game-header-gb-by">by </span>
                <span className="game-header-gb-game">Game</span>
                <span className="game-header-gb-buddies">Buddies</span>
                <span className="game-header-gb-io">.io</span>
              </span>
            </div>
          </a>

          <div className="game-header-divider desktop-only"></div>

          {/* Room Info - Desktop */}
          <div className="game-header-room-info desktop-only">
            {!hideRoomCode ? (
              <div className="game-header-room-code">
                <span className="game-header-room-label">{t('gameHeader.room')}:</span>
                <span className="game-header-room-value">{lobby.code}</span>
                <button
                  onClick={copyRoomLink}
                  className="game-header-copy-btn"
                  title={t('gameHeader.copyRoomLink')}
                >
                  {copyFeedback ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            ) : (
              <div className="game-header-streamer-badge">
                <span>{t('gameHeader.streamerMode')}</span>
                <button
                  onClick={copyRoomLink}
                  className="game-header-copy-btn"
                  title={t('gameHeader.copyInviteLink')}
                >
                  {copyFeedback ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            )}

            <div className="game-header-phase-badge">
              {getPhaseDisplay(lobby.state)}
            </div>
          </div>
        </div>

        {/* Right side - Player info and controls (Desktop only) */}
        {!isMobile && (
          <div className="game-header-right">
            {/* Video Control Cluster - Three-state: Join/Preparing/Active */}
            <VideoControlCluster
              isVideoEnabled={webrtc.isVideoChatActive}
              isVideoPrepairing={webrtc.isVideoPrepairing}
              onPrepareVideo={webrtc.prepareVideoChat}
              onDisableVideo={webrtc.disableVideoChat}
              isFilmstripExpanded={videoUI.isFilmstripExpanded}
              onToggleFilmstrip={videoUI.toggleFilmstrip}
              isCameraEnabled={webrtc.isCameraEnabled}
              onToggleVideo={webrtc.toggleVideo}
              isAudioEnabled={webrtc.isAudioEnabled}
              onToggleAudio={webrtc.toggleAudio}
              onOpenSettings={videoUI.openSettings}
            />

            <div className="game-header-divider" />

            <div className="game-header-player-count">
              <Users className="w-4 h-4" />
              <span>{connectedCount}/{lobby.settings?.maxPlayers || 8}</span>
            </div>

            <div className={`game-header-player-info ${isHost ? 'host' : ''}`}>
              {isHost && <Crown className="w-4 h-4" />}
              <span>{myPlayer?.name || 'Player'}</span>
            </div>

            <button
              onClick={() => setIsSettingsOpen(true)}
              className="game-header-settings-btn"
              title={t('gameHeader.settings')}
            >
              <Settings className="w-4 h-4" />
            </button>

            {/* Return to GameBuddies - only show when launched from GB */}
            {gameBuddiesSession && (
              <GameBuddiesReturnButton
                roomCode={lobby.code}
                playerId={myPlayer?.socketId}
                isHost={isHost}
                variant="inline"
              />
            )}

            <button onClick={handleLeave} className="game-header-leave-btn">
              <ArrowLeft className="w-4 h-4" />
              {t('gameHeader.leave')}
            </button>
          </div>
        )}

        {/* Right side - Mobile (Hamburger Menu) */}
        {isMobile && (
          <div className="game-header-right">
            <MobileGameMenu
              roomCode={lobby.code}
              onCopyLink={copyRoomLink}
              linkCopied={copyFeedback}
              onLeave={handleLeave}
              onChat={onOpenChat}
              unreadCount={unreadChatCount}
              onPlayers={onOpenPlayers}
              playerCount={`${connectedCount}/${lobby.settings?.maxPlayers || 8}`}
              isVideoEnabled={webrtc.isVideoChatActive}
              onVideo={onOpenVideo}
              onSettings={() => setIsSettingsOpen(true)}
              hideRoomCode={hideRoomCode}
              isLobby={lobby.state === 'lobby'}
              onReturnToGameBuddies={gameBuddiesSession ? () => {
                const socket = socketService.getSocket();
                if (socket) {
                  socket.emit('gamebuddies:return', {
                    roomCode: lobby.code,
                    playerId: myPlayer?.socketId,
                    mode: isHost ? 'group' : 'individual'
                  });
                }
              } : undefined}
            />
          </div>
        )}
      </div>

      {/* Settings Modal */}
      {isSettingsOpen && <SettingsModal onClose={() => setIsSettingsOpen(false)} />}
    </header>
  );
};

export default GameHeader;
