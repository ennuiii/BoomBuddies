# WebRTC Video Chat Configuration

This guide explains how to configure and customize the WebRTC video chat integration in your GameBuddies game.

## Overview

The video chat system uses WebRTC for peer-to-peer video connections with a Socket.IO signaling server. It supports:

- Video/audio streaming between players
- Virtual backgrounds (blur, images, custom)
- Face avatars (cartoon representations)
- Noise suppression
- Multiple layout modes (grid, speaker, spotlight)
- Mobile-optimized UI

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                       WebRTC Context                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │ Local Stream │  │ Peer         │  │ Virtual Background   │  │
│  │ (camera/mic) │  │ Connections  │  │ Service              │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
│                           ▲                                      │
│                           │ Signaling (Socket.IO)               │
│                           ▼                                      │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    Game Server                            │   │
│  │  webrtc:join, webrtc:offer, webrtc:answer, webrtc:ice   │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

## The GameAdapter Pattern

The WebRTC system uses an adapter to get game-specific information. Edit `src/adapters/gameAdapter.ts`:

```typescript
import type { WebcamConfig } from '../config/WebcamConfig';

/**
 * Creates a game adapter for WebRTC integration.
 * This provides the WebRTC system with game-specific data.
 */
export function createGameAdapter(
  socket: Socket | null,
  roomCode: string,
  lobby: LobbyState | null
): WebcamConfig {
  return {
    // Socket connection
    getSocket: () => socket,

    // Room identification
    getRoomCode: () => roomCode,

    // Current user's socket ID
    getUserId: () => lobby?.mySocketId || null,

    // Language for UI
    getLanguage: () => 'en',

    // User's role (affects video priority)
    getUserRole: () => {
      const myPlayer = lobby?.players.find(p => p.socketId === lobby.mySocketId);
      return myPlayer?.isHost ? 'gamemaster' : 'player';
    },

    // All players in the room (for participant list)
    getPlayers: () => {
      if (!lobby) return [];

      return lobby.players.map(p => ({
        odId: p.socketId,           // Unique ID
        odName: p.name,             // Display name
        odAvatar: p.avatarUrl,      // Avatar URL
        odIsHost: p.isHost,         // Is game master
        odPremiumTier: p.premiumTier,
      }));
    },

    // Premium tier affects available features
    getPremiumTier: () => {
      const myPlayer = lobby?.players.find(p => p.socketId === lobby.mySocketId);
      return myPlayer?.premiumTier || 'free';
    },
  };
}
```

## Using the GameAdapter

In your main App or page component:

```tsx
import { createGameAdapter } from '../adapters/gameAdapter';
import { WebRTCProvider } from '../contexts/WebRTCContext';
import { WebcamConfig } from '../config/WebcamConfig';

const GamePage: React.FC = () => {
  const { socket, roomCode, lobby } = useGameBuddiesClient();

  // Create adapter
  const gameAdapter = useMemo(() => {
    return createGameAdapter(socket, roomCode, lobby);
  }, [socket, roomCode, lobby]);

  return (
    <WebRTCProvider config={gameAdapter}>
      <VideoFilmstrip />
      <GameContent />
    </WebRTCProvider>
  );
};
```

## Video Components

### VideoFilmstrip

The main video display component showing all participants:

```tsx
import { VideoFilmstrip } from '../components/video/VideoFilmstrip';

// Basic usage (bottom of screen, collapsible)
<VideoFilmstrip />

// In a sidebar layout
<div className="sidebar">
  <PlayerList />
  <VideoFilmstrip position="sidebar" />
</div>
```

### VideoControlCluster

Controls for camera, mic, and settings:

```tsx
import { VideoControlCluster } from '../components/video/VideoControlCluster';

<VideoControlCluster
  onOpenSettings={() => setShowSettings(true)}
  onToggleExpand={() => setExpanded(!expanded)}
  isExpanded={expanded}
/>
```

### WebcamDisplay

Individual video feed display:

```tsx
import { WebcamDisplay } from '../components/video/WebcamDisplay';

<WebcamDisplay
  peerId={player.socketId}
  playerName={player.name}
  isLocal={player.socketId === mySocketId}
  isMuted={mutedPeers.has(player.socketId)}
  showControls={true}
/>
```

### MobileVideoGrid

Full-screen video grid for mobile:

```tsx
import { MobileVideoGrid } from '../components/video/MobileVideoGrid';

// Opens as an overlay/drawer on mobile
{showVideoGrid && (
  <MobileVideoGrid
    onClose={() => setShowVideoGrid(false)}
  />
)}
```

## Context APIs

### WebRTCContext

Access video/audio state and controls:

```tsx
import { useWebRTC } from '../contexts/WebRTCContext';

const MyComponent = () => {
  const {
    // State
    localStream,           // MediaStream | null
    peers,                 // Map<string, RTCPeerConnection>
    remoteStreams,         // Map<string, MediaStream>
    isVideoEnabled,        // boolean
    isAudioEnabled,        // boolean
    isSharingScreen,       // boolean

    // Controls
    toggleVideo,           // () => void
    toggleAudio,           // () => void
    startScreenShare,      // () => Promise<void>
    stopScreenShare,       // () => void

    // Virtual background
    setVirtualBackground,  // (type: string, url?: string) => void
    backgroundType,        // 'none' | 'blur' | 'image'
  } = useWebRTC();

  return (
    <button onClick={toggleVideo}>
      {isVideoEnabled ? 'Turn Off Camera' : 'Turn On Camera'}
    </button>
  );
};
```

### VideoUIContext

Access video UI state:

```tsx
import { useVideoUI } from '../contexts/VideoUIContext';

const MyComponent = () => {
  const {
    isFilmstripExpanded,
    setFilmstripExpanded,
    isPopupOpen,
    setPopupOpen,
    layoutMode,            // 'grid' | 'speaker' | 'spotlight'
    setLayoutMode,
    activeSpeaker,         // string | null (socket ID)
    spotlightPeer,         // string | null
    setSpotlightPeer,
  } = useVideoUI();

  return (
    <button onClick={() => setFilmstripExpanded(!isFilmstripExpanded)}>
      {isFilmstripExpanded ? 'Collapse' : 'Expand'}
    </button>
  );
};
```

## Virtual Backgrounds

### Setup

The virtual background service uses MediaPipe for segmentation:

```tsx
import { VirtualBackgroundService } from '../services/virtualBackgroundService';

// Initialize (called once on app start)
await VirtualBackgroundService.initialize();
```

### Using Virtual Backgrounds

```tsx
const { setVirtualBackground, backgroundType } = useWebRTC();

// Blur background
setVirtualBackground('blur');

// Image background
setVirtualBackground('image', '/backgrounds/beach.jpg');

// Remove background effect
setVirtualBackground('none');
```

### Custom Backgrounds

Add custom backgrounds in `public/backgrounds/`:

```
public/
└── backgrounds/
    ├── beach.jpg
    ├── office.jpg
    ├── space.jpg
    └── custom/
        └── user-uploaded.jpg
```

## Face Avatars

Replace video with cartoon avatar representation:

```tsx
import { FaceAvatarService } from '../services/faceAvatarService';

// Enable face avatar
const { enableFaceAvatar, disableFaceAvatar, isFaceAvatarEnabled } = useWebRTC();

enableFaceAvatar('cartoon'); // or 'anime', 'minimal'

// The video stream will be replaced with rendered avatar
```

## Noise Suppression

Audio processing for cleaner voice:

```tsx
import { AudioProcessor } from '../services/audioProcessor';

// Enable noise suppression
const { enableNoiseSuppression, disableNoiseSuppression, isNoiseSuppressionEnabled } = useWebRTC();

enableNoiseSuppression();
```

## Mobile Considerations

### Portrait Mode

On mobile portrait, the filmstrip shows at the bottom with collapsed view:

```css
@media (max-width: 767px) {
  .video-filmstrip {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    height: 80px; /* Collapsed */
  }

  .video-filmstrip.expanded {
    height: 200px;
  }
}
```

### Landscape Mode

On mobile landscape, video takes more space:

```css
@media (max-width: 767px) and (orientation: landscape) {
  .video-filmstrip {
    position: fixed;
    right: 0;
    top: 0;
    bottom: 0;
    width: 200px;
    height: 100%;
  }
}
```

### MobileGameMenu Integration

Video controls are accessible via the hamburger menu:

```tsx
<MobileGameMenu
  // ... other props
  isVideoEnabled={isVideoEnabled}
  onVideo={() => setShowMobileVideoGrid(true)}
/>
```

## Keyboard Shortcuts

The `useVideoKeyboardShortcuts` hook provides keyboard controls:

| Key | Action |
|-----|--------|
| `V` | Toggle video |
| `M` | Toggle microphone |
| `C` | Toggle camera |
| `P` | Toggle popup/fullscreen video |

```tsx
import { useVideoKeyboardShortcuts } from '../hooks/useVideoKeyboardShortcuts';

// In your component
useVideoKeyboardShortcuts({
  enabled: true, // Enable shortcuts
  onToggleVideo: toggleVideo,
  onToggleMic: toggleAudio,
  onTogglePopup: () => setPopupOpen(!isPopupOpen),
});
```

## Premium Features

Some features are restricted by premium tier:

| Feature | Free | Monthly | Lifetime |
|---------|------|---------|----------|
| Basic video | ✓ | ✓ | ✓ |
| Blur background | ✓ | ✓ | ✓ |
| Image backgrounds | ✗ | ✓ | ✓ |
| Custom backgrounds | ✗ | ✗ | ✓ |
| Face avatars | ✗ | ✓ | ✓ |
| Noise suppression | ✓ | ✓ | ✓ |
| HD video | ✗ | ✓ | ✓ |

```tsx
const { getPremiumTier } = useWebRTC();
const tier = getPremiumTier(); // 'free' | 'monthly' | 'lifetime'

// Check feature availability
const canUseImageBackgrounds = tier !== 'free';
const canUseCustomBackgrounds = tier === 'lifetime';
```

## Troubleshooting

### Camera Not Working

1. Check browser permissions
2. Ensure HTTPS (required for getUserMedia)
3. Check if another app is using the camera
4. Try a different browser

### No Video from Peers

1. Check WebRTC signaling in Network tab
2. Verify ICE candidates are being exchanged
3. Check firewall settings (STUN/TURN may be needed)
4. Verify socket connection is established

### Poor Video Quality

1. Check network bandwidth
2. Consider reducing video resolution
3. Enable noise suppression for audio
4. Use virtual background to reduce complexity

### Debugging

Enable verbose WebRTC logging:

```typescript
// In WebRTCContext.tsx
const DEBUG = true;

if (DEBUG) {
  console.log('[WebRTC] Peer connection state:', pc.connectionState);
  console.log('[WebRTC] ICE connection state:', pc.iceConnectionState);
  console.log('[WebRTC] Signaling state:', pc.signalingState);
}
```

## Server Requirements

The game server must handle these WebRTC signaling events:

```typescript
// Core WebRTC events (handled by GameBuddiesGameServer core)
'webrtc:join'     // Player joins video chat
'webrtc:leave'    // Player leaves video chat
'webrtc:offer'    // SDP offer
'webrtc:answer'   // SDP answer
'webrtc:ice'      // ICE candidate
```

These are already implemented in the core server - no game-specific handling needed.

## Next Steps

- Check the video components in `src/components/video/`
- See `GETTING-STARTED.md` for setup instructions
- See `GAME-INTEGRATION.md` for game logic implementation
