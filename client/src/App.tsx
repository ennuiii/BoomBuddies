/**
 * GameBuddies Template - Main App Component
 *
 * TODO: This is a placeholder. The full implementation will include:
 * - Context providers (WebRTC, VideoUI, Theme)
 * - Page routing (HomePage -> LobbyPage -> GamePage)
 * - Socket connection management
 * - GameBuddies session handling
 */

import { useState, useEffect, useRef } from 'react';
import socketService from './services/socketService';
import { getCurrentSession, resolvePendingSession, clearSession } from './services/gameBuddiesSession';
import KickToast from './components/ui/KickToast';
import type { Lobby, ChatMessage } from './types';
import { ThemeProvider } from './contexts/ThemeContext';
import { WebRTCProvider, useWebRTC } from './contexts/WebRTCContext';
import { VideoUIProvider, useVideoUI } from './contexts/VideoUIContext';
import { DeviceSettingsModal, VideoFilmstrip } from './components/video';
import { useVideoKeyboardShortcuts, useVideoPreferences, useIsMobile } from './hooks';
import { backgroundMusic, soundEffects, playBackgroundMusic, initAudio } from './utils/audio';
import HomePage from './pages/HomePage';
import LobbyPage from './pages/LobbyPage';
import GamePage from './pages/GamePage';
import { InstallPrompt } from './components/InstallPrompt';
import type { WebcamPlayer } from './config/WebcamConfig';

// localStorage keys for audio settings
const AUDIO_STORAGE_KEYS = {
  MUSIC_VOLUME: 'gamebuddies-music-volume',
  MUSIC_ENABLED: 'gamebuddies-music-enabled',
  SFX_VOLUME: 'gamebuddies-sfx-volume',
  SFX_ENABLED: 'gamebuddies-sfx-enabled',
};

/**
 * VideoHooksManager
 *
 * Headless component that activates video-related hooks.
 * Must be inside WebRTCProvider and VideoUIProvider to access context.
 */
function VideoHooksManager() {
  useVideoKeyboardShortcuts();
  useVideoPreferences();
  return null;
}

/**
 * VideoSettingsManager
 *
 * Renders the device settings modal when:
 * 1. Video is preparing (initial setup mode)
 * 2. Settings button is clicked (edit mode)
 * Must be inside WebRTCProvider and VideoUIProvider to access context.
 */
function VideoSettingsManager() {
  const { isVideoPrepairing, confirmVideoChat, cancelVideoPreparation } = useWebRTC();
  const { isSettingsOpen, closeSettings } = useVideoUI();

  // Determine which mode we're in
  const isOpen = isVideoPrepairing || isSettingsOpen;
  const mode = isVideoPrepairing ? 'setup' : 'edit';

  // Handle close based on which mode triggered the modal
  const handleClose = () => {
    if (isVideoPrepairing) {
      cancelVideoPreparation();  // Use light cleanup for modal cancel
    } else {
      closeSettings();
    }
  };

  // Handle confirm based on mode
  const handleConfirm = () => {
    if (isVideoPrepairing) {
      confirmVideoChat();
    } else {
      // In edit mode, just close - settings are saved to localStorage automatically
      closeSettings();
    }
  };

  return (
    <DeviceSettingsModal
      isOpen={isOpen}
      onClose={handleClose}
      onConfirm={handleConfirm}
      mode={mode}
    />
  );
}

/**
 * AppContent
 *
 * Wraps the main content with correct DOM structure for filmstrip resizing.
 * Renders VideoFilmstrip at App level (outside app-layout) for proper CSS adjustments.
 * Must be inside WebRTCProvider to access video state.
 */
function AppContent({
  lobby,
  renderContent
}: {
  lobby: Lobby | null;
  renderContent: () => React.ReactNode;
}) {
  const isMobile = useIsMobile();

  // Get webcam players for filmstrip (filter out self - local stream is rendered separately)
  const webcamPlayers: WebcamPlayer[] = lobby?.players
    .filter(p => p.socketId !== lobby.mySocketId)
    .map(p => ({
      id: p.socketId,
      name: p.name,
      avatarUrl: p.avatarUrl
    })) || [];

  // Get local player name for video display
  const localPlayerName = lobby?.players.find(p => p.socketId === lobby.mySocketId)?.name;

  return (
    <div className={`app-root ${lobby ? 'in-room' : ''}`}>
      <div className="app-layout">
        {renderContent()}
      </div>
      {/* VideoFilmstrip at App level - outside app-layout for proper resize behavior */}
      {/* Only show on desktop - mobile uses MobileVideoGrid in drawer */}
      {lobby && !isMobile && (
        <VideoFilmstrip
          players={webcamPlayers}
          roomCode={lobby.code}
          localPlayerName={localPlayerName}
          teams={lobby.gameData?.teams || []}
          mySocketId={lobby.mySocketId}
        />
      )}
    </div>
  );
}

function App() {
  const [lobby, setLobby] = useState<Lobby | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [kickMessage, setKickMessage] = useState<string | null>(null);
  const audioInitialized = useRef(false);

  // Initialize audio system on mount
  useEffect(() => {
    // Load audio preferences from localStorage
    const musicVolume = localStorage.getItem(AUDIO_STORAGE_KEYS.MUSIC_VOLUME);
    const musicEnabled = localStorage.getItem(AUDIO_STORAGE_KEYS.MUSIC_ENABLED);
    const sfxVolume = localStorage.getItem(AUDIO_STORAGE_KEYS.SFX_VOLUME);
    const sfxEnabled = localStorage.getItem(AUDIO_STORAGE_KEYS.SFX_ENABLED);

    // Apply saved preferences
    if (musicVolume) backgroundMusic.setVolume(parseInt(musicVolume, 10) / 100);
    if (musicEnabled) backgroundMusic.setMuted(musicEnabled === 'false');
    if (sfxVolume) soundEffects.setVolume(parseInt(sfxVolume, 10) / 100);
    if (sfxEnabled) soundEffects.setEnabled(sfxEnabled !== 'false');

    // Preload sound effects
    initAudio().catch(console.warn);
  }, []);

  // Start background music on first user interaction (browser autoplay policy)
  useEffect(() => {
    if (audioInitialized.current) return;

    const startMusic = async () => {
      if (audioInitialized.current) return;
      audioInitialized.current = true;

      // Unlock audio first (critical for mobile), then play
      await backgroundMusic.unlockAudio();
      playBackgroundMusic().catch(console.warn);

      // Remove all listeners
      document.removeEventListener('click', startMusic);
      document.removeEventListener('touchstart', startMusic);
      document.removeEventListener('keydown', startMusic);
    };

    // Try to play immediately (will fail if no prior interaction)
    playBackgroundMusic().then(() => {
      audioInitialized.current = true;
    }).catch(() => {
      // Autoplay blocked - wait for user interaction
      // Include touchstart for mobile browsers (iOS Safari requires it)
      document.addEventListener('click', startMusic);
      document.addEventListener('touchstart', startMusic);
      document.addEventListener('keydown', startMusic);
    });

    return () => {
      document.removeEventListener('click', startMusic);
      document.removeEventListener('touchstart', startMusic);
      document.removeEventListener('keydown', startMusic);
    };
  }, []);

  // Initialize socket connection
  useEffect(() => {
    const socket = socketService.connect();
    console.log('[App] Socket object created, connected?', socket.connected, 'id:', socket.id);

    const onConnect = async () => {
      console.log('[App] Socket connected, id:', socket.id);
      setIsConnected(true);
      setError(null);

      // Handle GameBuddies session auto-join (must be inside connect handler)
      let session = getCurrentSession();

      // If no session but we have a pending one, try to resolve it
      if (!session) {
        console.log('[App] No immediate session, checking for pending resolution...');
        session = await resolvePendingSession();
      } else if (session.sessionToken && !session.roomCode) {
        // Session exists but room code is undefined - need to resolve it
        console.log('[App] Session exists but room code is undefined, resolving...');
        session = await resolvePendingSession();
      }

      if (session && session.roomCode && session.playerName) {
        console.log('[App] GameBuddies session detected:', {
          roomCode: session.roomCode,
          playerName: session.playerName,
          isHost: session.isHost,
          sessionToken: session.sessionToken?.substring(0, 8) + '...',
        });

        // Delay to let React render before emitting
        setTimeout(() => {
          const sock = socketService.getSocket();
          if (!sock) return;

          if (session!.isHost) {
            console.log('[App] Auto-creating room as host');
            console.log('[App] Creating room with streamerMode:', session!.isStreamerMode, 'hideRoomCode:', session!.hideRoomCode);
            console.log('[App] Creating room with playerId:', session!.playerId, 'userId:', session!.userId);
            sock.emit('room:create', {
              playerName: session!.playerName,
              roomCode: session!.roomCode,
              sessionToken: session!.sessionToken,
              premiumTier: session!.premiumTier,
              avatarUrl: session!.avatarUrl,
              playerId: session!.playerId,
              userId: session!.userId,
              isGameBuddiesRoom: true,
              streamerMode: session!.isStreamerMode,
              hideRoomCode: session!.hideRoomCode,
            });
          } else {
            console.log('[App] Auto-joining room as player');
            console.log('[App] Joining room with playerId:', session!.playerId, 'userId:', session!.userId);
            sock.emit('room:join', {
              roomCode: session!.roomCode,
              playerName: session!.playerName,
              sessionToken: session!.sessionToken,
              avatarUrl: session!.avatarUrl,
              playerId: session!.playerId,
              userId: session!.userId,
              premiumTier: session!.premiumTier,
            });
          }
        }, 100);
      }
    };

    const onDisconnect = () => {
      console.log('[App] Socket disconnected');
      setIsConnected(false);
    };

    const onError = (data: { message: string }) => {
      console.log('[App] Socket error:', data);
      setError(data.message);
    };

    const onRoomCreated = (data: { room?: Lobby; sessionToken?: string }) => {
      console.log('[App] room:created received:', data);
      console.log('[App] room state:', data?.room?.state);
      console.log('[App] room isStreamerMode:', data?.room?.isStreamerMode);
      console.log('[App] room hideRoomCode:', data?.room?.hideRoomCode);
      if (data?.room) {
        console.log('[App] Setting lobby, state:', data.room.state);
        setLobby(data.room);
        // Safely get player name with null checks
        const playerName = data.room.players?.length > 0 ? data.room.players[0].name : '';
        socketService.persistReconnectionData(
          data.room.code,
          playerName,
          data.sessionToken || ''
        );
      } else {
        console.warn('[App] room:created but no room in data!');
      }
    };

    const onRoomJoined = (data: { room?: Lobby; sessionToken?: string }) => {
      console.log('[App] room:joined received:', data);
      console.log('[App] room state:', data?.room?.state);
      console.log('[App] room isStreamerMode:', data?.room?.isStreamerMode);
      console.log('[App] room hideRoomCode:', data?.room?.hideRoomCode);
      if (data?.room) {
        console.log('[App] Setting lobby, state:', data.room.state);
        setLobby(data.room);
        const myName = data.room.players.find(p => p.socketId === data.room!.mySocketId)?.name || '';
        socketService.persistReconnectionData(data.room.code, myName, data.sessionToken || '');
      } else {
        console.warn('[App] room:joined but no room in data!');
      }
    };

    const onRoomStateUpdated = (data: Lobby) => {
      console.log('[App] roomStateUpdated received:', data);
      console.log('[App] lobby isStreamerMode:', data?.isStreamerMode);
      console.log('[App] lobby hideRoomCode:', data?.hideRoomCode);
      setLobby(data);
    };

    const onChatMessage = (message: ChatMessage) => {
      setMessages(prev => [...prev, message]);
    };

    // GameBuddies return redirect handler
    const onGameBuddiesReturnRedirect = (data: {
      returnUrl: string;
      sessionToken?: string;
      delayMs?: number;
    }) => {
      console.log('[App] Received gamebuddies:return-redirect:', data);
      // Small delay to allow UI to update, then redirect
      setTimeout(() => {
        window.location.href = data.returnUrl;
      }, data.delayMs || 500);
    };

    // Kicked by host handler
    const onKicked = (data: { message: string }) => {
      console.log('[KICK-CLIENT] ===== RECEIVED player:kicked =====');
      console.log('[KICK-CLIENT] Message:', data.message);
      console.log('[KICK-CLIENT] Clearing ALL session data...');

      // CRITICAL: Clear ALL session storage to prevent F5 rejoin
      clearSession(); // Clear gamebuddies:session
      socketService.clearReconnectionData(); // Clear template_* keys
      sessionStorage.removeItem('gameSessionToken');

      // Show toast notification
      setKickMessage(data.message);

      // Clear state
      setLobby(null);
      setMessages([]);
      setError(null);

      console.log('[KICK-CLIENT] State cleared, toast shown');
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('error', onError);
    socket.on('room:created', onRoomCreated);
    socket.on('room:joined', onRoomJoined);
    socket.on('roomStateUpdated', onRoomStateUpdated);
    socket.on('chat:message', onChatMessage);
    socket.on('gamebuddies:return-redirect', onGameBuddiesReturnRedirect);
    socket.on('player:kicked', onKicked);


    // Cleanup: Only remove listeners, don't disconnect
    // Socket will be reused due to multiplex: true
    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('error', onError);
      socket.off('room:created', onRoomCreated);
      socket.off('room:joined', onRoomJoined);
      socket.off('roomStateUpdated', onRoomStateUpdated);
      socket.off('chat:message', onChatMessage);
      socket.off('gamebuddies:return-redirect', onGameBuddiesReturnRedirect);
      socket.off('player:kicked', onKicked);
    };
  }, []);


  const handleCreateRoom = (playerName: string, streamerMode?: boolean) => {
    const socket = socketService.getSocket();
    if (socket?.connected) {
      socket.emit('room:create', { playerName, streamerMode: streamerMode || false });
    } else {
      console.warn('[App] Cannot create room - socket not connected');
      setError('Connection lost. Please refresh the page.');
    }
  };

  const handleJoinRoom = (roomCode: string, playerName: string) => {
    const socket = socketService.getSocket();
    if (socket?.connected) {
      socket.emit('room:join', { roomCode, playerName });
    } else {
      console.warn('[App] Cannot join room - socket not connected');
      setError('Connection lost. Please refresh the page.');
    }
  };

  const handleJoinWithInvite = (inviteToken: string, playerName: string) => {
    const socket = socketService.getSocket();
    if (socket?.connected) {
      socket.emit('room:join', { inviteToken, playerName });
    } else {
      console.warn('[App] Cannot join room - socket not connected');
      setError('Connection lost. Please refresh the page.');
    }
  };

  const handleStartGame = () => {
    const socket = socketService.getSocket();
    if (socket?.connected && lobby) {
      socket.emit('game:start', { roomCode: lobby.code });
    } else if (!socket?.connected) {
      console.warn('[App] Cannot start game - socket not connected');
      setError('Connection lost. Please refresh the page.');
    }
  };

  const handleLeave = () => {
    socketService.clearReconnectionData();
    setLobby(null);
    setMessages([]);
    window.location.href = window.location.pathname;
  };

  // Render based on state
  const renderContent = () => {
    // No lobby - show home page
    if (!lobby) {
      return (
        <HomePage
          onCreateRoom={handleCreateRoom}
          onJoinRoom={handleJoinRoom}
          onJoinWithInvite={handleJoinWithInvite}
          isConnecting={!isConnected}
          error={error}
        />
      );
    }

    // In lobby or game
    console.log('[App] Rendering with lobby state:', lobby.state);
    const session = getCurrentSession();
    console.log('[App] Current session for render:', session);

    return lobby.state === 'lobby' ? (
      <LobbyPage
        lobby={lobby}
        messages={messages}
        gameBuddiesSession={session}
        onStartGame={handleStartGame}
        onLeave={handleLeave}
      />
    ) : (
      <GamePage
        lobby={lobby}
        messages={messages}
        gameBuddiesSession={session}
        onLeave={handleLeave}
      />
    );
  };

  return (
    <ThemeProvider>
      <WebRTCProvider socket={socketService.getSocket()} roomCode={lobby?.code || null}>
        <VideoUIProvider>
          <AppContent lobby={lobby} renderContent={renderContent} />
          {/* Video hooks activation (keyboard shortcuts, preferences) */}
          <VideoHooksManager />
          {/* Video Settings Modal - shown when preparing to join video */}
          <VideoSettingsManager />
          {/* PWA Install Prompt - shows on mobile after delay */}
          <InstallPrompt />
          {/* Kick Toast Notification - shown when player is kicked */}
          <KickToast message={kickMessage} onClose={() => setKickMessage(null)} />
        </VideoUIProvider>
      </WebRTCProvider>
    </ThemeProvider>
  );
}

export default App;
