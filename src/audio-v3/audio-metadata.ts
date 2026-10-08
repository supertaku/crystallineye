export type ByteReader = (offset: number, count: number) => Uint8Array;
const text = (data: Uint8Array, start: number, length: number) => String.fromCharCode(...data.subarray(start, start + length));

/** Read bounded container headers before allocating PCM. Unknown headers fail closed. */
export function inspectAudioHeader(read: ByteReader, size: number): { sampleRate: number; numberOfChannels: number } {
  const head = read(0, Math.min(size, 65536));
  const view = new DataView(head.buffer, head.byteOffset, head.byteLength);
  if (head.length >= 12 && text(head, 0, 4) === 'RIFF' && text(head, 8, 4) === 'WAVE') {
    let offset = 12;
    for (let count = 0; count < 1000 && offset + 8 <= size; count++) {
      const header = read(offset, 24);
      if (header.length < 8) break;
      const dv = new DataView(header.buffer, header.byteOffset, header.byteLength);
      if (text(header, 0, 4) === 'fmt ' && header.length >= 16) return { numberOfChannels: dv.getUint16(10, true), sampleRate: dv.getUint32(12, true) };
      offset += 8 + dv.getUint32(4, true) + (dv.getUint32(4, true) % 2);
    }
  }
  if (head.length >= 26 && text(head, 0, 4) === 'fLaC' && (head[4]! & 127) === 0) {
    const packed = view.getUint32(18, false);
    return { sampleRate: packed >>> 12, numberOfChannels: ((packed >>> 9) & 7) + 1 };
  }
  if (text(head, 0, 4) === 'OggS') {
    const position = Array.from(head).findIndex((_, i) => text(head, i, 8) === 'OpusHead');
    if (position >= 0 && position + 10 <= head.length) return { sampleRate: 48000, numberOfChannels: head[position + 9]! };
    for (let i = 0; i + 16 < head.length; i++) if (head[i] === 1 && text(head, i + 1, 6) === 'vorbis') return { numberOfChannels: head[i + 11]!, sampleRate: view.getUint32(i + 12, true) };
  }
  if (head.length >= 8 && text(head, 4, 4) === 'ftyp') {
    let visited = 0;
    const walk = (start: number, end: number, depth: number): { sampleRate: number; numberOfChannels: number } | null => {
      if (depth > 8) return null;
      for (let offset = start; offset + 8 <= end && visited++ < 4000;) {
        const bytes = read(offset, Math.min(40, end - offset));
        if (bytes.length < 8) return null;
        const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
        const tag = text(bytes, 4, 4);
        let length = dv.getUint32(0, false), header = 8;
        if (length === 1 && bytes.length >= 16) { length = dv.getUint32(8, false) * 4294967296 + dv.getUint32(12, false); header = 16; }
        if (length === 0) length = end - offset;
        if (length < header || length > end - offset) return null;
        if (['mp4a', 'alac', 'fLaC', 'Opus'].includes(tag) && header === 8 && bytes.length >= 36) {
          // AAC SBR/PS can increase the rate or channel count beyond the base header.
          const rate = dv.getUint32(32, false) / 65536;
          return { numberOfChannels: Math.max(2, dv.getUint16(24, false)), sampleRate: tag === 'mp4a' ? Math.max(48000, rate) : rate };
        }
        if (['moov', 'trak', 'mdia', 'minf', 'stbl', 'stsd'].includes(tag)) {
          const found = walk(offset + header + (tag === 'stsd' ? 8 : 0), offset + length, depth + 1);
          if (found) return found;
        }
        offset += length;
      }
      return null;
    };
    const found = walk(0, size, 0);
    if (found) return found;
  }
  let start = 0;
  if (head.length >= 10 && text(head, 0, 3) === 'ID3') start = 10 + ((head[6]! & 127) * 2097152 + (head[7]! & 127) * 16384 + (head[8]! & 127) * 128 + (head[9]! & 127)) + ((head[5]! & 16) ? 10 : 0);
  const frames = start >= head.length ? read(start, Math.min(65536, size - start)) : head.subarray(start);
  for (let i = 0; i + 7 < frames.length; i++) {
    if (frames[i] !== 255 || (frames[i + 1]! & 224) !== 224) continue;
    const version = (frames[i + 1]! >>> 3) & 3, layer = (frames[i + 1]! >>> 1) & 3, rateIndex = (frames[i + 2]! >>> 2) & 3;
    if (version !== 1 && layer !== 0 && rateIndex !== 3 && (frames[i + 2]! >>> 4) > 0 && (frames[i + 2]! >>> 4) < 15) {
      return { sampleRate: [44100, 48000, 32000][rateIndex]! / (version === 3 ? 1 : version === 2 ? 2 : 4), numberOfChannels: (frames[i + 3]! >>> 6) === 3 ? 1 : 2 };
    }
    if ((frames[i + 1]! & 246) === 240) {
      const channels = ((frames[i + 2]! & 1) << 2) | (frames[i + 3]! >>> 6);
      if (channels >= 1 && channels <= 2) return { sampleRate: 96000, numberOfChannels: 2 }; // conservative AAC bound
    }
  }
  throw new Error('I could not read safe audio metadata. Try a standard WAV, MP3, FLAC, OGG, or M4A file.');
}
