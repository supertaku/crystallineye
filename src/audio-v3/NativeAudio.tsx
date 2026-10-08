import { useCallback, useEffect, useRef } from 'react';
import { Audio, type AudioTagHandle } from 'react-native-audio-api';
import { nativeClockSource } from './native-clock';
import type { AudioTransport } from './audio-transport';

export function NativeAudio({ uri, transport, onReady, onError, onEnded, onBuffering }: {
  uri: string; transport: AudioTransport; onReady: () => void; onError: (message: string) => void; onEnded: () => void; onBuffering: (value: boolean) => void;
}) {
  const handle = useRef<AudioTagHandle>(null);
  const callbacks = useRef({ onReady, onError, onEnded, onBuffering });
  useEffect(() => { callbacks.current = { onReady, onError, onEnded, onBuffering }; }, [onReady, onError, onEnded, onBuffering]);
  const loaded = useCallback(() => {
    try {
      if (!handle.current) throw new Error('The audio player is unavailable.');
      transport.attach(nativeClockSource(handle.current)); callbacks.current.onReady();
    } catch (error) { callbacks.current.onError(error instanceof Error ? error.message : String(error)); }
  }, [transport]);
  const failed = useCallback((error: Error) => callbacks.current.onError(error.message), []);
  const finished = useCallback(() => callbacks.current.onEnded(), []);
  const waiting = useCallback(() => callbacks.current.onBuffering(true), []);
  const resumed = useCallback(() => callbacks.current.onBuffering(false), []);
  useEffect(() => () => { try { transport.detach(); } catch { /* Native disposal already completed. */ } }, [transport]);
  return <Audio ref={handle} source={uri} controls={false} autoPlay={false} onLoad={loaded}
    onError={failed} onEnded={finished} onWaiting={waiting} onPlaying={resumed} />;
}
