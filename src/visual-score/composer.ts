import type { MusicAnalysis } from '../analysis/analysis-schema';
import { parseMusicAnalysis } from '../analysis/analysis-schema';
import { extractMelody } from '../analysis/melody-extractor';
import { analysisKey, COMPOSER_VERSION } from '../analysis/versions';
import type { VisualScore } from './schema';
import { composeScenes } from './scenes';
import { generateStrokes, type BrushCursor } from './stroke-generator';
import { composeDrops } from './drops';
import { composeWashes } from './washes';
import { composePaletteTimeline } from './palette';

export function composeVisualScore(input: MusicAnalysis): VisualScore {
  const analysis = parseMusicAnalysis(input);
  const scenes = composeScenes(analysis), melody = extractMelody(analysis.notes);
  const paletteTimeline = composePaletteTimeline(analysis), cursor: BrushCursor = { contactSeconds: 0 };
  const strokes = scenes.flatMap((scene) => generateStrokes(analysis, scene, melody, cursor, paletteTimeline));
  return { version: COMPOSER_VERSION, analysisKey: analysisKey(analysis.track.hash, analysis.modelVersions), trackHash: analysis.track.hash, duration: analysis.track.duration,
    scenes, strokes, paletteTimeline, drops: scenes.flatMap((scene) => composeDrops(analysis, scene, strokes, paletteTimeline)), washes: scenes.flatMap((scene) => composeWashes(analysis, scene, paletteTimeline)),
    accents: strokes.flatMap((stroke) => analysis.rhythm.beats.filter((beat) => beat.time >= stroke.start && beat.time < stroke.end && beat.confidence >= .15)
      .map((beat) => ({ time: beat.time, duration: .22, strokeId: stroke.id, pressure: beat.confidence }))) };
}
