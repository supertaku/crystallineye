import { DSP_CONFIG } from '../config';

export function bandEnergy(spectrum: Float32Array, sampleRate: number, fftSize: number, bands: readonly number[] = DSP_CONFIG.bands): [number, number, number] {
  const energy: [number, number, number] = [0, 0, 0];
  for (let k = 1; k < spectrum.length; k++) {
    const frequency = k * sampleRate / fftSize;
    for (let band = 0; band < 3; band++) {
      if (frequency >= bands[band]! && frequency < bands[band + 1]!) energy[band]! += spectrum[k]! ** 2;
    }
  }
  const total = energy[0] + energy[1] + energy[2];
  return total > 1e-12 ? energy.map((value) => value / total) as [number, number, number] : [0, 0, 0];
}

export function spectrumThirds(spectrum: Float32Array): [number, number, number] {
  // Dimensionless bin ranges. These are NOT the 20–8000 Hz music bands.
  return bandEnergy(spectrum, 2, (spectrum.length - 1) * 2, [0, 1 / 3, 2 / 3, 1.00001]);
}
