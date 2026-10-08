import type { BeatEvent, FeatureFrame, MusicAnalysis } from './analysis-schema';
import { clamp01, percentile } from './feature-extractor';

/** Whole-track autocorrelation plus dynamic alignment of measured onset peaks. */
export function trackBeats(frames: FeatureFrame[]): MusicAnalysis['rhythm'] {
  const empty: MusicAnalysis['rhythm'] = { bpm: null, beats: [], downbeats: [] };
  if (frames.length < 8 || frames[frames.length - 1]!.time < 4) return empty;
  const hop = frames[1]!.time - frames[0]!.time;
  if (!(hop > 0)) return empty;
  const onset = frames.map((f) => f.rms > 1e-5 ? f.onset : 0);
  const threshold = Math.max(0.2, percentile(onset, 0.8));
  const peaks: { time: number; strength: number; index: number }[] = [];
  for (let i = 1; i < onset.length - 1; i++) {
    if (onset[i]! < threshold || onset[i]! <= onset[i - 1]! || onset[i]! < onset[i + 1]!) continue;
    const last = peaks[peaks.length - 1];
    if (last && frames[i]!.time - last.time < 0.15) {
      if (onset[i]! > last.strength) peaks[peaks.length - 1] = { time: frames[i]!.time, strength: onset[i]!, index: i };
    } else peaks.push({ time: frames[i]!.time, strength: onset[i]!, index: i });
  }
  if (peaks.length < 6) return empty;
  let best = 0, bpm = 0;
  for (let candidate = 55; candidate <= 180; candidate++) {
    const lag = 60 / candidate / hop;
    let numerator = 0, left = 0, right = 0;
    for (let i = Math.ceil(lag); i < onset.length; i++) {
      const position = i - lag, low = Math.floor(position), fraction = position - low;
      const other = onset[low]! * (1 - fraction) + (onset[low + 1] ?? 0) * fraction;
      numerator += onset[i]! * other; left += onset[i]! ** 2; right += other ** 2;
    }
    const correlation = numerator / Math.max(1e-10, Math.sqrt(left * right));
    // A very weak preference breaks exact half-time ties, not weak musical evidence.
    const score = correlation * (0.99 + 0.01 * Math.exp(-(((candidate - 110) / 60) ** 2)));
    if (score > best) { best = score; bpm = candidate; }
  }
  if (best < 0.12) return empty;
  const period = 60 / bpm;
  const scores = new Float64Array(peaks.length);
  const previous = new Int32Array(peaks.length).fill(-1);
  for (let i = 0; i < peaks.length; i++) {
    scores[i] = peaks[i]!.strength;
    for (let j = i - 1; j >= 0; j--) {
      const distance = peaks[i]!.time - peaks[j]!.time;
      if (distance > period * 2.2) break;
      if (distance < period * 0.65) continue;
      const multiple = distance > period * 1.5 ? 2 : 1;
      const error = Math.log(distance / (period * multiple));
      const value = scores[j]! + peaks[i]!.strength - 5 * error * error - (multiple - 1) * 0.2;
      if (value > scores[i]!) { scores[i] = value; previous[i] = j; }
    }
  }
  let end = 0;
  for (let i = 1; i < scores.length; i++) if (scores[i]! > scores[end]!) end = i;
  const beats: BeatEvent[] = [];
  for (let i = end; i >= 0; i = previous[i]!) beats.push({ time: peaks[i]!.time, confidence: clamp01(best * peaks[i]!.strength) });
  beats.reverse();
  if (beats.length < 6) return empty;
  const aligned: BeatEvent[] = [];
  for (let i = 0; i < beats.length; i++) {
    const beat = beats[i]!;
    const last = aligned[aligned.length - 1];
    if (last && beat.time - last.time > period * 1.6 && beat.time - last.time < period * 2.3) {
      aligned.push({ time: (last.time + beat.time) / 2, confidence: Math.min(last.confidence, beat.confidence) * 0.35 });
    }
    aligned.push(beat);
  }
  // Four-beat grouping is only a low-confidence drawing anchor; meter is unknown.
  let offset = 0, accent = -1;
  for (let candidate = 0; candidate < 4; candidate++) {
    let sum = 0, count = 0;
    for (let i = candidate; i < aligned.length; i += 4) { sum += aligned[i]!.confidence; count++; }
    if (count && sum / count > accent) { accent = sum / count; offset = candidate; }
  }
  return { bpm, beats: aligned, downbeats: aligned.filter((_, i) => i % 4 === offset).map((beat) => ({ ...beat, confidence: beat.confidence * 0.35, inferred: true })) };
}
