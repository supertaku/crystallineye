import { memo, useEffect } from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';
import { Canvas, LinearGradient, Rect, vec } from '@shopify/react-native-skia';
import { useDerivedValue, useFrameCallback, useSharedValue, type SharedValue } from 'react-native-reanimated';
import type { VisualState } from '../color/types';
import { limitVisual } from '../color/safety-limiter';
import { oklchToHex } from '../color/oklch';

type Props = {
  target: SharedValue<VisualState>;
  visible: SharedValue<VisualState>;
  active: SharedValue<boolean>;
  fps: SharedValue<number>;
  playing: boolean;
};

export const MusicColorField = memo(function MusicColorField({ target, visible, active, fps, playing }: Props) {
  const { width, height } = useWindowDimensions();
  const elapsed = useSharedValue(0);
  const frames = useSharedValue(0);
  const frameCallback = useFrameCallback((frame) => {
    'worklet';
    if (!active.value) return;
    const dt = Math.min(0.05, (frame.timeSincePreviousFrame ?? 16.67) / 1000);
    const alpha = 1 - Math.exp(-dt / 0.05);
    const current = visible.value;
    const next = target.value;
    const interpolated: VisualState = {
      colors: next.colors.map((color, i) => ({
        lightness: current.colors[i]!.lightness + alpha * (color.lightness - current.colors[i]!.lightness),
        chroma: current.colors[i]!.chroma + alpha * (color.chroma - current.colors[i]!.chroma),
        hue: color.hue,
      })) as VisualState['colors'],
      weights: next.weights.map((value, i) => current.weights[i]! + alpha * (value - current.weights[i]!)) as VisualState['weights'],
    };
    visible.value = limitVisual(interpolated, current, dt);
    elapsed.value += frame.timeSincePreviousFrame ?? 16.67;
    frames.value++;
    if (elapsed.value >= 1000) {
      fps.value = frames.value * 1000 / elapsed.value;
      frames.value = 0;
      elapsed.value = 0;
    }
  }, false);

  useEffect(() => {
    frameCallback.setActive(playing);
    if (!playing) { elapsed.value = 0; frames.value = 0; }
    return () => frameCallback.setActive(false);
  }, [frameCallback, playing, elapsed, frames]);

  const colors = useDerivedValue(() => {
    const [low, mid, high] = visible.value.colors.map(oklchToHex);
    return [low!, low!, mid!, high!];
  });
  const positions = useDerivedValue(() => {
    const [low, mid] = visible.value.weights;
    return [0, low * 0.9, (low + mid) * 0.9, 1];
  });

  return (
    <Canvas style={StyleSheet.absoluteFill} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Rect x={0} y={0} width={width} height={height}>
        <LinearGradient start={vec(0, height)} end={vec(width, 0)} colors={colors} positions={positions} />
      </Rect>
    </Canvas>
  );
});
