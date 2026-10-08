import type { ChordEvent, ChromaFrame } from './analysis-schema';

export function estimateChords(frames: ChromaFrame[], duration: number): ChordEvent[] {
  const chords: ChordEvent[] = [];
  for (let start = 0; start < duration; start += 0.8) {
    const end = Math.min(duration, start + 0.8);
    const window = frames.filter((f) => f.time >= start && f.time < end);
    const values = Array<number>(12).fill(0);
    for (const frame of window) frame.values.forEach((value, pitch) => { values[pitch] = values[pitch]! + value; });
    const norm = Math.hypot(...values);
    let root = 0, quality: ChordEvent['quality'] = 'unknown', best = 0, runnerUp = 0;
    for (let candidate = 0; candidate < 12; candidate++) for (const mode of ['major', 'minor'] as const) {
      const third = mode === 'major' ? 4 : 3;
      const score = norm > 0 ? (values[candidate]! + values[(candidate + third) % 12]! + values[(candidate + 7) % 12]!) / (norm * Math.sqrt(3)) : 0;
      if (score > best) { runnerUp = best; best = score; root = candidate; quality = mode; }
      else runnerUp = Math.max(runnerUp, score);
    }
    const confidence = best > 0.72 ? Math.min(1, (best - runnerUp) * 5) : 0;
    if (confidence < 0.12) quality = 'unknown';
    const last = chords[chords.length - 1];
    if (last && last.root === root && last.quality === quality) {
      const oldLength = last.end - last.start;
      last.confidence = (last.confidence * oldLength + confidence * (end - start)) / (end - last.start);
      last.end = end;
    } else chords.push({ start, end, root, quality, confidence });
  }
  return chords;
}
