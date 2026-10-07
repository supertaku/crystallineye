import { useCallback, useEffect, useRef, useState } from 'react';
import type { AudioPlayer } from 'expo-audio';
import { Platform } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
import { AudioSampler } from './audio-sampler';
import { sampleTimestamp } from './sample-rate';
import { ColorEngine } from '../color/color-engine';
import { INITIAL_VISUAL } from '../color/perceptual-v1';

export function useAudioAnalysis(player: AudioPlayer, allowed: boolean, loaded: boolean, playing: boolean, resetGeneration: number) {
  const [sampler] = useState(() => new AudioSampler(Platform.OS === 'android' ? 'snapshot' : 'continuous'));
  const [color] = useState(() => new ColorEngine());
  const target = useSharedValue(INITIAL_VISUAL);
  const visible = useSharedValue(INITIAL_VISUAL);
  const active = useSharedValue(false);
  const fps = useSharedValue(0);
  const [diagnostics, setDiagnostics] = useState(sampler.getDiagnostics());
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const errorRef = useRef<string | null>(null);
  const [stalled, setStalled] = useState(false);
  const lastCallback = useRef(0);
  const lastColor = useRef<number | null>(null);
  const gate = useRef(false);

  const freeze = useCallback(() => {
    gate.current = false;
    active.set(false);
    sampler.breakContinuity();
    lastColor.current = null;
  }, [active, sampler]);

  useEffect(() => {
    const subscription = player.addListener('playbackStatusUpdate', (status) => {
      if (!status.playing || status.isBuffering || status.didJustFinish || status.error) freeze();
    });
    return () => subscription.remove();
  }, [player, freeze]);

  useEffect(() => {
    gate.current = false;
    sampler.reset(true);
    color.reset(visible.get());
    target.set(visible.get());
    lastColor.current = null;
    lastCallback.current = 0;
    errorRef.current = null;
  }, [player, resetGeneration, sampler, color, target, visible]);

  useEffect(() => {
    const enabled = allowed && loaded;
    if (!enabled) return;
    if (!player.isAudioSamplingSupported) {
      errorRef.current = 'Playback is available, but this device does not support playback sampling.';
      return;
    }
    // Manual equivalent of useAudioSampleListener: enable AFTER permission and
    // loading, retry on permission changes, and disable on cleanup.
    const subscription = player.addListener('audioSampleUpdate', (sample) => {
      if (!gate.current || !player.playing || player.isBuffering) return;
      const now = performance.now();
      lastCallback.current = now;
      try {
        const timestamp = sampleTimestamp(sample.timestamp, Platform.OS === 'android' ? 'android' : 'other');
        // Drop native events queued before a seek; preserve the iOS zero-time fallback.
        if (Platform.OS === 'android' && timestamp !== null && Math.abs(timestamp - player.currentTime) > 0.35) return;
        const feature = sampler.receive(sample, timestamp, player.currentTime, now);
        if (feature) {
          const dt = lastColor.current === null ? 1 / 30 : Math.min(0.1, (now - lastColor.current) / 1000);
          target.set(color.update(feature, dt));
          lastColor.current = now;
          active.set(true);
        }
      } catch {
        gate.current = false;
        active.set(false);
        errorRef.current = 'Playback is available. Audio analysis failed; import another file to retry.';
        setAnalysisError(errorRef.current);
      }
    });
    try { player.setAudioSamplingEnabled(true); }
    catch { errorRef.current = 'Playback is available, but waveform sampling could not start on this device.'; }
    return () => {
      subscription.remove();
      try { player.setAudioSamplingEnabled(false); } catch { /* Player may already be released. */ }
    };
  }, [player, allowed, loaded, sampler, color, target, active]);

  useEffect(() => {
    gate.current = playing && allowed && loaded && !errorRef.current;
    if (!gate.current) {
      active.set(false);
      sampler.breakContinuity();
      lastColor.current = null;
    }
    if (playing) lastCallback.current = performance.now();
  }, [playing, allowed, loaded, analysisError, resetGeneration, player, sampler, active]);

  useEffect(() => {
    const timer = setInterval(() => {
      setDiagnostics(sampler.getDiagnostics());
      setAnalysisError(errorRef.current);
      const noSamples = gate.current && performance.now() - lastCallback.current > 2000;
      setStalled(noSamples);
      if (noSamples) active.set(false);
    }, 500);
    return () => clearInterval(timer);
  }, [sampler, active]);

  return { target, visible, active, fps, diagnostics, analysisError, stalled: stalled && playing, freeze };
}
