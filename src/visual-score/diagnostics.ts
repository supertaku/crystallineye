import { COMPOSER_VERSION } from '../analysis/versions';
import type { VisualScore } from './schema';

/** DEV A/B input: one linear timed brush, no analysis, audio or incidental events. */
export function createDiagnosticScore(duration = 30): VisualScore {
  const end = Number.isFinite(duration) ? Math.max(.1, Math.min(360, duration)) : 30;
  return { version: COMPOSER_VERSION, analysisKey: 'diagnostic-simple', trackHash: '0'.repeat(64), duration: end,
    scenes: [{ index: 0, start: 0, end, palette: { ink: '#bf8fce', support: '#bf8fce', wash: '#bf8fce', background: '#14131b' }, brushStyle: 'dry', density: .3, backgroundFlow: 0, seed: 0 }],
    strokes: [{ id: 'diagnostic-brush', sceneIndex: 0, start: 0, end, confidence: 1,
      points: [{ time: 0, x: .15, y: .5, width: .012, opacity: .8, color: '#bf8fce' }, { time: end, x: .85, y: .5, width: .012, opacity: .8, color: '#bf8fce' }] }],
    accents: [], drops: [], washes: [] };
}
