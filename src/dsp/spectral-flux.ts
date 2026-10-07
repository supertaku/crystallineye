export function spectralFlux(current: Float32Array, previous: Float32Array | null): number {
  if (!previous || current.length !== previous.length) return 0;
  let flux = 0;
  for (let k = 0; k < current.length; k++) flux += Math.max(0, current[k]! - previous[k]!);
  return flux;
}
