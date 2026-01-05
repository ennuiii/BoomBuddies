# Game Server Plugin

This folder contains the server-side game plugin for the GameBuddies Unified Game Server.

## Files

- `plugin.ts` - Main game plugin implementing the `GamePlugin` interface
- `types.ts` - Game-specific type definitions (state, player data, settings)

## Installation

1. Copy this entire folder to `GameBuddieGamesServer/games/your-game-name/`

2. Update the plugin metadata in `plugin.ts`:
   ```typescript
   id = 'your-game-id';           // Unique identifier (kebab-case)
   name = 'Your Game Name';       // Display name
   namespace = '/your-game';      // Socket.IO namespace
   basePath = '/your-game';       // URL path prefix
   ```

3. Register the plugin in `GameBuddieGamesServer/index.ts`:
   ```typescript
   import yourGamePlugin from './games/your-game-name/plugin.js';

   // Add to plugins array
   const plugins = [
     // ... other plugins
     yourGamePlugin,
   ];
   ```

4. Build and restart the server:
   ```bash
   npm run build
   npm start
   ```

## Plugin Architecture

### Lifecycle Hooks

The plugin receives lifecycle events from the core server:

| Hook | When Called |
|------|-------------|
| `onInitialize(io)` | Server starts, plugin registered |
| `onRoomCreate(room)` | New room created |
| `onPlayerJoin(room, player, isReconnecting)` | Player joins or reconnects |
| `onPlayerDisconnected(room, player)` | Player socket disconnects |
| `onPlayerLeave(room, player)` | Player removed after timeout |
| `onRoomDestroy(room)` | Room is being deleted |

### Socket Event Handlers

Register your game-specific socket events in `socketHandlers`:

```typescript
socketHandlers: Record<string, SocketEventHandler> = {
  'game:your-event': async (socket, data, room, helpers) => {
    // Handle the event
  }
}
```

### Serialization

The `serializeRoom()` method converts server state to client format:

```typescript
serializeRoom(room: Room, socketId: string): any {
  // Return client-safe room data
  // IMPORTANT: Don't expose other players' secret data (cards, answers, etc.)
}
```

## Game State Management

### Server State (`room.gameState.data`)

```typescript
interface GameState {
  phase: GamePhase;
  currentRound: number;
  score: number;
  livesRemaining: number;
  // ... your game data
}
```

### Player Data (`player.gameData`)

```typescript
interface PlayerData {
  isReady: boolean;
  isSpectator: boolean;
  // ... your player data
}
```

### Settings (`room.settings.gameSpecific`)

```typescript
interface GameSettings {
  timerDuration: number;
  maxLives: number;
  // ... your settings
}
```

## Common Patterns

### Broadcasting State

```typescript
// Broadcast to all players (each gets personalized view)
this.broadcastRoomState(room);

// Send to specific socket
this.io.of(this.namespace).to(socketId).emit('event', data);

// Send to entire room
helpers.sendToRoom(roomCode, 'event', data);
```

### Timer Management

```typescript
// Start a timer
const timeout = setTimeout(() => { ... }, 3000);
this.timers.set(`${room.code}:my-timer`, timeout);

// Clear a timer
this.clearTimer(`${room.code}:my-timer`);

// Clear all room timers (on room destroy)
this.clearRoomTimers(room.code);
```

### GameBuddies Rewards

```typescript
// Grant rewards at game end
const reward = await gameBuddiesService.grantReward(this.id, player.userId, {
  won: true,
  durationSeconds: 300,
  score: 100,
  metadata: { rounds: 5 }
});

if (reward) {
  namespace.to(player.socketId).emit('player:reward', reward);
}
```

## Testing

1. Start the unified game server
2. Connect your game client to the correct namespace
3. Use browser dev tools to monitor socket events
4. Check server logs for `[YourGame]` prefixed messages
