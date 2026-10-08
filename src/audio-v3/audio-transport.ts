import type { TransportSource } from './types';

const SEEK_TOLERANCE_SECONDS = 0.07;
const SEEK_TIMEOUT_MS = 5000;
type PendingSeek = { target: number; activeWaitMs: number; observedAtMs: number };
export type TransportClockState = {
  position: number; nativePosition: number | null; playing: boolean; buffering: boolean;
  seekId: number; seekTarget: number | null; seekPending: boolean; seekWaitMs: number; nativeReadMs: number;
};

/** Native time remains authoritative. Wall time only bounds asynchronous seek acknowledgment. */
export class AudioTransport {
  private source: TransportSource | null = null;
  private position = 0;
  private pendingSeek: PendingSeek | null = null;
  private seekId = 0;
  private nativePosition: number | null = null;
  private nativeReadMs = 0;
  private diagnostics = false;
  playing = false;
  buffering = false;
  constructor(readonly duration: number, private readonly wallNowMs: () => number = () => performance.now()) {}
  attach(source: TransportSource) { this.source = source; source.seekToTime(this.position); }
  setDiagnostics(enabled: boolean) { this.diagnostics = enabled; }
  clockState(): TransportClockState {
    return { position: this.position, nativePosition: this.nativePosition, playing: this.playing, buffering: this.buffering,
      seekId: this.seekId, seekTarget: this.pendingSeek?.target ?? null, seekPending: this.pendingSeek !== null,
      seekWaitMs: this.pendingSeek?.activeWaitMs ?? 0, nativeReadMs: this.nativeReadMs };
  }
  currentTime(): number {
    if (this.source && this.playing && !this.buffering) {
      const now = this.wallNowMs();
      const started = this.diagnostics ? performance.now() : 0;
      const time = this.source.readTime();
      this.nativeReadMs = this.diagnostics ? performance.now() - started : 0;
      if (!Number.isFinite(time)) throw new Error('The playback clock is unavailable.');
      this.nativePosition = time;
      if (this.pendingSeek !== null) {
        const pending = this.pendingSeek;
        pending.activeWaitMs += Math.max(0, now - pending.observedAtMs);
        pending.observedAtMs = now;
        // A stale position or intermediate rapid-seek target must not release
        // the latest gate. Permit only what could have played since that seek.
        const upper = pending.target + pending.activeWaitMs / 1000 + SEEK_TOLERANCE_SECONDS;
        if (time < pending.target - SEEK_TOLERANCE_SECONDS || time > upper) {
          if (pending.activeWaitMs >= SEEK_TIMEOUT_MS) throw new Error('The audio player did not finish seeking. Pause and try the position again.');
          return this.position;
        }
        this.pendingSeek = null;
      }
      this.position = Math.max(0, Math.min(this.duration, time));
    }
    return this.position;
  }
  play() {
    if (!this.source) throw new Error('Audio is still loading.');
    if (this.position >= this.duration) this.seek(0);
    this.resetSeekObservation();
    this.source.play(); this.playing = true;
  }
  pause() {
    try { this.currentTime(); } finally {
      try { this.source?.pause(); } finally { this.playing = false; this.buffering = false; this.resetSeekObservation(); }
    }
  }
  seek(seconds: number) {
    if (!Number.isFinite(seconds)) throw new Error('Invalid playback position.');
    const target = Math.max(0, Math.min(this.duration, seconds));
    // A failed native request must not replace the last trusted visual position.
    this.source?.seekToTime(target);
    this.position = target;
    this.pendingSeek = { target, activeWaitMs: 0, observedAtMs: this.wallNowMs() }; this.seekId++;
  }
  setBuffering(value: boolean) { if (value) this.currentTime(); this.buffering = value; this.resetSeekObservation(); }
  ended() { this.position = this.duration; this.pendingSeek = null; this.playing = false; this.buffering = false; }
  detach() { try { this.pause(); } finally { this.source = null; this.nativePosition = null; } }
  private resetSeekObservation() { if (this.pendingSeek) this.pendingSeek.observedAtMs = this.wallNowMs(); }
}
