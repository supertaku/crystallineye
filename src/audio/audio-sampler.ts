import { DSP_CONFIG } from '../config';
import { DSPEngine } from '../dsp/dsp-engine';
import type { AudioFeatureFrame, PCMChunk, RateEstimate, SamplerDiagnostics, SamplingMode } from '../types/audio';
import { AudioBuffer, mixChannels } from './audio-buffer';
import { SampleRateEstimator } from './sample-rate';

export class AudioSampler {
  private readonly buffer: AudioBuffer;
  private readonly scratch: Float32Array;
  private readonly dsp: DSPEngine;
  private readonly estimator = new SampleRateEstimator();
  private lastUpdate = -Infinity;
  private lastTimestamp: number | null = null;
  private pendingFrames = 0;
  private rate: RateEstimate = { hz: null, confidence: 0 };
  private diagnostics: SamplerDiagnostics;

  constructor(readonly mode: SamplingMode, readonly fftSize = DSP_CONFIG.fftSize, readonly hopSize = DSP_CONFIG.hopSize) {
    if (hopSize < 1 || hopSize > fftSize) throw new Error('Invalid hop size');
    this.buffer = new AudioBuffer(fftSize);
    this.scratch = new Float32Array(fftSize);
    this.dsp = new DSPEngine(fftSize);
    this.diagnostics = this.emptyDiagnostics();
  }

  private emptyDiagnostics(): SamplerDiagnostics {
    return { callbacks: 0, frames: 0, lastFrameCount: 0, timestamp: null, rawTimestamp: null, estimatedSampleRate: null, sampleRateConfidence: 0, mode: this.mode, dspMs: 0, updates: 0, feature: null };
  }

  reset(clearCounters = false) {
    this.buffer.reset(); this.dsp.reset(); this.estimator.reset();
    this.lastUpdate = -Infinity; this.lastTimestamp = null; this.pendingFrames = 0;
    this.rate = { hz: null, confidence: 0 };
    if (clearCounters) this.diagnostics = this.emptyDiagnostics();
    else this.diagnostics = { ...this.diagnostics, estimatedSampleRate: null, sampleRateConfidence: 0, feature: null };
  }

  /** Clears continuity across pause/buffering without discarding musical statistics. */
  breakContinuity() {
    this.buffer.reset(); this.estimator.reset(); this.dsp.resetTransients(); this.lastTimestamp = null;
    this.pendingFrames = 0; this.lastUpdate = -Infinity;
    this.rate = { hz: null, confidence: 0 };
  }

  getDiagnostics(): SamplerDiagnostics { return { ...this.diagnostics }; }

  receive(chunk: PCMChunk, timestamp: number | null, playbackSeconds: number, nowMs: number): AudioFeatureFrame | null {
    if (timestamp !== null && this.lastTimestamp !== null && (timestamp < this.lastTimestamp || timestamp - this.lastTimestamp > 0.5)) this.reset();
    const timeline = timestamp !== null && (this.lastTimestamp === null || timestamp > this.lastTimestamp) ? timestamp : playbackSeconds;
    this.lastTimestamp = timestamp;
    // Android packets are disjoint snapshots: never stitch them together.
    if (this.mode === 'snapshot') this.buffer.reset();
    const count = mixChannels(chunk.channels, this.buffer);
    if (count === 0) return null;
    this.pendingFrames += count;
    this.rate = this.mode === 'continuous' && timestamp !== null
      ? this.estimator.observe(count, timestamp) : { hz: null, confidence: 0 };
    this.diagnostics.callbacks++;
    this.diagnostics.frames += count;
    this.diagnostics.lastFrameCount = count;
    this.diagnostics.timestamp = timestamp;
    this.diagnostics.rawTimestamp = chunk.timestamp;
    this.diagnostics.estimatedSampleRate = this.rate.hz;
    this.diagnostics.sampleRateConfidence = this.rate.confidence;
    const elapsed = nowMs - this.lastUpdate;
    if (elapsed < 1000 / DSP_CONFIG.updatesPerSecond) return null;
    if (this.mode === 'continuous' && (this.buffer.size < this.fftSize || this.pendingFrames < this.hopSize)) return null;
    const sampleCount = this.buffer.copyLatest(this.scratch);
    const dt = Number.isFinite(elapsed) ? Math.min(0.1, elapsed / 1000) : 1 / DSP_CONFIG.updatesPerSecond;
    const started = performance.now();
    const feature = this.dsp.analyze(this.scratch, sampleCount, timeline, this.rate, dt);
    this.diagnostics.dspMs = performance.now() - started;
    this.diagnostics.updates++;
    this.diagnostics.feature = feature;
    this.lastUpdate = nowMs;
    this.pendingFrames = 0;
    return feature;
  }
}
