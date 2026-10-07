import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Slider from '@react-native-community/slider';

export function formatTime(seconds: number) {
  const total = Math.floor(Math.max(0, Number.isFinite(seconds) ? seconds : 0));
  return `${Math.floor(total / 60).toString().padStart(2, '0')}:${(total % 60).toString().padStart(2, '0')}`;
}

type Props = { name: string; playing: boolean; loaded: boolean; busy: boolean; currentTime: number; duration: number; onToggle: () => void; onSeek: (seconds: number) => void };

export function PlaybackControls({ name, playing, loaded, busy, currentTime, duration, onToggle, onSeek }: Props) {
  const [scrubbing, setScrubbing] = useState<number | null>(null);
  const disabled = !loaded || busy;
  return (
    <View style={styles.panel}>
      <Text style={styles.name} numberOfLines={2}>{name}</Text>
      <Text style={styles.time}>{formatTime(scrubbing ?? currentTime)} / {formatTime(duration)}</Text>
      <Slider style={styles.slider} minimumValue={0} maximumValue={Math.max(0.01, duration)} value={scrubbing ?? currentTime}
        disabled={disabled} minimumTrackTintColor="#f4efff" maximumTrackTintColor="#817b91" thumbTintColor="#fff"
        accessibilityLabel="Playback position" accessibilityRole="adjustable"
        accessibilityValue={{ min: 0, max: duration, now: scrubbing ?? currentTime, text: `${formatTime(scrubbing ?? currentTime)} of ${formatTime(duration)}` }}
        onSlidingStart={() => setScrubbing(currentTime)} onValueChange={setScrubbing}
        onSlidingComplete={(seconds) => { setScrubbing(null); onSeek(seconds); }} />
      <View style={styles.row}>
        <Pressable style={styles.secondary} onPress={() => onSeek(0)} disabled={disabled} accessibilityRole="button" accessibilityLabel="Restart song" accessibilityState={{ disabled }}>
          <Text style={styles.secondaryText}>Restart</Text>
        </Pressable>
        <Pressable style={[styles.play, disabled && styles.dim]} onPress={onToggle} disabled={disabled} accessibilityRole="button" accessibilityLabel={playing ? 'Pause music' : 'Play music'} accessibilityState={{ disabled }}>
          <Text style={styles.playText}>{busy ? 'Wait…' : playing ? 'Pause' : 'Play'}</Text>
        </Pressable>
        <Pressable style={styles.secondary} onPress={() => onSeek(Math.min(duration, currentTime + 10))} disabled={disabled} accessibilityRole="button" accessibilityLabel="Seek forward 10 seconds" accessibilityState={{ disabled }}>
          <Text style={styles.secondaryText}>+10 sec</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { width: '100%', maxWidth: 460, borderRadius: 24, padding: 22, backgroundColor: 'rgba(12,10,21,0.9)' },
  name: { fontSize: 19, color: '#fff', textAlign: 'center', fontWeight: '500' },
  time: { color: '#d9d3e7', textAlign: 'center', marginTop: 14, fontVariant: ['tabular-nums'], fontSize: 14 },
  slider: { height: 48, width: '100%', marginTop: 4 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  play: { borderRadius: 28, minWidth: 110, minHeight: 54, paddingHorizontal: 24, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f7f4ff' },
  playText: { color: '#211c30', fontWeight: '600', fontSize: 16 },
  secondary: { minHeight: 48, minWidth: 64, justifyContent: 'center', alignItems: 'center' },
  secondaryText: { color: '#e4ddef', fontSize: 13 },
  dim: { opacity: 0.5 },
});
