import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import initialize, { type CanvasKit, type Canvas, type Paint, type RuntimeEffect } from 'canvaskit-wasm';
import { parseMusicAnalysis } from '../src/analysis/analysis-schema';
import { composeVisualScore } from '../src/visual-score/composer';
import { ScorePlayer } from '../src/paint/score-player';
import { eventProgress, markOpacity, strokeSegments } from '../src/paint/scene-runtime';
import type { VisualScore } from '../src/visual-score/schema';
import { createComposition, FIXTURE_STYLES } from './v3-fixtures';
import { PIGMENT_SKSL } from '../src/paint/shaders/pigment.sksl';

// Same score, curves, path trimming, paints and age rules as the native renderer.
// This exercises desktop Skia; it cannot certify Android frame time or playback.
function render(kit: CanvasKit, pigment: RuntimeEffect, score: VisualScore, time: number, width: number, height: number): Uint8Array {
  const surface = kit.MakeSurface(width, height);
  if (!surface) throw new Error('Could not create paint surface');
  const canvas: Canvas = surface.getCanvas();
  canvas.clear(kit.parseColorString('#14131b'));
  const frame = new ScorePlayer(score).frameAt(time), size = Math.min(width, height);
  const paint: Paint = new kit.Paint();
  paint.setAntiAlias(true);
  for (const scene of frame.scenes) {
    for (const wash of frame.washes.filter((event) => event.sceneIndex === scene.index)) {
      const center = [wash.position.x * width, wash.position.y * height];
      const radius = wash.radius * size * (1 + Math.min(8, Math.max(0, time - wash.start)) * wash.flow);
      const color = kit.parseColorString(wash.color), clear = color.slice(); clear[3] = 0;
      const shader = kit.Shader.MakeRadialGradient(center, radius, [color, clear], [0, 1], kit.TileMode.Clamp);
      paint.setStyle(kit.PaintStyle.Fill); paint.setShader(shader);
      paint.setAlphaf(markOpacity(scene, wash.start, time) * eventProgress(wash.start, wash.start + 2, time)
        * Math.max(0, 1 - Math.max(0, time - wash.end) / 12) * wash.opacity);
      canvas.drawCircle(center[0]!, center[1]!, radius, paint);
      paint.setShader(null); shader.delete();
    }
    for (const stroke of frame.strokes.filter((event) => event.sceneIndex === scene.index)) {
      for (const segment of strokeSegments(stroke.points)) {
        const progress = eventProgress(segment.start, segment.end, time);
        if (progress <= 0) continue;
        const path = new kit.PathBuilder().moveTo(segment.from.x * width, segment.from.y * height)
          .cubicTo(segment.control1.x * width, segment.control1.y * height, segment.control2.x * width, segment.control2.y * height, segment.to.x * width, segment.to.y * height).detach();
        const trimmed = progress >= 1 ? path.copy() : path.makeTrimmed(0, progress, false);
        if (!trimmed) throw new Error('Could not reveal brush path');
        paint.setStyle(kit.PaintStyle.Stroke); paint.setStrokeCap(kit.StrokeCap.Round); paint.setStrokeJoin(kit.StrokeJoin.Round);
        paint.setColor(kit.parseColorString(segment.color));
        const diffusion = kit.MaskFilter.MakeBlur(kit.BlurStyle.Normal, Math.min(6, 1.5 + Math.max(0, time - segment.start) * .08), true);
        paint.setMaskFilter(diffusion); paint.setStrokeWidth(segment.width * size * 1.7); paint.setAlphaf(markOpacity(scene, segment.start, time) * .055);
        canvas.drawPath(trimmed, paint); paint.setMaskFilter(null); diffusion.delete();
        paint.setAlphaf(markOpacity(scene, segment.start, time) * segment.opacity); paint.setStrokeWidth(segment.width * size);
        const shader = pigment.makeShader([...kit.parseColorString(segment.color), scene.seed % 65536, scene.brushStyle === 'dry' ? .72 : .32]);
        paint.setShader(shader); canvas.drawPath(trimmed, paint); paint.setShader(null); shader.delete();
        paint.setAlphaf(markOpacity(scene, segment.start, time) * segment.opacity * .2);
        paint.setStrokeWidth(segment.width * size * .17); canvas.drawPath(trimmed, paint);
        trimmed.delete(); path.delete();
      }
    }
    for (const drop of frame.drops.filter((event) => event.sceneIndex === scene.index)) {
      const base = drop.radius * size, age = time - drop.time;
      paint.setStyle(kit.PaintStyle.Fill); paint.setColor(kit.parseColorString(drop.color));
      paint.setAlphaf(markOpacity(scene, drop.time, time) * Math.max(0, 1 - age / 14) * drop.strength * .55);
      const blur = kit.MaskFilter.MakeBlur(kit.BlurStyle.Normal, 2, true); paint.setMaskFilter(blur);
      canvas.drawCircle(drop.position.x * width, drop.position.y * height, base * (1 + Math.min(1, Math.max(0, age) / 3) * .7), paint);
      paint.setMaskFilter(null); blur.delete(); canvas.drawCircle(drop.position.x * width, drop.position.y * height, base * .4, paint);
    }
  }
  surface.flush(); const snapshot = surface.makeImageSnapshot(), bytes = snapshot.encodeToBytes();
  if (!bytes) throw new Error('Could not encode paint preview');
  const copy = bytes.slice(); snapshot.delete(); paint.delete(); surface.dispose();
  return copy;
}

async function main() {
  const kit = await initialize({ locateFile: (file: string) => join(dirname(require.resolve('canvaskit-wasm')), file) });
  const pigment = kit.RuntimeEffect.Make(PIGMENT_SKSL);
  if (!pigment) throw new Error('Pigment shader did not compile');
  const supplied = process.argv[2];
  const analysis = supplied ? parseMusicAnalysis(JSON.parse(readFileSync(supplied, 'utf8'))) : (await createComposition(FIXTURE_STYLES[0]!)).analysis;
  const score = composeVisualScore(analysis), output = resolve('research/results/generated/paint', supplied ? `${analysis.track.hash.slice(0, 12)}-reference` : 'ground-truth-pop');
  mkdirSync(output, { recursive: true }); writeFileSync(join(output, 'song.score.json'), JSON.stringify(score, null, 2));
  const times = [...new Set([0, 4, 12, 16.5, 20, 27, score.duration - .05].filter((time) => time <= score.duration))];
  const hashes = [], timings = [];
  for (const time of times) {
    const start = performance.now(), bytes = render(kit, pigment, score, time, 360, 800); timings.push(performance.now() - start);
    // Render a different position between repeat frames to simulate a backward seek.
    render(kit, pigment, score, Math.max(0, time - 3), 360, 800);
    assert.deepEqual(render(kit, pigment, score, time, 360, 800), bytes, 'Seek reconstruction must be pixel-identical');
    const name = `paint-${time.toFixed(2)}.png`; writeFileSync(join(output, name), bytes);
    hashes.push({ time, file: name, sha256: createHash('sha256').update(bytes).digest('hex') });
  }
  writeFileSync(join(output, 'report.json'), JSON.stringify({ renderer: 'Desktop CanvasKit CPU', pixelIdenticalAfterSeek: true,
    quality: analysis.quality, models: analysis.modelVersions, scoreEvents: { scenes: score.scenes.length, strokes: score.strokes.length, washes: score.washes.length, drops: score.drops.length },
    firstRenderMilliseconds: timings, frames: hashes, nativeGpuValidation: 'pending' }, null, 2));
  console.log(`Rendered ${times.length} paint previews with identical seek reconstruction: ${output}`);
  pigment.delete();
}
void main().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
