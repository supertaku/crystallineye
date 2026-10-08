import { RHYTHM_CONFIG } from '../config';
import { clamp } from '../shared/math';

export class BeatEnvelope {
  private time: number | null = null;
  private strength = 0;
  constructor(readonly decaySeconds = RHYTHM_CONFIG.beatPulseDecaySeconds) {}
  reset() { this.time = null; this.strength = 0; }
  trigger(timestamp: number, strength = 1) {
    this.time = timestamp;
    this.strength = clamp(strength);
  }
  value(timestamp: number) {
    return this.time === null ? 0 : this.strength * Math.exp(-Math.max(0, timestamp - this.time) / this.decaySeconds);
  }
}
