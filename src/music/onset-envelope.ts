import { RHYTHM_CONFIG } from '../config';
import { clamp } from '../shared/math';
import type { OnsetPoint } from './types';

/** Timestamped feature history, not a reconstructed PCM stream. */
export class OnsetEnvelope {
  private readonly timestamps: Float64Array;
  private readonly strengths: Float32Array;
  private start = 0;
  private count = 0;

  constructor(readonly capacity = RHYTHM_CONFIG.historyCapacity, readonly seconds = RHYTHM_CONFIG.historySeconds) {
    if (!Number.isInteger(capacity) || capacity < 2 || seconds <= 0) throw new Error('Invalid onset history');
    this.timestamps = new Float64Array(capacity);
    this.strengths = new Float32Array(capacity);
  }

  get size() { return this.count; }
  reset() { this.start = 0; this.count = 0; }

  push(timestamp: number, strength: number) {
    if (!Number.isFinite(timestamp)) return;
    const last = (this.start + this.count - 1) % this.capacity;
    if (this.count && timestamp < this.timestamps[last]!) this.reset();
    if (this.count && timestamp === this.timestamps[last]) {
      this.strengths[last] = Math.max(this.strengths[last]!, clamp(strength));
      return;
    }
    while (this.count && timestamp - this.timestamps[this.start]! > this.seconds) {
      this.start = (this.start + 1) % this.capacity;
      this.count--;
    }
    const slot = (this.start + this.count) % this.capacity;
    this.timestamps[slot] = timestamp;
    this.strengths[slot] = clamp(strength);
    if (this.count === this.capacity) this.start = (this.start + 1) % this.capacity;
    else this.count++;
  }

  points(): OnsetPoint[] {
    return Array.from({ length: this.count }, (_, i) => {
      const slot = (this.start + i) % this.capacity;
      return { timestamp: this.timestamps[slot]!, onsetStrength: this.strengths[slot]! };
    });
  }
}
