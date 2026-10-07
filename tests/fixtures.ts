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
