import test from 'node:test';
import assert from 'node:assert/strict';
import { attackRelease } from '../src/color/smoothing';
import { INITIAL_VISUAL, perceptualV1 } from '../src/color/perceptual-v1';
import { limitVisual } from '../src/color/safety-limiter';
import { oklchToHex, oklchToRGB } from '../src/color/oklch';
import { COLOR_CONFIG } from '../src/config';
import { AudioSampler } from '../src/audio/audio-sampler';
import { ColorEngine } from '../src/color/color-engine';
import { sine } from './fixtures';

test('smoothing converges, remains bounded, responds faster on attack', () => {
  let value = 0;
  for (let i = 0; i < 300; i++) value = attackRelease(value, 1, 1 / 60, 0.1, 0.7);
  assert.ok(value > 0.999);
  assert.ok(value <= 1);
  assert.ok(attackRelease(0, 1, 0.1, 0.1, 0.7) > 1 - attackRelease(1, 0, 0.1, 0.1, 0.7));
  assert.equal(attackRelease(0.5, 1, 0, 0.1, 0.7), 0.5);
});

test('perceptual mapper is deterministic, energy raises chroma and brightness raises lightness', () => {
  const features = { energy: 0.5, brightness: 0.5, balance: [0.6, 0.3, 0.1] as [number, number, number], onset: 0.2 };
  assert.deepEqual(perceptualV1(features), perceptualV1(features));
  assert.ok(perceptualV1({ ...features, energy: 1 }).colors[1].chroma > perceptualV1({ ...features, energy: 0 }).colors[1].chroma);
  assert.ok(perceptualV1({ ...features, brightness: 1 }).colors[1].lightness > perceptualV1({ ...features, brightness: 0 }).colors[1].lightness);
});

test('safety limiter constrains L/C/weight slew across alternating extreme targets', () => {
  let previous = INITIAL_VISUAL;
  for (let i = 0; i < 600; i++) {
    const target = {
      colors: previous.colors.map(() => ({ lightness: i % 2 ? 10 : -10, chroma: i % 2 ? 10 : -10, hue: 0 })) as typeof previous.colors,
      weights: (i % 2 ? [1, 0, 0] : [0, 0, 1]) as typeof previous.weights,
    };
    const next = limitVisual(target, previous, 1 / 60);
    for (let j = 0; j < 3; j++) {
      assert.ok(next.colors[j]!.lightness >= COLOR_CONFIG.safety.minLightness);
      assert.ok(next.colors[j]!.lightness <= COLOR_CONFIG.safety.maxLightness);
      assert.ok(next.colors[j]!.chroma <= COLOR_CONFIG.safety.maxChroma);
      assert.ok(Math.abs(next.colors[j]!.lightness - previous.colors[j]!.lightness) <= COLOR_CONFIG.safety.lightnessPerSecond / 60 + 1e-8);
      assert.ok(next.colors[j]!.hue === COLOR_CONFIG.hues[j]);
    }
    assert.ok(Math.abs(next.weights.reduce((a, b) => a + b) - 1) < 1e-8);
    previous = next;
  }
});

test('OKLCH conversion has correct neutral endpoints and stays in gamut', () => {
  assert.equal(oklchToHex({ lightness: 0, chroma: 0, hue: 0 }), '#000000');
  assert.equal(oklchToHex({ lightness: 1, chroma: 0, hue: 0 }), '#ffffff');
  for (let hue = 0; hue < 360; hue += 10) {
    const rgb = oklchToRGB({ lightness: 0.3, chroma: 0.3, hue });
    assert.ok(rgb.every((value) => value >= 0 && value <= 1));
  }
});

test('real synthetic PCM produces deterministic changing color through complete pipeline', () => {
  const run = () => {
    const sampler = new AudioSampler('snapshot');
    const color = new ColorEngine();
    const outputs = [];
    for (let i = 0; i < 240; i++) {
      const high = i >= 120;
      const frame = sampler.receive({ channels: [{ frames: sine(high ? 4000 : 100, 48000, 1024, high ? 0.8 : 0.05) }], timestamp: i * 50 }, i * 0.05, i * 0.05, i * 50)!;
      outputs.push(color.update(frame, 0.05));
    }
    return outputs;
  };
  const outputs = run();
  assert.deepEqual(outputs, run());
  assert.ok(outputs[239]!.colors[1].lightness > outputs[119]!.colors[1].lightness + 0.1);
  assert.ok(outputs[239]!.colors[1].chroma > outputs[119]!.colors[1].chroma);
});
