import { useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { usePlaybackController } from '../src/audio/playback-controller';
import { useAudioAnalysis } from '../src/audio/use-audio-analysis';
import { MusicColorField } from '../src/visualization/MusicColorField';
import { VisualizationBoundary } from '../src/visualization/VisualizationBoundary';
import { ImportButton } from '../src/components/ImportButton';
import { PlaybackControls } from '../src/components/PlaybackControls';
import { DebugOverlay } from '../src/components/DebugOverlay';

export default function MusicScreen() {
  const playback = usePlaybackController();
  const { status } = playback;
  const analysis = useAudioAnalysis(playback.player, playback.samplingAllowed, status.isLoaded, status.playing && !status.isBuffering && !playback.busy && !playback.importing, playback.resetGeneration);
  const [debug, setDebug] = useState(false);
  const loading = playback.importing || (!!playback.track && !status.isLoaded && !playback.error);
  const message = playback.error ?? analysis.analysisError ?? (playback.permissionDenied
    ? 'Music can play. Allow audio permission to enable music colors.'
    : analysis.stalled ? 'Music is playing, but this device is not delivering audio samples. Pause and retry.'
      : status.isBuffering ? 'Buffering music…' : null);

  return (
    <View style={styles.root}>
      <VisualizationBoundary>
        <MusicColorField target={analysis.target} visible={analysis.visible} active={analysis.active} fps={analysis.fps} playing={status.playing && !status.isBuffering && !playback.busy && !playback.importing} />
      </VisualizationBoundary>
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.header}>
            <Text style={styles.brand}>MUSIC IN COLOR</Text>
            {__DEV__ ? <Pressable style={styles.devButton} onPress={() => setDebug((value) => !value)} accessibilityRole="button" accessibilityLabel={debug ? 'Hide audio diagnostics' : 'Show audio diagnostics'}><Text style={styles.devText}>DEV</Text></Pressable> : null}
          </View>
          {debug ? <DebugOverlay data={analysis.diagnostics} fps={analysis.fps} /> : null}
          <View style={styles.space} />
          {!playback.track ? (
            <View style={styles.initial}>
              <Text style={styles.title}>Experience music{ '\n' }through color</Text>
              <Text style={styles.description}>Choose a song from your device.</Text>
              <ImportButton onPress={() => { analysis.freeze(); void playback.chooseAudio(); }} disabled={loading} />
            </View>
          ) : (
            <View style={styles.player}>
              <Text style={styles.state}>{loading ? 'Loading music…' : status.playing ? 'Playing' : status.didJustFinish ? 'Finished' : status.currentTime > 0 ? 'Paused' : 'Ready to play'}</Text>
              {loading ? <ActivityIndicator color="#fff" style={styles.spinner} accessibilityLabel="Loading music" /> : null}
              <PlaybackControls name={playback.track.name} loaded={status.isLoaded && !loading} playing={status.playing} busy={playback.busy} currentTime={status.currentTime} duration={status.duration}
                onToggle={() => { analysis.freeze(); void playback.togglePlayback(); }} onSeek={(seconds) => { analysis.freeze(); void playback.seek(seconds); }} />
              <Pressable style={styles.textButton} disabled={playback.busy || loading} onPress={() => { analysis.freeze(); void playback.chooseAudio(); }} accessibilityRole="button" accessibilityLabel="Import another music file"><Text style={styles.link}>Import another song</Text></Pressable>
            </View>
          )}
          {message ? <Text style={styles.message} accessibilityLiveRegion="polite">{message}</Text> : null}
          {playback.permissionDenied ? <Pressable style={styles.textButton} disabled={playback.busy} onPress={() => void playback.requestPermission()} accessibilityRole="button" accessibilityLabel="Retry audio permission" accessibilityState={{ disabled: playback.busy }}><Text style={styles.link}>Allow audio analysis</Text></Pressable> : null}
          {playback.track && playback.samplingAllowed && Platform.OS === 'android' && !message ? <Text style={styles.note}>Waveform colors · Hz bands unavailable on Android</Text> : null}
          <View style={styles.space} />
          <Text style={styles.footer}>Audio stays on your device. Smooth visuals by default.</Text>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#221c35' },
  safe: { flex: 1 },
  content: { flexGrow: 1, padding: 24, alignItems: 'center', gap: 16 },
  header: { width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brand: { color: '#fff', fontSize: 12, letterSpacing: 2, backgroundColor: 'rgba(12,10,21,0.85)', padding: 12, borderRadius: 12 },
  devButton: { minHeight: 48, minWidth: 48, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(12,10,21,0.85)', borderRadius: 12 },
  devText: { color: '#ddd6ed', fontSize: 11 },
  space: { flexGrow: 1, minHeight: 16 },
  initial: { alignItems: 'center', gap: 26, padding: 24, borderRadius: 24, backgroundColor: 'rgba(12,10,21,0.82)', width: '100%', maxWidth: 460 },
  title: { color: '#fff', fontSize: 29, lineHeight: 39, fontWeight: '500', textAlign: 'center' },
  description: { color: '#d9d3e7', fontSize: 15, textAlign: 'center' },
  player: { width: '100%', alignItems: 'center', gap: 12 },
  state: { color: '#fff', fontSize: 13, padding: 10, backgroundColor: 'rgba(12,10,21,0.85)', borderRadius: 12 },
  spinner: { padding: 12 },
  textButton: { minHeight: 48, paddingHorizontal: 18, justifyContent: 'center', borderRadius: 24, backgroundColor: 'rgba(12,10,21,0.85)' },
  link: { color: '#eee7ff', textAlign: 'center', fontSize: 14 },
  message: { color: '#fff', backgroundColor: 'rgba(12,10,21,0.94)', padding: 16, borderRadius: 12, textAlign: 'center', lineHeight: 22, width: '100%', maxWidth: 460 },
  note: { color: '#e2dbea', backgroundColor: 'rgba(12,10,21,0.85)', padding: 10, borderRadius: 12, fontSize: 11, textAlign: 'center' },
  footer: { color: '#ddd6e8', backgroundColor: 'rgba(12,10,21,0.85)', padding: 10, borderRadius: 12, fontSize: 11, textAlign: 'center', lineHeight: 17 },
});
