/** Bounded mono ring: no track-sized PCM allocations. */
export class AudioBuffer {
  private readonly data: Float32Array;
  private next = 0;
  private length = 0;

  constructor(readonly capacity: number) {
    if (capacity <= 0 || !Number.isInteger(capacity)) throw new Error('Invalid buffer capacity');
    this.data = new Float32Array(capacity);
  }

  get size() { return this.length; }

  push(value: number) {
    this.data[this.next] = Number.isFinite(value) ? Math.max(-1, Math.min(1, value)) : 0;
    this.next = (this.next + 1) % this.capacity;
    this.length = Math.min(this.length + 1, this.capacity);
  }

  copyLatest(output: Float32Array): number {
    const count = Math.min(output.length, this.length);
    const start = (this.next - count + this.capacity) % this.capacity;
    output.fill(0);
    for (let i = 0; i < count; i++) output[i] = this.data[(start + i) % this.capacity]!;
    return count;
  }

  reset() { this.next = 0; this.length = 0; }
}

export function mixChannels(channels: { frames: ArrayLike<number> }[], buffer: AudioBuffer): number {
  if (channels.length === 0) return 0;
  const count = Math.min(...channels.map((channel) => channel.frames.length));
  for (let i = 0; i < count; i++) {
    let sum = 0;
    for (const channel of channels) {
      const value = channel.frames[i] ?? 0;
      sum += Number.isFinite(value) ? value : 0;
    }
    buffer.push(sum / channels.length);
  }
  return count;
}
