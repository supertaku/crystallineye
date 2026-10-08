import { INITIAL_MUSIC_VISUAL } from './music-visual-interpreter';
import { RHYTHM_CONFIG, SHADER_CONFIG, VISUAL_CONFIG } from '../config';
import type { MusicVisualState, VisualDebugSignal } from './types';

// Caller is guarded by __DEV__. These never enter the audio/event pipeline.
export function debugVisualTarget(state: MusicVisualState, signal: VisualDebugSignal, time: number): MusicVisualState {
  'worklet';
  const sweep = (Math.sin(time * 2 * Math.PI / VISUAL_CONFIG.debug.sweepSeconds) + 1) / 2;
  const base = { ...INITIAL_MUSIC_VISUAL, timestamp: time, energy: 0.65, pigmentIntensity: 0.65, brightness: 0.6 };
  if (signal === 'beat') return { ...base, beatPhase: time % 1, beatPulse: Math.exp(-(time % 1) / RHYTHM_CONFIG.beatPulseDecaySeconds) };
  if (signal === 'energy') return { ...base, energy: sweep, pigmentIntensity: VISUAL_CONFIG.pigment.base + VISUAL_CONFIG.pigment.energy * sweep };
  if (signal === 'tempo') return { ...base, bpm: 60 + 120 * sweep, tempoConfidence: 1, flowSpeed: SHADER_CONFIG.baseFlowSpeed + SHADER_CONFIG.tempoFlowContribution * sweep };
  if (signal === 'spectrum') {
    const region = Math.floor(time / 3) % 3;
    return { ...base, spectralLow: region === 0 ? 1 : 0, spectralMid: region === 1 ? 1 : 0, spectralHigh: region === 2 ? 1 : 0,
      macroScale: region === 0 ? SHADER_CONFIG.baseMacroScale / (1 + SHADER_CONFIG.lowMacroContribution) : SHADER_CONFIG.baseMacroScale,
      turbulence: SHADER_CONFIG.baseTurbulence + (region === 1 ? SHADER_CONFIG.midWarpContribution : 0),
      detailScale: SHADER_CONFIG.baseDetailScale + (region === 2 ? SHADER_CONFIG.highDetailContribution : 0) };
  }
  return state;
}
