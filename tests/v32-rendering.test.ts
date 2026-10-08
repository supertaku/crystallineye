import test from 'node:test';
import assert from 'node:assert/strict';
import type { PhraseDiagnostic, StrokeEvent, StrokePoint, VisualScore } from '../src/visual-score/schema';
import { createTrajectoryDiagnostics, trajectoryWindowKeyAt } from '../src/paint/trajectory-diagnostics';
import { brushStateAt, cubicVelocity, prepareStrokeGeometry, ribbonPolygonAt, strokeSegments } from '../src/paint/scene-runtime';
import { ScorePlayer } from '../src/paint/score-player';

const point = (time: number, x: number, y: number): StrokePoint => ({ time, x, y, width: .015, opacity: .75, color: '#82c3d5', velocity: { x: .015, y: -.01 } });
const phrase: PhraseDiagnostic = { id: 'phrase-0', start: 1, end: 15, direction: 'mixed', source: 'selected-melody', confidence: .8,
  restThreshold: .8, boundaryReason: 'selected notes after a phrase-level rest', placementReason: 'Continue into available upper canvas space.',
  notes: [{ start: 1, end: 4, midi: 60, confidence: .9, interval: 0, x: .12, y: .7 },
    { start: 4, end: 6, midi: 62, confidence: .8, interval: 2, x: .3, y: .5 },
    { start: 6.6, end: 15, midi: 59, confidence: .7, interval: -3, x: .5, y: .8 }] };
const strokes: StrokeEvent[] = [
  { id: 'first', sceneIndex: 0, start: 1, end: 6, phraseId: phrase.id, confidence: .8, points: [point(1, .12, .7), point(4, .3, .5), point(6, .4, .6)] },
  { id: 'before-section', sceneIndex: 0, start: 6.6, end: 10, phraseId: phrase.id, confidence: .8, points: [point(6.6, .5, .8), point(10, .65, .65)] },
  { id: 'after-section', sceneIndex: 1, start: 10, end: 15, phraseId: phrase.id, confidence: .8, points: [point(10, .65, .65), point(15, .8, .45)] },
  { id: 'next-phrase', sceneIndex: 1, start: 18, end: 22, confidence: .7, points: [point(18, .8, .45), point(22, .3, .25)] },
];
const score: VisualScore = { version: 'v32-test', analysisKey: 'fixture', trackHash: '0'.repeat(64), duration: 25,
  scenes: [0, 1].map((index) => ({ index, start: index === 0 ? 0 : 10, end: index === 0 ? 10 : 25,
    palette: { ink: '#82c3d5', support: '#d7a477', wash: '#443377', background: '#14131b' }, brushStyle: 'wet', density: 1, backgroundFlow: 0, seed: index })),
  strokes, accents: [{ strokeId: 'first', time: 4, duration: .4, pressure: .9 }], drops: [], washes: [], trajectoryDiagnostics: { mode: 'phrases', phrases: [phrase] } };

test('trajectory diagnostics explain the selected note and use the painter exact-time tip', () => {
  const index = createTrajectoryDiagnostics(score), frame = index.diagnosticAt(4.2);
  assert.equal(frame.activePhrase?.id, phrase.id);
  assert.equal(frame.activeNote?.midi, 62);
  assert.equal(frame.activeNote?.interval, 2);
  assert.equal(frame.activeGesture?.id, 'first');
  assert.equal(frame.previousGesture, null);
  assert.equal(frame.nextGesture?.id, 'before-section');
  assert.deepEqual(frame.brush, brushStateAt(strokes[0]!, 4.2, score.accents));
  assert.match(frame.movementExplanation, /rises 2 semitones/);
  assert.match(frame.movementExplanation, /2\.000s duration/);
  assert.match(frame.movementExplanation, /available upper canvas space/);
  assert.ok(frame.brush!.pressure > 1);
});

test('a note gap inside a phrase keeps the explanation but lifts contact', () => {
  const frame = createTrajectoryDiagnostics(score).diagnosticAt(6.3);
  assert.equal(frame.activePhrase?.id, phrase.id);
  assert.equal(frame.activeNote, null);
  assert.equal(frame.activeGesture, null);
  assert.equal(frame.brush, null);
  assert.equal(frame.previousGesture?.id, 'first');
  assert.equal(frame.nextGesture?.id, 'before-section');
  assert.match(frame.movementExplanation, /resting.*brush contact is lifted/);
});

test('gesture windows and note ownership use half-open musical intervals', () => {
  const index = createTrajectoryDiagnostics(score);
  assert.equal(index.diagnosticAt(4).activeNote?.midi, 62);
  assert.equal(index.diagnosticAt(6).activeNote, null);
  assert.equal(index.diagnosticAt(6).activeGesture, null);
  const joined = index.diagnosticAt(10);
  assert.equal(joined.previousGesture?.id, 'before-section');
  assert.equal(joined.activeGesture?.id, 'after-section');
  assert.equal(joined.activePhrase?.id, phrase.id);
  assert.equal(joined.activeNote?.midi, 59);
  assert.equal(index.diagnosticAt(15).activePhrase, null);
  assert.equal(index.diagnosticAt(15).activeGesture, null);
  assert.equal(index.diagnosticAt(0).nextGesture?.id, 'first');
});

test('diagnostic pause and arbitrary seeks are deterministic and keep prepared cubics', () => {
  const inputBefore = JSON.stringify(score), index = createTrajectoryDiagnostics(score), segments = index.gestures[0]!.segments;
  const direct = index.diagnosticAt(11.7);
  for (const time of [24, 0, 6.3, 4.2, 18, 22, 10, 14]) index.diagnosticAt(time);
  assert.deepEqual(index.diagnosticAt(11.7), direct);
  assert.deepEqual(index.diagnosticAt(11.7), createTrajectoryDiagnostics(score).diagnosticAt(11.7));
  assert.equal(index.gestures[0]!.segments, segments);
  assert.equal(JSON.stringify(score), inputBefore);
  assert.equal(index.diagnosticAt(-7).time, 0);
  assert.equal(index.diagnosticAt(Number.NaN).time, 0);
  assert.equal(index.diagnosticAt(99).time, score.duration);
});

test('overlay selection changes at gesture boundaries instead of at every note or frame', () => {
  const index = createTrajectoryDiagnostics(score), first = trajectoryWindowKeyAt(index.timings, 1);
  for (const time of [1.1, 2, 3.99, 4, 5.999]) assert.equal(trajectoryWindowKeyAt(index.timings, time), first);
  assert.notEqual(trajectoryWindowKeyAt(index.timings, 6), first);
  assert.notEqual(trajectoryWindowKeyAt(index.timings, 6.6), trajectoryWindowKeyAt(index.timings, 6));
  assert.equal(index.windowAtKey(-2).nextGesture?.id, 'first');
});

test('DSP fallback and legacy diagnostics never invent recognized notes', () => {
  const fallback = structuredClone(score);
  fallback.trajectoryDiagnostics!.phrases[0]!.source = 'dsp-fallback';
  fallback.trajectoryDiagnostics!.phrases[0]!.notes = [];
  const dsp = createTrajectoryDiagnostics(fallback).diagnosticAt(4.2);
  assert.equal(dsp.activeNote, null);
  assert.match(dsp.movementExplanation, /DSP fallback.*no recognized note/);
  delete fallback.trajectoryDiagnostics;
  const legacy = createTrajectoryDiagnostics(fallback).diagnosticAt(4.2);
  assert.equal(legacy.activePhrase, null);
  assert.equal(legacy.activeNote, null);
  assert.match(legacy.movementExplanation, /no retained phrase metadata/);
  assert.deepEqual(legacy.brush, brushStateAt(strokes[0]!, 4.2, score.accents));
});

test('long phrase section slices retain continuous tips, pressure, velocity and visible layers', () => {
  const before = strokes[1]!, after = strokes[2]!;
  assert.deepEqual(brushStateAt(before, 10).position, brushStateAt(after, 10).position);
  assert.equal(brushStateAt(before, 10).width, brushStateAt(after, 10).width);
  const velocityA = cubicVelocity(strokeSegments(before.points).at(-1)!, 1), velocityB = cubicVelocity(strokeSegments(after.points)[0]!, 0);
  assert.ok(Math.hypot(velocityA.x - velocityB.x, velocityA.y - velocityB.y) < 1e-12);
  const player = new ScorePlayer(score);
  for (const time of [9.999, 10, 10.001]) assert.ok(player.frameAt(time).strokes.some((stroke) => stroke.id === 'before-section'));
  assert.ok(player.layersAt(0).some((section) => section.scene.index === 1));
});

test('a sustained gesture longer than the old four-second chunk preserves finished pigment on seek', () => {
  const sustained: StrokeEvent = { id: 'sustain', sceneIndex: 0, start: 1, end: 20, confidence: 1,
    points: [point(1, .15, .3), point(8, .35, .4), point(20, .8, .6)] };
  const geometry = prepareStrokeGeometry(sustained), run = geometry.runs[0]!;
  assert.equal(geometry.runs.length, 1);
  const full = ribbonPolygonAt(sustained, geometry, run, 20, 360, 800);
  for (const time of [2, 18, 5, 19, 8]) ribbonPolygonAt(sustained, geometry, run, time, 360, 800);
  assert.deepEqual(ribbonPolygonAt(sustained, geometry, run, 24, 360, 800), full);
  assert.ok(full.every((point) => Number.isFinite(point.x + point.y)));
});
