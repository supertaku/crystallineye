import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import initialize from 'canvaskit-wasm';
import { FLUID_INK_SKSL } from '../src/visualization/shaders/fluid-ink.sksl';
import { interpretMusic } from '../src/visualization/music-visual-interpreter';
import { shaderUniforms } from '../src/visualization/shader-uniforms';

// Uses the already-installed Skia CanvasKit dependency. Desktop validation only.
async function main() {
  const kit = await initialize({ locateFile: (file: string) => join(dirname(require.resolve('canvaskit-wasm')), file) });
  let diagnostic = '';
  const effect = kit.RuntimeEffect.Make(FLUID_INK_SKSL, (error) => { diagnostic = error; });
  if (!effect) throw new Error(`RuntimeEffect compilation failed: ${diagnostic}`);
  const output = resolve('fixtures/generated/shader');
  mkdirSync(output, { recursive: true });
  const cases = [
    { name: 'ink-portrait', width: 360, height: 800, time: 0, pulse: 0, energy: 0.7, spectrum: [0.6, 0.3, 0.1] },
    { name: 'ink-flow', width: 360, height: 800, time: 2, pulse: 0, energy: 0.7, spectrum: [0.6, 0.3, 0.1] },
    { name: 'ink-beat', width: 360, height: 800, time: 2, pulse: 1, energy: 0.7, spectrum: [0.6, 0.3, 0.1] },
    { name: 'ink-detail', width: 360, height: 800, time: 2, pulse: 0, energy: 0.7, spectrum: [0.1, 0.2, 0.7] },
    { name: 'ink-quiet', width: 360, height: 800, time: 2, pulse: 0, energy: 0.05, spectrum: [0.6, 0.3, 0.1] },
    { name: 'ink-wide', width: 800, height: 360, time: 2, pulse: 0.8, energy: 0.7, spectrum: [0.3, 0.5, 0.2] },
  ];
  for (const scenario of cases) {
    const surface = kit.MakeSurface(scenario.width, scenario.height);
    if (!surface) throw new Error('Could not create desktop Skia surface');
    const state = interpretMusic({ timestamp: 12, energy: scenario.energy, brightness: 0.65,
      spectralBalance: scenario.spectrum as [number, number, number], onsetStrength: 0, rawOnset: 0, novelty: 0,
      tempo: { bpm: 120, confidence: 0.9 }, beat: { phase: 0, pulse: scenario.pulse, confidence: 0.9, detected: false } });
    state.time = scenario.time;
    const uniforms = shaderUniforms(state, scenario.width, scenario.height, false);
    const values: number[] = [];
    for (let i = 0; i < effect.getUniformCount(); i++) {
      const name = effect.getUniformName(i) as keyof typeof uniforms;
      const value = uniforms[name];
      if (value === undefined) throw new Error(`Missing uniform ${name}`);
      values.push(...(typeof value === 'number' ? [value] : value));
    }
    const shader = effect.makeShader(values);
    const paint = new kit.Paint();
    paint.setShader(shader);
    surface.getCanvas().drawPaint(paint);
    surface.flush();
    const snapshot = surface.makeImageSnapshot();
    const bytes = snapshot.encodeToBytes();
    if (!bytes) throw new Error('Failed to encode shader preview');
    writeFileSync(join(output, `${scenario.name}.png`), bytes);
    snapshot.delete(); paint.delete(); shader.delete(); surface.dispose();
  }
  console.log(`Skia RuntimeEffect compiled; ${cases.length} desktop previews rendered in ${output}. Native Android GPU validation remains pending.`);
  effect.delete();
}
void main().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
