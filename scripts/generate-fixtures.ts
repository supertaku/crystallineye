import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { rhythmicFixture } from './rhythmic-fixture';

function wav(samples: Float32Array, sampleRate: number): Buffer {
  const bytes = Buffer.alloc(44 + samples.length * 2);
  bytes.write('RIFF', 0); bytes.writeUInt32LE(bytes.length - 8, 4); bytes.write('WAVEfmt ', 8);
  bytes.writeUInt32LE(16, 16); bytes.writeUInt16LE(1, 20); bytes.writeUInt16LE(1, 22);
  bytes.writeUInt32LE(sampleRate, 24); bytes.writeUInt32LE(sampleRate * 2, 28);
  bytes.writeUInt16LE(2, 32); bytes.writeUInt16LE(16, 34); bytes.write('data', 36);
  bytes.writeUInt32LE(samples.length * 2, 40);
  samples.forEach((sample, i) => bytes.writeInt16LE(Math.round(Math.max(-1, Math.min(1, sample)) * 32767), 44 + 2 * i));
  return bytes;
}

const output = resolve('fixtures/generated');
mkdirSync(output, { recursive: true });
for (const sampleRate of [44100, 48000]) {
  const names = ['silence', '100-hz', '440-hz', '1000-hz', '4000-hz', 'amplitude-ramp', 'impulse', 'validation-sequence'];
  for (const name of names) {
    const seconds = name === 'validation-sequence' ? 20 : 3;
    const samples = Float32Array.from({ length: sampleRate * seconds }, (_, i) => {
      const t = i / sampleRate;
      if (name === 'silence') return 0;
      if (name === 'impulse') return i === sampleRate ? 0.8 : 0;
      if (name === 'amplitude-ramp') return 0.8 * t / seconds * Math.sin(2 * Math.PI * 440 * t);
      if (name === 'validation-sequence') {
        // 0–4 silence; 4–8 bass; 8–12 mid; 12–16 high; 16–20 rising amplitude.
        const section = Math.floor(t / 4);
        if (section === 0) return 0;
        const frequency = [0, 100, 1000, 4000, 440][section]!;
        const amplitude = section === 4 ? 0.8 * (t - 16) / 4 : 0.35;
        return amplitude * Math.sin(2 * Math.PI * frequency * t);
      }
      return 0.5 * Math.sin(2 * Math.PI * Number.parseInt(name) * t);
    });
    writeFileSync(join(output, `${name}-${sampleRate}.wav`), wav(samples, sampleRate));
  }
}
for (const sampleRate of [44100, 48000]) {
  for (const bpm of [60, 90, 120, 150]) {
    writeFileSync(join(output, `beat-${bpm}bpm-${sampleRate}.wav`), wav(rhythmicFixture(sampleRate, 24, bpm), sampleRate));
  }
  for (const [name, missing, extra] of [['missing-beats', true, false], ['extra-onsets', false, true]] as const) {
    writeFileSync(join(output, `beat-120bpm-${name}-${sampleRate}.wav`), wav(rhythmicFixture(sampleRate, 24, 120, missing, extra), sampleRate));
  }
}
console.log(`Generated 28 original mono PCM16 WAV fixtures (16 existing + 12 rhythmic) in ${output}`);
