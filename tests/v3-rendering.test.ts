import test from 'node:test';
import assert from 'node:assert/strict';
import type { AccentEvent, StrokeEvent, VisualScore } from '../src/visual-score/schema';
import { accentPressureAt, brushStateAt, cubicPosition, cubicVelocity, prepareStrokeGeometry, revealedCubicsAt, ribbonPolygonAt, sceneOpacity, strokeSegments } from '../src/paint/scene-runtime';
import { ScorePlayer } from '../src/paint/score-player';
import { estimateRenderNodes } from '../src/paint/render-diagnostics';
import { composeVisualScore } from '../src/visual-score/composer';
import { createDiagnosticScore } from '../src/visual-score/diagnostics';
import { createComposition, FIXTURE_STYLES } from '../scripts/v3-fixtures';

const stroke: StrokeEvent = { id: 'gesture', sceneIndex: 0, start: 1, end: 7, confidence: 1,
  points: [{ time: 1, x: 0.1, y: 0.25, width: 0.012, opacity: 0.7, color: '#82c3d5' },
    { time: 1.3, x: 0.25, y: 0.4, width: 0.022, opacity: 0.8, color: '#82c3d5' },
    { time: 4, x: 0.55, y: 0.9, width: 0.009, opacity: 0.65, color: '#82c3d5' },
    { time: 7, x: 0.9, y: 0.2, width: 0.015, opacity: 0.72, color: '#d7a477' }] };
const accent = { time: 2, duration: 0.4, strokeId: stroke.id, pressure: 1 } as AccentEvent;
const score: VisualScore = { version: 'test', analysisKey: 'test', trackHash: '0'.repeat(64), duration: 12,
  scenes: [0, 1, 2].map((index) => ({ index, start: index * 4, end: (index + 1) * 4, palette: { ink: '#82c3d5', support: '#d7a477', wash: '#443377', background: '#14131b' }, brushStyle: 'wet', density: 1, backgroundFlow: 0, seed: index })),
  strokes: [stroke], accents: [accent], drops: [], washes: [] };

test('time-parameterized cubics share positions and velocities for uneven musical intervals', () => {
  const segments = strokeSegments(stroke.points);
  for (let index = 1; index < segments.length; index++) {
    assert.deepEqual(cubicPosition(segments[index - 1]!, 1), cubicPosition(segments[index]!, 0));
    const incoming = cubicVelocity(segments[index - 1]!, 1), outgoing = cubicVelocity(segments[index]!, 0);
    assert.ok(Math.hypot(incoming.x - outgoing.x, incoming.y - outgoing.y) < 1e-12);
    const before = brushStateAt(stroke, segments[index]!.start - 1e-7), after = brushStateAt(stroke, segments[index]!.start + 1e-7);
    assert.ok(Math.hypot(before.position.x - after.position.x, before.position.y - after.position.y) < 1e-6);
    assert.ok(Math.abs(before.width - after.width) < 1e-8);
  }
});

test('shared tangent limiting keeps sampled cubic geometry finite and inside the canvas', () => {
  const edges = structuredClone(stroke);
  edges.points[1]!.x = 0.99; edges.points[1]!.y = 0.01; edges.points[2]!.x = 0.01; edges.points[2]!.y = 0.99;
  for (const segment of strokeSegments(edges.points)) for (let step = 0; step <= 100; step++) {
    const point = cubicPosition(segment, step / 100), velocity = cubicVelocity(segment, step / 100);
    assert.ok(Number.isFinite(point.x + point.y + velocity.x + velocity.y));
    assert.ok(point.x >= 0 && point.x <= 1 && point.y >= 0 && point.y <= 1);
  }
});

test('sub-millisecond musical intervals reach their endpoint without a clamp-induced jump', () => {
  const short = structuredClone(stroke);
  short.points[1]!.time = 1.0005;
  const before = brushStateAt(short, 1.0005 - 1e-10), after = brushStateAt(short, 1.0005);
  assert.ok(Math.hypot(before.position.x - after.position.x, before.position.y - after.position.y) < 1e-6);
});

test('brush lookup freezes at absolute time and reconstructs after forward/backward seeks', () => {
  const direct = brushStateAt(stroke, 2.2, [accent]);
  for (const time of [1.1, 6, 7, 4, 2.2, 9, 0]) brushStateAt(stroke, time, [accent]);
  assert.deepEqual(brushStateAt(stroke, 2.2, [accent]), direct);
  assert.equal(brushStateAt(stroke, 0).contact, false);
  assert.equal(brushStateAt(stroke, 2).contact, true);
  assert.equal(brushStateAt(stroke, 7).contact, false);
  const revealed = revealedCubicsAt(strokeSegments(stroke.points), 2.2);
  assert.ok(Math.hypot(revealed.at(-1)!.to.x - direct.position.x, revealed.at(-1)!.to.y - direct.position.y) < 1e-12);
});

test('accents widen only their target deposition and relax smoothly without altering finished paint', () => {
  assert.equal(accentPressureAt([accent], 'another-stroke', 2.2), 1);
  assert.equal(accentPressureAt([accent], stroke.id, 1.9), 1);
  assert.equal(accentPressureAt([accent], stroke.id, 2), 1);
  assert.equal(accentPressureAt([accent], stroke.id, 2.4), 1);
  assert.equal(accentPressureAt([accent], stroke.id, 2.2), 1.32);
  const without = brushStateAt(stroke, 2.2), withAccent = brushStateAt(stroke, 2.2, [accent]);
  assert.ok(withAccent.width > without.width && withAccent.opacity > without.opacity);
  const geometry = prepareStrokeGeometry(stroke, [accent]);
  assert.ok(geometry.runs[0]!.samples.some((sample) => Math.abs(sample.time - 2.2) < 1e-8));
  const completed = ribbonPolygonAt(stroke, geometry, geometry.runs[0]!, 7, 360, 800, [accent]);
  assert.deepEqual(ribbonPolygonAt(stroke, geometry, geometry.runs[0]!, 11, 360, 800, [accent]), completed);
  assert.ok(completed.every((point) => Number.isFinite(point.x + point.y)));
});

test('compatible pigment segments consolidate while retained colors are fixed in geometry', () => {
  const geometry = prepareStrokeGeometry(stroke, [accent]);
  assert.equal(geometry.segments.length, 3);
  assert.equal(geometry.runs.length, 1);
  assert.equal(geometry.runs[0]!.color, stroke.points[0]!.color);
  const nodes = estimateRenderNodes(score, 0);
  assert.equal(nodes.cubicSegments, 3); assert.equal(nodes.strokePaths, 3);
  assert.ok(nodes.drawableNodes < nodes.legacyDrawableNodesForSameLayers);
});

test('incoming scenes mount before boundaries and short scenes keep their dissolving history', () => {
  const player = new ScorePlayer(score);
  const before = player.layersAt(0);
  assert.ok(before.some((section) => section.scene.index === 1));
  assert.equal(sceneOpacity(before.find((section) => section.scene.index === 1)!.scene, 3.999), 0);
  for (const time of [4 - 1e-6, 4, 4 + 1e-6]) {
    assert.ok(before.some((section) => sceneOpacity(section.scene, time) > 0));
  }
  assert.deepEqual(player.frameAt(8.1).scenes.map((scene) => scene.index), [0, 1, 2]);
  assert.equal(player.frameAt(10).scenes.some((scene) => scene.index === 0), false);
  assert.deepEqual(player.frameAt(3.9), new ScorePlayer(score).frameAt(3.9));
});

test('planned endpoint velocities preserve C1 continuity across generated bar and section gestures', async () => {
  const generated = composeVisualScore((await createComposition(FIXTURE_STYLES[0])).analysis);
  let joins = 0;
  for (let index = 1; index < generated.strokes.length; index++) {
    const prior = generated.strokes[index - 1]!, next = generated.strokes[index]!;
    if (next.start - prior.end > .1 + 1e-8) continue;
    const before = cubicVelocity(strokeSegments(prior.points).at(-1)!, 1), after = cubicVelocity(strokeSegments(next.points)[0]!, 0);
    assert.ok(Math.hypot(before.x - after.x, before.y - after.y) < 1e-12);
    assert.deepEqual(prior.points.at(-1)!.velocity, next.points[0]!.velocity);
    joins++;
  }
  assert.ok(joins > 10, 'Exercise multiple musically adjacent gesture boundaries');
});

test('simple diagnostic rendering estimates exactly one brush with no shader or diffusion', () => {
  const nodes = estimateRenderNodes(createDiagnosticScore(), 0);
  assert.equal(nodes.drawableNodes, 1); assert.equal(nodes.shaderNodes, 0); assert.equal(nodes.blurNodes, 0);
});
