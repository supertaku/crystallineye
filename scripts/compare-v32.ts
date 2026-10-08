import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import initialize from 'canvaskit-wasm';
import { analyzeTrack } from '../src/analysis/analysis-engine';
import { parseMusicAnalysis, type MusicAnalysis } from '../src/analysis/analysis-schema';
import { extractMelody } from '../src/analysis/melody-extractor';
import { ScorePlayer } from '../src/paint/score-player';
import { brushStateOnSegments, cubicPosition, cubicVelocity, strokeSegments } from '../src/paint/scene-runtime';
import { PIGMENT_SKSL } from '../src/paint/shaders/pigment.sksl';
import { createPaintingComparisons, type PaintingComparison } from '../src/visual-score/comparison-modes';
import { composeVisualScore } from '../src/visual-score/composer';
import type { Point, StrokeEvent, VisualScore } from '../src/visual-score/schema';
import { DesktopPainting, renderDesktopPainting } from './validate-paint';

const EPSILON = 1e-6;
const hash = (value: Uint8Array | string) => createHash('sha256').update(value).digest('hex');
const mean = (values: number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
const maximum = (values: number[]) => Math.max(0, ...values);
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
const errorSummary = (values: number[]) => ({ count: values.length, meanSeconds: mean(values), maxSeconds: values.length ? maximum(values) : null });

export function ignoredOutputPath(path: string): string {
  const output = resolve(path);
  const safe = ['.build-tools', 'research/results/generated'].some(root => {
    const difference = relative(resolve(root), output);
    return difference === '' || (!difference.startsWith('..') && !isAbsolute(difference));
  });
  if (!safe) throw new Error('True Colors derivatives must stay under ignored .build-tools/ or research/results/generated/');
  return output;
}

function unionIntervals(intervals: { start: number; end: number }[]) {
  const result: { start: number; end: number }[] = [];
  for (const interval of [...intervals].sort((a, b) => a.start - b.start)) {
    const prior = result.at(-1);
    if (prior && interval.start <= prior.end) prior.end = Math.max(prior.end, interval.end);
    else result.push({ start: interval.start, end: interval.end });
  }
  return result;
}

/** Contact is compared with the selected note UNION, never with an asserted
 * audio-silence annotation. Positive gaps may still contain accompaniment. */
export function noteContactMetrics(score: VisualScore, reference: MusicAnalysis) {
  const notes = unionIntervals(extractMelody(reference.notes)), contact = unionIntervals(score.strokes);
  const noteSeconds = notes.reduce((sum, item) => sum + item.end - item.start, 0);
  const contactSeconds = contact.reduce((sum, item) => sum + item.end - item.start, 0);
  let intersectionSeconds = 0;
  for (const note of notes) for (const mark of contact) intersectionSeconds += Math.max(0, Math.min(note.end, mark.end) - Math.max(note.start, mark.start));
  const internalGaps = notes.slice(1).map((item, index) => ({ start: notes[index]!.end, end: item.start }));
  const internalGapSeconds = internalGaps.reduce((sum, gap) => sum + gap.end - gap.start, 0);
  let contactInsideInternalGaps = 0;
  for (const gap of internalGaps) for (const mark of contact) contactInsideInternalGaps += Math.max(0, Math.min(gap.end, mark.end) - Math.max(gap.start, mark.start));
  return { referenceNotesAvailable: notes.length > 0, selectedNoteUnionSeconds: noteSeconds, scoreContactSeconds: contactSeconds,
    selectedNoteSecondsWithoutContact: noteSeconds - intersectionSeconds, contactSecondsOutsideSelectedNotes: notes.length ? contactSeconds - intersectionSeconds : null,
    selectedNoteContactFraction: noteSeconds ? intersectionSeconds / noteSeconds : null, internalSelectedGapSeconds: internalGapSeconds,
    contactInsideInternalGaps: notes.length ? contactInsideInternalGaps : null, internalGapContactFraction: internalGapSeconds ? contactInsideInternalGaps / internalGapSeconds : null };
}

/** Shape distance retains orientation and the time profile, but removes translation
 * and isotropic scale. Zero travel has no interpretable shape and is excluded. */
export function normalizedPath(points: Point[]): Point[] | null {
  if (!points.length) return null;
  const center = { x: mean(points.map(point => point.x))!, y: mean(points.map(point => point.y))! };
  const radius = Math.sqrt(points.reduce((sum, point) => sum + distance(point, center) ** 2, 0) / points.length);
  return radius > 1e-6 ? points.map(point => ({ x: (point.x - center.x) / radius, y: (point.y - center.y) / radius })) : null;
}

export function pathSimilarity(paths: (Point[] | null)[], threshold = .08) {
  const usable = paths.filter((path): path is Point[] => path !== null);
  const nearest = usable.map((path, index) => {
    const candidates = usable.flatMap((other, candidate) => candidate === index ? [] : [Math.sqrt(path.reduce((sum, point, sample) => sum + distance(point, other[sample]!) ** 2, 0) / path.length)]);
    return candidates.length ? Math.min(...candidates) : null;
  });
  return { eligiblePaths: usable.length, sampleCount: usable[0]?.length ?? 0, rmsThreshold: threshold,
    medianNearestRms: nearest.filter((value): value is number => value !== null).sort((a, b) => a - b)[Math.floor(usable.length / 2)] ?? null,
    fractionWithSimilarPath: usable.length >= 3 ? nearest.filter(value => value !== null && value <= threshold).length / usable.length : null };
}

/** Measure actual renderer geometry across complete phrases, including every
 * contact and section slice. Bounds alone can hide a collapsed path. */
export function phraseHorizontalMetrics(score: VisualScore) {
  const phrases = score.trajectoryDiagnostics?.phrases ?? [];
  const details = phrases.flatMap(phrase => {
    const strokes = score.strokes.filter(stroke => stroke.phraseId === phrase.id).sort((a, b) => a.start - b.start);
    if (!strokes.length) return [];
    let left = Infinity, right = -Infinity;
    for (const stroke of strokes) for (const segment of strokeSegments(stroke.points)) for (let step = 0; step <= 32; step++) {
      const x = cubicPosition(segment, step / 32).x;
      left = Math.min(left, x); right = Math.max(right, x);
    }
    const startX = strokes[0]!.points[0]!.x, endX = strokes.at(-1)!.points.at(-1)!.x;
    return [{ id: phrase.id, start: phrase.start, end: phrase.end, source: phrase.source, candidate: phrase.placement?.candidateId ?? null,
      actualSpan: right - left, endpointDisplacement: endX - startX,
      plannedDisplacement: phrase.placement ? phrase.placement.endPosition.x - phrase.placement.startPosition.x : null }];
  });
  const spans = details.map(phrase => phrase.actualSpan).sort((a, b) => a - b);
  return { diagnosticsAvailable: !!score.trajectoryDiagnostics, phrases: phrases.length, represented: details.length,
    definition: 'Full phrase union of renderer cubic x positions sampled at 32 subdivisions per segment; normalized canvas width; <=1e-6 is degenerate, <0.18 is narrow',
    minimumActualSpan: spans[0] ?? null, medianActualSpan: spans[Math.floor(spans.length / 2)] ?? null, maximumActualSpan: spans.at(-1) ?? null,
    degenerateActualSpans: spans.filter(span => span <= EPSILON).length, narrowActualSpans: spans.filter(span => span < .18).length,
    degeneratePlannedDisplacements: details.filter(phrase => phrase.plannedDisplacement !== null && Math.abs(phrase.plannedDisplacement) <= EPSILON).length,
    details };
}

function pearson(pairs: { pitch: number; motion: number }[]) {
  if (pairs.length < 3) return null;
  const pitchMean = mean(pairs.map(pair => pair.pitch))!, motionMean = mean(pairs.map(pair => pair.motion))!;
  const numerator = pairs.reduce((sum, pair) => sum + (pair.pitch - pitchMean) * (pair.motion - motionMean), 0);
  const denominator = Math.sqrt(pairs.reduce((sum, pair) => sum + (pair.pitch - pitchMean) ** 2, 0) * pairs.reduce((sum, pair) => sum + (pair.motion - motionMean) ** 2, 0));
  return denominator > 1e-12 ? numerator / denominator : null;
}

export function analyzeScore(score: VisualScore, analysis: MusicAnalysis) {
  const strokes = [...score.strokes].sort((a, b) => a.start - b.start || a.id.localeCompare(b.id));
  const geometry = new Map(strokes.map(stroke => [stroke.id, strokeSegments(stroke.points)]));
  const state = (stroke: StrokeEvent, time: number) => brushStateOnSegments(stroke, geometry.get(stroke.id)!, time, score.accents);
  const at = (time: number) => {
    const stroke = strokes.find(item => time >= item.start - EPSILON && time <= item.end + EPSILON);
    return stroke ? state(stroke, time) : undefined;
  };
  let travel = 0, invalidSamples = 0, connectedPairs = 0, unexplainedDiscontinuities = 0, liftPairs = 0, overlappingPairs = 0;
  let maxConnectedPositionGap = 0, maxConnectedVelocityGap = 0, maxLiftReposition = 0, maxInternalVelocityGap = 0;
  const gridColumns = 24, gridRows = 48, occupied = new Set<number>(), positions: Point[] = [];
  const occupy = (point: Point, width: number) => {
    // Width uses the shorter dimension of the identical 360x800 preview canvas.
    const rx = width / 2, ry = width * 360 / 800 / 2;
    const left = Math.max(0, Math.floor((point.x - rx) * gridColumns)), right = Math.min(gridColumns - 1, Math.floor((point.x + rx) * gridColumns));
    const top = Math.max(0, Math.floor((point.y - ry) * gridRows)), bottom = Math.min(gridRows - 1, Math.floor((point.y + ry) * gridRows));
    for (let row = top; row <= bottom; row++) for (let column = left; column <= right; column++) occupied.add(row * gridColumns + column);
  };
  for (const stroke of strokes) {
    const segments = geometry.get(stroke.id)!;
    for (let index = 0; index < segments.length; index++) {
      const segment = segments[index]!;
      if (index) maxInternalVelocityGap = Math.max(maxInternalVelocityGap, distance(cubicVelocity(segments[index - 1]!, 1), cubicVelocity(segment, 0)));
      let previous = cubicPosition(segment, 0);
      for (let sample = 0; sample <= 32; sample++) {
        const progress = sample / 32, point = cubicPosition(segment, progress), time = segment.start + (segment.end - segment.start) * progress;
        if (sample) travel += distance(previous, point);
        previous = point; positions.push(point); occupy(point, state(stroke, time).width);
        if (!Number.isFinite(point.x + point.y) || point.x < 0 || point.x > 1 || point.y < 0 || point.y > 1) invalidSamples++;
      }
    }
  }
  for (let index = 1; index < strokes.length; index++) {
    const prior = strokes[index - 1]!, next = strokes[index]!, gap = next.start - prior.end;
    const reposition = distance(state(prior, prior.end).position, state(next, next.start).position);
    if (gap > EPSILON) { liftPairs++; maxLiftReposition = Math.max(maxLiftReposition, reposition); }
    else if (gap < -EPSILON) overlappingPairs++;
    else {
      connectedPairs++; maxConnectedPositionGap = Math.max(maxConnectedPositionGap, reposition);
      maxConnectedVelocityGap = Math.max(maxConnectedVelocityGap, distance(state(prior, prior.end).velocity, state(next, next.start).velocity));
      if (reposition > 1e-8) unexplainedDiscontinuities++;
    }
  }
  const melody = extractMelody(analysis.notes), knots = score.strokes.flatMap(stroke => stroke.points.map(point => point.time));
  const phraseDiagnostics = score.trajectoryDiagnostics?.phrases ?? [];
  const associatedKnots = (note: typeof melody[number]) => {
    const phrase = phraseDiagnostics.find(item => item.notes.some(candidate => candidate.midi === note.midi && Math.abs(candidate.start - note.start) < EPSILON && Math.abs(candidate.end - note.end) < EPSILON));
    return strokes.filter(stroke => phrase ? stroke.phraseId === phrase.id && stroke.start < note.end && stroke.end > note.start : stroke.start < note.end && stroke.end > note.start)
      .flatMap(stroke => stroke.points.map(point => point.time));
  };
  const noteErrors = melody.flatMap(note => {
    const associated = associatedKnots(note);
    return associated.length ? [{ onset: Math.min(...associated.map(knot => Math.abs(knot - note.start))), offset: Math.min(...associated.map(knot => Math.abs(knot - note.end))) }] : [];
  });
  const pairs: { pitch: number; motion: number }[] = [], onsetPairs: { pitch: number; motion: number }[] = [];
  const intervalChanges: { time: number; sign: number }[] = [];
  for (let index = 1; index < melody.length; index++) {
    const before = melody[index - 1]!, next = melody[index]!;
    if (next.start - before.end > .1 + EPSILON) continue;
    const a = at(before.start), b = at(next.start), c = at(next.end);
    if (!a || !b) continue;
    const interval = next.midi - before.midi;
    onsetPairs.push({ pitch: interval, motion: -(b.position.y - a.position.y) });
    const samePhrase = !phraseDiagnostics.length || phraseDiagnostics.some(phrase => phrase.notes.some(note => note.start === before.start && note.midi === before.midi)
      && phrase.notes.some(note => note.start === next.start && note.midi === next.midi));
    if (samePhrase && c) pairs.push({ pitch: interval, motion: -(c.position.y - b.position.y) });
    if (interval) intervalChanges.push({ time: next.start, sign: Math.sign(interval) });
  }
  const reversals = intervalChanges.filter((item, index) => index > 0 && item.sign !== intervalChanges[index - 1]!.sign);
  const motionReversals: number[] = [];
  for (const stroke of strokes) {
    let priorSign = 0;
    for (let time = stroke.start; time <= stroke.end; time += .05) {
      const velocity = state(stroke, time).velocity.y, sign = Math.abs(velocity) < 1e-5 ? 0 : Math.sign(velocity);
      if (sign && priorSign && sign !== priorSign) motionReversals.push(time);
      if (sign) priorSign = sign;
    }
  }
  const phraseAlignment = phraseDiagnostics.flatMap(phrase => {
    const marks = strokes.filter(stroke => stroke.phraseId === phrase.id);
    if (!marks.length) return [];
    return [{ onset: Math.abs(Math.min(...marks.map(stroke => stroke.start)) - phrase.start),
      duration: Math.abs(Math.max(...marks.map(stroke => stroke.end)) - Math.min(...marks.map(stroke => stroke.start)) - (phrase.end - phrase.start)) }];
  });
  const shapes = strokes.map(stroke => normalizedPath(Array.from({ length: 32 }, (_, sample) => state(stroke, stroke.start + (stroke.end - stroke.start) * sample / 31).position)));
  const nonzeroPairs = pairs.filter(pair => pair.pitch !== 0 && Math.abs(pair.motion) > 1e-5);
  return { gestureCount: strokes.length, phraseCount: phraseDiagnostics.length, points: knots.length, totalBrushTravelNormalized: travel,
    continuity: { connectedPairs, connectedDefinition: 'Adjacent endpoints within 1e-6 seconds', unexplainedDiscontinuities, maxConnectedPositionGap,
      maxConnectedVelocityGap, maxInternalVelocityGap, liftPairs, maxLiftReposition, overlappingPairs, invalidSamples },
    repeatedGestureShape: pathSimilarity(shapes), phraseHorizontalSpan: phraseHorizontalMetrics(score),
    coverage: { method: 'Union of sampled pressure-expanded cells, 360x800 aspect; excludes washes/drops/diffusion/age', gridColumns, gridRows, occupiedCells: occupied.size,
      fraction: occupied.size / (gridColumns * gridRows), bounds: positions.length ? positions.reduce((bounds, point) => ({ left: Math.min(bounds.left, point.x), right: Math.max(bounds.right, point.x),
        top: Math.min(bounds.top, point.y), bottom: Math.max(bounds.bottom, point.y) }), { left: 1, right: 0, top: 1, bottom: 0 }) : null },
    pitchMotion: { pairs: pairs.length, pearson: pearson(pairs), nonzeroDirectionPairs: nonzeroPairs.length,
      directionAgreement: nonzeroPairs.length ? nonzeroPairs.filter(pair => Math.sign(pair.pitch) === Math.sign(pair.motion)).length / nonzeroPairs.length : null,
      flatMotionPairs: pairs.filter(pair => Math.abs(pair.motion) <= 1e-5).length,
      definition: 'Incoming interval versus next-note onset-to-offset upward (-y) displacement within same phrase and <=100ms contact gap',
      onsetToOnsetDescriptive: { pairs: onsetPairs.length, pearson: pearson(onsetPairs), definition: 'Onset positions measure preceding-note motion against next interval; lagged descriptive statistic' } },
    noteContact: noteContactMetrics(score, analysis),
    alignment: { selectedNotes: melody.length, notesWithAssociatedContact: noteErrors.length, method: 'Nearest knot in overlapping contact runs of the associated phrase, or overlapping legacy strokes',
      noteOnsetKnots: errorSummary(noteErrors.map(item => item.onset)), noteOffsetKnots: errorSummary(noteErrors.map(item => item.offset)),
      phrases: { diagnosticsAvailable: !!score.trajectoryDiagnostics, total: phraseDiagnostics.length, represented: phraseAlignment.length,
        onset: errorSummary(phraseAlignment.map(item => item.onset)), duration: errorSummary(phraseAlignment.map(item => item.duration)) },
      directionChange: { noteReversals: reversals.length, motionReversals: motionReversals.length,
        nearestMotionReversal: errorSummary(motionReversals.length ? reversals.map(item => Math.min(...motionReversals.map(time => Math.abs(time - item.time)))) : []),
        definition: 'Nearest vertical-velocity sign reversal sampled at 50ms; proximity is descriptive, not causality or transcription accuracy' } } };
}

export type Passage = { kind: 'rising' | 'falling' | 'sustain' | 'rest' | 'harmony' | 'quiet' | 'phrase-end'; start: number; end: number; time: number; evidence: string };
type FrameEvidence = { kind: Passage['kind']; time: number; file: string; paintedPixels: number; paintedPixelFraction: number; sha256: string };
type ComparisonSummary = { mode: PaintingComparison['mode']; label: string; composer: string; quality: MusicAnalysis['quality']; models: MusicAnalysis['modelVersions'];
  notes: number; selectedNotes: number; beats: number; downbeats: number; chords: number; sections: number; accents: number; drops: number; washes: number;
  scoreSha256: string; metrics: ReturnType<typeof analyzeScore>; referenceNoteContact: ReturnType<typeof noteContactMetrics>;
  deterministicComposition: boolean; deterministicPauseAndSeekPng: boolean; frames: FrameEvidence[] };
export function sharedOnsetPigment(legacy: VisualScore, current: VisualScore, reference: MusicAnalysis) {
  const oldColors = new Map(legacy.strokes.flatMap(stroke => stroke.points.map(point => [point.time, point.color] as const)));
  const newColors = new Map(current.strokes.flatMap(stroke => stroke.points.map(point => [point.time, point.color] as const)));
  let commonOnsets = 0, mismatches = 0;
  for (const note of extractMelody(reference.notes)) {
    if (!oldColors.has(note.start) || !newColors.has(note.start)) continue;
    commonOnsets++; if (oldColors.get(note.start) !== newColors.get(note.start)) mismatches++;
  }
  return { commonOnsets, mismatches, definition: 'Exact common selected-note onset knots; same harmonic/note pigment formula, excludes coalesced legacy knots' };
}

export function selectPassages(analysis: MusicAnalysis): Passage[] {
  const melody = extractMelody(analysis.notes), passages: Passage[] = [];
  for (const [kind, sign] of [['rising', 1], ['falling', -1]] as const) {
    const candidates = melody.slice(0, -2).flatMap((note, index) => {
      const next = melody[index + 1]!, last = melody[index + 2]!;
      return Math.sign(next.midi - note.midi) === sign && Math.sign(last.midi - next.midi) === sign && next.start - note.end <= .4 && last.start - next.end <= .4
        ? [{ start: note.start, end: last.end, strength: Math.abs(last.midi - note.midi) * Math.min(note.confidence, next.confidence, last.confidence) }] : [];
    }).sort((a, b) => b.strength - a.strength || a.start - b.start);
    const candidate = candidates[0];
    if (candidate) passages.push({ kind, start: candidate.start, end: candidate.end, time: candidate.end - .01, evidence: 'Three successive selected predictions with matching interval direction; singer identity unverified' });
  }
  const sustained = [...melody].sort((a, b) => (b.end - b.start) - (a.end - a.start) || a.start - b.start)[0];
  if (sustained) passages.push({ kind: 'sustain', start: sustained.start, end: sustained.end, time: (sustained.start + sustained.end) / 2, evidence: 'Longest selected predicted note; duration is model output' });
  const gaps = melody.slice(1).map((note, index) => ({ start: melody[index]!.end, end: note.start })).filter(gap => gap.end > gap.start).sort((a, b) => (b.end - b.start) - (a.end - a.start) || a.start - b.start);
  if (gaps[0]) passages.push({ kind: 'rest', ...gaps[0], time: (gaps[0].start + gaps[0].end) / 2, evidence: 'Longest internal gap in selected predictions; accompaniment may continue' });
  const changes = analysis.harmony.chords.slice(1).flatMap((chord, index) => {
    const prior = analysis.harmony.chords[index]!;
    return chord.start > 5 && chord.confidence >= .35 && prior.confidence >= .35 && chord.quality !== 'unknown' && prior.quality !== 'unknown' && (chord.root !== prior.root || chord.quality !== prior.quality)
      ? [{ chord, strength: Math.min(chord.confidence, prior.confidence) }] : [];
  }).sort((a, b) => b.strength - a.strength || a.chord.start - b.chord.start);
  if (changes[0]) passages.push({ kind: 'harmony', start: changes[0].chord.start, end: changes[0].chord.end, time: Math.min(changes[0].chord.end - .01, changes[0].chord.start + .6), evidence: 'Confident template chord change; chord correctness unverified' });
  const quiet = analysis.dynamics.filter(frame => frame.time > 5 && frame.time < analysis.track.duration - 5 && frame.rms > 1e-5).sort((a, b) => a.energy - b.energy || a.time - b.time)[0];
  if (quiet) passages.push({ kind: 'quiet', start: Math.max(0, quiet.time - 1), end: Math.min(analysis.track.duration, quiet.time + 1), time: quiet.time, evidence: 'Lowest non-silent measured relative-energy frame, excluding first/last 5s; local frame may be a transient lull' });
  return passages;
}

async function main() {
  const [analysisPath, audioPath, pcmPath, outputPath = '.build-tools/v32-comparison'] = process.argv.slice(2);
  if (!analysisPath || !audioPath || !pcmPath) throw new Error('Usage: tsx scripts/compare-v32.ts FULL.analysis.json original.mp3 normalized.f32 [ignored-output]');
  const reference = parseMusicAnalysis(JSON.parse(readFileSync(analysisPath, 'utf8')));
  assert.equal(reference.quality, 'FULL', 'Controlled reference must contain all reference subsystems');
  assert.equal(hash(readFileSync(audioPath)), reference.track.hash, 'Exact source SHA-256 must match reference');
  const bytes = readFileSync(pcmPath); assert.equal(bytes.length % 4, 0);
  const pcm = new Float32Array(bytes.length / 4);
  for (let index = 0; index < pcm.length; index++) pcm[index] = bytes.readFloatLE(index * 4);
  assert.ok(pcm.every(Number.isFinite), 'PCM must be finite');
  assert.ok(Math.abs(pcm.length / 22050 - reference.track.duration) < 1 / 22050, 'Normalized PCM length must match exact duration');
  const dsp = parseMusicAnalysis(await analyzeTrack({ pcm, sampleRate: 22050, numberOfChannels: 1, duration: reference.track.duration }, reference.track.hash, () => {}));
  assert.equal(dsp.dynamics.length, reference.dynamics.length, 'Exact PCM feature count must match the reference');
  const featureParity = Object.fromEntries((['time', 'rms', 'energy', 'bass', 'brightness', 'onset'] as const).map(key => {
    const maximumAbsoluteError = Math.max(...dsp.dynamics.map((frame, index) => Math.abs(frame[key] - reference.dynamics[index]![key])));
    assert.ok(maximumAbsoluteError < .0005, `Exact PCM/reference ${key} parity differs by ${maximumAbsoluteError}`);
    return [key, maximumAbsoluteError];
  }));
  const modes = createPaintingComparisons(dsp, reference), byMode = new Map(modes.map(mode => [mode.mode, mode]));
  assert.deepEqual(byMode.get('B')!.analysis, byMode.get('C')!.analysis, 'B/C must hold all musical analysis fixed');
  for (const key of ['rhythm', 'harmony', 'dynamics', 'structure'] as const) assert.deepEqual(byMode.get('C')!.analysis[key], byMode.get('D')!.analysis[key], `C/D must hold ${key} fixed`);
  assert.equal(byMode.get('D')!.analysis.notes.length, 0);
  assert.deepEqual(byMode.get('B')!.score.paletteTimeline, byMode.get('C')!.score.paletteTimeline, 'B/C share harmonic colors');
  const pigmentControl = sharedOnsetPigment(byMode.get('B')!.score, byMode.get('C')!.score, reference);
  assert.equal(pigmentControl.mismatches, 0, 'B/C must share pigment at exact common selected-note onsets');
  const frozenPath = '.build-tools/v32-baseline/full.legacy.score.json';
  if (existsSync(frozenPath)) assert.deepEqual(byMode.get('B')!.score, JSON.parse(readFileSync(frozenPath, 'utf8')), 'Legacy B must reproduce the frozen full score');
  const kit = await initialize({ locateFile: (file: string) => join(dirname(require.resolve('canvaskit-wasm')), file) });
  const pigment = kit.RuntimeEffect.Make(PIGMENT_SKSL); assert.ok(pigment, 'Existing pigment shader must compile');
  const output = ignoredOutputPath(outputPath); mkdirSync(output, { recursive: true });
  const passages = selectPassages(reference), summaries: ComparisonSummary[] = [];
  const rising = passages.find(passage => passage.kind === 'rising');
  const completePhrase = rising && byMode.get('C')!.score.trajectoryDiagnostics?.phrases.find(phrase => phrase.start <= rising.time && phrase.end >= rising.time);
  if (completePhrase) passages.push({ kind: 'phrase-end', start: completePhrase.start, end: completePhrase.end, time: completePhrase.end - .01,
    evidence: 'Nearly complete planner phrase containing the rising candidate; exposes its full horizontal sweep instead of judging only an early reveal' });
  writeFileSync(join(output, 'passages.json'), JSON.stringify(passages, null, 2));
  writeFileSync(join(output, 'times.json'), JSON.stringify(passages.map(passage => passage.time)));
  for (const mode of modes) {
    const trajectory = mode.mode === 'A' || mode.mode === 'B' ? 'legacy' : 'phrases';
    assert.deepEqual(composeVisualScore(mode.analysis, { trajectory }), mode.score, `${mode.mode} deterministic composition`);
    const player = new ScorePlayer(mode.score), painting = new DesktopPainting(mode.score), frames: FrameEvidence[] = [];
    writeFileSync(join(output, `${mode.mode}.score.json`), JSON.stringify(mode.score));
    for (const passage of passages) {
      const before = player.frameAt(passage.time); player.frameAt(Math.min(mode.score.duration, passage.time + 10));
      assert.deepEqual(player.frameAt(passage.time), before, `${mode.mode} deterministic score seek`);
      const result = renderDesktopPainting(kit, pigment, painting, passage.time, 360, 800);
      assert.deepEqual(renderDesktopPainting(kit, pigment, painting, passage.time, 360, 800).bytes, result.bytes, `${mode.mode} paused PNG identity`);
      renderDesktopPainting(kit, pigment, painting, Math.max(0, passage.time - 3), 360, 800);
      assert.deepEqual(renderDesktopPainting(kit, pigment, painting, passage.time, 360, 800).bytes, result.bytes, `${mode.mode} sought PNG identity`);
      const file = `${mode.mode}-${passage.kind}-${passage.time.toFixed(3)}.png`; writeFileSync(join(output, file), result.bytes);
      frames.push({ kind: passage.kind, time: passage.time, file, paintedPixels: result.paintedPixels, paintedPixelFraction: result.paintedPixels / (360 * 800), sha256: hash(result.bytes) });
    }
    summaries.push({ mode: mode.mode, label: mode.label, composer: mode.score.version, quality: mode.analysis.quality, models: mode.analysis.modelVersions,
      notes: mode.analysis.notes.length, selectedNotes: extractMelody(mode.analysis.notes).length, beats: mode.analysis.rhythm.beats.length,
      downbeats: mode.analysis.rhythm.downbeats.length, chords: mode.analysis.harmony.chords.length, sections: mode.score.scenes.length,
      accents: mode.score.accents.length, drops: mode.score.drops.length, washes: mode.score.washes.length,
      scoreSha256: hash(JSON.stringify(mode.score)), metrics: analyzeScore(mode.score, mode.analysis), referenceNoteContact: noteContactMetrics(mode.score, reference), deterministicComposition: true, deterministicPauseAndSeekPng: true, frames });
  }
  const current = summaries.find(mode => mode.mode === 'C')!.metrics;
  assert.equal(current.continuity.invalidSamples, 0, 'C geometry must remain finite and in canvas bounds');
  assert.equal(current.continuity.unexplainedDiscontinuities, 0, 'C connected joins must retain position');
  assert.ok(current.continuity.maxConnectedVelocityGap < 1e-8 && current.continuity.maxInternalVelocityGap < 1e-8, 'C connected velocity continuity');
  assert.equal(current.alignment.notesWithAssociatedContact, current.alignment.selectedNotes, 'Every selected note needs associated contact');
  assert.ok((current.alignment.noteOnsetKnots.maxSeconds ?? Infinity) < EPSILON && (current.alignment.noteOffsetKnots.maxSeconds ?? Infinity) < EPSILON, 'C selected-note bounds must be exact');
  assert.equal(current.alignment.phrases.represented, current.alignment.phrases.total, 'Every C phrase needs associated contact');
  assert.ok((current.alignment.phrases.onset.maxSeconds ?? Infinity) < EPSILON && (current.alignment.phrases.duration.maxSeconds ?? Infinity) < EPSILON, 'C phrase timing must be exact');
  assert.ok((current.noteContact.contactInsideInternalGaps ?? Infinity) < 1e-8 && Math.abs(current.noteContact.selectedNoteSecondsWithoutContact) < 1e-8, 'C contact must follow selected notes and lift in their gaps');
  assert.ok((current.phraseHorizontalSpan.minimumActualSpan ?? 0) >= .22 - EPSILON, 'C actual phrase geometry must retain its minimum horizontal sweep');
  const report = { sourceHash: reference.track.hash, duration: reference.track.duration, analysisJsonSha256: hash(JSON.stringify(reference)),
    pcmEvidence: { sha256: hash(bytes), sampleRate: 22050, channels: 1, samples: pcm.length, duration: pcm.length / 22050,
      referenceDynamicsFrames: reference.dynamics.length, maximumAbsoluteFeatureErrors: featureParity,
      definition: 'Actual DSP remeasured from supplied normalized PCM; frame timestamps/features match source-hashed FULL reference; original MP3 separately hashed' },
    renderer: 'Same V3.1 CanvasKit CPU pigment/ribbon renderer, 360x800',
    controlled: { BC: 'Exact same FULL analysis; harmonic palette algorithm/timeline and note-color rule shared; only trajectory/contact composition changes', CD: 'Only note predictions/transcription provenance removed; FULL rhythm/harmony/dynamics/sections fixed', A: 'Actual DSP remeasured from exact normalized PCM; not an empty-note reference clone' },
    limitations: ['Desktop PNG identity does not verify native audio/GPU timing', 'Predictions are not singer identity, annotated melody, chord/section accuracy or listening acceptance',
      'Gesture shape metric removes translation/scale; repeated musical motifs and constant-direction paths can also match', 'Coverage is a coarse full-song brush-ribbon union; PNG coverage includes other paint and section age',
      'B/C retain the same color rules; their different time knots can change pigment run tessellation, so pixel equality across planners is not expected'],
    legacyFrozenScoreMatches: existsSync(frozenPath), pigmentControl, passages, modes: summaries, listeningAcceptance: 'pending user review', physicalDeviceAcceptance: 'pending' };
  writeFileSync(join(output, 'report.json'), JSON.stringify(report, null, 2));
  const escape = (value: string) => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
  const html = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Crystallineye V3.2 comparison</title>
<style>body{margin:24px;background:#14131b;color:#eee;font:16px system-ui;max-width:1500px}h1{font-size:28px}p{max-width:80ch;line-height:1.5}.modes{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px}figure{margin:0}img{width:100%;max-height:600px;object-fit:contain;background:#14131b}figcaption{padding:8px 0;color:#ccc}section{margin:32px 0;border-top:1px solid #444;padding-top:12px}@media(max-width:800px){.modes{grid-template-columns:repeat(2,minmax(0,1fr))}}</style>
<h1>Crystallineye V3.2 · same recording, four painting modes</h1><p>B and C use the exact same desktop reference. C and D retain rhythm, harmony, dynamics and sections; D removes only notes. Every panel uses the same Skia desktop pigment renderer at the same song position. These are predicted or measured review candidates; listening and physical-device acceptance remain open.</p>
${passages.map(passage => `<section><h2>${escape(passage.kind)} candidate · ${passage.time.toFixed(3)} s</h2><p>${escape(passage.evidence)}</p><div class="modes">${summaries.map(mode => { const frame = mode.frames.find(item => item.kind === passage.kind)!; return `<figure><figcaption>${escape(mode.label)}</figcaption><img src="${escape(frame.file)}" alt="${escape(mode.mode)} painting at ${passage.time.toFixed(3)} seconds"><figcaption>${(frame.paintedPixelFraction * 100).toFixed(1)}% painted pixels</figcaption></figure>`; }).join('')}</div></section>`).join('')}
<p>Detailed local evidence: <a href="report.json">report.json</a>. Pause and seek reconstructed identical PNG bytes within each mode. PNG encoding/rasterization is desktop evidence, not Android GPU performance or singer-transcription correctness.</p></html>`;
  writeFileSync(join(output, 'index.html'), html);
  console.log(JSON.stringify({ output, sourceHash: report.sourceHash, modes: summaries.map(mode => ({ mode: mode.mode, composer: mode.composer, gestures: mode.metrics.gestureCount,
    travel: mode.metrics.totalBrushTravelNormalized, coverage: mode.metrics.coverage.fraction, connectedDiscontinuities: mode.metrics.continuity.unexplainedDiscontinuities, lifts: mode.metrics.continuity.liftPairs })) }, null, 2));
  pigment.delete();
}

if (require.main === module) void main().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
