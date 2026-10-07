import { COLOR_CONFIG } from '../config';
import type { VisualState } from './types';

export function limitValue(value: number, previous: number, min: number, max: number, perSecond: number, dt: number): number {
  'worklet';
  const bounded = Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : min;
  const start = Math.max(min, Math.min(max, previous));
  const change = perSecond * Math.max(0, Math.min(0.1, dt));
  return Math.max(start - change, Math.min(start + change, bounded));
}

export function limitVisual(target: VisualState, previous: VisualState, dt: number): VisualState {
  'worklet';
  const s = COLOR_CONFIG.safety;
  // Fixed hues; L, C, and spatial blend transitions all have slew limits.
  const colors = target.colors.map((color, i) => ({
    lightness: limitValue(color.lightness, previous.colors[i]!.lightness, s.minLightness, s.maxLightness, s.lightnessPerSecond, dt),
    chroma: limitValue(color.chroma, previous.colors[i]!.chroma, 0, s.maxChroma, s.chromaPerSecond, dt),
    hue: COLOR_CONFIG.hues[i]!,
  })) as VisualState['colors'];
  const weights = target.weights.map((weight, i) => limitValue(weight, previous.weights[i]!, 0.08, 0.84, s.weightPerSecond, dt)) as VisualState['weights'];
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  return { colors, weights: weights.map((weight) => weight / total) as VisualState['weights'] };
}
