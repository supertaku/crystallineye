import test from 'node:test';
import assert from 'node:assert/strict';
import type { MusicAnalysis, NoteEvent } from '../src/analysis/analysis-schema';
import { ANALYSIS_SAMPLE_RATE, ANALYSIS_VERSION } from '../src/analysis/versions';
import { extractMelody } from '../src/analysis/melody-extractor';
import { segmentPhrases } from '../src/analysis/phrase-segmenter';

const note = (start: number, end: number, midi: number, confidence = .9): NoteEvent => ({ start, end, midi, confidence, amplitude: .7 });
function analysis(notes: NoteEvent[], bpm = 100): MusicAnalysis {
  return { version: ANALYSIS_VERSION, track: { hash: '0'.repeat(64), duration: 30, analysisSampleRate: ANALYSIS_SAMPLE_RATE },
    notes, rhythm: { bpm, beats: [], downbeats: [4, 8, 12].map(time => ({ time, confidence: .9 })) },
    harmony: { chords: [], chromaFrames: [] }, dynamics: [], structure: { segments: [{ start: 0, end: 30, label: 'song', confidence: .5 }] },
    quality: 'FULL', modelVersions: {}, warnings: [] };
}

test('ascending, descending, repeated and mixed contours retain measured durations', () => {
  for (const [pitches, direction] of [[[60, 62, 64, 67], 'ascending'], [[67, 64, 62, 60], 'descending'],
    [[60, 60, 60, 60], 'stable'], [[60, 65, 60, 65], 'mixed']] as const) {
    const notes = pitches.map((pitch, index) => note(index, index + 1, pitch)), source = analysis(notes);
    const phrases = segmentPhrases(notes, source);
    assert.equal(phrases.length, 1); assert.equal(phrases[0]!.contour.direction, direction);
    assert.equal(phrases[0]!.start, 0); assert.equal(phrases[0]!.end, 4);
    assert.deepEqual(phrases[0]!.notes, notes);
  }
});

test('a sustained note and touching long melody ignore bar and four-second boundaries', () => {
  const notes = [note(0, 5, 60), note(5, 8, 62), note(8, 15, 64)], source = analysis(notes);
  source.structure.segments = [{ start: 0, end: 7, label: 'one', confidence: .8 }, { start: 7, end: 30, label: 'two', confidence: .8 }];
  const phrases = segmentPhrases(notes, source);
  assert.equal(phrases.length, 1); assert.equal(phrases[0]!.end, 15);
  assert.deepEqual(phrases[0]!.sectionIndices, [0, 1]);
});

test('adaptive rests distinguish quick articulation from phrase-level and long silence', () => {
  const notes = [note(0, 1, 60), note(1.1, 2, 62), note(3.4, 4, 64), note(20, 21, 65)];
  const source = analysis(notes), saved = structuredClone(source), phrases = segmentPhrases(notes, source);
  assert.deepEqual(phrases.map(phrase => [phrase.start, phrase.end]), [[0, 2], [3.4, 4], [20, 21]]);
  assert.ok(phrases.every(phrase => phrase.restThreshold >= .4 && phrase.restThreshold <= 1.2));
  assert.deepEqual(segmentPhrases(notes, source), phrases); assert.deepEqual(source, saved);
  assert.deepEqual(segmentPhrases([...notes].reverse(), source), phrases);
});

test('rest threshold adapts to tempo and can be fixed for controlled comparisons', () => {
  const notes = [note(0, .2, 60), note(.8, 1, 62)];
  assert.equal(segmentPhrases(notes, analysis(notes, 180)).length, 2);
  assert.equal(segmentPhrases(notes, analysis(notes, 50)).length, 1);
  assert.equal(segmentPhrases(notes, analysis(notes, 50), { restSeconds: .5 }).length, 2);
});

test('section and large-interval cues require a real rest; uncertain leaps do not create a boundary', () => {
  const notes = [note(0, 1, 60), note(1.3, 2.3, 84)], source = analysis(notes);
  assert.equal(segmentPhrases(notes, source)[1]!.boundaryReason, 'interval-rest');
  notes[1]!.start = 1;
  assert.equal(segmentPhrases(notes, source).length, 1);
  notes[1]!.start = 1.25; notes[1]!.confidence = .2;
  assert.equal(segmentPhrases(notes, source).length, 1);
  notes[1]!.midi = 62; notes[1]!.start = 1.45;
  source.structure.segments = [{ start: 0, end: 1.2, label: 'one', confidence: .8 }, { start: 1.2, end: 30, label: 'two', confidence: .8 }];
  assert.equal(segmentPhrases(notes, source)[1]!.boundaryReason, 'section-rest');
});

test('bounded polyphonic selection remains separate from phrasing and filters noisy notes', () => {
  const raw = [note(0, 2, 60), note(.5, .7, 84, .8), note(1, 1.2, 43, .8), note(2, 3, 62), note(10, 11, 70, .1)];
  const selected = extractMelody(raw), phrases = segmentPhrases(selected, analysis(raw));
  assert.deepEqual(phrases[0]!.notes.map(event => [event.start, event.end, event.midi]), [[0, 2, 60], [2, 3, 62]]);
  assert.equal(phrases.length, 1);
  assert.deepEqual(segmentPhrases([note(0, 1, 60, .1)], analysis([])), []);
});

test('short contextual rests identify contour resets and cadences without making each downbeat a phrase', () => {
  const notes = [note(0, .5, 60), note(.5, 1, 62), note(1, 1.5, 65), note(1.65, 2, 62),
    note(2, 2.5, 64), note(2.5, 3, 65), note(3.2, 3.7, 65)];
  const source = analysis(notes); source.rhythm.downbeats = [{ time: 1, confidence: .9 }, { time: 3.2, confidence: .9 }];
  const phrases = segmentPhrases(notes, source);
  assert.deepEqual(phrases.map(phrase => phrase.boundaryReason), ['track-start', 'contour-rest', 'cadence-rest']);
  assert.deepEqual(phrases.map(phrase => phrase.start), [0, 1.65, 3.2]);
  notes[3]!.confidence = .2; notes[6]!.confidence = .2;
  assert.equal(segmentPhrases(notes, source).length, 1);
});

test('a short rest at a predicted section is a cue while a section inside a held note is only metadata', () => {
  const notes = [note(0, 2, 60), note(2.13, 3, 62)], source = analysis(notes, 72);
  source.structure.segments = [{ start: 0, end: 2.05, label: 'one', confidence: .5 }, { start: 2.05, end: 30, label: 'two', confidence: .5 }];
  assert.equal(segmentPhrases(notes, source)[1]!.boundaryReason, 'section-rest');
  notes[1]!.start = 2;
  source.structure.segments[0]!.end = 1; source.structure.segments[1]!.start = 1;
  assert.equal(segmentPhrases(notes, source).length, 1);
});
