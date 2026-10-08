import { memo } from 'react';
import { Blur, Circle, Group } from '@shopify/react-native-skia';
import { useDerivedValue, type SharedValue } from 'react-native-reanimated';
import type { DropEvent, SceneEvent } from '../visual-score/schema';
import { markOpacity } from './scene-runtime';

function InkDrop({ drop, scene, time, width, height, reducedMotion }: { drop: DropEvent; scene: SceneEvent; time: SharedValue<number>; width: number; height: number; reducedMotion: boolean }) {
  const base = drop.radius * Math.min(width, height);
  const radius = useDerivedValue(() => base * (1 + (reducedMotion ? 0 : Math.min(1, Math.max(0, time.value - drop.time) / 3) * 0.7)));
  const opacity = useDerivedValue(() => markOpacity(scene, drop.time, time.value) * Math.max(0, 1 - (time.value - drop.time) / 14) * drop.strength * 0.55);
  return <Group>
    <Circle cx={drop.position.x * width} cy={drop.position.y * height} r={radius} color={drop.color} opacity={opacity}><Blur blur={2} /></Circle>
    <Circle cx={drop.position.x * width} cy={drop.position.y * height} r={base * 0.4} color={drop.color} opacity={opacity} />
  </Group>;
}
export const DropLayer = memo(function DropLayer({ drops, ...props }: { drops: DropEvent[]; scene: SceneEvent; time: SharedValue<number>; width: number; height: number; reducedMotion: boolean }) {
  return <Group>{drops.map((drop) => <InkDrop key={drop.id} drop={drop} {...props} />)}</Group>;
});
