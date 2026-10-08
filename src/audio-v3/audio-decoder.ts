import { File, FileMode } from 'expo-file-system';
import { decodeAudioData, getAudioDuration } from 'react-native-audio-api';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex } from '@noble/hashes/utils.js';
import { ANALYSIS_SAMPLE_RATE } from '../analysis/versions';
import { checkCancelled, yieldAnalysis } from '../analysis/feature-extractor';
import { checkAudioBudget, downmixBuffer } from './audio-analysis-buffer';
import { inspectAudioHeader } from './audio-metadata';
import { AUDIO_LIMITS, type AudioMetadata } from './types';
import { JavaScriptFFT } from '../dsp/fft';

export async function inspectTrack(uri: string): Promise<AudioMetadata> {
  const file = new File(uri);
  if (!file.exists || file.size <= 0) throw new Error('This audio file is unavailable. Please import it again.');
  if (file.size > AUDIO_LIMITS.encodedBytes) throw new Error('This track is too long for full analysis on this device.');
  const handle = file.open(FileMode.ReadOnly);
  try {
    const header = inspectAudioHeader((offset, count) => { handle.offset = offset; return handle.readBytes(count); }, file.size);
    const metadata = { ...header, duration: await getAudioDuration(uri), encodedBytes: file.size };
    checkAudioBudget(metadata);
    return metadata;
  } finally { handle.close(); }
}

export async function hashTrack(uri: string, signal?: AbortSignal): Promise<string> {
  const file = new File(uri), handle = file.open(FileMode.ReadOnly), digest = sha256.create();
  try {
    for (let offset = 0; offset < file.size; offset += 65536) {
      checkCancelled(signal);
      const bytes = handle.readBytes(Math.min(65536, file.size - offset));
      if (!bytes.length) throw new Error('The audio file changed while reading it.');
      digest.update(bytes);
      if (offset % (65536 * 16) === 0) await yieldAnalysis();
    }
    return bytesToHex(digest.digest());
  } finally { handle.close(); }
}

export async function decodeTrack(uri: string, metadata: AudioMetadata, signal?: AbortSignal) {
  checkAudioBudget(metadata); checkCancelled(signal);
  const buffer = await decodeAudioData(uri, ANALYSIS_SAMPLE_RATE);
  checkCancelled(signal);
  if (buffer.numberOfChannels > metadata.numberOfChannels || Math.abs(buffer.duration - metadata.duration) > 0.1) throw new Error('The decoded audio does not match its metadata. Try converting it to WAV.');
  const track = downmixBuffer(buffer);
  if (__DEV__) {
    const spectrum = new JavaScriptFFT(2048).transform(track.pcm.subarray(0, 2048));
    let peak = 0;
    for (let bin = 1; bin < spectrum.length; bin++) if (spectrum[bin]! > spectrum[peak]!) peak = bin;
    console.info('[Crystallineye V3] native decode', JSON.stringify({ sampleRate: track.sampleRate, channels: track.numberOfChannels,
      duration: track.duration, samples: track.pcm.length, firstWindowPeakHz: peak * track.sampleRate / 2048 }));
  }
  return track;
}
