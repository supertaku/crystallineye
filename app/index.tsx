import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useReducedMotion } from 'react-native-reanimated';
import { usePlaybackController } from '../src/audio/playback-controller';
import { useAudioAnalysis } from '../src/audio/use-audio-analysis';
import { FluidInkField, getFluidInkShaderError } from '../src/visualization/FluidInkField';
import { LegacyGradientField } from '../src/visualization/LegacyGradientField';
import { VisualizationBoundary } from '../src/visualization/VisualizationBoundary';
import type { VisualDebugMode, VisualDebugSignal } from '../src/visualization/types';
import { ImportButton } from '../src/components/ImportButton';
import { MinimalPlayerOverlay } from '../src/components/MinimalPlayerOverlay';
import { usePlayerAutoHide } from '../src/components/use-player-auto-hide';
import { DebugOverlay } from '../src/components/DebugOverlay';

export default function MusicScreen() {
  const playback = usePlaybackController();
  const { status } = playback;
  const playing = status.playing && !status.isBuffering && !playback.busy && !playback.importing;
  const analysis = useAudioAnalysis(playback.player, playback.samplingAllowed, status.isLoaded, playing, playback.resetGeneration);
  const systemReducedMotion = useReducedMotion();
  const [reducedMotion, setReducedMotion] = useState(systemReducedMotion);
  const [screenReader, setScreenReader] = useState(false);
  const [scrubbing, setScrubbing] = useState(false);
  const [debug, setDebug] = useState(false);
  const [mode, setMode] = useState<VisualDebugMode>('fluid');
  const [signal, setSignal] = useState<VisualDebugSignal>('audio');
  const [renderError, setRenderError] = useState<string | null>(getFluidInkShaderError);
  const taps = useRef({ count: 0, time: 0 });
  const loading = playback.importing || (!!playback.track && !status.isLoaded && !playback.error);
  const message = playback.error ?? analysis.analysisError ?? (playback.permissionDenied
    ? 'Allow audio permission to see the music move.'
    : analysis.stalled ? 'Audio samples stopped. Pause and retry to restore the visualization.'
      : status.isBuffering ? 'Buffering music…' : loading ? 'Loading music…' : null);
  const overlay = usePlayerAutoHide(playing, scrubbing || loading || !!message || debug || screenReader);

  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isScreenReaderEnabled().then((enabled) => { if (mounted) setScreenReader(enabled); });
    const motion = AccessibilityInfo.addEventListener('reduceMotionChanged', setReducedMotion);
    const reader = AccessibilityInfo.addEventListener('screenReaderChanged', setScreenReader);
    return () => { mounted = false; motion.remove(); reader.remove(); };
  }, []);

  const importMusic = () => { overlay.touch(); setScrubbing(false); analysis.freeze(); void playback.chooseAudio(); };
  const toggleDebug = () => {
    const now = performance.now();
    taps.current.count = now - taps.current.time < 650 ? taps.current.count + 1 : 1;
    taps.current.time = now;
    if (taps.current.count === 3) {
      setDebug((shown) => !shown); setSignal('audio'); taps.current.count = 0;
    }
  };

  return (
    <View style={styles.root}>
      <StatusBar style="light" hidden={!!playback.track && status.playing && !loading && !message} />
      <VisualizationBoundary fallback={<VisualizationBoundary><LegacyGradientField visible={analysis.visible} /></VisualizationBoundary>} onFailure={setRenderError}>
        <FluidInkField target={analysis.target} visible={analysis.visible} active={analysis.active} fps={analysis.fps}
          playing={playing} reducedMotion={reducedMotion} mode={__DEV__ ? mode : 'fluid'}
          signal={__DEV__ && debug ? signal : 'audio'} preview={__DEV__ && debug && !playback.track} />
      </VisualizationBoundary>
      <Pressable style={StyleSheet.absoluteFill} onPress={overlay.toggle} accessible={!!playback.track && playing && !screenReader} accessibilityRole="button"
        accessibilityLabel={overlay.visible ? 'Hide music controls' : 'Show music controls'} />
      {!playback.track ? (
        <SafeAreaView style={styles.initial} pointerEvents="box-none">
          <View style={styles.importContent}>
            <Text style={styles.brand}>crystallineye</Text>
            <Text style={styles.title}>Experience music{'\n'}through color</Text>
            <ImportButton label="Import music" onPress={importMusic} disabled={loading} />
            {message ? <Text style={styles.message} accessibilityLiveRegion="polite">{message}</Text> : null}
          </View>
        </SafeAreaView>
      ) : (
        <MinimalPlayerOverlay name={playback.track.name} playing={status.playing} loaded={status.isLoaded} busy={playback.busy}
          loading={loading} visible={overlay.visible} reducedMotion={reducedMotion} currentTime={status.currentTime} duration={status.duration}
          message={message} permissionDenied={playback.permissionDenied} onInteraction={overlay.touch} onScrubbing={setScrubbing}
          onToggle={() => { overlay.touch(); analysis.freeze(); void playback.togglePlayback(); }}
          onSeek={(seconds) => { analysis.freeze(); void playback.seek(seconds); }} onImport={importMusic}
          onPermission={() => { overlay.touch(); void playback.requestPermission(); }} />
      )}
      {__DEV__ ? <Pressable style={styles.hotspot} onPress={toggleDebug} accessibilityRole="button" accessibilityLabel="Triple tap for developer diagnostics" /> : null}
      {__DEV__ && debug ? <SafeAreaView style={styles.debug} pointerEvents="box-none">
        <DebugOverlay data={analysis.diagnostics} fps={analysis.fps} visual={analysis.visible} shaderError={renderError} mode={mode} signal={signal}
          onMode={setMode} onSignal={setSignal} onClose={() => { setDebug(false); setSignal('audio'); }} />
      </SafeAreaView> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#221c35' },
  initial: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, justifyContent: 'center', alignItems: 'center', padding: 28 },
  importContent: { alignItems: 'center', gap: 32, maxWidth: 420 },
  brand: { color: '#e0d8ec', fontSize: 14, letterSpacing: 3 },
  title: { color: '#fff', fontSize: 30, lineHeight: 40, fontWeight: '400', textAlign: 'center' },
  message: { color: '#fff', backgroundColor: 'rgba(12,10,21,0.9)', padding: 16, borderRadius: 12, textAlign: 'center', lineHeight: 22 },
  hotspot: { position: 'absolute', top: 28, right: 0, width: 52, height: 52 },
  debug: { position: 'absolute', top: 64, left: 12, right: 12, maxHeight: '65%' },
});
