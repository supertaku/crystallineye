import type { MusicAnalysis } from '../analysis/analysis-schema';
import type { DropEvent, PaletteKeyframe, SceneEvent, StrokeEvent } from './schema';
import { seededRandom, seedFrom } from './seed';
import { composePaletteTimeline, paletteAt } from './palette';

export function composeDrops(analysis: MusicAnalysis, scene: SceneEvent, strokes: StrokeEvent[] = [], timeline: PaletteKeyframe[] = composePaletteTimeline(analysis)): DropEvent[] {
  const drops: DropEvent[] = [];
  let last = -Infinity;
  for (let index = 0; index < analysis.dynamics.length; index++) {
    const frame = analysis.dynamics[index]!;
    const rhythmic = analysis.rhythm.beats.some(beat => beat.confidence >= .3 && Math.abs(beat.time - frame.time) < .1);
    const strength = frame.onset * (.55 + frame.brightness * .3 + (rhythmic ? .15 : 0));
    if (frame.time < scene.start || frame.time >= scene.end || frame.rms <= 1e-5 || frame.energy < 0.08 || strength < 0.55 || frame.time - last < 0.25
      || frame.onset < (analysis.dynamics[index - 1]?.onset ?? 0) || frame.onset < (analysis.dynamics[index + 1]?.onset ?? 0)) continue;
    // Suppress drops at transcribed note onsets to leave room for the melody brush.
    if (analysis.notes.some((note) => note.confidence > 0.5 && Math.abs(note.start - frame.time) < 0.06)) continue;
    const active = strokes.find(stroke => stroke.start <= frame.time && stroke.end >= frame.time)
      ?? strokes.findLast(stroke => stroke.end <= frame.time && frame.time - stroke.end <= .35);
    if (!active) continue;
    const upper = active.points.findIndex(point => point.time >= frame.time);
    const after = active.points[upper < 0 ? active.points.length - 1 : upper]!;
    const before = active.points[Math.max(0, (upper < 0 ? active.points.length - 1 : upper) - 1)]!;
    const progress = Math.max(0, Math.min(1, (frame.time - before.time) / Math.max(.001, after.time - before.time)));
    const tip = { x: before.x + (after.x - before.x) * progress, y: before.y + (after.y - before.y) * progress };
    const random = seededRandom(seedFrom(`${analysis.track.hash}:${scene.index}:drop:${index}`));
    drops.push({ id: `d-${scene.index}-${index}`, sceneIndex: scene.index, time: frame.time,
      position: { x: Math.max(.08, Math.min(.92, tip.x + (random() - .5) * .045)), y: Math.max(.1, Math.min(.9, tip.y + (random() - .5) * .045)) }, radius: 0.004 + strength * 0.014,
      color: paletteAt(timeline, frame.time).support, strength: strength * frame.energy });
    last = frame.time;
  }
  return drops;
}
