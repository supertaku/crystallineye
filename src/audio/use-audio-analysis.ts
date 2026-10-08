import { useCallback, useEffect, useRef, useState } from 'react';
import type { AudioPlayer } from 'expo-audio';
import { AppState, Platform } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
import { AudioSampler } from './audio-sampler';
import { sampleTimestamp } from './sample-rate';
import { MusicEventEngine } from '../music/music-event-engine';
import type { MusicEventFrame } from '../music/types';
import { INITIAL_MUSIC_VISUAL, interpretMusic } from '../visualization/music-visual-interpreter';

export function useAudioAnalysis(player: AudioPlayer, allowed: boolean, loaded: boolean, playing: boolean, resetGeneration: number) {
  const [sampler] = useState(() => new AudioSampler(Platform.OS === 'android' ? 'snapshot' : 'continuous'));
  const [music] = useState(() => new MusicEventEngine());
  const target = useSharedValue(INITIAL_MUSIC_VISUAL);
  const visible = useSharedValue(INITIAL_MUSIC_VISUAL);
  const active = useSharedValue(false);
  const fps = useSharedValue(0);
  const musicFrame = useRef<MusicEventFrame | null>(null);
  const timings = useRef<number[]>([]);
  const eventMs = useRef(0);
  const [diagnostics, setDiagnostics] = useState({ ...sampler.getDiagnostics(), music: null as MusicEventFrame | null, callbackRate: 0, dspAverageMs: 0, dspP95Ms: 0, eventMs: 0 });
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const errorRef = useRef<string | null>(null);
  const [stalled, setStalled] = useState(false);
  const lastCallback = useRef(0);
  const gate = useRef(false);

  const freeze = useCallback(() => {
    gate.current = false;
    active.set(false);
    sampler.breakContinuity();
    music.breakContinuity();
  }, [active, sampler, music]);

  useEffect(() => {
    const foreground = AppState.addEventListener('change', (state) => { if (state !== 'active') freeze(); });
    const subscription = player.addListener('playbackStatusUpdate', (status) => {
      if (!status.playing || status.isBuffering || status.didJustFinish || status.error) freeze();
    });
    return () => { subscription.remove(); foreground.remove(); };
  }, [player, freeze]);

  useEffect(() => {
    gate.current = false;
    active.set(false);
    sampler.reset(true);
    music.reset();
    musicFrame.current = null;
    timings.current = [];
    // Preserve visible pigment/palette across track changes and seeks.
    const retained = { ...visible.get(), timestamp: -1, onset: 0, bpm: 0, tempoConfidence: 0, beatConfidence: 0, beatPhase: 0, beatPulse: 0 };
    visible.set(retained);
    target.set(retained);
    lastCallback.current = 0;
    errorRef.current = null;
  }, [player, resetGeneration, sampler, music, target, visible, active]);

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
          const started = performance.now();
          const events = music.update(feature);
          musicFrame.current = events;
          target.set(interpretMusic(events));
          eventMs.current = performance.now() - started;
          timings.current.push(sampler.getDiagnostics().dspMs);
          if (timings.current.length > 120) timings.current.shift();
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
  }, [player, allowed, loaded, sampler, music, target, active]);

  useEffect(() => {
    gate.current = playing && allowed && loaded && !errorRef.current;
    if (!gate.current) {
      active.set(false);
      sampler.breakContinuity();
      music.breakContinuity();
    }
    if (playing) lastCallback.current = performance.now();
  }, [playing, allowed, loaded, analysisError, resetGeneration, player, sampler, music, active]);

  useEffect(() => {
    let previousCallbacks = sampler.getDiagnostics().callbacks;
    let previousTime = performance.now();
    const timer = setInterval(() => {
      const now = performance.now();
      const data = sampler.getDiagnostics();
      const sorted = [...timings.current].sort((a, b) => a - b);
      setDiagnostics({ ...data, music: musicFrame.current,
        callbackRate: Math.max(0, data.callbacks - previousCallbacks) * 1000 / Math.max(1, now - previousTime),
        dspAverageMs: sorted.reduce((sum, value) => sum + value, 0) / Math.max(1, sorted.length),
        dspP95Ms: sorted[Math.floor(sorted.length * 0.95)] ?? 0, eventMs: eventMs.current,
      });
      previousCallbacks = data.callbacks; previousTime = now;
      setAnalysisError(errorRef.current);
      const noSamples = gate.current && performance.now() - lastCallback.current > 2000;
      setStalled(noSamples);
      if (noSamples) { active.set(false); music.breakContinuity(); }
    }, 500);
    return () => clearInterval(timer);
  }, [sampler, music, active]);

  return { target, visible, active, fps, diagnostics, analysisError, stalled: stalled && playing, freeze };
}
