import { memo } from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';
import { Canvas, LinearGradient, Rect, vec } from '@shopify/react-native-skia';
import { useDerivedValue, type SharedValue } from 'react-native-reanimated';
import type { MusicVisualState } from './types';

export const LegacyGradientField = memo(function LegacyGradientField({ visible }: { visible: SharedValue<MusicVisualState> }) {
  const { width, height } = useWindowDimensions();
  const colors = useDerivedValue(() => {
    const palette = visible.value.palette.map((rgb) => '#' + rgb.map((value) => Math.round(value * 255).toString(16).padStart(2, '0')).join(''));
    return [palette[0]!, palette[0]!, palette[1]!, palette[2]!];
  });
  const positions = useDerivedValue(() => {
    const state = visible.value;
    const total = state.spectralLow + state.spectralMid + state.spectralHigh + 0.24;
    return [0, (state.spectralLow + 0.08) / total * 0.9, (state.spectralLow + state.spectralMid + 0.16) / total * 0.9, 1];
  });
  return (
    <Canvas style={StyleSheet.absoluteFill} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Rect x={0} y={0} width={width} height={height}>
        <LinearGradient start={vec(0, height)} end={vec(width, 0)} colors={colors} positions={positions} />
      </Rect>
    </Canvas>
  );
});
