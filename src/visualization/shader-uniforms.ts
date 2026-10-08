import { SAFETY_CONFIG, SHADER_CONFIG, VISUAL_CONFIG } from '../config';
import type { MusicVisualState, VisualDebugMode } from './types';

export function shaderUniforms(state: MusicVisualState, width: number, height: number, reducedMotion: boolean, mode: VisualDebugMode = 'fluid') {
  'worklet';
  const debugGain = mode === 'motion' ? VISUAL_CONFIG.debug.beatGain : 1;
  return {
    uResolution: [Math.max(1, width), Math.max(1, height)], uTime: state.time,
    uEnergy: state.energy, uBrightness: state.brightness,
    uSpectralLow: state.spectralLow, uSpectralMid: state.spectralMid, uSpectralHigh: state.spectralHigh,
    uOnset: Math.min(1, state.onset * (mode === 'motion' ? VISUAL_CONFIG.debug.onsetGain : 1)),
    uTempoNormalized: state.bpm > 0 ? Math.max(0, Math.min(1, (state.bpm - 60) / 120)) : 0.35,
    uTempoConfidence: state.tempoConfidence, uBeatPhase: state.beatPhase,
    uBeatPulse: Math.min(1, state.beatPulse * debugGain),
    uColorA: state.palette[0], uColorB: state.palette[1], uColorC: state.palette[2],
    uReducedMotion: reducedMotion ? 1 : 0,
    uTurbulence: state.turbulence, uMacroScale: state.macroScale, uDetailScale: state.detailScale,
    uBloom: Math.min(SAFETY_CONFIG.maxBloom, state.bloom), uPigment: state.pigmentIntensity,
    uBeatExpansion: SHADER_CONFIG.beatExpansionContribution,
    uOnsetWarp: SHADER_CONFIG.onsetWarpContribution,
  };
}
