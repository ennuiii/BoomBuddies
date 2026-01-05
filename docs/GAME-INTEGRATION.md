# Game Integration Guide

This guide explains how to implement game-specific logic in your GameBuddies game.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         Client                                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │  Game Store  │  │   Socket     │  │  Game Components     │  │
│  │  (Zustand)   │←→│   Service    │←→│  (React)             │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
└────────────────────────────┬────────────────────────────────────┘
                             │ Socket.IO
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                         Server                                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │  Game Plugin │  │   Room       │  │  GameBuddies         │  │
│  │  (plugin.ts) │  │   Manager    │  │  Service             │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## Client-Side Implementation

### 1. Game Store (Zustand)

The game store manages all game state on the client. Edit `src/stores/gameStore.ts`:

```typescript
import { create } from 'zustand';

// Define your game state
interface GameState {
  // Phase tracking
  phase: 'lobby' | 'playing' | 'round_end' | 'game_over' | 'victory';

  // Game data
  currentRound: number;
  score: number;
  livesRemaining: number;
  timeRemaining: number;

  // Your game-specific state
  currentQuestion: Question | null;
  playerAnswers: Map<string, string>;

  // Actions
  setPhase: (phase: GameState['phase']) => void;
  setGameData: (data: Partial<GameState>) => void;
  submitAnswer: (answer: string) => void;
  resetGame: () => void;
}

export const useGameStore = create<GameState>((set, get) => ({
  // Initial state
  phase: 'lobby',
  currentRound: 0,
  score: 0,
  livesRemaining: 3,
  timeRemaining: 60,
  currentQuestion: null,
  playerAnswers: new Map(),

  // Actions
  setPhase: (phase) => set({ phase }),

  setGameData: (data) => set((state) => ({ ...state, ...data })),

  submitAnswer: (answer) => {
    const socket = getSocket();
    if (socket) {
      socket.emit('game:submit-answer', { answer });
    }
  },

  resetGame: () => set({
    phase: 'lobby',
    currentRound: 0,
    score: 0,
    livesRemaining: 3,
    currentQuestion: null,
    playerAnswers: new Map(),
  }),
}));
```

### 2. Socket Event Handling

Create a hook to handle game-specific socket events:

```typescript
// src/hooks/useGameEvents.ts
import { useEffect } from 'react';
import { useGameStore } from '../stores/gameStore';
import { getSocket } from '../services/socketService';

export const useGameEvents = () => {
  const { setPhase, setGameData } = useGameStore();

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    // Room state updates (from broadcastRoomState)
    socket.on('roomStateUpdated', (data) => {
      // Map server state to client state
      setPhase(mapServerPhase(data.state));
      setGameData({
        currentRound: data.gameData.currentRound,
        score: data.gameData.score,
        livesRemaining: data.gameData.livesRemaining,
        timeRemaining: data.gameData.timeRemaining,
      });
    });

    // Game-specific events
    socket.on('game:question', (data) => {
      setGameData({ currentQuestion: data.question });
    });

    socket.on('game:answer-result', (data) => {
      if (data.correct) {
        setGameData({ score: data.newScore });
      } else {
        setGameData({ livesRemaining: data.livesRemaining });
      }
    });

    socket.on('timer:update', (data) => {
      setGameData({ timeRemaining: data.timeRemaining });
    });

    socket.on('game:ended', (data) => {
      setPhase(data.reason === 'victory' ? 'victory' : 'game_over');
    });

    return () => {
      socket.off('roomStateUpdated');
      socket.off('game:question');
      socket.off('game:answer-result');
      socket.off('timer:update');
      socket.off('game:ended');
    };
  }, [setPhase, setGameData]);
};

// Helper to map server phase strings to client phases
function mapServerPhase(serverPhase: string): GameState['phase'] {
  switch (serverPhase) {
    case 'LOBBY_WAITING': return 'lobby';
    case 'PLAYING': return 'playing';
    case 'ROUND_END': return 'round_end';
    case 'VICTORY': return 'victory';
    case 'GAME_OVER': return 'game_over';
    default: return 'lobby';
  }
}
```

### 3. Game Components

Create your game UI components in `src/components/game/`:

```tsx
// src/components/game/GameBoard.tsx
import React from 'react';
import { useGameStore } from '../../stores/gameStore';
import { useGameEvents } from '../../hooks/useGameEvents';

export const GameBoard: React.FC = () => {
  // Subscribe to game events
  useGameEvents();

  const { phase, currentRound, score, livesRemaining, currentQuestion } = useGameStore();

  // Render based on phase
  switch (phase) {
    case 'lobby':
      return <LobbyView />;
    case 'playing':
      return (
        <div className="game-board">
          <GameHeader round={currentRound} score={score} lives={livesRemaining} />
          {currentQuestion && <QuestionDisplay question={currentQuestion} />}
          <AnswerInput />
        </div>
      );
    case 'round_end':
      return <RoundResultView />;
    case 'victory':
      return <VictoryScreen />;
    case 'game_over':
      return <GameOverScreen />;
    default:
      return null;
  }
};

// Sub-components
const QuestionDisplay: React.FC<{ question: Question }> = ({ question }) => (
  <div className="question-card">
    <h2>{question.text}</h2>
    {question.options.map((opt, i) => (
      <button key={i} onClick={() => submitAnswer(opt)}>
        {opt}
      </button>
    ))}
  </div>
);
```

### 4. Sending Actions to Server

```typescript
// In your component or hook
import { getSocket } from '../services/socketService';

// Send a game action
const submitAnswer = (answer: string) => {
  const socket = getSocket();
  if (!socket) return;

  socket.emit('game:submit-answer', { answer });
};

// Start the game (host only)
const startGame = () => {
  const socket = getSocket();
  if (!socket) return;

  socket.emit('game:start', {});
};

// Update settings (host only)
const updateSettings = (settings: Partial<GameSettings>) => {
  const socket = getSocket();
  if (!socket) return;

  socket.emit('settings:update', { settings });
};
```

## Server-Side Implementation

### 1. Define Types (server/types.ts)

```typescript
// Game phases
export type GamePhase = 'lobby' | 'round_prep' | 'playing' | 'round_end' | 'victory' | 'game_over';

// Full game state
export interface GameState {
  phase: GamePhase;
  currentRound: number;
  score: number;
  livesRemaining: number;
  maxLives: number;
  timeRemaining: number;
  currentQuestion: Question | null;
  playerAnswers: Map<string, string>;
  settings: GameSettings;
}

// Per-player data
export interface PlayerData {
  isReady: boolean;
  isSpectator: boolean;
  hasAnswered: boolean;
  currentAnswer: string | null;
}

// Settings
export interface GameSettings {
  timerDuration: number;
  difficulty: 'easy' | 'medium' | 'hard';
}
```

### 2. Implement Socket Handlers (server/plugin.ts)

```typescript
socketHandlers: Record<string, SocketEventHandler> = {
  // Player submits an answer
  'game:submit-answer': async (socket, data, room, helpers) => {
    const player = Array.from(room.players.values()).find(p => p.socketId === socket.id);
    if (!player) return;

    const gameState = room.gameState.data as GameState;

    // Validate phase
    if (gameState.phase !== 'playing') {
      socket.emit('error', { message: 'Not in playing phase' });
      return;
    }

    // Validate answer
    const { answer } = data;
    if (!answer || typeof answer !== 'string') {
      socket.emit('error', { message: 'Invalid answer' });
      return;
    }

    // Store player's answer
    const playerData = player.gameData as PlayerData;
    playerData.hasAnswered = true;
    playerData.currentAnswer = answer;
    gameState.playerAnswers.set(player.id, answer);

    // Check if answer is correct
    const isCorrect = answer === gameState.currentQuestion?.correctAnswer;

    if (isCorrect) {
      gameState.score += 10;
      socket.emit('game:answer-result', { correct: true, newScore: gameState.score });
    } else {
      gameState.livesRemaining--;
      socket.emit('game:answer-result', {
        correct: false,
        livesRemaining: gameState.livesRemaining,
        correctAnswer: gameState.currentQuestion?.correctAnswer
      });
    }

    // Check win/lose conditions
    if (gameState.score >= 100) {
      this.handleVictory(room);
    } else if (gameState.livesRemaining <= 0) {
      this.endGame(room, 'out-of-lives');
    } else {
      // Move to next question
      this.nextQuestion(room);
    }

    this.broadcastRoomState(room);
  },

  // Host starts the game
  'game:start': async (socket, data, room, helpers) => {
    const player = Array.from(room.players.values()).find(p => p.socketId === socket.id);
    if (!player?.isHost) {
      socket.emit('error', { message: 'Only the host can start' });
      return;
    }

    // Initialize game
    const gameState = room.gameState.data as GameState;
    gameState.phase = 'round_prep';
    gameState.currentRound = 1;
    room.gameState.phase = 'round_prep';

    helpers.sendToRoom(room.code, 'game:started', {});
    this.broadcastRoomState(room);

    // After countdown, start first question
    setTimeout(() => {
      if (room.gameState.phase === 'round_prep') {
        this.startRound(room);
      }
    }, 3500);
  }
};

// Helper methods
private startRound(room: Room): void {
  const gameState = room.gameState.data as GameState;

  // Select a question
  gameState.currentQuestion = this.getRandomQuestion(gameState.settings.difficulty);
  gameState.phase = 'playing';
  room.gameState.phase = 'playing';

  // Reset player answers
  room.players.forEach(p => {
    const pd = p.gameData as PlayerData;
    pd.hasAnswered = false;
    pd.currentAnswer = null;
  });

  // Start timer
  this.startRoundTimer(room);

  this.broadcastRoomState(room);
}

private handleVictory(room: Room): void {
  const gameState = room.gameState.data as GameState;
  gameState.phase = 'victory';
  room.gameState.phase = 'victory';

  this.clearRoomTimers(room.code);
  this.grantVictoryRewards(room);
  this.broadcastRoomState(room);

  if (this.io) {
    this.io.of(this.namespace).to(room.code).emit('game:victory', {
      finalScore: gameState.score,
      rounds: gameState.currentRound
    });
  }
}
```

### 3. State Serialization

The `serializeRoom` method converts server state to client format. **Important**: Don't expose secret data to other players!

```typescript
serializeRoom(room: Room, socketId: string): any {
  const gameState = room.gameState.data as GameState;
  const requestingPlayer = Array.from(room.players.values()).find(p => p.socketId === socketId);

  return {
    code: room.code,
    hostId: room.hostId,

    // Players - filter sensitive data
    players: Array.from(room.players.values()).map(p => {
      const pd = p.gameData as PlayerData;

      return {
        socketId: p.socketId,
        name: p.name,
        isHost: p.isHost,
        connected: p.connected,
        isReady: pd?.isReady || false,
        hasAnswered: pd?.hasAnswered || false,
        // Only show own answer, not others'
        currentAnswer: p.socketId === socketId ? pd?.currentAnswer : null,
      };
    }),

    // Game state
    state: this.mapPhaseToClientState(gameState.phase),
    gameData: {
      currentRound: gameState.currentRound,
      score: gameState.score,
      livesRemaining: gameState.livesRemaining,
      timeRemaining: gameState.timeRemaining,
      // Only show question if in playing phase
      currentQuestion: gameState.phase === 'playing' ? gameState.currentQuestion : null,
    },

    mySocketId: socketId,
    // ... other fields
  };
}
```

## Common Patterns

### Turn-Based Games

```typescript
// Track current player
interface GameState {
  currentPlayerId: string | null;
  turnOrder: string[];
  turnIndex: number;
}

// Advance turn
private nextTurn(room: Room): void {
  const gs = room.gameState.data as GameState;
  gs.turnIndex = (gs.turnIndex + 1) % gs.turnOrder.length;
  gs.currentPlayerId = gs.turnOrder[gs.turnIndex];
  this.broadcastRoomState(room);
}

// Validate it's player's turn
'game:action': async (socket, data, room, helpers) => {
  const player = getPlayer(socket.id);
  const gs = room.gameState.data as GameState;

  if (player.id !== gs.currentPlayerId) {
    socket.emit('error', { message: 'Not your turn' });
    return;
  }
  // Process action...
}
```

### Voting/Polling

```typescript
interface GameState {
  votes: Map<string, string>; // playerId -> vote
  votingDeadline: number;
}

// Collect vote
'game:vote': async (socket, data, room, helpers) => {
  const player = getPlayer(socket.id);
  const gs = room.gameState.data as GameState;

  gs.votes.set(player.id, data.vote);

  // Check if all voted
  const activePlayers = Array.from(room.players.values())
    .filter(p => p.connected && !p.gameData.isSpectator);

  if (gs.votes.size >= activePlayers.length) {
    this.processVotes(room);
  } else {
    this.broadcastRoomState(room);
  }
}
```

### Real-Time Input (Typing, Drawing)

```typescript
// Rate limiting for frequent updates
private lastUpdate = new Map<string, number>();

'game:typing': async (socket, data, room, helpers) => {
  const now = Date.now();
  const lastTime = this.lastUpdate.get(socket.id) || 0;

  // Max 10 updates per second
  if (now - lastTime < 100) return;
  this.lastUpdate.set(socket.id, now);

  // Broadcast to others (not back to sender)
  const namespace = this.io.of(this.namespace);
  socket.to(room.code).emit('game:player-typing', {
    playerId: socket.id,
    text: data.text
  });
}
```

### Spectators

```typescript
// Mark late joiners as spectators
onPlayerJoin(room, player, isReconnecting) {
  const gs = room.gameState.data as GameState;

  if (!isReconnecting && gs.phase !== 'lobby') {
    player.gameData = {
      ...player.gameData,
      isSpectator: true
    };
  }
}

// Filter spectators from game actions
'game:action': async (socket, data, room, helpers) => {
  const player = getPlayer(socket.id);
  if (player.gameData.isSpectator) {
    socket.emit('error', { message: 'Spectators cannot play' });
    return;
  }
  // Process action...
}
```

## Testing Your Integration

1. **Unit test game logic** separately from socket handling
2. **Use console logging** liberally during development
3. **Test with multiple browsers** (or incognito windows)
4. **Test reconnection** by disconnecting and reconnecting
5. **Test edge cases**: timeout, leaving mid-game, spectators joining

```typescript
// Helpful logging pattern
console.log(`[${this.name}] Action from ${player.name}:`, {
  phase: gameState.phase,
  action: data,
  currentState: { score: gameState.score, lives: gameState.livesRemaining }
});
```

## Next Steps

- See `WEBCAM-CONFIG.md` for video chat integration
- See existing games (ClueScale, BingoBuddies) for complete examples
- Check the GameBuddiesGameServer for core server documentation
