import type { RateEstimate } from '../types/audio';

/** Only meaningful for contiguous PCM, never Android Visualizer snapshots. */
export class SampleRateEstimator {
  private previous: { count: number; timestamp: number } | null = null;
  private candidates: number[] = [];

  reset() { this.previous = null; this.candidates = []; }

  observe(count: number, timestamp: number): RateEstimate {
    if (!Number.isFinite(timestamp) || timestamp < 0 || count <= 0) {
      this.reset();
      return { hz: null, confidence: 0 };
    }
    const previous = this.previous;
    this.previous = { count, timestamp };
    if (previous) {
      const delta = timestamp - previous.timestamp;
      const rate = previous.count / delta;
      if (delta <= 0 || delta > 0.5 || rate < 8000 || rate > 192000) {
        this.candidates = [];
      } else {
        this.candidates.push(rate);
        if (this.candidates.length > 24) this.candidates.shift();
      }
    }
    if (this.candidates.length < 8) return { hz: null, confidence: 0 };
    const sorted = [...this.candidates].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)]!;
    const inliers = sorted.filter((rate) => Math.abs(rate / median - 1) < 0.03);
    const confidence = inliers.length / sorted.length;
    if (confidence < 0.85) return { hz: null, confidence: 0 };
    return { hz: inliers.reduce((sum, rate) => sum + rate, 0) / inliers.length, confidence };
  }
}

/** Verified against expo-audio 57 Android source; iOS uses seconds. */
export function sampleTimestamp(raw: number, platform: 'android' | 'other'): number | null {
  if (!Number.isFinite(raw) || raw < 0) return null;
  return platform === 'android' ? raw / 1000 : raw;
}
