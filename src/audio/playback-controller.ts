import { useCallback, useEffect, useRef, useState } from 'react';
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { AppState } from 'react-native';
import { importAudio, type ImportedAudio } from './import-audio';
import { ensureSamplingPermission } from './sampling-permission';

export function usePlaybackController() {
  const [track, setTrack] = useState<ImportedAudio | null>(null);
  const [importing, setImporting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [samplingAllowed, setSamplingAllowed] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [resetGeneration, setResetGeneration] = useState(0);
  const player = useAudioPlayer(track?.uri ?? null, { updateInterval: 100 });
  const status = useAudioPlayerStatus(player);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') player.pause();
    });
    return () => subscription.remove();
  }, [player]);

  useEffect(() => {
    if (!track || status.isLoaded || importing) return;
    const timeout = setTimeout(() => setError('This audio file could not be loaded. Try another file.'), 15000);
    return () => clearTimeout(timeout);
  }, [track, status.isLoaded, importing]);

  const chooseAudio = useCallback(async () => {
    if (importing || busy) return;
    player.pause();
    setImporting(true);
    setError(null);
    try {
      const next = await importAudio();
      if (mounted.current && next) {
        setTrack(next);
        setResetGeneration((generation) => generation + 1);
      }
    } catch (cause) {
      if (mounted.current) setError(cause instanceof Error ? cause.message : 'This file could not be opened. Try another file.');
    } finally { if (mounted.current) setImporting(false); }
  }, [player, importing, busy]);

  const requestPermission = useCallback(async () => {
    try {
      const granted = await ensureSamplingPermission();
      if (mounted.current) { setSamplingAllowed(granted); setPermissionDenied(!granted); }
      return granted;
    } catch {
      if (mounted.current) {
        setSamplingAllowed(false);
        setPermissionDenied(true);
        setError('Audio permission could not be requested. Retry or open this app’s permissions in Android Settings.');
      }
      return false;
    }
  }, []);

  const togglePlayback = useCallback(async () => {
    if (busy || !status.isLoaded) return;
    if (player.playing) { player.pause(); return; }
    setBusy(true);
    setError(null);
    try {
      await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false, shouldPlayInBackground: false, interruptionMode: 'doNotMix' });
      await requestPermission();
      if (!mounted.current || AppState.currentState !== 'active') return;
      if (player.currentTime >= player.duration - 0.05) {
        await player.seekTo(0);
        setResetGeneration((generation) => generation + 1);
      }
      player.play();
    } catch { if (mounted.current) setError('Playback could not start. Try again or import another file.'); }
    finally { if (mounted.current) setBusy(false); }
  }, [busy, status.isLoaded, player, requestPermission]);

  const seek = useCallback(async (seconds: number) => {
    if (busy || !status.isLoaded) return;
    const wasPlaying = player.playing;
    player.pause();
    setBusy(true);
    setResetGeneration((generation) => generation + 1);
    try {
      await player.seekTo(Math.max(0, Math.min(player.duration, seconds)));
      if (mounted.current && wasPlaying && AppState.currentState === 'active') player.play();
    } catch { if (mounted.current) setError('Could not seek in this file. Try restarting it.'); }
    finally { if (mounted.current) setBusy(false); }
  }, [busy, status.isLoaded, player]);

  return {
    track, player, status, importing, busy, samplingAllowed, permissionDenied, resetGeneration,
    error: status.error ? 'This audio file could not be played. Try another file.' : error,
    chooseAudio, togglePlayback, seek, requestPermission,
  };
}
