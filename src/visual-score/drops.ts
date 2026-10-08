import type { MusicAnalysis } from '../analysis/analysis-schema';
import type { DropEvent, SceneEvent } from './schema';
import { seededRandom, seedFrom } from './seed';

export function composeDrops(analysis: MusicAnalysis, scene: SceneEvent): DropEvent[] {
  const drops: DropEvent[] = [];
  let last = -Infinity;
  for (let index = 0; index < analysis.dynamics.length; index++) {
    const frame = analysis.dynamics[index]!;
    if (frame.time < scene.start || frame.time >= scene.end || frame.energy < 0.08 || frame.onset < 0.55 || frame.time - last < 0.18
      || frame.onset < (analysis.dynamics[index - 1]?.onset ?? 0) || frame.onset < (analysis.dynamics[index + 1]?.onset ?? 0)) continue;
    // Suppress drops at transcribed note onsets to leave room for the melody brush.
    if (analysis.notes.some((note) => note.confidence > 0.5 && Math.abs(note.start - frame.time) < 0.06)) continue;
    const random = seededRandom(seedFrom(`${analysis.track.hash}:${scene.index}:drop:${index}`));
    drops.push({ id: `d-${scene.index}-${index}`, sceneIndex: scene.index, time: frame.time,
      position: { x: 0.1 + random() * 0.8, y: 0.14 + random() * 0.72 }, radius: 0.004 + frame.onset * 0.018,
      color: scene.palette.support, strength: frame.onset * frame.energy });
    last = frame.time;
  }
  return drops;
}
