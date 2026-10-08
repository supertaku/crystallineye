import type { MusicAnalysis } from '../analysis/analysis-schema';
import { parseMusicAnalysis } from '../analysis/analysis-schema';
import { extractMelody } from '../analysis/melody-extractor';
import { analysisKey, COMPOSER_VERSION } from '../analysis/versions';
import type { VisualScore } from './schema';
import { composeScenes } from './scenes';
import { generateStrokes } from './stroke-generator';
import { composeDrops } from './drops';
import { composeWashes } from './washes';

export function composeVisualScore(input: MusicAnalysis): VisualScore {
  const analysis = parseMusicAnalysis(input);
  const scenes = composeScenes(analysis), melody = extractMelody(analysis.notes);
  const strokes = scenes.flatMap((scene) => generateStrokes(analysis, scene, melody));
  return { version: COMPOSER_VERSION, analysisKey: analysisKey(analysis.track.hash, analysis.modelVersions), trackHash: analysis.track.hash, duration: analysis.track.duration,
    scenes, strokes, drops: scenes.flatMap((scene) => composeDrops(analysis, scene)), washes: scenes.flatMap((scene) => composeWashes(analysis, scene)),
    accents: strokes.flatMap((stroke) => analysis.rhythm.beats.filter((beat) => beat.time >= stroke.start && beat.time < stroke.end).map((beat) => ({ time: beat.time, strokeId: stroke.id, pressure: beat.confidence }))) };
}
