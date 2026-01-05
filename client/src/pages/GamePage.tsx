/**
 * Game Page
 *
 * Main game view. Routes to game-specific components based on game phase.
 * Desktop: Two-column layout (game area + sidebar)
 * Mobile: Full-width with hamburger menu
 */

import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import type { Lobby, ChatMessage, Team } from '../types';
import type { GameBuddiesSession } from '../services/gameBuddiesSession';
import type { WebcamPlayer } from '../config/WebcamConfig';
import { GameHeader } from '../components/core';
import { ChatWindow, PlayerList } from '../components/lobby';
import { MobileDrawer } from '../components/mobile';
import type { DrawerContent } from '../components/mobile';
import { useWebRTC } from '../contexts/WebRTCContext';
import { useIsMobile } from '../hooks/useIsMobile';
import { BombermanGame } from '../components/game';
import socketService from '../services/socketService';

interface GamePageProps {
  lobby: Lobby;
  messages: ChatMessage[];
  gameBuddiesSession?: GameBuddiesSession | null;
  onLeave: () => void;
}

const GamePage: React.FC<GamePageProps> = ({
  lobby,
  messages,
  gameBuddiesSession,
  onLeave: _onLeave
}) => {
  const [drawerContent, setDrawerContent] = useState<DrawerContent>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const hasAutoOpenedVideoRef = useRef(false);

  const { prepareVideoChat, isVideoChatActive, disableVideoChat } = useWebRTC();
  const isMobile = useIsMobile();

  const myPlayer = lobby.players.find(p => p.socketId === lobby.mySocketId);
  const isHost = myPlayer?.isHost || false;
  const teams: Team[] = lobby.gameData?.teams || [];

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

  const handleOpenChat = useCallback(() => {
    setDrawerContent('chat');
    setUnreadCount(0);
  }, []);

  const handleOpenPlayers = useCallback(() => {
    setDrawerContent('players');
  }, []);

  const handleOpenVideo = useCallback(() => {
    if (isVideoChatActive) {
      setDrawerContent('video');
    } else {
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

  // Build webcam players list for mobile video drawer (memoized to prevent unnecessary re-renders)
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

  return (
    <div className="game-page">
      {/* Header */}
      <GameHeader
        lobby={lobby}
        gameBuddiesSession={gameBuddiesSession}
        onOpenChat={handleOpenChat}
        onOpenPlayers={handleOpenPlayers}
        onOpenVideo={handleOpenVideo}
        unreadChatCount={unreadCount}
      />

      <div className="game-content">
        {/* Main Game Area */}
        <main className="game-main">
          <BombermanGame lobby={lobby} />
        </main>

        {/* Sidebar (Desktop) */}
        <aside className="game-sidebar desktop-only">
          <div className="game-sidebar-section">
            <PlayerList
              players={lobby.players}
              mySocketId={lobby.mySocketId}
              teams={teams}
              isHost={isHost}
              onKickPlayer={handleKickPlayer}
            />
          </div>
          <div className="game-sidebar-section chat-section">
            <ChatWindow
              messages={messages}
              roomCode={lobby.code}
              mySocketId={lobby.mySocketId}
            />
          </div>
        </aside>
      </div>

      {/* Mobile Drawer */}
      <MobileDrawer
        isOpen={drawerContent !== null}
        content={drawerContent}
        onClose={handleCloseDrawer}
        messages={messages}
        roomCode={lobby.code}
        mySocketId={lobby.mySocketId}
        players={lobby.players}
        webcamPlayers={webcamPlayers}
        localPlayerName={lobby.players.find(p => p.socketId === lobby.mySocketId)?.name}
        onLeaveVideo={disableVideoChat}
        teams={lobby.gameData?.teams || []}
      />
    </div>
  );
};

export default GamePage;
