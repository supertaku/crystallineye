import { JavaScriptFFT } from '../dsp/fft';
import type { ChromaFrame, FeatureFrame } from './analysis-schema';
import { ANALYSIS_SAMPLE_RATE } from './versions';

export function percentile(values: number[], proportion: number): number {
  if (!values.length) return 0;
  const ordered = [...values].sort((a, b) => a - b);
  return ordered[Math.min(ordered.length - 1, Math.floor((ordered.length - 1) * proportion))]!;
}
export const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
export function checkCancelled(signal?: AbortSignal) { if (signal?.aborted) throw new Error('Analysis cancelled.'); }
export const yieldAnalysis = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

export async function extractFeatures(pcm: Float32Array, onProgress: (progress: number) => void = () => {}, signal?: AbortSignal) {
  const fftSize = 2048;
  const hop = 512;
  const fft = new JavaScriptFFT(fftSize);
  const previous = new Float32Array(fftSize / 2 + 1);
  const dynamics: FeatureFrame[] = [];
  const chromaFrames: ChromaFrame[] = [];
  for (let offset = 0, frame = 0; offset < pcm.length; offset += hop, frame++) {
    checkCancelled(signal);
    const samples = pcm.subarray(offset, Math.min(pcm.length, offset + fftSize));
    const spectrum = fft.transform(samples);
    let square = 0, total = 0, weighted = 0, bass = 0, flux = 0;
    for (const sample of samples) square += sample * sample;
    const values = Array<number>(12).fill(0);
    for (let bin = 1; bin < spectrum.length; bin++) {
      const magnitude = spectrum[bin]!;
      const frequency = bin * ANALYSIS_SAMPLE_RATE / fftSize;
      const power = magnitude * magnitude;
      total += power; weighted += power * frequency;
      if (frequency < 200) bass += power;
      flux += Math.max(0, magnitude - previous[bin]!);
      previous[bin] = magnitude;
      // Peak-only pitch-class energy is a DSP harmonic hint, never a note transcription.
      if (frequency >= 65 && frequency <= 2100 && magnitude > spectrum[bin - 1]! && magnitude >= (spectrum[bin + 1] ?? 0)) {
        const midi = Math.round(69 + 12 * Math.log2(frequency / 440));
        const pitchClass = ((midi % 12) + 12) % 12;
        values[pitchClass] = values[pitchClass]! + power;
      }
    }
    const chromaTotal = values.reduce((sum, value) => sum + value, 0);
    const time = offset / ANALYSIS_SAMPLE_RATE;
    dynamics.push({ time, rms: Math.sqrt(square / samples.length), energy: 0,
      bass: total > 1e-12 ? bass / total : 0, brightness: total > 1e-12 ? clamp01(weighted / total / 5000) : 0, onset: frame === 0 ? 0 : flux });
    if (frame % 8 === 0) chromaFrames.push({ time, values: values.map((value) => chromaTotal > 1e-12 ? value / chromaTotal : 0) });
    if (frame % 64 === 0) { onProgress(offset / pcm.length); await yieldAnalysis(); }
  }
  const energyScale = Math.max(1e-5, percentile(dynamics.map((f) => f.rms), 0.95));
  const onsetScale = Math.max(1e-5, percentile(dynamics.map((f) => f.onset), 0.98));
  for (const frame of dynamics) {
    // Silence remains silent even when it is the loudest part of a quiet file.
    frame.energy = frame.rms < 1e-5 ? 0 : clamp01(frame.rms / energyScale);
    frame.onset = frame.rms < 1e-5 ? 0 : clamp01(frame.onset / onsetScale);
  }
  onProgress(1);
  return { dynamics, chromaFrames };
}
