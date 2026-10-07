import { COLOR_CONFIG } from '../config';
import { clamp } from '../shared/math';
import type { MappingFeatures, VisualState } from './types';

export function perceptualV1(features: MappingFeatures): VisualState {
  const { lightness: l, chroma: c } = COLOR_CONFIG;
  const lightness = l.base + l.brightness * features.brightness + l.energy * features.energy + l.onset * features.onset;
  const chroma = c.base + c.energy * features.energy + c.onset * features.onset;
  const weights = features.balance.map((value) => 0.08 + 0.76 * clamp(value)) as [number, number, number];
  const total = weights.reduce((sum, value) => sum + value, 0);
  return {
    colors: COLOR_CONFIG.hues.map((hue, index) => ({
      lightness: clamp(lightness + (index - 1) * 0.025, COLOR_CONFIG.safety.minLightness, COLOR_CONFIG.safety.maxLightness),
      chroma: clamp(chroma, 0, COLOR_CONFIG.safety.maxChroma),
      hue,
    })) as VisualState['colors'],
    weights: weights.map((weight) => weight / total) as VisualState['weights'],
  };
}

export const INITIAL_VISUAL: VisualState = perceptualV1({ energy: 0, brightness: 0, balance: [1 / 3, 1 / 3, 1 / 3], onset: 0 });
