import type { AudioFeatureFrame } from '../src/types/audio';

export function sine(frequency: number, sampleRate = 48000, size = 2048, amplitude = 0.5, offset = 0): Float32Array {
  return Float32Array.from({ length: size }, (_, i) => amplitude * Math.sin(2 * Math.PI * frequency * (i + offset) / sampleRate));
}

export function silence(size = 2048): Float32Array { return new Float32Array(size); }
export function amplitudeRamp(size = 48000): Float32Array {
  return Float32Array.from({ length: size }, (_, i) => i / Math.max(1, size - 1) * Math.sin(2 * Math.PI * 440 * i / 48000));
}
export function impulse(size = 2048): Float32Array {
  const samples = silence(size);
  samples[Math.floor(size / 2)] = 1;
  return samples;
}
export function feature(timestamp: number, overrides: Partial<AudioFeatureFrame> = {}): AudioFeatureFrame {
  return { timestamp, rms: 0.2, rmsNormalized: 0.5, spectralCentroidHz: null,
    spectralCentroidNormalized: 0.2, spectralBrightnessNormalized: 0.4,
    spectrumRatios: [0.6, 0.3, 0.1], bandRatios: null, spectralFlux: 0, onsetStrength: 0,
    confidence: { sampleRate: 0, spectrum: 0.5 }, ...overrides };
}
