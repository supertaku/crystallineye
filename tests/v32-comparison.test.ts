import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeScore, ignoredOutputPath, normalizedPath, noteContactMetrics, pathSimilarity, phraseHorizontalMetrics, selectPassages } from '../scripts/compare-v32';
import { createPaintingComparisons } from '../src/visual-score/comparison-modes';
import { createDiagnosticScore } from '../src/visual-score/diagnostics';
import { createComposition, FIXTURE_STYLES } from '../scripts/v3-fixtures';
import type { MusicAnalysis } from '../src/analysis/analysis-schema';

function analysis(): MusicAnalysis {
  return { version: 'analysis-v3.1', track: { hash: '0'.repeat(64), duration: 10, analysisSampleRate: 22050 },
    notes: [], rhythm: { bpm: null, beats: [], downbeats: [] }, harmony: { chords: [], chromaFrames: [] },
    dynamics: [{ time: 0, rms: .1, energy: .5, bass: .2, brightness: .4, onset: .1 }],
    structure: { segments: [{ start: 0, end: 10, label: 'fixture', confidence: 1 }] }, quality: 'BASIC', modelVersions: {}, warnings: [] };
}

test('trajectory metrics distinguish connected teleporting from legitimate lifted repositioning', () => {
  const score = createDiagnosticScore(10), original = score.strokes[0]!;
  original.start = 0; original.end = 2; original.points[1]!.time = 2;
  const lifted = structuredClone(original); lifted.id = 'lifted'; lifted.start = 4; lifted.end = 6;
  lifted.points[0]!.time = 4; lifted.points[1]!.time = 6;
  const connected = structuredClone(lifted); connected.id = 'connected'; connected.start = 6; connected.end = 8;
  connected.points[0]!.time = 6; connected.points[1]!.time = 8;
  score.strokes.push(lifted, connected);
  const metrics = analyzeScore(score, analysis());
  assert.equal(metrics.continuity.connectedPairs, 1);
  assert.equal(metrics.continuity.liftPairs, 1);
  assert.equal(metrics.continuity.unexplainedDiscontinuities, 1);
  assert.ok(metrics.continuity.maxLiftReposition > .6);
  assert.ok(metrics.continuity.maxConnectedPositionGap > .6);
});

test('travel and coverage metrics describe actual geometry while unavailable pitch evidence stays null', () => {
  const metrics = analyzeScore(createDiagnosticScore(10), analysis());
  assert.ok(Math.abs(metrics.totalBrushTravelNormalized - .7) < 1e-10);
  assert.equal(metrics.continuity.invalidSamples, 0);
  assert.ok(metrics.coverage.fraction > 0 && metrics.coverage.fraction < .1);
  assert.equal(metrics.pitchMotion.pearson, null);
  assert.equal(metrics.alignment.phrases.diagnosticsAvailable, false);
  assert.equal(metrics.alignment.noteOnsetKnots.count, 0);
});

test('repeated path metric ignores translation and scale but retains reflection and temporal shape', () => {
  const shape = [{ x: 0, y: 0 }, { x: .2, y: .4 }, { x: .8, y: .6 }, { x: 1, y: 1 }];
  const moved = shape.map(point => ({ x: point.x * 2 + 4, y: point.y * 2 - 1 }));
  const mirrored = shape.map(point => ({ x: point.x, y: -point.y }));
  assert.equal(pathSimilarity([normalizedPath(shape), normalizedPath(moved), normalizedPath(shape)]).fractionWithSimilarPath, 1);
  assert.equal(pathSimilarity([normalizedPath(shape), normalizedPath(moved), normalizedPath(mirrored)]).fractionWithSimilarPath, 2 / 3);
  assert.equal(normalizedPath([{ x: 1, y: 1 }, { x: 1, y: 1 }]), null);
  assert.equal(pathSimilarity([normalizedPath(shape)]).fractionWithSimilarPath, null);
});

test('source-derived comparison artifacts cannot be directed into tracked docs or an escaping path', () => {
  assert.ok(ignoredOutputPath('.build-tools/v32-evidence').endsWith('v32-evidence'));
  assert.ok(ignoredOutputPath('research/results/generated/v32-evidence').endsWith('v32-evidence'));
  assert.throws(() => ignoredOutputPath('docs/v32-evidence'), /must stay under ignored/);
  assert.throws(() => ignoredOutputPath('.build-tools/../docs/v32-evidence'), /must stay under ignored/);
});

test('four comparison modes preserve the full reference and remove only notes for the D ablation', async () => {
  const full = (await createComposition(FIXTURE_STYLES[0]!)).analysis, dsp = structuredClone(full);
  dsp.notes = []; delete dsp.modelVersions.transcription;
  const saved = structuredClone(full), modes = createPaintingComparisons(dsp, full);
  assert.deepEqual(modes.map(mode => mode.mode), ['A', 'B', 'C', 'D']);
  assert.deepEqual(modes[0]!.analysis, dsp);
  assert.deepEqual(modes[1]!.analysis, modes[2]!.analysis);
  for (const key of ['rhythm', 'harmony', 'dynamics', 'structure'] as const) assert.deepEqual(modes[2]!.analysis[key], modes[3]!.analysis[key]);
  assert.equal(modes[3]!.analysis.notes.length, 0);
  assert.equal(modes[3]!.analysis.modelVersions.transcription, undefined);
  assert.deepEqual(full, saved, 'Comparison may not mutate cached reference');
  const wrongSource = structuredClone(full); wrongSource.track.hash = '1'.repeat(64);
  assert.throws(() => createPaintingComparisons(dsp, wrongSource), /same exact source/);
  assert.throws(() => createPaintingComparisons(full, full), /Mode A needs measured DSP/);
  assert.throws(() => createPaintingComparisons(dsp, dsp), /timestamped note evidence/);
});

test('contact metrics measure selected-note gaps without labeling accompaniment as audio silence', () => {
  const reference = analysis();
  reference.notes = [{ start: 1, end: 2, midi: 60, confidence: .9, amplitude: .8 }, { start: 4, end: 5, midi: 62, confidence: .9, amplitude: .8 }];
  const measured = noteContactMetrics(createDiagnosticScore(10), reference);
  assert.equal(measured.selectedNoteUnionSeconds, 2);
  assert.equal(measured.selectedNoteContactFraction, 1);
  assert.equal(measured.internalSelectedGapSeconds, 2);
  assert.equal(measured.contactInsideInternalGaps, 2);
  assert.equal(measured.contactSecondsOutsideSelectedNotes, 8);
});

test('native comparison allows only bounded exact-source decoder duration differences without moving timestamps', () => {
  const reference = analysis();
  reference.notes = [{ start: 1, end: 2, midi: 60, confidence: .9, amplitude: .8 }];
  reference.modelVersions.transcription = 'fixture-transcription';
  const dsp = analysis();
  dsp.track.duration += .069659864;
  dsp.structure.segments[0]!.end = dsp.track.duration;
  const originalDsp = structuredClone(dsp), originalReference = structuredClone(reference);
  assert.throws(() => createPaintingComparisons(dsp, reference), /same exact source/);
  const modes = createPaintingComparisons(dsp, reference, { allowNativeDurationDifference: true });
  assert.equal(modes[0]!.analysis.track.duration, dsp.track.duration);
  assert.deepEqual(modes[0]!.analysis.dynamics, dsp.dynamics);
  assert.match(modes[0]!.analysis.warnings.at(-1)!, /69\.66 ms longer.*timestamps are unchanged/);
  assert.deepEqual(modes[1]!.analysis, reference);
  assert.deepEqual(modes[2]!.analysis, reference);
  assert.deepEqual(dsp, originalDsp);
  assert.deepEqual(reference, originalReference);
  const excessive = structuredClone(dsp); excessive.track.duration = reference.track.duration + .101;
  excessive.structure.segments[0]!.end = excessive.track.duration;
  assert.throws(() => createPaintingComparisons(excessive, reference, { allowNativeDurationDifference: true }), /same exact source/);
  const wrongSource = structuredClone(dsp); wrongSource.track.hash = '1'.repeat(64);
  assert.throws(() => createPaintingComparisons(wrongSource, reference, { allowNativeDurationDifference: true }), /same exact source/);
});

test('B and C share pigment colors at shared exact selected-note onset knots', async () => {
  const full = (await createComposition(FIXTURE_STYLES[0]!)).analysis, dsp = structuredClone(full);
  dsp.notes = []; delete dsp.modelVersions.transcription;
  const modes = createPaintingComparisons(dsp, full);
  const legacy = new Map(modes[1]!.score.strokes.flatMap(stroke => stroke.points.map(point => [point.time, point.color] as const)));
  const current = new Map(modes[2]!.score.strokes.flatMap(stroke => stroke.points.map(point => [point.time, point.color] as const)));
  let compared = 0;
  for (const note of full.notes) {
    if (!legacy.has(note.start) || !current.has(note.start)) continue;
    assert.equal(current.get(note.start), legacy.get(note.start)); compared++;
  }
  assert.ok(compared > 3, 'Exercise several common pigment onset samples');
});

test('passage candidates are deterministic, bounded and explicitly predictions or measured evidence', async () => {
  const full = (await createComposition(FIXTURE_STYLES[0]!)).analysis;
  const passages = selectPassages(full);
  assert.deepEqual(selectPassages(full), passages);
  assert.ok(passages.some(passage => passage.kind === 'sustain'));
  for (const passage of passages) {
    assert.ok(passage.start >= 0 && passage.end <= full.track.duration && passage.end > passage.start);
    assert.ok(passage.time >= passage.start && passage.time <= passage.end);
    assert.ok(passage.evidence.length > 30);
  }
});

test('phrase horizontal metrics detect a collapsed path even when planned bounds promise a sweep', () => {
  const score = createDiagnosticScore(10), stroke = score.strokes[0]!;
  stroke.phraseId = 'collapsed';
  stroke.points[0]!.x = .5; stroke.points[1]!.x = .5; stroke.points[1]!.y = .8;
  score.trajectoryDiagnostics = { mode: 'phrases', phrases: [{ id: 'collapsed', start: 0, end: 10, direction: 'mixed',
    source: 'selected-melody', confidence: .9, restThreshold: .4, boundaryReason: 'fixture', placementReason: 'fixture', notes: [],
    placement: { candidateId: 'wide-bounds', startPosition: { x: .2, y: .5 }, endPosition: { x: .8, y: .8 },
      bounds: { left: .2, right: .8, top: .5, bottom: .8 }, candidates: [] } }] };
  const collapsed = phraseHorizontalMetrics(score);
  assert.equal(collapsed.represented, 1);
  assert.equal(collapsed.degenerateActualSpans, 1);
  assert.equal(collapsed.degeneratePlannedDisplacements, 0);
  assert.equal(collapsed.minimumActualSpan, 0);
  stroke.points[1]!.x = .8;
  const repaired = phraseHorizontalMetrics(score);
  assert.equal(repaired.degenerateActualSpans, 0);
  assert.equal(repaired.narrowActualSpans, 0);
  assert.ok(Math.abs(repaired.minimumActualSpan! - .3) < 1e-10);
});
