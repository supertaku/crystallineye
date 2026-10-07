export const DSP_CONFIG = {
  version: 'dsp-v1',
  fftSize: 2048,
  hopSize: 512,
  updatesPerSecond: 30,
  bands: [20, 250, 2000, 8000] as const,
};

// Reduced visual intensity is always on for this research MVP.
export const COLOR_CONFIG = {
  mappingId: 'perceptual-v1',
  lightness: { base: 0.3, brightness: 0.28, energy: 0.08, onset: 0.025 },
  chroma: { base: 0.025, energy: 0.085, onset: 0.015 },
  hues: [275, 320, 75] as const,
  safety: { minLightness: 0.28, maxLightness: 0.68, maxChroma: 0.12, lightnessPerSecond: 0.18, chromaPerSecond: 0.1, weightPerSecond: 0.5 },
  smoothing: {
    energy: { attack: 0.18, release: 0.65 },
    brightness: { attack: 0.3, release: 0.75 },
    balance: { attack: 0.7, release: 1.1 },
    onset: { attack: 0.1, release: 0.4 },
  },
};
