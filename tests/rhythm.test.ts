import test from 'node:test';
import assert from 'node:assert/strict';
import { RHYTHM_CONFIG } from '../src/config';
import { OnsetEnvelope } from '../src/music/onset-envelope';
import { TempoEstimator } from '../src/music/tempo-estimator';
import { BeatTracker } from '../src/music/beat-tracker';
import { BeatEnvelope } from '../src/music/beat-envelope';
import { MusicEventEngine } from '../src/music/music-event-engine';
import { feature } from './fixtures';

function novelty(time: number, bpm: number, missing = false, extras = false) {
  const beat = Math.floor(time * bpm / 60 + 1e-8);
  const age = time - beat * 60 / bpm;
  const pulse = missing && beat % 7 === 4 ? 0 : Math.exp(-age / 0.045);
  const offbeatAge = age - 30 / bpm;
  return Math.max(pulse, extras && offbeatAge >= 0 ? 0.28 * Math.exp(-offbeatAge / 0.045) : 0);
}

function estimate(bpm: number, missing = false, extras = false, rate = 30) {
  const history = new OnsetEnvelope();
  const estimator = new TempoEstimator();
  const estimates = [];
  for (let i = 0; i <= rate * 25; i++) {
    const time = i / rate;
    history.push(time, novelty(time, bpm, missing, extras));
    estimates.push(estimator.update(history.points()));
  }
  return estimates;
}

for (const bpm of [60, 90, 120, 150]) {
  test(`autocorrelation recovers ${bpm} BPM and does not invent tempo during warm-up`, () => {
    const result = estimate(bpm);
    assert.ok(result.slice(0, 8 * 30).every((value) => value.bpm === null && value.confidence === 0));
    const final = result.at(-1)!;
    assert.ok(final.bpm !== null && Math.abs(final.bpm - bpm) <= 5, JSON.stringify(final));
    assert.ok(final.confidence >= RHYTHM_CONFIG.confidenceThreshold, JSON.stringify(final));
  });
}

test('stable 120 BPM avoids half-time flips, missing beats and weaker extra onsets', () => {
  for (const [missing, extras] of [[false, false], [true, false], [false, true]]) {
    const estimates = estimate(120, missing, extras).filter((value) => value.bpm !== null);
    assert.ok(estimates.length > 100);
    assert.ok(estimates.every((value) => Math.abs(value.bpm! - 120) <= 5), JSON.stringify(estimates.at(-1)));
  }
});

test('measured low-rate envelope and timestamp jitter retain useful tempo', () => {
  const history = new OnsetEnvelope();
  const tempo = new TempoEstimator();
  let result;
  for (let i = 0; i <= 300; i++) {
    const time = i / 12 + 0.008 * Math.sin(i * 1.7);
    // Broad measured events survive a 12 Hz callback cadence; tiny clicks may be missed.
    const distance = time - Math.round(time * 2) * 0.5;
    history.push(time, Math.exp(-((distance / 0.05) ** 2)));
    result = tempo.update(history.points());
  }
  assert.ok(result?.bpm !== null && Math.abs(result!.bpm! - 120) <= 5, JSON.stringify(result));
});

test('flat and silent envelopes never acquire tempo; stale evidence loses confidence', () => {
  for (const strength of [0, 0.4]) {
    const history = new OnsetEnvelope();
    const tempo = new TempoEstimator();
    for (let i = 0; i <= 600; i++) {
      history.push(i / 30, strength);
      assert.deepEqual(tempo.update(history.points()), { bpm: null, confidence: 0 });
    }
  }
  const history = new OnsetEnvelope();
  const tempo = new TempoEstimator();
  let result;
  for (let i = 0; i <= 900; i++) {
    history.push(i / 30, i < 600 ? novelty(i / 30, 120) : 0);
    result = tempo.update(history.points());
  }
  assert.ok(result!.confidence < RHYTHM_CONFIG.confidenceThreshold);
});

test('onset ring bounds both age and capacity and replaces duplicate timestamps', () => {
  const history = new OnsetEnvelope(10, 2);
  for (let i = 0; i < 1000; i++) history.push(i / 20, 0.5);
  assert.equal(history.size, 10);
  assert.equal(history.points()[0]!.timestamp, 49.5);
  history.push(49.95, 1);
  assert.equal(history.size, 10);
  assert.equal(history.points().at(-1)!.onsetStrength, 1);
  history.push(60, 0);
  assert.equal(history.size, 1);
  history.push(0, 0.2);
  assert.equal(history.size, 1);
});

test('beat phase aligns to events, coasts across missing onsets and corrects drift', () => {
  const tracker = new BeatTracker();
  const tempo = { bpm: 120, confidence: 0.9 };
  assert.equal(tracker.update(0, tempo, 1).phase, 0);
  assert.ok(Math.abs(tracker.update(0.25, tempo, 0).phase - 0.5) < 0.01);
  assert.ok(tracker.update(0.5, tempo, 0).pulse > 0.99);
  assert.ok(tracker.update(1, tempo, 0).pulse > 0.99);
  assert.ok(tracker.update(1.53, tempo, 1).phase < 0.1);
  const fallback = tracker.update(2, { bpm: null, confidence: 0 }, 0.7);
  assert.equal(fallback.phase, 0);
  assert.equal(fallback.pulse, 0.7);
});

test('beat envelope is bounded and decays monotonically after an event', () => {
  const envelope = new BeatEnvelope();
  assert.equal(envelope.value(0), 0);
  envelope.trigger(1, 2);
  assert.equal(envelope.value(1), 1);
  let previous = 1;
  for (let i = 1; i < 100; i++) {
    const value = envelope.value(1 + i / 100);
    assert.ok(value < previous && value >= 0);
    previous = value;
  }
  envelope.reset();
  assert.equal(envelope.value(2), 0);
});

test('seek and pause continuity suppress false onsets while preserving uncalibrated regions', () => {
  const engine = new MusicEventEngine();
  for (let i = 0; i < 360; i++) engine.update(feature(i / 30, { onsetStrength: novelty(i / 30, 120) }));
  engine.reset();
  const seek = engine.update(feature(40, { rmsNormalized: 1, onsetStrength: 1, spectrumRatios: [0, 0, 1] }));
  assert.equal(seek.novelty, 0);
  assert.equal(seek.beat.pulse, 0);
  assert.deepEqual(seek.tempo, { bpm: null, confidence: 0 });
  engine.breakContinuity();
  const resume = engine.update(feature(40.03, { onsetStrength: 1 }));
  assert.equal(resume.onsetStrength, 0);
  assert.ok(resume.spectralBalance.every(Number.isFinite));
  const jump = engine.update(feature(2, { onsetStrength: 1 }));
  assert.equal(engine.history.size, 1);
  assert.equal(jump.novelty, 0);
});
