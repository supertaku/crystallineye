import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { createComposition, encodeWav, FIXTURE_STYLES } from './v3-fixtures';
import { ANALYSIS_SAMPLE_RATE } from '../src/analysis/versions';

async function main() {
  const output = resolve('research/fixtures/generated'); mkdirSync(output, { recursive: true });
  for (const style of FIXTURE_STYLES) {
    const { wav, analysis } = await createComposition(style);
    writeFileSync(join(output, `${style.name}.wav`), wav);
    writeFileSync(join(output, `${style.name}.ground-truth.json`), JSON.stringify(analysis));
    console.log(`Generated original ${style.name} composition (${style.bpm} BPM).`);
  }
  const calibration = Float32Array.from({ length: ANALYSIS_SAMPLE_RATE * 2 }, (_, i) => 0.4 * Math.sin(2 * Math.PI * 440 * i / ANALYSIS_SAMPLE_RATE));
  writeFileSync(join(output, 'calibration-440.wav'), encodeWav(calibration));
}
void main().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
