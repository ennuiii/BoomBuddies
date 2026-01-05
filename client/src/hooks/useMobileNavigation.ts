/**
 * Mobile Navigation Hook
 *
 * Manages mobile navigation state for the MobileGameMenu and MobileDrawer.
 * Updated to work with hamburger menu pattern instead of BottomTabBar.
 */

import { useState, useCallback, useEffect, useMemo } from 'react';

export type DrawerContent = 'players' | 'chat' | 'video' | 'settings' | null;

interface MobileNavigationState {
  isMenuOpen: boolean;
  isDrawerOpen: boolean;
  drawerContent: DrawerContent;
  chatBadge: number;
}

interface MobileNavigationActions {
  openMenu: () => void;
  closeMenu: () => void;
  toggleMenu: () => void;
  openDrawer: (content: 'players' | 'chat' | 'video' | 'settings') => void;
  closeDrawer: () => void;
  setChatBadge: (count: number) => void;
  clearChatBadge: () => void;
}

export const useMobileNavigation = (): MobileNavigationState & MobileNavigationActions => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [drawerContent, setDrawerContent] = useState<DrawerContent>(null);
  const [chatBadge, setChatBadgeState] = useState(0);

  // Open hamburger menu
  const openMenu = useCallback(() => {
    setIsMenuOpen(true);
  }, []);

  // Close hamburger menu
  const closeMenu = useCallback(() => {
    setIsMenuOpen(false);
  }, []);

  // Toggle hamburger menu
  const toggleMenu = useCallback(() => {
    setIsMenuOpen(prev => !prev);
  }, []);

  // Open drawer with specific content (closes menu first)
  const openDrawer = useCallback((content: 'players' | 'chat' | 'video' | 'settings') => {
    setIsMenuOpen(false); // Close menu when opening drawer
    setIsDrawerOpen(true);
    setDrawerContent(content);
  }, []);

  // Close drawer
  const closeDrawer = useCallback(() => {
    setIsDrawerOpen(false);
    setDrawerContent(null);
  }, []);

  // Set chat badge count
  const setChatBadge = useCallback((count: number) => {
    setChatBadgeState(Math.max(0, count));
  }, []);

  // Clear chat badge
  const clearChatBadge = useCallback(() => {
    setChatBadgeState(0);
  }, []);

  // Handle escape key to close menu/drawer
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isDrawerOpen) {
          closeDrawer();
        } else if (isMenuOpen) {
          closeMenu();
        }
      }
    },
    [isMenuOpen, isDrawerOpen, closeMenu, closeDrawer]
  );

  // Add keyboard listener
  useEffect(() => {
    if (isMenuOpen || isDrawerOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => {
        document.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [isMenuOpen, isDrawerOpen, handleKeyDown]);

  // Lock body scroll when menu or drawer is open
  useEffect(() => {
    if (isMenuOpen || isDrawerOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isMenuOpen, isDrawerOpen]);

  // Return memoized object to prevent reference changes
  return useMemo(
    () => ({
      isMenuOpen,
      isDrawerOpen,
      drawerContent,
      chatBadge,
      openMenu,
      closeMenu,
      toggleMenu,
      openDrawer,
      closeDrawer,
      setChatBadge,
      clearChatBadge,
    }),
    [
      isMenuOpen,
      isDrawerOpen,
      drawerContent,
      chatBadge,
      openMenu,
      closeMenu,
      toggleMenu,
      openDrawer,
      closeDrawer,
      setChatBadge,
      clearChatBadge,
    ]
  );
};

export default useMobileNavigation;
