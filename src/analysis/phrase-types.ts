import type { NoteEvent } from './analysis-schema';

export type MelodicDirection = 'ascending' | 'descending' | 'stable' | 'mixed';
export type MelodicContour = {
  direction: MelodicDirection;
  intervalChanges: number[];
  register: number;
  netInterval: number;
};

/** Interpretation of a selected mixed-recording contour, never an identified singer. */
export type MusicalPhrase = {
  id: string;
  start: number;
  end: number;
  notes: NoteEvent[];
  pitchMin: number;
  pitchMax: number;
  averageEnergy: number;
  contour: MelodicContour;
  confidence: number;
  restThreshold: number;
  boundaryReason: 'track-start' | 'phrase-rest' | 'section-rest' | 'interval-rest' | 'cadence-rest' | 'contour-rest' | 'sustained-rest';
  sectionIndices: number[];
};

export type PhraseSegmentationOptions = {
  minRestSeconds?: number;
  maxRestSeconds?: number;
  /** Overrides the adaptive threshold for a controlled experiment. */
  restSeconds?: number;
  minimumConfidence?: number;
};
