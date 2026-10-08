import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import initialize, { type CanvasKit, type Canvas, type Paint, type RuntimeEffect } from 'canvaskit-wasm';
import { parseMusicAnalysis } from '../src/analysis/analysis-schema';
import { composeVisualScore } from '../src/visual-score/composer';
import { createDiagnosticScore } from '../src/visual-score/diagnostics';
import { ScorePlayer } from '../src/paint/score-player';
import { estimateRenderNodes } from '../src/paint/render-diagnostics';
import { brushStateAt, cubicVelocity, eventProgress, markOpacity, prepareStrokeGeometry, revealedCubicsAt, ribbonPolygonAt, strokeSegments, type StrokeGeometry } from '../src/paint/scene-runtime';
import type { VisualScore } from '../src/visual-score/schema';
import { createComposition, FIXTURE_STYLES } from './v3-fixtures';
import { PIGMENT_SKSL } from '../src/paint/shaders/pigment.sksl';

// Same pure ribbons, cubic prefixes, shader and age rules as the native renderer.
// This exercises desktop Skia CPU; it cannot certify Android GPU or audio timing.
export class DesktopPainting {
  readonly player: ScorePlayer;
  readonly geometry = new Map<string, StrokeGeometry>();
  constructor(readonly score: VisualScore) {
    this.player = new ScorePlayer(score);
    for (const stroke of score.strokes) this.geometry.set(stroke.id, prepareStrokeGeometry(stroke, score.accents));
  }
}

export function renderDesktopPainting(kit: CanvasKit, pigment: RuntimeEffect | null, painting: DesktopPainting, time: number, width: number, height: number, reducedMotion = false): { bytes: Uint8Array; paintedPixels: number } {
  const surface = kit.MakeSurface(width, height);
  if (!surface) throw new Error('Could not create paint surface');
  const canvas: Canvas = surface.getCanvas();
  canvas.clear(kit.parseColorString('#14131b'));
  const frame = painting.player.frameAt(time), size = Math.min(width, height);
  const simple = painting.score.analysisKey === 'diagnostic-simple';
  const paint: Paint = new kit.Paint();
  paint.setAntiAlias(true);
  for (const scene of frame.scenes) {
    for (const wash of frame.washes.filter((event) => event.sceneIndex === scene.index)) {
      const center = [wash.position.x * width, wash.position.y * height];
      const radius = wash.radius * size * (1 + (reducedMotion ? 0 : Math.min(8, Math.max(0, time - wash.start)) * wash.flow));
      const color = kit.parseColorString(wash.color), clear = color.slice(); clear[3] = 0;
      const shader = kit.Shader.MakeRadialGradient(center, radius, [color, clear], [0, 1], kit.TileMode.Clamp);
      paint.setStyle(kit.PaintStyle.Fill); paint.setShader(shader);
      paint.setAlphaf(markOpacity(scene, wash.start, time) * eventProgress(wash.start, wash.start + 2, time)
        * Math.max(0, 1 - Math.max(0, time - wash.end) / 12) * wash.opacity);
      canvas.drawCircle(center[0]!, center[1]!, radius, paint);
      paint.setShader(null); shader.delete();
    }
    for (const stroke of frame.strokes.filter((event) => event.sceneIndex === scene.index)) {
      const geometry = painting.geometry.get(stroke.id)!;
      const revealed = revealedCubicsAt(geometry.segments, time);
      if (!revealed.length) continue;
      const builder = new kit.PathBuilder().moveTo(revealed[0]!.from.x * width, revealed[0]!.from.y * height);
      for (const segment of revealed) builder.cubicTo(segment.control1.x * width, segment.control1.y * height,
        segment.control2.x * width, segment.control2.y * height, segment.to.x * width, segment.to.y * height);
      const centerline = builder.detach(), color = stroke.points[0]?.color ?? scene.palette.ink;
      paint.setStyle(kit.PaintStyle.Stroke); paint.setStrokeCap(kit.StrokeCap.Round); paint.setStrokeJoin(kit.StrokeJoin.Round);
      paint.setColor(kit.parseColorString(color));
      if (!simple) {
        const diffusion = kit.MaskFilter.MakeBlur(kit.BlurStyle.Normal, reducedMotion ? 2 : Math.min(6, 1.5 + Math.max(0, time - stroke.start) * .08), true);
        paint.setMaskFilter(diffusion); paint.setStrokeWidth(geometry.meanWidth * size * 1.7); paint.setAlphaf(markOpacity(scene, stroke.start, time) * .055);
        canvas.drawPath(centerline, paint); paint.setMaskFilter(null); diffusion.delete();
      }
      for (const run of geometry.runs) {
        const polygon = ribbonPolygonAt(stroke, geometry, run, time, width, height, painting.score.accents);
        if (!polygon.length) continue;
        const ribbonBuilder = new kit.PathBuilder().moveTo(polygon[0]!.x, polygon[0]!.y);
        for (let index = 1; index < polygon.length; index++) ribbonBuilder.lineTo(polygon[index]!.x, polygon[index]!.y);
        ribbonBuilder.close(); const ribbon = ribbonBuilder.detach();
        paint.setStyle(kit.PaintStyle.Fill); paint.setColor(kit.parseColorString(run.color));
        paint.setAlphaf(markOpacity(scene, run.start, time) * run.opacity);
        const shader = simple ? null : pigment?.makeShader([...kit.parseColorString(run.color), scene.seed % 65536, scene.brushStyle === 'dry' ? .72 : .32]);
        paint.setShader(shader ?? null); canvas.drawPath(ribbon, paint); paint.setShader(null); shader?.delete(); ribbon.delete();
      }
      if (!simple) {
        paint.setStyle(kit.PaintStyle.Stroke); paint.setColor(kit.parseColorString(color));
        paint.setAlphaf(markOpacity(scene, stroke.start, time) * geometry.meanOpacity * .2);
        paint.setStrokeWidth(geometry.meanWidth * size * .17); canvas.drawPath(centerline, paint);
      }
      centerline.delete();
    }
    for (const drop of frame.drops.filter((event) => event.sceneIndex === scene.index)) {
      const base = drop.radius * size, age = time - drop.time;
      paint.setStyle(kit.PaintStyle.Fill); paint.setColor(kit.parseColorString(drop.color));
      paint.setAlphaf(markOpacity(scene, drop.time, time) * Math.max(0, 1 - age / 14) * drop.strength * .55);
      const blur = kit.MaskFilter.MakeBlur(kit.BlurStyle.Normal, 2, true); paint.setMaskFilter(blur);
      canvas.drawCircle(drop.position.x * width, drop.position.y * height, base * (1 + (reducedMotion ? 0 : Math.min(1, Math.max(0, age) / 3) * .7)), paint);
      paint.setMaskFilter(null); blur.delete(); canvas.drawCircle(drop.position.x * width, drop.position.y * height, base * .4, paint);
    }
  }
  surface.flush(); const snapshot = surface.makeImageSnapshot(), bytes = snapshot.encodeToBytes();
  const pixels = snapshot.readPixels(0, 0, { width, height, colorType: kit.ColorType.RGBA_8888, alphaType: kit.AlphaType.Unpremul, colorSpace: kit.ColorSpace.SRGB });
  if (!bytes || !pixels) throw new Error('Could not read paint preview');
  let paintedPixels = 0;
  for (let index = 0; index < pixels.length; index += 4) if (pixels[index] !== 20 || pixels[index + 1] !== 19 || pixels[index + 2] !== 27) paintedPixels++;
  const copy = bytes.slice(); snapshot.delete(); paint.delete(); surface.dispose();
  return { bytes: copy, paintedPixels };
}

function continuity(score: VisualScore) {
  let maxJoinDistance = 0, nearAdjacentStrokePairs = 0, liftPairs = 0, maxLiftDistance = 0, maxVelocityDifference = 0, maxCrossStrokeVelocityDifference = 0, invalidCoordinates = 0;
  const ordered = [...score.strokes].sort((a, b) => a.start - b.start);
  for (let index = 1; index < ordered.length; index++) {
    const a = ordered[index - 1]!, b = ordered[index]!;
    const gap = b.start - a.end;
    if (gap > 1e-6) {
      liftPairs++;
      maxLiftDistance = Math.max(maxLiftDistance, Math.hypot(a.points.at(-1)!.x - b.points[0]!.x, a.points.at(-1)!.y - b.points[0]!.y));
    } else if (Math.abs(gap) <= 1e-6) {
      nearAdjacentStrokePairs++;
      maxJoinDistance = Math.max(maxJoinDistance, Math.hypot(a.points.at(-1)!.x - b.points[0]!.x, a.points.at(-1)!.y - b.points[0]!.y));
      const before = cubicVelocity(strokeSegments(a.points).at(-1)!, 1), after = cubicVelocity(strokeSegments(b.points)[0]!, 0);
      maxCrossStrokeVelocityDifference = Math.max(maxCrossStrokeVelocityDifference, Math.hypot(before.x - after.x, before.y - after.y));
    }
  }
  for (const stroke of score.strokes) {
    const segments = strokeSegments(stroke.points);
    for (let index = 1; index < segments.length; index++) {
      const a = cubicVelocity(segments[index - 1]!, 1), b = cubicVelocity(segments[index]!, 0);
      maxVelocityDifference = Math.max(maxVelocityDifference, Math.hypot(a.x - b.x, a.y - b.y));
    }
    for (let step = 0; step <= 100; step++) {
      const state = brushStateAt(stroke, stroke.start + (stroke.end - stroke.start) * step / 100, score.accents);
      if (![state.position.x, state.position.y, state.velocity.x, state.velocity.y, state.width].every(Number.isFinite)
        || state.position.x < 0 || state.position.x > 1 || state.position.y < 0 || state.position.y > 1) invalidCoordinates++;
    }
  }
  return { nearAdjacentStrokePairs, connectedDefinition: 'Adjacent temporal endpoints within 1e-6 seconds; positive gaps are brush lifts', liftPairs, maxLiftDistanceNormalized: maxLiftDistance,
    maxJoinDistanceNormalized: maxJoinDistance, maxWithinStrokeVelocityDifferenceAtKnot: maxVelocityDifference, maxCrossStrokeVelocityDifference, invalidCoordinates };
}

async function main() {
  const kit = await initialize({ locateFile: (file: string) => join(dirname(require.resolve('canvaskit-wasm')), file) });
  const pigment = kit.RuntimeEffect.Make(PIGMENT_SKSL);
  if (!pigment) throw new Error('Pigment shader did not compile');
  const args = process.argv.slice(2), flag = (name: string) => {
    const index = args.indexOf(name);
    if (index < 0) return undefined;
    const value = args[index + 1];
    if (!value || value.startsWith('--')) throw new Error(`${name} needs a value`);
    return value;
  };
  const scorePath = flag('--score'), supplied = args[0]?.startsWith('--') ? undefined : args[0];
  const analysis = supplied ? parseMusicAnalysis(JSON.parse(readFileSync(supplied, 'utf8'))) : scorePath ? undefined : (await createComposition(FIXTURE_STYLES[0]!)).analysis;
  const score: VisualScore = scorePath ? JSON.parse(readFileSync(scorePath, 'utf8')) : composeVisualScore(analysis!);
  assert.ok(score.trackHash && Number.isFinite(score.duration) && Array.isArray(score.strokes) && Array.isArray(score.scenes), 'Expected a saved VisualScore');
  const painting = new DesktopPainting(score);
  const output = flag('--output') ? resolve(flag('--output')!) : resolve('research/results/generated/paint', supplied ? `${score.trackHash.slice(0, 12)}-reference-${score.version}-${analysis!.quality.toLowerCase()}` : scorePath ? `${score.trackHash.slice(0, 12)}-saved-${score.version}` : 'ground-truth-pop-v31');
  mkdirSync(output, { recursive: true }); writeFileSync(join(output, 'song.score.json'), JSON.stringify(score, null, 2));
  const timesPath = flag('--times');
  const extraTimes: number[] = timesPath ? JSON.parse(readFileSync(timesPath, 'utf8')) : [];
  assert.ok(Array.isArray(extraTimes) && extraTimes.every(Number.isFinite), '--times must contain a JSON array of finite song seconds');
  const times = [...new Set([0, 4, 12, 16.5, 20, 27, score.duration - .05, ...extraTimes,
    ...score.scenes.slice(1, 5).flatMap((scene) => [scene.start - 1 / 60, scene.start, scene.start + 1 / 60])].filter((time) => time >= 0 && time <= score.duration))].sort((a, b) => a - b);
  const hashes = [], timings = [];
  const boundaryFrames: { time: number; paintedPixels: number }[] = [];
  for (const time of times) {
    const start = performance.now(), result = renderDesktopPainting(kit, pigment, painting, time, 360, 800); timings.push(performance.now() - start);
    assert.deepEqual(renderDesktopPainting(kit, pigment, painting, time, 360, 800).bytes, result.bytes, 'Paused frames must be pixel-identical');
    renderDesktopPainting(kit, pigment, painting, Math.max(0, time - 3), 360, 800);
    assert.deepEqual(renderDesktopPainting(kit, pigment, painting, time, 360, 800).bytes, result.bytes, 'Seek reconstruction must be pixel-identical');
    const name = `paint-${time.toFixed(3)}.png`; writeFileSync(join(output, name), result.bytes);
    hashes.push({ time, file: name, paintedPixels: result.paintedPixels, sha256: createHash('sha256').update(result.bytes).digest('hex') });
    if (score.scenes.slice(1).some((scene) => Math.abs(scene.start - time) <= 1 / 60 + 1e-9)) boundaryFrames.push({ time, paintedPixels: result.paintedPixels });
  }
  const boundaryCoverage = score.scenes.slice(1, 5).map((scene) => {
    const near = boundaryFrames.filter((frame) => Math.abs(frame.time - scene.start) <= 1 / 60 + 1e-9);
    const hadVisiblePaintBeforeBoundary = (near[0]?.paintedPixels ?? 0) > 0;
    assert.ok(!hadVisiblePaintBeforeBoundary || near.every((frame) => frame.paintedPixels > 0), 'A section boundary must retain already-visible paint');
    return { sceneIndex: scene.index, time: scene.start, hadVisiblePaintBeforeBoundary, retainedVisiblePaint: !hadVisiblePaintBeforeBoundary || near.every((frame) => frame.paintedPixels > 0) };
  });
  const fallbackTime = hashes.find((frame) => frame.paintedPixels > 0)?.time ?? 0;
  const fallback = renderDesktopPainting(kit, null, painting, fallbackTime, 360, 800);
  assert.ok(fallback.paintedPixels > 0 || hashes.every((frame) => frame.paintedPixels === 0), 'Solid-color fallback must retain known visible paint');
  writeFileSync(join(output, 'paint-shader-fallback.png'), fallback.bytes);
  const reduced = renderDesktopPainting(kit, pigment, painting, score.duration / 2, 360, 800, true);
  assert.deepEqual(renderDesktopPainting(kit, pigment, painting, score.duration / 2, 360, 800, true).bytes, reduced.bytes);
  writeFileSync(join(output, 'paint-reduced-motion.png'), reduced.bytes);
  const diagnostic = new DesktopPainting(createDiagnosticScore()), simpleFrame = renderDesktopPainting(kit, pigment, diagnostic, 15, 360, 800);
  assert.deepEqual(renderDesktopPainting(kit, null, diagnostic, 15, 360, 800).bytes, simpleFrame.bytes, 'Simple diagnostic must omit the pigment shader');
  assert.ok(simpleFrame.paintedPixels > 0);
  writeFileSync(join(output, 'paint-diagnostic-simple.png'), simpleFrame.bytes);
  let accentDifference = null;
  const usableAccent = score.accents.find((accent) => score.strokes.some((stroke) => stroke.id === accent.strokeId && stroke.end > accent.time + (accent.duration ?? .22) / 2));
  if (usableAccent) {
    const time = usableAccent.time + (usableAccent.duration ?? .22) / 2, withAccent = renderDesktopPainting(kit, pigment, painting, time, 360, 800);
    const plain = new DesktopPainting({ ...score, accents: [] }), withoutAccent = renderDesktopPainting(kit, pigment, plain, time, 360, 800);
    assert.notDeepEqual(withAccent.bytes, withoutAccent.bytes, 'Beat accents must change local deposited pigment');
    writeFileSync(join(output, 'paint-accent-on.png'), withAccent.bytes); writeFileSync(join(output, 'paint-accent-off.png'), withoutAccent.bytes);
    accentDifference = { time, strokeId: usableAccent.strokeId, pixelBytesDiffer: true };
  }
  const geometry = continuity(score);
  assert.equal(geometry.invalidCoordinates, 0);
  writeFileSync(join(output, 'report.json'), JSON.stringify({ renderer: 'Desktop CanvasKit CPU', composer: score.version, pixelIdenticalAfterSeek: true, pixelIdenticalWhilePaused: true,
    shaderCompiled: true, solidColorFallbackRendered: true, reducedMotionPixelIdentical: true, simpleDiagnosticShaderIndependent: true, accentDifference, geometry,
    boundaryFrames, boundaryCoverage, nativeBoundaryLagTest: 'source/pure pre-mount coverage only; no physical presented frames',
    quality: analysis?.quality ?? 'saved-score', models: analysis?.modelVersions, scoreEvents: { scenes: score.scenes.length, strokes: score.strokes.length, washes: score.washes.length, drops: score.drops.length },
    nodeEstimates: score.scenes.map((scene) => ({ sceneIndex: scene.index, ...estimateRenderNodes(score, scene.index) })),
    cpuRasterAndPngMilliseconds: timings, frames: hashes, nativeGpuValidation: 'pending' }, null, 2));
  console.log(`Rendered ${times.length} paint previews; pause/seek, fallback, reduced-motion and accent checks passed: ${output}`);
  pigment.delete();
}
if (require.main === module) void main().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
