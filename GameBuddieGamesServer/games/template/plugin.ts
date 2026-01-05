/**
 * Template Game Plugin for GameBuddies Unified Server
 *
 * A generic starting point for new games.
 *
 * @version 1.0.0
 */

import type {
  GamePlugin,
  Room,
  Player,
  SocketEventHandler,
  GameHelpers,
  RoomSettings
} from '../../core/types/core.js';
import type { Socket } from 'socket.io';
import {
  TemplateGameState,
  TemplatePlayerData,
  TemplateSettings,
  Team,
  createInitialGameState,
  createInitialPlayerData,
  DEFAULT_SETTINGS,
  DEFAULT_TEAMS
} from './types.js';
import { playerReadySchema, gameStartSchema, gameActionSchema, toggleTeamsSchema, switchTeamSchema } from './schemas.js';

class TemplatePlugin implements GamePlugin {
  // Metadata
  id = 'template';
  name = 'Ultimate Game Template';
  version = '1.0.0';
  description = 'A generic template for GameBuddies games';
  author = 'GameBuddies';
  namespace = '/template';
  basePath = '/template';

  // Default Settings
  defaultSettings: RoomSettings = {
    minPlayers: 1,
    maxPlayers: 8,
    gameSpecific: {
      ...DEFAULT_SETTINGS
    } as TemplateSettings
  };

  private io: any;

  // Lifecycle Hooks
  async onInitialize(io: any): Promise<void> {
    this.io = io;
    console.log(`[${this.name}] Plugin initialized`);
  }

  onRoomCreate(room: Room): void {
    console.log(`[${this.name}] Room created: ${room.code}`);
    const settings = room.settings.gameSpecific as TemplateSettings;
    room.gameState.data = createInitialGameState(settings);
    room.gameState.phase = 'lobby';

    // Initialize gameData for any existing players (e.g., host)
    room.players.forEach(player => {
      if (!player.gameData) {
        player.gameData = createInitialPlayerData();
      }
    });
  }

  onPlayerJoin(room: Room, player: Player, isReconnecting?: boolean): void {
    console.log(`[${this.name}] Player ${player.name} ${isReconnecting ? 'reconnected' : 'joined'}`);

    if (!player.gameData) {
      player.gameData = createInitialPlayerData();
    }

    // Auto-assign to team if in teams mode
    const gameState = room.gameState.data as TemplateGameState;
    if (gameState.settings.gameMode === 'teams' && gameState.teams.length > 0) {
      this.autoAssignToTeam(room, player);
    }

    this.broadcastRoomState(room);
  }

  onPlayerLeave(room: Room, player: Player): void {
    console.log(`[${this.name}] Player ${player.name} left`);

    // Remove from team if in teams mode
    const gameState = room.gameState.data as TemplateGameState;
    if (gameState.settings.gameMode === 'teams') {
      this.removeFromTeam(gameState, player.socketId);
    }

    this.broadcastRoomState(room);
  }

  // Serialization
  serializeRoom(room: Room, socketId: string): any {
    const gameState = room.gameState.data as TemplateGameState;

    // Find player's team for serialization
    const findPlayerTeam = (playerId: string): string | undefined => {
      for (const team of gameState.teams) {
        if (team.playerIds.includes(playerId)) {
          return team.id;
        }
      }
      return undefined;
    };

    return {
      code: room.code,
      hostId: room.hostId,
      players: Array.from(room.players.values()).map(p => ({
        socketId: p.socketId,
        name: p.name,
        isHost: p.isHost,
        connected: p.connected,
        isReady: (p.gameData as TemplatePlayerData)?.isReady || false,
        score: (p.gameData as TemplatePlayerData)?.score || 0,
        avatarUrl: p.avatarUrl,
        premiumTier: p.premiumTier,
        team: findPlayerTeam(p.socketId)
      })),
      state: gameState.phase, // 'lobby', 'playing', etc.
      settings: {
        ...room.settings,
        gameMode: gameState.settings.gameMode
      },
      gameData: {
        round: gameState.currentRound,
        teams: gameState.teams,
        ...gameState.customData
      },
      mySocketId: socketId,
      isGameBuddiesRoom: room.isGameBuddiesRoom,
      isStreamerMode: room.isStreamerMode,
      hideRoomCode: room.hideRoomCode
    };
  }

  // Socket Handlers
  socketHandlers: Record<string, SocketEventHandler> = {
    'player:ready': async (socket: Socket, data: { ready: boolean }, room: Room, helpers: GameHelpers) => {
      const validation = playerReadySchema.safeParse(data);
      if (!validation.success) {
        console.error(`[${this.name}] Validation Error (player:ready):`, validation.error);
        return;
      }
      const payload = validation.data;

      const player = Array.from(room.players.values()).find(p => p.socketId === socket.id);
      if (player) {
        // Ensure gameData exists before accessing
        if (!player.gameData) {
          player.gameData = createInitialPlayerData();
        }
        (player.gameData as TemplatePlayerData).isReady = payload.ready;
        this.broadcastRoomState(room);
      }
    },

    'game:start': async (socket: Socket, data: any, room: Room, helpers: GameHelpers) => {
      const validation = gameStartSchema.safeParse(data);
      if (!validation.success) {
        console.error(`[${this.name}] Validation Error (game:start):`, validation.error);
        return;
      }

      const player = Array.from(room.players.values()).find(p => p.socketId === socket.id);
      if (player?.isHost) {
        const gameState = room.gameState.data as TemplateGameState;
        gameState.phase = 'playing';
        room.gameState.phase = 'playing';
        
        helpers.sendToRoom(room.code, 'game:started', {});
        this.broadcastRoomState(room);
      }
    },
    
    'game:action': async (socket: Socket, data: any, room: Room, helpers: GameHelpers) => {
       const validation = gameActionSchema.safeParse(data);
       if (!validation.success) {
         console.error(`[${this.name}] Validation Error (game:action):`, validation.error);
         return;
       }

       // Generic action handler for testing
       console.log(`[${this.name}] Action received:`, validation.data);
       // Implement your game logic here
    },

    'settings:update': async (socket: Socket, data: { settings: Partial<TemplateSettings> }, room: Room, helpers: GameHelpers) => {
      // Only host can update settings
      const player = Array.from(room.players.values()).find(p => p.socketId === socket.id);
      if (!player?.isHost) {
        console.log(`[${this.name}] Non-host tried to update settings`);
        socket.emit('error', { message: 'Only host can update settings' });
        return;
      }

      // Only allow settings update in lobby
      if (room.gameState.phase !== 'lobby') {
        socket.emit('error', { message: 'Can only update settings in lobby' });
        return;
      }

      const gameState = room.gameState.data as TemplateGameState;
      const newSettings = data.settings;

      // Handle game mode change
      if (newSettings.gameMode !== undefined && newSettings.gameMode !== gameState.settings.gameMode) {
        gameState.settings.gameMode = newSettings.gameMode;

        if (newSettings.gameMode === 'teams') {
          // Initialize teams and auto-assign all existing players
          gameState.teams = JSON.parse(JSON.stringify(DEFAULT_TEAMS));
          room.players.forEach(p => {
            this.autoAssignToTeam(room, p);
          });
          console.log(`[${this.name}] Teams mode enabled, ${room.players.size} players assigned`);
        } else {
          // Clear teams
          gameState.teams = [];
          console.log(`[${this.name}] Teams mode disabled`);
        }
      }

      // Handle other settings (extend as needed)
      if (newSettings.maxRounds !== undefined) {
        gameState.settings.maxRounds = newSettings.maxRounds;
      }
      if (newSettings.timeLimit !== undefined) {
        gameState.settings.timeLimit = newSettings.timeLimit;
      }

      console.log(`[${this.name}] Settings updated by ${player.name}`);
      this.broadcastRoomState(room);
    },

    'game:shuffle-teams': async (socket: Socket, data: any, room: Room, helpers: GameHelpers) => {
      // Only host can shuffle teams
      const player = Array.from(room.players.values()).find(p => p.socketId === socket.id);
      if (!player?.isHost) {
        socket.emit('error', { message: 'Only host can shuffle teams' });
        return;
      }

      const gameState = room.gameState.data as TemplateGameState;
      if (gameState.settings.gameMode !== 'teams' || gameState.teams.length === 0) {
        return;
      }

      // Clear all team assignments
      gameState.teams.forEach(team => {
        team.playerIds = [];
      });

      // Shuffle players and reassign
      const shuffledPlayers = Array.from(room.players.values()).sort(() => Math.random() - 0.5);
      shuffledPlayers.forEach(p => {
        this.autoAssignToTeam(room, p);
      });

      console.log(`[${this.name}] Teams shuffled by ${player.name}`);
      this.broadcastRoomState(room);
    },

    'game:switch-team': async (socket: Socket, data: { teamId: string }, room: Room, helpers: GameHelpers) => {
      const validation = switchTeamSchema.safeParse(data);
      if (!validation.success) {
        console.error(`[${this.name}] Validation Error (game:switch-team):`, validation.error);
        return;
      }

      const player = Array.from(room.players.values()).find(p => p.socketId === socket.id);
      if (!player) return;

      const gameState = room.gameState.data as TemplateGameState;

      // Only allow in teams mode
      if (gameState.settings.gameMode !== 'teams') {
        console.log(`[${this.name}] Switch team attempted in classic mode`);
        return;
      }

      const targetTeam = gameState.teams.find(t => t.id === validation.data.teamId);
      if (!targetTeam) {
        console.log(`[${this.name}] Invalid team ID: ${validation.data.teamId}`);
        return;
      }

      // Check if player is already on this team
      if (targetTeam.playerIds.includes(player.socketId)) {
        console.log(`[${this.name}] Player already on team ${targetTeam.name}`);
        return;
      }

      // Validate team balance (max 1 player difference allowed)
      const otherTeam = gameState.teams.find(t => t.id !== validation.data.teamId);
      if (otherTeam) {
        const newTargetSize = targetTeam.playerIds.length + 1;
        const newOtherSize = otherTeam.playerIds.length - 1;
        if (newTargetSize - newOtherSize > 1) {
          console.log(`[${this.name}] Switch would unbalance teams`);
          socket.emit('game:error', { message: 'Cannot switch - teams would be unbalanced' });
          return;
        }
      }

      // Remove from current team
      this.removeFromTeam(gameState, player.socketId);

      // Add to new team
      targetTeam.playerIds.push(player.socketId);

      console.log(`[${this.name}] Player ${player.name} switched to ${targetTeam.name}`);
      this.broadcastRoomState(room);
    }
  };

  // Helper
  private broadcastRoomState(room: Room): void {
    if (!this.io) return;
    const namespace = this.io.of(this.namespace);
    room.players.forEach(player => {
      namespace.to(player.socketId).emit('roomStateUpdated', this.serializeRoom(room, player.socketId));
    });
  }

  // Auto-assign a player to the team with fewer members
  private autoAssignToTeam(room: Room, player: Player): void {
    const gameState = room.gameState.data as TemplateGameState;
    if (gameState.teams.length === 0) return;

    // Check if player is already on a team
    for (const team of gameState.teams) {
      if (team.playerIds.includes(player.socketId)) {
        return; // Already assigned
      }
    }

    // Find team with fewest players
    let smallestTeam = gameState.teams[0];
    for (const team of gameState.teams) {
      if (team.playerIds.length < smallestTeam.playerIds.length) {
        smallestTeam = team;
      }
    }

    // Add player to smallest team
    smallestTeam.playerIds.push(player.socketId);
    console.log(`[${this.name}] Auto-assigned ${player.name} to ${smallestTeam.name}`);
  }

  // Remove a player from any team they're on
  private removeFromTeam(gameState: TemplateGameState, playerId: string): void {
    for (const team of gameState.teams) {
      const index = team.playerIds.indexOf(playerId);
      if (index !== -1) {
        team.playerIds.splice(index, 1);
        console.log(`[${this.name}] Removed player from ${team.name}`);
        return;
      }
    }
  }
}

export default new TemplatePlugin();