import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { SharedValue } from 'react-native-reanimated';
import type { SamplerDiagnostics } from '../types/audio';

export function DebugOverlay({ data, fps }: { data: SamplerDiagnostics; fps: SharedValue<number> }) {
  const [measuredFPS, setMeasuredFPS] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setMeasuredFPS(fps.value), 1000);
    return () => clearInterval(timer);
  }, [fps]);
  const feature = data.feature;
  const ratios = feature?.bandRatios ?? feature?.spectrumRatios;
  const percentage = ratios?.map((ratio) => `${(ratio * 100).toFixed(0)}%`).join(' / ') ?? '—';
  return (
    <View style={styles.panel}>
      <Text style={styles.text}>{[
        `PCM callbacks ${data.callbacks} · frames ${data.frames}`,
        `Packet ${data.lastFrameCount} · ${data.mode}`,
        `Time ${data.timestamp?.toFixed(3) ?? '—'} s · raw ${data.rawTimestamp ?? '—'}`,
        `RMS ${feature?.rms.toFixed(4) ?? '—'} · energy ${feature?.rmsNormalized.toFixed(2) ?? '—'}`,
        `Centroid ${feature?.spectralCentroidHz?.toFixed(0) ?? 'unavailable'} Hz`,
        `${feature?.bandRatios ? 'Low / mid / high' : 'Spectrum thirds (not Hz)'} ${percentage}`,
        `Flux ${feature?.spectralFlux.toFixed(4) ?? '—'} · onset ${feature?.onsetStrength.toFixed(2) ?? '—'}`,
        `Rate ${data.estimatedSampleRate?.toFixed(0) ?? 'unknown'} Hz · confidence ${data.sampleRateConfidence.toFixed(2)}`,
        `DSP ${data.dspMs.toFixed(2)} ms · updates ${data.updates}`,
        `UI callback FPS ${measuredFPS ? measuredFPS.toFixed(0) : '—'}`,
      ].join('\n')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { backgroundColor: 'rgba(8,7,14,0.94)', padding: 12, borderRadius: 12, width: '100%', maxWidth: 460 },
  text: { color: '#ece6fa', fontFamily: 'monospace', fontSize: 11, lineHeight: 18 },
});
