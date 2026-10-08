import type { AccentEvent, Point, SceneEvent, StrokeEvent, StrokePoint } from '../visual-score/schema';

export const SCENE_DISSOLVE_SECONDS = 6;
export function sceneOpacity(scene: SceneEvent, time: number): number {
  'worklet';
  if (time < scene.start) return 0;
  return Math.max(0, 1 - Math.max(0, time - scene.end) / SCENE_DISSOLVE_SECONDS);
}
export function markOpacity(scene: SceneEvent, createdAt: number, time: number): number {
  'worklet';
  return time < createdAt ? 0 : sceneOpacity(scene, time) * Math.exp(-Math.max(0, time - createdAt) / 70);
}
export function eventProgress(start: number, end: number, time: number): number {
  'worklet';
  return Math.max(0, Math.min(1, (time - start) / Math.max(1e-9, end - start)));
}

export type CubicSegment = { from: Point; control1: Point; control2: Point; to: Point; start: number; end: number; width: number; opacity: number; color: string };

/** Time-scaled Hermite controls share a velocity at each knot. Limiting that
 * shared velocity keeps BOTH neighboring cubics inside the canvas and C1 smooth. */
export function strokeSegments(points: StrokePoint[]): CubicSegment[] {
  'worklet';
  const velocities = points.map((point, index) => {
    const previous = points[Math.max(0, index - 1)]!, next = points[Math.min(points.length - 1, index + 1)]!;
    const duration = Math.max(1e-9, next.time - previous.time);
    const velocity = point.velocity && Number.isFinite(point.velocity.x + point.velocity.y) ? point.velocity
      : { x: (next.x - previous.x) / duration, y: (next.y - previous.y) / duration };
    const before = index > 0 ? Math.max(1e-9, point.time - previous.time) / 3 : 0;
    const after = index < points.length - 1 ? Math.max(1e-9, next.time - point.time) / 3 : 0;
    let scale = 1;
    for (const axis of ['x', 'y'] as const) {
      const v = velocity[axis], p = point[axis];
      if (v > 0) {
        if (before) scale = Math.min(scale, p / (v * before));
        if (after) scale = Math.min(scale, (1 - p) / (v * after));
      } else if (v < 0) {
        if (before) scale = Math.min(scale, (1 - p) / (-v * before));
        if (after) scale = Math.min(scale, p / (-v * after));
      }
    }
    return { x: velocity.x * Math.max(0, scale), y: velocity.y * Math.max(0, scale) };
  });
  return points.slice(0, -1).map((from, index) => {
    const to = points[index + 1]!, duration = Math.max(1e-9, to.time - from.time);
    const incoming = velocities[index]!, outgoing = velocities[index + 1]!;
    return { from, to, control1: { x: from.x + incoming.x * duration / 3, y: from.y + incoming.y * duration / 3 },
      control2: { x: to.x - outgoing.x * duration / 3, y: to.y - outgoing.y * duration / 3 },
      start: from.time, end: to.time, width: (from.width + to.width) / 2, opacity: (from.opacity + to.opacity) / 2, color: from.color };
  });
}

export function cubicPosition(segment: CubicSegment, progress: number): Point {
  'worklet';
  const u = Math.max(0, Math.min(1, progress)), v = 1 - u;
  return { x: v ** 3 * segment.from.x + 3 * v ** 2 * u * segment.control1.x + 3 * v * u ** 2 * segment.control2.x + u ** 3 * segment.to.x,
    y: v ** 3 * segment.from.y + 3 * v ** 2 * u * segment.control1.y + 3 * v * u ** 2 * segment.control2.y + u ** 3 * segment.to.y };
}
export function cubicVelocity(segment: CubicSegment, progress: number): Point {
  'worklet';
  const u = Math.max(0, Math.min(1, progress)), v = 1 - u, duration = Math.max(1e-9, segment.end - segment.start);
  return { x: (3 * v ** 2 * (segment.control1.x - segment.from.x) + 6 * v * u * (segment.control2.x - segment.control1.x) + 3 * u ** 2 * (segment.to.x - segment.control2.x)) / duration,
    y: (3 * v ** 2 * (segment.control1.y - segment.from.y) + 6 * v * u * (segment.control2.y - segment.control1.y) + 3 * u ** 2 * (segment.to.y - segment.control2.y)) / duration };
}

/** A causal, bounded beat envelope. It affects pigment DEPOSITED at this time;
 * it never expands all previously painted geometry when a new beat arrives. */
export function accentPressureAt(accents: AccentEvent[], strokeId: string, time: number): number {
  'worklet';
  let strength = 0;
  for (const accent of accents) {
    if (accent.strokeId !== strokeId) continue;
    const duration = Math.max(0.04, (accent as AccentEvent & { duration?: number }).duration ?? 0.22);
    const age = (time - accent.time) / duration;
    if (age > 0 && age < 1) strength = Math.max(strength, Math.sin(age * Math.PI) ** 2 * Math.max(0, Math.min(1, accent.pressure)));
  }
  return 1 + strength * 0.32;
}

export type BrushState = { time: number; position: Point; velocity: Point; tangent: Point; direction: number; pressure: number;
  width: number; opacity: number; color: string; contact: boolean; active: boolean; progress: number; segmentIndex: number; segmentProgress: number };

export function brushStateOnSegments(stroke: StrokeEvent, segments: CubicSegment[], time: number, accents: AccentEvent[] = []): BrushState {
  'worklet';
  const safeTime = Number.isFinite(time) ? time : 0;
  let low = 0, high = segments.length;
  while (low < high) { const mid = (low + high) >>> 1; if (segments[mid]!.end <= safeTime) low = mid + 1; else high = mid; }
  const index = Math.min(Math.max(0, low), Math.max(0, segments.length - 1)), segment = segments[index];
  const progress = segment ? eventProgress(segment.start, segment.end, safeTime) : 0;
  const position = segment ? cubicPosition(segment, progress) : (stroke.points[0] ?? { x: 0.5, y: 0.5 });
  const velocity = segment ? cubicVelocity(segment, progress) : { x: 0, y: 0 };
  const length = Math.hypot(velocity.x, velocity.y);
  const tangent = length > 1e-9 ? { x: velocity.x / length, y: velocity.y / length } : { x: 1, y: 0 };
  const from = stroke.points[index], to = stroke.points[index + 1] ?? from;
  const blend = progress * progress * (3 - 2 * progress), pressure = accentPressureAt(accents, stroke.id, safeTime);
  const active = safeTime >= stroke.start && safeTime < stroke.end && segments.length > 0;
  const width = from && to ? from.width + (to.width - from.width) * blend : 0;
  const opacity = from && to ? from.opacity + (to.opacity - from.opacity) * blend : 0;
  return { time: safeTime, position: { x: position.x, y: position.y }, velocity, tangent, direction: Math.atan2(tangent.y, tangent.x), pressure,
    width: Math.max(0, Math.min(0.065, width * pressure)), opacity: Math.max(0, Math.min(1, opacity * (1 + (pressure - 1) * 0.2))),
    color: from?.color ?? '#ffffff', contact: active, active, progress: eventProgress(stroke.start, stroke.end, safeTime), segmentIndex: index, segmentProgress: progress };
}

/** Pure absolute-time lookup. Pausing or seeking needs no accumulated state. */
export function brushStateAt(stroke: StrokeEvent, songTime: number, accents: AccentEvent[] = []): BrushState {
  'worklet';
  return brushStateOnSegments(stroke, strokeSegments(stroke.points), songTime, accents);
}

export type RibbonSample = { time: number; position: Point; tangent: Point; width: number; opacity: number };
export type PigmentRun = { start: number; end: number; color: string; samples: RibbonSample[]; opacity: number };
export type StrokeGeometry = { segments: CubicSegment[]; runs: PigmentRun[]; meanWidth: number; meanOpacity: number };

/** Adjacent cubics with the same pigment share a drawable. Pressure lives in
 * ribbon geometry; static samples include accent peaks and interval endpoints. */
export function prepareStrokeGeometry(stroke: StrokeEvent, accents: AccentEvent[] = []): StrokeGeometry {
  const segments = strokeSegments(stroke.points), runs: PigmentRun[] = [];
  for (const segment of segments) {
    let run = runs[runs.length - 1];
    if (!run || run.color !== segment.color) { run = { start: segment.start, end: segment.end, color: segment.color, samples: [], opacity: 0 }; runs.push(run); }
    run.end = segment.end;
    const times = Array.from({ length: 9 }, (_, index) => segment.start + (segment.end - segment.start) * index / 8);
    for (const accent of accents) {
      const duration = (accent as AccentEvent & { duration?: number }).duration ?? 0.22;
      for (const fraction of [0, 0.25, 0.5, 0.75, 1]) {
        const time = accent.time + duration * fraction;
        if (accent.strokeId === stroke.id && time > segment.start && time < segment.end) times.push(time);
      }
    }
    for (const time of [...new Set(times)].sort((a, b) => a - b)) {
      if (run.samples[run.samples.length - 1]?.time === time) continue;
      const state = brushStateOnSegments(stroke, segments, time, accents);
      run.samples.push({ time, position: state.position, tangent: state.tangent, width: state.width, opacity: state.opacity });
    }
  }
  for (const run of runs) run.opacity = run.samples.reduce((sum, sample) => sum + sample.opacity, 0) / Math.max(1, run.samples.length);
  return { segments, runs, meanWidth: stroke.points.reduce((sum, point) => sum + point.width, 0) / Math.max(1, stroke.points.length),
    meanOpacity: stroke.points.reduce((sum, point) => sum + point.opacity, 0) / Math.max(1, stroke.points.length) };
}

/** Screen-space pressure ribbon. Only the active tip changes; deposited sample
 * positions/widths stay fixed after their musical time, including on seeks. */
export function ribbonPolygonAt(stroke: StrokeEvent, geometry: StrokeGeometry, run: PigmentRun, time: number, width: number, height: number, accents: AccentEvent[] = []): Point[] {
  'worklet';
  if (time <= run.start || run.samples.length < 2) return [];
  const end = Math.min(run.end, time), samples = run.samples.filter((sample) => sample.time <= end);
  if (!samples.length || samples[samples.length - 1]!.time < end) {
    const state = brushStateOnSegments(stroke, geometry.segments, end, accents);
    samples.push({ time: end, position: state.position, tangent: state.tangent, width: state.width, opacity: state.opacity });
  }
  const size = Math.min(width, height), left: Point[] = [], right: Point[] = [];
  for (const sample of samples) {
    const dx = sample.tangent.x * width, dy = sample.tangent.y * height, length = Math.max(1e-9, Math.hypot(dx, dy));
    const offsetX = -dy / length * sample.width * size / 2, offsetY = dx / length * sample.width * size / 2;
    left.push({ x: sample.position.x * width + offsetX, y: sample.position.y * height + offsetY });
    right.push({ x: sample.position.x * width - offsetX, y: sample.position.y * height - offsetY });
  }
  // A round live brush tip; internal pigment boundaries use matching butt ends.
  const tip = samples[samples.length - 1]!, tipAngle = Math.atan2(tip.tangent.y * height, tip.tangent.x * width), tipRadius = tip.width * size / 2;
  const cap: Point[] = [];
  if (end < run.end || run.end === stroke.end) for (let i = 1; i < 8; i++) {
    const angle = tipAngle + Math.PI / 2 - i * Math.PI / 8;
    cap.push({ x: tip.position.x * width + Math.cos(angle) * tipRadius, y: tip.position.y * height + Math.sin(angle) * tipRadius });
  }
  const startCap: Point[] = [];
  const first = samples[0]!;
  if (run.start === stroke.start) for (let i = 1; i < 8; i++) {
    const angle = Math.atan2(first.tangent.y * height, first.tangent.x * width) - Math.PI / 2 - i * Math.PI / 8;
    startCap.push({ x: first.position.x * width + Math.cos(angle) * first.width * size / 2,
      y: first.position.y * height + Math.sin(angle) * first.width * size / 2 });
  }
  return [...left, ...cap, ...right.reverse(), ...startCap];
}

/** Exact Bezier prefix using de Casteljau subdivision; avoids treating musical
 * time as a global fraction of path length (which shifts note timings). */
export function revealedCubicsAt(segments: CubicSegment[], time: number): CubicSegment[] {
  'worklet';
  const result: CubicSegment[] = [];
  for (const segment of segments) {
    if (time <= segment.start) break;
    if (time >= segment.end) { result.push(segment); continue; }
    const u = eventProgress(segment.start, segment.end, time);
    const mix = (a: Point, b: Point): Point => ({ x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u });
    const a = mix(segment.from, segment.control1), b = mix(segment.control1, segment.control2), c = mix(segment.control2, segment.to);
    const d = mix(a, b), e = mix(b, c);
    result.push({ ...segment, control1: a, control2: d, to: mix(d, e), end: time });
    break;
  }
  return result;
}
