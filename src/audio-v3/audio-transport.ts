import type { TransportSource } from './types';

/** Owns transport intent; the source's actual position is the only time authority. */
export class AudioTransport {
  private source: TransportSource | null = null;
  private position = 0;
  private pendingSeek: { target: number; before: number } | null = null;
  playing = false;
  buffering = false;
  constructor(readonly duration: number) {}
  attach(source: TransportSource) { this.source = source; source.seekToTime(this.position); }
  currentTime(): number {
    if (this.source && this.playing && !this.buffering) {
      const time = this.source.readTime();
      if (!Number.isFinite(time)) throw new Error('The playback clock is unavailable.');
      // Native file seeking is asynchronous. Hold the reconstructed canvas until
      // the decoder acknowledges the target; never render a stale pre-seek time.
      if (this.pendingSeek !== null) {
        const { target, before } = this.pendingSeek;
        const acknowledged = Math.abs(time - target) <= 0.07 || (target > before ? time >= target : time < before - 0.07 && time >= target);
        if (!acknowledged) return this.position;
        this.pendingSeek = null;
      }
      this.position = Math.max(0, Math.min(this.duration, time));
    }
    return this.position;
  }
  play() {
    if (!this.source) throw new Error('Audio is still loading.');
    if (this.position >= this.duration) this.seek(0);
    this.source.play(); this.playing = true;
  }
  pause() {
    try { this.currentTime(); } finally { this.source?.pause(); this.playing = false; this.buffering = false; }
  }
  seek(seconds: number) {
    if (!Number.isFinite(seconds)) throw new Error('Invalid playback position.');
    const before = this.position;
    this.position = Math.max(0, Math.min(this.duration, seconds));
    this.pendingSeek = { target: this.position, before };
    this.source?.seekToTime(this.position);
  }
  setBuffering(value: boolean) { if (value) this.currentTime(); this.buffering = value; }
  ended() { this.position = this.duration; this.pendingSeek = null; this.playing = false; this.buffering = false; }
  detach() { try { this.pause(); } finally { this.source = null; } }
}
