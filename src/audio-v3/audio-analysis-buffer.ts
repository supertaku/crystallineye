import { ANALYSIS_SAMPLE_RATE } from '../analysis/versions';
import { AUDIO_LIMITS, type AudioMetadata, type DecodedTrack } from './types';

export function estimateAnalysisMemory(metadata: AudioMetadata): number {
  const source = Math.ceil(metadata.duration * metadata.sampleRate) * metadata.numberOfChannels * 4;
  const resampled = Math.ceil(metadata.duration * ANALYSIS_SAMPLE_RATE) * metadata.numberOfChannels * 4;
  const mono = Math.ceil(metadata.duration * ANALYSIS_SAMPLE_RATE) * 4;
  // Reserve room for the native source, resampled output, mono PCM, features and decoder scratch.
  return source + resampled + mono + 24 * 1024 * 1024;
}

export function checkAudioBudget(metadata: AudioMetadata, memoryBytes = AUDIO_LIMITS.memoryBytes): number {
  if (!Number.isFinite(metadata.duration) || metadata.duration <= 0 || !Number.isInteger(metadata.numberOfChannels)
    || metadata.numberOfChannels < 1 || metadata.numberOfChannels > AUDIO_LIMITS.channels
    || !Number.isFinite(metadata.sampleRate) || metadata.sampleRate < 8000 || metadata.sampleRate > AUDIO_LIMITS.sampleRate) {
    throw new Error('I could not read safe audio metadata. Try a standard WAV, MP3, FLAC, OGG, or M4A file.');
  }
  const expected = estimateAnalysisMemory(metadata);
  if (metadata.duration > AUDIO_LIMITS.duration || expected > memoryBytes || metadata.encodedBytes > AUDIO_LIMITS.encodedBytes) {
    throw new Error('This track is too long for full analysis on this device.');
  }
  return expected;
}

export function downmixBuffer(buffer: { sampleRate: number; duration: number; numberOfChannels: number; length: number; copyFromChannel: (out: Float32Array<ArrayBuffer>, channel: number, offset: number) => void }): DecodedTrack {
  if (buffer.sampleRate !== ANALYSIS_SAMPLE_RATE || buffer.numberOfChannels < 1 || buffer.numberOfChannels > AUDIO_LIMITS.channels || buffer.length > ANALYSIS_SAMPLE_RATE * AUDIO_LIMITS.duration + 1) throw new Error('The decoder returned unexpected audio data.');
  const pcm = new Float32Array(buffer.length);
  const chunk = new Float32Array(Math.min(65536, buffer.length));
  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    for (let offset = 0; offset < pcm.length; offset += chunk.length) {
      const count = Math.min(chunk.length, pcm.length - offset);
      // Audio API 0.13.6's JSI copy reads the whole backing ArrayBuffer,
      // ignoring a typed-array view's length. The tail needs its own buffer.
      const output = count === chunk.length ? chunk : new Float32Array(count);
      buffer.copyFromChannel(output, channel, offset);
      for (let i = 0; i < count; i++) {
        const sample = output[i]!;
        if (!Number.isFinite(sample)) throw new Error('The decoded audio contains invalid samples.');
        pcm[offset + i] = pcm[offset + i]! + sample / buffer.numberOfChannels;
      }
    }
  }
  return { duration: buffer.length / ANALYSIS_SAMPLE_RATE, sampleRate: ANALYSIS_SAMPLE_RATE, numberOfChannels: 1, pcm };
}
