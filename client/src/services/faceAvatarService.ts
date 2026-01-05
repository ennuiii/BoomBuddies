/**
 * Face Avatar Service
 *
 * Implements face avatar replacement using MediaPipe Face Landmarker.
 * Replaces the user's face with an animated avatar.
 *
 * REQUIREMENTS:
 * - Copy /public/wasm/ folder from MediaPipe
 * - Copy /public/models/face_landmarker.task
 */

import { FilesetResolver, FaceLandmarker } from '@mediapipe/tasks-vision';

// Type declarations for MediaStreamTrackProcessor API
interface MediaStreamTrackProcessor<T = VideoFrame> {
  readable: ReadableStream<T>;
}

interface MediaStreamTrackProcessorInit {
  track: MediaStreamTrack;
}

interface MediaStreamTrackGenerator<T = VideoFrame> extends MediaStreamTrack {
  writable: WritableStream<T>;
}

interface MediaStreamTrackGeneratorInit {
  kind: string;
}

declare const MediaStreamTrackProcessor: {
  prototype: MediaStreamTrackProcessor;
  new (init: MediaStreamTrackProcessorInit): MediaStreamTrackProcessor;
};

declare const MediaStreamTrackGenerator: {
  prototype: MediaStreamTrackGenerator;
  new (init: MediaStreamTrackGeneratorInit): MediaStreamTrackGenerator;
};

export interface FaceAvatarConfig {
  avatarType: 'raccoon' | 'robot' | 'alien' | 'cat' | 'custom' | 'sphere' | 'cube' | 'ring' | 'triangle';
  avatarColor: string;
  avatarSize: number;
  trackingSmoothing: number;
  enableBlendshapes: boolean;
  expressionIntensity: number;
  customModelUrl?: string;
}

export const DEFAULT_AVATAR_CONFIG: FaceAvatarConfig = {
  avatarType: 'raccoon',
  avatarColor: '#4F46E5',
  avatarSize: 40,
  trackingSmoothing: 0.8,
  enableBlendshapes: true,
  expressionIntensity: 1.2
};

export class FaceAvatarService {
  private config: FaceAvatarConfig;
  private isActive = false;
  private trackProcessor: MediaStreamTrackProcessor<VideoFrame> | null = null;
  private trackGenerator: MediaStreamTrackGenerator<VideoFrame> | null = null;
  private processingController: AbortController | null = null;
  private trackWriter: WritableStreamDefaultWriter<VideoFrame> | null = null;
  private faceLandmarker: FaceLandmarker | null = null;
  private isInitialized = false;
  private tempCanvas: OffscreenCanvas | null = null;
  private tempCtx: OffscreenCanvasRenderingContext2D | null = null;
  private outputCanvas: OffscreenCanvas | null = null;
  private outputCtx: OffscreenCanvasRenderingContext2D | null = null;
  private isProcessing = false;

  constructor(config: FaceAvatarConfig = DEFAULT_AVATAR_CONFIG) {
    this.config = config;
  }

  public async initialize(): Promise<void> {
    console.log('[FaceAvatar] Initializing Face Avatar Service...');

    try {
      const vision = await FilesetResolver.forVisionTasks(import.meta.env.BASE_URL + 'wasm');

      this.faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: import.meta.env.BASE_URL + 'models/face_landmarker.task',
          delegate: 'GPU'
        },
        runningMode: 'IMAGE',
        numFaces: 1,
        outputFaceBlendshapes: this.config.enableBlendshapes,
        outputFacialTransformationMatrixes: true
      });

      this.isInitialized = true;
      console.log('[FaceAvatar] Initialization complete');
    } catch (error) {
      console.error('[FaceAvatar] Initialization failed:', error);
      throw error;
    }
  }

  public async setupAndStart(inputStream: MediaStream): Promise<MediaStream> {
    if (!this.isInitialized || !this.faceLandmarker) {
      throw new Error('Service not initialized');
    }
    if (!('MediaStreamTrackProcessor' in window) || !('MediaStreamTrackGenerator' in window)) {
      throw new Error('Browser does not support required APIs');
    }

    const videoTrack = inputStream.getVideoTracks()[0];
    if (!videoTrack) throw new Error('No video track found');

    this.trackProcessor = new MediaStreamTrackProcessor({ track: videoTrack });
    this.trackGenerator = new MediaStreamTrackGenerator({ kind: 'video' });
    this.trackWriter = this.trackGenerator.writable.getWriter();
    this.isActive = true;
    this.startStreamProcessing();

    const audioTracks = inputStream.getAudioTracks();
    return new MediaStream([this.trackGenerator, ...audioTracks]);
  }

  private async startStreamProcessing(): Promise<void> {
    if (!this.trackProcessor) return;
    this.processingController = new AbortController();
    const reader = this.trackProcessor.readable.getReader();

    try {
      while (this.isActive && !this.processingController.signal.aborted) {
        const { done, value: videoFrame } = await reader.read();
        if (done) break;
        await this.processVideoFrame(videoFrame);
      }
    } catch (error) {
      if (!this.processingController.signal.aborted) {
        console.error('[FaceAvatar] Stream error:', error);
      }
    } finally {
      reader.releaseLock();
    }
  }

  private async processVideoFrame(videoFrame: VideoFrame): Promise<void> {
    if (!this.faceLandmarker || this.isProcessing) {
      videoFrame.close();
      return;
    }

    try {
      this.isProcessing = true;
      const width = videoFrame.codedWidth || videoFrame.displayWidth;
      const height = videoFrame.codedHeight || videoFrame.displayHeight;

      if (!this.tempCanvas || this.tempCanvas.width !== width || this.tempCanvas.height !== height) {
        this.tempCanvas = new OffscreenCanvas(width, height);
        this.tempCtx = this.tempCanvas.getContext('2d');
        this.outputCanvas = new OffscreenCanvas(width, height);
        this.outputCtx = this.outputCanvas.getContext('2d');
      }

      if (!this.tempCtx || !this.outputCtx) throw new Error('Failed to get 2D context');

      this.tempCtx.drawImage(videoFrame, 0, 0, width, height);
      const result = this.faceLandmarker.detect(this.tempCanvas);

      // Draw original frame as background
      this.outputCtx.drawImage(this.tempCanvas, 0, 0, width, height);

      // Draw avatar over detected face
      if (result.faceLandmarks && result.faceLandmarks.length > 0) {
        this.drawAvatar(result.faceLandmarks[0], width, height);
      }

      if (!this.outputCanvas) throw new Error('Output canvas not available');

      const processedFrame = new VideoFrame(this.outputCanvas, {
        timestamp: videoFrame.timestamp,
        alpha: 'discard'
      });
      await this.handleProcessedFrame(processedFrame);
    } catch (error) {
      console.error('[FaceAvatar] Error processing frame:', error);
    } finally {
      this.isProcessing = false;
      videoFrame.close();
    }
  }

  private drawAvatar(landmarks: { x: number; y: number; z: number }[], width: number, height: number): void {
    if (!this.outputCtx) return;

    // Calculate face bounding box from landmarks
    let minX = 1, maxX = 0, minY = 1, maxY = 0;
    for (const landmark of landmarks) {
      minX = Math.min(minX, landmark.x);
      maxX = Math.max(maxX, landmark.x);
      minY = Math.min(minY, landmark.y);
      maxY = Math.max(maxY, landmark.y);
    }

    const centerX = (minX + maxX) / 2 * width;
    const centerY = (minY + maxY) / 2 * height;
    const faceWidth = (maxX - minX) * width * 1.3;
    const faceHeight = (maxY - minY) * height * 1.3;

    // Draw simple colored circle as avatar placeholder
    // TODO: Replace with your custom avatar rendering
    this.outputCtx.fillStyle = this.config.avatarColor;
    this.outputCtx.beginPath();
    this.outputCtx.ellipse(centerX, centerY, faceWidth / 2, faceHeight / 2, 0, 0, Math.PI * 2);
    this.outputCtx.fill();

    // Draw eyes
    const eyeSize = faceWidth * 0.08;
    const eyeY = centerY - faceHeight * 0.1;
    const leftEyeX = centerX - faceWidth * 0.15;
    const rightEyeX = centerX + faceWidth * 0.15;

    this.outputCtx.fillStyle = 'white';
    this.outputCtx.beginPath();
    this.outputCtx.arc(leftEyeX, eyeY, eyeSize, 0, Math.PI * 2);
    this.outputCtx.fill();
    this.outputCtx.beginPath();
    this.outputCtx.arc(rightEyeX, eyeY, eyeSize, 0, Math.PI * 2);
    this.outputCtx.fill();

    // Draw pupils
    this.outputCtx.fillStyle = 'black';
    this.outputCtx.beginPath();
    this.outputCtx.arc(leftEyeX, eyeY, eyeSize * 0.5, 0, Math.PI * 2);
    this.outputCtx.fill();
    this.outputCtx.beginPath();
    this.outputCtx.arc(rightEyeX, eyeY, eyeSize * 0.5, 0, Math.PI * 2);
    this.outputCtx.fill();
  }

  private async handleProcessedFrame(videoFrame: VideoFrame): Promise<void> {
    if (this.trackWriter && this.isActive) {
      try {
        await this.trackWriter.write(videoFrame);
      } catch (error) {
        console.error('[FaceAvatar] Error writing frame:', error);
        videoFrame.close();
      }
    } else {
      videoFrame.close();
    }
  }

  public updateConfig(newConfig: Partial<FaceAvatarConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  public stopFaceAvatar(): void {
    this.isActive = false;
    if (this.processingController) {
      this.processingController.abort();
      this.processingController = null;
    }
    if (this.trackWriter) {
      try { this.trackWriter.releaseLock(); } catch (e) { /* ignore */ }
      this.trackWriter = null;
    }
  }

  public dispose(): void {
    this.stopFaceAvatar();
    this.trackProcessor = null;
    this.trackGenerator = null;
    if (this.faceLandmarker) {
      this.faceLandmarker.close();
      this.faceLandmarker = null;
    }
    this.tempCanvas = null;
    this.tempCtx = null;
    this.outputCanvas = null;
    this.outputCtx = null;
    this.isInitialized = false;
  }

  public isServiceInitialized(): boolean {
    return this.isInitialized;
  }
}
