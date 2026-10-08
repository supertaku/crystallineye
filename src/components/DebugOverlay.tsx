import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { SharedValue } from 'react-native-reanimated';
import type { SamplerDiagnostics } from '../types/audio';
import type { MusicEventFrame } from '../music/types';
import type { MusicVisualState, VisualDebugMode, VisualDebugSignal } from '../visualization/types';

type Props = {
  data: SamplerDiagnostics & { music: MusicEventFrame | null; callbackRate: number; dspAverageMs: number; dspP95Ms: number; eventMs: number };
  fps: SharedValue<number>; visual: SharedValue<MusicVisualState>; shaderError: string | null;
  mode: VisualDebugMode; signal: VisualDebugSignal;
  onMode: (mode: VisualDebugMode) => void; onSignal: (signal: VisualDebugSignal) => void; onClose: () => void;
};

export function DebugOverlay({ data, fps, visual, shaderError, mode, signal, onMode, onSignal, onClose }: Props) {
  const [measuredFPS, setMeasuredFPS] = useState(0);
  const [measuredVisual, setMeasuredVisual] = useState<MusicVisualState | null>(null);
  useEffect(() => {
    const timer = setInterval(() => { setMeasuredFPS(fps.value); setMeasuredVisual(visual.value); }, 1000);
    return () => clearInterval(timer);
  }, [fps, visual]);
  const feature = data.feature;
  const ratios = feature?.bandRatios ?? feature?.spectrumRatios;
  const percentage = ratios?.map((ratio) => `${(ratio * 100).toFixed(0)}%`).join(' / ') ?? '—';
  return (
    <ScrollView style={styles.panel} contentContainerStyle={styles.content}>
      <View style={styles.row}><Text style={styles.label}>DEV · {signal === 'audio' ? 'real playback' : 'MANUAL SIGNAL'}</Text><Pressable onPress={onClose} style={styles.button} accessibilityRole="button" accessibilityLabel="Close diagnostics"><Text style={styles.label}>Close</Text></Pressable></View>
      <View style={styles.row}>{(['fluid', 'legacy', 'motion'] as const).map((value) => <Pressable key={value} style={[styles.button, mode === value && styles.selected]} onPress={() => onMode(value)} accessibilityRole="button" accessibilityState={{ selected: mode === value }}><Text style={styles.label}>{value === 'fluid' ? 'Fluid Ink' : value === 'legacy' ? 'Legacy Gradient' : 'Motion Debug'}</Text></Pressable>)}</View>
      <View style={styles.row}>{(['audio', 'beat', 'energy', 'spectrum', 'tempo'] as const).map((value) => <Pressable key={value} style={[styles.button, signal === value && styles.selected]} onPress={() => onSignal(value)} accessibilityRole="button" accessibilityState={{ selected: signal === value }}><Text style={styles.label}>{value}</Text></Pressable>)}</View>
      {shaderError ? <Text style={styles.error}>{shaderError}</Text> : null}
      <Text style={styles.text}>{[
        `PCM callbacks ${data.callbacks} (${data.callbackRate.toFixed(1)}/s) · frames ${data.frames}`,
        `Packet ${data.lastFrameCount} · ${data.mode}`,
        `Time ${data.timestamp?.toFixed(3) ?? '—'} s · raw ${data.rawTimestamp ?? '—'}`,
        `RMS ${feature?.rms.toFixed(4) ?? '—'} · energy ${feature?.rmsNormalized.toFixed(2) ?? '—'}`,
        `Brightness ${feature?.spectralBrightnessNormalized.toFixed(2) ?? '—'}`,
        `Centroid ${feature?.spectralCentroidHz?.toFixed(0) ?? 'unavailable'} Hz`,
        `${feature?.bandRatios ? 'Low / mid / high' : 'Spectrum thirds (not Hz)'} ${percentage}`,
        `Flux ${feature?.spectralFlux.toFixed(4) ?? '—'} · onset ${feature?.onsetStrength.toFixed(2) ?? '—'}`,
        `Combined novelty ${data.music?.novelty.toFixed(2) ?? '—'} · envelope ${data.music?.onsetStrength.toFixed(2) ?? '—'}`,
        `Tempo ${data.music?.tempo.bpm?.toFixed(1) ?? 'warming up / unknown'} BPM · confidence ${data.music?.tempo.confidence.toFixed(2) ?? '0'}`,
        `Beat phase ${measuredVisual?.beatPhase.toFixed(2) ?? '—'} · pulse ${measuredVisual?.beatPulse.toFixed(2) ?? '—'}`,
        `Rate ${data.estimatedSampleRate?.toFixed(0) ?? 'unknown'} Hz · confidence ${data.sampleRateConfidence.toFixed(2)}`,
        `DSP ${data.dspMs.toFixed(2)} ms · updates ${data.updates}`,
        `DSP mean ${data.dspAverageMs.toFixed(2)} · p95 ${data.dspP95Ms.toFixed(2)} ms (120 updates)`,
        `Event + interpreter ${data.eventMs.toFixed(2)} ms`,
        `UI callback FPS ${measuredFPS ? measuredFPS.toFixed(0) : '—'}`,
      ].join('\n')}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  panel: { backgroundColor: 'rgba(8,7,14,0.94)', borderRadius: 12, width: '100%' },
  content: { padding: 12, gap: 8 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' },
  button: { minHeight: 48, paddingHorizontal: 10, justifyContent: 'center', borderRadius: 8 },
  selected: { backgroundColor: '#393044' },
  label: { color: '#ece6fa', fontSize: 11 },
  error: { color: '#ffb2ba', fontSize: 11 },
  text: { color: '#ece6fa', fontFamily: 'monospace', fontSize: 11, lineHeight: 18 },
});
