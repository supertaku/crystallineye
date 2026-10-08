import test from 'node:test';
import assert from 'node:assert/strict';
import { MusicEventEngine } from '../src/music/music-event-engine';
import { interpretMusic, INITIAL_MUSIC_VISUAL } from '../src/visualization/music-visual-interpreter';
import { advanceVisual } from '../src/visualization/visual-frame';
import { shaderUniforms } from '../src/visualization/shader-uniforms';
import { SAFETY_CONFIG } from '../src/config';
import type { MusicEventFrame } from '../src/music/types';
import { feature } from './fixtures';
import { AudioSampler } from '../src/audio/audio-sampler';
import { rhythmicFixture } from '../scripts/rhythmic-fixture';

const event: MusicEventFrame = { timestamp: 10, energy: 0.5, brightness: 0.5, spectralBalance: [0.4, 0.4, 0.2],
  rawOnset: 0, novelty: 0, onsetStrength: 0, tempo: { bpm: 120, confidence: 0.9 }, beat: { phase: 0, pulse: 1, confidence: 0.9, detected: true } };

test('musical grammar maps tempo, energy, onset and relative spectrum to independent visual controls', () => {
  const slow = interpretMusic({ ...event, tempo: { bpm: 60, confidence: 0.9 } });
  const fast = interpretMusic({ ...event, tempo: { bpm: 180, confidence: 0.9 } });
  assert.ok(fast.flowSpeed > slow.flowSpeed);
  const quiet = interpretMusic({ ...event, energy: 0 });
  const loud = interpretMusic({ ...event, energy: 1 });
  assert.ok(loud.pigmentIntensity > quiet.pigmentIntensity);
  assert.equal(loud.paletteOKLCH[0].lightness, quiet.paletteOKLCH[0].lightness);
  const low = interpretMusic({ ...event, spectralBalance: [1, 0, 0] });
  const mid = interpretMusic({ ...event, spectralBalance: [0, 1, 0] });
  const high = interpretMusic({ ...event, spectralBalance: [0, 0, 1] });
  assert.ok(low.macroScale < high.macroScale);
  assert.ok(mid.turbulence > low.turbulence);
  assert.ok(high.detailScale > low.detailScale);
  const onset = shaderUniforms(interpretMusic({ ...event, onsetStrength: 1 }), 360, 800, false);
  const noOnset = shaderUniforms(interpretMusic(event), 360, 800, false);
  assert.ok(onset.uOnset > noOnset.uOnset);
  assert.deepEqual(onset.uColorA, noOnset.uColorA);
  const weak = shaderUniforms(interpretMusic({ ...event, beat: { ...event.beat, pulse: 0.1 } }), 360, 800, false);
  assert.ok(noOnset.uBeatPulse > weak.uBeatPulse);
});

test('feature timeline feeds event interpretation without fabricated sample rate or immediate tempo', () => {
  const engine = new MusicEventEngine();
  let state = INITIAL_MUSIC_VISUAL;
  for (let i = 0; i < 210; i++) {
    const strength = i % 15 === 0 ? 1 : 0;
    const measured = feature(i / 30, { onsetStrength: strength, rmsNormalized: strength ? 0.9 : 0.4 });
    const music = engine.update(measured);
    state = interpretMusic(music);
    assert.equal(state.bpm, 0);
    assert.equal(measured.spectralCentroidHz, null);
    assert.ok(state.palette.flat().every((value) => value >= 0 && value <= 1));
  }
  assert.ok(state.pigmentIntensity > INITIAL_MUSIC_VISUAL.pigmentIntensity);
});

test('UI clock moves with unchanged features, interpolates beats between callbacks and reduces motion', () => {
  const target = interpretMusic(event);
  let state = target;
  for (let i = 1; i <= 15; i++) state = advanceVisual(state, target, 1 / 60, i / 60, false);
  assert.ok(state.time > 0);
  assert.ok(Math.abs(state.beatPhase - 0.5) < 0.01);
  assert.ok(state.beatPulse < 0.5);
  const reduced = advanceVisual(target, target, 1 / 60, 0, true);
  const full = advanceVisual(target, target, 1 / 60, 0, false);
  assert.ok(reduced.time < full.time);
  assert.equal(shaderUniforms(reduced, 360, 800, true).uReducedMotion, 1);
});

test('single palette safety layer constrains rapid extremes without suppressing beat movement', () => {
  let state = INITIAL_MUSIC_VISUAL;
  const dt = 1 / 60;
  for (let i = 0; i < 300; i++) {
    const target = interpretMusic({ ...event, brightness: i % 2, energy: i % 2, onsetStrength: 1 });
    const previous = state;
    state = advanceVisual(state, target, dt, 0, false);
    for (let color = 0; color < 3; color++) {
      assert.ok(Math.abs(state.paletteOKLCH[color]!.lightness - previous.paletteOKLCH[color]!.lightness) <= SAFETY_CONFIG.lightnessPerSecond * dt + 1e-9);
      assert.ok(state.paletteOKLCH[color]!.chroma <= SAFETY_CONFIG.maxChroma);
    }
    assert.equal(state.beatPulse, 1);
    assert.equal(state.onset, 1);
  }
});

test('real synthetic snapshot PCM produces rhythmic shader inputs deterministically', () => {
  const source = rhythmicFixture(48000, 24, 120);
  const run = () => {
    const sampler = new AudioSampler('snapshot');
    const music = new MusicEventEngine();
    let maximumPulse = 0;
    let maximumOnset = 0;
    let state = INITIAL_MUSIC_VISUAL;
    for (let i = 0; i < 24 * 30; i++) {
      const offset = i * 1600;
      const frame = sampler.receive({ timestamp: i * 1000 / 30, channels: [{ frames: source.subarray(offset, offset + 1024) }] }, i / 30, i / 30, i * 1000 / 30);
      if (!frame) continue;
      assert.equal(frame.spectralCentroidHz, null);
      assert.equal(frame.bandRatios, null);
      const events = music.update(frame);
      state = interpretMusic(events);
      maximumPulse = Math.max(maximumPulse, state.beatPulse);
      maximumOnset = Math.max(maximumOnset, state.onset);
    }
    assert.ok(maximumPulse > 0.8);
    assert.ok(maximumOnset > 0.8);
    assert.ok(state.bpm >= 115 && state.bpm <= 125, `PCM tempo ${state.bpm}, confidence ${state.tempoConfidence}`);
    return shaderUniforms(state, 360, 800, false);
  };
  assert.deepEqual(run(), run());
});
