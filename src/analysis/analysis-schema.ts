import { ANALYSIS_SAMPLE_RATE, ANALYSIS_VERSION } from './versions';

export type BeatEvent = { time: number; confidence: number };
export type DownbeatEvent = BeatEvent & { inferred?: boolean };
export type NoteEvent = { start: number; end: number; midi: number; amplitude: number; confidence: number; pitchBends?: number[] };
export type ChromaFrame = { time: number; values: number[] };
export type ChordEvent = { start: number; end: number; root: number; quality: 'major' | 'minor' | 'unknown'; confidence: number };
export type FeatureFrame = { time: number; rms: number; energy: number; bass: number; brightness: number; onset: number };
export type SectionEvent = { start: number; end: number; label: string; confidence: number };
export type MusicAnalysis = {
  version: string;
  track: { hash: string; duration: number; analysisSampleRate: typeof ANALYSIS_SAMPLE_RATE };
  rhythm: { bpm: number | null; beats: BeatEvent[]; downbeats: DownbeatEvent[]; meter?: number };
  notes: NoteEvent[];
  harmony: { chromaFrames: ChromaFrame[]; chords: ChordEvent[] };
  dynamics: FeatureFrame[];
  structure: { segments: SectionEvent[] };
  modelVersions: { transcription?: string; beatTracking?: string; structure?: string; features?: string; harmony?: string };
  quality: 'FULL' | 'PARTIAL' | 'BASIC';
  warnings: string[];
};
export type AnalysisStage = 'decode' | 'transcription' | 'rhythm' | 'harmony' | 'structure' | 'visual-score';
export type AnalysisProgress = { stage: AnalysisStage; stageProgress: number; overallProgress: number };

function fail(path: string): never { throw new Error(`Invalid music analysis: ${path}.`); }
function object(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(path);
  return value as Record<string, unknown>;
}
function numeric(value: unknown, path: string, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) fail(path);
  return value;
}
function list(value: unknown, path: string, max = 50000): unknown[] {
  if (!Array.isArray(value) || value.length > max) fail(path);
  return value;
}

/** Validate imported reference data and disk caches before they reach the composer. */
export function parseMusicAnalysis(value: unknown): MusicAnalysis {
  const data = object(value, 'root');
  if (data.version !== ANALYSIS_VERSION) fail('schema version');
  const track = object(data.track, 'track');
  if (typeof track.hash !== 'string' || !/^[a-f0-9]{64}$/.test(track.hash)) fail('track hash');
  const duration = numeric(track.duration, 'duration', 0.001, 360);
  if (track.analysisSampleRate !== ANALYSIS_SAMPLE_RATE) fail('analysis sample rate');
  const rhythm = object(data.rhythm, 'rhythm');
  if (rhythm.bpm !== null) numeric(rhythm.bpm, 'bpm', 20, 400);
  if (rhythm.meter !== undefined) numeric(rhythm.meter, 'meter', 2, 12);
  const confidence = (v: unknown) => numeric(v, 'confidence', 0, 1);
  const timed = (value: unknown, path: string, interval: boolean, inspect: (event: Record<string, unknown>) => void, max?: number) => {
    let previous = -1;
    for (const item of list(value, path, max)) {
      const event = object(item, path);
      const time = numeric(interval ? event.start : event.time, `${path} time`, 0, duration);
      if (time < previous) fail(`${path} order`);
      previous = time;
      if (interval && numeric(event.end, `${path} end`, 0, duration) <= time) fail(`${path} interval`);
      inspect(event);
    }
  };
  timed(rhythm.beats, 'beats', false, (e) => { confidence(e.confidence); }, 5000);
  timed(rhythm.downbeats, 'downbeats', false, (e) => {
    confidence(e.confidence);
    if (e.inferred !== undefined && typeof e.inferred !== 'boolean') fail('inferred downbeat');
  }, 5000);
  timed(data.notes, 'notes', true, (e) => {
    const midi = numeric(e.midi, 'note pitch', 0, 127);
    if (!Number.isInteger(midi)) fail('note pitch');
    confidence(e.amplitude); confidence(e.confidence);
    if (e.pitchBends !== undefined) list(e.pitchBends, 'pitch bends', 10000).forEach((b) => numeric(b, 'pitch bend', -128, 128));
  });
  const harmony = object(data.harmony, 'harmony');
  timed(harmony.chromaFrames, 'chroma', false, (e) => {
    const values = list(e.values, 'chroma values', 12);
    if (values.length !== 12) fail('chroma length');
    values.forEach((v) => confidence(v));
  });
  timed(harmony.chords, 'chords', true, (e) => {
    if (!['major', 'minor', 'unknown'].includes(e.quality as string)) fail('chord quality');
    const root = numeric(e.root, 'chord root', 0, 11);
    if (!Number.isInteger(root)) fail('chord root');
    confidence(e.confidence);
  });
  timed(data.dynamics, 'dynamics', false, (e) => {
    numeric(e.rms, 'rms', 0, 8);
    ['energy', 'bass', 'brightness', 'onset'].forEach((key) => confidence(e[key]));
  });
  const structure = object(data.structure, 'structure');
  let end = 0;
  timed(structure.segments, 'sections', true, (e) => {
    if (typeof e.label !== 'string' || e.label.length > 80 || Math.abs((e.start as number) - end) > 0.001) fail('section coverage');
    confidence(e.confidence); end = e.end as number;
  }, 100);
  if (Math.abs(end - duration) > 0.001) fail('section coverage');
  if (!['FULL', 'PARTIAL', 'BASIC'].includes(data.quality as string)) fail('quality');
  list(data.warnings, 'warnings', 50).forEach((v) => { if (typeof v !== 'string' || v.length > 1000) fail('warning'); });
  const versions = object(data.modelVersions, 'model versions');
  for (const [key, version] of Object.entries(versions)) {
    if (!['transcription', 'beatTracking', 'structure', 'features', 'harmony'].includes(key) || typeof version !== 'string' || version.length > 160) fail('model version');
  }
  return data as unknown as MusicAnalysis;
}
