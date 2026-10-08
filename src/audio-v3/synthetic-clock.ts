import type { TransportSource } from './types';

/** DEV experiment only: elapsed monotonic time, anchored directly on every seek. */
export class SyntheticClockSource implements TransportSource {
  private position = 0;
  private startedAtMs: number | null = null;
  constructor(private readonly duration: number, private readonly wallNowMs: () => number = () => performance.now()) {}
  play() { if (this.startedAtMs === null) this.startedAtMs = this.wallNowMs(); }
  pause() { this.position = this.readTime(); this.startedAtMs = null; }
  seekToTime(seconds: number) { this.position = Math.max(0, Math.min(this.duration, seconds)); if (this.startedAtMs !== null) this.startedAtMs = this.wallNowMs(); }
  readTime() { return Math.min(this.duration, this.position + (this.startedAtMs === null ? 0 : Math.max(0, this.wallNowMs() - this.startedAtMs) / 1000)); }
}
