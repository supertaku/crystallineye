export function clamp(value: number, min = 0, max = 1): number {
  return Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : min;
}
