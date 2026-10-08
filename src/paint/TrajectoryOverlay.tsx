import { memo, useMemo, useState } from 'react';
import { Circle, Group, Path, Skia } from '@shopify/react-native-skia';
import { runOnJS, useAnimatedReaction, useDerivedValue, type SharedValue } from 'react-native-reanimated';
import type { PhraseDiagnostic, Point, VisualScore } from '../visual-score/schema';
import { brushStateOnSegments } from './scene-runtime';
import { createTrajectoryDiagnostics, trajectoryWindowKeyAt, type TrajectoryGesture } from './trajectory-diagnostics';

type GuideRole = 'previous' | 'active' | 'next';
const GUIDE_COLORS: Record<GuideRole, string> = { previous: '#c298e8', active: '#ffe4a6', next: '#79e3d2' };

function linePath(points: Point[], width: number, height: number) {
  const builder = Skia.PathBuilder.Make();
  if (points.length) {
    builder.moveTo(points[0]!.x * width, points[0]!.y * height);
    for (const point of points.slice(1)) builder.lineTo(point.x * width, point.y * height);
  }
  return builder.detach();
}

const GestureGuide = memo(function GestureGuide({ gesture, role, width, height }: {
  gesture: TrajectoryGesture; role: GuideRole; width: number; height: number;
}) {
  const curve = useMemo(() => {
    const builder = Skia.PathBuilder.Make();
    if (gesture.segments.length) {
      builder.moveTo(gesture.segments[0]!.from.x * width, gesture.segments[0]!.from.y * height);
      for (const segment of gesture.segments) builder.cubicTo(segment.control1.x * width, segment.control1.y * height,
        segment.control2.x * width, segment.control2.y * height, segment.to.x * width, segment.to.y * height);
    }
    return builder.detach();
  }, [gesture, width, height]);
  const controls = useMemo(() => {
    const builder = Skia.PathBuilder.Make();
    for (const segment of gesture.segments) {
      builder.moveTo(segment.from.x * width, segment.from.y * height);
      builder.lineTo(segment.control1.x * width, segment.control1.y * height);
      builder.moveTo(segment.control2.x * width, segment.control2.y * height);
      builder.lineTo(segment.to.x * width, segment.to.y * height);
    }
    return builder.detach();
  }, [gesture, width, height]);
  const color = GUIDE_COLORS[role];
  return <Group opacity={role === 'active' ? .9 : .48}>
    <Path path={curve} style="stroke" strokeWidth={role === 'active' ? 1.7 : 1.1} color={color} />
    {role === 'active' ? <>
      <Path path={controls} style="stroke" strokeWidth={.7} color={color} opacity={.5} />
      {gesture.stroke.points.map((point, index) => <Circle key={`knot-${index}`} cx={point.x * width} cy={point.y * height} r={3.2} color={color} style="stroke" strokeWidth={1} />)}
      {gesture.segments.flatMap((segment, index) => [
        <Circle key={`in-${index}`} cx={segment.control1.x * width} cy={segment.control1.y * height} r={1.8} color={color} />,
        <Circle key={`out-${index}`} cx={segment.control2.x * width} cy={segment.control2.y * height} r={1.8} color={color} />,
      ])}
    </> : null}
  </Group>;
});

const NoteGuide = memo(function NoteGuide({ phrase, width, height }: { phrase: PhraseDiagnostic; width: number; height: number }) {
  const path = useMemo(() => linePath(phrase.notes, width, height), [phrase, width, height]);
  return <Group opacity={.75}>
    <Path path={path} style="stroke" strokeWidth={1} color="#ef9c7f" />
    {phrase.notes.map((note, index) => <Circle key={index} cx={note.x * width} cy={note.y * height} r={2.3} color="#ef9c7f" />)}
  </Group>;
});

function LiveTip({ gesture, songTime, width, height }: { gesture: TrajectoryGesture; songTime: SharedValue<number>; width: number; height: number }) {
  const state = useDerivedValue(() => brushStateOnSegments(gesture.stroke, gesture.segments, songTime.value, gesture.accents));
  const x = useDerivedValue(() => state.value.position.x * width), y = useDerivedValue(() => state.value.position.y * height);
  const radius = useDerivedValue(() => Math.max(5, state.value.width * Math.min(width, height) / 2));
  const opacity = useDerivedValue(() => state.value.contact ? 1 : 0);
  return <Group opacity={opacity}>
    <Circle cx={x} cy={y} r={radius} color="#ffffff" style="stroke" strokeWidth={1.6} />
    <Circle cx={x} cy={y} r={2.2} color="#ffffff" />
  </Group>;
}

/** Mounted only by PaintCanvas's DEV flag. Guides are fixed score geometry;
 * only the current tip is evaluated per frame, with no note interpretation. */
export function TrajectoryOverlay({ score, songTime, width, height }: { score: VisualScore; songTime: SharedValue<number>; width: number; height: number }) {
  const index = useMemo(() => createTrajectoryDiagnostics(score), [score]);
  const [windowKey, setWindowKey] = useState(-2);
  const timings = index.timings;
  useAnimatedReaction(() => trajectoryWindowKeyAt(timings, songTime.value), (key, previous) => {
    if (key !== previous) runOnJS(setWindowKey)(key);
  }, [timings, songTime]);
  const window = index.windowAtKey(windowKey);
  const active = window.activeGesture ? index.gestures[Math.floor(windowKey / 2)] : undefined;
  const phrase = active?.stroke.phraseId ? score.trajectoryDiagnostics?.phrases.find((item) => item.id === active.stroke.phraseId) : undefined;
  const previous = window.previousGesture ? index.gestures[active ? Math.floor(windowKey / 2) - 1 : Math.floor(windowKey / 2)] : undefined;
  const next = window.nextGesture ? index.gestures[Math.floor(windowKey / 2) + 1] : undefined;
  return <Group>
    {previous ? <GestureGuide gesture={previous} role="previous" width={width} height={height} /> : null}
    {next ? <GestureGuide gesture={next} role="next" width={width} height={height} /> : null}
    {phrase ? <NoteGuide phrase={phrase} width={width} height={height} /> : null}
    {active ? <>
      <GestureGuide gesture={active} role="active" width={width} height={height} />
      <LiveTip gesture={active} songTime={songTime} width={width} height={height} />
    </> : null}
  </Group>;
}
