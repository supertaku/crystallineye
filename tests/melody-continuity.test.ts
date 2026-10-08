import test from 'node:test';
import assert from 'node:assert/strict';
import { extractMelody } from '../src/analysis/melody-extractor';
import type { NoteEvent } from '../src/analysis/analysis-schema';

const note = (start: number, end: number, midi: number, confidence = .9): NoteEvent =>
  ({ start, end, midi, confidence, amplitude: .8 });

test('held melody survives short interleaved accompaniment onsets', () => {
  const notes = [note(0, 2, 60), note(.5, .7, 84, .8), note(1, 1.2, 43, .8), note(1.5, 1.7, 88, .8), note(2, 3, 62)];
  assert.deepEqual(extractMelody(notes).map(n => [n.start, n.end, n.midi]), [[0, 2, 60], [2, 3, 62]]);
});

test('a connected contour can trim a small transcription overlap', () => {
  const notes = [60, 62, 64, 65].flatMap((midi, i) => [note(i, i + 1.2, midi), note(i, i + .4, i % 2 ? 90 : 30, .8)]);
  const melody = extractMelody(notes);
  assert.deepEqual(melody.map(n => n.midi), [60, 62, 64, 65]);
  assert.ok(melody.every((n, i) => n.end <= (melody[i + 1]?.start ?? Infinity)));
});

test('a real rest resets pitch continuity and stays unpainted', () => {
  const melody = extractMelody([note(0, .8, 48), note(4, 5, 84)]);
  assert.deepEqual(melody.map(n => [n.start, n.end, n.midi]), [[0, .8, 48], [4, 5, 84]]);
});

test('selection is deterministic for reordered simultaneous candidates and leaves input unchanged', () => {
  const notes = [note(0, 1, 60), note(0, 1, 72), note(1, 2, 62), note(1, 2, 74)];
  const saved = structuredClone(notes);
  assert.deepEqual(extractMelody(notes), extractMelody([...notes].reverse()));
  assert.deepEqual(notes, saved);
});

test('low confidence events and brief noise cannot fill a rest', () => {
  assert.deepEqual(extractMelody([note(0, 1, 60, .1), note(2, 2.03, 70)]), []);
});

test('long bass notes do not automatically replace an active central-register contour', () => {
  const notes = [note(0, 3, 30, .8), ...[60, 62, 64, 65, 64, 62].map((midi, i) => note(i * .5, (i + 1) * .5, midi, .8))];
  const melody = extractMelody(notes);
  assert.ok(melody.length > 1);
  assert.ok(melody.every(n => n.midi >= 60));
});
