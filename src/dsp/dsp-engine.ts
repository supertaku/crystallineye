import { DSP_CONFIG } from '../config';
import type { AudioFeatureFrame, RateEstimate } from '../types/audio';
import { JavaScriptFFT } from './fft';
import { rms } from './rms';
import { spectralCentroid, normalizedCentroid } from './spectral-centroid';
import { bandEnergy, spectrumThirds } from './band-energy';
import { spectralFlux } from './spectral-flux';
import { OnsetDetector } from './onset';
import { FeatureNormalizer } from './normalizer';

export class DSPEngine {
  private readonly fft: JavaScriptFFT;
  private previous: Float32Array | null = null;
  private readonly onset = new OnsetDetector();
  private readonly normalizer = new FeatureNormalizer();

  constructor(readonly fftSize = DSP_CONFIG.fftSize) { this.fft = new JavaScriptFFT(fftSize); }

  resetTransients() { this.previous = null; this.onset.reset(); }
  reset() { this.resetTransients(); this.normalizer.reset(); }

  analyze(samples: Float32Array, count: number, timestamp: number, rate: RateEstimate, dt: number): AudioFeatureFrame {
    const energy = rms(samples, count);
    const spectrum = this.fft.transform(samples, count);
    const centroidHz = rate.hz === null ? null : spectralCentroid(spectrum, rate.hz, this.fftSize);
    const centroid = normalizedCentroid(spectrum);
    const flux = spectralFlux(spectrum, this.previous);
    if (!this.previous) this.previous = new Float32Array(spectrum.length);
    this.previous.set(spectrum);
    return {
      timestamp,
      rms: energy,
      rmsNormalized: this.normalizer.energy(energy, dt),
      spectralCentroidHz: centroidHz,
      spectralCentroidNormalized: centroid,
      spectralBrightnessNormalized: this.normalizer.brightness(centroidHz, centroid),
      bandRatios: rate.hz === null ? null : bandEnergy(spectrum, rate.hz, this.fftSize),
      spectrumRatios: spectrumThirds(spectrum),
      spectralFlux: flux,
      onsetStrength: this.onset.update(flux, dt),
      confidence: { sampleRate: rate.confidence, spectrum: count / this.fftSize },
    };
  }
}
