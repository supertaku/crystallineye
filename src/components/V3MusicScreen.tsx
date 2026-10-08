import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, AppState, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import { useReducedMotion, useSharedValue } from 'react-native-reanimated';
import { importAudio } from '../audio/import-audio';
import { AudioEngine, type PreparedTrack } from '../audio-v3/audio-engine';
import { AudioTransport } from '../audio-v3/audio-transport';
import { NativeAudio } from '../audio-v3/NativeAudio';
import { ClockTrace, DIAGNOSTIC_MODES, type DiagnosticMode } from '../audio-v3/clock-trace';
import { SyntheticClockSource } from '../audio-v3/synthetic-clock';
import { VisualTimeGate } from '../audio-v3/visual-time-gate';
import { createDiagnosticScore } from '../visual-score/diagnostics';
import type { AnalysisProgress as Progress } from '../analysis/analysis-schema';
import { PaintCanvas } from '../paint/PaintCanvas';
import { ScorePlayer } from '../paint/score-player';
import { estimateRenderNodes } from '../paint/render-diagnostics';
import { VisualizationBoundary } from '../visualization/VisualizationBoundary';
import { MinimalPlayerOverlay } from './MinimalPlayerOverlay';
import { ImportButton } from './ImportButton';
import { usePlayerAutoHide } from './use-player-auto-hide';
import { AnalysisProgress } from './AnalysisProgress';

function latestAt<T>(events: T[], time: number, timestamp: (event: T) => number): T | undefined {
  let low = 0, high = events.length;
  while (low < high) { const mid = (low + high) >>> 1; if (timestamp(events[mid]!) <= time) low = mid + 1; else high = mid; }
  return events[low - 1];
}

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
  const [diagnosticMode, setDiagnosticMode] = useState<DiagnosticMode>('D');
  const [recording, setRecording] = useState(false);
  const [traceSummary, setTraceSummary] = useState<ReturnType<ClockTrace['summary']> | null>(null);
  const [tracePath, setTracePath] = useState<string | null>(null);
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
  const [trace] = useState(() => ({ current: new ClockTrace() }));
  const [visualTimeGate] = useState(() => new VisualTimeGate());
  const mode = DIAGNOSTIC_MODES.find((value) => value.mode === diagnosticMode)!;
  const synthetic = __DEV__ && mode.synthetic;
  const duration = track?.metadata.duration ?? 30;
  const score = useMemo(() => __DEV__ && (diagnosticMode === 'A' || diagnosticMode === 'B') ? createDiagnosticScore(duration) : track?.score ?? null, [diagnosticMode, duration, track]);
  const player = useMemo(() => score ? new ScorePlayer(score) : null, [score]);
  const debugFrame = useMemo(() => __DEV__ && debug ? player?.frameAt(position) : null, [debug, player, position]);
  const renderNodes = useMemo(() => __DEV__ && debug && score ? estimateRenderNodes(score, sceneIndex) : null, [debug, score, sceneIndex]);
  const eventTimes = useMemo(() => __DEV__ ? [...new Set([
    ...(track?.analysis.rhythm.beats.map((event) => event.time) ?? []),
    ...(track?.analysis.notes.flatMap((event) => [event.start, event.end]) ?? []),
    ...(score?.scenes.map((event) => event.start) ?? []), ...(score?.strokes.flatMap((event) => [event.start, event.end]) ?? []),
  ])].sort((a, b) => a - b) : [], [track, score]);
  const musicalDiagnostics = useMemo(() => {
    if (!__DEV__ || !debug || !track) return null;
    const analysis = track.analysis;
    const dynamics = latestAt(analysis.dynamics, position, (event) => event.time);
    const beat = latestAt(analysis.rhythm.beats, position, (event) => event.time);
    const downbeat = latestAt(analysis.rhythm.downbeats, position, (event) => event.time);
    const chord = latestAt(analysis.harmony.chords, position, (event) => event.start);
    const section = latestAt(analysis.structure.segments, position, (event) => event.start);
    const chroma = latestAt(analysis.harmony.chromaFrames, position, (event) => event.time);
    const notes = analysis.notes.filter((event) => event.start <= position && event.end > position).slice(0, 5);
    return [`RMS ${dynamics?.rms.toFixed(5) ?? '—'} · energy ${dynamics?.energy.toFixed(3) ?? '—'} · onset ${dynamics?.onset.toFixed(3) ?? '—'}`,
      `Beat ${beat?.time.toFixed(3) ?? '—'}s · downbeat ${downbeat?.time.toFixed(3) ?? '—'}s · BPM ${analysis.rhythm.bpm?.toFixed(1) ?? 'unknown'}`,
      `Notes ${notes.map((note) => `MIDI${note.midi} ${note.start.toFixed(2)}–${note.end.toFixed(2)}s c${note.confidence.toFixed(2)}`).join(' · ') || 'none active'}`,
      `Chord ${chord ? JSON.stringify(chord) : 'unknown'}`,
      `Chroma ${chroma?.values.map((value) => value.toFixed(2)).join(' ') ?? 'unavailable'}`,
      `Section ${section ? `${section.label} ${section.start.toFixed(2)}–${section.end.toFixed(2)}s` : 'unknown'}`,
    ].join('\n');
  }, [debug, track, position]);
  const busy = picking || !!progress;
  const overlay = usePlayerAutoHide(playing && !buffering, busy || !loaded || !!error || debug || screenReader || scrubbing);

  useLayoutEffect(() => {
    const time = visualTimeGate.commit(sceneIndex);
    if (time !== null) songTime.set(time);
  }, [sceneIndex, player, songTime, visualTimeGate]);
  const publishTime = useCallback((time: number) => {
    const index = player?.sceneIndex(time) ?? 0;
    // Near boundaries the renderer pre-mounts the incoming scene. For a far
    // seek, publish requested time after React commits the necessary layers.
    const mounted = player?.layersAt(visualTimeGate.committedScene).some((section) => section.scene.index === index) ?? true;
    const result = visualTimeGate.offer(time, index, mounted);
    if (result.publishTime !== null) songTime.set(result.publishTime);
    if (result.requestScene !== null) setSceneIndex(result.requestScene);
  }, [player, songTime, visualTimeGate]);

  const pause = useCallback(() => {
    transport.current?.pause();
    const time = transport.current?.currentTime() ?? 0;
    publishTime(time); setPosition(time); setPlaying(false); setBuffering(false);
  }, [publishTime]);
  const reportError = useCallback((message: string) => {
    try { transport.current?.pause(); } catch { /* The source may already be gone. */ }
    setError(message); setPlaying(false); setBuffering(false);
  }, []);
  const ended = useCallback(() => {
    transport.current?.ended();
    const time = transport.current?.duration ?? 0;
    publishTime(time); setPosition(time); setPlaying(false); setBuffering(false);
  }, [publishTime]);
  const changeBuffering = useCallback((value: boolean) => {
    try { transport.current?.setBuffering(value); setBuffering(value); } catch (cause) { reportError(String(cause)); }
  }, [reportError]);
  const latestPause = useRef(pause);
  useEffect(() => { latestPause.current = pause; }, [pause]);

  useEffect(() => {
    mounted.current = true;
    void AccessibilityInfo.isScreenReaderEnabled().then((value) => { if (mounted.current) setScreenReader(value); });
    const reader = AccessibilityInfo.addEventListener('screenReaderChanged', setScreenReader);
    const motion = AccessibilityInfo.addEventListener('reduceMotionChanged', setReducedMotion);
    const background = AppState.addEventListener('change', (state) => { if (state !== 'active') { try { latestPause.current(); } catch (cause) { reportError(String(cause)); } } });
    return () => { mounted.current = false; operation.current?.abort(); reader.remove(); motion.remove(); background.remove(); };
  }, [reportError]);

  useEffect(() => {
    if ((!playing && !(__DEV__ && recording)) || !player) return;
    let frame = 0, lastUI = 0, lastSummary = 0;
    transport.current?.setDiagnostics(__DEV__ && recording);
    const tick = (now: number) => {
      try {
        const time = transport.current?.currentTime() ?? 0;
        publishTime(time);
        const index = player.sceneIndex(time);
        if (__DEV__ && recording && transport.current) {
          trace.current.record({ ...transport.current.clockState(), wallMs: performance.now(), rafMs: now, mode: diagnosticMode,
            renderedTime: songTime.value, expectedSceneIndex: index, committedSceneIndex: visualTimeGate.committedScene, sceneCommitPending: visualTimeGate.waitingForCommit });
          if (now - lastSummary >= 500) { lastSummary = now; setTraceSummary(trace.current.summary()); }
        }
        if (now - lastUI >= 250) { lastUI = now; setPosition(time); }
        if (synthetic && time >= duration && transport.current?.playing) ended();
        frame = requestAnimationFrame(tick);
      } catch (cause) { reportError(cause instanceof Error ? cause.message : String(cause)); }
    };
    frame = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(frame); transport.current?.setDiagnostics(false); };
  }, [playing, player, reportError, songTime, publishTime, diagnosticMode, recording, synthetic, duration, ended, visualTimeGate, trace]);

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
      setDiagnosticMode('D'); trace.current.clear(); setTraceSummary(null); setTracePath(null); visualTimeGate.reset();
      setAudioGeneration((value) => value + 1);
      songTime.set(0); setPosition(0); setSceneIndex(0); setLoaded(false); setTrack(prepared);
    } catch (cause) { if (mounted.current && !controller.signal.aborted) setError(cause instanceof Error ? cause.message : String(cause)); }
    finally { operation.current = null; if (mounted.current) { setProgress(null); setPicking(false); setCancelling(false); } }
  };
  const seek = (seconds: number) => {
    try {
      transport.current?.seek(seconds); const time = transport.current?.currentTime() ?? seconds;
      publishTime(time); setPosition(time);
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
      if (mounted.current) {
        const nextScore = mode.simple ? createDiagnosticScore(duration) : prepared.score;
        const time = songTime.value, index = new ScorePlayer(nextScore).sceneIndex(time);
        visualTimeGate.offer(time, index, false); setSceneIndex(index); setTrack(prepared);
      }
    } catch (cause) { if (mounted.current) setError(cause instanceof Error ? cause.message : String(cause)); }
    finally { if (mounted.current) setPicking(false); }
  };
  const toggleDebug = () => {
    const now = performance.now();
    taps.current.count = now - taps.current.time < 650 ? taps.current.count + 1 : 1;
    taps.current.time = now;
    if (taps.current.count === 3) { setDebug((value) => !value); taps.current.count = 0; }
  };
  const selectDiagnosticMode = (nextMode: DiagnosticMode) => {
    if (!__DEV__ || busy || (nextMode !== 'A' && !track)) return;
    try {
      pause(); setError(null); setDiagnosticMode(nextMode);
      const nextModeConfig = DIAGNOSTIC_MODES.find((value) => value.mode === nextMode)!;
      if (nextModeConfig.synthetic) {
        const next = new AudioTransport(duration);
        next.attach(new SyntheticClockSource(duration)); transport.current = next; setLoaded(true);
      } else {
        transport.current = nativeTransport; transport.current?.seek(0);
        setLoaded(!synthetic && loaded);
      }
      visualTimeGate.reset(); songTime.set(0); setPosition(0); setSceneIndex(0);
      trace.current.clear(); setTraceSummary(null); setTracePath(null); setRecording(true);
    } catch (cause) { reportError(String(cause)); }
  };
  const saveTrace = () => {
    if (!__DEV__) return;
    try {
      const file = new File(Paths.document, `v3-clock-${Date.now()}.json`);
      file.write(JSON.stringify({ version: 'v3-clock-trace-1', capturedAt: new Date().toISOString(), mode: diagnosticMode,
        audioHash: track?.analysis.track.hash ?? null, composerVersion: score?.version ?? null,
        evidence: 'JavaScript observations of native or synthetic position and the value supplied to paint; GPU presentation and audible alignment are not measured.',
        summary: trace.current.summary(), samples: trace.current.snapshot() }, null, 2));
      setTracePath(file.uri);
    } catch (cause) { setTracePath(`Trace save failed: ${String(cause)}`); }
  };

  return <View style={styles.root}>
    <StatusBar style="light" hidden={!!score && playing && !busy && !error && !buffering} />
    {score ? <VisualizationBoundary key={`${score.trackHash}-${diagnosticMode}`} fallback={<View style={StyleSheet.absoluteFill} />} onFailure={reportError}>
      <PaintCanvas score={score} sceneIndex={sceneIndex} songTime={songTime} reducedMotion={reducedMotion} />
    </VisualizationBoundary> : null}
    <Pressable style={StyleSheet.absoluteFill} onPress={overlay.toggle} accessible={!!score && playing && !screenReader} accessibilityRole="button" accessibilityLabel={overlay.visible ? 'Hide music controls' : 'Show music controls'} />
    {track && nativeTransport && !synthetic ? <NativeAudio key={audioGeneration} uri={track.uri} transport={nativeTransport}
      onReady={() => { if (transport.current === nativeTransport) setLoaded(true); }}
      onError={(message) => { if (transport.current === nativeTransport) reportError(message); }}
      onEnded={() => { if (transport.current === nativeTransport) ended(); }}
      onBuffering={(value) => { if (transport.current === nativeTransport) changeBuffering(value); }} /> : null}
    {!score ? <SafeAreaView style={styles.initial} pointerEvents="box-none"><View style={styles.welcome}>
      <Text style={styles.brand}>crystallineye</Text><Text style={styles.title}>Watch your music{'\n'}become a painting</Text>
      <ImportButton label={picking ? 'Preparing music…' : 'Import music'} onPress={() => void chooseMusic()} disabled={busy} />
      {error ? <Text style={styles.message} accessibilityLiveRegion="polite">{error}</Text> : null}
    </View></SafeAreaView> : <MinimalPlayerOverlay name={synthetic ? `${mode.mode} · Synthetic diagnostic clock` : track?.name ?? 'Diagnostic brush'} playing={playing} loaded={loaded} busy={busy} loading={!loaded}
      visible={overlay.visible} reducedMotion={reducedMotion} currentTime={position} duration={duration} message={error ?? (buffering ? 'Buffering music…' : !loaded ? 'Preparing playback…' : null)}
      permissionDenied={false} onPermission={() => {}} onInteraction={overlay.touch} onScrubbing={setScrubbing}
      onToggle={toggle} onSeek={seek} onImport={() => void chooseMusic()} />}
    {progress ? <AnalysisProgress progress={progress} cancelling={cancelling} onCancel={() => { operation.current?.abort(); setCancelling(true); }} /> : null}
    {__DEV__ ? <Pressable style={styles.hotspot} onPress={toggleDebug} accessibilityRole="button" accessibilityLabel="Triple tap for developer comparison" /> : null}
    {__DEV__ && debug ? <SafeAreaView style={styles.debug}><ScrollView contentContainerStyle={styles.debugContent}>
      <Text style={styles.devText}>DEV · Score-Driven V3</Text>
      {DIAGNOSTIC_MODES.map((option) => <Pressable key={option.mode} style={styles.devButton} onPress={() => selectDiagnosticMode(option.mode)} disabled={busy || (option.mode !== 'A' && !track)} accessibilityRole="button" accessibilityState={{ selected: diagnosticMode === option.mode }}>
        <Text style={styles.devText}>{diagnosticMode === option.mode ? '● ' : ''}{option.label}</Text>
      </Pressable>)}
      <Pressable style={styles.devButton} onPress={() => { setRecording((value) => !value); }} accessibilityRole="button"><Text style={styles.devText}>{recording ? 'Stop clock trace' : 'Record clock trace'}</Text></Pressable>
      <Pressable style={styles.devButton} onPress={() => { trace.current.clear(); setTraceSummary(null); setTracePath(null); }} accessibilityRole="button"><Text style={styles.devText}>Clear trace</Text></Pressable>
      <Pressable style={styles.devButton} onPress={saveTrace} accessibilityRole="button"><Text style={styles.devText}>Save retained clock trace JSON</Text></Pressable>
      <Text style={styles.devText}>Clock samples retain the latest 1,200 frames. JS frame intervals and supplied paint time do not measure GPU presentation or audible alignment. Close this panel during playback to avoid its layout cost.</Text>
      {traceSummary ? <Text style={styles.devText}>{`${traceSummary.samples} frames · ${traceSummary.retainedSeconds.toFixed(1)}s retained\nJS frame p95 ${traceSummary.p95FrameMs.toFixed(2)}ms · source read p95 ${traceSummary.p95NativeReadMs.toFixed(3)}ms\nNative/supplied paint error max ${traceSummary.maxNativeRenderErrorMs.toFixed(2)}ms\n${JSON.stringify(traceSummary.flags)}`}</Text> : null}
      {tracePath ? <Text style={styles.devText}>{tracePath}</Text> : null}
      {debugFrame ? <Text style={styles.devText}>{`At ${debugFrame.time.toFixed(3)}s · scene ${debugFrame.sceneIndex}\n${debugFrame.brushes.map((brush) => `${brush.strokeId}: x${brush.position.x.toFixed(3)} y${brush.position.y.toFixed(3)} · pressure ${brush.pressure.toFixed(3)} · width ${brush.width.toFixed(4)}`).join('\n') || 'No active brush contact'}`}</Text> : null}
      {renderNodes ? <Text style={styles.devText}>{`Estimated mounted nodes: ${JSON.stringify(renderNodes)}\nCounts come from score/layer geometry, not native profiling.`}</Text> : null}
      {musicalDiagnostics ? <Text style={styles.devText}>{musicalDiagnostics}</Text> : null}
      {score ? <View style={styles.eventNavigation}>
        <Pressable style={styles.devButton} onPress={() => seek([...eventTimes].reverse().find((time) => time < position - 0.001) ?? 0)} accessibilityRole="button"><Text style={styles.devText}>Previous musical/score event</Text></Pressable>
        <Pressable style={styles.devButton} onPress={() => seek(eventTimes.find((time) => time > position + 0.001) ?? duration)} accessibilityRole="button"><Text style={styles.devText}>Next musical/score event</Text></Pressable>
      </View> : null}
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
  eventNavigation: { gap: 4 },
});
