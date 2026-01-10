/**
 * German Translations
 * TODO: Add your game-specific translations
 */

import type { Translations } from './en';

export const de: Translations = {
  // Common
  common: {
    loading: 'Laden...',
    error: 'Fehler',
    close: 'Schließen',
    save: 'Speichern',
    cancel: 'Abbrechen',
    confirm: 'Bestätigen',
    yes: 'Ja',
    no: 'Nein',
    ok: 'OK',
    back: 'Zurück',
    next: 'Weiter',
    start: 'Start',
    stop: 'Stopp',
    retry: 'Erneut versuchen',
  },

  // Homepage
  home: {
    title: 'Template Spiel',
    createRoom: 'Raum erstellen',
    joinRoom: 'Raum beitreten',
    yourName: 'Dein Name',
    roomCode: 'Raum-Code',
    enterName: 'Gib deinen Namen ein',
    enterRoomCode: 'Gib den Raum-Code ein',
    create: 'Erstellen',
    join: 'Beitreten',
    createDescription: 'Starte ein neues Spiel und lade Freunde ein',
    joinDescription: 'Trete einem bestehenden Raum bei',
    streamerMode: 'Streamer-Modus (Raum-Code verstecken)',
    streamerModeHint: 'Raum-Code für Streaming verstecken',
    howToPlay: 'Spielanleitung',
    tip: 'Tipp: Teile deinen Raum-Code mit Freunden, um zusammen zu spielen!',
    gameBuddiesBanner: 'Spielen über GameBuddies.io',
  },

  // Header
  header: {
    settings: 'Einstellungen',
    openMenu: 'Menü öffnen',
    closeMenu: 'Menü schließen',
    menu: 'Menü',
    howToPlay: 'Spielanleitung',
    learnTheRules: 'Lerne die Regeln',
    soundAndPreferences: 'Ton & Einstellungen',
  },

  // Lobby
  lobby: {
    waitingForPlayers: 'Warte auf Spieler...',
    players: 'Spieler',
    chat: 'Chat',
    settings: 'Einstellungen',
    startGame: 'Spiel starten',
    leaveRoom: 'Raum verlassen',
    copyLink: 'Link kopieren',
    linkCopied: 'Link kopiert!',
    host: 'Host',
    minPlayersRequired: 'Mindestens {min} Spieler erforderlich',
    shareCode: 'Code teilen',
    waitingForHost: 'Warte auf Host...',
  },

  // Game
  game: {
    round: 'Runde',
    score: 'Punkte',
    yourTurn: 'Du bist dran',
    waitingForOthers: 'Warte auf andere Spieler...',
    gameOver: 'Spiel vorbei',
    winner: 'Gewinner',
    playAgain: 'Nochmal spielen',
    returnToLobby: 'Zurück zur Lobby',
  },

  // Chat
  chat: {
    typeMessage: 'Nachricht eingeben...',
    send: 'Senden',
    noMessages: 'Noch keine Nachrichten',
  },

  // Settings
  settings: {
    title: 'Einstellungen',
    general: 'Allgemein',
    theme: 'Design',
    themeDark: 'Dunkel',
    themeLight: 'Hell',
    audio: 'Audio',
    video: 'Video',
    language: 'Sprache',
    music: 'Musik',
    soundEffects: 'Soundeffekte',
    backgroundMusic: 'Hintergrundmusik',
    volume: 'Lautstärke',
    camera: 'Kamera',
    microphone: 'Mikrofon',
    virtualBackground: 'Virtueller Hintergrund',
    videoDescription: 'Konfiguriere deine Kamera- und Mikrofoneinstellungen.',
    close: 'Einstellungen schließen',
    on: 'AN',
    off: 'AUS',
  },

  // Game Header
  gameHeader: {
    room: 'Raum',
    copyRoomLink: 'Raumlink kopieren',
    copyInviteLink: 'Einladungslink kopieren',
    streamerMode: 'Streamer-Modus',
    waitingForPlayers: 'Warte auf Spieler',
    inProgress: 'Läuft',
    gameOver: 'Spiel vorbei',
    settings: 'Einstellungen',
    leave: 'Verlassen',
  },

  // Invite Modal
  invite: {
    title: 'Du bist eingeladen!',
    subtitle: 'Gib deinen Namen ein, um dem Spiel beizutreten',
    joinGame: 'Spiel beitreten',
  },

  // Errors
  errors: {
    connectionLost: 'Verbindung verloren',
    roomNotFound: 'Raum nicht gefunden',
    roomFull: 'Raum ist voll',
    invalidName: 'Bitte gib einen gültigen Namen ein',
    invalidRoomCode: 'Bitte gib einen gültigen Raum-Code ein',
  },
};
