import { RHYTHM_CONFIG, SAFETY_CONFIG, SHADER_CONFIG, VISUAL_CONFIG } from '../config';
import { oklchToRGB } from '../color/oklch';
import { clamp } from '../shared/math';
import type { MusicEventFrame } from '../music/types';
import type { MusicVisualState } from './types';

/** Musical meaning ends here. The shader receives only visual controls. */
export function interpretMusic(frame: MusicEventFrame): MusicVisualState {
  const energy = clamp(frame.energy);
  const brightness = clamp(frame.brightness);
  const [low, mid, high] = frame.spectralBalance.map((value) => clamp(value));
  const confident = frame.tempo.bpm !== null && frame.tempo.confidence >= RHYTHM_CONFIG.confidenceThreshold;
  const tempoN = confident ? clamp((frame.tempo.bpm! - 60) / 120) : 0.35;
  const baseHue = VISUAL_CONFIG.baseHue + (brightness - 0.5) * VISUAL_CONFIG.brightnessHueContribution + (high! - low!) * VISUAL_CONFIG.spectralHueContribution;
  const l = VISUAL_CONFIG.paletteLightness;
  const c = VISUAL_CONFIG.paletteChroma;
  const paletteOKLCH = VISUAL_CONFIG.hueOffsets.map((offset, i) => ({
    lightness: clamp(l.base + l.brightness * brightness + (i - 1) * l.separation, SAFETY_CONFIG.minLightness, SAFETY_CONFIG.maxLightness),
    chroma: clamp(c.base + c.energy * energy, 0, SAFETY_CONFIG.maxChroma),
    hue: ((baseHue + offset) % 360 + 360) % 360,
  })) as MusicVisualState['paletteOKLCH'];
  return {
    timestamp: frame.timestamp, time: 0, energy, brightness,
    spectralLow: low!, spectralMid: mid!, spectralHigh: high!, onset: clamp(frame.onsetStrength),
    bpm: confident ? frame.tempo.bpm! : 0, tempoConfidence: clamp(frame.tempo.confidence),
    beatPhase: clamp(frame.beat.phase), beatPulse: clamp(frame.beat.pulse), beatConfidence: clamp(frame.beat.confidence),
    flowSpeed: SHADER_CONFIG.baseFlowSpeed + SHADER_CONFIG.tempoFlowContribution * tempoN + SHADER_CONFIG.energyFlowContribution * energy,
    turbulence: SHADER_CONFIG.baseTurbulence + SHADER_CONFIG.midWarpContribution * mid! + SHADER_CONFIG.highTurbulenceContribution * high!,
    macroScale: SHADER_CONFIG.baseMacroScale / (1 + SHADER_CONFIG.lowMacroContribution * low!),
    detailScale: SHADER_CONFIG.baseDetailScale + SHADER_CONFIG.highDetailContribution * high!,
    bloom: clamp(SHADER_CONFIG.bloom.base + SHADER_CONFIG.bloom.brightness * brightness + SHADER_CONFIG.bloom.onset * frame.onsetStrength, 0, SAFETY_CONFIG.maxBloom),
    pigmentIntensity: VISUAL_CONFIG.pigment.base + VISUAL_CONFIG.pigment.energy * energy,
    paletteOKLCH, palette: paletteOKLCH.map(oklchToRGB) as MusicVisualState['palette'],
  };
}

export const INITIAL_MUSIC_VISUAL = interpretMusic({
  timestamp: -1, energy: 0, brightness: 0.3, spectralBalance: [1 / 3, 1 / 3, 1 / 3],
  rawOnset: 0, novelty: 0, onsetStrength: 0,
  tempo: { bpm: null, confidence: 0 }, beat: { phase: 0, pulse: 0, confidence: 0, detected: false },
});
