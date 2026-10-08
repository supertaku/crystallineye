import { useCallback, useEffect, useRef } from 'react';
import { Audio, type AudioTagHandle } from 'react-native-audio-api';
import { nativeClockSource } from './native-clock';
import type { AudioTransport } from './audio-transport';

export function NativeAudio({ uri, transport, onReady, onError, onEnded, onBuffering }: {
  uri: string; transport: AudioTransport; onReady: () => void; onError: (message: string) => void; onEnded: () => void; onBuffering: (value: boolean) => void;
}) {
  const handle = useRef<AudioTagHandle>(null);
  const readyCallback = useRef(onReady);
  useEffect(() => { readyCallback.current = onReady; }, [onReady]);
  const loaded = useCallback(() => {
    try {
      if (!handle.current) throw new Error('The audio player is unavailable.');
      transport.attach(nativeClockSource(handle.current)); readyCallback.current();
    } catch (error) { onError(error instanceof Error ? error.message : String(error)); }
  }, [transport, onError]);
  useEffect(() => () => { try { transport.detach(); } catch { /* Native disposal already completed. */ } }, [transport]);
  return <Audio ref={handle} source={uri} controls={false} autoPlay={false} onLoad={loaded}
    onError={(error) => onError(error.message)} onEnded={onEnded} onWaiting={() => onBuffering(true)} onPlaying={() => onBuffering(false)} />;
}
