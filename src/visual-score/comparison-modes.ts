import { parseMusicAnalysis, type MusicAnalysis } from '../analysis/analysis-schema';
import { composeVisualScore } from './composer';
import type { VisualScore } from './schema';

export type PaintingComparisonMode = 'A' | 'B' | 'C' | 'D';
export type PaintingComparison = { mode: PaintingComparisonMode; label: string; analysis: MusicAnalysis; score: VisualScore };
// Match the existing exact-source native reference-loader allowance. This is
// decoder duration tolerance, never a timestamp correction or PCM parity claim.
export const NATIVE_COMPARISON_DURATION_TOLERANCE = .1;

/** Remove only note evidence; measured rhythm, harmony, dynamics and sections stay fixed. */
export function withoutNoteEvidence(input: MusicAnalysis): MusicAnalysis {
  const analysis = parseMusicAnalysis(input);
  const modelVersions = { ...analysis.modelVersions };
  delete modelVersions.transcription;
  return { ...analysis, notes: [], modelVersions, quality: analysis.quality === 'FULL' ? 'PARTIAL' : analysis.quality,
    warnings: [...analysis.warnings.slice(0, 49), 'Research ablation: note evidence removed; other musical inputs held fixed.'] };
}

export function createPaintingComparisons(dspInput: MusicAnalysis, referenceInput: MusicAnalysis,
  options: { allowNativeDurationDifference?: boolean } = {}): PaintingComparison[] {
  let dsp = parseMusicAnalysis(dspInput);
  const reference = parseMusicAnalysis(referenceInput), durationDifference = dsp.track.duration - reference.track.duration;
  const tolerance = options.allowNativeDurationDifference ? NATIVE_COMPARISON_DURATION_TOLERANCE : .001;
  if (dsp.track.hash !== reference.track.hash || Math.abs(durationDifference) > tolerance) {
    throw new Error('Painting comparisons need the same exact source recording and duration.');
  }
  if (dsp.notes.length || dsp.modelVersions.transcription) throw new Error('Mode A needs measured DSP analysis without transcription.');
  if (!reference.notes.length) throw new Error('Modes B and C need timestamped note evidence.');
  if (options.allowNativeDurationDifference && Math.abs(durationDifference) > .001) {
    dsp = { ...dsp, warnings: [...dsp.warnings.slice(0, 49),
      `Native decoder comparison: measured DSP is ${(Math.abs(durationDifference) * 1000).toFixed(2)} ms ${durationDifference > 0 ? 'longer' : 'shorter'} than the desktop reference; timestamps are unchanged and alignment is unverified.`] };
  }
  const reduced = withoutNoteEvidence(reference);
  return [
    { mode: 'A', label: 'A · V3.1 + DSP', analysis: dsp, score: composeVisualScore(dsp, { trajectory: 'legacy' }) },
    { mode: 'B', label: 'B · V3.1 + reference', analysis: reference, score: composeVisualScore(reference, { trajectory: 'legacy' }) },
    { mode: 'C', label: 'C · Phrase painting + reference', analysis: reference, score: composeVisualScore(reference) },
    { mode: 'D', label: 'D · Phrase painting · notes removed', analysis: reduced, score: composeVisualScore(reduced) },
  ];
}
