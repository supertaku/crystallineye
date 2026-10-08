export const ANALYSIS_VERSION = 'analysis-v3.1';
export const DSP_VERSION = 'whole-track-dsp-1';
export const COMPOSER_VERSION = 'paint-composer-3.2';
export const LEGACY_COMPOSER_VERSION = 'paint-composer-3.1';
export const ANALYSIS_SAMPLE_RATE = 22050 as const;

export function analysisKey(hash: string, models: Record<string, string | undefined>): string {
  const versions = Object.keys(models).sort().map((key) => `${key}=${models[key] ?? ''}`).join('|');
  return `${hash}:${ANALYSIS_VERSION}:${versions}`;
}
