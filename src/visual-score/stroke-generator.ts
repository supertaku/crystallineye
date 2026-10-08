import type { FeatureFrame, MusicAnalysis, NoteEvent } from '../analysis/analysis-schema';
import { clamp01, percentile } from '../analysis/feature-extractor';
import type { PaletteKeyframe, SceneEvent, StrokeEvent, StrokePoint } from './schema';
import { blendPigment, composePaletteTimeline, paletteAt, pitchColor } from './palette';

export type BrushCursor = { point?: StrokePoint; contactSeconds: number };
function featureAt(frames: FeatureFrame[], time: number): FeatureFrame | undefined {
  let low = 0, high = frames.length;
  while (low < high) { const mid = (low + high) >>> 1; if (frames[mid]!.time <= time) low = mid + 1; else high = mid; }
  return frames[Math.max(0, low - 1)];
}

/** Downbeats articulate a continuous path; they never pick a new random origin. */
export function generateStrokes(analysis: MusicAnalysis, scene: SceneEvent, melody: NoteEvent[], cursor: BrushCursor = { contactSeconds: 0 }, timeline: PaletteKeyframe[] = composePaletteTimeline(analysis)): StrokeEvent[] {
  const notes = melody.filter(note => note.start < scene.end && note.end > scene.start);
  const low = percentile(melody.map(note => note.midi), .1), high = percentile(melody.map(note => note.midi), .9);
  const anchors = [scene.start, ...analysis.rhythm.downbeats.filter(beat => beat.confidence >= .15 && beat.time > scene.start + .05 && beat.time < scene.end).map(beat => beat.time), scene.end];
  // Bounded chunks limit renderer work even when rhythm evidence is absent or sparse.
  for (let index = anchors.length - 2; index >= 0; index--) {
    const extra = [];
    for (let time = anchors[index]! + 4; time < anchors[index + 1]! - .05; time += 4) extra.push(time);
    anchors.splice(index + 1, 0, ...extra);
  }
  const strokes: StrokeEvent[] = [];
  for (let bar = 0; bar < anchors.length - 1; bar++) {
    const start = anchors[bar]!, end = anchors[bar + 1]!;
    const intervals: { start: number; end: number; notes: NoteEvent[] }[] = [];
    if (analysis.notes.length) {
      for (const note of notes.filter(note => note.start < end && note.end > start)) {
        const last = intervals.at(-1), begin = Math.max(start, note.start), finish = Math.min(end, note.end);
        if (last && begin - last.end <= .1) { last.end = Math.max(last.end, finish); last.notes.push(note); }
        else intervals.push({ start: begin, end: finish, notes: [note] });
      }
    } else {
      // Absolute decoded RMS detects actual silence; quiet relative dynamics still draw.
      const hop = analysis.dynamics.length > 1 ? analysis.dynamics[1]!.time - analysis.dynamics[0]!.time : .04644;
      for (const frame of analysis.dynamics) {
        if (frame.time + hop <= start || frame.time >= end || frame.rms <= 1e-5) continue;
        const begin = Math.max(start, frame.time), finish = Math.min(end, frame.time + hop), last = intervals.at(-1);
        if (last && begin - last.end < hop * .5) last.end = finish;
        else intervals.push({ start: begin, end: finish, notes: [] });
      }
    }
    for (let run = 0; run < intervals.length; run++) {
      const interval = intervals[run]!, duration = interval.end - interval.start;
      if (duration < .06) continue;
      const times = [interval.start, interval.end,
        ...interval.notes.flatMap(note => [note.start, note.end]).filter(time => time > interval.start && time < interval.end),
        ...timeline.map(key => key.time).filter(time => time > interval.start && time < interval.end)];
      for (let time = interval.start + .2; time < interval.end; time += .2) times.push(time);
      const ordered: number[] = [];
      for (const time of [...new Set(times)].sort((a, b) => a - b)) {
        if (time === interval.end) {
          if (ordered.length > 1 && time - ordered.at(-1)! < .01) ordered.pop();
          ordered.push(time);
        } else if (!ordered.length || time - ordered.at(-1)! >= .01) ordered.push(time);
      }
      let prior = cursor.point, lastTime = interval.start;
      const points: StrokePoint[] = ordered.map(time => {
        const feature = featureAt(analysis.dynamics, time), energy = feature?.energy ?? 0;
        const note = interval.notes.find(event => event.start <= time && event.end > time)
          ?? (interval.notes.at(-1)?.end === time ? interval.notes.at(-1) : undefined);
        const confidence = note?.confidence ?? .35;
        const pitch = note ? clamp01((note.midi - low) / Math.max(7, high - low)) - .5 : (feature?.brightness ?? .5) - .5;
        const dt = Math.max(0, time - lastTime), relax = 1 - Math.exp(-dt / .35);
        cursor.contactSeconds += dt;
        const targetY = .5 - pitch * .25 * (note ? confidence : .5) + Math.sin(cursor.contactSeconds * .2) * .055;
        const targetWidth = .004 + energy * .027 * (note ? .6 + note.amplitude * .4 : .8);
        const targetOpacity = (.5 + energy * .28) * (.45 + confidence * .55);
        const harmonic = paletteAt(timeline, time);
        const point: StrokePoint = { time,
          x: dt === 0 && prior ? prior.x : .5 - .36 * Math.cos(cursor.contactSeconds * .25),
          y: prior ? prior.y + (targetY - prior.y) * relax : targetY,
          width: prior ? prior.width + (targetWidth - prior.width) * relax : targetWidth,
          opacity: prior ? prior.opacity + (targetOpacity - prior.opacity) * relax : targetOpacity,
          color: note ? blendPigment(harmonic.ink, pitchColor(note.midi % 12), confidence * .65) : harmonic.ink,
          velocity: dt === 0 && prior?.velocity ? prior.velocity : {
            x: .09 * Math.sin(cursor.contactSeconds * .25),
            y: prior && dt > 0 ? (targetY - prior.y) * relax / dt : 0,
          } };
        prior = point; lastTime = time;
        return point;
      });
      cursor.point = points.at(-1);
      strokes.push({ id: `s-${scene.index}-${bar}-${run}`, sceneIndex: scene.index, start: interval.start, end: interval.end, points,
        confidence: interval.notes.length ? interval.notes.reduce((sum, note) => sum + note.confidence, 0) / interval.notes.length : .35 });
    }
  }
  return strokes;
}
