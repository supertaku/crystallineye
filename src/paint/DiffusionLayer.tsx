import { Blur, Path, type SkPath } from '@shopify/react-native-skia';
import { useDerivedValue, type SharedValue } from 'react-native-reanimated';
import type { SceneEvent } from '../visual-score/schema';
import { markOpacity } from './scene-runtime';

export function DiffusionLayer({ path, progress, time, scene, createdAt, color, width, reducedMotion }: {
  path: SkPath; progress: SharedValue<number>; time: SharedValue<number>; scene: SceneEvent; createdAt: number; color: string; width: number; reducedMotion: boolean;
}) {
  const opacity = useDerivedValue(() => markOpacity(scene, createdAt, time.value) * 0.055);
  const blur = useDerivedValue(() => reducedMotion ? 2 : Math.min(6, 1.5 + Math.max(0, time.value - createdAt) * 0.08));
  return <Path path={path} end={progress} style="stroke" strokeWidth={width * 1.7} strokeCap="round" color={color} opacity={opacity}><Blur blur={blur} /></Path>;
}
