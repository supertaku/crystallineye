import type { AudioTagHandle } from 'react-native-audio-api';
import type { TransportSource } from './types';

/**
 * Version-pinned seam for Audio API 0.13.6. Its public Audio tag exposes this
 * native accessor at runtime for MediaElementAudioSourceNode, but omits it
 * from AudioTagHandle. Keep the dependency and this adapter validated together.
 */
export function nativeClockSource(handle: AudioTagHandle): TransportSource {
  const candidate = handle as AudioTagHandle & { getFileSourceNode?: () => { readonly currentTime: number } | null };
  if (typeof candidate.getFileSourceNode !== 'function') throw new Error('The native playback clock is unavailable. Rebuild the development app.');
  return { play: () => handle.play(), pause: () => handle.pause(), seekToTime: (seconds) => handle.seekToTime(seconds), readTime: () => {
    const node = candidate.getFileSourceNode!();
    if (!node) throw new Error('The audio source is no longer available.');
    return node.currentTime;
  } };
}
