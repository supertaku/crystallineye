export function hannWindow(size: number): Float32Array {
  return Float32Array.from({ length: size }, (_, i) => size <= 1 ? 1 : 0.5 * (1 - Math.cos(2 * Math.PI * i / (size - 1))));
}
