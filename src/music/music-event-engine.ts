import { RHYTHM_CONFIG, VISUAL_CONFIG } from '../config';
import { attackRelease } from '../color/smoothing';
import { clamp } from '../shared/math';
import type { AudioFeatureFrame } from '../types/audio';
import { OnsetEnvelope } from './onset-envelope';
import { TempoEstimator } from './tempo-estimator';
import { BeatTracker } from './beat-tracker';
import { BeatEnvelope } from './beat-envelope';
import type { MusicEventFrame } from './types';

export class MusicEventEngine {
  readonly history = new OnsetEnvelope();
  private readonly tempo = new TempoEstimator();
  private readonly tracker = new BeatTracker();
  private readonly onset = new BeatEnvelope(RHYTHM_CONFIG.onsetDecaySeconds);
  private previous: AudioFeatureFrame | null = null;
  private lastPeak = -Infinity;
  private previousNovelty = 0;
  private warmup = 0;
  private energy = 0;
  private brightness = 0;
  private balance: [number, number, number] = [1 / 3, 1 / 3, 1 / 3];

  reset() {
    this.history.reset(); this.tempo.reset(); this.breakContinuity();
    this.energy = 0; this.brightness = 0; this.balance = [1 / 3, 1 / 3, 1 / 3];
  }

  /** Pause keeps tempo evidence but discards transients and the beat location. */
  breakContinuity() {
    this.previous = null; this.lastPeak = -Infinity; this.warmup = 0; this.previousNovelty = 0;
    this.tracker.reset(); this.onset.reset();
  }

  update(frame: AudioFeatureFrame): MusicEventFrame {
    if (this.previous && (frame.timestamp < this.previous.timestamp || frame.timestamp - this.previous.timestamp > RHYTHM_CONFIG.continuityGapSeconds)) this.reset();
    const previous = this.previous;
    const dt = previous ? clamp(frame.timestamp - previous.timestamp, 0, 0.1) : 1 / 30;
    this.warmup += dt;
    const currentBalance = frame.bandRatios ?? frame.spectrumRatios;
    const previousBalance = previous?.bandRatios ?? previous?.spectrumRatios ?? currentBalance;
    const energyDelta = previous ? clamp((frame.rmsNormalized - previous.rmsNormalized) * RHYTHM_CONFIG.energyDeltaGain) : 0;
    const balanceDelta = previous ? clamp(currentBalance.reduce((sum, value, i) => sum + Math.abs(value - previousBalance[i]!), 0) * RHYTHM_CONFIG.balanceDeltaGain) : 0;
    const weights = RHYTHM_CONFIG.novelty;
    const novelty = this.warmup < RHYTHM_CONFIG.transientWarmupSeconds ? 0 : clamp(
      weights.onset * frame.onsetStrength + weights.energyDelta * energyDelta + weights.balanceDelta * balanceDelta,
    );
    this.history.push(frame.timestamp, novelty);
    const rising = novelty > this.previousNovelty;
    const peak = rising && novelty >= RHYTHM_CONFIG.onsetThreshold && frame.timestamp - this.lastPeak >= RHYTHM_CONFIG.peakRefractorySeconds ? novelty : 0;
    if (peak > 0) { this.lastPeak = frame.timestamp; this.onset.trigger(frame.timestamp, clamp(peak / weights.onset)); }
    const smooth = (value: number, target: number, config: { attack: number; release: number }) => attackRelease(value, clamp(target), dt, config.attack, config.release);
    this.energy = smooth(this.energy, frame.rmsNormalized, VISUAL_CONFIG.energy);
    this.brightness = smooth(this.brightness, frame.spectralBrightnessNormalized, VISUAL_CONFIG.brightness);
    this.balance = this.balance.map((value, i) => smooth(value, currentBalance[i]!, VISUAL_CONFIG.balance)) as typeof this.balance;
    const total = this.balance.reduce((sum, value) => sum + value, 0);
    this.balance = this.balance.map((value) => value / Math.max(1e-12, total)) as typeof this.balance;
    const tempo = this.tempo.update(this.history.points());
    this.previous = frame;
    this.previousNovelty = novelty;
    return {
      timestamp: frame.timestamp, energy: this.energy, brightness: this.brightness,
      spectralBalance: [...this.balance], rawOnset: clamp(frame.onsetStrength), novelty,
      onsetStrength: this.onset.value(frame.timestamp), tempo,
      beat: this.tracker.update(frame.timestamp, tempo, peak > 0 ? clamp(peak / weights.onset) : 0),
    };
  }
}
