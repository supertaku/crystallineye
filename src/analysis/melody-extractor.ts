import type { NoteEvent } from './analysis-schema';

const CANDIDATES_PER_ONSET = 16;
const PATH_FRONTIER = 16;
const OVERLAP_ALLOWANCE = 0.25;
const PHRASE_REST = 1.2;

type PathState = { note: NoteEvent; score: number; previous: number };
const noteOrder = (a: NoteEvent, b: NoteEvent) => a.start - b.start || b.confidence - a.confidence ||
  b.end - a.end || a.midi - b.midi || b.amplitude - a.amplitude;

/** A bounded interval path through polyphonic predictions, not a vocal transcription.
 * A path can skip an onset while a held note continues. Only small overlaps may
 * trim a held note; phrase rests reset the pitch penalty without filling silence.
 */
export function extractMelody(notes: NoteEvent[]): NoteEvent[] {
  const groups: NoteEvent[][] = [];
  for (const note of [...notes].filter(n => n.confidence >= 0.15 && n.end - n.start >= 0.06).sort(noteOrder)) {
    const group = groups[groups.length - 1];
    if (group && note.start - group[0]!.start <= 0.04) group.push(note);
    else groups.push([note]);
  }
  if (!groups.length) return [];
  // Duration alone selects bass drones in a full mix. A soft, data-derived
  // register prior keeps the contour near the mixture's central pitch range.
  // It identifies neither singer nor instrument and allows confident excursions.
  const pitches = groups.flat().map(note => note.midi).sort((a, b) => a - b);
  const centralPitch = pitches[Math.floor((pitches.length - 1) * .5)]!;
  const strength = (note: NoteEvent) => Math.max(0.3, 0.6 + note.confidence * 2 + note.amplitude * 0.3 -
    Math.min(1.8, Math.max(0, Math.abs(note.midi - centralPitch) - 10) * 0.1));

  const states: PathState[] = [];
  let frontier: number[] = [];
  // Min-heap of paths that still overlap the current onset. A full-track scan
  // costs O(n log n + n * 16), with at most 16 alternatives per onset group.
  const pending: number[] = [];
  const sooner = (a: number, b: number) => states[a]!.note.end < states[b]!.note.end ||
    (states[a]!.note.end === states[b]!.note.end && a < b);
  const push = (value: number) => {
    pending.push(value);
    let index = pending.length - 1;
    while (index > 0) {
      const parent = (index - 1) >> 1;
      if (!sooner(pending[index]!, pending[parent]!)) break;
      [pending[index], pending[parent]] = [pending[parent]!, pending[index]!]; index = parent;
    }
  };
  const pop = () => {
    const first = pending[0]!;
    const last = pending.pop()!;
    if (pending.length) {
      pending[0] = last;
      let index = 0;
      while (index * 2 + 1 < pending.length) {
        const left = index * 2 + 1, right = left + 1;
        const child = right < pending.length && sooner(pending[right]!, pending[left]!) ? right : left;
        if (!sooner(pending[child]!, pending[index]!)) break;
        [pending[index], pending[child]] = [pending[child]!, pending[index]!]; index = child;
      }
    }
    return first;
  };
  let bestIndex = -1;
  for (const group of groups) {
    const latestStart = group[group.length - 1]!.start;
    while (pending.length && states[pending[0]!]!.note.end <= latestStart + OVERLAP_ALLOWANCE) {
      frontier.push(pop());
      frontier.sort((a, b) => states[b]!.score - states[a]!.score || a - b);
      frontier = frontier.slice(0, PATH_FRONTIER);
    }
    const added: number[] = [];
    for (const note of [...group].sort((a, b) => b.confidence - a.confidence || noteOrder(a, b)).slice(0, CANDIDATES_PER_ONSET)) {
      const local = strength(note) * Math.min(3, note.end - note.start) + note.confidence * 0.05;
      let best = local, previous = -1;
      for (const index of frontier) {
        const last = states[index]!;
        // Simultaneous candidates cannot become successive melody notes.
        if (note.start - last.note.start < 0.06 || last.note.end - note.start > OVERLAP_ALLOWANCE) continue;
        const gap = Math.max(0, note.start - last.note.end);
        const jump = Math.abs(note.midi - last.note.midi);
        const pitchPenalty = gap >= PHRASE_REST ? 0 : Math.min(2.5, jump * 0.045 + (jump > 12 ? 0.3 : 0) + (jump > 24 ? 0.4 : 0));
        const trimmed = Math.max(0, last.note.end - note.start) * strength(last.note);
        const value = last.score + local - pitchPenalty - trimmed - Math.min(PHRASE_REST, gap) * 0.25;
        if (value > best) { best = value; previous = index; }
      }
      const index = states.length;
      states.push({ note, score: best, previous }); added.push(index);
      if (bestIndex < 0 || best > states[bestIndex]!.score) bestIndex = index;
    }
    added.forEach(push);
  }
  const line: NoteEvent[] = [];
  for (let index = bestIndex; index >= 0; index = states[index]!.previous) line.push({ ...states[index]!.note });
  line.reverse();
  return line.map((note, i) => ({ ...note, end: Math.min(note.end, line[i + 1]?.start ?? Infinity) }))
    .filter(note => note.end - note.start >= 0.05);
}
