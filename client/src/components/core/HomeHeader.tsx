/**
 * Home Header Component
 *
 * Header for the HomePage with logo, settings, and mobile hamburger menu.
 * Desktop: Logo + Settings button
 * Mobile: Logo + Hamburger menu with dropdown
 */

import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Settings, Menu, X, HelpCircle } from 'lucide-react';
import { GAME_META } from '../../config/gameMeta';
import { useIsMobile } from '../../hooks/useIsMobile';
import SettingsModal from './SettingsModal';

interface HomeHeaderProps {
  onTutorial?: () => void;
}

const HomeHeader: React.FC<HomeHeaderProps> = ({ onTutorial }) => {
  const [showSettings, setShowSettings] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const isMobile = useIsMobile();

  const handleOpenSettings = () => {
    setIsMenuOpen(false);
    setShowSettings(true);
  };

  const handleOpenTutorial = () => {
    setIsMenuOpen(false);
    if (onTutorial) {
      onTutorial();
    }
  };

  return (
    <header className="home-header">
      <a href="/" className="home-header-logo">
        <img
          src={`${import.meta.env.BASE_URL}mascot.webp`}
          alt={GAME_META.mascotAlt}
          className="home-header-mascot"
        />
        <div className="home-header-text">
          <span className="home-header-title">
            {GAME_META.namePrefix}
            <span className="home-header-accent">{GAME_META.nameAccent}</span>
          </span>
          <span className="home-header-branding">
            <span className="home-header-by">by </span>
            <span className="home-header-game">Game</span>
            <span className="home-header-buddies">Buddies</span>
            <span className="home-header-io">.io</span>
          </span>
        </div>
      </a>

      {/* Desktop: Settings button */}
      {!isMobile && (
        <button
          onClick={() => setShowSettings(true)}
          className="home-header-settings-btn"
          aria-label="Settings"
          title="Settings"
        >
          <Settings className="w-5 h-5" />
        </button>
      )}

      {/* Mobile: Hamburger menu */}
      {isMobile && (
        <button
          onClick={() => setIsMenuOpen(true)}
          className="home-header-hamburger"
          aria-label="Open menu"
          aria-expanded={isMenuOpen}
        >
          <Menu className="w-5 h-5" />
        </button>
      )}

      {/* Mobile menu overlay */}
      {createPortal(
        <AnimatePresence>
          {isMenuOpen && (
            <>
              {/* Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="home-header-menu-backdrop"
                onClick={() => setIsMenuOpen(false)}
              />

              {/* Menu panel */}
              <motion.div
                initial={{ opacity: 0, y: -20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -20, scale: 0.95 }}
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                className="home-header-menu"
              >
                {/* Header */}
                <div className="home-header-menu-header">
                  <span className="home-header-menu-title">Menu</span>
                  <button
                    onClick={() => setIsMenuOpen(false)}
                    className="home-header-menu-close"
                    aria-label="Close menu"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Menu items */}
                <div className="home-header-menu-items">
                  {/* How to Play */}
                  <button
                    onClick={handleOpenTutorial}
                    className="home-header-menu-item"
                  >
                    <div className="home-header-menu-icon">
                      <HelpCircle className="w-4 h-4" />
                    </div>
                    <div className="home-header-menu-content">
                      <span className="home-header-menu-label">How to Play</span>
                      <span className="home-header-menu-sublabel">Learn the rules</span>
                    </div>
                  </button>

                  {/* Settings */}
                  <button
                    onClick={handleOpenSettings}
                    className="home-header-menu-item"
                  >
                    <div className="home-header-menu-icon">
                      <Settings className="w-4 h-4" />
                    </div>
                    <div className="home-header-menu-content">
                      <span className="home-header-menu-label">Settings</span>
                      <span className="home-header-menu-sublabel">Sound & preferences</span>
                    </div>
                  </button>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>,
        document.body
      )}

      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
    </header>
  );
};

export default HomeHeader;
