// Bomberman Game Constants (Client)

export const GAME_CONFIG = {
  // Grid dimensions (19x15 for 8 players)
  GRID_WIDTH: 19,
  GRID_HEIGHT: 15,
  TILE_SIZE: 40,

  // Calculated arena size
  get ARENA_WIDTH() { return this.GRID_WIDTH * this.TILE_SIZE; },
  get ARENA_HEIGHT() { return this.GRID_HEIGHT * this.TILE_SIZE; },

  // Player settings
  PLAYER_MOVE_SPEED: 150, // ms per tile
  MAX_BOMBS: 8,
  MAX_RANGE: 8,

  // Bomb settings
  BOMB_TIMER: 3000, // ms until explosion
  EXPLOSION_DURATION: 500, // ms explosion visible

  // Game settings
  MIN_PLAYERS: 2,
  MAX_PLAYERS: 8,

  // Player colors (8 distinct colors for 8 players)
  PLAYER_COLORS: [
    0xff4444, // Red
    0x44ff44, // Green
    0x4444ff, // Blue
    0xffff44, // Yellow
    0xff44ff, // Magenta
    0x44ffff, // Cyan
    0xff8844, // Orange
    0x8844ff, // Purple
  ],
} as const;

// Tile types
export const TILE = {
  EMPTY: 0,
  HARD_WALL: 1,
  SOFT_BLOCK: 2,
  POWERUP_BOMB: 3,
  POWERUP_FIRE: 4,
  POWERUP_SPEED: 5,
  POWERUP_KICK: 6,
  POWERUP_THROW: 7,
  // New power-ups
  POWERUP_PUNCH: 8,    // Boxing glove - instant knock bomb
  POWERUP_PIERCE: 9,   // Pierce bomb - explosion goes through soft blocks
  POWERUP_BOMBPASS: 10, // Walk through bombs
  SKULL: 11,           // Curse item - random negative effect
} as const;

// Curse types for skull power-up
export const CURSE_TYPE = {
  DIARRHEA: 0,   // Drop bombs uncontrollably
  SLOW: 1,       // Movement very slow
  FAST: 2,       // Movement uncontrollably fast
  NO_BOMBS: 3,   // Cannot place bombs
  SHORT_FUSE: 4, // Bombs explode in 1 second
  REVERSE: 5,    // Controls inverted
  SWAP: 6,       // Swap positions with random player
} as const;

// Game phases
export const GAME_PHASE = {
  WAITING: 'lobby',
  COUNTDOWN: 'countdown',
  PLAYING: 'playing',
  ENDED: 'ended',
} as const;

// Game modes
export const GAME_MODE = {
  LAST_MAN_STANDING: 0,
  DEATHMATCH: 1,
} as const;

// Direction enum for movement
export const DIRECTION = {
  NONE: 0,
  UP: 1,
  DOWN: 2,
  LEFT: 3,
  RIGHT: 4,
} as const;

// Helper to convert grid position to pixel position (center of tile)
export function gridToPixel(gridX: number, gridY: number): { x: number; y: number } {
  return {
    x: gridX * GAME_CONFIG.TILE_SIZE + GAME_CONFIG.TILE_SIZE / 2,
    y: gridY * GAME_CONFIG.TILE_SIZE + GAME_CONFIG.TILE_SIZE / 2,
  };
}
