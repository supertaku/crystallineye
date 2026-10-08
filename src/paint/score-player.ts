import type { VisualScore } from '../visual-score/schema';
import { brushStateAt, SCENE_DISSOLVE_SECONDS } from './scene-runtime';

/** A frame is a pure lookup by song time. Seeking requires no hidden canvas history. */
export class ScorePlayer {
  private readonly sections;
  constructor(readonly score: VisualScore) {
    this.sections = score.scenes.map((scene) => ({ scene,
      strokes: score.strokes.filter((event) => event.sceneIndex === scene.index),
      drops: score.drops.filter((event) => event.sceneIndex === scene.index),
      washes: score.washes.filter((event) => event.sceneIndex === scene.index) }));
  }
  sceneIndex(time: number): number {
    let low = 0, high = this.sections.length;
    while (low < high) { const mid = (low + high) >>> 1; if (this.sections[mid]!.scene.start <= time) low = mid + 1; else high = mid; }
    return Math.max(0, low - 1);
  }
  frameAt(songTime: number) {
    const time = Math.max(0, Math.min(this.score.duration, Number.isFinite(songTime) ? songTime : 0));
    const index = this.sceneIndex(time);
    const selected = this.sections.filter((section) => time >= section.scene.start && time < section.scene.end + SCENE_DISSOLVE_SECONDS);
    return { time, sceneIndex: index, scenes: selected.map((section) => section!.scene),
      strokes: selected.flatMap((section) => section!.strokes).filter((event) => event.start <= time),
      drops: selected.flatMap((section) => section!.drops).filter((event) => event.time <= time && time - event.time < 14),
      washes: selected.flatMap((section) => section!.washes).filter((event) => event.start <= time && time - event.end < 12),
      brushes: selected.flatMap((section) => section.strokes).filter((stroke) => time >= stroke.start && time < stroke.end)
        .map((stroke) => ({ strokeId: stroke.id, ...brushStateAt(stroke, time, this.score.accents) })) };
  }
  // Native layers receive fixed event arrays and reveal them using the shared audio position.
  layersAt(sceneIndex: number) {
    const index = Math.max(0, Math.min(this.sections.length - 1, sceneIndex));
    const current = this.sections[index];
    if (!current) return [];
    // Pre-mount the incoming scene, and retain every still-dissolving scene even
    // when a score contains sections shorter than the six-second dissolve.
    return this.sections.filter((section, position) => position <= index + 1
      && (position >= index - 1 || section.scene.end + SCENE_DISSOLVE_SECONDS > current.scene.start));
  }
}
