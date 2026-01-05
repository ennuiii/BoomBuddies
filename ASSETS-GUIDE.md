# GameBuddies Asset Setup Guide

This guide explains how to set up audio files, tutorial images, and mascot images for GameBuddies games.

---

## Quick Reference

| Asset Type | Location | Naming |
|------------|----------|--------|
| Background Music | `client/public/music/background.mp3` | `background.mp3` |
| Sound Effects | `client/public/music/` | `win.mp3`, `lose.mp3`, `type1-6.wav` |
| Tutorial Images | `client/public/tutorial/` | `1.webp`, `2.webp`, `3.webp`, `4.webp` |
| Mascot | `client/public/mascot.png` | `mascot.png` |

---

## 1. Audio Files

### Folder Structure

```
client/public/
└── music/
    ├── background.mp3      # REQUIRED - Main background music
    ├── win.mp3             # Victory sound
    ├── lose.mp3            # Defeat sound
    ├── countdown.mp3       # Round countdown
    ├── startjoin.mp3       # Player joins lobby
    ├── type1.wav           # Typewriter sound 1
    ├── type2.wav           # Typewriter sound 2
    ├── type3.wav           # Typewriter sound 3
    ├── type4.wav           # Typewriter sound 4
    ├── type5.wav           # Typewriter sound 5
    └── type6.wav           # Typewriter sound 6
```

### File Specifications

| File | Format | Purpose | Volume Default |
|------|--------|---------|----------------|
| `background.mp3` | MP3/OGG | Loops during gameplay | 0.1 - 0.3 |
| `win.mp3` | MP3 | Plays on victory | 0.5 |
| `lose.mp3` | MP3 | Plays on defeat | 0.5 |
| `countdown.mp3` | MP3 | Round start countdown | 0.5 |
| `type1-6.wav` | WAV | Random key press sounds | 0.3 |

### Typewriter Effect

For games with text input, add 6 typing sound variants:
- `type1.wav`, `type2.wav`, `type3.wav`, `type4.wav`, `type5.wav`, `type6.wav`

The sound manager randomly selects one per keypress for natural variation.

### Audio Manager Implementation

Create these files in your game:

**`client/src/utils/backgroundMusic.ts`**
```typescript
class BackgroundMusicManager {
  private audio: HTMLAudioElement | null = null;
  private enabled: boolean = true;
  private volume: number = 0.1;

  constructor() {
    this.loadMusic();
  }

  private loadMusic() {
    const baseUrl = import.meta.env.BASE_URL || '/';
    this.audio = new Audio(`${baseUrl}music/background.mp3`);
    this.audio.loop = true;
    this.audio.volume = this.volume;
  }

  play() {
    if (!this.enabled || !this.audio) return;
    this.audio.play().catch(() => {});
  }

  stop() {
    this.audio?.pause();
    if (this.audio) this.audio.currentTime = 0;
  }

  setEnabled(enabled: boolean) { this.enabled = enabled; }
  setVolume(vol: number) {
    this.volume = vol;
    if (this.audio) this.audio.volume = vol;
  }
}

export const backgroundMusic = new BackgroundMusicManager();
```

**`client/src/utils/soundEffects.ts`**
```typescript
type SoundType = 'win' | 'lose' | 'countdown' | 'type';

class SoundEffectsManager {
  private sounds: Map<string, HTMLAudioElement> = new Map();
  private enabled: boolean = true;
  private volume: number = 0.5;

  constructor() {
    this.loadSounds();
  }

  private loadSounds() {
    const baseUrl = import.meta.env.BASE_URL || '/';
    const files = ['win', 'lose', 'countdown'];

    files.forEach(name => {
      const audio = new Audio(`${baseUrl}music/${name}.mp3`);
      audio.volume = this.volume;
      this.sounds.set(name, audio);
    });

    // Load typewriter sounds
    for (let i = 1; i <= 6; i++) {
      const audio = new Audio(`${baseUrl}music/type${i}.wav`);
      audio.volume = this.volume;
      this.sounds.set(`type${i}`, audio);
    }
  }

  play(type: SoundType) {
    if (!this.enabled) return;

    let sound: HTMLAudioElement | undefined;

    if (type === 'type') {
      // Random typewriter sound
      const num = Math.floor(Math.random() * 6) + 1;
      sound = this.sounds.get(`type${num}`);
    } else {
      sound = this.sounds.get(type);
    }

    if (sound) {
      sound.currentTime = 0;
      sound.play().catch(() => {});
    }
  }

  setEnabled(enabled: boolean) { this.enabled = enabled; }
  setVolume(vol: number) {
    this.volume = vol;
    this.sounds.forEach(s => s.volume = vol);
  }
}

export const soundEffects = new SoundEffectsManager();
```

---

## 2. Tutorial Images

### Folder Structure

```
client/public/
└── tutorial/
    ├── 1.webp    # Slide 1 (welcome/intro)
    ├── 2.webp    # Slide 2 (gameplay)
    ├── 3.webp    # Slide 3 (features)
    └── 4.webp    # Slide 4 (tips)
```

### File Specifications

| Rule | Value |
|------|-------|
| Naming | Sequential numbers: `1`, `2`, `3`, `4`, `5` |
| Format | `.webp` preferred, `.png` as fallback |
| Count | 4-5 slides recommended |

### Tutorial Configuration

The template uses **image-based** tutorials. Update `TutorialCarousel.tsx` with your game's content:

```typescript
const slides = [
  {
    image: `${import.meta.env.BASE_URL}tutorial/1.webp`,
    title: 'Welcome to YourGame!',
    description: 'Learn how to play in just a few steps.'
  },
  {
    image: `${import.meta.env.BASE_URL}tutorial/2.webp`,
    title: 'How to Play',
    description: 'Explain the core gameplay here.'
  },
  {
    image: `${import.meta.env.BASE_URL}tutorial/3.webp`,
    title: 'Special Features',
    description: 'Highlight unique game features.'
  },
  {
    image: `${import.meta.env.BASE_URL}tutorial/4.webp`,
    title: 'Tips & Tricks',
    description: 'Pro tips for winning.'
  },
];
```

Just replace the images in `client/public/tutorial/` and update the titles/descriptions.

---

## 3. Mascot Image

### Location

```
client/public/
└── mascot.png    # or mascot.webp
```

### Configuration

Update `client/src/config/gameMeta.ts`:

```typescript
export const GAME_META = {
  name: 'Your Game Name',
  mascotAlt: 'Your Game Mascot',  // Alt text for accessibility
  // ... other config
};
```

### Usage in Components

```typescript
import { GAME_META } from '../config/gameMeta';

// In JSX:
<img
  src={`${import.meta.env.BASE_URL}mascot.png`}
  alt={GAME_META.mascotAlt}
  className="mascot"
/>
```

---

## 4. Path Resolution

All asset paths MUST use Vite's `BASE_URL` for production builds:

```typescript
// CORRECT
`${import.meta.env.BASE_URL}music/background.mp3`
`${import.meta.env.BASE_URL}tutorial/1.webp`
`${import.meta.env.BASE_URL}mascot.png`

// WRONG - breaks in production
'./music/background.mp3'
'/music/background.mp3'
```

---

## 5. Setup Checklist

### Audio
- [ ] Create `client/public/music/` folder
- [ ] Add `background.mp3`
- [ ] Add `win.mp3` and `lose.mp3`
- [ ] (Optional) Add `type1.wav` through `type6.wav` for typing sounds
- [ ] Create `client/src/utils/backgroundMusic.ts`
- [ ] Create `client/src/utils/soundEffects.ts`
- [ ] Import and use in `App.tsx`

### Tutorial
- [ ] Create `client/public/tutorial/` folder
- [ ] Add `1.webp`, `2.webp`, `3.webp`, `4.webp`
- [ ] Update slides array in `TutorialCarousel.tsx`

### Mascot
- [ ] Add `client/public/mascot.png`
- [ ] Set `mascotAlt` in `gameMeta.ts`

---

## 6. File Format Recommendations

| Asset | Format | Why |
|-------|--------|-----|
| Background Music | MP3 | Universal browser support, good compression |
| Sound Effects | WAV | No decoding latency, better for short clips |
| Tutorial Images | WebP | Smaller file size, good quality |
| Mascot | PNG | Transparency support, sharp edges |
