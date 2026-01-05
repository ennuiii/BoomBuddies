import { io, Socket } from 'socket.io-client';
import { STORAGE_KEYS } from '../config/storageKeys';

// Use environment variable in development, same origin in production (for GameBuddies reverse proxy)
const getServerUrl = (): string => {
  // In Capacitor, window.location.origin is https://localhost
  // Must check this FIRST before VITE_BACKEND_URL which may be set for web dev
  if (window.location.origin === 'https://localhost') {
    return 'https://ddf-server.onrender.com';
  }

  // If VITE_BACKEND_URL is explicitly set, use it
  if (import.meta.env.VITE_BACKEND_URL) {
    return import.meta.env.VITE_BACKEND_URL;
  }

  // In production, use same origin (works with reverse proxy)
  if (import.meta.env.PROD) {
    return window.location.origin;
  }

  // Development fallback
  return 'http://localhost:3001';
};

const SERVER_URL = getServerUrl();

// Game namespace - must match server plugin namespace
const GAME_NAMESPACE = '/bomberman';

class SocketService {
  private socket: Socket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 15;
  private listenersSetup = false;

  // Store listener references for cleanup
  private visibilityListener: (() => void) | null = null;
  private onlineListener: (() => void) | null = null;
  private offlineListener: (() => void) | null = null;

  connect(): Socket {
    if (this.socket?.connected) {
      return this.socket;
    }

    const fullUrl = `${SERVER_URL}${GAME_NAMESPACE}`;
    console.log('[Socket] Connecting to server:', fullUrl);
    console.log('[Socket] SERVER_URL:', SERVER_URL);
    console.log('[Socket] GAME_NAMESPACE:', GAME_NAMESPACE);

    this.socket = io(fullUrl, {
      reconnection: true,
      reconnectionAttempts: this.maxReconnectAttempts,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      transports: ['websocket', 'polling'],
      timeout: 20000,
      forceNew: false,
      multiplex: true,
    });

    // Log socket manager events
    this.socket.io.on('error', (error) => {
      console.error('[Socket.IO Manager] Error:', error);
    });

    this.socket.io.on('reconnect_attempt', (attempt) => {
      console.log('[Socket.IO Manager] Reconnect attempt:', attempt);
    });

    this.socket.on('connect', () => {
      console.log('[Socket] Connected:', this.socket?.id);
      this.reconnectAttempts = 0;

      // Check for automatic state recovery (Socket.IO v4.5+)
      if ((this.socket as any).recovered) {
        console.log('[Socket] Connection state recovered automatically');
        return;
      }

      // Check for session token in URL params
      const params = new URLSearchParams(window.location.search);
      if (params.has('session')) {
        const urlToken = params.get('session') || '';
        if (urlToken) {
          console.log('[Socket] Session token detected in URL');
          sessionStorage.setItem('gameSessionToken', urlToken);
        }
      }

      // Manual reconnection with stored data
      const stored = this.getStoredReconnectionData();
      if (stored.sessionToken && stored.roomCode && stored.playerName) {
        console.log(`[Socket] Attempting auto-reconnection to room ${stored.roomCode}`);
        this.socket?.emit('room:join', {
          roomCode: stored.roomCode,
          playerName: stored.playerName,
          sessionToken: stored.sessionToken,
          avatarUrl: stored.avatarUrl || undefined,
        });
      }
    });

    this.socket.on('disconnect', (reason) => {
      console.log('[Socket] Disconnected:', reason);
    });

    this.socket.on('reconnect_attempt', () => {
      this.reconnectAttempts++;
      console.log(`[Socket] Reconnect attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);
    });

    this.socket.on('reconnect', (attemptNumber: number) => {
      console.log(`[Socket] Reconnected after ${attemptNumber} attempts`);
    });

    this.socket.on('reconnect_failed', () => {
      console.error('[Socket] Reconnection failed after all attempts');
    });

    this.socket.on('error', (error) => {
      console.error('[Socket] Error:', error);
    });

    this.socket.on('connect_error', (error) => {
      console.error('[Socket] Connection error:', error.message);
      console.error('[Socket] Error details:', error);
    });

    // Setup browser event listeners (only once)
    if (!this.listenersSetup) {
      this.setupPageVisibilityListener();
      this.setupNetworkListeners();
      this.listenersSetup = true;
    }

    return this.socket;
  }

  // ===== Session Storage Methods =====

  persistReconnectionData(roomCode: string, playerName: string, sessionToken: string): void {
    console.log(`[Socket] Persisting reconnection data for room ${roomCode}`);
    sessionStorage.setItem(STORAGE_KEYS.SESSION.ROOM_CODE, roomCode);
    sessionStorage.setItem(STORAGE_KEYS.SESSION.PLAYER_NAME, playerName);
    sessionStorage.setItem(STORAGE_KEYS.SESSION.SESSION_TOKEN, sessionToken);
  }

  getStoredReconnectionData(): {
    roomCode: string | null;
    playerName: string | null;
    sessionToken: string | null;
    avatarUrl: string | null;
  } {
    return {
      roomCode: sessionStorage.getItem(STORAGE_KEYS.SESSION.ROOM_CODE),
      playerName: sessionStorage.getItem(STORAGE_KEYS.SESSION.PLAYER_NAME),
      sessionToken: sessionStorage.getItem(STORAGE_KEYS.SESSION.SESSION_TOKEN),
      avatarUrl: sessionStorage.getItem('avatarUrl'),
    };
  }

  clearReconnectionData(): void {
    console.log('[Socket] Clearing reconnection data');
    sessionStorage.removeItem(STORAGE_KEYS.SESSION.ROOM_CODE);
    sessionStorage.removeItem(STORAGE_KEYS.SESSION.PLAYER_NAME);
    sessionStorage.removeItem(STORAGE_KEYS.SESSION.SESSION_TOKEN);
  }

  // ===== Browser Event Listeners =====

  private setupPageVisibilityListener(): void {
    this.visibilityListener = () => {
      const stored = this.getStoredReconnectionData();

      if (document.visibilityState === 'visible') {
        console.log('[Socket] Page became visible');

        if (!this.socket?.connected) {
          console.log('[Socket] Connection lost while backgrounded, reconnecting...');
          this.socket?.connect();
        } else if (stored.roomCode) {
          console.log('[Socket] Sending heartbeat to server');
          this.socket.emit('client:heartbeat', {
            roomCode: stored.roomCode,
            timestamp: Date.now(),
          });
        }
      } else {
        console.log('[Socket] Page backgrounded');
        if (this.socket?.connected && stored.roomCode) {
          this.socket.emit('client:page-backgrounded', {
            roomCode: stored.roomCode,
            timestamp: Date.now(),
          });
        }
      }
    };
    document.addEventListener('visibilitychange', this.visibilityListener);
  }

  private setupNetworkListeners(): void {
    this.onlineListener = () => {
      console.log('[Socket] Network online - checking connection');
      if (!this.socket?.connected) {
        console.log('[Socket] Reconnecting after network restored...');
        this.socket?.connect();
      }
    };

    this.offlineListener = () => {
      console.log('[Socket] Network offline');
    };

    window.addEventListener('online', this.onlineListener);
    window.addEventListener('offline', this.offlineListener);
  }

  private cleanupBrowserListeners(): void {
    if (this.visibilityListener) {
      document.removeEventListener('visibilitychange', this.visibilityListener);
      this.visibilityListener = null;
    }
    if (this.onlineListener) {
      window.removeEventListener('online', this.onlineListener);
      this.onlineListener = null;
    }
    if (this.offlineListener) {
      window.removeEventListener('offline', this.offlineListener);
      this.offlineListener = null;
    }
    this.listenersSetup = false;
  }

  // ===== Core Socket Methods =====

  getSocket(): Socket | null {
    return this.socket;
  }

  disconnect(): void {
    this.cleanupBrowserListeners();

    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      console.log('[Socket] Disconnected');
    }
  }

  emit(event: string, data?: unknown): void {
    if (this.socket?.connected) {
      this.socket.emit(event, data);
    } else {
      console.error('[Socket] Cannot emit - not connected');
    }
  }

  on(event: string, callback: (...args: unknown[]) => void): void {
    this.socket?.on(event, callback);
  }

  off(event: string, callback?: (...args: unknown[]) => void): void {
    this.socket?.off(event, callback);
  }

  isConnected(): boolean {
    return this.socket?.connected ?? false;
  }
}

export default new SocketService();
