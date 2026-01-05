import 'pixi.js/unsafe-eval'; // Must be first - patches renderer for CSP
import { Application, Container, Graphics, Text, TextStyle } from 'pixi.js';
import { TileMap } from './TileMap';
import { GAME_CONFIG, GAME_PHASE, GAME_MODE, DIRECTION, gridToPixel } from './constants';
import type { BombermanLobby, BombermanPlayer, BombData, ExplosionData } from './types';

interface PlayerSprite {
  container: Container;
  body: Graphics;
  nameText: Text;
  targetX: number;
  targetY: number;
  data: BombermanPlayer;
  // Animation state
  deathTime: number;
  lastX: number;
  lastY: number;
  movePhase: number;
}

interface BombSprite {
  graphics: Graphics;
  pulsePhase: number;
  targetX: number;
  targetY: number;
  data: BombData;
  bounceTime: number;
  // Wrap bounce animation state
  wrapBouncePhase: number;  // 0=none, 0-1=exit wall, 1-2=entry wall
  wrapBounceDir: 'x' | 'y' | null;
  prevTargetX: number;
  prevTargetY: number;
}

interface ExplosionSprite {
  graphics: Graphics;
  createdAt: number;
  gridX: number;
  gridY: number;
}

export interface GameCallbacks {
  onMove: (direction: number) => void;
  onBomb: () => void;
  onThrow: () => void;
  onStart: () => void;
}

export class Game {
  private app: Application;
  private appContainer: HTMLElement | null = null;
  private tileMap: TileMap;
  private callbacks: GameCallbacks | null = null;

  // Containers
  private worldContainer!: Container;
  private entitiesContainer!: Container;
  private uiContainer!: Container;

  // Sprites
  private playerSprites: Map<string, PlayerSprite> = new Map();
  private bombSprites: Map<string, BombSprite> = new Map();
  private explosionSprites: Map<string, ExplosionSprite> = new Map();

  // Camera
  private cameraX = 0;
  private cameraY = 0;

  // Local player tracking
  private mySocketId: string | null = null;

  // Current lobby state
  private currentLobby: BombermanLobby | null = null;

  // UI elements
  private statusText!: Text;
  private countdownText!: Text;

  // Input state
  private keysHeld = new Set<string>();
  private lastMoveTime = 0;
  private moveRepeatDelay = 120; // ms between repeated moves when holding key

  // Initialization state
  private initialized = false;

  // Screen shake
  private shakeIntensity = 0;
  private shakeDecay = 0.85;

  // Animation timing
  private globalTime = 0;

  // Countdown animation state
  private lastCountdownValue = 0;
  private countdownAnimStart = 0;

  constructor() {
    this.app = new Application();
    this.tileMap = new TileMap();
  }

  async init(container: HTMLElement) {
    if (this.initialized) return;

    this.appContainer = container;

    const width = container.clientWidth;
    const height = container.clientHeight;
    console.log('[Game] Initializing PixiJS with dimensions:', width, 'x', height);

    if (width === 0 || height === 0) {
      console.error('[Game] Container has zero dimensions! Width:', width, 'Height:', height);
      console.error('[Game] Container computed style:', window.getComputedStyle(container).height, window.getComputedStyle(container).width);
    }

    await this.app.init({
      width: width || 800, // Fallback to prevent 0x0 canvas
      height: height || 600,
      backgroundColor: 0x1a1a2e,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
      antialias: false, // Pixel art style
    });

    console.log('[Game] PixiJS app initialized, canvas:', this.app.canvas.width, 'x', this.app.canvas.height);
    container.appendChild(this.app.canvas);

    // Ensure canvas fills container properly
    this.app.canvas.style.width = '100%';
    this.app.canvas.style.height = '100%';
    this.app.canvas.style.display = 'block';

    console.log('[Game] Canvas appended to container');

    // Create containers
    this.worldContainer = new Container();
    this.entitiesContainer = new Container();
    this.uiContainer = new Container();

    this.app.stage.addChild(this.worldContainer);
    this.app.stage.addChild(this.uiContainer);

    this.worldContainer.addChild(this.tileMap.getContainer());
    this.worldContainer.addChild(this.entitiesContainer);

    // Create UI
    this.createUI();

    // Game loop
    this.app.ticker.add(() => this.update());

    this.initialized = true;
  }

  setCallbacks(callbacks: GameCallbacks) {
    this.callbacks = callbacks;
  }

  /**
   * Update game state from React lobby prop
   */
  updateFromLobby(lobby: BombermanLobby) {
    if (!this.initialized) {
      console.log('[Game] updateFromLobby called but not initialized yet');
      return;
    }

    console.log('[Game] updateFromLobby - players:', lobby.players.length, 'state:', lobby.state, 'mySocketId:', lobby.mySocketId);

    this.currentLobby = lobby;
    this.mySocketId = lobby.mySocketId;

    // Update tiles
    if (lobby.gameData?.tiles) {
      this.tileMap.setTiles(lobby.gameData.tiles);
    }

    // Update players
    this.syncPlayers(lobby.players);

    // Update bombs
    if (lobby.gameData?.bombs) {
      this.syncBombs(lobby.gameData.bombs);
    }

    // Update explosions
    if (lobby.gameData?.explosions) {
      this.syncExplosions(lobby.gameData.explosions);
    }

    // Update UI based on game state
    this.updateGameStateUI(lobby);
  }

  private syncPlayers(players: BombermanPlayer[]) {
    const currentIds = new Set(players.map(p => p.socketId));

    // Remove players no longer in list
    this.playerSprites.forEach((_sprite, id) => {
      if (!currentIds.has(id)) {
        this.removePlayer(id);
      }
    });

    // Add or update players
    players.forEach(player => {
      if (this.playerSprites.has(player.socketId)) {
        this.updatePlayer(player);
      } else {
        this.addPlayer(player);
      }
    });
  }

  private syncBombs(bombs: BombData[]) {
    const currentIds = new Set(bombs.map(b => b.id));

    // Remove bombs no longer in list
    this.bombSprites.forEach((_sprite, id) => {
      if (!currentIds.has(id)) {
        this.removeBomb(id);
      }
    });

    // Add or update bombs
    bombs.forEach(bomb => {
      if (this.bombSprites.has(bomb.id)) {
        this.updateBomb(bomb);
      } else {
        this.addBomb(bomb);
      }
    });
  }

  private syncExplosions(explosions: ExplosionData[]) {
    const currentIds = new Set(explosions.map(e => e.id));

    // Remove explosions no longer in list
    this.explosionSprites.forEach((_sprite, id) => {
      if (!currentIds.has(id)) {
        this.removeExplosion(id);
      }
    });

    // Add explosions
    explosions.forEach(explosion => {
      if (!this.explosionSprites.has(explosion.id)) {
        this.addExplosion(explosion);
      }
    });
  }

  private updateGameStateUI(lobby: BombermanLobby) {
    const phase = lobby.state;
    const gameData = lobby.gameData;

    switch (phase) {
      case GAME_PHASE.WAITING:
        const count = lobby.players.length;
        this.statusText.text = `Waiting for players (${count}/${GAME_CONFIG.MIN_PLAYERS} min)...`;
        this.countdownText.visible = false;
        this.lastCountdownValue = 0;
        break;

      case GAME_PHASE.COUNTDOWN:
        this.statusText.text = 'Get Ready!';
        this.countdownText.visible = true;
        const countdownSecs = Math.ceil((gameData?.countdown || 0) / 1000);

        // Detect countdown value change for animation
        if (countdownSecs !== this.lastCountdownValue) {
          this.lastCountdownValue = countdownSecs;
          this.countdownAnimStart = Date.now();
        }

        // Set text (0 = "GO!")
        if (countdownSecs <= 0) {
          this.countdownText.text = 'GO!';
          this.countdownText.style.fill = 0x44ff44; // Green for GO
        } else {
          this.countdownText.text = countdownSecs.toString();
          // Color based on countdown value
          if (countdownSecs === 1) {
            this.countdownText.style.fill = 0xff4444; // Red for 1
          } else if (countdownSecs === 2) {
            this.countdownText.style.fill = 0xffaa44; // Orange for 2
          } else {
            this.countdownText.style.fill = 0xffff44; // Yellow for 3+
          }
        }
        break;

      case GAME_PHASE.PLAYING:
        // "GO!" flash effect when game just started
        const timeSinceStart = Date.now() - this.countdownAnimStart;
        if (this.lastCountdownValue === 0 && timeSinceStart < 500) {
          this.countdownText.visible = true;
          this.countdownText.text = 'GO!';
          this.countdownText.style.fill = 0x44ff44;
          this.countdownText.alpha = 1 - (timeSinceStart / 500);
        } else {
          this.countdownText.visible = false;
          this.countdownText.alpha = 1;
        }

        if (gameData?.gameMode === GAME_MODE.DEATHMATCH) {
          const mins = Math.floor((gameData?.timeRemaining || 0) / 60000);
          const secs = Math.floor(((gameData?.timeRemaining || 0) % 60000) / 1000);
          this.statusText.text = `Time: ${mins}:${secs.toString().padStart(2, '0')}`;
        } else {
          const alive = lobby.players.filter(p => p.alive).length;
          this.statusText.text = `Players alive: ${alive}`;
        }
        break;

      case GAME_PHASE.ENDED:
        const winner = lobby.players.find(p => p.socketId === gameData?.winnerId);
        this.statusText.text = winner ? `${winner.name} wins!` : 'Game Over!';
        this.countdownText.visible = true;
        this.countdownText.text = 'GAME OVER';
        this.countdownText.style.fill = 0xff6666;
        this.countdownText.alpha = 1;
        this.lastCountdownValue = -1; // Reset for next game
        break;
    }
  }

  private animateCountdown() {
    if (!this.countdownText.visible) return;

    const elapsed = Date.now() - this.countdownAnimStart;
    const animDuration = 300; // Animation duration in ms

    if (elapsed < animDuration) {
      // Scale animation: start big, shrink to normal
      const progress = elapsed / animDuration;
      const easeOut = 1 - Math.pow(1 - progress, 3); // Cubic ease-out
      const scale = 1.5 - (0.5 * easeOut); // 1.5 → 1.0

      this.countdownText.scale.set(scale);
    } else {
      this.countdownText.scale.set(1);
    }
  }

  private createUI() {
    const containerWidth = this.appContainer?.clientWidth || window.innerWidth;
    const containerHeight = this.appContainer?.clientHeight || window.innerHeight;

    const style = new TextStyle({
      fontFamily: 'monospace',
      fontSize: 24,
      fill: 0xffffff,
      fontWeight: 'bold',
      stroke: { color: 0x000000, width: 4 },
    });

    // Status text
    this.statusText = new Text({ text: 'Waiting for players...', style });
    this.statusText.x = containerWidth / 2;
    this.statusText.y = 30;
    this.statusText.anchor.set(0.5, 0);
    this.uiContainer.addChild(this.statusText);

    // Countdown text
    const countdownStyle = new TextStyle({
      fontFamily: 'monospace',
      fontSize: 72,
      fill: 0xffff00,
      fontWeight: 'bold',
      stroke: { color: 0x000000, width: 6 },
    });
    this.countdownText = new Text({ text: '', style: countdownStyle });
    this.countdownText.x = containerWidth / 2;
    this.countdownText.y = containerHeight / 2;
    this.countdownText.anchor.set(0.5, 0.5);
    this.countdownText.visible = false;
    this.uiContainer.addChild(this.countdownText);

    // Calculate position below the game grid
    const worldHeight = GAME_CONFIG.GRID_HEIGHT * GAME_CONFIG.TILE_SIZE;
    const belowGridY = worldHeight + 15; // 15px padding below grid

    // Power-up legend (below the game grid)
    const legendY = belowGridY;
    const legendItems = [
      { color: 0x3399ff, label: 'Bomb+' },
      { color: 0xff5522, label: 'Fire+' },
      { color: 0x44dd44, label: 'Speed' },
      { color: 0xffdd22, label: 'Kick' },
      { color: 0xff66bb, label: 'Throw' },
    ];

    const legendContainer = new Container();
    const itemWidth = 70;
    const startX = containerWidth / 2 - (legendItems.length * itemWidth) / 2;

    legendItems.forEach((item, i) => {
      // Colored circle with glow
      const circle = new Graphics();
      circle.circle(0, 0, 10);
      circle.fill({ color: item.color, alpha: 0.3 });
      circle.circle(0, 0, 7);
      circle.fill({ color: item.color });
      circle.x = startX + i * itemWidth + 10;
      circle.y = legendY;
      legendContainer.addChild(circle);

      // Label
      const labelStyle = new TextStyle({
        fontFamily: 'monospace',
        fontSize: 11,
        fill: 0xcccccc,
      });
      const label = new Text({ text: item.label, style: labelStyle });
      label.x = startX + i * itemWidth + 22;
      label.y = legendY - 6;
      legendContainer.addChild(label);
    });

    this.uiContainer.addChild(legendContainer);

    // Instructions text (below the legend)
    const instructStyle = new TextStyle({
      fontFamily: 'monospace',
      fontSize: 14,
      fill: 0xaaaaaa,
    });
    const instructText = new Text({
      text: 'WASD/Arrows: Move | Space: Bomb | E: Throw | Shift+Enter: Start',
      style: instructStyle,
    });
    instructText.x = containerWidth / 2;
    instructText.y = belowGridY + 35; // Below the legend
    instructText.anchor.set(0.5, 0);
    this.uiContainer.addChild(instructText);
  }

  private addPlayer(data: BombermanPlayer) {
    console.log('[Game] Adding player:', data.socketId, 'name:', data.name, 'at grid:', data.gridX, data.gridY, 'color:', data.color.toString(16));

    const container = new Container();
    const body = new Graphics();
    this.drawPlayer(body, data.color, data.alive, false, 0);

    // Name text
    const nameStyle = new TextStyle({
      fontFamily: 'monospace',
      fontSize: 12,
      fill: 0xffffff,
      fontWeight: 'bold',
      stroke: { color: 0x000000, width: 2 },
    });
    const nameText = new Text({ text: data.name, style: nameStyle });
    nameText.anchor.set(0.5, 1);
    nameText.y = -GAME_CONFIG.TILE_SIZE / 2 - 5;

    container.addChild(body);
    container.addChild(nameText);

    const pos = gridToPixel(data.gridX, data.gridY);
    container.x = pos.x;
    container.y = pos.y;

    this.entitiesContainer.addChild(container);

    this.playerSprites.set(data.socketId, {
      container,
      body,
      nameText,
      targetX: pos.x,
      targetY: pos.y,
      data,
      deathTime: 0,
      lastX: pos.x,
      lastY: pos.y,
      movePhase: 0,
    });
  }

  private updatePlayer(data: BombermanPlayer) {
    const sprite = this.playerSprites.get(data.socketId);
    if (!sprite) return;

    // Track if player just died
    const wasDead = !sprite.data.alive;
    const justDied = !data.alive && !wasDead;
    if (justDied) {
      sprite.deathTime = Date.now();
    }

    // Track movement for animation
    const pos = gridToPixel(data.gridX, data.gridY);
    if (pos.x !== sprite.targetX || pos.y !== sprite.targetY) {
      sprite.lastX = sprite.targetX;
      sprite.lastY = sprite.targetY;
      sprite.movePhase = this.globalTime;
    }

    sprite.data = data;
    sprite.targetX = pos.x;
    sprite.targetY = pos.y;
  }

  private removePlayer(id: string) {
    const sprite = this.playerSprites.get(id);
    if (sprite) {
      this.entitiesContainer.removeChild(sprite.container);
      sprite.container.destroy();
      this.playerSprites.delete(id);
    }
  }

  private drawPlayer(graphics: Graphics, color: number, alive: boolean, isStunned: boolean = false, movePhase: number = 0, deathProgress: number = 0) {
    graphics.clear();
    const size = GAME_CONFIG.TILE_SIZE * 0.7;
    const half = size / 2;

    // Shadow (always draw first)
    const shadowScale = alive ? 1 : (1 - deathProgress * 0.5);
    graphics.ellipse(0, half + 4, half * 0.7 * shadowScale, half * 0.25 * shadowScale);
    graphics.fill({ color: 0x000000, alpha: 0.35 * (alive ? 1 : 1 - deathProgress) });

    if (!alive) {
      // Death animation - ghost floating up with fade
      const floatY = -deathProgress * 40;
      const ghostAlpha = Math.max(0, 1 - deathProgress);
      const ghostScale = 1 - deathProgress * 0.3;

      // Ghost body
      graphics.circle(0, floatY, half * 0.8 * ghostScale);
      graphics.fill({ color: 0xffffff, alpha: ghostAlpha * 0.7 });

      // Ghost inner
      graphics.circle(0, floatY, half * 0.5 * ghostScale);
      graphics.fill({ color: color, alpha: ghostAlpha * 0.5 });

      // Ghost eyes (X shapes for dead)
      const eyeY = floatY - 4;
      const eyeSize = 4 * ghostScale;
      graphics.moveTo(-8 - eyeSize, eyeY - eyeSize);
      graphics.lineTo(-8 + eyeSize, eyeY + eyeSize);
      graphics.moveTo(-8 + eyeSize, eyeY - eyeSize);
      graphics.lineTo(-8 - eyeSize, eyeY + eyeSize);
      graphics.moveTo(8 - eyeSize, eyeY - eyeSize);
      graphics.lineTo(8 + eyeSize, eyeY + eyeSize);
      graphics.moveTo(8 + eyeSize, eyeY - eyeSize);
      graphics.lineTo(8 - eyeSize, eyeY + eyeSize);
      graphics.stroke({ width: 2, color: 0x000000, alpha: ghostAlpha });
      return;
    }

    // Movement squash/stretch
    const moveDelta = (this.globalTime - movePhase);
    const squashStretch = moveDelta < 200 ? Math.sin((moveDelta / 200) * Math.PI) * 0.15 : 0;
    const scaleX = 1 - squashStretch;
    const scaleY = 1 + squashStretch;

    // Stun effect - flash between normal and yellow
    const effectiveColor = isStunned && Math.floor(Date.now() / 80) % 2 === 0 ? 0xffff00 : color;

    // Body with squash/stretch (rounded rectangle)
    const bodyW = size * scaleX;
    const bodyH = size * scaleY;
    graphics.roundRect(-bodyW / 2, -bodyH / 2, bodyW, bodyH, 10);
    graphics.fill({ color: effectiveColor });

    // Body outline for depth
    graphics.roundRect(-bodyW / 2, -bodyH / 2, bodyW, bodyH, 10);
    graphics.stroke({ width: 2, color: this.darkenColor(effectiveColor, 0.3) });

    // Inner body highlight
    graphics.roundRect(-bodyW / 2 + 4, -bodyH / 2 + 4, bodyW - 8, bodyH * 0.4, 6);
    graphics.fill({ color: 0xffffff, alpha: 0.2 });

    // Stun indicator - rotating stars
    if (isStunned) {
      const starRotation = Date.now() / 200;
      for (let i = 0; i < 3; i++) {
        const angle = starRotation + (i * Math.PI * 2 / 3);
        const starX = Math.cos(angle) * 12;
        const starY = -half - 12 + Math.sin(angle * 2) * 3;
        this.drawStar(graphics, starX, starY, 4, 0xffff00);
      }
    }

    // Face - Eyes
    const eyeOffsetY = -bodyH / 8;
    graphics.circle(-bodyW / 5, eyeOffsetY, 5);
    graphics.circle(bodyW / 5, eyeOffsetY, 5);
    graphics.fill({ color: 0xffffff });

    // Pupils (look in movement direction or center)
    graphics.circle(-bodyW / 5, eyeOffsetY, 2.5);
    graphics.circle(bodyW / 5, eyeOffsetY, 2.5);
    graphics.fill({ color: 0x000000 });

    // Mouth
    if (isStunned) {
      // Dazed O mouth
      graphics.circle(0, bodyH / 5, 5);
      graphics.fill({ color: 0x000000 });
      graphics.circle(0, bodyH / 5, 3);
      graphics.fill({ color: 0x330000 });
    } else {
      // Happy smile
      graphics.moveTo(-bodyW / 5, bodyH / 5);
      graphics.quadraticCurveTo(0, bodyH / 3, bodyW / 5, bodyH / 5);
      graphics.stroke({ width: 2.5, color: 0x000000 });
    }

    // Corner highlight
    graphics.roundRect(-bodyW / 2 + 4, -bodyH / 2 + 4, 8, 8, 3);
    graphics.fill({ color: 0xffffff, alpha: 0.5 });
  }

  private drawStar(graphics: Graphics, x: number, y: number, size: number, color: number) {
    const spikes = 4;
    const outerRadius = size;
    const innerRadius = size * 0.4;

    graphics.moveTo(x + outerRadius, y);
    for (let i = 0; i < spikes * 2; i++) {
      const radius = i % 2 === 0 ? outerRadius : innerRadius;
      const angle = (i * Math.PI) / spikes - Math.PI / 2;
      graphics.lineTo(x + Math.cos(angle) * radius, y + Math.sin(angle) * radius);
    }
    graphics.closePath();
    graphics.fill({ color });
  }

  private darkenColor(color: number, amount: number): number {
    const r = Math.max(0, ((color >> 16) & 0xff) * (1 - amount));
    const g = Math.max(0, ((color >> 8) & 0xff) * (1 - amount));
    const b = Math.max(0, (color & 0xff) * (1 - amount));
    return (Math.floor(r) << 16) | (Math.floor(g) << 8) | Math.floor(b);
  }

  private lerpColor(color1: number, color2: number, t: number): number {
    const r1 = (color1 >> 16) & 0xff;
    const g1 = (color1 >> 8) & 0xff;
    const b1 = color1 & 0xff;
    const r2 = (color2 >> 16) & 0xff;
    const g2 = (color2 >> 8) & 0xff;
    const b2 = color2 & 0xff;
    const r = Math.floor(r1 + (r2 - r1) * t);
    const g = Math.floor(g1 + (g2 - g1) * t);
    const b = Math.floor(b1 + (b2 - b1) * t);
    return (r << 16) | (g << 8) | b;
  }

  private addBomb(data: BombData) {
    const graphics = new Graphics();
    this.drawBomb(graphics, 1);

    const pos = gridToPixel(data.gridX, data.gridY);
    graphics.x = pos.x;
    graphics.y = pos.y;

    this.entitiesContainer.addChild(graphics);
    this.bombSprites.set(data.id, {
      graphics,
      pulsePhase: 0,
      targetX: pos.x,
      targetY: pos.y,
      data,
      bounceTime: 0,
      wrapBouncePhase: 0,
      wrapBounceDir: null,
      prevTargetX: pos.x,
      prevTargetY: pos.y,
    });
  }

  private updateBomb(data: BombData) {
    const sprite = this.bombSprites.get(data.id);
    if (!sprite) return;

    sprite.data = data;

    // Update pulse based on timer
    const urgency = 1 - data.timer / GAME_CONFIG.BOMB_TIMER;
    sprite.pulsePhase = urgency;

    // Calculate new target position
    const pos = gridToPixel(data.gridX, data.gridY);

    // Detect wrap (position jumped significantly) - only for flying bombs
    if (data.isFlying && sprite.wrapBouncePhase === 0) {
      const deltaX = Math.abs(sprite.targetX - pos.x);
      const deltaY = Math.abs(sprite.targetY - pos.y);
      const wrapThreshold = GAME_CONFIG.TILE_SIZE * 5; // ~200px = definitely wrapped

      if (deltaX > wrapThreshold) {
        sprite.wrapBouncePhase = 0.01; // Start exit bounce
        sprite.wrapBounceDir = 'x';
      } else if (deltaY > wrapThreshold) {
        sprite.wrapBouncePhase = 0.01;
        sprite.wrapBounceDir = 'y';
      }
    }

    // Store previous target for animation reference
    sprite.prevTargetX = sprite.targetX;
    sprite.prevTargetY = sprite.targetY;

    // Update target position for sliding/flying bombs
    sprite.targetX = pos.x;
    sprite.targetY = pos.y;
  }

  private removeBomb(id: string) {
    const sprite = this.bombSprites.get(id);
    if (sprite) {
      this.entitiesContainer.removeChild(sprite.graphics);
      sprite.graphics.destroy();
      this.bombSprites.delete(id);
    }
  }

  private drawBomb(graphics: Graphics, pulse: number, isFlying: boolean = false, bounceOffset: number = 0) {
    graphics.clear();
    const baseSize = GAME_CONFIG.TILE_SIZE * 0.4;
    const pulseScale = 1 + pulse * 0.25 * Math.sin(Date.now() / (100 - pulse * 50)); // Faster pulse as timer runs out
    const size = baseSize * pulseScale;

    // Urgency color: black to dark red as pulse increases
    const urgencyColor = this.lerpColor(0x1a1a1a, 0x4a0000, pulse);

    // Shadow (ground shadow)
    const shadowY = isFlying ? -bounceOffset + 8 : 8;
    const shadowScale = isFlying ? 1 + (Math.abs(bounceOffset) / 40) : pulseScale;
    graphics.ellipse(0, shadowY, size * 0.8 * shadowScale, size * 0.3);
    graphics.fill({ color: 0x000000, alpha: 0.4 * (1 - (isFlying ? Math.abs(bounceOffset) / 40 : 0)) });

    // Danger glow ring (pulsing, more visible as timer runs out)
    const glowSize = size * (1.4 + pulse * 0.3 * Math.sin(Date.now() / (80 - pulse * 40)));
    const glowAlpha = 0.15 + pulse * 0.25;
    graphics.circle(0, bounceOffset + 2, glowSize);
    graphics.fill({ color: 0xff4400, alpha: glowAlpha });

    // Inner danger glow
    if (pulse > 0.5) {
      graphics.circle(0, bounceOffset + 2, size * 1.1);
      graphics.fill({ color: 0xff0000, alpha: (pulse - 0.5) * 0.4 });
    }

    // Bomb body
    graphics.circle(0, bounceOffset + 2, size);
    graphics.fill({ color: urgencyColor });

    // Body outline
    graphics.circle(0, bounceOffset + 2, size);
    graphics.stroke({ width: 2, color: 0x000000 });

    // Highlight (specular)
    graphics.circle(-size / 3, bounceOffset - size / 3, size / 3);
    graphics.fill({ color: 0x555555 });

    // Smaller highlight
    graphics.circle(-size / 2.5, bounceOffset - size / 2.5, size / 6);
    graphics.fill({ color: 0x888888 });

    // Fuse holder (metal ring)
    graphics.circle(0, bounceOffset - size + 2, size / 4);
    graphics.fill({ color: 0x666666 });
    graphics.circle(0, bounceOffset - size + 2, size / 4);
    graphics.stroke({ width: 1, color: 0x444444 });

    // Fuse
    const fuseWave = Math.sin(Date.now() / 150) * 2;
    graphics.moveTo(0, bounceOffset - size);
    graphics.quadraticCurveTo(size / 2 + fuseWave, bounceOffset - size - 6, size / 2, bounceOffset - size - 12);
    graphics.stroke({ width: 3, color: 0x8b4513 });

    // Spark with particles
    const sparkFreq = 150 - pulse * 100; // Faster sparks as timer runs out
    const sparkPhase = Math.sin(Date.now() / sparkFreq);
    const sparkBright = sparkPhase > 0;
    const sparkSize = sparkBright ? 5 + pulse * 3 : 3;
    const sparkColor = pulse > 0.7 ? 0xff2200 : (sparkBright ? 0xffff00 : 0xff6600);

    graphics.circle(size / 2, bounceOffset - size - 12, sparkSize);
    graphics.fill({ color: sparkColor });

    // Spark particles
    if (sparkBright && pulse > 0.3) {
      for (let i = 0; i < 3; i++) {
        const angle = (Date.now() / 100 + i * 2) % (Math.PI * 2);
        const dist = 6 + Math.random() * 4;
        const px = size / 2 + Math.cos(angle) * dist;
        const py = bounceOffset - size - 12 + Math.sin(angle) * dist;
        graphics.circle(px, py, 1.5);
        graphics.fill({ color: 0xffaa00, alpha: 0.8 });
      }
    }
  }

  private addExplosion(data: ExplosionData) {
    const graphics = new Graphics();
    const now = Date.now();

    const pos = gridToPixel(data.gridX, data.gridY);
    graphics.x = pos.x;
    graphics.y = pos.y;

    this.entitiesContainer.addChild(graphics);
    this.explosionSprites.set(data.id, {
      graphics,
      createdAt: now,
      gridX: data.gridX,
      gridY: data.gridY
    });

    // Trigger screen shake based on distance to local player
    this.triggerExplosionShake(data.gridX, data.gridY);
  }

  private triggerExplosionShake(explosionX: number, explosionY: number) {
    if (!this.mySocketId) return;
    const localSprite = this.playerSprites.get(this.mySocketId);
    if (!localSprite) return;

    const dx = localSprite.data.gridX - explosionX;
    const dy = localSprite.data.gridY - explosionY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Shake intensity based on distance (stronger when closer)
    const maxDistance = 6;
    if (distance < maxDistance) {
      const intensity = (1 - distance / maxDistance) * 12;
      this.shakeIntensity = Math.max(this.shakeIntensity, intensity);
    }
  }

  private removeExplosion(id: string) {
    const sprite = this.explosionSprites.get(id);
    if (sprite) {
      this.entitiesContainer.removeChild(sprite.graphics);
      sprite.graphics.destroy();
      this.explosionSprites.delete(id);
    }
  }

  private drawExplosion(graphics: Graphics, age: number) {
    graphics.clear();
    const size = GAME_CONFIG.TILE_SIZE * 0.85;

    // Animation phase (0-1 based on explosion age)
    const maxAge = 500; // EXPLOSION_DURATION
    const phase = Math.min(age / maxAge, 1);

    // Expansion at start, then shrink at end
    const expansionPhase = phase < 0.2 ? phase / 0.2 : 1;
    const shrinkPhase = phase > 0.7 ? (phase - 0.7) / 0.3 : 0;
    const sizeMultiplier = expansionPhase * (1 - shrinkPhase * 0.5);

    // Alpha fade at end
    const alpha = phase > 0.6 ? 1 - ((phase - 0.6) / 0.4) : 1;

    // Flicker effect
    const flicker = 0.85 + Math.random() * 0.15;

    // Outer shockwave ring (expands quickly then fades)
    if (phase < 0.4) {
      const ringPhase = phase / 0.4;
      const ringSize = size * (1.2 + ringPhase * 0.8);
      graphics.circle(0, 0, ringSize);
      graphics.stroke({ width: 4 - ringPhase * 3, color: 0xff8800, alpha: (1 - ringPhase) * 0.6 });
    }

    // Outer flame glow
    const outerSize = size * sizeMultiplier * flicker;
    graphics.circle(0, 0, outerSize);
    graphics.fill({ color: 0xff4400, alpha: 0.5 * alpha });

    // Middle flame
    graphics.circle(0, 0, outerSize * 0.75);
    graphics.fill({ color: 0xff6600, alpha: 0.8 * alpha });

    // Inner flame
    graphics.circle(0, 0, outerSize * 0.55);
    graphics.fill({ color: 0xff9900, alpha: alpha });

    // Hot core
    graphics.circle(0, 0, outerSize * 0.35);
    graphics.fill({ color: 0xffcc00, alpha: alpha });

    // White hot center
    graphics.circle(0, 0, outerSize * 0.2);
    graphics.fill({ color: 0xffffaa, alpha: alpha * 0.9 });

    // Center bright flash (only at start)
    if (phase < 0.15) {
      const flashAlpha = (1 - phase / 0.15);
      graphics.circle(0, 0, outerSize * 0.5);
      graphics.fill({ color: 0xffffff, alpha: flashAlpha * 0.7 });
    }

    // Flame particles
    const particleCount = phase < 0.5 ? 5 : 3;
    for (let i = 0; i < particleCount; i++) {
      const angle = (Date.now() / 50 + i * 1.5) % (Math.PI * 2);
      const dist = (outerSize * 0.4) + Math.sin(Date.now() / 80 + i) * 5;
      const px = Math.cos(angle) * dist;
      const py = Math.sin(angle) * dist;
      const pSize = 3 + Math.random() * 4;
      graphics.circle(px, py, pSize);
      graphics.fill({ color: 0xffaa00, alpha: alpha * 0.7 });
    }
  }

  private update() {
    const now = Date.now();
    this.globalTime = now;

    // Process held keys for continuous movement
    this.processHeldKeys(now);

    // Interpolate player positions and handle animations
    this.playerSprites.forEach((sprite) => {
      sprite.container.x = this.lerp(sprite.container.x, sprite.targetX, 0.25);
      sprite.container.y = this.lerp(sprite.container.y, sprite.targetY, 0.25);

      // Calculate death animation progress
      let deathProgress = 0;
      if (!sprite.data.alive && sprite.deathTime > 0) {
        const deathDuration = 1500; // 1.5 seconds for death animation
        deathProgress = Math.min((now - sprite.deathTime) / deathDuration, 1);
      }

      // Redraw player with effects
      const isStunned = sprite.data.stunnedUntil > now;
      this.drawPlayer(
        sprite.body,
        sprite.data.color,
        sprite.data.alive,
        isStunned,
        sprite.movePhase,
        deathProgress
      );
    });

    // Animate bombs
    this.bombSprites.forEach((sprite) => {
      let bounceOffset = 0;

      // Handle wrap bounce animation (when bomb crosses map border)
      if (sprite.wrapBouncePhase > 0 && sprite.wrapBouncePhase < 2) {
        sprite.wrapBouncePhase += 0.08; // ~400ms total animation

        // Phase 0-1: Exit bounce (squash into wall)
        if (sprite.wrapBouncePhase < 1) {
          const t = sprite.wrapBouncePhase;
          const squash = 1 - Math.sin(t * Math.PI) * 0.4; // 1→0.6→1
          if (sprite.wrapBounceDir === 'x') {
            sprite.graphics.scale.x = squash;
            sprite.graphics.scale.y = 1 + (1 - squash) * 0.3;
          } else {
            sprite.graphics.scale.y = squash;
            sprite.graphics.scale.x = 1 + (1 - squash) * 0.3;
          }
        } else {
          // Phase 1-2: Entry bounce (stretch out from wall)
          // Teleport to new position at phase 1 transition
          if (sprite.wrapBouncePhase >= 1 && sprite.wrapBouncePhase < 1.08) {
            sprite.graphics.x = sprite.targetX;
            sprite.graphics.y = sprite.targetY;
          }

          const t = sprite.wrapBouncePhase - 1;
          const stretch = 1 + Math.sin(t * Math.PI) * 0.3; // 1→1.3→1
          if (sprite.wrapBounceDir === 'x') {
            sprite.graphics.scale.x = stretch;
            sprite.graphics.scale.y = 1 - (stretch - 1) * 0.3;
          } else {
            sprite.graphics.scale.y = stretch;
            sprite.graphics.scale.x = 1 - (stretch - 1) * 0.3;
          }
        }

        // Reset when animation completes
        if (sprite.wrapBouncePhase >= 2) {
          sprite.wrapBouncePhase = 0;
          sprite.wrapBounceDir = null;
          sprite.graphics.scale.set(1, 1);
        }

        // Keep normal flying bounce during wrap
        if (sprite.data.isFlying) {
          sprite.bounceTime += 16;
          const bouncePhase = (sprite.bounceTime % 150) / 150;
          bounceOffset = Math.sin(bouncePhase * Math.PI) * -20;
        }
      } else {
        // Normal animation (no wrap in progress)
        const lerpSpeed = sprite.data.isFlying ? 0.35 : sprite.data.isMoving ? 0.3 : 0.25;
        sprite.graphics.x = this.lerp(sprite.graphics.x, sprite.targetX, lerpSpeed);

        // Calculate bounce offset for flying bombs
        if (sprite.data.isFlying) {
          sprite.bounceTime += 16;
          const bouncePhase = (sprite.bounceTime % 150) / 150;
          bounceOffset = Math.sin(bouncePhase * Math.PI) * -20;
        } else {
          sprite.bounceTime = 0;
        }

        sprite.graphics.y = this.lerp(sprite.graphics.y, sprite.targetY + bounceOffset, lerpSpeed);
      }

      this.drawBomb(sprite.graphics, sprite.pulsePhase, sprite.data.isFlying, bounceOffset);
    });

    // Animate explosions with age-based effects
    this.explosionSprites.forEach((sprite) => {
      const age = now - sprite.createdAt;
      this.drawExplosion(sprite.graphics, age);
    });

    // Update camera with screen shake
    this.updateCamera();

    // Apply screen shake
    if (this.shakeIntensity > 0.5) {
      this.worldContainer.x += (Math.random() - 0.5) * this.shakeIntensity;
      this.worldContainer.y += (Math.random() - 0.5) * this.shakeIntensity;
      this.shakeIntensity *= this.shakeDecay;
      if (this.shakeIntensity < 0.5) {
        this.shakeIntensity = 0;
      }
    }

    // Animate countdown UI
    this.animateCountdown();
  }

  private processHeldKeys(now: number) {
    if (this.currentLobby?.state !== GAME_PHASE.PLAYING) return;
    if (now - this.lastMoveTime < this.moveRepeatDelay) return;

    // Check for movement keys
    let direction: number | null = null;
    if (this.keysHeld.has('ArrowUp') || this.keysHeld.has('KeyW')) {
      direction = DIRECTION.UP;
    } else if (this.keysHeld.has('ArrowDown') || this.keysHeld.has('KeyS')) {
      direction = DIRECTION.DOWN;
    } else if (this.keysHeld.has('ArrowLeft') || this.keysHeld.has('KeyA')) {
      direction = DIRECTION.LEFT;
    } else if (this.keysHeld.has('ArrowRight') || this.keysHeld.has('KeyD')) {
      direction = DIRECTION.RIGHT;
    }

    if (direction !== null && this.callbacks?.onMove) {
      this.callbacks.onMove(direction);
      this.lastMoveTime = now;
    }
  }

  private updateCamera() {
    const containerWidth = this.appContainer?.clientWidth || window.innerWidth;
    const containerHeight = this.appContainer?.clientHeight || window.innerHeight;

    const worldWidth = GAME_CONFIG.GRID_WIDTH * GAME_CONFIG.TILE_SIZE;
    const worldHeight = GAME_CONFIG.GRID_HEIGHT * GAME_CONFIG.TILE_SIZE;

    let targetX: number;
    let targetY: number;

    // If world fits horizontally, center it
    if (worldWidth <= containerWidth) {
      targetX = (containerWidth - worldWidth) / 2;
    } else {
      // Follow player with clamping
      const localSprite = this.mySocketId ? this.playerSprites.get(this.mySocketId) : null;
      if (localSprite) {
        targetX = -localSprite.container.x + containerWidth / 2;
        const maxX = 0;
        const minX = -worldWidth + containerWidth;
        targetX = Math.min(maxX, Math.max(minX, targetX));
      } else {
        targetX = 0;
      }
    }

    // Keep world at TOP (y = 0), not vertically centered
    if (worldHeight <= containerHeight) {
      targetY = 0; // Top aligned
    } else {
      // Follow player with clamping
      const localSprite = this.mySocketId ? this.playerSprites.get(this.mySocketId) : null;
      if (localSprite) {
        targetY = -localSprite.container.y + containerHeight / 2;
        const maxY = 0;
        const minY = -worldHeight + containerHeight;
        targetY = Math.min(maxY, Math.max(minY, targetY));
      } else {
        targetY = 0;
      }
    }

    this.cameraX = this.lerp(this.cameraX, targetX, 0.1);
    this.cameraY = this.lerp(this.cameraY, targetY, 0.1);

    this.worldContainer.x = this.cameraX;
    this.worldContainer.y = this.cameraY;
  }

  private lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
  }

  /**
   * Handle keyboard events from React
   */
  handleKeyDown(event: KeyboardEvent) {
    // Store key as held
    this.keysHeld.add(event.code);

    // Only process game actions during playing phase
    if (this.currentLobby?.state !== GAME_PHASE.PLAYING) {
      // Allow start in lobby
      if (event.code === 'Enter' && event.shiftKey && this.currentLobby?.state === GAME_PHASE.WAITING) {
        this.callbacks?.onStart?.();
      }
      return;
    }

    // Bomb placement (Space)
    if (event.code === 'Space') {
      event.preventDefault();
      this.callbacks?.onBomb?.();
    }

    // Throw (E)
    if (event.code === 'KeyE') {
      event.preventDefault();
      this.callbacks?.onThrow?.();
    }

    // Immediate movement on first key press
    if (this.keysHeld.size === 1) {
      const now = Date.now();
      let direction: number | null = null;

      if (event.code === 'ArrowUp' || event.code === 'KeyW') {
        direction = DIRECTION.UP;
      } else if (event.code === 'ArrowDown' || event.code === 'KeyS') {
        direction = DIRECTION.DOWN;
      } else if (event.code === 'ArrowLeft' || event.code === 'KeyA') {
        direction = DIRECTION.LEFT;
      } else if (event.code === 'ArrowRight' || event.code === 'KeyD') {
        direction = DIRECTION.RIGHT;
      }

      if (direction !== null && this.callbacks?.onMove) {
        this.callbacks.onMove(direction);
        this.lastMoveTime = now;
      }
    }
  }

  handleKeyUp(event: KeyboardEvent) {
    this.keysHeld.delete(event.code);
  }

  /**
   * Handle resize
   */
  resize(width: number, height: number) {
    if (!this.initialized) return;

    this.app.renderer.resize(width, height);

    // Update UI positions
    if (this.statusText) {
      this.statusText.x = width / 2;
    }
    if (this.countdownText) {
      this.countdownText.x = width / 2;
      this.countdownText.y = height / 2;
    }
  }

  /**
   * Cleanup on unmount
   */
  destroy() {
    this.keysHeld.clear();

    // Clear all sprites
    this.playerSprites.forEach((sprite) => {
      sprite.container.destroy();
    });
    this.playerSprites.clear();

    this.bombSprites.forEach((sprite) => {
      sprite.graphics.destroy();
    });
    this.bombSprites.clear();

    this.explosionSprites.forEach((sprite) => {
      sprite.graphics.destroy();
    });
    this.explosionSprites.clear();

    // Destroy PixiJS app
    this.app.destroy(true, { children: true });

    this.initialized = false;
  }
}
