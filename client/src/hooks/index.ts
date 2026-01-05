/**
 * Hooks Index
 *
 * Central export for all custom hooks.
 */

// Main game client hook
export { useGameBuddiesClient } from './useGameBuddiesClient';
export type {
  UseGameBuddiesClientOptions,
  UseGameBuddiesClientResult,
  RegisterGameEventsHelpers,
} from './useGameBuddiesClient';

// Device detection hooks
export { useIsMobile, useDeviceType, useOrientation, useHasTouch } from './useIsMobile';

// Mobile navigation hook
export { useMobileNavigation } from './useMobileNavigation';
export type { DrawerContent } from './useMobileNavigation';

// Video hooks
export { useVideoKeyboardShortcuts } from './useVideoKeyboardShortcuts';
export {
  useVideoPreferences,
  getPopupLayoutPreference,
  savePopupLayoutPreference,
} from './useVideoPreferences';

// Mobile keyboard hook
export { useKeyboardHeight } from './useKeyboardHeight';

// Audio hooks
export { useTypewriterSound } from './useTypewriterSound';
