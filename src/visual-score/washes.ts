import type { MusicAnalysis } from '../analysis/analysis-schema';
import type { SceneEvent, WashEvent } from './schema';
import { chordPalette } from './palette';
import { seededRandom, seedFrom } from './seed';

export function composeWashes(analysis: MusicAnalysis, scene: SceneEvent): WashEvent[] {
  const washes: WashEvent[] = [];
  for (let start = scene.start, index = 0; start < scene.end; start += 4, index++) {
    const end = Math.min(scene.end, start + 4);
    const frames = analysis.dynamics.filter((frame) => frame.time >= start && frame.time < end);
    const strength = frames.reduce((sum, frame) => sum + frame.bass * frame.energy, 0) / Math.max(1, frames.length);
    if (strength < 0.005) continue;
    const chord = analysis.harmony.chords.find((event) => event.start <= start && event.end > start);
    const random = seededRandom(seedFrom(`${analysis.track.hash}:${scene.index}:wash:${index}`));
    washes.push({ id: `w-${scene.index}-${index}`, sceneIndex: scene.index, start, end,
      position: { x: 0.2 + random() * 0.6, y: 0.25 + random() * 0.5 }, radius: 0.25 + strength * 0.35,
      color: chordPalette(chord).wash, opacity: strength * 0.18, flow: strength * 0.018 });
  }
  return washes;
}
