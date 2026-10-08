import { memo } from 'react';
import { Circle, Group, RadialGradient, vec } from '@shopify/react-native-skia';
import { useDerivedValue, type SharedValue } from 'react-native-reanimated';
import type { SceneEvent, WashEvent } from '../visual-score/schema';
import { eventProgress, markOpacity } from './scene-runtime';

function HarmonicWash({ wash, scene, time, width, height, reducedMotion }: { wash: WashEvent; scene: SceneEvent; time: SharedValue<number>; width: number; height: number; reducedMotion: boolean }) {
  const center = vec(wash.position.x * width, wash.position.y * height);
  const base = wash.radius * Math.min(width, height);
  const radius = useDerivedValue(() => base * (1 + (reducedMotion ? 0 : Math.min(8, Math.max(0, time.value - wash.start)) * wash.flow)));
  const opacity = useDerivedValue(() => markOpacity(scene, wash.start, time.value) * eventProgress(wash.start, wash.start + 2, time.value)
    * Math.max(0, 1 - Math.max(0, time.value - wash.end) / 12) * wash.opacity);
  return <Circle cx={center.x} cy={center.y} r={radius} opacity={opacity}>
    <RadialGradient c={center} r={radius} colors={[wash.color, `${wash.color}00`]} />
  </Circle>;
}
export const WashLayer = memo(function WashLayer({ washes, ...props }: { washes: WashEvent[]; scene: SceneEvent; time: SharedValue<number>; width: number; height: number; reducedMotion: boolean }) {
  return <Group>{washes.map((wash) => <HarmonicWash key={wash.id} wash={wash} {...props} />)}</Group>;
});
