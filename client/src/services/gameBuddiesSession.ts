/**
 * GameBuddies Session Management
 * Handles session detection, storage, and resolution from URL params
 */

export type GameBuddiesSession = {
  roomCode: string;
  playerName?: string;
  playerId?: string;
  userId?: string;
  isHost: boolean;
  expectedPlayers?: number;
  returnUrl: string;
  sessionToken?: string;
  source: 'gamebuddies';
  isStreamerMode?: boolean;
  hideRoomCode?: boolean;
  pendingResolution?: boolean;
  premiumTier?: 'free' | 'premium' | 'pro';
  avatarUrl?: string;
};

const SESSION_KEY = 'gamebuddies:session';

/**
 * Parse GameBuddies session from URL parameters
 */
export function parseGameBuddiesSession(): GameBuddiesSession | null {
  const params = new URLSearchParams(window.location.search);

  const sessionToken = params.get('session');
  const players = params.get('players');
  const playerName = params.get('name');
  const playerId = params.get('playerId');
  const role = params.get('role');

  // Detect session token URLs (secure GameBuddies mode)
  if (sessionToken) {
    const existingSession = loadSession();

    if (existingSession && existingSession.sessionToken === sessionToken) {
      console.log('[parseGameBuddiesSession] Found existing session for this token');
      return null; // Let getCurrentSession fall through to loadSession
    }

    console.log('[parseGameBuddiesSession] Creating new pending session');

    const pendingSession = {
      pendingResolution: true,
      sessionToken,
      playerName: playerName || undefined,
      playerId: playerId || undefined,
      isHost: role === 'gm' || role === 'host',
      expectedPlayers: parseInt(players || '0') || 0,
      source: 'gamebuddies' as const,
      isStreamerMode: params.get('streamerMode') === 'true',
      roomCode: '',
      returnUrl: 'https://gamebuddies.io',
    };

    sessionStorage.setItem(SESSION_KEY, JSON.stringify(pendingSession));
    return null;
  }

  // Original GameBuddies mode (with roomcode in URL)
  const roomCode = params.get('room') || params.get('gbRoomCode');
  const isHost = role === 'host' || role === 'gm' || params.get('isHost') === 'true';
  const expectedPlayers = parseInt(params.get('players') || '0');
  const returnUrl = params.get('returnUrl');
  const avatarUrl = params.get('avatar') || params.get('avatarUrl') || undefined;
  const isStreamerMode = params.get('streamerMode') === 'true';

  const isGameBuddiesSession = !!(roomCode && (playerName || playerId || isHost));

  if (!isGameBuddiesSession) {
    return null;
  }

  return {
    roomCode: roomCode!,
    playerName: playerName || undefined,
    playerId: playerId || undefined,
    isHost,
    expectedPlayers,
    returnUrl: returnUrl || `https://gamebuddies.io/lobby/${roomCode}`,
    sessionToken: sessionToken || undefined,
    source: 'gamebuddies',
    isStreamerMode,
    hideRoomCode: isStreamerMode,
    avatarUrl,
  };
}

/**
 * Store session in sessionStorage
 */
export function storeSession(session: GameBuddiesSession | null) {
  if (!session) {
    clearSession();
    return;
  }

  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

/**
 * Load session from sessionStorage
 */
export function loadSession(): GameBuddiesSession | null {
  const stored = sessionStorage.getItem(SESSION_KEY);
  if (!stored) return null;

  try {
    return JSON.parse(stored);
  } catch (e) {
    console.error('[GameBuddies] Failed to parse session:', e);
    return null;
  }
}

/**
 * Clear session from sessionStorage
 */
export function clearSession() {
  sessionStorage.removeItem(SESSION_KEY);
}

/**
 * Get current session (from URL or storage)
 */
export function getCurrentSession(): GameBuddiesSession | null {
  console.log('[getCurrentSession] Called');

  const urlSession = parseGameBuddiesSession();
  console.log('[getCurrentSession] URL session:', urlSession);

  if (urlSession) {
    storeSession(urlSession);
    console.log('[getCurrentSession] Returning URL session');
    return urlSession;
  }

  const storedSession = loadSession();
  console.log('[getCurrentSession] Loaded session from storage:', storedSession);
  console.log('[getCurrentSession] pendingResolution?', storedSession?.pendingResolution);

  return storedSession;
}

/**
 * Resolve session token to get actual room code from GameBuddies API
 */
export async function resolveSessionToken(sessionToken: string): Promise<{
  roomCode: string;
  gameType: string;
  streamerMode: boolean;
  playerId?: string;
  userId?: string;
  playerName?: string;
  isHost?: boolean;
  premiumTier?: string;
  avatarUrl?: string;
} | null> {
  try {
    console.log(`[GameBuddies] Resolving session token: ${sessionToken.substring(0, 8)}...`);

    const baseUrl = 'https://gamebuddies.io';
    const fullUrl = `${baseUrl}/api/game-sessions/${sessionToken}`;

    const response = await fetch(fullUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      mode: 'cors',
      credentials: 'include'
    });

    if (!response.ok) {
      console.error('[GameBuddies] Failed to resolve session token:', response.status);
      return null;
    }

    const data = await response.json();

    if (data.success && data.session) {
      const session = data.session;
      console.log(`[GameBuddies] Session resolved to room: ${session.roomCode}`);
      return {
        roomCode: session.roomCode,
        gameType: session.gameType,
        streamerMode: session.streamerMode ?? false,
        playerId: session.playerId,
        userId: session.userId,
        playerName: session.playerName,
        isHost: session.isHost,
        premiumTier: session.premiumTier,
        avatarUrl: session.avatarUrl,
      };
    } else {
      console.error('[GameBuddies] Session resolution failed:', data);
      return null;
    }
  } catch (error) {
    console.error('[GameBuddies] Error resolving session token:', error);
    return null;
  }
}

/**
 * Resolve pending session asynchronously
 */
export async function resolvePendingSession(): Promise<GameBuddiesSession | null> {
  console.log('[resolvePendingSession] Called');
  const stored = sessionStorage.getItem(SESSION_KEY);
  console.log('[resolvePendingSession] Stored session:', stored);

  if (!stored) {
    console.log('[resolvePendingSession] No stored session found');
    return null;
  }

  try {
    const pending = JSON.parse(stored);
    console.log('[resolvePendingSession] Parsed pending:', pending);

    if (!pending.pendingResolution || !pending.sessionToken) {
      console.log('[resolvePendingSession] Not pending or no token, returning as-is');
      return pending;
    }

    console.log('[GameBuddies] Resolving pending session...');

    const resolved = await resolveSessionToken(pending.sessionToken);
    console.log('[resolvePendingSession] Resolved from API:', resolved);

    if (!resolved) {
      console.error('[GameBuddies] Failed to resolve session token');
      clearSession();
      return null;
    }

    const finalSession: GameBuddiesSession = {
      roomCode: resolved.roomCode,
      playerName: resolved.playerName || pending.playerName,
      playerId: resolved.playerId || pending.playerId,
      userId: resolved.userId,
      isHost: resolved.isHost ?? pending.isHost,
      expectedPlayers: pending.expectedPlayers,
      returnUrl: `https://gamebuddies.io/lobby/${resolved.roomCode}`,
      sessionToken: pending.sessionToken,
      source: 'gamebuddies',
      isStreamerMode: resolved.streamerMode ?? pending.isStreamerMode ?? false,
      hideRoomCode: resolved.streamerMode ?? pending.isStreamerMode ?? false,
      premiumTier: (resolved.premiumTier as 'free' | 'premium' | 'pro') || 'free',
      avatarUrl: resolved.avatarUrl,
    };

    console.log('[resolvePendingSession] Final session:', finalSession);
    storeSession(finalSession);
    console.log('[resolvePendingSession] Session stored successfully');
    return finalSession;
  } catch (error) {
    console.error('[GameBuddies] Failed to resolve pending session:', error);
    clearSession();
    return null;
  }
}
