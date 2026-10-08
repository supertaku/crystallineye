import type { NoteEvent } from './analysis-schema';

/** Select one coherent line through polyphonic note groups; this is an artistic abstraction. */
export function extractMelody(notes: NoteEvent[]): NoteEvent[] {
  const groups: NoteEvent[][] = [];
  for (const note of [...notes].filter((n) => n.confidence >= 0.15 && n.end - n.start >= 0.06).sort((a, b) => a.start - b.start)) {
    const group = groups[groups.length - 1];
    if (group && Math.abs(group[0]!.start - note.start) <= 0.04) group.push(note);
    else groups.push([note]);
  }
  if (!groups.length) return [];
  // Cap each simultaneous group to keep dense full mixes bounded.
  const candidates = groups.map((group) => group.sort((a, b) => b.confidence - a.confidence).slice(0, 16));
  const scores: number[][] = [], previous: number[][] = [];
  candidates.forEach((group, index) => {
    scores[index] = []; previous[index] = [];
    group.forEach((note, candidate) => {
      const local = note.confidence * 2 + note.amplitude * 0.4 + Math.min(1, note.end - note.start) * 0.5;
      let best = local, from = -1;
      if (index > 0) {
        best = -Infinity;
        candidates[index - 1]!.forEach((last, lastIndex) => {
          const gap = Math.max(0, note.start - last.end);
          const jump = Math.abs(note.midi - last.midi);
          const transition = gap > 2 ? 0 : Math.min(2, jump / 12) + (jump > 12 ? 0.5 : 0);
          const value = scores[index - 1]![lastIndex]! + local - transition;
          if (value > best) { best = value; from = lastIndex; }
        });
      }
      scores[index]![candidate] = best; previous[index]![candidate] = from;
    });
  });
  let selected = scores[scores.length - 1]!.reduce((best, score, i, all) => score > all[best]! ? i : best, 0);
  const line: NoteEvent[] = [];
  for (let group = candidates.length - 1; group >= 0; group--) {
    line.push({ ...candidates[group]![selected]! });
    selected = previous[group]![selected]!;
  }
  line.reverse();
  return line.map((note, i) => ({ ...note, end: Math.min(note.end, line[i + 1]?.start ?? Infinity) })).filter((note) => note.end - note.start >= 0.05);
}
