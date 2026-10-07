export type PCMChunk = {
  channels: { frames: ArrayLike<number> }[];
  timestamp: number;
};

export type SamplingMode = 'snapshot' | 'continuous';
export type RateEstimate = { hz: number | null; confidence: number };

export type AudioFeatureFrame = {
  timestamp: number;
  rms: number;
  rmsNormalized: number;
  spectralCentroidHz: number | null;
  spectralCentroidNormalized: number;
  spectralBrightnessNormalized: number;
  bandRatios: [number, number, number] | null;
  // Dimensionless thirds of the observed spectrum, never labelled Hz bands.
  spectrumRatios: [number, number, number];
  spectralFlux: number;
  onsetStrength: number;
  confidence: { sampleRate: number; spectrum: number };
};

export type SamplerDiagnostics = {
  callbacks: number;
  frames: number;
  lastFrameCount: number;
  timestamp: number | null;
  rawTimestamp: number | null;
  estimatedSampleRate: number | null;
  sampleRateConfidence: number;
  mode: SamplingMode;
  dspMs: number;
  updates: number;
  feature: AudioFeatureFrame | null;
};
