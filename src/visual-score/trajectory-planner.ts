import type { FeatureFrame, MusicAnalysis } from '../analysis/analysis-schema';
import type { MusicalPhrase } from '../analysis/phrase-types';
import { clamp01 } from '../analysis/feature-extractor';
import { blendPigment, paletteAt, pitchColor } from './palette';
import type { PaletteKeyframe, Point, StrokePoint, TrajectoryNote } from './schema';
import type { PhraseLayout } from './phrase-layout';

export type CompositionContext = { analysis: MusicAnalysis; layout: PhraseLayout; paletteTimeline: PaletteKeyframe[];
  previousPigment?: { width: number; opacity: number } };
export type PlannedGesture = {
  phraseId: string;
  start: number;
  end: number;
  /** Separate contact runs preserve every measured positive rest. */
  contactRuns: StrokePoint[][];
  notes: TrajectoryNote[];
  startPosition: Point;
  endPosition: Point;
  confidence: number;
};

function featureAt(frames: FeatureFrame[], time: number): FeatureFrame | undefined {
  let low = 0, high = frames.length;
  while (low < high) { const mid = (low + high) >>> 1; if (frames[mid]!.time <= time) low = mid + 1; else high = mid; }
  return frames[Math.max(0, low - 1)];
}

/** Bounded interval tendency: weak predictions cannot author a dramatic movement. */
export function intervalMovement(interval: number, confidence: number): number {
  return Math.tanh(interval / 7) * clamp01((confidence - .15) / .65) ** 2;
}

function pigmentPoint(context: CompositionContext, time: number, position: Point, confidence: number, amplitude: number, midi?: number): StrokePoint {
  const feature = featureAt(context.analysis.dynamics, time), energy = feature?.energy ?? 0;
  const harmonic = paletteAt(context.paletteTimeline, time);
  return { ...position, time, width: .004 + energy * .027 * (midi === undefined ? .8 : .6 + amplitude * .4),
    opacity: (.5 + energy * .28) * (.45 + confidence * .55),
    color: midi === undefined ? harmonic.ink : blendPigment(harmonic.ink, pitchColor(midi % 12), confidence * .65) };
}

function sampleTimes(start: number, end: number, context: CompositionContext): number[] {
  const times = [start, end];
  for (let time = start + .2; time < end; time += .2) times.push(time);
  for (const key of context.paletteTimeline) for (const offset of [0, .2, .4, .6]) {
    const time = key.time + offset;
    if (time > start && time < end) times.push(time);
  }
  // Allocate scene slices at existing musical-time knots so the renderer keeps
  // the same pressure interpolation instead of re-smoothing a split interval.
  for (const section of context.analysis.structure.segments) for (const time of [section.start, section.end]) {
    if (time > start && time < end) times.push(time);
  }
  return [...new Set(times)].sort((a, b) => a - b);
}

function smoothPigment(runs: StrokePoint[][], initial?: { width: number; opacity: number }): void {
  let prior = initial;
  for (const run of runs) {
    let lastTime = run[0]!.time;
    for (const point of run) {
      const relax = 1 - Math.exp(-(point.time - lastTime) / .35);
      if (prior) { point.width = prior.width + (point.width - prior.width) * relax; point.opacity = prior.opacity + (point.opacity - prior.opacity) * relax; }
      prior = point; lastTime = point.time;
    }
  }
}

/** A shared, time-scaled velocity at each knot; lifted endpoints come to rest. */
export function assignGestureVelocities(points: StrokePoint[]): StrokePoint[] {
  for (let index = 0; index < points.length; index++) {
    const point = points[index]!;
    if (!index || index === points.length - 1) { point.velocity = { x: 0, y: 0 }; continue; }
    const before = points[index - 1]!, after = points[index + 1]!;
    const incomingTime = point.time - before.time, outgoingTime = after.time - point.time;
    const incoming = { x: (point.x - before.x) / incomingTime, y: (point.y - before.y) / incomingTime };
    const outgoing = { x: (after.x - point.x) / outgoingTime, y: (after.y - point.y) / outgoingTime };
    // Reversal means an intentional, restrained turn instead of a looping overshoot.
    point.velocity = { x: incoming.x * outgoing.x <= 0 ? 0 : (incoming.x * outgoingTime + outgoing.x * incomingTime) / (incomingTime + outgoingTime),
      y: incoming.y * outgoing.y <= 0 ? 0 : (incoming.y * outgoingTime + outgoing.y * incomingTime) / (incomingTime + outgoingTime) };
    // Limit once using both neighboring durations, matching the renderer's shared limiter.
    let scale = 1;
    for (const axis of ['x', 'y'] as const) {
      const v = point.velocity[axis], p = point[axis];
      if (v > 0) scale = Math.min(scale, p * 3 / (v * incomingTime), (1 - p) * 3 / (v * outgoingTime));
      else if (v < 0) scale = Math.min(scale, (1 - p) * 3 / (-v * incomingTime), p * 3 / (-v * outgoingTime));
    }
    point.velocity = { x: point.velocity.x * Math.max(0, scale), y: point.velocity.y * Math.max(0, scale) };
  }
  return points;
}

/** Note time authors movement. There is no elapsed-contact oscillator or per-note pixel step. */
export function planPhraseTrajectory(phrase: MusicalPhrase, context: CompositionContext): PlannedGesture {
  const { layout } = context, height = layout.bounds.bottom - layout.bounds.top;
  const movement = [0];
  for (let index = 1; index < phrase.notes.length; index++) {
    const note = phrase.notes[index]!, previous = phrase.notes[index - 1]!;
    movement.push(movement.at(-1)! + intervalMovement(note.midi - previous.midi, Math.min(note.confidence, previous.confidence)));
  }
  const range = Math.max(...movement) - Math.min(...movement), pitchScale = height * .78 / Math.max(1, range);
  const rawY = movement.map(value => layout.startPosition.y - value * pitchScale);
  const shift = Math.max(0, layout.bounds.top - Math.min(...rawY)) - Math.max(0, Math.max(...rawY) - layout.bounds.bottom);
  const weights = phrase.notes.map(note => (note.end - note.start) ** .65), total = weights.reduce((sum, value) => sum + value, 0);
  const notes: TrajectoryNote[] = [], contactRuns: StrokePoint[][] = [];
  let travelled = 0, position = { ...layout.startPosition }, current: StrokePoint[] = [];
  for (let index = 0; index < phrase.notes.length; index++) {
    const note = phrase.notes[index]!, priorNote = phrase.notes[index - 1];
    const lifted = priorNote && note.start > priorNote.end;
    if (lifted) { contactRuns.push(assignGestureVelocities(current)); current = []; }
    const onset = pigmentPoint(context, note.start, position, note.confidence, note.amplitude, note.midi);
    notes.push({ start: note.start, end: note.end, midi: note.midi, confidence: note.confidence,
      interval: priorNote ? note.midi - priorNote.midi : 0, x: position.x, y: position.y });
    if (!current.length) current.push(onset);
    else {
      // A touching note keeps position and pressure continuous while its new pigment begins here.
      current.at(-1)!.color = onset.color;
    }
    travelled += weights[index]! / total;
    const end = { x: layout.startPosition.x + (layout.endPosition.x - layout.startPosition.x) * travelled,
      y: Math.max(layout.bounds.top, Math.min(layout.bounds.bottom, rawY[index]! + shift)) };
    const duration = note.end - note.start;
    const candidates = [...sampleTimes(note.start, note.end, context), note.start + duration * .5].sort((a, b) => a - b);
    const times = candidates.filter((time, sampleIndex) => time > note.start && (!sampleIndex || time - candidates[sampleIndex - 1]! > 1e-9));
    if (times.at(-1) !== note.end) times[times.length - 1] = note.end;
    const from = position;
    for (const time of times) {
      const u = (time - note.start) / duration;
      // A sustained ribbon can bow gently; interval-directed endpoints remain primary.
      const bow = 4 * u * (1 - u) * height * .045 * note.confidence * (index % 2 ? -1 : 1);
      const point = pigmentPoint(context, time, { x: from.x + (end.x - from.x) * u,
        y: Math.max(layout.bounds.top, Math.min(layout.bounds.bottom, from.y + (end.y - from.y) * u + bow)) }, note.confidence, note.amplitude, note.midi);
      if (current.at(-1)?.time === point.time) current[current.length - 1] = point;
      else current.push(point);
    }
    position = end;
  }
  if (current.length > 1) contactRuns.push(assignGestureVelocities(current));
  smoothPigment(contactRuns, context.previousPigment);
  return { phraseId: phrase.id, start: phrase.start, end: phrase.end, contactRuns, notes,
    startPosition: contactRuns[0]?.[0] ?? layout.startPosition, endPosition: position, confidence: phrase.confidence };
}

/** Explicit low-specificity DSP alternative: measured brightness, never invented MIDI notes. */
export function planFeatureTrajectory(id: string, frames: FeatureFrame[], start: number, end: number, context: CompositionContext): PlannedGesture {
  const { layout } = context, points: StrokePoint[] = [];
  const times = sampleTimes(start, end, context);
  let priorY = layout.startPosition.y, priorTime = start;
  for (const time of times) {
    const feature = featureAt(frames, time), progress = (time - start) / (end - start);
    const targetY = layout.startPosition.y + ((feature?.brightness ?? .5) - (frames[0]?.brightness ?? .5)) * (layout.bounds.bottom - layout.bounds.top) * .8;
    priorY += (targetY - priorY) * (1 - Math.exp(-(time - priorTime) / .6));
    points.push(pigmentPoint(context, time, { x: layout.startPosition.x + (layout.endPosition.x - layout.startPosition.x) * progress,
      y: Math.max(layout.bounds.top, Math.min(layout.bounds.bottom, priorY)) }, .35, .6));
    priorTime = time;
  }
  smoothPigment([points], context.previousPigment);
  return { phraseId: id, start, end, contactRuns: [assignGestureVelocities(points)], notes: [],
    startPosition: points[0]!, endPosition: points.at(-1)!, confidence: .35 };
}
