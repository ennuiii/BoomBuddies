/**
 * Game Metadata - Bomberman
 */

export const GAME_META = {
  // Game name (displayed in header)
  name: 'Bomberman',

  // Split name for styled display
  namePrefix: 'Bomber',
  nameAccent: 'man',

  // Short description
  tagline: 'Classic multiplayer bomb action!',

  // Full description
  description: 'Bomberman - Classic multiplayer with power-ups, kick, and throw mechanics.',

  // Mascot image alt text
  mascotAlt: 'Bomberman Mascot',

  // Game namespace (must match server plugin and vite.config.ts base)
  namespace: '/bomberman',

  // Min/max players
  minPlayers: 2,
  maxPlayers: 8,
};
