import test from 'node:test';
import assert from 'node:assert/strict';
import { rms } from '../src/dsp/rms';
import { JavaScriptFFT } from '../src/dsp/fft';
import { hannWindow } from '../src/dsp/window';
import { spectralCentroid } from '../src/dsp/spectral-centroid';
import { bandEnergy } from '../src/dsp/band-energy';
import { spectralFlux } from '../src/dsp/spectral-flux';
import { FeatureNormalizer } from '../src/dsp/normalizer';
import { OnsetDetector } from '../src/dsp/onset';
import { DSPEngine } from '../src/dsp/dsp-engine';
import { sine, silence, amplitudeRamp, impulse } from './fixtures';

test('RMS: silence, constant, sine and amplitude ramp', () => {
  assert.equal(rms(silence()), 0);
  assert.equal(rms(new Float32Array(16).fill(-0.25)), 0.25);
  assert.ok(Math.abs(rms(sine(1000, 48000, 48000)) - 0.5 / Math.sqrt(2)) < 1e-6);
  const ramp = amplitudeRamp();
  assert.ok(rms(ramp.subarray(0, 12000)) < rms(ramp.subarray(36000)));
  assert.equal(rms(new Float32Array(0)), 0);
});

test('Hann window: zero endpoints, symmetry and peak', () => {
  const window = hannWindow(2048);
  assert.equal(window[0], 0);
  assert.equal(window[2047], 0);
  assert.ok(window[1024]! > 0.999);
  for (let i = 0; i < 2048; i++) assert.equal(window[i], window[2047 - i]);
});

for (const sampleRate of [44100, 48000, 96000]) {
  for (const [frequency, dominant] of [[100, 0], [1000, 1], [4000, 2]] as const) {
    test(`${frequency} Hz at ${sampleRate} Hz: correct band and centroid`, () => {
      const spectrum = new JavaScriptFFT(2048).transform(sine(frequency, sampleRate));
      const bands = bandEnergy(spectrum, sampleRate, 2048);
      assert.ok(bands[dominant]! > 0.97, `${bands}`);
      const centroid = spectralCentroid(spectrum, sampleRate, 2048);
      assert.ok(Math.abs(centroid - frequency) < sampleRate / 2048, `${centroid}`);
    });
  }
}

test('FFT zero-padding preserves frequency, never fakes resolution', () => {
  const fft = new JavaScriptFFT(2048);
  const spectrum = fft.transform(sine(1000, 48000, 1024), 1024);
  assert.ok(Math.abs(spectralCentroid(spectrum, 48000, 2048) - 1000) < 25);
});

test('spectral centroid rises with input frequency; silence is zero', () => {
  const fft = new JavaScriptFFT(2048);
  const low = spectralCentroid(fft.transform(sine(100)), 48000, 2048);
  const high = spectralCentroid(fft.transform(sine(4000)), 48000, 2048);
  assert.ok(high > low);
  assert.equal(spectralCentroid(fft.transform(silence()), 48000, 2048), 0);
  assert.deepEqual(bandEnergy(fft.transform(silence()), 48000, 2048), [0, 0, 0]);
});

test('spectral flux: identical frames zero; new spectral energy positive', () => {
  const fft = new JavaScriptFFT(2048);
  const first = fft.transform(sine(100)).slice();
  assert.equal(spectralFlux(first, first), 0);
  assert.equal(spectralFlux(first, null), 0);
  assert.ok(spectralFlux(fft.transform(sine(4000)), first) > 0);
});

test('onset detector warms up and distinguishes silence from impulse novelty', () => {
  const detector = new OnsetDetector();
  for (let i = 0; i < 30; i++) assert.equal(detector.update(0, 1 / 30), 0);
  assert.ok(detector.update(1, 1 / 30) > 0.9);
  detector.reset();
  assert.equal(detector.update(1, 1 / 30), 0);
});

test('normalization keeps quiet sections quieter and rejects extreme values', () => {
  const normalizer = new FeatureNormalizer();
  let loud = 0;
  for (let i = 0; i < 300; i++) loud = normalizer.energy(0.5, 1 / 30);
  const quiet = normalizer.energy(0.01, 1 / 30);
  assert.ok(quiet < loud - 0.2);
  assert.equal(normalizer.energy(0, 1 / 30), 0);
  assert.ok(normalizer.energy(100, 1 / 30) <= 1);
  assert.ok(normalizer.brightness(4000, 0) > normalizer.brightness(100, 0));
});

test('unknown sample rate yields no Hz centroid or music bands', () => {
  const frame = new DSPEngine().analyze(sine(440), 2048, 2, { hz: null, confidence: 0 }, 1 / 30);
  assert.equal(frame.spectralCentroidHz, null);
  assert.equal(frame.bandRatios, null);
  assert.equal(frame.confidence.sampleRate, 0);
  assert.ok(frame.spectralCentroidNormalized > 0);
  assert.ok(frame.rms > 0);
});

test('DSP reset clears flux/onset history and handles synthetic impulse', () => {
  const engine = new DSPEngine();
  engine.analyze(sine(100), 2048, 0, { hz: 48000, confidence: 1 }, 1 / 30);
  engine.reset();
  const frame = engine.analyze(impulse(), 2048, 1, { hz: 48000, confidence: 1 }, 1 / 30);
  assert.equal(frame.spectralFlux, 0);
  assert.equal(frame.onsetStrength, 0);
  assert.ok(Number.isFinite(frame.spectralCentroidHz));
});
