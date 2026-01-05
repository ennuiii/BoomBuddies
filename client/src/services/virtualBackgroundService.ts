/**
 * Virtual Background Service
 *
 * Implements virtual background replacement using MediaPipe segmentation.
 * Supports blur and image backgrounds.
 *
 * REQUIREMENTS:
 * - Copy /public/wasm/ folder from MediaPipe
 * - Copy /public/models/selfie_segmenter.tflite
 */

import { FilesetResolver, ImageSegmenter } from '@mediapipe/tasks-vision';

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
  kind: 'video' | 'audio';
}

declare const MediaStreamTrackProcessor: {
  prototype: MediaStreamTrackProcessor;
  new (init: MediaStreamTrackProcessorInit): MediaStreamTrackProcessor;
};

declare const MediaStreamTrackGenerator: {
  prototype: MediaStreamTrackGenerator;
  new (init: MediaStreamTrackGeneratorInit): MediaStreamTrackGenerator;
};

export interface VirtualBackgroundConfig {
  model: string;
  segmentationThreshold: number;
  backgroundImageUrl?: string;
  blurAmount?: number;
  useBlur?: boolean;
  edgeSmoothing?: number;
  temporalSmoothing?: number;
  maskBlur?: number;
  erosionSize?: number;
  dilationSize?: number;
  adaptiveThreshold?: boolean;
  hairRefinement?: boolean;
  minContourArea?: number;
}

export const DEFAULT_BACKGROUNDS = [
  { name: 'Office', url: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=1280&h=720&fit=crop' },
  { name: 'Nature', url: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1280&h=720&fit=crop' },
  { name: 'Library', url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=1280&h=720&fit=crop' },
  { name: 'Coffee Shop', url: 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=1280&h=720&fit=crop' },
];

export const DEFAULT_VIRTUAL_BACKGROUND_CONFIG: VirtualBackgroundConfig = {
  model: 'MediaPipe',
  segmentationThreshold: 0.6,
  useBlur: true,
  blurAmount: 25,
  edgeSmoothing: 3,
  temporalSmoothing: 0.7,
  maskBlur: 2,
  erosionSize: 1,
  dilationSize: 1,
  adaptiveThreshold: true,
  hairRefinement: true,
  minContourArea: 1000
};

export class VirtualBackgroundService {
  private config: VirtualBackgroundConfig;
  private isActive = false;
  private trackProcessor: MediaStreamTrackProcessor<VideoFrame> | null = null;
  private trackGenerator: MediaStreamTrackGenerator<VideoFrame> | null = null;
  private processingController: AbortController | null = null;
  private trackWriter: WritableStreamDefaultWriter<VideoFrame> | null = null;
  private imageSegmenter: ImageSegmenter | null = null;
  private isInitialized = false;
  private tempCanvas: OffscreenCanvas | null = null;
  private tempCtx: OffscreenCanvasRenderingContext2D | null = null;
  private outputCanvas: OffscreenCanvas | null = null;
  private outputCtx: OffscreenCanvasRenderingContext2D | null = null;
  private backgroundImage: ImageBitmap | null = null;
  private isProcessing = false;
  private maskCanvas: OffscreenCanvas | null = null;
  private maskCtx: OffscreenCanvasRenderingContext2D | null = null;

  constructor(config: VirtualBackgroundConfig = DEFAULT_VIRTUAL_BACKGROUND_CONFIG) {
    this.config = config;
  }

  public async initialize(): Promise<void> {
    console.log('[VirtualBackground] ========== INITIALIZING ==========');
    const wasmPath = import.meta.env.BASE_URL + 'wasm';
    const modelPath = import.meta.env.BASE_URL + 'models/selfie_segmenter.tflite';
    console.log('[VirtualBackground] WASM path:', wasmPath);
    console.log('[VirtualBackground] Model path:', modelPath);
    console.log('[VirtualBackground] Config:', this.config);

    try {
      console.log('[VirtualBackground] Creating FilesetResolver...');
      const vision = await FilesetResolver.forVisionTasks(wasmPath);
      console.log('[VirtualBackground] FilesetResolver created successfully');

      console.log('[VirtualBackground] Creating ImageSegmenter with GPU delegate...');
      this.imageSegmenter = await ImageSegmenter.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: modelPath,
          delegate: 'GPU'
        },
        runningMode: 'IMAGE',
        outputCategoryMask: true,
        outputConfidenceMasks: true
      });
      console.log('[VirtualBackground] ImageSegmenter created successfully');

      if (this.config.backgroundImageUrl) {
        console.log('[VirtualBackground] Loading background image:', this.config.backgroundImageUrl);
        await this.loadBackgroundImage(this.config.backgroundImageUrl);
        console.log('[VirtualBackground] Background image loaded');
      }

      this.isInitialized = true;
      console.log('[VirtualBackground] ========== INIT COMPLETE ==========');
    } catch (error) {
      console.error('[VirtualBackground] ========== INIT FAILED ==========');
      console.error('[VirtualBackground] Error type:', error instanceof Error ? error.constructor.name : typeof error);
      console.error('[VirtualBackground] Error message:', error instanceof Error ? error.message : String(error));
      console.error('[VirtualBackground] Full error:', error);
      throw error;
    }
  }

  public async setupAndStart(inputStream: MediaStream): Promise<MediaStream> {
    if (!this.isInitialized || !this.imageSegmenter) {
      throw new Error('Service not initialized');
    }
    if (!('MediaStreamTrackProcessor' in window) || !('MediaStreamTrackGenerator' in window)) {
      throw new Error('Browser does not support required APIs');
    }

    const videoTrack = inputStream.getVideoTracks()[0];
    if (!videoTrack) throw new Error('No video track found');

    console.log('[VirtualBackground] setupAndStart - creating processor and generator');
    this.trackProcessor = new MediaStreamTrackProcessor({ track: videoTrack });
    this.trackGenerator = new MediaStreamTrackGenerator({ kind: 'video' });
    this.trackWriter = this.trackGenerator.writable.getWriter();
    this.isActive = true;
    console.log('[VirtualBackground] setupAndStart - starting stream processing');
    this.startStreamProcessing();

    const audioTracks = inputStream.getAudioTracks();
    console.log('[VirtualBackground] setupAndStart - returning stream with generator writable:', !!this.trackGenerator?.writable);
    return new MediaStream([this.trackGenerator, ...audioTracks]);
  }

  private frameCount = 0;

  private async startStreamProcessing(): Promise<void> {
    console.log('[VirtualBackground] startStreamProcessing called, isActive:', this.isActive);
    if (!this.trackProcessor) {
      console.log('[VirtualBackground] startStreamProcessing - no trackProcessor!');
      return;
    }
    this.processingController = new AbortController();
    const reader = this.trackProcessor.readable.getReader();
    console.log('[VirtualBackground] startStreamProcessing - reader obtained, starting loop');

    try {
      while (this.isActive && !this.processingController.signal.aborted) {
        const { done, value: videoFrame } = await reader.read();
        if (done) break;
        await this.processVideoFrame(videoFrame);
      }
    } catch (error) {
      if (!this.processingController.signal.aborted) {
        console.error('[VirtualBackground] Stream error:', error);
      }
    } finally {
      reader.releaseLock();
    }
  }

  private async processVideoFrame(videoFrame: VideoFrame): Promise<void> {
    // Log first few frames to trace flow without spam
    if (this.frameCount < 5) {
      console.log('[VirtualBackground] processVideoFrame #', this.frameCount, '- segmenter:', !!this.imageSegmenter, 'isProcessing:', this.isProcessing);
    }
    this.frameCount++;

    if (!this.imageSegmenter || this.isProcessing) {
      videoFrame.close();
      return;
    }

    try {
      this.isProcessing = true;
      const width = Math.min(videoFrame.codedWidth || videoFrame.displayWidth, 1280);
      const height = Math.min(videoFrame.codedHeight || videoFrame.displayHeight, 720);

      if (!this.tempCanvas || this.tempCanvas.width !== width || this.tempCanvas.height !== height) {
        this.tempCanvas = new OffscreenCanvas(width, height);
        this.tempCtx = this.tempCanvas.getContext('2d');
        this.outputCanvas = new OffscreenCanvas(width, height);
        this.outputCtx = this.outputCanvas.getContext('2d');
        this.maskCanvas = new OffscreenCanvas(width, height);
        this.maskCtx = this.maskCanvas.getContext('2d');
      }

      if (!this.tempCtx || !this.outputCtx) throw new Error('Failed to get 2D context');

      this.tempCtx.drawImage(videoFrame, 0, 0, width, height);
      const result = this.imageSegmenter.segment(this.tempCanvas);
      this.processSegmentationResults(result, width, height);

      if (!this.outputCanvas) throw new Error('Output canvas not available');

      const processedFrame = new VideoFrame(this.outputCanvas, {
        timestamp: videoFrame.timestamp,
        alpha: 'discard'
      });
      await this.handleProcessedFrame(processedFrame);
    } catch (error) {
      console.error('[VirtualBackground] Error processing frame:', error);
    } finally {
      this.isProcessing = false;
      videoFrame.close();
    }
  }

  private processSegmentationResults(result: unknown, width: number, height: number): void {
    if (!this.outputCtx || !this.tempCanvas || !this.maskCtx || !this.maskCanvas) return;

    this.outputCtx.clearRect(0, 0, width, height);
    this.maskCtx.clearRect(0, 0, width, height);

    const typedResult = result as { categoryMask?: { getAsUint8Array: () => Uint8Array } };
    const categoryMask = typedResult.categoryMask;
    if (!categoryMask) return;

    const categoryData = categoryMask.getAsUint8Array();
    const maskImageData = this.maskCtx.createImageData(width, height);

    for (let i = 0; i < categoryData.length; i++) {
      const isPerson = categoryData[i] === 0;
      const pixelIndex = i * 4;
      maskImageData.data[pixelIndex] = 255;
      maskImageData.data[pixelIndex + 1] = 255;
      maskImageData.data[pixelIndex + 2] = 255;
      maskImageData.data[pixelIndex + 3] = isPerson ? 255 : 0;
    }

    this.maskCtx.putImageData(maskImageData, 0, 0);

    // Apply blur to mask edges
    const maskBlur = this.config.maskBlur ?? 1.5;
    if (maskBlur > 0) {
      this.maskCtx.filter = `blur(${maskBlur}px)`;
      this.maskCtx.drawImage(this.maskCanvas, 0, 0);
      this.maskCtx.filter = 'none';
    }

    const enhancedMask = this.maskCtx.getImageData(0, 0, width, height);
    this.applyMaskComposite(enhancedMask, width, height);
  }

  private applyMaskComposite(mask: ImageData, width: number, height: number): void {
    if (!this.outputCtx || !this.tempCanvas) return;

    this.outputCtx.putImageData(mask, 0, 0);
    this.outputCtx.globalCompositeOperation = 'source-in';
    this.outputCtx.drawImage(this.tempCanvas, 0, 0, width, height);
    this.outputCtx.globalCompositeOperation = 'destination-over';

    if (this.config.useBlur && this.tempCanvas) {
      this.outputCtx.filter = `blur(${this.config.blurAmount || 10}px)`;
      this.outputCtx.drawImage(this.tempCanvas, 0, 0, width, height);
      this.outputCtx.filter = 'none';
    } else if (this.backgroundImage) {
      this.outputCtx.drawImage(this.backgroundImage, 0, 0, width, height);
    } else {
      this.outputCtx.fillStyle = '#1a1a1a';
      this.outputCtx.fillRect(0, 0, width, height);
    }

    this.outputCtx.globalCompositeOperation = 'source-over';
  }

  private async loadBackgroundImage(url: string): Promise<void> {
    try {
      const response = await fetch(url, { mode: 'cors' });
      if (!response.ok) throw new Error(`Failed to fetch: ${response.statusText}`);
      const blob = await response.blob();
      this.backgroundImage = await createImageBitmap(blob);
    } catch (error) {
      console.error('[VirtualBackground] Failed to load background:', error);
      this.backgroundImage = null;
    }
  }

  private async handleProcessedFrame(videoFrame: VideoFrame): Promise<void> {
    if (this.trackWriter && this.isActive) {
      try {
        await this.trackWriter.write(videoFrame);
      } catch (error) {
        console.error('[VirtualBackground] Error writing frame:', error);
        videoFrame.close();
      }
    } else {
      videoFrame.close();
    }
  }

  public async updateConfig(newConfig: Partial<VirtualBackgroundConfig>): Promise<void> {
    this.config = { ...this.config, ...newConfig };
    if (newConfig.backgroundImageUrl !== undefined) {
      if (newConfig.backgroundImageUrl) {
        await this.loadBackgroundImage(newConfig.backgroundImageUrl);
      } else {
        this.backgroundImage = null;
      }
    }
  }

  public stopVirtualBackground(): void {
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
    this.stopVirtualBackground();
    this.trackProcessor = null;
    this.trackGenerator = null;
    if (this.imageSegmenter) {
      this.imageSegmenter.close();
      this.imageSegmenter = null;
    }
    if (this.backgroundImage) {
      this.backgroundImage.close();
      this.backgroundImage = null;
    }
    this.maskCanvas = null;
    this.maskCtx = null;
    this.isInitialized = false;
  }

  public isServiceInitialized(): boolean {
    return this.isInitialized;
  }
}
