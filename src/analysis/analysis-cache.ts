import { parseMusicAnalysis, type MusicAnalysis } from './analysis-schema';
import { analysisKey, COMPOSER_VERSION } from './versions';
import { composeVisualScore } from '../visual-score/composer';
import type { VisualScore } from '../visual-score/schema';

export type JSONStore = { read: (key: string) => Promise<string | null>; write: (key: string, value: string) => Promise<void> };
export type PreparedScore = { analysis: MusicAnalysis; score: VisualScore; cacheHit: boolean };

export class AnalysisCache {
  constructor(private readonly store: JSONStore) {}
  async get(hash: string, versions: MusicAnalysis['modelVersions']): Promise<PreparedScore | null> {
    const key = analysisKey(hash, versions);
    const raw = await this.store.read(key);
    if (!raw) return null;
    try {
      const record: unknown = JSON.parse(raw);
      if (!record || typeof record !== 'object' || !('analysis' in record)) return null;
      const analysis = parseMusicAnalysis(record.analysis);
      if (analysisKey(analysis.track.hash, analysis.modelVersions) !== key) return null;
      // Recomposition is cheap and validates the cached painting against its music.
      // Changed composer versions reuse musical understanding without decoding or ML.
      const expected = composeVisualScore(analysis);
      const cached = 'score' in record ? record.score : null;
      const score = cached && typeof cached === 'object' && 'version' in cached && cached.version === COMPOSER_VERSION
        && JSON.stringify(cached) === JSON.stringify(expected) ? cached as VisualScore : expected;
      return { analysis, score, cacheHit: true };
    } catch { return null; }
  }
  async put(analysis: MusicAnalysis, score: VisualScore): Promise<void> {
    const valid = parseMusicAnalysis(analysis);
    if (score.analysisKey !== analysisKey(valid.track.hash, valid.modelVersions) || score.version !== COMPOSER_VERSION) throw new Error('The visual score does not match its music analysis.');
    await this.store.write(score.analysisKey, JSON.stringify({ analysis: valid, score }));
  }
  async rememberReference(analysis: MusicAnalysis): Promise<void> {
    await this.store.write(`reference:${analysis.track.hash}`, JSON.stringify(analysis.modelVersions));
  }
  async getReference(hash: string): Promise<PreparedScore | null> {
    try {
      const raw = await this.store.read(`reference:${hash}`);
      if (!raw) return null;
      const versions: unknown = JSON.parse(raw);
      if (!versions || typeof versions !== 'object' || Array.isArray(versions)) return null;
      return await this.get(hash, versions as MusicAnalysis['modelVersions']);
    } catch { return null; }
  }
}
