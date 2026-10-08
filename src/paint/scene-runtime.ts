import type { Point, SceneEvent, StrokePoint } from '../visual-score/schema';

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
  return Math.max(0, Math.min(1, (time - start) / Math.max(0.001, end - start)));
}

export type CubicSegment = { from: Point; control1: Point; control2: Point; to: Point; start: number; end: number; width: number; opacity: number; color: string };
export function strokeSegments(points: StrokePoint[]): CubicSegment[] {
  const segments: CubicSegment[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)]!, p1 = points[i]!, p2 = points[i + 1]!, p3 = points[Math.min(points.length - 1, i + 2)]!;
    segments.push({ from: p1, to: p2,
      control1: { x: Math.max(0.05, Math.min(0.95, p1.x + (p2.x - p0.x) / 6)), y: Math.max(0.05, Math.min(0.95, p1.y + (p2.y - p0.y) / 6)) },
      control2: { x: Math.max(0.05, Math.min(0.95, p2.x - (p3.x - p1.x) / 6)), y: Math.max(0.05, Math.min(0.95, p2.y - (p3.y - p1.y) / 6)) },
      start: p1.time, end: p2.time, width: (p1.width + p2.width) / 2, opacity: (p1.opacity + p2.opacity) / 2, color: p1.color });
  }
  return segments;
}
