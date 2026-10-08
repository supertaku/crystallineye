import type { VisualScore } from '../visual-score/schema';
import { ScorePlayer } from './score-player';

/** Inferred mounted Skia drawables, not a native profiler or presented FPS. */
export function estimateRenderNodes(score: VisualScore, sceneIndex: number) {
  const layers = new ScorePlayer(score).layersAt(sceneIndex);
  let strokes = 0, cubicSegments = 0, pigmentRuns = 0, drops = 0, washes = 0;
  for (const section of layers) {
    drops += section.drops.length; washes += section.washes.length;
    for (const stroke of section.strokes) {
      strokes++; cubicSegments += Math.max(0, stroke.points.length - 1);
      for (let index = 0; index < stroke.points.length - 1; index++) {
        if (index === 0 || stroke.points[index]!.color !== stroke.points[index - 1]!.color) pigmentRuns++;
      }
    }
  }
  const simple = score.analysisKey === 'diagnostic-simple';
  const strokePaths = pigmentRuns + (simple ? 0 : strokes * 2), shaderNodes = simple ? 0 : pigmentRuns, blurNodes = (simple ? 0 : strokes) + drops;
  const dropNodes = drops * 2, washNodes = washes;
  return { scenes: layers.length, strokes, cubicSegments, pigmentRuns, strokePaths, shaderNodes, blurNodes, dropNodes, washNodes,
    drawableNodes: strokePaths + dropNodes + washNodes, legacyDrawableNodesForSameLayers: cubicSegments * 3 + dropNodes + washNodes };
}
