import test from 'node:test';
import assert from 'node:assert/strict';
import { AudioBuffer, mixChannels } from '../src/audio/audio-buffer';
import { SampleRateEstimator, sampleTimestamp } from '../src/audio/sample-rate';
import { AudioSampler } from '../src/audio/audio-sampler';
import { sine } from './fixtures';

test('mono mix averages channels, bounded ring retains only newest samples', () => {
  const buffer = new AudioBuffer(4);
  mixChannels([{ frames: [0.1, 0.2, 0.3, 0.4, 0.5] }, { frames: [-0.1, 0.2, -0.3, 0.4, -0.5] }], buffer);
  const output = new Float32Array(4);
  assert.equal(buffer.copyLatest(output), 4);
  assert.ok(Math.abs(output[0]! - 0.2) < 1e-6);
  assert.equal(output[1], 0);
  assert.ok(Math.abs(output[2]! - 0.4) < 1e-6);
  assert.equal(output[3], 0);
  buffer.reset();
  assert.equal(buffer.size, 0);
});

test('malformed and uneven channels remain bounded and finite', () => {
  const buffer = new AudioBuffer(4);
  assert.equal(mixChannels([], buffer), 0);
  assert.equal(mixChannels([{ frames: [NaN, Infinity, 5] }, { frames: [0, 0] }], buffer), 2);
  const output = new Float32Array(4);
  buffer.copyLatest(output);
  assert.ok(output.every(Number.isFinite));
});

for (const hz of [44100, 48000, 96000]) {
  test(`rate estimator recovers ${hz} with varying contiguous packet sizes`, () => {
    const estimator = new SampleRateEstimator();
    let time = 0;
    let result = { hz: null as number | null, confidence: 0 };
    for (let i = 0; i < 30; i++) {
      const count = i % 2 === 0 ? 512 : 1024;
      result = estimator.observe(count, time);
      time += count / hz;
    }
    assert.ok(Math.abs(result.hz! - hz) < 1);
    assert.equal(result.confidence, 1);
    assert.equal(estimator.observe(1024, time - 2).hz, null);
  });
}

test('unusable timestamps and callback throughput never yield pretend audio rate', () => {
  const estimator = new SampleRateEstimator();
  for (let i = 0; i < 30; i++) assert.equal(estimator.observe(1024, -1).hz, null);
  for (let i = 0; i < 30; i++) assert.equal(estimator.observe(1024, 0).hz, null);
  const snapshot = new AudioSampler('snapshot');
  for (let i = 0; i < 30; i++) snapshot.receive({ channels: [{ frames: sine(1000, 48000, 1024) }], timestamp: i * 50 }, i * 0.05, i * 0.05, i * 50);
  assert.equal(snapshot.getDiagnostics().estimatedSampleRate, null);
  assert.equal(snapshot.getDiagnostics().feature?.bandRatios, null);
});

test('Android timestamp adaptation uses milliseconds; invalid timestamps are null', () => {
  assert.equal(sampleTimestamp(124500, 'android'), 124.5);
  assert.equal(sampleTimestamp(124.5, 'other'), 124.5);
  assert.equal(sampleTimestamp(-1, 'android'), null);
  assert.equal(sampleTimestamp(NaN, 'other'), null);
});

test('Android snapshots are independently analyzed, never stitched into fake PCM', () => {
  const sampler = new AudioSampler('snapshot');
  sampler.receive({ channels: [{ frames: new Float32Array(1024).fill(0.5) }], timestamp: 0 }, 0, 0, 0);
  const next = sampler.receive({ channels: [{ frames: new Float32Array(1024) }], timestamp: 50 }, 0.05, 0.05, 50)!;
  assert.equal(next.rms, 0);
  assert.equal(next.confidence.spectrum, 0.5);
  assert.equal(sampler.getDiagnostics().frames, 2048);
});

test('continuous pipeline acquires rate, throttles work and recovers after seek', () => {
  const sampler = new AudioSampler('continuous');
  for (let i = 0; i < 80; i++) {
    const time = i * 512 / 48000;
    sampler.receive({ channels: [{ frames: sine(1000, 48000, 512, 0.5, i * 512) }], timestamp: time }, time, time, time * 1000);
  }
  const diagnostics = sampler.getDiagnostics();
  assert.ok(diagnostics.feature!.bandRatios![1] > 0.97);
  assert.ok(Math.abs(diagnostics.estimatedSampleRate! - 48000) < 1);
  assert.ok(diagnostics.updates <= 26);
  sampler.reset();
  assert.equal(sampler.getDiagnostics().feature, null);
  assert.equal(sampler.getDiagnostics().estimatedSampleRate, null);
  for (let i = 0; i < 12; i++) sampler.receive({ channels: [{ frames: sine(4000, 48000, 512, 0.5, i * 512) }], timestamp: 10 + i * 512 / 48000 }, 10 + i * 512 / 48000, 10, 1000 + i * 512 / 48);
  assert.ok(sampler.getDiagnostics().feature!.bandRatios![2] > 0.97);
});

test('pause continuity reset suppresses stale onset and does no work by itself', () => {
  const sampler = new AudioSampler('snapshot');
  sampler.receive({ channels: [{ frames: sine(100, 48000, 1024) }], timestamp: 0 }, 0, 0, 0);
  const updates = sampler.getDiagnostics().updates;
  sampler.breakContinuity();
  assert.equal(sampler.getDiagnostics().updates, updates);
  const resumed = sampler.receive({ channels: [{ frames: sine(4000, 48000, 1024) }], timestamp: 50 }, 0.05, 0.05, 5000)!;
  assert.equal(resumed.spectralFlux, 0);
  assert.equal(resumed.onsetStrength, 0);
});

test('constant native timestamps fall back to playback position', () => {
  const sampler = new AudioSampler('snapshot');
  const chunk = { channels: [{ frames: sine(440, 48000, 1024) }], timestamp: 0 };
  sampler.receive(chunk, 0, 0, 0);
  assert.equal(sampler.receive(chunk, 0, 2, 100)!.timestamp, 2);
});
