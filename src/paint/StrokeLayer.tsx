import { memo, useMemo } from 'react';
import { Group, Path, Shader, Skia } from '@shopify/react-native-skia';
import { useDerivedValue, type SharedValue } from 'react-native-reanimated';
import type { AccentEvent, SceneEvent, StrokeEvent } from '../visual-score/schema';
import { markOpacity, prepareStrokeGeometry, revealedCubicsAt, ribbonPolygonAt, type CubicSegment, type PigmentRun, type StrokeGeometry } from './scene-runtime';
import { DiffusionLayer } from './DiffusionLayer';
import { PIGMENT_SKSL } from './shaders/pigment.sksl';

const pigment = Skia.RuntimeEffect.Make(PIGMENT_SKSL);
const EMPTY_ACCENTS: AccentEvent[] = [];

function centerlinePath(segments: CubicSegment[], width: number, height: number) {
  'worklet';
  const builder = Skia.PathBuilder.Make();
  if (segments.length) {
    builder.moveTo(segments[0]!.from.x * width, segments[0]!.from.y * height);
    for (const segment of segments) builder.cubicTo(segment.control1.x * width, segment.control1.y * height,
      segment.control2.x * width, segment.control2.y * height, segment.to.x * width, segment.to.y * height);
  }
  return builder.detach();
}
function ribbonPath(stroke: StrokeEvent, geometry: StrokeGeometry, run: PigmentRun, time: number, width: number, height: number, accents: AccentEvent[]) {
  'worklet';
  const polygon = ribbonPolygonAt(stroke, geometry, run, time, width, height, accents), builder = Skia.PathBuilder.Make();
  if (polygon.length) {
    builder.moveTo(polygon[0]!.x, polygon[0]!.y);
    for (let index = 1; index < polygon.length; index++) builder.lineTo(polygon[index]!.x, polygon[index]!.y);
    builder.close();
  }
  return builder.detach();
}

type StrokeProps = { stroke: StrokeEvent; scene: SceneEvent; time: SharedValue<number>; width: number; height: number; reducedMotion: boolean; accents: AccentEvent[]; simple: boolean };

function PigmentMark({ stroke, geometry, run, scene, time, width, height, accents, simple }: StrokeProps & { geometry: StrokeGeometry; run: PigmentRun }) {
  const full = useMemo(() => ribbonPath(stroke, geometry, run, run.end, width, height, accents), [stroke, geometry, run, width, height, accents]);
  const empty = useMemo(() => Skia.PathBuilder.Make().detach(), []);
  const path = useDerivedValue(() => time.value <= run.start ? empty : time.value >= run.end ? full
    : ribbonPath(stroke, geometry, run, time.value, width, height, accents));
  const opacity = useDerivedValue(() => markOpacity(scene, run.start, time.value) * run.opacity);
  const uniforms = useMemo(() => ({ inkColor: Array.from(Skia.Color(run.color)), seed: scene.seed % 65536,
    dryness: scene.brushStyle === 'dry' ? 0.72 : 0.32 }), [run.color, scene.seed, scene.brushStyle]);
  return <Path path={path} style="fill" color={run.color} opacity={opacity}>
    {!simple && pigment ? <Shader source={pigment} uniforms={uniforms} /> : null}
  </Path>;
}

function StrokeMark(props: StrokeProps) {
  const { stroke, scene, time, width, height, reducedMotion, accents, simple } = props;
  const geometry = useMemo(() => prepareStrokeGeometry(stroke, accents), [stroke, accents]);
  const full = useMemo(() => centerlinePath(geometry.segments, width, height), [geometry, width, height]);
  const empty = useMemo(() => Skia.PathBuilder.Make().detach(), []);
  const path = useDerivedValue(() => time.value <= stroke.start ? empty : time.value >= stroke.end ? full
    : centerlinePath(revealedCubicsAt(geometry.segments, time.value), width, height));
  const progress = useDerivedValue(() => 1);
  const strandOpacity = useDerivedValue(() => markOpacity(scene, stroke.start, time.value) * geometry.meanOpacity * 0.2);
  const color = stroke.points[0]?.color ?? scene.palette.ink;
  const baseWidth = geometry.meanWidth * Math.min(width, height);
  return <Group>
    {!simple && <DiffusionLayer path={path} progress={progress} time={time} scene={scene} createdAt={stroke.start} color={color} width={baseWidth} reducedMotion={reducedMotion} />}
    {geometry.runs.map((run, index) => <PigmentMark key={index} {...props} geometry={geometry} run={run} />)}
    {!simple && <Path path={path} style="stroke" strokeWidth={baseWidth * 0.17} strokeCap="round" strokeJoin="round" color={color} opacity={strandOpacity} />}
  </Group>;
}

export const StrokeLayer = memo(function StrokeLayer({ strokes, accents, ...props }: { strokes: StrokeEvent[]; accents: AccentEvent[]; scene: SceneEvent; time: SharedValue<number>; width: number; height: number; reducedMotion: boolean; simple: boolean }) {
  const byStroke = useMemo(() => {
    const groups = new Map<string, AccentEvent[]>();
    for (const accent of accents) { const group = groups.get(accent.strokeId) ?? []; group.push(accent); groups.set(accent.strokeId, group); }
    return groups;
  }, [accents]);
  return <Group>{strokes.map((stroke) => <StrokeMark key={stroke.id} stroke={stroke} accents={byStroke.get(stroke.id) ?? EMPTY_ACCENTS} {...props} />)}</Group>;
});
