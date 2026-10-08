import test from 'node:test';
import assert from 'node:assert/strict';
import { createComposition, FIXTURE_STYLES, encodeWav } from '../scripts/v3-fixtures';
import { parseMusicAnalysis } from '../src/analysis/analysis-schema';
import { analyzeTrack } from '../src/analysis/analysis-engine';
import { ANALYSIS_SAMPLE_RATE, COMPOSER_VERSION } from '../src/analysis/versions';
import { composeVisualScore } from '../src/visual-score/composer';
import { ScorePlayer } from '../src/paint/score-player';
import { eventProgress, sceneOpacity, strokeSegments } from '../src/paint/scene-runtime';
import { AudioTransport } from '../src/audio-v3/audio-transport';
import { checkAudioBudget, downmixBuffer } from '../src/audio-v3/audio-analysis-buffer';
import { inspectAudioHeader } from '../src/audio-v3/audio-metadata';
import { JavaScriptFFT } from '../src/dsp/fft';
import { AnalysisCache } from '../src/analysis/analysis-cache';
import { extractMelody } from '../src/analysis/melody-extractor';

const fixture = createComposition(FIXTURE_STYLES[0]);

test('calibrated decoder contract measures 440 Hz and downmixes actual stereo samples', () => {
  const left = Float32Array.from({ length: 22050 }, (_, i) => Math.sin(2 * Math.PI * 440 * i / 22050));
  const right = Float32Array.from(left, (sample) => sample * 0.5);
  const decoded = downmixBuffer({ sampleRate: 22050, duration: 1, numberOfChannels: 2, length: left.length,
    copyFromChannel: (out, channel, offset) => out.set((channel ? right : left).subarray(offset, offset + out.length)) });
  assert.equal(decoded.numberOfChannels, 1); assert.equal(decoded.sampleRate, 22050);
  assert.ok(Math.abs(decoded.pcm[20]! - left[20]! * 0.75) < 1e-6);
  const fft = new JavaScriptFFT(4096), spectrum = fft.transform(decoded.pcm);
  let peak = 1;
  for (let i = 2; i < spectrum.length; i++) if (spectrum[i]! > spectrum[peak]!) peak = i;
  assert.ok(Math.abs(peak * 22050 / 4096 - 440) <= 6);
  const wav = encodeWav(left);
  assert.deepEqual(inspectAudioHeader((offset, count) => wav.subarray(offset, offset + count), wav.length), { sampleRate: 22050, numberOfChannels: 1 });
});

test('native PCM copying handles a partial final chunk without exposing a larger backing buffer', () => {
  const length = 150000;
  const decoded = downmixBuffer({ sampleRate: 22050, duration: length / 22050, numberOfChannels: 2, length,
    copyFromChannel: (out, channel, offset) => {
      // Match the pinned native host function, which uses backing buffer size.
      const destination = new Float32Array(out.buffer);
      assert.ok(offset + destination.length <= length, 'Native copy cannot read past the channel');
      destination.fill(channel ? 0.6 : 0.2);
    } });
  assert.equal(decoded.pcm.length, length);
  for (const index of [0, 65535, 65536, 131071, 131072, length - 1]) assert.ok(Math.abs(decoded.pcm[index]! - 0.4) < 1e-6);
});

test('resource gate rejects unsafe allocation before decoding', () => {
  const safe = { duration: 240, sampleRate: 44100, numberOfChannels: 2, encodedBytes: 10e6 };
  assert.ok(checkAudioBudget(safe) > 0);
  assert.throws(() => checkAudioBudget({ ...safe, duration: 361 }), /too long/);
  assert.throws(() => checkAudioBudget({ ...safe, numberOfChannels: 8 }), /too long/);
  assert.throws(() => checkAudioBudget({ ...safe, duration: NaN }), /metadata/);
  assert.throws(() => inspectAudioHeader(() => new Uint8Array(20), 20), /metadata/);
});

test('music schema rejects incompatible, corrupt, unordered and uncovered references', async () => {
  const { analysis } = await fixture;
  assert.equal(parseMusicAnalysis(analysis), analysis);
  for (const mutate of [
    (copy: typeof analysis) => { copy.track.analysisSampleRate = 44100 as 22050; },
    (copy: typeof analysis) => { copy.notes[0]!.confidence = NaN; },
    (copy: typeof analysis) => { copy.structure.segments[1]!.start += 1; },
    (copy: typeof analysis) => { copy.rhythm.beats.reverse(); },
    (copy: typeof analysis) => { copy.harmony.chromaFrames[0]!.values = [1]; },
  ]) { const copy = structuredClone(analysis); mutate(copy); assert.throws(() => parseMusicAnalysis(copy), /Invalid music analysis/); }
});

test('measured fallback recovers synthetic tempo without inventing notes or meter', async () => {
  const { pcm, analysis } = await fixture;
  const result = await analyzeTrack({ pcm, sampleRate: 22050, numberOfChannels: 1, duration: 32 }, analysis.track.hash, () => {});
  parseMusicAnalysis(result);
  assert.ok(result.rhythm.bpm && Math.abs(result.rhythm.bpm - 120) <= 5, `Estimated ${result.rhythm.bpm} BPM`);
  assert.deepEqual(result.notes, []); assert.equal(result.rhythm.meter, undefined);
  assert.ok(result.rhythm.downbeats.every((beat) => beat.inferred && beat.confidence <= 0.35));
  const silence = await analyzeTrack({ pcm: new Float32Array(ANALYSIS_SAMPLE_RATE * 5), sampleRate: 22050, numberOfChannels: 1, duration: 5 }, '0'.repeat(64), () => {});
  assert.equal(silence.rhythm.bpm, null); assert.equal(silence.rhythm.beats.length, 0);
  const blank = composeVisualScore(silence);
  assert.equal(blank.strokes.length + blank.drops.length + blank.washes.length, 0);
});

test('composer is repeatable and notes, sections and energy control the painting', async () => {
  const { analysis } = await fixture;
  const score = composeVisualScore(analysis);
  assert.deepEqual(composeVisualScore(structuredClone(analysis)), score);
  assert.ok(score.strokes.length && score.scenes.length === 2);
  const changed = structuredClone(analysis); changed.notes.forEach((note) => { note.midi += 2; });
  assert.notDeepEqual(composeVisualScore(changed).strokes, score.strokes);
  const quiet = structuredClone(analysis); quiet.dynamics.forEach((frame) => { frame.energy *= 0.1; });
  assert.ok(composeVisualScore(quiet).strokes[0]!.points[0]!.width < score.strokes[0]!.points[0]!.width);
  for (const stroke of score.strokes) for (const segment of strokeSegments(stroke.points)) {
    assert.ok(segment.end > segment.start);
    for (const point of [segment.from, segment.to, segment.control1, segment.control2]) assert.ok(point.x >= 0 && point.x <= 1 && point.y >= 0 && point.y <= 1);
  }
});

test('seek reconstruction is identical to playback and keeps at most two sections', async () => {
  const { analysis } = await fixture;
  const player = new ScorePlayer(composeVisualScore(analysis));
  for (let time = 0; time <= 30; time += 0.1) player.frameAt(time);
  const direct = new ScorePlayer(player.score).frameAt(18);
  assert.deepEqual(player.frameAt(18), direct); assert.equal(direct.scenes.length, 2);
  assert.equal(player.frameAt(24).scenes.length, 1);
  assert.deepEqual(player.frameAt(8), new ScorePlayer(player.score).frameAt(8));
  assert.equal(eventProgress(2, 4, 3), 0.5); assert.equal(eventProgress(2, 4, 1), 0);
  assert.equal(sceneOpacity(player.score.scenes[0]!, 22), 0);
});

test('transport reads native time, freezes on pause/stall and never accumulates timer drift', () => {
  let time = 0, paused = 0, sought = 0;
  const transport = new AudioTransport(240);
  transport.attach({ play: () => {}, pause: () => { paused++; }, seekToTime: (value) => { sought = value; }, readTime: () => time });
  transport.play(); time = 37.123;
  for (let i = 0; i < 1000; i++) assert.equal(transport.currentTime(), time);
  transport.pause(); time = 90; assert.equal(transport.currentTime(), 37.123); assert.equal(paused, 1);
  transport.seek(5); assert.equal(sought, 5); transport.play();
  assert.equal(transport.currentTime(), 5);
  time = 5.03; assert.equal(transport.currentTime(), 5.03);
  time = 5.3; assert.equal(transport.currentTime(), 5.3);
  transport.setBuffering(true); time = 100; assert.equal(transport.currentTime(), 5.3);
  transport.setBuffering(false); time = 5.4; assert.equal(transport.currentTime(), 5.4);
  time = NaN; assert.throws(() => transport.pause(), /clock/); assert.equal(paused, 2); assert.equal(transport.playing, false);
});

test('cache invalidates analysis versions and rebuilds changed composer from cached music', async () => {
  const { analysis } = await fixture;
  const files = new Map<string, string>();
  const cache = new AnalysisCache({ read: async (key) => files.get(key) ?? null, write: async (key, value) => { files.set(key, value); } });
  const score = composeVisualScore(analysis);
  await cache.put(analysis, score);
  assert.deepEqual((await cache.get(analysis.track.hash, analysis.modelVersions))?.score, score);
  assert.equal(await cache.get(analysis.track.hash, { ...analysis.modelVersions, transcription: 'changed' }), null);
  const record = JSON.parse(files.get(score.analysisKey)!) as { score: typeof score };
  record.score.version = 'old-composer'; files.set(score.analysisKey, JSON.stringify(record));
  assert.equal((await cache.get(analysis.track.hash, analysis.modelVersions))?.score.version, COMPOSER_VERSION);
  files.set(score.analysisKey, '{broken'); assert.equal(await cache.get(analysis.track.hash, analysis.modelVersions), null);
});

test('melody selection favors a continuous line and trims overlapping notes', () => {
  const notes = [60, 62, 64, 65].flatMap((midi, i) => [{ start: i, end: i + 1.2, midi, confidence: 0.9, amplitude: 0.8 }, { start: i, end: i + 0.4, midi: i % 2 ? 90 : 30, confidence: 0.8, amplitude: 0.8 }]);
  const melody = extractMelody(notes);
  assert.deepEqual(melody.map((note) => note.midi), [60, 62, 64, 65]);
  assert.ok(melody.every((note, i) => note.end <= (melody[i + 1]?.start ?? Infinity)));
});
