import type { ChromaFrame, FeatureFrame, NoteEvent, SectionEvent } from './analysis-schema';
import { clamp01, percentile } from './feature-extractor';

function similarity(a: number[], b: number[]) {
  const norm = Math.hypot(...a) * Math.hypot(...b);
  return norm > 1e-10 ? a.reduce((sum, value, index) => sum + value * b[index]!, 0) / norm : 1;
}

/** Bounded 2-second self-similarity matrix; labels describe repeated regions, not verse/chorus. */
export function segmentSections(chroma: ChromaFrame[], dynamics: FeatureFrame[], notes: NoteEvent[], duration: number): SectionEvent[] {
  const windows: number[][] = [];
  for (let start = 0; start < duration; start += 2) {
    const features = dynamics.filter((f) => f.time >= start && f.time < start + 2);
    const harmonics = chroma.filter((f) => f.time >= start && f.time < start + 2);
    const values = Array<number>(15).fill(0);
    for (const frame of harmonics) frame.values.forEach((value, i) => { values[i] = values[i]! + value / Math.max(1, harmonics.length); });
    for (const frame of features) {
      values[12] = values[12]! + frame.energy / Math.max(1, features.length);
      values[13] = values[13]! + frame.brightness / Math.max(1, features.length);
    }
    values[14] = Math.min(1, notes.filter((n) => n.start >= start && n.start < start + 2).length / 12);
    windows.push(values);
  }
  const size = windows.length;
  const matrix = new Float32Array(size * size);
  for (let i = 0; i < size; i++) for (let j = 0; j < size; j++) matrix[i * size + j] = similarity(windows[i]!, windows[j]!);
  const novelty = Array<number>(size).fill(0);
  for (let i = 2; i < size - 2; i++) {
    let value = 0;
    for (let x = -2; x < 2; x++) for (let y = -2; y < 2; y++) value += matrix[(i + x) * size + i + y]! * ((x < 0) === (y < 0) ? 1 : -1);
    novelty[i] = Math.max(0, value / 8);
  }
  const threshold = Math.max(0.06, percentile(novelty, 0.8));
  const boundaries = [0];
  for (let i = 4; i < size - 2; i++) {
    if (novelty[i]! >= threshold && novelty[i]! > novelty[i - 1]! && novelty[i]! >= novelty[i + 1]! && i * 2 - boundaries[boundaries.length - 1]! >= 8) boundaries.push(i * 2);
  }
  boundaries.push(duration);
  const signatures: number[][] = [];
  const labels: string[] = [];
  return boundaries.slice(0, -1).map((start, index) => {
    const end = boundaries[index + 1]!;
    const region = windows.filter((_, i) => i * 2 >= start && i * 2 < end);
    const signature = Array<number>(15).fill(0);
    for (const frame of region) frame.forEach((value, i) => { signature[i] = signature[i]! + value / region.length; });
    let match = signatures.findIndex((prior) => similarity(prior, signature) > 0.96 && Math.abs(prior[12]! - signature[12]!) < 0.15);
    if (match < 0) { match = signatures.length; signatures.push(signature); labels.push(`Section ${String.fromCharCode(65 + match % 26)}${match >= 26 ? Math.floor(match / 26) : ''}`); }
    return { start, end, label: labels[match]!, confidence: index === 0 ? 0.4 : clamp01(novelty[Math.round(start / 2)]! * 2) };
  });
}
