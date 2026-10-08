import type { ChromaFrame, NoteEvent } from './analysis-schema';

export function chromaFromNotes(notes: NoteEvent[], duration: number, hop = 0.2): ChromaFrame[] {
  const result: ChromaFrame[] = [];
  const active: NoteEvent[] = [];
  let index = 0;
  const sorted = [...notes].sort((a, b) => a.start - b.start);
  for (let time = 0; time < duration; time += hop) {
    while (index < sorted.length && sorted[index]!.start <= time) active.push(sorted[index++]!);
    const values = Array<number>(12).fill(0);
    for (let i = active.length - 1; i >= 0; i--) {
      const note = active[i]!;
      if (note.end <= time) { active.splice(i, 1); continue; }
      const pitchClass = note.midi % 12;
      values[pitchClass] = values[pitchClass]! + note.amplitude * note.confidence;
    }
    const sum = values.reduce((a, b) => a + b, 0);
    result.push({ time, values: values.map((v) => sum > 0 ? v / sum : 0) });
  }
  return result;
}
