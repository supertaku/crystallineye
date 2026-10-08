import type { MusicAnalysis, NoteEvent } from './analysis-schema';
import { describeMelodicContour } from './melodic-contour';
import type { MusicalPhrase, PhraseSegmentationOptions } from './phrase-types';

const median = (values: number[], fallback: number) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted.length ? sorted[Math.floor(sorted.length / 2)]! : fallback;
};

/** SelectedMelody -> phrases. Beat/bar boundaries are cues only when there is a rest. */
export function segmentPhrases(selectedMelody: NoteEvent[], analysis: MusicAnalysis, options: PhraseSegmentationOptions = {}): MusicalPhrase[] {
  const notes = selectedMelody.filter(note => note.confidence >= (options.minimumConfidence ?? .15) && note.end > note.start)
    .map(note => ({ ...note })).sort((a, b) => a.start - b.start || a.midi - b.midi || a.end - b.end);
  if (!notes.length) return [];
  const minRest = Math.max(.05, options.minRestSeconds ?? .4), maxRest = Math.max(minRest, options.maxRestSeconds ?? 1.2);
  const periods = analysis.rhythm.beats.slice(1).map((beat, index) => beat.time - analysis.rhythm.beats[index]!.time).filter(period => period >= .15 && period <= 3);
  const beatPeriod = median(periods, analysis.rhythm.bpm ? 60 / analysis.rhythm.bpm : .6);
  const thresholdAt = (index: number) => Math.max(minRest, Math.min(maxRest, options.restSeconds ??
    (.16 + beatPeriod * .65 + median(notes.slice(Math.max(0, index - 7), index + 1).map(note => note.end - note.start), .3) * .4)));
  const groups: { notes: NoteEvent[]; reason: MusicalPhrase['boundaryReason']; threshold: number }[] = [];
  let current = { notes: [notes[0]!], reason: 'track-start' as MusicalPhrase['boundaryReason'], threshold: thresholdAt(0) };
  for (let index = 1; index < notes.length; index++) {
    const note = notes[index]!, prior = notes[index - 1]!, gap = Math.max(0, note.start - prior.end), threshold = thresholdAt(index);
    const sectionCue = analysis.structure.segments.some(section => section.start > prior.start && section.start <= note.start && section.confidence >= .35);
    const largeInterval = Math.abs(note.midi - prior.midi) > 12 && Math.min(note.confidence, prior.confidence) >= .45;
    const downbeatCue = analysis.rhythm.downbeats.some(beat => !beat.inferred && beat.confidence >= .5 && Math.abs(beat.time - note.start) <= .12);
    // Full-mix contour selection bridges much of a song: its long-rest threshold
    // cannot stand in for phrasing. A shorter actual rest needs independent cues.
    const contextualRest = Math.max(.08, Math.min(.2, threshold * .12));
    const incomingInterval = note.midi - prior.midi;
    const recent = current.notes.slice(-4), recentTrend = prior.midi - recent[0]!.midi;
    const confidence = Math.min(note.confidence, prior.confidence);
    const contourReset = current.notes.length >= 3 && confidence >= .35 && Math.abs(recentTrend) >= 3
      && Math.abs(incomingInterval) >= 2 && recentTrend * incomingInterval < 0;
    const heldPrior = prior.end - prior.start >= Math.max(.45, beatPeriod * .65);
    const reason = gap >= threshold || (downbeatCue && gap >= threshold * .75) ? 'phrase-rest'
      : sectionCue && gap >= contextualRest * .8 ? 'section-rest'
      : largeInterval && gap >= threshold * .3 ? 'interval-rest'
      : confidence >= .35 && heldPrior && Math.abs(incomingInterval) >= 5 && gap >= contextualRest ? 'sustained-rest'
      : downbeatCue && confidence >= .3 && current.notes.length >= 3 && gap >= contextualRest * 1.7
        && (incomingInterval === 0 || heldPrior || contourReset || gap >= beatPeriod * .4) ? 'cadence-rest'
      : contourReset && gap >= contextualRest ? 'contour-rest' : undefined;
    if (reason) { groups.push(current); current = { notes: [note], reason, threshold }; }
    else current.notes.push(note);
  }
  groups.push(current);
  return groups.map((group, index) => {
    const start = group.notes[0]!.start, end = Math.max(...group.notes.map(note => note.end));
    const features = analysis.dynamics.filter(frame => frame.time >= start && frame.time < end);
    const soundingSeconds = group.notes.reduce((sum, note) => sum + note.end - note.start, 0);
    return { id: `phrase-${index}`, start, end, notes: group.notes,
      pitchMin: Math.min(...group.notes.map(note => note.midi)), pitchMax: Math.max(...group.notes.map(note => note.midi)),
      averageEnergy: features.reduce((sum, frame) => sum + frame.energy, 0) / Math.max(1, features.length),
      contour: describeMelodicContour(group.notes),
      confidence: group.notes.reduce((sum, note) => sum + note.confidence * (note.end - note.start), 0) / soundingSeconds,
      restThreshold: group.threshold, boundaryReason: group.reason,
      sectionIndices: analysis.structure.segments.flatMap((section, sectionIndex) => section.start < end && section.end > start ? [sectionIndex] : []) };
  });
}
