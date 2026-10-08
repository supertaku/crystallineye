import type { AnalysisProgress, MusicAnalysis } from './analysis-schema';
import { ANALYSIS_SAMPLE_RATE, ANALYSIS_VERSION, DSP_VERSION } from './versions';
import { extractFeatures, checkCancelled } from './feature-extractor';
import { trackBeats } from './beat-tracker';
import { estimateChords } from './chord-estimator';
import { segmentSections } from './section-segmenter';
import type { DecodedTrack } from '../audio-v3/types';

export const FALLBACK_VERSIONS = { features: DSP_VERSION, beatTracking: 'dsp-alignment-1', harmony: 'chroma-templates-1', structure: 'novelty-1' };

/** Offline measured fallback. Reference ML notes are supplied through the same schema. */
export async function analyzeTrack(track: DecodedTrack, hash: string, report: (progress: AnalysisProgress) => void, signal?: AbortSignal): Promise<MusicAnalysis> {
  if (track.sampleRate !== ANALYSIS_SAMPLE_RATE || track.numberOfChannels !== 1 || !track.pcm.length) throw new Error('Analysis needs 22,050 Hz mono audio.');
  report({ stage: 'transcription', stageProgress: 0, overallProgress: 0.2 });
  const { dynamics, chromaFrames } = await extractFeatures(track.pcm, (progress) => report({ stage: 'transcription', stageProgress: progress, overallProgress: 0.2 + progress * 0.45 }), signal);
  checkCancelled(signal);
  report({ stage: 'rhythm', stageProgress: 0, overallProgress: 0.65 });
  const rhythm = trackBeats(dynamics);
  report({ stage: 'rhythm', stageProgress: 1, overallProgress: 0.77 });
  checkCancelled(signal);
  report({ stage: 'harmony', stageProgress: 0, overallProgress: 0.77 });
  const chords = estimateChords(chromaFrames, track.duration);
  report({ stage: 'harmony', stageProgress: 1, overallProgress: 0.84 });
  checkCancelled(signal);
  report({ stage: 'structure', stageProgress: 0, overallProgress: 0.84 });
  const segments = segmentSections(chromaFrames, dynamics, [], track.duration);
  report({ stage: 'structure', stageProgress: 1, overallProgress: 0.92 });
  return { version: ANALYSIS_VERSION, track: { hash, duration: track.duration, analysisSampleRate: ANALYSIS_SAMPLE_RATE },
    rhythm, notes: [], harmony: { chromaFrames, chords }, dynamics, structure: { segments }, modelVersions: FALLBACK_VERSIONS,
    quality: rhythm.beats.length && chords.some((chord) => chord.quality !== 'unknown') ? 'PARTIAL' : 'BASIC',
    warnings: ['Note transcription is not installed; brush contours use measured dynamics and spectrum.', 'Downbeat anchors are inferred four-beat groups; time signature is unknown.'] };
}
