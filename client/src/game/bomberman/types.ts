// Bomberman Client Types

import type { BasePlayer, BaseSettings, BaseLobby, Team } from '../../types/base';

// ============================================================================
// Player Types
// ============================================================================

export interface BombermanPlayer extends BasePlayer {
  gridX: number;
  gridY: number;
  maxBombs: number;
  bombsPlaced: number;
  fireRange: number;
  speed: number;
  alive: boolean;
  color: number;
  kills: number;
  deaths: number;
  hasKick: boolean;
  hasThrow: boolean;
  stunnedUntil: number;
  facingDir: number;
  // New power-up flags
  hasPunch: boolean;
  hasPierce: boolean;
  hasBombPass: boolean;
  // Curse state
  curseType: number | null;
  curseEndTime: number;
}

// ============================================================================
// Game Data Types
// ============================================================================

export interface BombData {
  id: string;
  ownerId: string;
  gridX: number;
  gridY: number;
  range: number;
  timer: number;
  isMoving: boolean;
  moveDir: number;
  isFlying: boolean;
  flyDir: number;
  targetX: number;
  targetY: number;
  // New flags
  isPiercing: boolean;
  isPunched: boolean;
}

export interface ExplosionData {
  id: string;
  gridX: number;
  gridY: number;
  timer: number;
}

export interface FallingBlock {
  x: number;
  y: number;
  fallTime: number;
}

export interface BombermanGameData {
  tiles: number[];
  bombs: BombData[];
  explosions: ExplosionData[];
  countdown: number;
  timeRemaining: number;
  gameMode: number;
  winnerId: string | null;
  teams?: Team[];
  // Sudden Death
  suddenDeathActive: boolean;
  fallingBlocks: FallingBlock[];
}

// ============================================================================
// Settings Types
// ============================================================================

export interface BombermanSettings extends BaseSettings {
  gameSpecific: {
    gameMode: number;
  };
}

// ============================================================================
// Lobby Type
// ============================================================================

export type BombermanLobby = BaseLobby<BombermanPlayer, BombermanSettings, BombermanGameData>;

// Convenience exports
export type Lobby = BombermanLobby;
export type Player = BombermanPlayer;
export type Settings = BombermanSettings;
export type GameData = BombermanGameData;
