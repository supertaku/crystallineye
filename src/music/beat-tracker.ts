import { RHYTHM_CONFIG } from '../config';
import { clamp } from '../shared/math';
import { BeatEnvelope } from './beat-envelope';
import type { BeatState, TempoEstimate } from './types';

/** Lightweight PLL: measured peaks correct a tempo clock, missing peaks coast. */
export class BeatTracker {
  private lastBeat: number | null = null;
  private lastPeak: number | null = null;
  private readonly fallback = new BeatEnvelope();
  reset() { this.lastBeat = null; this.lastPeak = null; this.fallback.reset(); }

  update(timestamp: number, tempo: TempoEstimate, peakStrength: number): BeatState {
    const c = RHYTHM_CONFIG;
    if (peakStrength > 0) { this.lastPeak = timestamp; this.fallback.trigger(timestamp, peakStrength); }
    if (tempo.bpm === null || tempo.confidence < c.confidenceThreshold) {
      this.lastBeat = null;
      return { phase: 0, pulse: this.fallback.value(timestamp), confidence: 0, detected: peakStrength > 0 };
    }
    const period = 60 / tempo.bpm;
    if (this.lastBeat === null && this.lastPeak !== null) this.lastBeat = this.lastPeak;
    if (this.lastBeat === null) return { phase: 0, pulse: 0, confidence: 0, detected: false };
    let detected = false;
    // An onset near either side of the expected beat pulls the clock toward it.
    const closest = this.lastBeat + Math.round((timestamp - this.lastBeat) / period) * period;
    if (peakStrength > 0 && Math.abs(timestamp - closest) <= period * c.phaseCorrectionWindow) {
      this.lastBeat = closest + (timestamp - closest) * c.phaseCorrectionGain;
      detected = true;
    }
    const passed = Math.floor((timestamp - this.lastBeat) / period);
    if (passed > 0) this.lastBeat += passed * period;
    const sinceBeat = Math.max(0, timestamp - this.lastBeat);
    const phase = clamp(sinceBeat / period);
    return { phase, pulse: Math.exp(-sinceBeat / c.beatPulseDecaySeconds), confidence: tempo.confidence, detected };
  }
}
