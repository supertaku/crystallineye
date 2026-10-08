import { RHYTHM_CONFIG, SAFETY_CONFIG, VISUAL_CONFIG } from '../config';
import { limitValue } from '../color/safety-limiter';
import { oklchToRGB } from '../color/oklch';
import type { MusicVisualState } from './types';

/** Pure UI-thread step, also testable without React Native. Pausing skips this. */
export function advanceVisual(current: MusicVisualState, target: MusicVisualState, seconds: number, targetAge: number, reducedMotion: boolean): MusicVisualState {
  'worklet';
  const dt = Math.max(0, Math.min(0.05, seconds));
  const alpha = 1 - Math.exp(-dt / VISUAL_CONFIG.interpolationSeconds);
  const mix = (a: number, b: number) => a + alpha * (b - a);
  const s = SAFETY_CONFIG;
  const paletteOKLCH = target.paletteOKLCH.map((color, i) => {
    const previous = current.paletteOKLCH[i]!;
    const hueDelta = ((color.hue - previous.hue + 540) % 360) - 180;
    const hueStep = Math.max(-s.hueDegreesPerSecond * dt, Math.min(s.hueDegreesPerSecond * dt, hueDelta));
    return {
      lightness: limitValue(color.lightness, previous.lightness, s.minLightness, s.maxLightness, s.lightnessPerSecond, dt),
      chroma: limitValue(color.chroma, previous.chroma, 0, s.maxChroma, s.chromaPerSecond, dt),
      hue: (previous.hue + hueStep + 360) % 360,
    };
  }) as MusicVisualState['paletteOKLCH'];
  const period = target.bpm > 0 ? 60 / target.bpm : 0;
  const locked = period > 0 && target.beatConfidence >= RHYTHM_CONFIG.confidenceThreshold;
  const phase = locked ? (target.beatPhase + Math.max(0, targetAge) / period) % 1 : 0;
  const pulse = locked
    ? Math.exp(-phase * period / RHYTHM_CONFIG.beatPulseDecaySeconds)
    : target.beatPulse * Math.exp(-Math.max(0, targetAge) / RHYTHM_CONFIG.beatPulseDecaySeconds);
  const flowSpeed = mix(current.flowSpeed, target.flowSpeed);
  return {
    ...target,
    time: current.time + dt * flowSpeed * (reducedMotion ? VISUAL_CONFIG.reducedMotionScale : 1),
    energy: mix(current.energy, target.energy), brightness: mix(current.brightness, target.brightness),
    spectralLow: mix(current.spectralLow, target.spectralLow), spectralMid: mix(current.spectralMid, target.spectralMid), spectralHigh: mix(current.spectralHigh, target.spectralHigh),
    onset: target.onset * Math.exp(-Math.max(0, targetAge) / RHYTHM_CONFIG.onsetDecaySeconds),
    flowSpeed, turbulence: mix(current.turbulence, target.turbulence), macroScale: mix(current.macroScale, target.macroScale),
    detailScale: mix(current.detailScale, target.detailScale), bloom: mix(current.bloom, target.bloom),
    pigmentIntensity: mix(current.pigmentIntensity, target.pigmentIntensity),
    beatPhase: phase, beatPulse: pulse, paletteOKLCH, palette: paletteOKLCH.map(oklchToRGB) as MusicVisualState['palette'],
  };
}
