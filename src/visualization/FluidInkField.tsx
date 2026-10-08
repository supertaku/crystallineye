import { memo, useEffect } from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';
import { Canvas, Fill, Shader, Skia, type SkRuntimeEffect } from '@shopify/react-native-skia';
import { useDerivedValue, useFrameCallback, useSharedValue, type SharedValue } from 'react-native-reanimated';
import { FLUID_INK_SKSL } from './shaders/fluid-ink.sksl';
import { shaderUniforms } from './shader-uniforms';
import { advanceVisual } from './visual-frame';
import { LegacyGradientField } from './LegacyGradientField';
import { debugVisualTarget } from './debug-signals';
import type { MusicVisualState, VisualDebugMode, VisualDebugSignal } from './types';

let effect: SkRuntimeEffect | null = null;
let shaderError: string | null = null;
// Exactly one compilation attempt, including failures, at module initialization.
try {
  effect = Skia.RuntimeEffect.Make(FLUID_INK_SKSL);
  if (!effect) shaderError = 'Fluid ink shader compilation returned null; using Legacy Gradient.';
} catch (cause) {
  shaderError = `Fluid ink shader failed: ${cause instanceof Error ? cause.message : String(cause)}`;
}
export function getFluidInkShaderError() { return shaderError; }

type Props = {
  target: SharedValue<MusicVisualState>; visible: SharedValue<MusicVisualState>;
  active: SharedValue<boolean>; fps: SharedValue<number>; playing: boolean; reducedMotion: boolean;
  mode?: VisualDebugMode; signal?: VisualDebugSignal; preview?: boolean;
};

export const FluidInkField = memo(function FluidInkField({ target, visible, active, fps, playing, reducedMotion, mode = 'fluid', signal = 'audio', preview = false }: Props) {
  const { width, height } = useWindowDimensions();
  const elapsed = useSharedValue(0);
  const frames = useSharedValue(0);
  const targetStamp = useSharedValue(-Infinity);
  const targetAge = useSharedValue(0);
  const debugTime = useSharedValue(0);
  const manual = __DEV__ && signal !== 'audio';
  const frameCallback = useFrameCallback((frame) => {
    'worklet';
    if (!active.value && !manual) return;
    const rawMs = frame.timeSincePreviousFrame ?? 16.67;
    const dt = Math.min(0.05, rawMs / 1000);
    debugTime.value += dt;
    const next = manual ? debugVisualTarget(target.value, signal, debugTime.value) : target.value;
    if (next.timestamp !== targetStamp.value) { targetStamp.value = next.timestamp; targetAge.value = 0; }
    else targetAge.value += dt;
    visible.value = advanceVisual(visible.value, next, dt, targetAge.value, reducedMotion);
    elapsed.value += rawMs; frames.value++;
    if (elapsed.value >= 1000) {
      fps.value = frames.value * 1000 / elapsed.value;
      frames.value = 0; elapsed.value = 0;
    }
  }, false);

  useEffect(() => {
    frameCallback.setActive(playing || (__DEV__ && preview && manual));
    if (!playing && !preview) { elapsed.value = 0; frames.value = 0; fps.value = 0; }
    return () => frameCallback.setActive(false);
  }, [frameCallback, playing, preview, manual, elapsed, frames, fps]);

  const uniforms = useDerivedValue(() => shaderUniforms(visible.value, width, height, reducedMotion, __DEV__ ? mode : 'fluid'));
  if (!effect || (__DEV__ && mode === 'legacy')) return <LegacyGradientField visible={visible} />;
  return (
    <Canvas style={StyleSheet.absoluteFill} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Fill><Shader source={effect} uniforms={uniforms} /></Fill>
    </Canvas>
  );
});
