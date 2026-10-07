import { DSPEngine } from '../src/dsp/dsp-engine';
import { ColorEngine } from '../src/color/color-engine';
import { sine } from '../tests/fixtures';

for (const size of [2048, 1024]) {
  const engine = new DSPEngine(size);
  const color = new ColorEngine();
  const samples = sine(1000, 48000, size);
  const times: number[] = [];
  for (let i = 0; i < 2200; i++) {
    const start = performance.now();
    const features = engine.analyze(samples, size, i / 30, { hz: 48000, confidence: 1 }, 1 / 30);
    color.update(features, 1 / 30);
    if (i >= 200) times.push(performance.now() - start);
  }
  times.sort((a, b) => a - b);
  console.log(JSON.stringify({ environment: `Node ${process.version}; ${process.platform}; desktop only`, fftSize: size, samples: times.length,
    meanMs: times.reduce((sum, value) => sum + value, 0) / times.length, p95Ms: times[Math.floor(times.length * 0.95)], maxMs: times[times.length - 1] }));
}
