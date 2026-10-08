import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import Slider from '@react-native-community/slider';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { VISUAL_CONFIG } from '../config';
import { formatTime } from './PlaybackControls';

type Props = {
  name: string; playing: boolean; loaded: boolean; busy: boolean; loading: boolean;
  visible: boolean; reducedMotion: boolean; currentTime: number; duration: number;
  message: string | null; permissionDenied: boolean;
  onToggle: () => void; onSeek: (seconds: number) => void; onImport: () => void;
  onPermission: () => void; onInteraction: () => void; onScrubbing: (value: boolean) => void;
};

export function MinimalPlayerOverlay(props: Props) {
  const { name, playing, loaded, busy, loading, visible, reducedMotion, currentTime, duration, message, permissionDenied,
    onToggle, onSeek, onImport, onPermission, onInteraction, onScrubbing } = props;
  const insets = useSafeAreaInsets();
  const [scrub, setScrub] = useState<number | null>(null);
  const progress = useSharedValue(1);
  useEffect(() => {
    progress.value = withTiming(visible ? 1 : 0, { duration: reducedMotion ? 0 : VISUAL_CONFIG.playerTransitionMs });
  }, [visible, reducedMotion, progress]);
  const style = useAnimatedStyle(() => ({ opacity: progress.value, transform: [{ translateY: (1 - progress.value) * VISUAL_CONFIG.playerHiddenTranslation }] }));
  const disabled = !loaded || busy || loading;
  return (
    <Animated.View style={[styles.overlay, { paddingBottom: Math.max(16, insets.bottom) }, style]}
      pointerEvents={visible ? 'auto' : 'none'} accessibilityElementsHidden={!visible} importantForAccessibility={visible ? 'auto' : 'no-hide-descendants'}
      onTouchStart={onInteraction} onTouchCancel={() => { setScrub(null); onScrubbing(false); }}>
      {message ? <Text style={styles.message} accessibilityLiveRegion="polite">{message}</Text> : null}
      {permissionDenied ? <Pressable style={styles.permission} onPress={onPermission} disabled={busy} accessibilityRole="button" accessibilityLabel="Allow audio analysis"><Text style={styles.small}>Allow audio analysis</Text></Pressable> : null}
      <View style={styles.titleRow}>
        <Text style={styles.title} numberOfLines={1}>{name}</Text>
        <Pressable style={styles.replace} onPress={onImport} disabled={busy || loading} accessibilityRole="button" accessibilityLabel="Replace music file" accessibilityState={{ disabled: busy || loading }}><Text style={styles.small}>Replace</Text></Pressable>
      </View>
      <Slider style={styles.slider} minimumValue={0} maximumValue={Math.max(0.01, duration)} value={scrub ?? currentTime}
        disabled={disabled} minimumTrackTintColor="#f2eefa" maximumTrackTintColor="#6a6574" thumbTintColor="#fff"
        accessibilityLabel="Playback position" accessibilityRole="adjustable"
        accessibilityValue={{ min: 0, max: duration, now: scrub ?? currentTime, text: `${formatTime(scrub ?? currentTime)} of ${formatTime(duration)}` }}
        onSlidingStart={() => { onInteraction(); onScrubbing(true); setScrub(currentTime); }}
        onValueChange={(value) => { onInteraction(); setScrub(value); }}
        onSlidingComplete={(value) => { onSeek(value); setScrub(null); onScrubbing(false); onInteraction(); }} />
      <View style={styles.timeRow}><Text style={styles.time}>{formatTime(scrub ?? currentTime)}</Text><Text style={styles.time}>{formatTime(duration)}</Text></View>
      <Pressable style={[styles.play, disabled && styles.dim]} onPress={onToggle} disabled={disabled} accessibilityRole="button"
        accessibilityLabel={playing ? 'Pause music' : 'Play music'} accessibilityState={{ disabled }}>
        {loading || busy ? <ActivityIndicator color="#fff" accessibilityLabel="Loading music" /> : <Text style={styles.playGlyph}>{playing ? 'Ⅱ' : '▶'}</Text>}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 24, paddingTop: 8, backgroundColor: 'rgba(10,8,18,0.72)' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  title: { flex: 1, color: '#fff', fontSize: 15, fontWeight: '500' },
  replace: { minHeight: 48, minWidth: 64, justifyContent: 'center', alignItems: 'flex-end' },
  small: { color: '#e5dfef', fontSize: 13 },
  slider: { height: 44, marginHorizontal: -8 },
  timeRow: { flexDirection: 'row', justifyContent: 'space-between' },
  time: { color: '#ddd7e8', fontSize: 11, fontVariant: ['tabular-nums'] },
  play: { alignSelf: 'center', width: 60, height: 52, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  playGlyph: { color: '#fff', fontSize: 25, fontWeight: '600' },
  dim: { opacity: 0.45 },
  message: { color: '#fff', fontSize: 13, lineHeight: 19, paddingVertical: 12 },
  permission: { minHeight: 48, justifyContent: 'center' },
});
