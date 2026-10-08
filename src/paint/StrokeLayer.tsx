import { memo, useMemo } from 'react';
import { Group, Path, Shader, Skia } from '@shopify/react-native-skia';
import { useDerivedValue, type SharedValue } from 'react-native-reanimated';
import type { SceneEvent, StrokeEvent } from '../visual-score/schema';
import { eventProgress, markOpacity, strokeSegments, type CubicSegment } from './scene-runtime';
import { DiffusionLayer } from './DiffusionLayer';
import { PIGMENT_SKSL } from './shaders/pigment.sksl';

const pigment = Skia.RuntimeEffect.Make(PIGMENT_SKSL);

function StrokeSegment({ segment, scene, time, width, height, reducedMotion }: { segment: CubicSegment; scene: SceneEvent; time: SharedValue<number>; width: number; height: number; reducedMotion: boolean }) {
  const path = useMemo(() => {
    const result = Skia.PathBuilder.Make();
    result.moveTo(segment.from.x * width, segment.from.y * height);
    result.cubicTo(segment.control1.x * width, segment.control1.y * height, segment.control2.x * width, segment.control2.y * height, segment.to.x * width, segment.to.y * height);
    return result.detach();
  }, [segment, width, height]);
  const progress = useDerivedValue(() => eventProgress(segment.start, segment.end, time.value));
  const opacity = useDerivedValue(() => markOpacity(scene, segment.start, time.value) * segment.opacity);
  const strandOpacity = useDerivedValue(() => opacity.value * 0.2);
  const pressure = segment.width * Math.min(width, height);
  const pigmentUniforms = useMemo(() => ({ inkColor: Array.from(Skia.Color(segment.color)), seed: scene.seed % 65536,
    dryness: scene.brushStyle === 'dry' ? 0.72 : 0.32 }), [segment.color, scene.seed, scene.brushStyle]);
  return <Group>
    <DiffusionLayer path={path} progress={progress} time={time} scene={scene} createdAt={segment.start} color={segment.color} width={pressure} reducedMotion={reducedMotion} />
    <Path path={path} end={progress} style="stroke" strokeWidth={pressure} strokeCap="round" strokeJoin="round" color={segment.color} opacity={opacity}>
      {pigment ? <Shader source={pigment} uniforms={pigmentUniforms} /> : null}
    </Path>
    <Path path={path} end={progress} style="stroke" strokeWidth={pressure * 0.17} strokeCap="round" color={segment.color} opacity={strandOpacity} />
  </Group>;
}
function StrokeMark({ stroke, ...props }: { stroke: StrokeEvent; scene: SceneEvent; time: SharedValue<number>; width: number; height: number; reducedMotion: boolean }) {
  const segments = useMemo(() => strokeSegments(stroke.points), [stroke]);
  return <Group>{segments.map((segment, index) => <StrokeSegment key={index} segment={segment} {...props} />)}</Group>;
}
export const StrokeLayer = memo(function StrokeLayer({ strokes, ...props }: { strokes: StrokeEvent[]; scene: SceneEvent; time: SharedValue<number>; width: number; height: number; reducedMotion: boolean }) {
  return <Group>{strokes.map((stroke) => <StrokeMark key={stroke.id} stroke={stroke} {...props} />)}</Group>;
});
