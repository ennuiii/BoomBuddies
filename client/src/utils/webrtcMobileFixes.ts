/**
 * WebRTC Mobile Fixes - TypeScript Module
 *
 * Fixes mobile video issues with TURN servers, H.264 codec, and optimized constraints.
 *
 * REQUIREMENTS:
 * 1. Add to .env (client-side):
 *    VITE_METERED_USERNAME=your_username
 *    VITE_METERED_PASSWORD=your_password
 *
 * 2. Get free TURN credentials at: https://www.metered.ca/tools/openrelay/
 */

// ============================================================================
// MOBILE DETECTION
// ============================================================================

/**
 * Detect if the current device is mobile
 */
export function isMobileDevice(): boolean {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

/**
 * Detect if the current device is iOS (iPhone, iPad)
 * iOS Safari only supports H.264 codec, not VP8/VP9
 */
export function isIOSDevice(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
         (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

// ============================================================================
// ICE SERVERS (STUN + TURN)
// ============================================================================

/**
 * Get ICE servers configuration with TURN support for mobile cellular
 */
export function getICEServers(): RTCIceServer[] {
  const servers: RTCIceServer[] = [
    // STUN servers (free - works for desktop/WiFi)
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ];

  // Add TURN servers if credentials are configured
  const username = import.meta.env?.VITE_METERED_USERNAME;
  const password = import.meta.env?.VITE_METERED_PASSWORD;

  if (username && password) {
    console.log('[WebRTC] TURN servers configured - Mobile cellular support enabled');

    servers.push(
      {
        urls: 'turn:a.relay.metered.ca:80',
        username: username,
        credential: password
      },
      {
        urls: 'turn:a.relay.metered.ca:80?transport=tcp',
        username: username,
        credential: password
      },
      {
        urls: 'turn:a.relay.metered.ca:443',
        username: username,
        credential: password
      },
      {
        urls: 'turns:a.relay.metered.ca:443?transport=tcp',
        username: username,
        credential: password
      }
    );
  } else {
    console.warn('[WebRTC] No TURN servers configured - Mobile cellular connections will fail!');
    console.warn('[WebRTC] Get free credentials at: https://www.metered.ca/tools/openrelay/');
  }

  return servers;
}

// ============================================================================
// MEDIA CONSTRAINTS
// ============================================================================

/**
 * Get mobile-optimized video constraints
 */
export function getVideoConstraints(deviceId?: string): MediaTrackConstraints {
  const baseConstraints: MediaTrackConstraints = deviceId ? { deviceId: { exact: deviceId } } : {};

  if (isMobileDevice()) {
    return {
      ...baseConstraints,
      width: { ideal: 480, max: 640 },
      height: { ideal: 360, max: 480 },
      frameRate: { ideal: 15, max: 24 }
    };
  } else {
    return {
      ...baseConstraints,
      width: { ideal: 640, max: 1280 },
      height: { ideal: 480, max: 720 },
      frameRate: { ideal: 24, max: 30 }
    };
  }
}

/**
 * Get high-quality audio constraints with noise suppression
 */
export function getAudioConstraints(deviceId?: string): MediaTrackConstraints {
  return {
    deviceId: deviceId ? { exact: deviceId } : undefined,
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
    sampleRate: { ideal: 48000 },
    channelCount: { ideal: 1 }
  };
}

// ============================================================================
// PEER CONNECTION SETUP
// ============================================================================

/**
 * Set H.264 codec preference for iOS compatibility
 */
export function setH264CodecPreference(peerConnection: RTCPeerConnection, peerId: string): void {
  if (!isIOSDevice()) return;

  console.log(`[WebRTC] iOS device detected, setting H.264 codec preference for ${peerId}`);

  try {
    const transceivers = peerConnection.getTransceivers();
    transceivers.forEach(transceiver => {
      if (transceiver.sender.track?.kind === 'video') {
        const capabilities = RTCRtpSender.getCapabilities('video');
        if (capabilities && capabilities.codecs) {
          const h264Codecs = capabilities.codecs.filter(codec =>
            codec.mimeType.toLowerCase().includes('h264')
          );
          const otherCodecs = capabilities.codecs.filter(codec =>
            !codec.mimeType.toLowerCase().includes('h264')
          );

          if (h264Codecs.length > 0) {
            const preferredCodecs = [...h264Codecs, ...otherCodecs];
            transceiver.setCodecPreferences(preferredCodecs);
          }
        }
      }
    });
  } catch (error) {
    console.warn(`[WebRTC] Failed to set H.264 codec preference for ${peerId}:`, error);
  }
}

/**
 * Add enhanced diagnostics to peer connection
 */
export function addEnhancedDiagnostics(peerConnection: RTCPeerConnection, peerId: string): void {
  peerConnection.oniceconnectionstatechange = () => {
    const iceState = peerConnection.iceConnectionState;
    console.log(`[WebRTC] ICE connection state with ${peerId}: ${iceState}`);

    if (iceState === 'failed') {
      console.error(`[WebRTC] ICE connection failed with ${peerId}`);
    }
  };

  peerConnection.onicegatheringstatechange = () => {
    console.log(`[WebRTC] ICE gathering state with ${peerId}: ${peerConnection.iceGatheringState}`);
  };

  peerConnection.onconnectionstatechange = () => {
    console.log(`[WebRTC] Connection state with ${peerId}: ${peerConnection.connectionState}`);
  };
}

// ============================================================================
// MEDIA STREAM HELPERS
// ============================================================================

export interface GetUserMediaResult {
  stream: MediaStream | null;
  hasVideo: boolean;
  hasAudio: boolean;
}

export interface GetUserMediaOptions {
  cameraId?: string;
  microphoneId?: string;
}

/**
 * Get user media with mobile-optimized constraints
 * Tries multiple combinations: video+audio, audio-only, video-only
 */
export async function getUserMediaWithFallback(options: GetUserMediaOptions = {}): Promise<GetUserMediaResult> {
  const { cameraId, microphoneId } = options;

  // Try video + audio
  try {
    console.log('[WebRTC] Attempting video + audio...');
    const stream = await navigator.mediaDevices.getUserMedia({
      video: getVideoConstraints(cameraId),
      audio: getAudioConstraints(microphoneId)
    });
    const hasVideo = stream.getVideoTracks().length > 0;
    const hasAudio = stream.getAudioTracks().length > 0;
    console.log('[WebRTC] Video + Audio enabled');
    return { stream, hasVideo, hasAudio };
  } catch (error) {
    console.log('[WebRTC] Video + Audio failed, trying audio-only...', error);
  }

  // Try audio only
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: getAudioConstraints(microphoneId)
    });
    const hasAudio = stream.getAudioTracks().length > 0;
    console.log('[WebRTC] Audio-only enabled');
    return { stream, hasVideo: false, hasAudio };
  } catch (error) {
    console.log('[WebRTC] Audio failed, trying video-only...', error);
  }

  // Try video only
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: getVideoConstraints(cameraId)
    });
    const hasVideo = stream.getVideoTracks().length > 0;
    console.log('[WebRTC] Video-only enabled');
    return { stream, hasVideo, hasAudio: false };
  } catch (error) {
    console.log('[WebRTC] All media access failed', error);
  }

  return { stream: null, hasVideo: false, hasAudio: false };
}

export default {
  isMobileDevice,
  isIOSDevice,
  getICEServers,
  getVideoConstraints,
  getAudioConstraints,
  setH264CodecPreference,
  addEnhancedDiagnostics,
  getUserMediaWithFallback
};
