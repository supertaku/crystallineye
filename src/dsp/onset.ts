import { clamp } from '../shared/math';

export class OnsetDetector {
  private mean = 0;
  private deviation = 0.01;
  private warmup = 0;

  reset() { this.mean = 0; this.deviation = 0.01; this.warmup = 0; }

  update(flux: number, seconds: number): number {
    const novelty = Math.max(0, flux - this.mean - 1.5 * this.deviation);
    const strength = clamp(novelty / Math.max(0.025, 3 * this.deviation));
    const alpha = 1 - Math.exp(-seconds / 2);
    this.deviation += alpha * (Math.abs(flux - this.mean) - this.deviation);
    this.mean += alpha * (flux - this.mean);
    this.warmup += seconds;
    return this.warmup >= 0.25 ? strength : 0;
  }
}
