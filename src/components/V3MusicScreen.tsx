import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, AppState, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as DocumentPicker from 'expo-document-picker';
import { useReducedMotion, useSharedValue } from 'react-native-reanimated';
import { importAudio } from '../audio/import-audio';
import { AudioEngine, type PreparedTrack } from '../audio-v3/audio-engine';
import { AudioTransport } from '../audio-v3/audio-transport';
import { NativeAudio } from '../audio-v3/NativeAudio';
import type { AnalysisProgress as Progress } from '../analysis/analysis-schema';
import { PaintCanvas } from '../paint/PaintCanvas';
import { ScorePlayer } from '../paint/score-player';
import { VisualizationBoundary } from '../visualization/VisualizationBoundary';
import { MinimalPlayerOverlay } from './MinimalPlayerOverlay';
import { ImportButton } from './ImportButton';
import { usePlayerAutoHide } from './use-player-auto-hide';
import { AnalysisProgress } from './AnalysisProgress';

export function V3MusicScreen({ onLegacy }: { onLegacy?: () => void }) {
  const [engine] = useState(() => new AudioEngine());
  const [track, setTrack] = useState<PreparedTrack | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [picking, setPicking] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const [position, setPosition] = useState(0);
  const [sceneIndex, setSceneIndex] = useState(0);
  const [scrubbing, setScrubbing] = useState(false);
  const [debug, setDebug] = useState(false);
  const [screenReader, setScreenReader] = useState(false);
  const systemReducedMotion = useReducedMotion();
  const [reducedMotion, setReducedMotion] = useState(systemReducedMotion);
  const transport = useRef<AudioTransport | null>(null);
  const [nativeTransport, setNativeTransport] = useState<AudioTransport | null>(null);
  const [audioGeneration, setAudioGeneration] = useState(0);
  const operation = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  const taps = useRef({ count: 0, time: 0 });
  const songTime = useSharedValue(0);
  const player = useMemo(() => track ? new ScorePlayer(track.score) : null, [track]);
  const busy = picking || !!progress;
  const overlay = usePlayerAutoHide(playing && !buffering, busy || !loaded || !!error || debug || screenReader || scrubbing);

  const pause = useCallback(() => {
    transport.current?.pause();
    const time = transport.current?.currentTime() ?? 0;
    songTime.set(time); setPosition(time); setPlaying(false); setBuffering(false);
  }, [songTime]);
  const reportError = useCallback((message: string) => {
    try { transport.current?.pause(); } catch { /* The source may already be gone. */ }
    setError(message); setPlaying(false); setBuffering(false);
  }, []);
  const ended = useCallback(() => {
    transport.current?.ended();
    const time = transport.current?.duration ?? 0;
    songTime.set(time); setPosition(time); setPlaying(false); setBuffering(false);
  }, [songTime]);
  const changeBuffering = useCallback((value: boolean) => {
    try { transport.current?.setBuffering(value); setBuffering(value); } catch (cause) { reportError(String(cause)); }
  }, [reportError]);

  useEffect(() => {
    mounted.current = true;
    void AccessibilityInfo.isScreenReaderEnabled().then((value) => { if (mounted.current) setScreenReader(value); });
    const reader = AccessibilityInfo.addEventListener('screenReaderChanged', setScreenReader);
    const motion = AccessibilityInfo.addEventListener('reduceMotionChanged', setReducedMotion);
    const background = AppState.addEventListener('change', (state) => { if (state !== 'active') { try { pause(); } catch (cause) { reportError(String(cause)); } } });
    return () => { mounted.current = false; operation.current?.abort(); reader.remove(); motion.remove(); background.remove(); };
  }, [pause, reportError]);

  useEffect(() => {
    if (!playing || !player) return;
    let frame = 0, lastUI = 0, lastScene = -1;
    const tick = (now: number) => {
      try {
        const time = transport.current?.currentTime() ?? 0;
        songTime.set(time);
        const index = player.sceneIndex(time);
        if (index !== lastScene) { lastScene = index; setSceneIndex(index); }
        if (now - lastUI >= 250) { lastUI = now; setPosition(time); }
        frame = requestAnimationFrame(tick);
      } catch (cause) { reportError(cause instanceof Error ? cause.message : String(cause)); }
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, player, reportError, songTime]);

  const chooseMusic = async () => {
    if (busy || operation.current) return;
    overlay.touch(); setPicking(true); setError(null);
    const controller = new AbortController(); operation.current = controller;
    try {
      pause();
      const imported = await importAudio();
      if (!imported || !mounted.current || controller.signal.aborted) return;
      setProgress({ stage: 'decode', stageProgress: 0, overallProgress: 0 });
      const prepared = await engine.prepare(imported.uri, imported.name, (value) => { if (mounted.current && !controller.signal.aborted) setProgress(value); }, controller.signal);
      if (!mounted.current || controller.signal.aborted) return;
      const nextTransport = new AudioTransport(prepared.metadata.duration);
      transport.current = nextTransport; setNativeTransport(nextTransport);
      setAudioGeneration((value) => value + 1);
      songTime.set(0); setPosition(0); setSceneIndex(0); setLoaded(false); setTrack(prepared);
    } catch (cause) { if (mounted.current && !controller.signal.aborted) setError(cause instanceof Error ? cause.message : String(cause)); }
    finally { operation.current = null; if (mounted.current) { setProgress(null); setPicking(false); setCancelling(false); } }
  };
  const seek = (seconds: number) => {
    try {
      transport.current?.seek(seconds); const time = transport.current?.currentTime() ?? seconds;
      songTime.set(time); setPosition(time); setSceneIndex(player?.sceneIndex(time) ?? 0);
    } catch (cause) { reportError(String(cause)); }
  };
  const toggle = () => {
    overlay.touch();
    try { if (playing) pause(); else { transport.current?.play(); setPlaying(true); } }
    catch (cause) { reportError(String(cause)); }
  };
  const loadReference = async () => {
    if (!__DEV__ || !track || busy) return;
    setPicking(true); setError(null);
    try {
      pause();
      const picked = await DocumentPicker.getDocumentAsync({ type: ['application/json', 'text/plain'], multiple: false, copyToCacheDirectory: true });
      if (picked.canceled || !picked.assets[0] || !mounted.current) return;
      const prepared = await engine.loadReference(picked.assets[0].uri, track);
      if (mounted.current) { setTrack(prepared); setSceneIndex(new ScorePlayer(prepared.score).sceneIndex(songTime.value)); }
    } catch (cause) { if (mounted.current) setError(cause instanceof Error ? cause.message : String(cause)); }
    finally { if (mounted.current) setPicking(false); }
  };
  const toggleDebug = () => {
    const now = performance.now();
    taps.current.count = now - taps.current.time < 650 ? taps.current.count + 1 : 1;
    taps.current.time = now;
    if (taps.current.count === 3) { setDebug((value) => !value); taps.current.count = 0; }
  };

  return <View style={styles.root}>
    <StatusBar style="light" hidden={!!track && playing && !busy && !error && !buffering} />
    {track ? <VisualizationBoundary key={track.analysis.track.hash} fallback={<View style={StyleSheet.absoluteFill} />} onFailure={reportError}>
      <PaintCanvas score={track.score} sceneIndex={sceneIndex} songTime={songTime} reducedMotion={reducedMotion} />
    </VisualizationBoundary> : null}
    <Pressable style={StyleSheet.absoluteFill} onPress={overlay.toggle} accessible={!!track && playing && !screenReader} accessibilityRole="button" accessibilityLabel={overlay.visible ? 'Hide music controls' : 'Show music controls'} />
    {track && nativeTransport ? <NativeAudio key={audioGeneration} uri={track.uri} transport={nativeTransport}
      onReady={() => { if (transport.current === nativeTransport) setLoaded(true); }}
      onError={(message) => { if (transport.current === nativeTransport) reportError(message); }}
      onEnded={() => { if (transport.current === nativeTransport) ended(); }}
      onBuffering={(value) => { if (transport.current === nativeTransport) changeBuffering(value); }} /> : null}
    {!track ? <SafeAreaView style={styles.initial} pointerEvents="box-none"><View style={styles.welcome}>
      <Text style={styles.brand}>crystallineye</Text><Text style={styles.title}>Watch your music{'\n'}become a painting</Text>
      <ImportButton label={picking ? 'Preparing music…' : 'Import music'} onPress={() => void chooseMusic()} disabled={busy} />
      {error ? <Text style={styles.message} accessibilityLiveRegion="polite">{error}</Text> : null}
    </View></SafeAreaView> : <MinimalPlayerOverlay name={track.name} playing={playing} loaded={loaded} busy={busy} loading={!loaded}
      visible={overlay.visible} reducedMotion={reducedMotion} currentTime={position} duration={track.metadata.duration} message={error ?? (buffering ? 'Buffering music…' : !loaded ? 'Preparing playback…' : null)}
      permissionDenied={false} onPermission={() => {}} onInteraction={overlay.touch} onScrubbing={setScrubbing}
      onToggle={toggle} onSeek={seek} onImport={() => void chooseMusic()} />}
    {progress ? <AnalysisProgress progress={progress} cancelling={cancelling} onCancel={() => { operation.current?.abort(); setCancelling(true); }} /> : null}
    {__DEV__ ? <Pressable style={styles.hotspot} onPress={toggleDebug} accessibilityRole="button" accessibilityLabel="Triple tap for developer comparison" /> : null}
    {__DEV__ && debug ? <SafeAreaView style={styles.debug}><ScrollView contentContainerStyle={styles.debugContent}>
      <Text style={styles.devText}>DEV · Score-Driven V3</Text>
      <Pressable style={styles.devButton} onPress={onLegacy} disabled={busy} accessibilityRole="button"><Text style={styles.devText}>Visualizer V2</Text></Pressable>
      <Pressable style={styles.devButton} onPress={() => void loadReference()} disabled={!track || busy} accessibilityRole="button"><Text style={styles.devText}>Load research MusicAnalysis JSON</Text></Pressable>
      <Pressable style={styles.devButton} onPress={() => setDebug(false)} accessibilityRole="button"><Text style={styles.devText}>Close</Text></Pressable>
      {track ? <Text style={styles.devText}>{`${track.analysis.quality} · ${track.cacheHit ? 'cached' : 'analyzed'}\n${track.analysis.track.hash.slice(0, 16)}\n${track.analysis.notes.length} notes · ${track.analysis.rhythm.beats.length} beats\n${track.score.strokes.length} strokes · ${track.score.scenes.length} scenes\n${track.analysis.warnings.join('\n')}`}</Text> : null}
    </ScrollView></SafeAreaView> : null}
  </View>;
}
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#14131b' }, initial: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, alignItems: 'center', justifyContent: 'center', padding: 28 },
  welcome: { alignItems: 'center', gap: 32, maxWidth: 420 }, brand: { color: '#cbc1db', fontSize: 14, letterSpacing: 3 },
  title: { color: '#f4eef9', fontSize: 30, lineHeight: 40, textAlign: 'center' }, message: { color: '#f4eef9', lineHeight: 22, textAlign: 'center' },
  hotspot: { position: 'absolute', top: 28, right: 0, width: 52, height: 52 }, debug: { position: 'absolute', top: 64, left: 12, right: 12, maxHeight: '65%', backgroundColor: 'rgba(8,7,14,0.95)', borderRadius: 12 },
  debugContent: { padding: 16, gap: 8 }, devText: { color: '#e5ddec', fontSize: 12, lineHeight: 20 }, devButton: { minHeight: 48, justifyContent: 'center' },
});
