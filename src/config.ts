export const DSP_CONFIG = {
  version: 'dsp-v1',
  fftSize: 2048,
  hopSize: 512,
  updatesPerSecond: 30,
  bands: [20, 250, 2000, 8000] as const,
};

// Historical gradient parameters retained for the original regression tests.
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

// Artistic/heuristic starting values, not universal descriptions of music.
export const RHYTHM_CONFIG = {
  historySeconds: 12,
  historyCapacity: 360,
  envelopeRate: 30,
  bpmMin: 60,
  bpmMax: 180,
  minimumTempoHistorySeconds: 8,
  preferredTempoHistorySeconds: 10,
  estimateIntervalSeconds: 0.5,
  confidenceThreshold: 0.45,
  candidateVotes: 5,
  acquisitionVotes: 3,
  candidateToleranceBpm: 4,
  ambiguityScoreMargin: 0.08,
  tempoSmoothingSeconds: 2,
  bpmSlewPerSecond: 2,
  beatPulseDecaySeconds: 0.24,
  onsetDecaySeconds: 0.2,
  onsetThreshold: 0.16,
  peakRefractorySeconds: 0.22,
  phaseCorrectionWindow: 0.22,
  phaseCorrectionGain: 0.35,
  continuityGapSeconds: 0.5,
  transientWarmupSeconds: 0.25,
  novelty: { onset: 0.55, energyDelta: 0.25, balanceDelta: 0.2 },
  energyDeltaGain: 3,
  balanceDeltaGain: 1.5,
};

export const VISUAL_CONFIG = {
  energy: { attack: 0.05, release: 0.3 },
  brightness: { attack: 0.16, release: 0.45 },
  balance: { attack: 0.12, release: 0.35 },
  interpolationSeconds: 0.055,
  baseHue: 270,
  brightnessHueContribution: 55,
  spectralHueContribution: 35,
  hueOffsets: [0, 65, 155] as const,
  paletteLightness: { base: 0.36, brightness: 0.15, separation: 0.035 },
  paletteChroma: { base: 0.045, energy: 0.075 },
  pigment: { base: 0.18, energy: 0.72 },
  playerHideMs: 2800,
  playerTransitionMs: 220,
  playerHiddenTranslation: 12,
  reducedMotionScale: 0.18,
  debug: { beatGain: 1.6, onsetGain: 1.6, sweepSeconds: 8 },
};

export const SHADER_CONFIG = {
  baseFlowSpeed: 0.08,
  tempoFlowContribution: 0.3,
  energyFlowContribution: 0.08,
  baseMacroScale: 2,
  lowMacroContribution: 1.2,
  baseTurbulence: 0.45,
  midWarpContribution: 0.8,
  highTurbulenceContribution: 0.35,
  baseDetailScale: 5,
  highDetailContribution: 4,
  onsetWarpContribution: 0.35,
  beatExpansionContribution: 0.25,
  bloom: { base: 0.04, brightness: 0.12, onset: 0.035 },
  fbmOctaves: 4,
  warpStages: 2,
  detailStrength: 0.12,
  warpAmplitude: 3.2,
  filamentFrequency: 19,
  pigmentContrast: 0.7,
};

// Exactly one palette slew layer in the v2 UI frame step. Motion is independent.
export const SAFETY_CONFIG = {
  minLightness: 0.28,
  maxLightness: 0.62,
  maxChroma: 0.12,
  lightnessPerSecond: 0.18,
  chromaPerSecond: 0.1,
  hueDegreesPerSecond: 18,
  maxBloom: 0.22,
};
