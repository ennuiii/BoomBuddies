/**
 * Mobile Overlay Modal
 *
 * Full-screen overlay modal for mobile containing chat, players, video, etc.
 * Uses createPortal to escape stacking contexts.
 */

import React from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, MessageCircle, Users, Video } from 'lucide-react';
import type { ChatMessage, Player, Team } from '../../types';
import ChatWindow from '../lobby/ChatWindow';
import PlayerList from '../lobby/PlayerList';
import { MobileVideoGrid } from '../video';
import type { WebcamPlayer } from '../../config/WebcamConfig';

export type DrawerContent = 'chat' | 'players' | 'video' | null;

interface MobileDrawerProps {
  isOpen: boolean;
  content: DrawerContent;
  onClose: () => void;
  // Chat props
  messages?: ChatMessage[];
  roomCode?: string;
  mySocketId?: string;
  // Player props
  players?: Player[];
  // Video props
  webcamPlayers?: WebcamPlayer[];
  localPlayerName?: string;
  onLeaveVideo?: () => void;
  teams?: Team[];
  className?: string;
}

const MobileDrawer: React.FC<MobileDrawerProps> = ({
  isOpen,
  content,
  onClose,
  messages = [],
  roomCode = '',
  mySocketId = '',
  players = [],
  webcamPlayers = [],
  localPlayerName,
  onLeaveVideo,
  teams = [],
  className = ''
}) => {
  const getTitle = () => {
    switch (content) {
      case 'chat':
        return 'Chat';
      case 'players':
        return 'Players';
      case 'video':
        return 'Video Chat';
      default:
        return '';
    }
  };

  const getIcon = () => {
    switch (content) {
      case 'chat':
        return <MessageCircle className="w-5 h-5" />;
      case 'players':
        return <Users className="w-5 h-5" />;
      case 'video':
        return <Video className="w-5 h-5" />;
      default:
        return null;
    }
  };

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="mobile-overlay-backdrop"
            onClick={onClose}
          />

          {/* Full-screen Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className={`mobile-overlay-modal ${className}`}
          >
            {/* Header */}
            <div className="mobile-overlay-header">
              <div className="mobile-overlay-title">
                {getIcon()}
                <span>{getTitle()}</span>
              </div>
              <button
                onClick={onClose}
                className="mobile-overlay-close"
                aria-label="Close"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Content */}
            <div className="mobile-overlay-content">
              {content === 'chat' && (
                <ChatWindow
                  messages={messages}
                  roomCode={roomCode}
                  mySocketId={mySocketId}
                  mode="sidebar"
                />
              )}

              {content === 'players' && (
                <PlayerList
                  players={players}
                  mySocketId={mySocketId}
                  teams={teams}
                />
              )}

              {content === 'video' && (
                <MobileVideoGrid
                  players={webcamPlayers}
                  localPlayerName={localPlayerName}
                  onLeave={() => {
                    if (onLeaveVideo) onLeaveVideo();
                    onClose();
                  }}
                  teams={teams}
                  mySocketId={mySocketId}
                />
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
};

export default MobileDrawer;
