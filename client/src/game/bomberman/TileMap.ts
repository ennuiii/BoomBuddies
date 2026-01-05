import { Container, Graphics } from 'pixi.js';
import { GAME_CONFIG, TILE } from './constants';

// Enhanced color palette with more depth
const COLORS = {
  // Rich grass tones
  FLOOR: 0x2a6a2a,         // Deep forest green
  FLOOR_ALT: 0x3a8a3a,     // Lighter green for checkerboard
  FLOOR_SHADOW: 0x1a4a1a,  // Shadow near walls
  FLOOR_HIGHLIGHT: 0x4a9a4a, // Subtle grass variation

  // Dramatic stone walls
  HARD_WALL: 0x3a3a4a,     // Dark blue-gray stone
  HARD_WALL_LIGHT: 0x5a5a7a, // Top highlight
  HARD_WALL_DARK: 0x2a2a3a,  // Bottom shadow
  HARD_WALL_EDGE: 0x4a4a5a,  // Edge definition

  // Warm destructible blocks
  SOFT_BLOCK: 0x9b5523,    // Rich brown brick
  SOFT_BLOCK_LIGHT: 0xbb7543, // Top highlight
  SOFT_BLOCK_DARK: 0x6b3513,  // Bottom shadow
  SOFT_BLOCK_CRACK: 0x5a2510, // Crack lines

  // Vibrant power-ups
  POWERUP_BOMB: 0x3399ff,  // Bright blue
  POWERUP_FIRE: 0xff5522,  // Vivid orange-red
  POWERUP_SPEED: 0x44dd44, // Bright lime green
  POWERUP_KICK: 0xffdd22,  // Golden yellow
  POWERUP_THROW: 0xff66bb, // Bright pink
  // New power-ups
  POWERUP_PUNCH: 0xcc44ff,  // Purple/magenta (boxing glove)
  POWERUP_PIERCE: 0x44ffff, // Cyan (piercing laser)
  POWERUP_BOMBPASS: 0xddddff, // Silver/white (ghost through)
  SKULL: 0x888899,          // Gray skull
};

export class TileMap {
  private container: Container;
  private tileGraphics: Graphics;
  private tiles: number[] = [];

  constructor() {
    this.container = new Container();
    this.tileGraphics = new Graphics();
    this.container.addChild(this.tileGraphics);
  }

  getContainer(): Container {
    return this.container;
  }

  setTiles(tiles: number[]) {
    this.tiles = tiles;
    this.render();
  }

  private render() {
    this.tileGraphics.clear();

    const { GRID_WIDTH, GRID_HEIGHT } = GAME_CONFIG;

    for (let y = 0; y < GRID_HEIGHT; y++) {
      for (let x = 0; x < GRID_WIDTH; x++) {
        const tile = this.tiles[y * GRID_WIDTH + x] ?? TILE.EMPTY;
        this.drawTile(x, y, tile);
      }
    }
  }

  private drawTile(gridX: number, gridY: number, tileType: number) {
    const { TILE_SIZE } = GAME_CONFIG;
    const x = gridX * TILE_SIZE;
    const y = gridY * TILE_SIZE;

    // Draw floor first (checkerboard pattern)
    const isAlt = (gridX + gridY) % 2 === 0;
    this.tileGraphics.rect(x, y, TILE_SIZE, TILE_SIZE);
    this.tileGraphics.fill({ color: isAlt ? COLORS.FLOOR : COLORS.FLOOR_ALT });

    switch (tileType) {
      case TILE.HARD_WALL:
        this.drawHardWall(x, y);
        break;
      case TILE.SOFT_BLOCK:
        this.drawSoftBlock(x, y);
        break;
      case TILE.POWERUP_BOMB:
        this.drawPowerUp(x, y, COLORS.POWERUP_BOMB, 'B');
        break;
      case TILE.POWERUP_FIRE:
        this.drawPowerUp(x, y, COLORS.POWERUP_FIRE, 'F');
        break;
      case TILE.POWERUP_SPEED:
        this.drawPowerUp(x, y, COLORS.POWERUP_SPEED, 'S');
        break;
      case TILE.POWERUP_KICK:
        this.drawPowerUp(x, y, COLORS.POWERUP_KICK, 'K');
        break;
      case TILE.POWERUP_THROW:
        this.drawPowerUp(x, y, COLORS.POWERUP_THROW, 'T');
        break;
      case TILE.POWERUP_PUNCH:
        this.drawPowerUp(x, y, COLORS.POWERUP_PUNCH, 'P');
        break;
      case TILE.POWERUP_PIERCE:
        this.drawPowerUp(x, y, COLORS.POWERUP_PIERCE, 'X');
        break;
      case TILE.POWERUP_BOMBPASS:
        this.drawPowerUp(x, y, COLORS.POWERUP_BOMBPASS, 'G');
        break;
      case TILE.SKULL:
        this.drawSkull(x, y);
        break;
    }
  }

  private drawHardWall(x: number, y: number) {
    const { TILE_SIZE } = GAME_CONFIG;
    const inset = 1;

    // Bottom shadow (depth)
    this.tileGraphics.rect(x + inset + 2, y + inset + 2, TILE_SIZE - inset * 2, TILE_SIZE - inset * 2);
    this.tileGraphics.fill({ color: COLORS.HARD_WALL_DARK });

    // Main block
    this.tileGraphics.rect(x + inset, y + inset, TILE_SIZE - inset * 2, TILE_SIZE - inset * 2);
    this.tileGraphics.fill({ color: COLORS.HARD_WALL });

    // Top highlight (3D effect)
    this.tileGraphics.rect(x + inset, y + inset, TILE_SIZE - inset * 2, 8);
    this.tileGraphics.fill({ color: COLORS.HARD_WALL_LIGHT });

    // Left edge highlight
    this.tileGraphics.rect(x + inset, y + inset, 4, TILE_SIZE - inset * 2);
    this.tileGraphics.fill({ color: COLORS.HARD_WALL_EDGE, alpha: 0.5 });

    // Stone brick pattern
    const brickH = (TILE_SIZE - inset * 2) / 3;
    for (let row = 0; row < 3; row++) {
      const brickY = y + inset + row * brickH;
      const offset = row % 2 === 0 ? 0 : (TILE_SIZE - inset * 2) / 2;

      // Horizontal line
      this.tileGraphics.moveTo(x + inset, brickY);
      this.tileGraphics.lineTo(x + TILE_SIZE - inset, brickY);
      this.tileGraphics.stroke({ width: 1, color: COLORS.HARD_WALL_DARK });

      // Vertical lines (offset pattern)
      if (row < 2) {
        this.tileGraphics.moveTo(x + inset + offset + (TILE_SIZE - inset * 2) / 2, brickY);
        this.tileGraphics.lineTo(x + inset + offset + (TILE_SIZE - inset * 2) / 2, brickY + brickH);
        this.tileGraphics.stroke({ width: 1, color: COLORS.HARD_WALL_DARK });
      }
    }

    // Bottom shadow line
    this.tileGraphics.rect(x + inset, y + TILE_SIZE - inset - 3, TILE_SIZE - inset * 2, 3);
    this.tileGraphics.fill({ color: COLORS.HARD_WALL_DARK });
  }

  private drawSoftBlock(x: number, y: number) {
    const { TILE_SIZE } = GAME_CONFIG;
    const inset = 2;

    // Drop shadow
    this.tileGraphics.rect(x + inset + 2, y + inset + 2, TILE_SIZE - inset * 2, TILE_SIZE - inset * 2);
    this.tileGraphics.fill({ color: COLORS.SOFT_BLOCK_DARK, alpha: 0.6 });

    // Main block
    this.tileGraphics.rect(x + inset, y + inset, TILE_SIZE - inset * 2, TILE_SIZE - inset * 2);
    this.tileGraphics.fill({ color: COLORS.SOFT_BLOCK });

    // Top highlight gradient
    this.tileGraphics.rect(x + inset, y + inset, TILE_SIZE - inset * 2, 7);
    this.tileGraphics.fill({ color: COLORS.SOFT_BLOCK_LIGHT });

    // Left edge highlight
    this.tileGraphics.rect(x + inset, y + inset, 4, TILE_SIZE - inset * 2);
    this.tileGraphics.fill({ color: COLORS.SOFT_BLOCK_LIGHT, alpha: 0.4 });

    // Brick pattern (2x2 grid with mortar)
    const halfW = (TILE_SIZE - inset * 2) / 2;
    const halfH = (TILE_SIZE - inset * 2) / 2;

    // Horizontal mortar line
    this.tileGraphics.rect(x + inset, y + inset + halfH - 1, TILE_SIZE - inset * 2, 3);
    this.tileGraphics.fill({ color: COLORS.SOFT_BLOCK_CRACK });

    // Vertical mortar line (top half)
    this.tileGraphics.rect(x + inset + halfW - 1, y + inset, 3, halfH);
    this.tileGraphics.fill({ color: COLORS.SOFT_BLOCK_CRACK });

    // Vertical mortar line (bottom half, offset)
    this.tileGraphics.rect(x + inset + halfW / 2 - 1, y + inset + halfH, 3, halfH);
    this.tileGraphics.fill({ color: COLORS.SOFT_BLOCK_CRACK });

    // Subtle crack details
    this.tileGraphics.moveTo(x + inset + 6, y + inset + 8);
    this.tileGraphics.lineTo(x + inset + 10, y + inset + 14);
    this.tileGraphics.stroke({ width: 1, color: COLORS.SOFT_BLOCK_CRACK, alpha: 0.5 });

    // Bottom shadow
    this.tileGraphics.rect(x + inset, y + TILE_SIZE - inset - 4, TILE_SIZE - inset * 2, 4);
    this.tileGraphics.fill({ color: COLORS.SOFT_BLOCK_DARK });

    // Corner shine
    this.tileGraphics.rect(x + inset + 2, y + inset + 2, 5, 5);
    this.tileGraphics.fill({ color: 0xffffff, alpha: 0.15 });
  }

  private drawPowerUp(x: number, y: number, color: number, _label: string) {
    const { TILE_SIZE } = GAME_CONFIG;
    const centerX = x + TILE_SIZE / 2;
    const centerY = y + TILE_SIZE / 2;
    const radius = TILE_SIZE / 3;

    // Outer glow (multiple rings for soft glow)
    this.tileGraphics.circle(centerX, centerY, radius + 8);
    this.tileGraphics.fill({ color: color, alpha: 0.15 });

    this.tileGraphics.circle(centerX, centerY, radius + 5);
    this.tileGraphics.fill({ color: color, alpha: 0.25 });

    // Shadow under the power-up
    this.tileGraphics.ellipse(centerX, centerY + radius - 2, radius * 0.7, radius * 0.25);
    this.tileGraphics.fill({ color: 0x000000, alpha: 0.3 });

    // Main circle with gradient effect
    this.tileGraphics.circle(centerX, centerY, radius);
    this.tileGraphics.fill({ color: color });

    // Inner darker ring for depth
    this.tileGraphics.circle(centerX, centerY, radius);
    this.tileGraphics.stroke({ width: 3, color: this.darkenColor(color, 0.3) });

    // Top highlight arc
    this.tileGraphics.circle(centerX, centerY - 2, radius * 0.8);
    this.tileGraphics.fill({ color: this.lightenColor(color, 0.3), alpha: 0.4 });

    // Specular highlight
    this.tileGraphics.circle(centerX - radius / 3, centerY - radius / 3, radius / 4);
    this.tileGraphics.fill({ color: 0xffffff, alpha: 0.7 });

    // Small secondary highlight
    this.tileGraphics.circle(centerX - radius / 4, centerY - radius / 4, radius / 8);
    this.tileGraphics.fill({ color: 0xffffff, alpha: 0.9 });

    // Outer bright ring
    this.tileGraphics.circle(centerX, centerY, radius);
    this.tileGraphics.stroke({ width: 2, color: 0xffffff, alpha: 0.4 });
  }

  private drawSkull(x: number, y: number) {
    const { TILE_SIZE } = GAME_CONFIG;
    const centerX = x + TILE_SIZE / 2;
    const centerY = y + TILE_SIZE / 2;
    const size = TILE_SIZE * 0.35;

    // Ominous purple-red glow
    this.tileGraphics.circle(centerX, centerY, size + 10);
    this.tileGraphics.fill({ color: 0x660033, alpha: 0.2 });

    this.tileGraphics.circle(centerX, centerY, size + 6);
    this.tileGraphics.fill({ color: 0x880044, alpha: 0.3 });

    // Shadow under skull
    this.tileGraphics.ellipse(centerX, centerY + size - 2, size * 0.6, size * 0.2);
    this.tileGraphics.fill({ color: 0x000000, alpha: 0.4 });

    // Skull main shape (rounded rectangle for head)
    const skullTop = centerY - size * 0.6;
    const skullLeft = centerX - size * 0.65;
    const skullWidth = size * 1.3;
    const skullHeight = size * 1.0;

    // Skull base (gray bone)
    this.tileGraphics.roundRect(skullLeft, skullTop, skullWidth, skullHeight, 6);
    this.tileGraphics.fill({ color: COLORS.SKULL });

    // Skull highlight (top)
    this.tileGraphics.roundRect(skullLeft, skullTop, skullWidth, skullHeight * 0.4, 6);
    this.tileGraphics.fill({ color: 0xaaaaaa });

    // Left eye socket
    this.tileGraphics.circle(centerX - size * 0.25, skullTop + skullHeight * 0.4, size * 0.22);
    this.tileGraphics.fill({ color: 0x220011 });

    // Right eye socket
    this.tileGraphics.circle(centerX + size * 0.25, skullTop + skullHeight * 0.4, size * 0.22);
    this.tileGraphics.fill({ color: 0x220011 });

    // Red glowing eyes (inner)
    this.tileGraphics.circle(centerX - size * 0.25, skullTop + skullHeight * 0.4, size * 0.1);
    this.tileGraphics.fill({ color: 0xff2222 });

    this.tileGraphics.circle(centerX + size * 0.25, skullTop + skullHeight * 0.4, size * 0.1);
    this.tileGraphics.fill({ color: 0xff2222 });

    // Nose (triangle-ish)
    this.tileGraphics.circle(centerX, skullTop + skullHeight * 0.6, size * 0.1);
    this.tileGraphics.fill({ color: 0x333333 });

    // Teeth (bottom row)
    const teethY = skullTop + skullHeight * 0.8;
    const teethWidth = size * 0.15;
    for (let i = -2; i <= 2; i++) {
      this.tileGraphics.rect(
        centerX + i * teethWidth - teethWidth * 0.4,
        teethY,
        teethWidth * 0.7,
        size * 0.2
      );
      this.tileGraphics.fill({ color: 0xdddddd });
    }

    // Outline
    this.tileGraphics.roundRect(skullLeft, skullTop, skullWidth, skullHeight, 6);
    this.tileGraphics.stroke({ width: 1.5, color: 0x444444 });
  }

  private darkenColor(color: number, amount: number): number {
    const r = Math.max(0, ((color >> 16) & 0xff) * (1 - amount));
    const g = Math.max(0, ((color >> 8) & 0xff) * (1 - amount));
    const b = Math.max(0, (color & 0xff) * (1 - amount));
    return (Math.floor(r) << 16) | (Math.floor(g) << 8) | Math.floor(b);
  }

  private lightenColor(color: number, amount: number): number {
    const r = Math.min(255, ((color >> 16) & 0xff) + 255 * amount);
    const g = Math.min(255, ((color >> 8) & 0xff) + 255 * amount);
    const b = Math.min(255, (color & 0xff) + 255 * amount);
    return (Math.floor(r) << 16) | (Math.floor(g) << 8) | Math.floor(b);
  }

  updateTile(gridX: number, gridY: number, tileType: number) {
    const { GRID_WIDTH } = GAME_CONFIG;
    const index = gridY * GRID_WIDTH + gridX;
    if (index >= 0 && index < this.tiles.length) {
      this.tiles[index] = tileType;
      this.render(); // Re-render entire map (could optimize to only redraw changed tile)
    }
  }
}
