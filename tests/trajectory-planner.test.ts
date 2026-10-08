import test from 'node:test';
import assert from 'node:assert/strict';
import type { MusicAnalysis, NoteEvent } from '../src/analysis/analysis-schema';
import { ANALYSIS_SAMPLE_RATE, ANALYSIS_VERSION } from '../src/analysis/versions';
import { segmentPhrases } from '../src/analysis/phrase-segmenter';
import { brushStateAt, cubicPosition, cubicVelocity, strokeSegments } from '../src/paint/scene-runtime';
import { generatePhraseGestures, slicePlannedGesture } from '../src/visual-score/gesture-generator';
import { choosePhraseLayout, createPhraseLayoutState } from '../src/visual-score/phrase-layout';
import { intervalMovement, planPhraseTrajectory } from '../src/visual-score/trajectory-planner';
import { composePaletteTimeline } from '../src/visual-score/palette';
import { composeScenes } from '../src/visual-score/scenes';

const note = (start: number, end: number, midi: number, confidence = .9): NoteEvent => ({ start, end, midi, confidence, amplitude: .7 });
function analysis(notes: NoteEvent[], duration = 30): MusicAnalysis {
  return { version: ANALYSIS_VERSION, track: { hash: '0'.repeat(64), duration, analysisSampleRate: ANALYSIS_SAMPLE_RATE }, notes,
    rhythm: { bpm: 100, beats: [], downbeats: [4, 8, 12].filter(time => time < duration).map(time => ({ time, confidence: .9 })) },
    harmony: { chords: [], chromaFrames: [] }, dynamics: Array.from({ length: duration * 10 }, (_, index) =>
      ({ time: index / 10, rms: .2, energy: .6, bass: .2, brightness: .3 + index / (duration * 20), onset: 0 })),
    structure: { segments: [{ start: 0, end: duration, label: 'song', confidence: .5 }] }, quality: 'FULL', modelVersions: {}, warnings: [] };
}
const generate = (source: MusicAnalysis) => generatePhraseGestures(source, composeScenes(source), source.notes, composePaletteTimeline(source));

test('opposite melodic intervals author opposite screen-space movement; repeated pitches remain restrained', () => {
  for (const pitches of [[60, 62, 64, 67], [67, 64, 62, 60], [60, 60, 60, 60]]) {
    const source = analysis(pitches.map((pitch, index) => note(index, index + 1, pitch))), result = generate(source);
    const first = result.strokes[0]!.points[0]!, last = result.strokes.at(-1)!.points.at(-1)!;
    if (pitches[0]! < pitches.at(-1)!) assert.ok(last.y < first.y - .1);
    else if (pitches[0]! > pitches.at(-1)!) assert.ok(last.y > first.y + .1);
    else assert.ok(Math.abs(last.y - first.y) < .02);
    assert.ok(Math.abs(last.x - first.x) > .3);
    assert.deepEqual(generate(source), result);
  }
});

test('short rests retain one musical phrase but lift contact at exact note onsets and offsets', () => {
  const source = analysis([note(1, 2, 60), note(2.05, 3.5, 62), note(3.5, 5, 64)]), result = generate(source);
  assert.equal(result.phrases.length, 1); assert.equal(result.strokes.length, 2);
  assert.deepEqual(result.strokes.map(stroke => [stroke.start, stroke.end]), [[1, 2], [2.05, 5]]);
  assert.ok(!result.strokes.some(stroke => brushStateAt(stroke, 2.025).contact));
  assert.equal(result.phrases[0]!.notes[1]!.x, result.strokes[1]!.points[0]!.x);
  assert.equal(result.phrases[0]!.notes[1]!.y, result.strokes[1]!.points[0]!.y);
  const prior = result.strokes[0]!.points.at(-1)!, next = result.strokes[1]!.points[0]!;
  assert.equal(prior.x, next.x); assert.equal(prior.y, next.y);
});

test('sustain longer than bars and four seconds remains a timed coherent gesture', () => {
  const result = generate(analysis([note(0, 10, 60)]));
  assert.equal(result.phrases.length, 1); assert.equal(result.strokes.length, 1);
  assert.equal(result.strokes[0]!.end, 10);
  const mid = brushStateAt(result.strokes[0]!, 5);
  assert.equal(mid.contact, true); assert.ok(mid.position.x !== result.strokes[0]!.points[0]!.x);
});

test('confidence gates interval specificity and extreme leaps saturate nonlinearly', () => {
  assert.ok(intervalMovement(24, .2) < intervalMovement(2, .9) * .1);
  assert.ok(intervalMovement(48, .9) < 1.01);
  assert.ok(intervalMovement(24, .9) < intervalMovement(12, .9) * 1.15);
  const source = analysis([note(0, 1, 60), note(1, 2, 72)]), phrase = segmentPhrases(source.notes, source)[0]!;
  const layout = choosePhraseLayout({ start: 0, end: 2, soundingSeconds: 2, energy: .6, register: 60, pitchSpan: 12, direction: 'ascending', sceneIndex: 0 }, createPhraseLayoutState());
  const high = planPhraseTrajectory(phrase, { analysis: source, layout, paletteTimeline: composePaletteTimeline(source) });
  const weak = structuredClone(phrase); weak.notes[1]!.confidence = .2;
  const low = planPhraseTrajectory(weak, { analysis: source, layout, paletteTimeline: composePaletteTimeline(source) });
  assert.ok(Math.abs(low.endPosition.y - low.startPosition.y) < Math.abs(high.endPosition.y - high.startPosition.y) * .1);
});

test('scene slices preserve the exact original Hermite curve, pressure and shared velocity', () => {
  const source = analysis([note(0, 2, 60), note(2, 4, 64)]), phrase = segmentPhrases(source.notes, source)[0]!;
  for (const frame of source.dynamics) frame.energy = Math.min(1, .1 + frame.time * .18);
  source.structure.segments = [{ start: 0, end: 1.2374, label: 'one', confidence: .8 }, { start: 1.2374, end: 30, label: 'two', confidence: .8 }];
  const scenes = composeScenes(source), layout = choosePhraseLayout({ start: 0, end: 4, soundingSeconds: 4, energy: .6, register: 62, pitchSpan: 4, direction: 'ascending', sceneIndex: 0 }, createPhraseLayoutState());
  const planned = planPhraseTrajectory(phrase, { analysis: source, layout, paletteTimeline: composePaletteTimeline(source) });
  const clips = slicePlannedGesture(planned, scenes), before = clips[0]!.points.at(-1)!, after = clips[1]!.points[0]!;
  assert.deepEqual(before, after); assert.equal(clips[0]!.phraseId, clips[1]!.phraseId);
  const original = { ...clips[0]!, start: 0, end: 4, points: planned.contactRuns[0]! };
  assert.ok(planned.contactRuns[0]!.some(point => point.time === 1.2374));
  assert.notEqual(brushStateAt(original, 1.2274).width, brushStateAt(original, 1.2474).width);
  for (const clip of clips) for (const time of [clip.start, (clip.start + clip.end) / 2, clip.end,
    ...[1.2274, 1.2374, 1.2474].filter(time => time >= clip.start && time <= clip.end)]) {
    const a = brushStateAt(original, time), b = brushStateAt(clip, time);
    assert.ok(Math.hypot(a.position.x - b.position.x, a.position.y - b.position.y) < 1e-12);
    assert.ok(Math.hypot(a.velocity.x - b.velocity.x, a.velocity.y - b.velocity.y) < 1e-12);
    assert.ok(Math.abs(a.width - b.width) < 1e-12);
  }
});

test('occupancy placement spreads separated phrases across the canvas and records candidate evidence', () => {
  const notes = Array.from({ length: 12 }, (_, phrase) => [60, 64, 67].map((pitch, index) => note(phrase * 5 + index, phrase * 5 + index + 1, pitch))).flat();
  const source = analysis(notes, 60), result = generate(source), points = result.strokes.flatMap(stroke => stroke.points);
  assert.ok(Math.max(...points.map(point => point.x)) - Math.min(...points.map(point => point.x)) > .55);
  assert.ok(Math.max(...points.map(point => point.y)) - Math.min(...points.map(point => point.y)) > .5);
  assert.ok(result.phrases.every(phrase => phrase.placement!.candidates.length === 18 && phrase.placementReason.includes('rest') || phrase.boundaryReason === 'track-start'));
  for (const stroke of result.strokes) {
    const segments = strokeSegments(stroke.points);
    for (let index = 1; index < segments.length; index++) {
      const a = cubicVelocity(segments[index - 1]!, 1), b = cubicVelocity(segments[index]!, 0);
      assert.ok(Math.hypot(a.x - b.x, a.y - b.y) < 1e-12);
    }
    for (const segment of segments) for (let step = 0; step <= 20; step++) {
      const point = cubicPosition(segment, step / 20);
      assert.ok(Number.isFinite(point.x + point.y) && point.x >= 0 && point.x <= 1 && point.y >= 0 && point.y <= 1);
    }
  }
});

test('DSP fallback contains no fabricated notes, responds to measured contour and leaves silence clear', () => {
  const source = analysis([], 10);
  for (const frame of source.dynamics) if (frame.time >= 4 && frame.time < 6) { frame.rms = 0; frame.energy = 0; }
  const result = generate(source);
  assert.equal(result.phrases.length, 2);
  assert.ok(result.phrases.every(phrase => phrase.source === 'dsp-fallback' && phrase.notes.length === 0));
  assert.ok(!result.strokes.some(stroke => stroke.start < 5 && stroke.end > 5));
  const first = result.strokes[0]!.points[0]!, last = result.strokes[0]!.points.at(-1)!;
  assert.ok(last.y !== first.y);
  source.notes = [note(1, 2, 60, .1)];
  assert.deepEqual(generatePhraseGestures(source, composeScenes(source), [], composePaletteTimeline(source)).strokes, []);
});

test('nearby phrases at canvas edges reject vertical or wrong-direction placements without moving the origin', () => {
  for (const x of [.07, .2, .5, .8, .93]) {
    const state = createPhraseLayoutState();
    state.previous = { position: { x, y: .5 }, end: 1, sceneIndex: 0, pigment: { width: .02, opacity: .7 } };
    const selected = choosePhraseLayout({ start: 1.13, end: 4, soundingSeconds: 2.6, energy: .6,
      register: 62, pitchSpan: 7, direction: 'mixed', sceneIndex: 0 }, state);
    assert.deepEqual(selected.startPosition, { x, y: .5 });
    const span = selected.endPosition.x - selected.startPosition.x;
    assert.ok(Math.abs(span) >= .22);
    assert.ok(selected.candidateId.endsWith(span > 0 ? 'right' : 'left'));
    assert.equal(selected.candidates.find(candidate => candidate.id === selected.candidateId)!.eligible, true);
    assert.ok(selected.candidates.some(candidate => !candidate.eligible && !!candidate.rejectionReason));
    assert.equal(selected.candidates.length, 18);
  }
});

test('full-length DSP fallback bounds feature knots while preserving silence, scene and harmony timing', () => {
  const source = analysis([], 360);
  source.dynamics = Array.from({ length: 15504 }, (_, index) => ({ time: index * 512 / 22050, rms: .2, energy: .6, bass: .2, brightness: .4, onset: 0 }));
  source.structure.segments = [{ start: 0, end: 123.456, label: 'one', confidence: .8 }, { start: 123.456, end: 360, label: 'two', confidence: .8 }];
  source.harmony.chords = [{ start: 0, end: 100.123, root: 0, quality: 'major', confidence: .9 },
    { start: 100.123, end: 360, root: 7, quality: 'major', confidence: .9 }];
  const result = generate(source), points = result.strokes.flatMap(stroke => stroke.points);
  assert.equal(result.phrases.length, 1); assert.equal(result.strokes.length, 2);
  assert.ok(points.length < 1830, `Expected roughly 5 knots/second; got ${points.length}`);
  for (const time of [100.123, 100.723, 123.456]) assert.ok(points.some(point => Math.abs(point.time - time) < 1e-10));
});

test('sustained notes sample palette transitions and retain legacy pigment targets and smoothing', () => {
  const source = analysis([note(0, 10, 60)], 10);
  source.harmony.chords = [{ start: 0, end: 2.123, root: 0, quality: 'major', confidence: .9 },
    { start: 2.123, end: 10, root: 7, quality: 'major', confidence: .9 }];
  for (const frame of source.dynamics) if (frame.time >= 1) frame.energy = 1;
  const result = generate(source), points = result.strokes[0]!.points;
  assert.ok(points.some(point => point.time === 2.123));
  assert.ok(points.some(point => Math.abs(point.time - 2.723) < 1e-10));
  assert.equal(points[0]!.width, .004 + .6 * .027 * (.6 + .7 * .4));
  assert.equal(points[0]!.opacity, (.5 + .6 * .28) * (.45 + .9 * .55));
  const after = points.find(point => point.time >= 1)!;
  assert.ok(after.width > points[0]!.width && after.width < .004 + .027 * (.6 + .7 * .4));
});
