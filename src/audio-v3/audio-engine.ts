import { File } from 'expo-file-system';
import type { AnalysisProgress } from '../analysis/analysis-schema';
import { parseMusicAnalysis } from '../analysis/analysis-schema';
import { AnalysisCache, type PreparedScore } from '../analysis/analysis-cache';
import { FileJSONStore } from '../analysis/file-cache';
import { analyzeTrack, FALLBACK_VERSIONS } from '../analysis/analysis-engine';
import { checkCancelled, yieldAnalysis } from '../analysis/feature-extractor';
import { composeVisualScore } from '../visual-score/composer';
import { decodeTrack, hashTrack, inspectTrack } from './audio-decoder';
import type { AudioMetadata } from './types';
import { createPaintingComparisons, NATIVE_COMPARISON_DURATION_TOLERANCE, type PaintingComparison } from '../visual-score/comparison-modes';

export type PreparedTrack = PreparedScore & { uri: string; name: string; metadata: AudioMetadata };

export class AudioEngine {
  private readonly cache = new AnalysisCache(new FileJSONStore());
  async prepare(uri: string, name: string, report: (progress: AnalysisProgress) => void, signal?: AbortSignal): Promise<PreparedTrack> {
    report({ stage: 'decode', stageProgress: 0, overallProgress: 0 });
    const metadata = await inspectTrack(uri);
    const hash = await hashTrack(uri, signal);
    checkCancelled(signal);
    // Cache failure affects reuse, never the ability to play a valid local song.
    let cached: PreparedScore | null = null;
    try { cached = await this.cache.getReference(hash) ?? await this.cache.get(hash, FALLBACK_VERSIONS); } catch { /* Continue with measured analysis. */ }
    if (cached && Math.abs(cached.analysis.track.duration - metadata.duration) <= 0.1) {
      report({ stage: 'visual-score', stageProgress: 1, overallProgress: 1 });
      return { ...cached, uri, name, metadata };
    }
    const decoded = await decodeTrack(uri, metadata, signal);
    report({ stage: 'decode', stageProgress: 1, overallProgress: 0.2 });
    const analysis = await analyzeTrack(decoded, hash, report, signal);
    checkCancelled(signal);
    report({ stage: 'visual-score', stageProgress: 0, overallProgress: 0.92 });
    await yieldAnalysis();
    checkCancelled(signal);
    const score = composeVisualScore(analysis);
    try { await this.cache.put(analysis, score); } catch { analysis.warnings.push('The analysis could not be saved. It will run again next time.'); }
    report({ stage: 'visual-score', stageProgress: 1, overallProgress: 1 });
    return { uri, name, metadata, analysis, score, cacheHit: false };
  }
  async loadReference(uri: string, track: PreparedTrack): Promise<PreparedTrack> {
    const file = new File(uri);
    if (file.size > 16 * 1024 * 1024) throw new Error('This music-analysis file is too large.');
    const analysis = parseMusicAnalysis(JSON.parse(await file.text()));
    if (analysis.track.hash !== track.analysis.track.hash || Math.abs(analysis.track.duration - track.metadata.duration) > 0.1) throw new Error('This analysis belongs to another audio file. Import the exact audio used by the research tool.');
    const score = composeVisualScore(analysis);
    await this.cache.put(analysis, score);
    await this.cache.rememberReference(analysis);
    return { ...track, analysis, score, cacheHit: false };
  }
  /** DEV callers prepare genuine DSP alongside an explicitly loaded note reference. */
  async comparePaintings(track: PreparedTrack, report: (progress: AnalysisProgress) => void, signal?: AbortSignal): Promise<PaintingComparison[]> {
    if (!track.analysis.notes.length) throw new Error('Load a matching note-bearing research analysis before preparing A–D.');
    checkCancelled(signal);
    let fallback: PreparedScore | null = null;
    try { fallback = await this.cache.get(track.analysis.track.hash, FALLBACK_VERSIONS); } catch { /* Measure again when reuse fails. */ }
    if (!fallback || Math.abs(fallback.analysis.track.duration - track.analysis.track.duration) > NATIVE_COMPARISON_DURATION_TOLERANCE) {
      report({ stage: 'decode', stageProgress: 0, overallProgress: 0 });
      const currentHash = await hashTrack(track.uri, signal);
      if (currentHash !== track.analysis.track.hash) throw new Error('The source file changed. Import the original audio again.');
      const decoded = await decodeTrack(track.uri, track.metadata, signal);
      report({ stage: 'decode', stageProgress: 1, overallProgress: .2 });
      const analysis = await analyzeTrack(decoded, currentHash, report, signal);
      checkCancelled(signal);
      const score = composeVisualScore(analysis);
      try { await this.cache.put(analysis, score); } catch { /* Comparisons can still run without persistent cache. */ }
      fallback = { analysis, score, cacheHit: false };
    }
    checkCancelled(signal);
    const comparisons = createPaintingComparisons(fallback.analysis, track.analysis, { allowNativeDurationDifference: true });
    report({ stage: 'visual-score', stageProgress: 1, overallProgress: 1 });
    return comparisons;
  }
}
