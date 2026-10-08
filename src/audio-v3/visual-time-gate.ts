/** Coordinates a supplied paint time with the React scene layers needed to draw it. */
export class VisualTimeGate {
  committedScene = 0;
  private requestedScene = 0;
  private pending: { time: number; scene: number } | null = null;
  get waitingForCommit() { return this.pending !== null; }
  offer(time: number, scene: number, mounted: boolean) {
    // A later seek back into mounted layers cancels an earlier far destination,
    // including a queued React request that has not committed yet.
    this.pending = mounted ? null : { time, scene };
    const requestScene = scene !== this.requestedScene ? scene : null;
    this.requestedScene = scene;
    return { publishTime: mounted ? time : null, requestScene };
  }
  commit(scene: number) {
    this.committedScene = scene;
    if (!this.pending || this.pending.scene !== scene) return null;
    const time = this.pending.time; this.pending = null; return time;
  }
  reset() { this.committedScene = 0; this.requestedScene = 0; this.pending = null; }
}
