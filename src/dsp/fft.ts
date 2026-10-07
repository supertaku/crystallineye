import FFT from 'fft.js';
import { hannWindow } from './window';

export interface FFTProcessor {
  transform(samples: Float32Array, length?: number): Float32Array;
}

/** fft.js is pure JS. Returned spectrum is reused: consumers must not retain it. */
export class JavaScriptFFT implements FFTProcessor {
  private readonly fft: FFT;
  private readonly input: Float32Array;
  private readonly complex: number[];
  private readonly magnitude: Float32Array;
  private window: Float32Array = new Float32Array(0);

  constructor(readonly size: number) {
    this.fft = new FFT(size);
    this.input = new Float32Array(size);
    this.complex = this.fft.createComplexArray();
    this.magnitude = new Float32Array(size / 2 + 1);
  }

  transform(samples: Float32Array, length = samples.length): Float32Array {
    const count = Math.min(length, this.size);
    if (count !== this.window.length) this.window = hannWindow(count);
    this.input.fill(0);
    for (let i = 0; i < count; i++) this.input[i] = samples[i]! * this.window[i]!;
    this.fft.realTransform(this.complex, this.input);
    for (let k = 0; k < this.magnitude.length; k++) {
      this.magnitude[k] = Math.hypot(this.complex[2 * k]!, this.complex[2 * k + 1]!) / Math.max(1, count);
    }
    return this.magnitude;
  }
}
