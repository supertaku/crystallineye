import type { TransportClockState } from './audio-transport';

export type DiagnosticMode = 'A' | 'B' | 'C' | 'D';
export const DIAGNOSTIC_MODES: { mode: DiagnosticMode; label: string; synthetic: boolean; simple: boolean }[] = [
  { mode: 'A', label: 'A · Synthetic clock / simple brush', synthetic: true, simple: true },
  { mode: 'B', label: 'B · Native audio / simple brush', synthetic: false, simple: true },
  { mode: 'C', label: 'C · Synthetic clock / full score', synthetic: true, simple: false },
  { mode: 'D', label: 'D · Native audio / full score', synthetic: false, simple: false },
];
export type ClockObservation = TransportClockState & {
  wallMs: number; rafMs: number; mode: DiagnosticMode; renderedTime: number; expectedSceneIndex: number; committedSceneIndex: number; sceneCommitPending: boolean;
};
export type ClockSample = ClockObservation & {
  wallDeltaMs: number | null; frameDeltaMs: number | null; nativeDelta: number | null; renderDelta: number | null; flags: string[];
};
function percentile(values: number[], fraction: number) {
  if (!values.length) return 0;
  values.sort((a, b) => a - b);
  return values[Math.min(values.length - 1, Math.floor(values.length * fraction))]!;
}

/** Bounded DEV evidence. These are JS callback intervals, not GPU presentation times. */
export class ClockTrace {
  private samples: (ClockSample | undefined)[];
  private cursor = 0;
  private count = 0;
  constructor(readonly capacity = 1200) {
    if (!Number.isInteger(capacity) || capacity < 1) throw new Error('Invalid clock-trace capacity.');
    this.samples = new Array(capacity);
  }
  clear() { this.samples = new Array(this.capacity); this.cursor = 0; this.count = 0; }
  record(observation: ClockObservation): ClockSample {
    const previous = this.count ? this.samples[(this.cursor + this.capacity - 1) % this.capacity] : undefined;
    const wallDeltaMs = previous ? observation.wallMs - previous.wallMs : null;
    const frameDeltaMs = previous ? observation.rafMs - previous.rafMs : null;
    const nativeDelta = previous?.nativePosition !== null && previous?.nativePosition !== undefined && observation.nativePosition !== null ? observation.nativePosition - previous.nativePosition : null;
    const renderDelta = previous ? observation.renderedTime - previous.renderedTime : null;
    const explicitSeek = previous !== undefined && observation.seekId !== previous.seekId;
    const seeking = explicitSeek || observation.seekPending || previous?.seekPending;
    const continuous = observation.playing && !observation.buffering && previous?.playing && !previous.buffering && !seeking;
    const flags: string[] = [];
    if (explicitSeek) flags.push('explicit_seek');
    if (observation.seekPending) flags.push('seek_pending');
    if (previous?.seekPending && !observation.seekPending) flags.push('seek_acknowledged');
    if (previous && observation.buffering !== previous.buffering) flags.push(observation.buffering ? 'buffering_start' : 'buffering_end');
    if (frameDeltaMs !== null && frameDeltaMs > 50) flags.push('js_frame_gap');
    if (continuous && nativeDelta !== null && nativeDelta < -0.002) flags.push('unexpected_native_backward');
    if (continuous && nativeDelta !== null && wallDeltaMs !== null && nativeDelta > wallDeltaMs / 1000 + 0.07) flags.push('unexpected_native_forward');
    if (continuous && renderDelta !== null && renderDelta < -0.002) flags.push('unexpected_render_backward');
    if (previous && !explicitSeek && !observation.sceneCommitPending && !previous.sceneCommitPending && ((!observation.playing && !previous.playing) || (observation.buffering && previous.buffering)) && Math.abs(renderDelta ?? 0) > 0.001) flags.push('held_time_changed');
    if (continuous && !observation.sceneCommitPending && !previous?.sceneCommitPending && observation.nativePosition !== null && Math.abs(observation.renderedTime - observation.nativePosition) > 0.07) flags.push('native_render_error');
    if (observation.sceneCommitPending) flags.push('scene_commit_wait');
    if (observation.expectedSceneIndex !== observation.committedSceneIndex) flags.push(seeking ? 'seek_scene_commit_lag' : 'scene_commit_lag');
    const sample = { ...observation, wallDeltaMs, frameDeltaMs, nativeDelta, renderDelta, flags };
    this.samples[this.cursor] = sample; this.cursor = (this.cursor + 1) % this.capacity; this.count = Math.min(this.capacity, this.count + 1);
    return sample;
  }
  snapshot(): ClockSample[] {
    return Array.from({ length: this.count }, (_, index) => this.samples[(this.cursor + this.capacity - this.count + index) % this.capacity]!);
  }
  summary() {
    const samples = this.snapshot();
    const flags: Record<string, number> = {};
    for (const sample of samples) for (const flag of sample.flags) flags[flag] = (flags[flag] ?? 0) + 1;
    const reads = samples.filter((sample) => sample.playing && !sample.buffering).map((sample) => sample.nativeReadMs);
    const errors = samples.filter((sample) => sample.playing && !sample.buffering && !sample.seekPending && !sample.sceneCommitPending && !sample.flags.includes('seek_acknowledged') && sample.nativePosition !== null)
      .map((sample) => Math.abs(sample.renderedTime - sample.nativePosition!) * 1000);
    return { samples: samples.length, retainedSeconds: samples.length > 1 ? (samples[samples.length - 1]!.wallMs - samples[0]!.wallMs) / 1000 : 0,
      p95FrameMs: percentile(samples.flatMap((sample) => sample.frameDeltaMs === null ? [] : [sample.frameDeltaMs]), 0.95),
      p95NativeReadMs: percentile(reads, 0.95), maxNativeReadMs: Math.max(0, ...reads), maxNativeRenderErrorMs: Math.max(0, ...errors), flags };
  }
}
