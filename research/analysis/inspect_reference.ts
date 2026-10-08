/** Aggregate model diagnostics, never transcription accuracy or listening truth. */
import fs from 'node:fs';
import path from 'node:path';
import { parseMusicAnalysis, type NoteEvent } from '../../src/analysis/analysis-schema';
import { extractMelody } from '../../src/analysis/melody-extractor';

const reference = path.resolve(process.argv[2] ?? '');
const output = path.resolve(process.argv[3] ?? 'research/results/true-colors');
const analysis = parseMusicAnalysis(JSON.parse(fs.readFileSync(reference, 'utf8')));
const quantiles = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted.length ? { min: sorted[0], p25: sorted[Math.floor((sorted.length - 1) * .25)],
    median: sorted[Math.floor((sorted.length - 1) * .5)], p75: sorted[Math.floor((sorted.length - 1) * .75)], max: sorted[sorted.length - 1] } : null;
};
function noteSummary(notes: NoteEvent[]) {
  const sorted = [...notes].sort((a, b) => a.start - b.start);
  const edges = notes.flatMap(note => [{ time: note.start, delta: 1 }, { time: note.end, delta: -1 }]).sort((a, b) => a.time - b.time || a.delta - b.delta);
  let active = 0, maxPolyphony = 0, coverage = 0, previous = 0;
  for (const edge of edges) {
    if (active) coverage += edge.time - previous;
    active += edge.delta; maxPolyphony = Math.max(maxPolyphony, active); previous = edge.time;
  }
  const jumps = sorted.slice(1).map((note, i) => Math.abs(note.midi - sorted[i]!.midi));
  return { count: notes.length, durationSeconds: quantiles(notes.map(note => note.end - note.start)),
    confidence: quantiles(notes.map(note => note.confidence)), midiPitch: quantiles(notes.map(note => note.midi)),
    coverageSeconds: coverage, coverageFraction: coverage / analysis.track.duration, maxPolyphony,
    jumpsOverOctave: jumps.filter(jump => jump > 12).length, adjacentPitchJumpSemitones: quantiles(jumps) };
}
const rhythmSummary = (rhythm: typeof analysis.rhythm) => ({ beats: rhythm.beats.length, downbeats: rhythm.downbeats.length, bpm: rhythm.bpm,
  beatIntervalsSeconds: quantiles(rhythm.beats.slice(1).map((beat, i) => beat.time - rhythm.beats[i]!.time)),
  beatConfidence: quantiles(rhythm.beats.map(beat => beat.confidence)), downbeatConfidence: quantiles(rhythm.downbeats.map(beat => beat.confidence)) });
const melody = extractMelody(analysis.notes);
const result: Record<string, unknown> = { sourceHash: analysis.track.hash, durationSeconds: analysis.track.duration,
  modelVersions: analysis.modelVersions, notes: noteSummary(analysis.notes), melody: noteSummary(melody), small0: rhythmSummary(analysis.rhythm),
  chords: { count: analysis.harmony.chords.length, unknown: analysis.harmony.chords.filter(chord => chord.quality === 'unknown').length,
    confidence: quantiles(analysis.harmony.chords.map(chord => chord.confidence)) },
  sections: analysis.structure.segments.map(section => ({ ...section })),
  evidenceMeaning: 'Model output and algorithm properties only; no human annotations or transcription/beat accuracy claim.' };
const finalFile = path.join(path.dirname(reference), 'rhythm-final0.json');
if (fs.existsSync(finalFile)) {
  const final = JSON.parse(fs.readFileSync(finalFile, 'utf8')) as typeof analysis.rhythm;
  result.final0 = rhythmSummary(final);
  const agreement = (first: { time: number }[], second: { time: number }[]) => {
    let left = 0, right = 0, matches = 0;
    const errors: number[] = [];
    while (left < first.length && right < second.length) {
      const delta = first[left]!.time - second[right]!.time;
      if (Math.abs(delta) <= .07) { matches++; errors.push(Math.abs(delta)); left++; right++; }
      else if (delta < 0) left++; else right++;
    }
    return { toleranceSeconds: .07, oneToOneMatches: matches, symmetricAgreement: 2 * matches / Math.max(1, first.length + second.length),
      matchedAbsoluteOffsetSeconds: quantiles(errors), meaning: 'Inter-model agreement, not accuracy against ground truth' };
  };
  result.rhythmAgreement = { beats: agreement(analysis.rhythm.beats, final.beats), downbeats: agreement(analysis.rhythm.downbeats, final.downbeats) };
}
// Candidate times come from predictions. These are review prompts, never human observations.
const sustained = [...melody].sort((a, b) => (b.end - b.start) - (a.end - a.start))[0];
result.reviewCandidates = sustained ? [{ start: Math.max(0, sustained.start - 1), end: Math.min(analysis.track.duration, sustained.end + 1),
  reason: 'Longest selected model-note interval; listen to verify which musical layer this represents', predictedMidi: sustained.midi }] : [];
fs.mkdirSync(output, { recursive: true });
fs.writeFileSync(path.join(output, 'model-summary.json'), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result, null, 2));
