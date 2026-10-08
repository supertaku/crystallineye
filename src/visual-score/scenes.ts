import type { MusicAnalysis } from '../analysis/analysis-schema';
import { chordPalette } from './palette';
import { seedFrom } from './seed';
import type { SceneEvent } from './schema';

export function composeScenes(analysis: MusicAnalysis): SceneEvent[] {
  return analysis.structure.segments.map((section, index) => {
    const features = analysis.dynamics.filter((frame) => frame.time >= section.start && frame.time < section.end);
    const density = features.reduce((sum, frame) => sum + frame.energy, 0) / Math.max(1, features.length);
    const bass = features.reduce((sum, frame) => sum + frame.bass * frame.energy, 0) / Math.max(1, features.length);
    const chord = analysis.harmony.chords.find((event) => event.end > section.start && event.confidence > 0.15);
    return { index, start: section.start, end: section.end, palette: chordPalette(chord), brushStyle: density > 0.45 ? 'wet' : 'dry',
      density, backgroundFlow: bass, seed: seedFrom(`${analysis.track.hash}:section:${index}`) };
  });
}
