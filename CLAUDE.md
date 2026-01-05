# CLAUDE.md - GameBuddies Template

This file provides guidance for AI assistants working with the GameBuddies Template codebase.

## Project Overview

GameBuddies Template is a full-stack multiplayer game development framework consisting of:
- **Client**: React 19 + TypeScript + Vite frontend with WebRTC video chat
- **Server**: Node.js + Express + Socket.IO unified game server with plugin architecture

The template enables rapid development of multiplayer browser games that integrate with the GameBuddies.io platform.

## Repository Structure

```
GameBuddiesTemplate/
├── client/                     # React frontend application
│   ├── src/
│   │   ├── adapters/           # External service adapters
│   │   ├── components/
│   │   │   ├── core/           # Shared UI components
│   │   │   ├── game/           # Game-specific components
│   │   │   ├── lobby/          # Lobby/waiting room components
│   │   │   ├── mobile/         # Mobile-specific components
│   │   │   └── video/          # WebRTC video components
│   │   ├── config/             # Game metadata & configuration
│   │   ├── contexts/           # React contexts (Theme, WebRTC, VideoUI)
│   │   ├── hooks/              # Custom React hooks
│   │   ├── locales/            # i18n translations (en, de)
│   │   ├── pages/              # Page components (Home, Lobby, Game)
│   │   ├── services/           # Socket, audio, video services
│   │   ├── styles/             # CSS files
│   │   ├── types/              # TypeScript type definitions
│   │   └── utils/              # Utility functions
│   ├── public/                 # Static assets (sounds, backgrounds)
│   └── package.json
├── GameBuddieGamesServer/      # Unified game server
│   ├── core/
│   │   ├── server.ts           # Main server entry point
│   │   ├── managers/           # RoomManager, SessionManager, GameRegistry
│   │   ├── services/           # GameBuddies, Validation, Friend services
│   │   └── types/core.ts       # Core TypeScript interfaces
│   ├── games/                  # Game plugins
│   │   ├── GAME-PLUGIN-TEMPLATE.ts  # Template for new games
│   │   ├── template/           # Simple template game
│   │   ├── bingo/              # BingoBuddies
│   │   ├── clue/               # ClueScale
│   │   ├── ddf/                # Drink Drank Drunk
│   │   ├── thinkalike/         # ThinkAlike
│   │   └── ...                 # Other games
│   ├── tests/                  # Playwright tests
│   └── package.json
├── docs/                       # Project documentation
├── server/                     # Template server plugin code
└── run-dev.ps1                 # Windows development runner
```

## Quick Start Commands

### Client Development
```bash
cd client
npm install
npm run dev          # Start dev server at http://localhost:5173
npm run build        # Production build
npm run lint         # ESLint check
```

### Server Development
```bash
cd GameBuddieGamesServer
npm install
npm run dev          # Start server at http://localhost:3001
npm run build        # TypeScript compilation
npm run test         # Run Playwright tests
npm run type-check   # TypeScript type checking
```

### Running Both Together (Windows)
```powershell
.\run-dev.ps1
```

## Architecture & Key Concepts

### Socket.IO Namespaces
Each game runs in its own Socket.IO namespace for isolation:
- `/template` - Template game
- `/bingo` - BingoBuddies
- `/clue` - ClueScale
- etc.

The client connects to the namespace specified in `gameMeta.ts`:
```typescript
// client/src/config/gameMeta.ts
export const GAME_META = {
  namespace: '/template',  // Must match server plugin
  // ...
};
```

### Game Plugin Structure
Every game implements the `GamePlugin` interface from `core/types/core.ts`:

```typescript
interface GamePlugin {
  id: string;                    // Unique identifier
  name: string;                  // Display name
  namespace: string;             // Socket.IO namespace
  defaultSettings: RoomSettings;

  // Lifecycle hooks
  onInitialize?(io: SocketIOServer): Promise<void>;
  onRoomCreate?(room: Room): void;
  onPlayerJoin?(room: Room, player: Player, isReconnecting?: boolean): void;
  onPlayerDisconnected?(room: Room, player: Player): void;
  onPlayerLeave?(room: Room, player: Player): void;
  onRoomDestroy?(room: Room): void;

  // CRITICAL: Serializes server Room to client format
  serializeRoom(room: Room, socketId: string): any;

  // Game-specific event handlers
  socketHandlers: Record<string, SocketEventHandler>;
}
```

### Room & Player State
- `Room.players` is a `Map<string, Player>` on the server
- Always convert to Array for client: `Array.from(room.players.values())`
- Server is the source of truth - clients receive state via `roomStateUpdated` events

### Client State Flow
```
App.tsx
├── HomePage (no lobby)
├── LobbyPage (lobby.state === 'lobby')
└── GamePage (lobby.state === 'playing' | 'ended')
```

## Key Files Reference

### Client
| File | Purpose |
|------|---------|
| `src/App.tsx` | Main app component, routing, socket handlers |
| `src/config/gameMeta.ts` | Game metadata (name, namespace, player limits) |
| `src/services/socketService.ts` | Socket.IO connection management |
| `src/services/gameBuddiesSession.ts` | Platform session handling |
| `src/contexts/WebRTCContext.tsx` | WebRTC video chat state |
| `src/hooks/useGameBuddiesClient.ts` | Platform auto-join hook |
| `src/types/index.ts` | TypeScript type definitions |

### Server
| File | Purpose |
|------|---------|
| `core/server.ts` | Main server, Socket.IO setup, common events |
| `core/types/core.ts` | Core interfaces (Room, Player, GamePlugin) |
| `core/managers/RoomManager.ts` | Room creation, player management |
| `core/managers/SessionManager.ts` | Session token handling |
| `games/GAME-PLUGIN-TEMPLATE.ts` | Complete game plugin template |

## Common Socket Events

### Core Events (handled by server)
- `room:create` - Create a new room
- `room:join` - Join existing room
- `room:leave` - Leave current room
- `chat:message` - Send chat message
- `session:reconnect` - Reconnect with session token

### WebRTC Events
- `webrtc:enable-video` - Notify peers of video enabled
- `webrtc:offer/answer/ice-candidate` - Signaling events

### Game Events (per plugin)
- `game:start` - Start the game (host only)
- `game:action` - Generic game action
- `game:end` - End the game
- `game:restart` - Reset to lobby

### State Updates
- `roomStateUpdated` - Full state broadcast to all players
- `player:joined` / `player:left` - Player membership changes
- `player:disconnected` / `player:reconnected` - Connection status

## Development Patterns

### Adding Game Logic
1. Define state interfaces in server plugin
2. Initialize state in `onRoomCreate`
3. Add event handlers in `socketHandlers`
4. Call `broadcastRoomState()` after state changes
5. Update client components to handle new state

### State Serialization
The `serializeRoom` function MUST:
- Convert `Map` to `Array` for players
- Include `mySocketId` for client self-identification
- Hide private data from other players when needed
- Map internal phase names to client-expected state strings

### Timer/Interval Cleanup
Always clean up timers in `onRoomDestroy`:
```typescript
private timers = new Map<string, NodeJS.Timeout>();

onRoomDestroy(room: Room): void {
  this.timers.forEach((timer, key) => {
    if (key.startsWith(room.code)) {
      clearTimeout(timer);
      this.timers.delete(key);
    }
  });
}
```

## Testing

### Server Tests (Playwright)
```bash
cd GameBuddieGamesServer
npm run test              # Run all tests
npm run test:headed       # Run with browser visible
npm run test:ui           # Interactive test UI
```

### Manual Testing
1. Open multiple browser tabs
2. Create room in one tab (host)
3. Join room in other tabs
4. Test game flow, disconnection, reconnection

## Code Style & Conventions

### TypeScript
- Strict mode enabled
- Use interfaces for data structures
- Use `type` for unions/intersections
- Avoid `any` when possible - use proper types

### React
- Functional components with hooks
- Contexts for global state (Theme, WebRTC)
- Zustand for game state when needed
- CSS modules or plain CSS (no CSS-in-JS)

### Socket Events
- Use `snake:case` naming: `game:start`, `player:ready`
- Always validate inputs on server
- Rate limit sensitive operations
- Include error handling in handlers

### CSS
- Mobile-first responsive design
- Breakpoints: 768px (tablet), 1024px (desktop)
- CSS custom properties for theming
- Tailwind utilities available

## Environment Variables

### Client (.env)
```env
VITE_GAME_SERVER_URL=http://localhost:3001   # Dev server URL
VITE_GAME_SERVER_URL=https://your-prod.com   # Production URL
```

### Server (.env)
```env
PORT=3001
CORS_ORIGINS=http://localhost:5173,https://gamebuddies.io
GAMEBUDDIES_API_URL=https://api.gamebuddies.io
GAMEBUDDIES_API_KEY=your-api-key
```

## Common Tasks

### Creating a New Game
1. Copy `games/GAME-PLUGIN-TEMPLATE.ts` to `games/your-game/plugin.ts`
2. Update metadata (id, name, namespace)
3. Define game state and player data interfaces
4. Implement lifecycle hooks and socket handlers
5. Register in `core/server.ts`
6. Update client to connect to new namespace

### Adding a Socket Event
Server:
```typescript
socketHandlers = {
  'game:my-action': async (socket, data, room, helpers) => {
    // Validate player
    const player = Array.from(room.players.values())
      .find(p => p.socketId === socket.id);
    if (!player) return;

    // Update state
    // ...

    // Broadcast
    this.broadcastRoomState(room);
  }
};
```

Client:
```typescript
socket.on('game:my-action-result', (data) => {
  // Handle response
});

socket.emit('game:my-action', { /* data */ });
```

### Handling Reconnection
- Session tokens stored in localStorage
- `session:reconnect` event restores player state
- `onPlayerJoin` receives `isReconnecting: true`
- Update socket mappings and broadcast state

## Troubleshooting

### "Not in a room" error
- Socket may have reconnected with new ID
- Check `playerRoomMap` in RoomManager
- Ensure room code is passed in event data as fallback

### Players array undefined on client
- `serializeRoom` must convert Map to Array
- Check plugin's serialization logic

### WebRTC not connecting
- Verify STUN/TURN server configuration
- Check browser permissions for camera/mic
- Review `webrtc:*` event flow in console

### State not updating
- Call `broadcastRoomState()` after changes
- Verify serialization includes updated fields
- Check client event listener is registered

## Performance Considerations

- Broadcasts are throttled to 10/sec per room
- Use `perMessageDeflate: false` for WebSocket
- Ping timeout set to 5 minutes for backgrounded tabs
- Maximum 10,000 concurrent connections enforced

## Deployment

### Client (Static Site)
- Build: `npm run build`
- Deploy `dist/` to Render, Vercel, or Netlify

### Server (Web Service)
- Build: `npm run build`
- Start: `npm start`
- Deploy to Render with `render.yaml` config

## Documentation References

- `docs/GETTING-STARTED.md` - Quick start guide
- `docs/GAME-INTEGRATION.md` - Platform integration details
- `docs/WEBCAM-CONFIG.md` - WebRTC configuration
- `GameBuddieGamesServer/docs/CREATE-NEW-GAME-GUIDE.md` - Game creation guide
