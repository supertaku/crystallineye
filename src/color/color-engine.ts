import type { AudioFeatureFrame } from '../types/audio';
import { FeatureSmoother } from './smoothing';
import { INITIAL_VISUAL, perceptualV1 } from './perceptual-v1';
import { limitVisual } from './safety-limiter';
import type { VisualState } from './types';

export class ColorEngine {
  private readonly smoother = new FeatureSmoother();
  private previous = INITIAL_VISUAL;

  reset(visible: VisualState = this.previous) { this.smoother.reset(); this.previous = visible; }

  update(frame: AudioFeatureFrame, dt: number): VisualState {
    const normalized = this.smoother.update({
      energy: frame.rmsNormalized,
      brightness: frame.spectralBrightnessNormalized,
      balance: frame.bandRatios ?? frame.spectrumRatios,
      onset: frame.onsetStrength,
    }, dt);
    this.previous = limitVisual(perceptualV1(normalized), this.previous, dt);
    return this.previous;
  }
}
