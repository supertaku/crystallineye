import type { NoteEvent } from './analysis-schema';
import type { MelodicContour } from './phrase-types';

/** Confidence softens interpretation; raw intervals remain available for diagnostics. */
export function describeMelodicContour(notes: NoteEvent[]): MelodicContour {
  const intervalChanges = notes.slice(1).map((note, index) => note.midi - notes[index]!.midi);
  let ascending = 0, descending = 0, register = 0, weight = 0;
  for (let index = 0; index < notes.length; index++) {
    const note = notes[index]!, duration = note.end - note.start;
    register += note.midi * duration; weight += duration;
    if (!index) continue;
    const change = intervalChanges[index - 1]! * Math.min(note.confidence, notes[index - 1]!.confidence);
    ascending += Math.max(0, change); descending += Math.max(0, -change);
  }
  const travel = ascending + descending;
  const direction = travel < .5 ? 'stable' : Math.min(ascending, descending) > Math.max(ascending, descending) * .32
    ? 'mixed' : ascending > descending ? 'ascending' : 'descending';
  return { direction, intervalChanges, register: weight ? register / weight : 60,
    netInterval: notes.length > 1 ? notes.at(-1)!.midi - notes[0]!.midi : 0 };
}
