import type { MusicAnalysis } from '../analysis/analysis-schema';
import type { PaletteKeyframe, SceneEvent, WashEvent } from './schema';
import { composePaletteTimeline, paletteAt } from './palette';
import { seededRandom, seedFrom } from './seed';

export function composeWashes(analysis: MusicAnalysis, scene: SceneEvent, timeline: PaletteKeyframe[] = composePaletteTimeline(analysis)): WashEvent[] {
  const washes: WashEvent[] = [];
  const starts = [scene.start, ...timeline.map(key => key.time).filter(time => time > scene.start && time < scene.end), scene.end];
  for (let time = scene.start + 4; time < scene.end; time += 4) starts.push(time);
  const ordered = [...new Set(starts)].sort((a, b) => a - b);
  for (let index = 0; index < ordered.length - 1; index++) {
    const start = ordered[index]!, end = ordered[index + 1]!;
    if (end - start < .3) continue;
    const frames = analysis.dynamics.filter((frame) => frame.time >= start && frame.time < end);
    const strength = frames.reduce((sum, frame) => sum + frame.bass * frame.energy, 0) / Math.max(1, frames.length);
    if (strength < 0.005) continue;
    const random = seededRandom(seedFrom(`${analysis.track.hash}:${scene.index}:wash:${index}`));
    washes.push({ id: `w-${scene.index}-${index}`, sceneIndex: scene.index, start, end,
      position: { x: 0.2 + random() * 0.6, y: 0.25 + random() * 0.5 }, radius: 0.25 + strength * 0.35,
      color: paletteAt(timeline, Math.min(end, start + .6)).wash, opacity: strength * 0.18, flow: strength * 0.018 });
  }
  return washes;
}
