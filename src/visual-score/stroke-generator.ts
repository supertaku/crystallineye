import type { FeatureFrame, MusicAnalysis, NoteEvent } from '../analysis/analysis-schema';
import { clamp01, percentile } from '../analysis/feature-extractor';
import type { SceneEvent, StrokeEvent, StrokePoint } from './schema';
import { pitchColor } from './palette';
import { seededRandom, seedFrom } from './seed';

function featureAt(frames: FeatureFrame[], time: number): FeatureFrame | undefined {
  let low = 0, high = frames.length;
  while (low < high) { const mid = (low + high) >>> 1; if (frames[mid]!.time <= time) low = mid + 1; else high = mid; }
  return frames[Math.max(0, low - 1)];
}

export function generateStrokes(analysis: MusicAnalysis, scene: SceneEvent, melody: NoteEvent[]): StrokeEvent[] {
  const notes = melody.filter((note) => note.start < scene.end && note.end > scene.start);
  const low = percentile(notes.map((note) => note.midi), 0.1), high = percentile(notes.map((note) => note.midi), 0.9);
  const anchors = [scene.start, ...analysis.rhythm.downbeats.filter((beat) => beat.time > scene.start + 0.05 && beat.time < scene.end).map((beat) => beat.time)];
  if (anchors.length === 1) for (let start = scene.start + 4; start < scene.end; start += 4) anchors.push(start);
  anchors.push(scene.end);
  const strokes: StrokeEvent[] = [];
  for (let bar = 0; bar < anchors.length - 1; bar++) {
    const start = anchors[bar]!, end = anchors[bar + 1]!;
    const random = seededRandom(seedFrom(`${analysis.track.hash}:${scene.index}:${bar}`));
    const horizontal = random() > 0.5 ? 1 : -1;
    const originX = horizontal > 0 ? 0.1 + random() * 0.18 : 0.72 + random() * 0.18, originY = 0.2 + random() * 0.52;
    const sweep = 0.3 + random() * 0.35, direction = random() > 0.5 ? 1 : -1;
    const localNotes = notes.filter((note) => note.start < end && note.end > start);
    const runs: NoteEvent[][] = [];
    for (const note of localNotes) {
      const run = runs[runs.length - 1], last = run?.[run.length - 1];
      if (run && last && note.start - last.end <= 0.45) run.push(note);
      else runs.push([note]);
    }
    // With no transcription available, measured energy/spectrum supplies a conservative contour.
    if (!analysis.notes.length) runs.push([]);
    for (let runIndex = 0; runIndex < runs.length; runIndex++) {
      const run = runs[runIndex]!;
      const strokeStart = run.length ? Math.max(start, run[0]!.start) : start;
      const strokeEnd = run.length ? Math.min(end, run[run.length - 1]!.end) : end;
      if (strokeEnd - strokeStart < 0.06) continue;
      const times = [strokeStart, ...run.map((note) => note.start).filter((time) => time > strokeStart && time < strokeEnd),
        ...analysis.rhythm.beats.filter((beat) => beat.time > strokeStart && beat.time < strokeEnd).map((beat) => beat.time), strokeEnd];
      if (!run.length) for (let time = strokeStart + 0.4; time < strokeEnd; time += 0.4) times.push(time);
      const ordered = [...new Set(times)].sort((a, b) => a - b).slice(0, 63);
      if (ordered[ordered.length - 1] !== strokeEnd) ordered.push(strokeEnd);
      let audible = false;
      const points: StrokePoint[] = ordered.map((time) => {
        const feature = featureAt(analysis.dynamics, time);
        const energy = feature?.energy ?? 0;
        if ((feature?.rms ?? 0) > 1e-5) audible = true;
        const note = run.find((event) => event.start <= time && event.end >= time) ?? run[run.length - 1];
        const confidence = note?.confidence ?? 0.35;
        const pitch = note ? clamp01((note.midi - low) / Math.max(7, high - low)) - 0.5 : (feature?.brightness ?? 0.5) - 0.5;
        const progress = (time - start) / (end - start);
        const beat = analysis.rhythm.beats.find((event) => Math.abs(event.time - time) < 0.03);
        const pressure = energy * (0.78 + (beat?.confidence ?? 0) * 0.22);
        return { time, x: Math.max(0.08, Math.min(0.92, originX + horizontal * sweep * progress)),
          y: Math.max(0.1, Math.min(0.9, originY - pitch * 0.22 + direction * Math.sin(progress * Math.PI) * 0.12)),
          width: 0.004 + pressure * 0.031, opacity: (0.5 + energy * 0.28) * (0.45 + confidence * 0.55), color: note ? pitchColor(note.midi % 12) : scene.palette.ink };
      });
      if (!audible && !run.length) continue;
      strokes.push({ id: `s-${scene.index}-${bar}-${runIndex}`, sceneIndex: scene.index, start: strokeStart, end: strokeEnd, points,
        confidence: run.length ? run.reduce((sum, note) => sum + note.confidence, 0) / run.length : 0.35 });
    }
  }
  return strokes;
}
