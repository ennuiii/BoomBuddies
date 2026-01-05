/**
 * Home Page
 *
 * Landing page with Create Room and Join Room cards.
 * Handles GameBuddies auto-join via URL params.
 */

import React, { useState, useEffect, useRef } from 'react';
import { Users, Plus, LogIn, HelpCircle, Lightbulb, ExternalLink } from 'lucide-react';
import { GAME_META } from '../config/gameMeta';
import { HomeHeader, FloatingLabelInput, JoinFromInviteModal } from '../components/core';
import TutorialCarousel from '../components/TutorialCarousel';
import { getCurrentSession } from '../services/gameBuddiesSession';
import { t } from '../utils/translations';

interface HomePageProps {
  onCreateRoom: (playerName: string, streamerMode?: boolean) => void;
  onJoinRoom: (roomCode: string, playerName: string) => void;
  onJoinWithInvite?: (inviteToken: string, playerName: string) => void;
  isConnecting?: boolean;
  error?: string | null;
}

type ActiveTab = 'create' | 'join';

const HomePage: React.FC<HomePageProps> = ({
  onCreateRoom,
  onJoinRoom,
  onJoinWithInvite,
  isConnecting = false,
  error
}) => {
  const [playerName, setPlayerName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [activeTab, setActiveTab] = useState<ActiveTab>('create');
  const [streamerMode, setStreamerMode] = useState(false);
  const [isFromGameBuddies, setIsFromGameBuddies] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const cardsRef = useRef<HTMLDivElement>(null);

  // Check for invite URL parameter and GameBuddies.io session
  useEffect(() => {
    // Check for invite code in URL
    const urlParams = new URLSearchParams(window.location.search);
    const inviteCode = urlParams.get('invite') || urlParams.get('room') || urlParams.get('join');

    if (inviteCode) {
      // Long codes (>10 chars) are invite tokens - show simplified modal
      if (inviteCode.length > 10) {
        setInviteToken(inviteCode);
        // Clear the URL param to prevent re-triggering on refresh
        window.history.replaceState({}, '', window.location.pathname);
        return;
      }

      // Short codes are regular room codes - use normal join flow
      setRoomCode(inviteCode.toUpperCase());
      setActiveTab('join');
      // Clear the URL param to prevent re-triggering on refresh
      window.history.replaceState({}, '', window.location.pathname);
      return;
    }

    // Check if coming from GameBuddies.io
    const session = getCurrentSession();
    if (session) {
      setIsFromGameBuddies(true);
      // Pre-fill name if available
      if (session.playerName) {
        setPlayerName(session.playerName);
      }
      // Pre-fill streamer mode if set
      if (session.isStreamerMode) {
        setStreamerMode(true);
      }
    }
  }, []);

  // Dynamic positioning for tutorial sidebar (aligns with cards)
  useEffect(() => {
    const updateTutorialPosition = () => {
      if (cardsRef.current) {
        const rect = cardsRef.current.getBoundingClientRect();
        document.documentElement.style.setProperty('--tutorial-top', `${rect.top}px`);
      }
    };

    updateTutorialPosition();
    window.addEventListener('resize', updateTutorialPosition);
    window.addEventListener('scroll', updateTutorialPosition);

    return () => {
      window.removeEventListener('resize', updateTutorialPosition);
      window.removeEventListener('scroll', updateTutorialPosition);
    };
  }, []);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (playerName.trim()) {
      onCreateRoom(playerName.trim(), streamerMode);
    }
  };

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (playerName.trim() && roomCode.trim()) {
      onJoinRoom(roomCode.trim().toUpperCase(), playerName.trim());
    }
  };

  const handleTutorial = () => {
    setShowTutorial(true);
  };

  // Handle join from invite modal
  const handleInviteJoin = (name: string) => {
    if (inviteToken && onJoinWithInvite) {
      onJoinWithInvite(inviteToken, name);
    }
  };

  return (
    <div className="home-page">
      {/* Header */}
      <HomeHeader onTutorial={handleTutorial} />

      {/* GameBuddies Integration Banner */}
      {isFromGameBuddies && (
        <div className="home-gb-banner">
          <ExternalLink className="w-4 h-4" />
          <span>{t('home.gameBuddiesBanner')}</span>
        </div>
      )}

      {/* Hero Section */}
      <div className="home-hero">
        <img
          src={`${import.meta.env.BASE_URL}mascot.webp`}
          alt={GAME_META.mascotAlt}
          className="home-mascot"
        />
        <h1 className="home-title">
          {GAME_META.namePrefix}
          <span className="home-title-accent">{GAME_META.nameAccent}</span>
        </h1>
        <p className="home-tagline">{GAME_META.tagline}</p>
        <p className="home-gb-branding">
          <span className="home-gb-by">by </span>
          <span className="home-gb-game">Game</span>
          <span className="home-gb-buddies">Buddies</span>
          <span className="home-gb-io">.io</span>
        </p>
      </div>

      {/* Error Message */}
      {error && (
        <div className="home-error">
          <p>{error}</p>
        </div>
      )}

      {/* Mobile Tab Switcher */}
      <div className="home-tabs mobile-only">
        <button
          onClick={() => setActiveTab('create')}
          className={`home-tab ${activeTab === 'create' ? 'active' : ''}`}
        >
          <Plus className="w-4 h-4" />
          {t('home.createRoom')}
        </button>
        <button
          onClick={() => setActiveTab('join')}
          className={`home-tab ${activeTab === 'join' ? 'active' : ''}`}
        >
          <LogIn className="w-4 h-4" />
          {t('home.joinRoom')}
        </button>
      </div>

      {/* Cards + Tutorial Sidebar */}
      <div className="home-cards-wrapper">
        <div className="home-cards" ref={cardsRef}>
          {/* Create Room Card */}
          <div className={`card home-card ${activeTab !== 'create' ? 'mobile-hidden' : ''}`}>
          <div className="card-header">
            <Plus className="w-5 h-5" />
            <h2>{t('home.createRoom')}</h2>
          </div>
          <p className="card-description">{t('home.createDescription')}</p>
          <form onSubmit={handleCreate} className="home-form">
            <FloatingLabelInput
              label={t('home.yourName')}
              value={playerName}
              onChange={setPlayerName}
              placeholder={t('home.enterName')}
              maxLength={20}
              required
            />
            <label className="home-checkbox-label">
              <input
                type="checkbox"
                checked={streamerMode}
                onChange={(e) => setStreamerMode(e.target.checked)}
                className="home-checkbox"
              />
              <span className="home-checkbox-text">{t('home.streamerMode')}</span>
            </label>
            <button
              type="submit"
              disabled={isConnecting || !playerName.trim()}
              className="home-btn primary"
            >
              {isConnecting ? t('common.loading') : t('home.createRoom')}
            </button>
          </form>
        </div>

        {/* Join Room Card */}
        <div className={`card home-card ${activeTab !== 'join' ? 'mobile-hidden' : ''}`}>
          <div className="card-header">
            <Users className="w-5 h-5" />
            <h2>{t('home.joinRoom')}</h2>
          </div>
          <p className="card-description">{t('home.joinDescription')}</p>
          <form onSubmit={handleJoin} className="home-form">
            <FloatingLabelInput
              label={t('home.yourName')}
              value={playerName}
              onChange={setPlayerName}
              placeholder={t('home.enterName')}
              maxLength={20}
              required
            />
            <FloatingLabelInput
              label={t('home.roomCode')}
              value={roomCode}
              onChange={(v) => setRoomCode(v.toUpperCase())}
              placeholder={t('home.enterRoomCode')}
              maxLength={6}
              required
            />
            <button
              type="submit"
              disabled={isConnecting || !playerName.trim() || !roomCode.trim()}
              className="home-btn secondary"
            >
              {isConnecting ? t('common.loading') : t('home.joinRoom')}
            </button>
          </form>
        </div>
        </div>

        {/* Tutorial Sidebar - Desktop only */}
        <TutorialCarousel variant="sidebar" />
      </div>

      {/* How to Play - Mobile only (on desktop, TutorialCarousel sidebar is shown instead) */}
      <button className="home-how-to-play mobile-only" onClick={handleTutorial}>
        <HelpCircle className="w-4 h-4" />
        <span>{t('home.howToPlay')}</span>
      </button>

      {/* Tutorial Modal - Mobile */}
      <TutorialCarousel
        variant="modal"
        isOpen={showTutorial}
        onClose={() => setShowTutorial(false)}
      />

      {/* Tip Banner */}
      <div className="home-tip-banner">
        <Lightbulb className="w-4 h-4" />
        <span>{t('home.tip')}</span>
      </div>

      {/* Invite Modal - shown when user clicks an invite link */}
      {inviteToken && (
        <JoinFromInviteModal
          inviteToken={inviteToken}
          onClose={() => setInviteToken(null)}
          onJoin={handleInviteJoin}
          isConnecting={isConnecting}
          error={error}
        />
      )}
    </div>
  );
};

export default HomePage;
