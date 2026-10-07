import { clamp } from '../shared/math';

export class FeatureNormalizer {
  readonly version = 'norm-v1';
  private meanDb: number | null = null;
  private variance = 100;

  reset() { this.meanDb = null; this.variance = 100; }

  energy(rms: number, seconds: number): number {
    const db = 20 * Math.log10(Math.max(1e-6, rms));
    if (this.meanDb === null && rms > 1e-5) this.meanDb = db;
    const mean = this.meanDb ?? -30;
    const deviation = Math.max(8, Math.sqrt(this.variance));
    const relative = clamp(0.5 + (db - mean) / (4 * deviation));
    const absolute = clamp((db + 65) / 55);
    // Slow, bounded exponential stats; no continually shifting min/max.
    const alpha = 1 - Math.exp(-seconds / 20);
    const difference = clamp(db - mean, -24, 24);
    if (this.meanDb !== null) this.meanDb += alpha * difference;
    this.variance += alpha * (difference ** 2 - this.variance);
    return rms < 1e-5 ? 0 : clamp(0.65 * relative + 0.35 * absolute);
  }

  brightness(centroidHz: number | null, normalized: number): number {
    return centroidHz === null
      ? clamp(Math.log1p(normalized * 64) / Math.log(65))
      : clamp(Math.log1p(centroidHz / 250) / Math.log(33));
  }
}
