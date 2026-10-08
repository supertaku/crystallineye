import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseMusicAnalysis } from '../src/analysis/analysis-schema';
import { extractFeatures } from '../src/analysis/feature-extractor';
import { composeVisualScore } from '../src/visual-score/composer';
import { ScorePlayer } from '../src/paint/score-player';

async function main() {
  const root = resolve('research/results/generated'), reports = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name === 'paint') continue;
    const folder = join(root, entry.name);
    // Diagnostic/capture folders share this ignored root; only references have both files.
    if (!existsSync(join(folder, 'song.analysis.json')) || !existsSync(join(folder, 'normalized.f32'))) continue;
    const analysis = parseMusicAnalysis(JSON.parse(readFileSync(join(folder, 'song.analysis.json'), 'utf8')));
    const bytes = readFileSync(join(folder, 'normalized.f32'));
    const pcm = new Float32Array(bytes.length / 4);
    for (let i = 0; i < pcm.length; i++) pcm[i] = bytes.readFloatLE(i * 4);
    const features = await extractFeatures(pcm);
    assert.equal(features.dynamics.length, analysis.dynamics.length);
    const errors: Record<string, number> = {};
    for (const key of ['rms', 'energy', 'bass', 'brightness', 'onset'] as const) {
      errors[key] = Math.max(...features.dynamics.map((frame, index) => Math.abs(frame[key] - analysis.dynamics[index]![key])));
      assert.ok(errors[key]! < 0.0005, `${entry.name}: Python/JS ${key} differs by ${errors[key]}`);
    }
    const score = composeVisualScore(analysis), player = new ScorePlayer(score);
    assert.deepEqual(score, composeVisualScore(analysis));
    const frame = player.frameAt(12); player.frameAt(28); assert.deepEqual(player.frameAt(12), frame);
    writeFileSync(join(folder, 'song.score.json'), JSON.stringify(score, null, 2));
    reports.push({ track: entry.name, quality: analysis.quality, maxFeatureErrors: errors, deterministicComposition: true, deterministicSeek: true });
  }
  assert.ok(reports.length >= 5, 'At least five reference tracks must be verified');
  writeFileSync(join(root, 'typescript-parity.json'), JSON.stringify(reports, null, 2));
  console.log(`Verified ${reports.length} Python JSON files, DSP parity, deterministic composition and seek.`);
}
void main().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
