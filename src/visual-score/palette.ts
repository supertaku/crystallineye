import { oklchToHex } from '../color/oklch';
import type { ChordEvent } from '../analysis/analysis-schema';
import type { PaletteDefinition } from './schema';

/** Our replaceable artistic convention: neighbors on the circle of fifths share nearby hues. */
export function pitchHue(pitchClass: number): number { return (((pitchClass % 12 + 12) % 12) * 7 % 12) * 30 + 18; }
export function pitchColor(pitchClass: number, lightness = 0.62): string { return oklchToHex({ lightness, chroma: 0.11, hue: pitchHue(pitchClass) % 360 }); }
export function chordPalette(chord?: ChordEvent): PaletteDefinition {
  const root = chord && chord.quality !== 'unknown' ? chord.root : 9;
  const third = chord?.quality === 'minor' ? 3 : 4;
  return { ink: pitchColor(root), support: pitchColor((root + 7) % 12, 0.57), wash: pitchColor((root + third) % 12, 0.45), background: '#14131b' };
}
