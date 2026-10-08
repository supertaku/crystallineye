export type DecodedTrack = { duration: number; sampleRate: number; numberOfChannels: number; pcm: Float32Array };
export type AudioMetadata = { duration: number; sampleRate: number; numberOfChannels: number; encodedBytes: number };
export type TransportSource = { play: () => void; pause: () => void; seekToTime: (seconds: number) => void; readTime: () => number };

export const AUDIO_LIMITS = { duration: 360, memoryBytes: 192 * 1024 * 1024, encodedBytes: 128 * 1024 * 1024, channels: 8, sampleRate: 96000 };
