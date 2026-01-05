# GameBuddies Template - Improvement Recommendations

This document provides a comprehensive audit of the GameBuddies Template with actionable improvements and mobile app conversion guidance.

---

## Table of Contents
1. [Executive Summary](#executive-summary)
2. [Client Improvements](#client-improvements)
3. [Server Improvements](#server-improvements)
4. [Mobile App Conversion Guide](#mobile-app-conversion-guide)
5. [Priority Action Items](#priority-action-items)

---

## Executive Summary

### Audit Statistics
| Category | Client Issues | Server Issues |
|----------|--------------|---------------|
| Security | 6 | 10 |
| Performance | 8 | 7 |
| Code Quality | 12 | 8 |
| Missing Features | 6 | 10 |
| Architecture | 4 | 8 |
| **Total** | **36** | **43** |

### Critical Issues Requiring Immediate Attention
1. **XSS vulnerability** in VideoFilmstrip dynamic HTML creation
2. **Premium tier spoofing** - server trusts client-provided premium status
3. **Memory leaks** in event listeners and broadcast throttling
4. **No WebRTC authentication** - signaling events unverified
5. **Unbounded chat message storage** - memory exhaustion risk

---

## Client Improvements

### Security Issues

#### 1. XSS Vulnerability in VideoFilmstrip (HIGH)
**File:** `client/src/components/video/VideoFilmstrip.tsx:174-211`

**Problem:** Dynamic HTML creation with potentially unsafe values.

**Fix:**
```typescript
// BEFORE (vulnerable)
const popupContent = `
  <style>
    :root { --primary: ${getComputedStyle(document.documentElement).getPropertyValue('--primary')}; }
  </style>
`;

// AFTER (safe)
const sanitizedStyles = {
  primary: CSS.escape(getComputedStyle(document.documentElement).getPropertyValue('--primary'))
};
```

#### 2. JSON.parse Without Try-Catch (HIGH)
**File:** `client/src/components/core/SettingsModal.tsx:44,48`

**Problem:** Corrupted localStorage crashes component.

**Fix:**
```typescript
// BEFORE
const [volume, setVolume] = useState(JSON.parse(localStorage.getItem('volume') || '50'));

// AFTER
const [volume, setVolume] = useState(() => {
  try {
    const stored = localStorage.getItem('volume');
    return stored ? JSON.parse(stored) : 50;
  } catch {
    console.warn('Invalid volume in localStorage, using default');
    return 50;
  }
});
```

#### 3. Unsafe URL Construction
**File:** `client/src/components/core/GameHeader.tsx:78-96`

**Problem:** Room code used in URL without validation.

**Fix:**
```typescript
const copyRoomLink = () => {
  const roomCode = encodeURIComponent(lobby.code.replace(/[^A-Z0-9]/gi, ''));
  const url = `${window.location.origin}?room=${roomCode}`;
  // ...
};
```

#### 4. localStorage Injection Risk
**File:** `client/src/services/socketService.ts:127-139`

**Problem:** Stored data read without validation.

**Fix:**
```typescript
const getReconnectionData = (): ReconnectionData | null => {
  try {
    const stored = localStorage.getItem('reconnectionData');
    if (!stored) return null;

    const data = JSON.parse(stored);

    // Validate structure
    if (!data.roomCode || typeof data.roomCode !== 'string' ||
        !data.playerName || typeof data.playerName !== 'string') {
      localStorage.removeItem('reconnectionData');
      return null;
    }

    return data;
  } catch {
    localStorage.removeItem('reconnectionData');
    return null;
  }
};
```

### Performance Issues

#### 5. Portal Key Regeneration (MEDIUM)
**File:** `client/src/components/video/VideoFilmstrip.tsx:302-309`

**Problem:** Key changes on every render, causing video stream disruption.

**Fix:**
```typescript
// BEFORE
<Portal key={`popup-${remoteStreams.size}-${isFilmstripExpanded}`}>

// AFTER - use stable key
<Portal key="video-popup-portal">
```

#### 6. Missing useMemo in GamePage
**File:** `client/src/pages/GamePage.tsx:78-84`

**Problem:** `webcamPlayers` array recreated every render.

**Fix:**
```typescript
const webcamPlayers = useMemo(() =>
  lobby.players
    .filter(p => p.socketId !== lobby.mySocketId)
    .map(p => ({ id: p.socketId, name: p.name, avatarUrl: p.avatarUrl })),
  [lobby.players, lobby.mySocketId]
);
```

#### 7. Large Context Dependency Array
**File:** `client/src/contexts/WebRTCContext.tsx:787-810`

**Problem:** 22 dependencies cause excessive re-renders.

**Fix:** Split into multiple contexts:
```typescript
// Separate contexts for different concerns
const WebRTCConnectionContext = createContext<ConnectionState>(null);
const WebRTCStreamContext = createContext<StreamState>(null);
const WebRTCControlsContext = createContext<ControlsState>(null);
```

#### 8. Chat Using Array Index as Key
**File:** `client/src/components/lobby/ChatWindow.tsx:89-114`

**Problem:** `key={index}` causes issues with message reordering.

**Fix:**
```typescript
// BEFORE
{messages.map((msg, index) => <Message key={index} ... />)}

// AFTER
{messages.map((msg) => <Message key={msg.id} ... />)}
```

### Memory Leaks

#### 9. Event Listener Leak in socketService
**File:** `client/src/services/socketService.ts:150-195`

**Problem:** Listeners added on connect but only cleaned on disconnect.

**Fix:**
```typescript
class SocketService {
  private cleanupFunctions: (() => void)[] = [];

  connect() {
    // ...
    const handleVisibility = () => { /* ... */ };
    document.addEventListener('visibilitychange', handleVisibility);
    this.cleanupFunctions.push(() =>
      document.removeEventListener('visibilitychange', handleVisibility)
    );
  }

  cleanup() {
    this.cleanupFunctions.forEach(fn => fn());
    this.cleanupFunctions = [];
  }
}
```

#### 10. VideoFilmstrip Drag Listener Leak
**File:** `client/src/components/video/VideoFilmstrip.tsx:101-131`

**Problem:** If component unmounts during drag, document listeners leak.

**Fix:**
```typescript
useEffect(() => {
  return () => {
    // Cleanup any lingering listeners on unmount
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  };
}, []);
```

### Missing Features

#### 11. No Chat Rate Limiting
**File:** `client/src/components/lobby/ChatWindow.tsx:40-51`

**Fix:**
```typescript
const [lastSendTime, setLastSendTime] = useState(0);
const RATE_LIMIT_MS = 500;

const handleSend = useCallback(() => {
  const now = Date.now();
  if (now - lastSendTime < RATE_LIMIT_MS) {
    // Show "slow down" message
    return;
  }
  setLastSendTime(now);
  // ... send message
}, [lastSendTime, message, roomCode]);
```

#### 12. Missing Accessibility (A11y)
**File:** `client/src/components/video/VideoFilmstrip.tsx:318`

**Fix:**
```typescript
// BEFORE
<div onClick={toggleFilmstrip}>...</div>

// AFTER
<button
  onClick={toggleFilmstrip}
  onKeyDown={(e) => e.key === 'Enter' && toggleFilmstrip()}
  aria-label="Toggle video filmstrip"
  aria-expanded={isFilmstripExpanded}
>
  ...
</button>
```

### Code Quality

#### 13. Remove Debug Logging
**Files:** Multiple (232 console.log calls found)

**Fix:** Create a logger utility:
```typescript
// utils/logger.ts
const isDev = import.meta.env.DEV;

export const logger = {
  debug: (...args: any[]) => isDev && console.log('[DEBUG]', ...args),
  warn: (...args: any[]) => console.warn('[WARN]', ...args),
  error: (...args: any[]) => console.error('[ERROR]', ...args),
};
```

#### 14. Add Error Boundaries
```typescript
// components/ErrorBoundary.tsx
class ErrorBoundary extends React.Component<Props, State> {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return <ErrorFallback error={this.state.error} />;
    }
    return this.props.children;
  }
}

// In App.tsx
<ErrorBoundary>
  <WebRTCProvider>
    ...
  </WebRTCProvider>
</ErrorBoundary>
```

---

## Server Improvements

### Security Issues

#### 1. Premium Tier Spoofing (CRITICAL)
**File:** `GameBuddieGamesServer/core/server.ts:556-566`

**Problem:** Server trusts client-provided `premiumTier`.

**Fix:**
```typescript
socket.on('room:create', async (data) => {
  // Validate premium tier with API
  let verifiedPremiumTier = 'free';
  if (data.playerId && data.sessionToken) {
    const validation = await gameBuddiesService.validatePremiumStatus(
      data.playerId,
      data.sessionToken
    );
    verifiedPremiumTier = validation.premiumTier || 'free';
  }

  const player = this.createPlayer(
    socket.id,
    nameValidation.sanitizedValue!,
    verifiedPremiumTier, // Use validated tier
    resolvedPlayerId
  );
});
```

#### 2. WebRTC Signaling Without Authentication (HIGH)
**File:** `GameBuddieGamesServer/core/server.ts:1138-1184`

**Problem:** Any socket can send WebRTC signals to any peer.

**Fix:**
```typescript
socket.on('webrtc:offer', (data) => {
  // Verify sender is in the same room as recipient
  const senderRoom = this.roomManager.getRoomBySocket(socket.id);
  const recipientRoom = this.roomManager.getRoomBySocket(data.toPeerId);

  if (!senderRoom || senderRoom.code !== recipientRoom?.code) {
    socket.emit('error', { message: 'Invalid WebRTC target' });
    return;
  }

  // Rate limit check...
  socket.to(data.toPeerId).emit('webrtc:offer', {
    fromPeerId: socket.id,
    offer: data.offer
  });
});
```

#### 3. Unbounded Chat Message Storage (HIGH)
**File:** `GameBuddieGamesServer/core/server.ts:1088`

**Problem:** `room.messages.push()` grows indefinitely.

**Fix:**
```typescript
const MAX_MESSAGES_PER_ROOM = 500;

room.messages.push(chatMessage);
if (room.messages.length > MAX_MESSAGES_PER_ROOM) {
  room.messages = room.messages.slice(-MAX_MESSAGES_PER_ROOM);
}
```

#### 4. Session Token Validation Gap (HIGH)
**File:** `GameBuddieGamesServer/core/server.ts:843-848`

**Problem:** Creates session without verifying token belongs to player.

**Fix:**
```typescript
if (!session && data.playerId) {
  // Validate token with GameBuddies API before accepting
  const isValid = await gameBuddiesService.validateSessionToken(
    data.playerId,
    data.sessionToken
  );

  if (isValid) {
    this.sessionManager.createSession(data.playerId, roomCode, data.sessionToken);
    session = this.sessionManager.validateSession(data.sessionToken);
  } else {
    socket.emit('error', { message: 'Invalid session token' });
    return;
  }
}
```

#### 5. No Input Size Limits on Socket Events
**File:** `GameBuddieGamesServer/core/server.ts` (all socket handlers)

**Fix:** Add middleware for payload size validation:
```typescript
// Middleware to validate payload size
const validatePayloadSize = (maxBytes: number) => (socket: Socket, next: Function) => {
  socket.use((packet, next) => {
    const size = JSON.stringify(packet).length;
    if (size > maxBytes) {
      return next(new Error('Payload too large'));
    }
    next();
  });
  next();
};

namespace.use(validatePayloadSize(50 * 1024)); // 50KB limit
```

#### 6. Rate Limiting is Single-Server Only
**File:** `GameBuddieGamesServer/core/services/ValidationService.ts:216-239`

**Fix:** Use Redis for distributed rate limiting:
```typescript
import Redis from 'ioredis';

class RateLimiter {
  private redis: Redis;

  async checkRateLimit(key: string, limit: number, windowMs: number): Promise<boolean> {
    const now = Date.now();
    const windowKey = `ratelimit:${key}:${Math.floor(now / windowMs)}`;

    const count = await this.redis.incr(windowKey);
    if (count === 1) {
      await this.redis.pexpire(windowKey, windowMs);
    }

    return count <= limit;
  }
}
```

### Performance Issues

#### 7. Broadcast Throttling Memory Leak (HIGH)
**File:** `GameBuddieGamesServer/core/server.ts:372-420`

**Problem:** Unbounded timer queue.

**Fix:**
```typescript
const MAX_PENDING_BROADCASTS = 10;

if (!this.pendingBroadcasts.has(roomCode)) {
  this.pendingBroadcasts.set(roomCode, []);
}
const queue = this.pendingBroadcasts.get(roomCode)!;

// Limit queue size - drop oldest if full
if (queue.length >= MAX_PENDING_BROADCASTS) {
  queue.shift(); // Drop oldest
}
queue.push({ event, data });
```

#### 8. Room Cleanup Bug - Wrong Key Deletion
**File:** `GameBuddieGamesServer/core/managers/RoomManager.ts:374-377`

**Problem:** Iterating `room.players.keys()` returns player IDs, not socket IDs.

**Fix:**
```typescript
// BEFORE (broken)
for (const socketId of room.players.keys()) {
  this.playerRoomMap.delete(socketId);
}

// AFTER (correct)
for (const player of room.players.values()) {
  this.playerRoomMap.delete(player.socketId);
  this.socketToPlayerId.delete(player.socketId);
}
```

#### 9. Session Cleanup O(n) Scan
**File:** `GameBuddieGamesServer/core/managers/SessionManager.ts:204-219`

**Fix:** Use a sorted set for expiry times:
```typescript
class SessionManager {
  private sessions = new Map<string, PlayerSession>();
  private expiryQueue: Array<{token: string, expiresAt: number}> = [];

  cleanup() {
    const now = Date.now();
    while (this.expiryQueue.length > 0 && this.expiryQueue[0].expiresAt < now) {
      const { token } = this.expiryQueue.shift()!;
      this.sessions.delete(token);
    }
  }
}
```

#### 10. No Connection Pooling for API Calls
**File:** `GameBuddieGamesServer/core/services/GameBuddiesService.ts`

**Fix:**
```typescript
import axios from 'axios';
import https from 'https';

const axiosInstance = axios.create({
  baseURL: process.env.GAMEBUDDIES_API_URL,
  timeout: 10000,
  httpsAgent: new https.Agent({
    keepAlive: true,
    maxSockets: 50,
  }),
});
```

### Architecture Issues

#### 11. Host Always Set to True on Rejoin (BUG)
**File:** `GameBuddieGamesServer/core/server.ts:509-514`

**Problem:** `existingPlayer.isHost = true` always, even for non-hosts.

**Fix:**
```typescript
// BEFORE
existingPlayer.isHost = true;

// AFTER - preserve original host status
// existingPlayer.isHost already contains correct value, don't override
```

#### 12. Manual Plugin Registration
**File:** `GameBuddieGamesServer/core/server.ts:1538-1609`

**Fix:** Auto-discover plugins:
```typescript
import { readdirSync } from 'fs';
import { join } from 'path';

async loadGamePlugins(): Promise<void> {
  const gamesDir = join(__dirname, '../games');
  const gameFolders = readdirSync(gamesDir, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name);

  for (const folder of gameFolders) {
    try {
      const pluginPath = join(gamesDir, folder, 'plugin.js');
      const plugin = await import(pluginPath);
      await this.registerGame(plugin.default);
      console.log(`[Server] Auto-registered: ${folder}`);
    } catch (e) {
      console.warn(`[Server] Skipping ${folder}: no valid plugin`);
    }
  }
}
```

#### 13. Add Configuration Validation
```typescript
// config/validate.ts
const requiredEnvVars = [
  'PORT',
  'GAMEBUDDIES_API_KEY',
  'CORS_ORIGINS',
];

export function validateConfig() {
  const missing = requiredEnvVars.filter(v => !process.env[v]);
  if (missing.length > 0) {
    console.error('Missing required environment variables:', missing.join(', '));
    process.exit(1);
  }
}

// In server.ts
validateConfig();
```

#### 14. Add Circuit Breaker for External APIs
```typescript
class CircuitBreaker {
  private failures = 0;
  private lastFailure = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';

  constructor(
    private threshold: number = 5,
    private resetTimeout: number = 30000
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailure > this.resetTimeout) {
        this.state = 'half-open';
      } else {
        throw new Error('Circuit breaker is open');
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess() {
    this.failures = 0;
    this.state = 'closed';
  }

  private onFailure() {
    this.failures++;
    this.lastFailure = Date.now();
    if (this.failures >= this.threshold) {
      this.state = 'open';
    }
  }
}
```

---

## Mobile App Conversion Guide

### Option Comparison

| Feature | Capacitor | React Native | PWA |
|---------|-----------|--------------|-----|
| **Code Reuse** | 95%+ | 60-70% | 100% |
| **Performance** | Good | Best | Adequate |
| **WebRTC Support** | Via WebView (iOS 14.5+) | Native library | Browser-dependent |
| **Development Time** | Fastest | Slower | None |
| **Native Features** | Via plugins | Direct access | Limited |
| **App Store** | Yes | Yes | No (except PWA stores) |
| **Best For** | Quick conversion | High-performance games | Simple games |

### Recommended Approach: Capacitor

For GameBuddies Template, **Capacitor is recommended** because:
1. Minimal code changes required (95%+ reuse)
2. Existing React/Vite stack is fully supported
3. WebRTC works in WebView (iOS 14.5+ required)
4. Faster time-to-market
5. Single codebase for web + mobile

### Step-by-Step Capacitor Setup

#### 1. Install Capacitor
```bash
cd client
npm install @capacitor/core @capacitor/cli
npx cap init "GameBuddies Template" "io.gamebuddies.template"
```

#### 2. Configure Capacitor
Create `capacitor.config.ts`:
```typescript
import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'io.gamebuddies.template',
  appName: 'GameBuddies Template',
  webDir: 'dist',
  server: {
    // For development - connect to local server
    url: 'http://YOUR_LOCAL_IP:5173',
    cleartext: true,
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: false,
      backgroundColor: '#1a1a2e',
    },
  },
  ios: {
    contentInset: 'automatic',
  },
  android: {
    allowMixedContent: true,
  },
};

export default config;
```

#### 3. Add Platforms
```bash
npm install @capacitor/android @capacitor/ios

# Build your Vite app first
npm run build

# Add platforms
npx cap add android
npx cap add ios
```

#### 4. Configure Permissions

**Android** (`android/app/src/main/AndroidManifest.xml`):
```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.RECORD_AUDIO" />
<uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" />
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />

<uses-feature android:name="android.hardware.camera" android:required="false" />
<uses-feature android:name="android.hardware.camera.autofocus" android:required="false" />
```

**iOS** (`ios/App/App/Info.plist`):
```xml
<key>NSCameraUsageDescription</key>
<string>GameBuddies needs camera access for video chat</string>
<key>NSMicrophoneUsageDescription</key>
<string>GameBuddies needs microphone access for voice chat</string>
```

#### 5. WebRTC Configuration for Mobile

Update `WebRTCContext.tsx` for mobile compatibility:
```typescript
// Add mobile-specific ICE servers
const mobileIceServers = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  // Add TURN servers for mobile (required for cellular networks)
  {
    urls: 'turn:your-turn-server.com:3478',
    username: 'user',
    credential: 'password',
  },
];

// Detect mobile and use appropriate config
const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
const iceServers = isMobile ? mobileIceServers : defaultIceServers;
```

#### 6. Handle Mobile-Specific Issues

```typescript
// client/src/utils/mobileCompat.ts

// Handle iOS audio context restrictions
export async function initializeAudioContext() {
  const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
  const audioContext = new AudioContext();

  if (audioContext.state === 'suspended') {
    await audioContext.resume();
  }

  return audioContext;
}

// Handle background/foreground transitions
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    // Pause video streams to save battery
    pauseVideoStreams();
  } else {
    // Resume video streams
    resumeVideoStreams();
  }
});

// Handle mobile keyboard
export function handleMobileKeyboard() {
  const visualViewport = window.visualViewport;
  if (visualViewport) {
    visualViewport.addEventListener('resize', () => {
      document.documentElement.style.setProperty(
        '--viewport-height',
        `${visualViewport.height}px`
      );
    });
  }
}
```

#### 7. Build and Run

```bash
# Sync web assets to native projects
npm run build
npx cap sync

# Open in Android Studio
npx cap open android

# Open in Xcode
npx cap open ios

# Live reload during development
npx cap run android --livereload --external
npx cap run ios --livereload --external
```

#### 8. Useful Capacitor Plugins

```bash
# Status bar customization
npm install @capacitor/status-bar

# Splash screen
npm install @capacitor/splash-screen

# Haptic feedback
npm install @capacitor/haptics

# Push notifications (for game invites)
npm install @capacitor/push-notifications

# App lifecycle
npm install @capacitor/app
```

### WebRTC on Mobile: Known Issues & Solutions

| Issue | Platform | Solution |
|-------|----------|----------|
| Camera fails silently | iOS | Request permissions explicitly before getUserMedia |
| Audio echo | Both | Enable echo cancellation: `echoCancellation: true` |
| Background disconnection | iOS | Use background modes or warn user |
| Poor quality on cellular | Both | Implement adaptive bitrate |
| H264 codec issues | Android | Force VP8: `preferredCodec: 'VP8'` |

### Alternative: React Native (If Higher Performance Needed)

If games require complex animations or 60fps rendering:

```bash
# Create new React Native project
npx react-native init GameBuddiesMobile --template react-native-template-typescript

# Install WebRTC
npm install react-native-webrtc

# Install Socket.IO
npm install socket.io-client

# Copy over game logic (types, utils, hooks)
# Rewrite UI components using React Native primitives
```

**React Native WebRTC Resources:**
- [react-native-webrtc](https://github.com/react-native-webrtc/react-native-webrtc)
- [React Native WebRTC Guide 2025](https://sweets.chat/blog/article/react-native-webrtc-in-2025-a-practical-guide-to-real-t-9g1WwzsU)

---

## Priority Action Items

### P0 - Critical (Fix Immediately)
- [ ] **Server:** Validate premium tier on server, not client
- [ ] **Server:** Add authentication to WebRTC signaling
- [ ] **Server:** Limit chat message storage per room
- [ ] **Client:** Fix XSS in VideoFilmstrip
- [ ] **Client:** Add try-catch to JSON.parse in SettingsModal

### P1 - High (Fix This Sprint)
- [ ] **Server:** Fix broadcast throttling memory leak
- [ ] **Server:** Fix RoomManager room cleanup bug (wrong keys)
- [ ] **Server:** Add session token verification
- [ ] **Client:** Fix event listener memory leaks
- [ ] **Client:** Fix portal key regeneration in VideoFilmstrip

### P2 - Medium (Fix This Month)
- [ ] **Server:** Implement distributed rate limiting
- [ ] **Server:** Add circuit breaker for external APIs
- [ ] **Server:** Add request/response size limits
- [ ] **Client:** Add chat rate limiting
- [ ] **Client:** Split WebRTCContext into smaller contexts
- [ ] **Both:** Add structured logging, remove console.logs

### P3 - Low (Backlog)
- [ ] **Server:** Auto-discover game plugins
- [ ] **Server:** Add configuration validation
- [ ] **Client:** Add accessibility improvements
- [ ] **Client:** Add Error Boundaries
- [ ] **Both:** Add comprehensive unit tests
- [ ] **Mobile:** Implement Capacitor for Android/iOS

---

## Sources & References

### Mobile Development
- [Capacitor Documentation](https://capacitorjs.com/docs)
- [Capacitor with React](https://capacitorjs.com/solution/react)
- [React Native WebRTC 2025 Guide](https://sweets.chat/blog/article/react-native-webrtc-in-2025-a-practical-guide-to-real-t-9g1WwzsU)
- [Capacitor vs React Native Comparison](https://nextnative.dev/blog/capacitor-vs-react-native)
- [PWA vs React Native](https://artoonsolutions.com/react-native-vs-pwa/)

### WebRTC on Mobile
- [WebRTC Mobile Apps with Ionic](https://apirtc.com/blog/tutorials/building-a-webrtc-mobile-app-with-ionic/)
- [Capacitor Jitsi Meet Plugin](https://github.com/calvinckho/capacitor-jitsi-meet)
- [Ionic Forum: WebRTC with Capacitor](https://forum.ionicframework.com/t/webrtc-based-apps-using-ionic-capacitor/207401)
