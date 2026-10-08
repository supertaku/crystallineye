import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { createComposition, FIXTURE_STYLES } from './v3-fixtures';
import { composeVisualScore } from '../src/visual-score/composer';
import { prepareStrokeGeometry } from '../src/paint/scene-runtime';
import { ScorePlayer } from '../src/paint/score-player';
import { estimateRenderNodes } from '../src/paint/render-diagnostics';

async function main() {
  const reports = [];
  for (const [complexity, name] of [['SIMPLE', 'sparse'], ['MEDIUM', 'pop'], ['DENSE', 'dense']] as const) {
    const style = FIXTURE_STYLES.find(style => style.name === name)!;
    const { analysis } = await createComposition(style);
    const memoryBefore = process.memoryUsage().heapUsed;
    const start = performance.now(), score = composeVisualScore(analysis), composerMs = performance.now() - start;
    const geometryStart = performance.now();
    const geometry = score.strokes.map(stroke => prepareStrokeGeometry(stroke, score.accents.filter(accent => accent.strokeId === stroke.id)));
    const prepareGeometryMs = performance.now() - geometryStart;
    const player = new ScorePlayer(score), lookups = [];
    for (let i = 0; i < 1000; i++) {
      const time = (i * .61803398875 % 1) * score.duration, began = performance.now();
      player.frameAt(time); lookups.push(performance.now() - began);
    }
    lookups.sort((a, b) => a - b);
    const mounted = score.scenes.map(scene => estimateRenderNodes(score, scene.index));
    reports.push({ complexity, style: name, duration: score.duration, composer: score.version, composerMs, prepareGeometryMs,
      lookupP95Ms: lookups[949], lookupMaxMs: lookups.at(-1), samples: 1000, strokes: score.strokes.length,
      ribbonSamples: geometry.reduce((sum, item) => sum + item.runs.reduce((total, run) => total + run.samples.length, 0), 0),
      maxMountedDrawableNodes: Math.max(...mounted.map(item => item.drawableNodes)),
      legacyNodesForSameLayers: Math.max(...mounted.map(item => item.legacyDrawableNodesForSameLayers)),
      heapDeltaBytes: process.memoryUsage().heapUsed - memoryBefore });
  }
  const output = resolve('research/results/generated/v31-performance'); mkdirSync(output, { recursive: true });
  const report = { environment: `Node ${process.version}; ${process.platform}; desktop JS only`,
    limits: 'Not presented frames, native/GPU timing, process peak memory, thermal/battery cost or Android acceptance. Heap deltas include GC variation.', reports };
  writeFileSync(join(output, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}
void main().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
