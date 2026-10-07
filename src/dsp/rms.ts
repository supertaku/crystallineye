export function rms(samples: ArrayLike<number>, length = samples.length): number {
  if (length <= 0) return 0;
  let sum = 0;
  for (let i = 0; i < length; i++) sum += (samples[i] ?? 0) ** 2;
  return Math.sqrt(sum / length);
}
