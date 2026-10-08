import { oklchToHex } from '../color/oklch';
import type { ChordEvent, MusicAnalysis } from '../analysis/analysis-schema';
import type { PaletteDefinition, PaletteKeyframe } from './schema';

/** Our replaceable artistic convention: neighbors on the circle of fifths share nearby hues. */
export function pitchHue(pitchClass: number): number { return (((pitchClass % 12 + 12) % 12) * 7 % 12) * 30 + 18; }
export function pitchColor(pitchClass: number, lightness = 0.62): string { return oklchToHex({ lightness, chroma: 0.11, hue: pitchHue(pitchClass) % 360 }); }
export function chordPalette(chord?: ChordEvent): PaletteDefinition {
  const root = chord && chord.quality !== 'unknown' ? chord.root : 9;
  const third = chord?.quality === 'minor' ? 3 : 4;
  return { ink: pitchColor(root), support: pitchColor((root + 7) % 12, 0.57), wash: pitchColor((root + third) % 12, 0.45), background: '#14131b' };
}

/** Ignore short/uncertain chord estimates instead of turning FFT noise into hue motion. */
export function composePaletteTimeline(analysis: MusicAnalysis): PaletteKeyframe[] {
  const timeline: PaletteKeyframe[] = [{ time: 0, palette: chordPalette(), confidence: 0 }];
  for (const chord of analysis.harmony.chords) {
    if (chord.quality === 'unknown' || chord.confidence < .35 || chord.end - chord.start < .3) continue;
    const palette = chordPalette(chord), last = timeline[timeline.length - 1]!;
    if (palette.ink === last.palette.ink && palette.wash === last.palette.wash) continue;
    const keyframe = { time: chord.start, palette, confidence: chord.confidence };
    if (chord.start === last.time) timeline[timeline.length - 1] = keyframe;
    else timeline.push(keyframe);
  }
  return timeline;
}

export function blendPigment(from: string, to: string, progress: number): string {
  const amount = Math.max(0, Math.min(1, progress));
  const channel = (offset: number) => Math.round(parseInt(from.slice(offset, offset + 2), 16) * (1 - amount) + parseInt(to.slice(offset, offset + 2), 16) * amount).toString(16).padStart(2, '0');
  return `#${channel(1)}${channel(3)}${channel(5)}`;
}

/** Colors belong to new deposition at this time; completed marks retain their stored color. */
export function paletteAt(timeline: PaletteKeyframe[], time: number): PaletteDefinition {
  let index = 0;
  while (index + 1 < timeline.length && timeline[index + 1]!.time <= time) index++;
  const current = timeline[index]!, previous = timeline[Math.max(0, index - 1)]!;
  const amount = index === 0 ? 1 : Math.max(0, Math.min(1, (time - current.time) / .6));
  return { ink: blendPigment(previous.palette.ink, current.palette.ink, amount), support: blendPigment(previous.palette.support, current.palette.support, amount),
    wash: blendPigment(previous.palette.wash, current.palette.wash, amount), background: current.palette.background };
}
