export type OnsetPoint = { timestamp: number; onsetStrength: number };
export type TempoEstimate = { bpm: number | null; confidence: number };
export type BeatState = { phase: number; pulse: number; confidence: number; detected: boolean };

export type MusicEventFrame = {
  timestamp: number;
  energy: number;
  brightness: number;
  // Relative spectral regions; Hz bands only when the audio feature supplies them.
  spectralBalance: [number, number, number];
  rawOnset: number;
  novelty: number;
  onsetStrength: number;
  tempo: TempoEstimate;
  beat: BeatState;
};
