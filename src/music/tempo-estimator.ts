import { RHYTHM_CONFIG } from '../config';
import { clamp } from '../shared/math';
import type { OnsetPoint, TempoEstimate } from './types';

type Candidate = { bpm: number; score: number };
const UNKNOWN: TempoEstimate = { bpm: null, confidence: 0 };

/** Interpolate only the measured novelty envelope onto a time grid for correlation. */
function resample(points: readonly OnsetPoint[], rate: number): Float64Array {
  const first = points[0]!.timestamp;
  const end = points[points.length - 1]!.timestamp;
  const values = new Float64Array(Math.floor((end - first) * rate) + 1);
  let cursor = 0;
  for (let i = 0; i < values.length; i++) {
    const time = first + i / rate;
    while (cursor + 1 < points.length && points[cursor + 1]!.timestamp < time) cursor++;
    const a = points[cursor]!;
    const b = points[Math.min(cursor + 1, points.length - 1)]!;
    const alpha = b.timestamp === a.timestamp ? 0 : clamp((time - a.timestamp) / (b.timestamp - a.timestamp));
    values[i] = a.onsetStrength + alpha * (b.onsetStrength - a.onsetStrength);
  }
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  for (let i = 0; i < values.length; i++) values[i] = values[i]! - mean;
  return values;
}

function correlation(values: Float64Array, lag: number): number {
  let product = 0;
  let powerA = 0;
  let powerB = 0;
  for (let i = Math.ceil(lag); i < values.length; i++) {
    const position = i - lag;
    const low = Math.floor(position);
    const alpha = position - low;
    const a = values[i]!;
    const b = values[low]! * (1 - alpha) + values[Math.min(low + 1, values.length - 1)]! * alpha;
    product += a * b;
    powerA += a * a;
    powerB += b * b;
  }
  return powerA * powerB > 1e-10 ? Math.max(0, product / Math.sqrt(powerA * powerB)) : 0;
}

export class TempoEstimator {
  private lastEstimate = -Infinity;
  private votes: Candidate[] = [];
  private stable: TempoEstimate = { ...UNKNOWN };
  reset() { this.lastEstimate = -Infinity; this.votes = []; this.stable = { ...UNKNOWN }; }

  update(points: readonly OnsetPoint[]): TempoEstimate {
    const c = RHYTHM_CONFIG;
    if (points.length < 2) return { ...UNKNOWN };
    const now = points[points.length - 1]!.timestamp;
    const duration = now - points[0]!.timestamp;
    if (duration < c.minimumTempoHistorySeconds) return { ...UNKNOWN };
    if (now - this.lastEstimate < c.estimateIntervalSeconds) return { ...this.stable };
    const dt = Number.isFinite(this.lastEstimate) ? now - this.lastEstimate : c.estimateIntervalSeconds;
    this.lastEstimate = now;
    // A beat clock must lose confidence in silence / absent evidence.
    const recent = points.filter((point) => now - point.timestamp <= 2);
    if (!recent.some((point) => point.onsetStrength >= c.onsetThreshold)) {
      this.stable.confidence *= 0.5;
      this.votes = [];
      return { ...this.stable };
    }
    const values = resample(points, c.envelopeRate);
    const candidates: Candidate[] = [];
    for (let bpm = c.bpmMin; bpm <= c.bpmMax; bpm++) {
      const lag = 60 * c.envelopeRate / bpm;
      // Localized lag search accommodates callback jitter without integer-BPM bias.
      const score = 0.2 * correlation(values, lag - 0.25) + 0.6 * correlation(values, lag) + 0.2 * correlation(values, lag + 0.25);
      candidates.push({ bpm, score });
    }
    const peaks = candidates.filter((candidate, i) => candidate.score >= (candidates[i - 1]?.score ?? -1) && candidate.score >= (candidates[i + 1]?.score ?? -1));
    peaks.sort((a, b) => b.score - a.score);
    const best = peaks[0]!;
    const comparable = peaks.filter((candidate) => candidate.score >= best.score - c.ambiguityScoreMargin);
    // For equal harmonic peaks, shortest period wins until a stable tempo exists.
    // Once locked, nearby half/double-time candidates cannot flip the estimate.
    const selected = this.stable.bpm === null
      ? comparable.reduce((chosen, candidate) => candidate.bpm > chosen.bpm ? candidate : chosen, best)
      : comparable.reduce((chosen, candidate) => Math.abs(candidate.bpm - this.stable.bpm!) < Math.abs(chosen.bpm - this.stable.bpm!) ? candidate : chosen, best);
    const confidence = clamp(selected.score * Math.min(1, duration / c.preferredTempoHistorySeconds));
    if (confidence < c.confidenceThreshold) {
      this.stable.confidence *= 0.8;
      this.votes = [];
      return { ...this.stable };
    }
    this.votes.push(selected);
    if (this.votes.length > c.candidateVotes) this.votes.shift();
    const agreeing = this.votes.filter((vote) => Math.abs(vote.bpm - selected.bpm) <= c.candidateToleranceBpm);
    if (agreeing.length >= c.acquisitionVotes) {
      const voted = agreeing.reduce((sum, vote) => sum + vote.bpm * vote.score, 0) / agreeing.reduce((sum, vote) => sum + vote.score, 0);
      if (this.stable.bpm === null) this.stable.bpm = voted;
      else {
        const difference = (voted - this.stable.bpm) * (1 - Math.exp(-dt / c.tempoSmoothingSeconds));
        this.stable.bpm += clamp(difference, -c.bpmSlewPerSecond * dt, c.bpmSlewPerSecond * dt);
      }
      this.stable.confidence = confidence;
    }
    return { ...this.stable };
  }
}
