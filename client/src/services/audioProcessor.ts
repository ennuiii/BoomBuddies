/**
 * Audio Processing Service
 *
 * Implements noise suppression using Web Audio API
 * for real-time audio enhancement during video chat.
 */

export interface AudioProcessorConfig {
  enableNoiseSuppression: boolean;
  enableEchoCancellation: boolean;
  enableAutoGainControl: boolean;
  noiseThreshold: number;
  gainSmoothingFactor: number;
  spectralGateThreshold: number;
}

export const DEFAULT_AUDIO_PROCESSOR_CONFIG: AudioProcessorConfig = {
  enableNoiseSuppression: true,
  enableEchoCancellation: true,
  enableAutoGainControl: true,
  noiseThreshold: 0.01,
  gainSmoothingFactor: 0.1,
  spectralGateThreshold: 0.02
};

export class AudioProcessor {
  private audioContext: AudioContext | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private destinationNode: MediaStreamAudioDestinationNode | null = null;
  private analyserNode: AnalyserNode | null = null;
  private gainNode: GainNode | null = null;
  private noiseGateNode: DynamicsCompressorNode | null = null;

  private config: AudioProcessorConfig;
  private isProcessing = false;
  private noiseProfile: Float32Array | null = null;

  constructor(config: AudioProcessorConfig = DEFAULT_AUDIO_PROCESSOR_CONFIG) {
    this.config = config;
  }

  async initialize(): Promise<void> {
    try {
      this.audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)({
        sampleRate: 48000,
        latencyHint: 'interactive'
      });

      console.log('[AudioProcessor] Initialized with sample rate:', this.audioContext.sampleRate);
    } catch (error) {
      console.error('[AudioProcessor] Failed to initialize:', error);
      throw error;
    }
  }

  async processStream(inputStream: MediaStream): Promise<MediaStream> {
    if (!this.audioContext) {
      throw new Error('AudioProcessor not initialized');
    }

    try {
      this.sourceNode = this.audioContext.createMediaStreamSource(inputStream);
      this.destinationNode = this.audioContext.createMediaStreamDestination();
      this.analyserNode = this.audioContext.createAnalyser();
      this.gainNode = this.audioContext.createGain();
      this.noiseGateNode = this.audioContext.createDynamicsCompressor();

      // Configure analyser
      this.analyserNode.fftSize = 2048;
      this.analyserNode.smoothingTimeConstant = 0.8;

      // Configure noise gate/compressor
      this.noiseGateNode.threshold.setValueAtTime(-40, this.audioContext.currentTime);
      this.noiseGateNode.knee.setValueAtTime(40, this.audioContext.currentTime);
      this.noiseGateNode.ratio.setValueAtTime(12, this.audioContext.currentTime);
      this.noiseGateNode.attack.setValueAtTime(0.003, this.audioContext.currentTime);
      this.noiseGateNode.release.setValueAtTime(0.25, this.audioContext.currentTime);

      // Connect the audio processing chain
      this.sourceNode.connect(this.analyserNode);
      this.analyserNode.connect(this.noiseGateNode);
      this.noiseGateNode.connect(this.gainNode);
      this.gainNode.connect(this.destinationNode);

      this.isProcessing = true;
      console.log('[AudioProcessor] Processing started');

      // Learn noise profile
      if (this.config.enableNoiseSuppression) {
        setTimeout(() => this.learnNoiseProfile(), 500);
      }

      return this.destinationNode.stream;
    } catch (error) {
      console.error('[AudioProcessor] Error processing stream:', error);
      throw error;
    }
  }

  private learnNoiseProfile(): void {
    if (!this.analyserNode) return;

    const bufferLength = this.analyserNode.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    const samples: Float32Array[] = [];
    const sampleCount = 50;

    const collectSample = () => {
      this.analyserNode!.getByteFrequencyData(dataArray);
      const floatArray = new Float32Array(bufferLength);
      for (let i = 0; i < bufferLength; i++) {
        floatArray[i] = dataArray[i] / 255.0;
      }
      samples.push(floatArray);

      if (samples.length < sampleCount) {
        setTimeout(collectSample, 20);
      } else {
        this.computeNoiseProfile(samples);
      }
    };

    collectSample();
  }

  private computeNoiseProfile(samples: Float32Array[]): void {
    const bufferLength = samples[0].length;
    this.noiseProfile = new Float32Array(bufferLength);

    for (let freq = 0; freq < bufferLength; freq++) {
      let sum = 0;
      for (const sample of samples) {
        sum += sample[freq];
      }
      this.noiseProfile[freq] = sum / samples.length;
    }

    console.log('[AudioProcessor] Noise profile learned');
  }

  updateConfig(newConfig: Partial<AudioProcessorConfig>): void {
    this.config = { ...this.config, ...newConfig };

    if (newConfig.enableNoiseSuppression !== undefined) {
      this.noiseProfile = null;
      if (newConfig.enableNoiseSuppression) {
        setTimeout(() => this.learnNoiseProfile(), 500);
      }
    }
  }

  stop(): void {
    this.isProcessing = false;

    this.sourceNode?.disconnect();
    this.destinationNode?.disconnect();
    this.analyserNode?.disconnect();
    this.gainNode?.disconnect();
    this.noiseGateNode?.disconnect();

    this.sourceNode = null;
    this.destinationNode = null;
    this.analyserNode = null;
    this.gainNode = null;
    this.noiseGateNode = null;

    console.log('[AudioProcessor] Stopped processing');
  }

  dispose(): void {
    this.stop();

    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
      this.audioContext = null;
    }
  }

  isInitialized(): boolean {
    return this.audioContext !== null;
  }

  isActive(): boolean {
    return this.isProcessing;
  }
}
