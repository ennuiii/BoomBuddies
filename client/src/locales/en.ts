/**
 * English Translations
 * TODO: Add your game-specific translations
 */

export const en = {
  // Common
  common: {
    loading: 'Loading...',
    error: 'Error',
    close: 'Close',
    save: 'Save',
    cancel: 'Cancel',
    confirm: 'Confirm',
    yes: 'Yes',
    no: 'No',
    ok: 'OK',
    back: 'Back',
    next: 'Next',
    start: 'Start',
    stop: 'Stop',
    retry: 'Retry',
  },

  // Homepage
  home: {
    title: 'Template Game',
    createRoom: 'Create Room',
    joinRoom: 'Join Room',
    yourName: 'Your Name',
    roomCode: 'Room Code',
    enterName: 'Enter your name',
    enterRoomCode: 'Enter room code',
    create: 'Create',
    join: 'Join',
    createDescription: 'Start a new game and invite friends',
    joinDescription: 'Join an existing room with a code',
    streamerMode: 'Streamer Mode (hide room code)',
    streamerModeHint: 'Hide room code for streaming',
    howToPlay: 'How to Play',
    tip: 'Tip: Share your room code with friends to play together!',
    gameBuddiesBanner: 'Playing via GameBuddies.io',
  },

  // Header
  header: {
    settings: 'Settings',
    openMenu: 'Open menu',
    closeMenu: 'Close menu',
    menu: 'Menu',
    howToPlay: 'How to Play',
    learnTheRules: 'Learn the rules',
    soundAndPreferences: 'Sound & preferences',
  },

  // Lobby
  lobby: {
    waitingForPlayers: 'Waiting for players...',
    players: 'Players',
    chat: 'Chat',
    settings: 'Settings',
    startGame: 'Start Game',
    leaveRoom: 'Leave Room',
    copyLink: 'Copy Link',
    linkCopied: 'Link copied!',
    host: 'Host',
    minPlayersRequired: 'Minimum {min} players required',
    shareCode: 'Share Code',
    waitingForHost: 'Waiting for host to start...',
  },

  // Game
  game: {
    round: 'Round',
    score: 'Score',
    yourTurn: 'Your Turn',
    waitingForOthers: 'Waiting for other players...',
    gameOver: 'Game Over',
    winner: 'Winner',
    playAgain: 'Play Again',
    returnToLobby: 'Return to Lobby',
  },

  // Chat
  chat: {
    title: 'Chat',
    typeMessage: 'Type a message...',
    send: 'Send',
    sendMessage: 'Send message',
    closeChat: 'Close chat',
    noMessages: 'No messages yet',
    emptyHint: 'Say hello to your teammates!',
    slowDown: 'Slow down...',
  },

  // Player List
  playerList: {
    title: 'Players',
    you: 'You',
    host: 'Host',
    premium: 'Premium',
    pro: 'Pro',
    kick: 'Kick',
    kickPlayer: 'Kick player',
    cancel: 'Cancel',
  },

  // Settings
  settings: {
    title: 'Settings',
    general: 'General',
    theme: 'Theme',
    themeDark: 'Dark',
    themeLight: 'Light',
    audio: 'Audio',
    video: 'Video',
    language: 'Language',
    music: 'Music',
    soundEffects: 'Sound Effects',
    backgroundMusic: 'Background Music',
    volume: 'Volume',
    camera: 'Camera',
    microphone: 'Microphone',
    virtualBackground: 'Virtual Background',
    videoDescription: 'Configure your camera and microphone settings.',
    close: 'Close settings',
    on: 'ON',
    off: 'OFF',
  },

  // Game Header
  gameHeader: {
    room: 'Room',
    copyRoomLink: 'Copy room link',
    copyInviteLink: 'Copy invite link',
    streamerMode: 'Streamer Mode',
    waitingForPlayers: 'Waiting for players',
    inProgress: 'In Progress',
    gameOver: 'Game Over',
    settings: 'Settings',
    leave: 'Leave',
  },

  // Invite Modal
  invite: {
    title: "You're Invited!",
    subtitle: 'Enter your name to join the game',
    joinGame: 'Join Game',
  },

  // Errors
  errors: {
    connectionLost: 'Connection lost',
    roomNotFound: 'Room not found',
    roomFull: 'Room is full',
    invalidName: 'Please enter a valid name',
    invalidRoomCode: 'Please enter a valid room code',
  },
};

export type Translations = typeof en;
