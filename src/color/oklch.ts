import type { OKLCH } from './types';

function linearRGB(lightness: number, chroma: number, hue: number): [number, number, number] {
  'worklet';
  const angle = hue * Math.PI / 180;
  const a = chroma * Math.cos(angle);
  const b = chroma * Math.sin(angle);
  const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s];
}

export function oklchToRGB(color: OKLCH): [number, number, number] {
  'worklet';
  let chroma = color.chroma;
  let rgb = linearRGB(color.lightness, chroma, color.hue);
  // Reduce chroma until in gamut instead of independent RGB-channel mapping.
  for (let attempt = 0; attempt < 18 && rgb.some((value) => value < 0 || value > 1); attempt++) {
    chroma *= 0.85;
    rgb = linearRGB(color.lightness, chroma, color.hue);
  }
  return rgb.map((value) => {
    const linear = Math.max(0, Math.min(1, value));
    return linear <= 0.0031308 ? linear * 12.92 : 1.055 * linear ** (1 / 2.4) - 0.055;
  }) as [number, number, number];
}

export function oklchToHex(color: OKLCH): string {
  'worklet';
  const rgb = oklchToRGB(color);
  return '#' + rgb.map((value) => Math.round(value * 255).toString(16).padStart(2, '0')).join('');
}
