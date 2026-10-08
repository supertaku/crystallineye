import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { analyzeTrack } from '../src/analysis/analysis-engine';
import { parseMusicAnalysis, type MusicAnalysis } from '../src/analysis/analysis-schema';
import { composeVisualScore } from '../src/visual-score/composer';
import { extractMelody } from '../src/analysis/melody-extractor';
import { ScorePlayer } from '../src/paint/score-player';

async function main() {
  const supplied = process.argv[2];
  if (!supplied) throw new Error('Supply the exact-source song.analysis.json; audio stays local.');
  const reference = parseMusicAnalysis(JSON.parse(readFileSync(supplied, 'utf8')));
  const bytes = readFileSync(join(dirname(supplied), 'normalized.f32'));
  const pcm = new Float32Array(bytes.length / 4);
  for (let i = 0; i < pcm.length; i++) pcm[i] = bytes.readFloatLE(i * 4);
  assert.ok(Math.abs(pcm.length / 22050 - reference.track.duration) < .01);
  const dsp = await analyzeTrack({ pcm, sampleRate: 22050, numberOfChannels: 1, duration: reference.track.duration }, reference.track.hash, () => {});
  // Hold measured features, heuristic harmony, DSP sections, composer and renderer fixed.
  // Only rhythm changes in B; rhythm + transcription change in C.
  const variants: Record<string, MusicAnalysis> = {
    A: dsp,
    B: { ...dsp, rhythm: reference.rhythm, modelVersions: { ...dsp.modelVersions, beatTracking: reference.modelVersions.beatTracking } },
    C: { ...dsp, rhythm: reference.rhythm, notes: reference.notes, modelVersions: { ...dsp.modelVersions, beatTracking: reference.modelVersions.beatTracking, transcription: reference.modelVersions.transcription } },
  };
  const label = process.argv[3] ?? 'current';
  const output = resolve('research/results/generated/true-colors-ab', label);
  mkdirSync(output, { recursive: true });
  const summaries = [];
  for (const [name, input] of Object.entries(variants)) {
    const start = performance.now(), score = composeVisualScore(input), elapsed = performance.now() - start;
    const jumps = score.strokes.slice(1).map((stroke, index) => {
      const previous = score.strokes[index]!, end = previous.points.at(-1)!, begin = stroke.points[0]!;
      return { time: stroke.start, gapSeconds: stroke.start - previous.end, distance: Math.hypot(begin.x - end.x, begin.y - end.y) };
    });
    const player = new ScorePlayer(score);
    const timestamps = [12, 30, 60, 90, 120, 180, 225];
    const lookup = timestamps.map((time) => {
      const before = player.frameAt(time); player.frameAt(Math.min(score.duration, time + 5));
      assert.deepEqual(player.frameAt(time), before);
      return { time, scene: before.sceneIndex, strokesStarted: before.strokes.length, activeStrokes: before.strokes.filter(s => s.start <= time && s.end > time).map(s => s.id) };
    });
    writeFileSync(join(output, `${name}.analysis.json`), JSON.stringify(input));
    writeFileSync(join(output, `${name}.score.json`), JSON.stringify(score));
    summaries.push({ variant: name, quality: input.quality, models: input.modelVersions, bpm: input.rhythm.bpm, notes: input.notes.length,
      selectedMelodyNotes: extractMelody(input.notes).length, beats: input.rhythm.beats.length, downbeats: input.rhythm.downbeats.length,
      chords: input.harmony.chords.length, sections: score.scenes.length, strokes: score.strokes.length, drops: score.drops.length,
      washes: score.washes.length, accents: score.accents.length, maxAdjacentStrokeJump: Math.max(0, ...jumps.map(j => j.distance)),
      maxConnectedStrokeJump: Math.max(0, ...jumps.filter(j => j.gapSeconds <= .45).map(j => j.distance)), composeMs: elapsed, lookup });
  }
  const report = { sourceHash: reference.track.hash, duration: reference.track.duration, composer: composeVisualScore(dsp).version,
    controlled: 'Same PCM, DSP features/harmony/sections, composer version and renderer; A DSP, B model rhythm, C model rhythm + notes.',
    timingMeaning: 'Desktop JS composition; model processes may contend. No Android FPS or listening acceptance.', variants: summaries };
  writeFileSync(join(output, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}
void main().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
