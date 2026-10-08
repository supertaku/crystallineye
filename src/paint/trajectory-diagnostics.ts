import type { AccentEvent, PhraseDiagnostic, StrokeEvent, TrajectoryNote, VisualScore } from '../visual-score/schema';
import { brushStateOnSegments, strokeSegments, type BrushState, type CubicSegment } from './scene-runtime';

export type GestureTiming = { start: number; end: number };
export type TrajectoryGesture = { stroke: StrokeEvent; segments: CubicSegment[]; accents: AccentEvent[] };
export type TrajectoryWindow = {
  previousGesture: StrokeEvent | null; activeGesture: StrokeEvent | null; nextGesture: StrokeEvent | null;
};
export type TrajectoryDiagnostic = TrajectoryWindow & {
  time: number; activePhrase: PhraseDiagnostic | null; activeNote: TrajectoryNote | null;
  brush: BrushState | null; movementExplanation: string;
};

/** A small boundary key lets the DEV overlay change its mounted guides only at
 * gesture starts/ends. The live tip still follows the exact shared song time. */
export function trajectoryWindowKeyAt(timings: GestureTiming[], time: number): number {
  'worklet';
  const safeTime = Number.isFinite(time) ? time : 0;
  let low = 0, high = timings.length;
  while (low < high) { const mid = (low + high) >>> 1; if (timings[mid]!.start <= safeTime) low = mid + 1; else high = mid; }
  const index = low - 1;
  return index * 2 + (index >= 0 && safeTime < timings[index]!.end ? 1 : 0);
}

function eventAt<T extends GestureTiming>(events: T[], time: number): T | null {
  let low = 0, high = events.length;
  while (low < high) { const mid = (low + high) >>> 1; if (events[mid]!.start <= time) low = mid + 1; else high = mid; }
  const event = events[low - 1];
  return event && time < event.end ? event : null;
}

function explanation(phrase: PhraseDiagnostic | null, note: TrajectoryNote | null, gesture: StrokeEvent | null): string {
  if (!phrase) return gesture
    ? 'This timed gesture has no retained phrase metadata. Its musical movement explanation is unavailable.'
    : 'No active musical phrase; the brush is lifted and existing pigment remains.';
  if (phrase.source === 'dsp-fallback') return `DSP fallback gesture: measured audio features guide movement; no recognized note is available. ${phrase.placementReason}`;
  if (!note) return `The selected melodic contour is resting inside phrase ${phrase.id}; brush contact is lifted. ${phrase.placementReason}`;
  const interval = note.interval > 0 ? `rises ${note.interval} semitones` : note.interval < 0 ? `falls ${Math.abs(note.interval)} semitones` : 'repeats the previous pitch';
  return `Selected MIDI ${note.midi} ${interval}; its measured ${Math.max(0, note.end - note.start).toFixed(3)}s duration sets this movement's time. Phrase direction: ${phrase.direction}; note confidence: ${note.confidence.toFixed(2)}. ${phrase.placementReason}`;
}

/** Prepare once from a score. No raw analysis, phrase inference, or hidden
 * playback history is consulted by subsequent timestamp lookups. */
export function createTrajectoryDiagnostics(score: VisualScore) {
  const accentsByStroke = new Map<string, AccentEvent[]>();
  for (const accent of score.accents) {
    const accents = accentsByStroke.get(accent.strokeId) ?? [];
    accents.push(accent); accentsByStroke.set(accent.strokeId, accents);
  }
  const gestures: TrajectoryGesture[] = [...score.strokes].sort((a, b) => a.start - b.start || a.end - b.end || a.id.localeCompare(b.id))
    .map((stroke) => ({ stroke, segments: strokeSegments(stroke.points), accents: accentsByStroke.get(stroke.id) ?? [] }));
  const timings = gestures.map(({ stroke }) => ({ start: stroke.start, end: stroke.end }));
  const phrases = [...(score.trajectoryDiagnostics?.phrases ?? [])].sort((a, b) => a.start - b.start || a.end - b.end);
  const notesByPhrase = new Map(phrases.map((phrase) => [phrase.id, [...phrase.notes].sort((a, b) => a.start - b.start || a.end - b.end)]));
  function windowAtKey(key: number): TrajectoryWindow {
    const index = Math.floor(key / 2), active = key % 2 === 1;
    return { previousGesture: gestures[active ? index - 1 : index]?.stroke ?? null,
      activeGesture: active ? gestures[index]?.stroke ?? null : null,
      nextGesture: gestures[index + 1]?.stroke ?? null };
  }
  function diagnosticAt(songTime: number): TrajectoryDiagnostic {
    const time = Math.max(0, Math.min(score.duration, Number.isFinite(songTime) ? songTime : 0));
    const key = trajectoryWindowKeyAt(timings, time), window = windowAtKey(key);
    const activePhrase = eventAt(phrases, time), activeNote = activePhrase ? eventAt(notesByPhrase.get(activePhrase.id) ?? [], time) : null;
    const active = key % 2 === 1 ? gestures[Math.floor(key / 2)] : undefined;
    return { time, ...window, activePhrase, activeNote,
      brush: active ? brushStateOnSegments(active.stroke, active.segments, time, active.accents) : null,
      movementExplanation: explanation(activePhrase, activeNote, window.activeGesture) };
  }
  return { gestures, timings, windowAtKey, diagnosticAt };
}

export type TrajectoryDiagnosticIndex = ReturnType<typeof createTrajectoryDiagnostics>;
