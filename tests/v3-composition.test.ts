import test from 'node:test';
import assert from 'node:assert/strict';
import { createComposition, FIXTURE_STYLES } from '../scripts/v3-fixtures';
import { composeVisualScore } from '../src/visual-score/composer';
import { composePaletteTimeline, paletteAt } from '../src/visual-score/palette';
import { createDiagnosticScore } from '../src/visual-score/diagnostics';
import { brushStateAt } from '../src/paint/scene-runtime';

test('downbeats and section changes preserve the previous brush endpoint and pressure', async () => {
  const { analysis } = await createComposition(FIXTURE_STYLES[0]!);
  const score = composeVisualScore(analysis);
  assert.ok(score.strokes.length > 5);
  for (let index = 1; index < score.strokes.length; index++) {
    const before = score.strokes[index - 1]!.points.at(-1)!, after = score.strokes[index]!.points[0]!;
    assert.equal(after.x, before.x); assert.equal(after.y, before.y); assert.equal(after.width, before.width);
    assert.deepEqual(after.velocity, before.velocity);
  }
  for (const stroke of score.strokes) for (const point of stroke.points) {
    assert.ok([point.x, point.y, point.time, point.width, point.opacity].every(Number.isFinite));
    assert.ok(point.x >= .13 && point.x <= .87 && point.y >= .3 && point.y <= .7);
  }
  assert.deepEqual(composeVisualScore(analysis), score);
});

test('note lengths and rests determine brush contact, with no drawing through silence', async () => {
  const { analysis } = await createComposition(FIXTURE_STYLES[0]!);
  analysis.notes = [
    { start: 1, end: 3, midi: 60, confidence: .9, amplitude: .7 },
    { start: 5, end: 6, midi: 64, confidence: .9, amplitude: .7 },
  ];
  analysis.rhythm.downbeats = [];
  const score = composeVisualScore(analysis);
  assert.equal(score.strokes[0]!.start, 1); assert.equal(score.strokes[0]!.end, 3);
  assert.ok(!score.strokes.some(stroke => stroke.start < 4 && stroke.end > 4));
  assert.equal(brushStateAt(score.strokes[0]!, 4).contact, false);
  analysis.notes = [];
  for (const frame of analysis.dynamics) if (frame.time >= 8 && frame.time <= 10) { frame.rms = 0; frame.energy = 0; }
  const fallback = composeVisualScore(analysis);
  assert.ok(!fallback.strokes.some(stroke => stroke.start < 9 && stroke.end > 9));
  assert.ok(!fallback.drops.some(drop => drop.time >= 8 && drop.time <= 10));
});

test('harmony changes new pigment gradually and uncertain chords preserve the palette', async () => {
  const { analysis } = await createComposition(FIXTURE_STYLES[0]!);
  analysis.harmony.chords = [
    { start: 0, end: 4, root: 0, quality: 'major', confidence: .9 },
    { start: 4, end: 6, root: 7, quality: 'major', confidence: .1 },
    { start: 6, end: 10, root: 7, quality: 'major', confidence: .9 },
    { start: 10, end: analysis.track.duration, root: 7, quality: 'major', confidence: .9 },
  ];
  const timeline = composePaletteTimeline(analysis);
  assert.equal(timeline.length, 2);
  assert.equal(paletteAt(timeline, 4).ink, paletteAt(timeline, 0).ink);
  assert.equal(paletteAt(timeline, 6).ink, paletteAt(timeline, 0).ink);
  assert.notEqual(paletteAt(timeline, 6.3).ink, paletteAt(timeline, 6.7).ink);
  analysis.notes = [];
  const score = composeVisualScore(analysis);
  assert.deepEqual(score.paletteTimeline, timeline);
  const early = score.strokes[0]!.points[0]!.color;
  const pointLater = score.strokes.flatMap(stroke => stroke.points).find(point => point.time >= 6.7)!;
  assert.notEqual(pointLater.color, early);
  assert.equal(score.strokes[0]!.points[0]!.color, early);
});

test('beat pressure is local, causal and measurable; transient drops stay near the brush', async () => {
  const simple = createDiagnosticScore(10), stroke = simple.strokes[0]!;
  const accent = { time: 2, duration: .22, strokeId: stroke.id, pressure: 1 };
  assert.equal(brushStateAt(stroke, 1.99, [accent]).width, brushStateAt(stroke, 1.99).width);
  assert.ok(brushStateAt(stroke, 2.11, [accent]).width > brushStateAt(stroke, 2.11).width);
  assert.equal(brushStateAt(stroke, 3, [accent]).width, brushStateAt(stroke, 3).width);
  const { analysis } = await createComposition(FIXTURE_STYLES[0]!);
  analysis.notes = [];
  const score = composeVisualScore(analysis);
  assert.ok(score.accents.length > 0);
  for (const drop of score.drops) {
    const active = score.strokes.find(mark => mark.start <= drop.time && mark.end >= drop.time)
      ?? score.strokes.findLast(mark => mark.end <= drop.time && drop.time - mark.end <= .35);
    assert.ok(active);
    const tip = brushStateAt(active, drop.time).position;
    assert.ok(Math.hypot(tip.x - drop.position.x, tip.y - drop.position.y) < .05);
  }
});
