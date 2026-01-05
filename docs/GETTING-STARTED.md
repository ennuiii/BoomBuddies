# Getting Started with GameBuddies Template

This template provides everything you need to build a new multiplayer game for the GameBuddies platform. It includes:

- Responsive layout (desktop, tablet, mobile portrait/landscape)
- WebRTC video chat integration
- GameBuddies platform integration (sessions, auto-join, return to lobby)
- Sound system (music + effects)
- i18n support (English + German)
- MobileGameMenu (hamburger) navigation for mobile
- Server plugin template for GameBuddiesGameServer

## Quick Start

### 1. Copy the Template

```bash
# Copy template to a new folder
cp -r GameBuddiesTemplate YourGameName

# Navigate to your game
cd YourGameName/client
```

### 2. Update Game Metadata

Edit `src/config/gameMeta.ts`:

```typescript
export const GAME_META = {
  id: 'your-game-id',           // Unique ID (kebab-case)
  name: 'Your Game Name',       // Display name
  shortName: 'YourGame',        // Short name for logs
  description: 'Your game description',
  version: '1.0.0',
  minPlayers: 2,
  maxPlayers: 8,
  namespace: '/your-game',      // Socket.IO namespace
};
```

### 3. Install Dependencies

```bash
npm install
```

### 4. Start Development Server

```bash
npm run dev
```

The game will be available at `http://localhost:5173`

### 5. Connect to Game Server

Update `.env` with your game server URL:

```env
VITE_GAME_SERVER_URL=https://your-server.onrender.com
```

## Project Structure

```
client/
├── src/
│   ├── adapters/
│   │   └── gameAdapter.ts          # WebcamConfig adapter
│   ├── components/
│   │   ├── core/                   # Shared UI components
│   │   ├── game/                   # Game-specific components
│   │   ├── lobby/                  # Lobby components
│   │   ├── mobile/                 # Mobile-specific components
│   │   └── video/                  # Video chat components
│   ├── contexts/                   # React contexts
│   ├── hooks/                      # Custom hooks
│   ├── pages/                      # Main pages
│   ├── services/                   # Socket, audio, etc.
│   ├── stores/                     # Game state (Zustand)
│   ├── styles/                     # CSS files
│   ├── types/                      # TypeScript types
│   ├── utils/                      # Utilities
│   ├── config/                     # Configuration
│   └── locales/                    # i18n translations
├── public/
│   ├── sounds/                     # Sound effects
│   └── backgrounds/                # Virtual backgrounds
└── package.json

server/
├── plugin.ts                       # Game server plugin
├── types.ts                        # Server-side types
└── README.md                       # Plugin documentation
```

## Key Files to Modify

### For Game Logic

1. **`src/stores/gameStore.ts`** - Game state management
2. **`src/components/game/`** - Game UI components
3. **`src/types/game.ts`** - Game type definitions
4. **`server/plugin.ts`** - Server-side game logic

### For Styling

1. **`src/styles/unified.css`** - Main stylesheet
2. **`src/components/**/*.css`** - Component-specific styles
3. **`tailwind.config.js`** - Tailwind configuration

### For Translations

1. **`src/locales/en.ts`** - English translations
2. **`src/locales/de.ts`** - German translations

## Development Workflow

### 1. Implement Game Logic

Start with the game store (`src/stores/gameStore.ts`):

```typescript
export interface GameState {
  // Your game state
  currentRound: number;
  score: number;
  // ...
}

export const useGameStore = create<GameState>((set, get) => ({
  // Initial state
  currentRound: 0,
  score: 0,

  // Actions
  startRound: () => set({ currentRound: get().currentRound + 1 }),
  updateScore: (points: number) => set({ score: get().score + points }),
}));
```

### 2. Create Game Components

Add components in `src/components/game/`:

```tsx
// src/components/game/GameBoard.tsx
export const GameBoard: React.FC = () => {
  const { currentRound, score } = useGameStore();

  return (
    <div className="game-board">
      <h2>Round {currentRound}</h2>
      <p>Score: {score}</p>
      {/* Your game UI */}
    </div>
  );
};
```

### 3. Handle Socket Events

In your game components or hooks:

```typescript
useEffect(() => {
  const socket = getSocket();
  if (!socket) return;

  socket.on('game:state-update', (data) => {
    // Update game state
  });

  socket.on('game:action-result', (data) => {
    // Handle action result
  });

  return () => {
    socket.off('game:state-update');
    socket.off('game:action-result');
  };
}, []);

// Send action
const handleAction = () => {
  socket.emit('game:action', { type: 'move', data: { x: 1, y: 2 } });
};
```

### 4. Implement Server Plugin

Copy `server/` to GameBuddiesGameServer and implement handlers:

```typescript
socketHandlers: Record<string, SocketEventHandler> = {
  'game:action': async (socket, data, room, helpers) => {
    // Validate and process action
    // Update game state
    // Broadcast to players
    this.broadcastRoomState(room);
  }
};
```

## Responsive Design

The template uses mobile-first responsive design:

| Breakpoint | Width | Layout |
|------------|-------|--------|
| Mobile | < 768px | Single column, hamburger menu |
| Tablet | 768-1023px | Single column, larger elements |
| Desktop | >= 1024px | Two-column with sidebar |

### Mobile Navigation

Mobile uses `MobileGameMenu` (hamburger) instead of BottomTabBar:

```tsx
// MobileGameMenu opens a portal overlay with:
// - Room code + copy invite
// - Chat (with unread badge)
// - Players (with count)
// - Video toggle
// - Sound settings
// - Leave room
```

### CSS Classes

```css
/* Mobile-only */
@media (max-width: 767px) { }

/* Tablet+ */
@media (min-width: 768px) { }

/* Desktop+ */
@media (min-width: 1024px) { }
```

## GameBuddies Integration

### Auto-Join from Platform

Players coming from GameBuddies.io will have URL parameters:

```typescript
const params = new URLSearchParams(window.location.search);
{
  roomCode: params.get('room'),
  playerName: params.get('name'),
  playerId: params.get('playerId'),
  isHost: params.get('role') === 'gm',
  isStreamerMode: params.has('streamer'),
  premiumTier: params.get('tier'),
  avatarUrl: params.get('avatar'),
}
```

The `useGameBuddiesClient` hook handles this automatically.

### Return to Platform

```typescript
import { returnToGameBuddies } from '../services/gameBuddiesReturn';

// When player clicks "Return to GameBuddies"
await returnToGameBuddies(roomCode, playerId);
// Socket emits 'gamebuddies:return'
// Server responds with redirect URL
// Client navigates to GameBuddies lobby
```

## Testing

### Local Development

1. Start the game client: `npm run dev`
2. Start the game server (see server README)
3. Open multiple browser tabs to test multiplayer

### Testing Checklist

- [ ] Create room works
- [ ] Join room works
- [ ] WebRTC video chat works
- [ ] Chat messages work
- [ ] Mobile layout works (use Chrome DevTools)
- [ ] Game-specific logic works
- [ ] Reconnection works
- [ ] Settings persist

## Deployment

### Client (Render.com Static Site)

1. Build: `npm run build`
2. Deploy `dist/` folder
3. Set environment variables

### Server (Render.com Web Service)

1. Copy `server/` to GameBuddiesGameServer
2. Register plugin in `index.ts`
3. Deploy server

See `DEPLOYMENT-CHECKLIST.md` for full deployment steps.

## Next Steps

1. Read `GAME-INTEGRATION.md` for detailed game logic implementation
2. Read `WEBCAM-CONFIG.md` for WebRTC configuration
3. Check the existing games (ClueScale, BingoBuddies, ThinkAlike) for examples
