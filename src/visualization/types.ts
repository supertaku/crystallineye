import type { OKLCH } from '../color/types';

export type RGB = [number, number, number];
export type MusicVisualState = {
  timestamp: number;
  time: number;
  energy: number;
  brightness: number;
  // Relative regions, never inferred Hz bands or notes.
  spectralLow: number;
  spectralMid: number;
  spectralHigh: number;
  onset: number;
  bpm: number;
  tempoConfidence: number;
  beatPhase: number;
  beatPulse: number;
  beatConfidence: number;
  flowSpeed: number;
  turbulence: number;
  macroScale: number;
  detailScale: number;
  bloom: number;
  pigmentIntensity: number;
  palette: [RGB, RGB, RGB];
  paletteOKLCH: [OKLCH, OKLCH, OKLCH];
};

export type VisualDebugMode = 'fluid' | 'legacy' | 'motion';
export type VisualDebugSignal = 'audio' | 'beat' | 'energy' | 'spectrum' | 'tempo';
