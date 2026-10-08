import { createHash } from 'node:crypto';
import type { MusicAnalysis, NoteEvent } from '../src/analysis/analysis-schema';
import { ANALYSIS_SAMPLE_RATE, ANALYSIS_VERSION } from '../src/analysis/versions';
import { extractFeatures } from '../src/analysis/feature-extractor';
import { chromaFromNotes } from '../src/analysis/chroma';
import { estimateChords } from '../src/analysis/chord-estimator';
import { seededRandom, seedFrom } from '../src/visual-score/seed';

export const FIXTURE_STYLES = [
  { name: 'pop', bpm: 120, harmony: true, sparse: false }, { name: 'rock', bpm: 150, harmony: true, sparse: false },
  { name: 'edm', bpm: 128, harmony: true, sparse: false }, { name: 'acoustic', bpm: 90, harmony: true, sparse: true },
  { name: 'classical', bpm: 100, harmony: true, sparse: false }, { name: 'jazz', bpm: 110, harmony: true, sparse: false },
  { name: 'hip-hop', bpm: 85, harmony: false, sparse: false }, { name: 'ballad', bpm: 60, harmony: true, sparse: true },
  { name: 'dense', bpm: 135, harmony: true, sparse: false }, { name: 'sparse', bpm: 80, harmony: false, sparse: true },
] as const;

export function encodeWav(pcm: Float32Array, sampleRate = ANALYSIS_SAMPLE_RATE): Buffer {
  const wav = Buffer.alloc(44 + pcm.length * 2);
  wav.write('RIFF', 0); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8); wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22); wav.writeUInt32LE(sampleRate, 24); wav.writeUInt32LE(sampleRate * 2, 28);
  wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(pcm.length * 2, 40);
  for (let i = 0; i < pcm.length; i++) wav.writeInt16LE(Math.round(Math.max(-1, Math.min(1, pcm[i]!)) * 32767), 44 + i * 2);
  return wav;
}

/** Original synthesized compositions with explicit ground truth, never shipped as inferred model output. */
export async function createComposition(style: typeof FIXTURE_STYLES[number], duration = 32) {
  const pcm = new Float32Array(Math.round(duration * ANALYSIS_SAMPLE_RATE));
  const notes: NoteEvent[] = [], beats: MusicAnalysis['rhythm']['beats'] = [], downbeats: MusicAnalysis['rhythm']['downbeats'] = [];
  const random = seededRandom(seedFrom(style.name));
  const period = 60 / style.bpm;
  const addNote = (start: number, length: number, midi: number, amplitude: number) => {
    const end = Math.min(duration, start + length);
    if (end <= start) return;
    notes.push({ start, end, midi, amplitude, confidence: 1 });
    const frequency = 440 * 2 ** ((midi - 69) / 12);
    for (let i = Math.floor(start * ANALYSIS_SAMPLE_RATE); i < Math.floor(end * ANALYSIS_SAMPLE_RATE); i++) {
      const time = i / ANALYSIS_SAMPLE_RATE - start;
      const envelope = Math.min(1, time / 0.012) * Math.min(1, (end - start - time) / 0.07) * Math.exp(-time * 1.3);
      pcm[i] = pcm[i]! + amplitude * envelope * (Math.sin(2 * Math.PI * frequency * time) + 0.18 * Math.sin(4 * Math.PI * frequency * time));
    }
  };
  for (let time = 0.5, beat = 0; time < duration; time += period, beat++) {
    beats.push({ time, confidence: 1 });
    if (beat % 4 === 0) downbeats.push({ time, confidence: 1 });
    const later = time >= duration / 2;
    const root = later ? 57 : 48;
    if (style.harmony && beat % 4 === 0) for (const interval of [0, later ? 3 : 4, 7]) addNote(time, period * 3.8, root + interval, style.name === 'dense' ? 0.12 : 0.07);
    if (!style.sparse || beat % 3 === 0) {
      const contour = later ? [76, 74, 72, 69, 72, 74, 76, 81] : [67, 69, 72, 71, 69, 64, 67, 72];
      addNote(time + 0.025, period * (style.sparse ? 1.7 : 0.8), contour[beat % contour.length]!, 0.18);
    }
    for (let i = Math.floor(time * ANALYSIS_SAMPLE_RATE); i < Math.min(pcm.length, Math.floor((time + 0.08) * ANALYSIS_SAMPLE_RATE)); i++) {
      const age = i / ANALYSIS_SAMPLE_RATE - time;
      const strength = beat % 4 === 0 ? 0.3 : 0.12;
      pcm[i] = pcm[i]! + strength * Math.exp(-age * 70) * ((random() * 2 - 1) * 0.4 + Math.sin(2 * Math.PI * 80 * age) * 0.6);
    }
  }
  const wav = encodeWav(pcm);
  // Analyze the quantized PCM actually written to disk.
  const decoded = Float32Array.from({ length: pcm.length }, (_, i) => wav.readInt16LE(44 + i * 2) / 32768);
  const { dynamics } = await extractFeatures(decoded);
  const chromaFrames = chromaFromNotes(notes, duration);
  const analysis: MusicAnalysis = { version: ANALYSIS_VERSION,
    track: { hash: createHash('sha256').update(wav).digest('hex'), duration, analysisSampleRate: ANALYSIS_SAMPLE_RATE },
    rhythm: { bpm: style.bpm, beats, downbeats, meter: 4 }, notes: notes.sort((a, b) => a.start - b.start),
    harmony: { chromaFrames, chords: estimateChords(chromaFrames, duration) }, dynamics,
    structure: { segments: [{ start: 0, end: duration / 2, label: 'Section A', confidence: 1 }, { start: duration / 2, end: duration, label: 'Section B', confidence: 1 }] },
    modelVersions: { transcription: 'synthetic-ground-truth-1', beatTracking: 'synthetic-ground-truth-1', structure: 'synthetic-ground-truth-1', features: 'whole-track-dsp-1', harmony: 'chroma-templates-1' },
    quality: 'FULL', warnings: ['Original synthetic test composition. Notes, beats, and sections are generator ground truth, not ML results.'] };
  return { wav, pcm: decoded, analysis };
}
