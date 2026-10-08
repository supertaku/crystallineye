import type { FeatureFrame, MusicAnalysis, NoteEvent } from '../analysis/analysis-schema';
import { segmentPhrases } from '../analysis/phrase-segmenter';
import { cubicPosition, cubicVelocity, strokeSegments } from '../paint/scene-runtime';
import { choosePhraseLayout, createPhraseLayoutState, retainGestureOccupancy } from './phrase-layout';
import { planFeatureTrajectory, planPhraseTrajectory, type PlannedGesture } from './trajectory-planner';
import type { PaletteKeyframe, PhraseDiagnostic, SceneEvent, StrokeEvent, StrokePoint } from './schema';

function pointAt(points: StrokePoint[], time: number): StrokePoint {
  const exact = points.find(point => point.time === time);
  if (exact) return { ...exact, velocity: exact.velocity && { ...exact.velocity } };
  const segments = strokeSegments(points), index = segments.findIndex(segment => segment.start < time && segment.end > time);
  const segment = segments[index]!, u = (time - segment.start) / (segment.end - segment.start);
  const from = points[index]!, to = points[index + 1]!, blend = u * u * (3 - 2 * u);
  return { ...cubicPosition(segment, u), time, velocity: cubicVelocity(segment, u),
    width: from.width + (to.width - from.width) * blend, opacity: from.opacity + (to.opacity - from.opacity) * blend, color: from.color };
}

/** Scene slices are a renderer allocation detail; they retain the same phrase and cubic. */
export function slicePlannedGesture(planned: PlannedGesture, scenes: SceneEvent[]): StrokeEvent[] {
  const strokes: StrokeEvent[] = [];
  for (let runIndex = 0; runIndex < planned.contactRuns.length; runIndex++) {
    const run = planned.contactRuns[runIndex]!, runStart = run[0]!.time, runEnd = run.at(-1)!.time;
    const boundaryPoints = new Map<number, StrokePoint>();
    for (const scene of scenes) {
      const start = Math.max(runStart, scene.start), end = Math.min(runEnd, scene.end);
      if (end <= start) continue;
      for (const time of [start, end]) if (!boundaryPoints.has(time)) boundaryPoints.set(time, pointAt(run, time));
      const points = [boundaryPoints.get(start)!, ...run.filter(point => point.time > start && point.time < end), boundaryPoints.get(end)!];
      strokes.push({ id: `${planned.phraseId}-contact-${runIndex}-scene-${scene.index}`, phraseId: planned.phraseId,
        sceneIndex: scene.index, start, end, points, confidence: planned.confidence });
    }
  }
  return strokes;
}

function soundingFeatureRuns(analysis: MusicAnalysis): { start: number; end: number; frames: FeatureFrame[] }[] {
  const runs: { start: number; end: number; frames: FeatureFrame[] }[] = [];
  let current: typeof runs[number] | undefined;
  for (let index = 0; index < analysis.dynamics.length; index++) {
    const frame = analysis.dynamics[index]!, next = analysis.dynamics[index + 1];
    const end = Math.min(analysis.track.duration, next?.time ?? analysis.track.duration);
    if (frame.rms <= 1e-5 || end <= frame.time) { current = undefined; continue; }
    if (!current) { current = { start: frame.time, end, frames: [frame] }; runs.push(current); }
    else { current.end = end; current.frames.push(frame); }
  }
  return runs;
}

/** Compose once from selected notes; the painter receives complete timed geometry. */
export function generatePhraseGestures(analysis: MusicAnalysis, scenes: SceneEvent[], selectedMelody: NoteEvent[], paletteTimeline: PaletteKeyframe[]): { strokes: StrokeEvent[]; phrases: PhraseDiagnostic[] } {
  const state = createPhraseLayoutState(), sceneEnds = new Map(scenes.map(scene => [scene.index, scene.end]));
  const strokes: StrokeEvent[] = [], phrases: PhraseDiagnostic[] = [];
  const sceneAt = (time: number) => scenes.find(scene => scene.start <= time && scene.end > time) ?? scenes.at(-1)!;
  if (analysis.notes.length) {
    for (const phrase of segmentPhrases(selectedMelody, analysis)) {
      const scene = sceneAt(phrase.start);
      const layout = choosePhraseLayout({ start: phrase.start, end: phrase.end,
        soundingSeconds: phrase.notes.reduce((sum, note) => sum + note.end - note.start, 0), energy: phrase.averageEnergy,
        register: phrase.contour.register, pitchSpan: phrase.pitchMax - phrase.pitchMin, direction: phrase.contour.direction, sceneIndex: scene.index }, state);
      const planned = planPhraseTrajectory(phrase, { analysis, layout, paletteTimeline, previousPigment: state.previous?.pigment });
      const marks = slicePlannedGesture(planned, scenes);
      strokes.push(...marks); retainGestureOccupancy(state, marks, sceneEnds);
      phrases.push({ id: phrase.id, start: phrase.start, end: phrase.end, direction: phrase.contour.direction, source: 'selected-melody',
        confidence: phrase.confidence, restThreshold: phrase.restThreshold, boundaryReason: phrase.boundaryReason,
        placementReason: layout.reason, notes: planned.notes, placement: { ...layout, endPosition: planned.endPosition } });
    }
  } else {
    // No transcription means no MIDI events. This remains an explicit measured fallback.
    for (const [index, run] of soundingFeatureRuns(analysis).entries()) {
      const first = run.frames[0]!, last = run.frames.at(-1)!;
      const trend = last.brightness - first.brightness;
      const direction = Math.abs(trend) < .08 ? 'stable' : trend > 0 ? 'ascending' : 'descending';
      const energy = run.frames.reduce((sum, frame) => sum + frame.energy, 0) / run.frames.length;
      const layout = choosePhraseLayout({ start: run.start, end: run.end, soundingSeconds: run.end - run.start, energy,
        register: 60, pitchSpan: 12 * Math.abs(trend), direction, sceneIndex: sceneAt(run.start).index }, state);
      const id = `feature-phrase-${index}`, planned = planFeatureTrajectory(id, run.frames, run.start, run.end,
        { analysis, layout, paletteTimeline, previousPigment: state.previous?.pigment });
      const marks = slicePlannedGesture(planned, scenes);
      strokes.push(...marks); retainGestureOccupancy(state, marks, sceneEnds);
      phrases.push({ id, start: run.start, end: run.end, direction, source: 'dsp-fallback', confidence: .35,
        restThreshold: 0, boundaryReason: index ? 'decoded-silence' : 'track-start', placementReason: `${layout.reason} Measured brightness supplies the contour; pitch is unavailable.`,
        notes: [], placement: { ...layout, endPosition: planned.endPosition } });
    }
  }
  return { strokes, phrases };
}
