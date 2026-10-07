export function spectralCentroid(spectrum: Float32Array, sampleRate: number, fftSize: number): number {
  let weight = 0;
  let total = 0;
  for (let k = 0; k < spectrum.length; k++) {
    weight += k * sampleRate / fftSize * spectrum[k]!;
    total += spectrum[k]!;
  }
  return total > 1e-12 ? weight / total : 0;
}

export function normalizedCentroid(spectrum: Float32Array): number {
  return spectralCentroid(spectrum, 2, (spectrum.length - 1) * 2);
}
