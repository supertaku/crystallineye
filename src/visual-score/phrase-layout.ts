import type { MelodicDirection } from '../analysis/phrase-types';
import type { PhraseCandidateScore, Point, StrokeEvent } from './schema';

const COLUMNS = 12, ROWS = 16, MARGIN = .07;
const MIN_HORIZONTAL_SWEEP = .22;
export type PhraseBounds = { left: number; right: number; top: number; bottom: number };
export type PhraseLayout = {
  candidateId: string;
  reason: string;
  startPosition: Point;
  endPosition: Point;
  bounds: PhraseBounds;
  candidates: PhraseCandidateScore[];
};
export type LayoutRequest = {
  start: number;
  end: number;
  soundingSeconds: number;
  energy: number;
  register: number;
  pitchSpan: number;
  direction: MelodicDirection;
  sceneIndex: number;
};
type OccupiedCell = { index: number; weight: number; createdAt: number; sceneEnd: number };
export type PhraseLayoutState = {
  marks: OccupiedCell[];
  previous?: { position: Point; end: number; sceneIndex: number; pigment: { width: number; opacity: number } };
};
export const createPhraseLayoutState = (): PhraseLayoutState => ({ marks: [] });
const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value));
const cellAt = (point: Point) => Math.min(ROWS - 1, Math.max(0, Math.floor(point.y * ROWS))) * COLUMNS
  + Math.min(COLUMNS - 1, Math.max(0, Math.floor(point.x * COLUMNS)));

/** Small fixed candidate set: measured musical shape competes for visible canvas space. */
export function choosePhraseLayout(request: LayoutRequest, state: PhraseLayoutState): PhraseLayout {
  state.marks = state.marks.filter(mark => mark.sceneEnd + 6 > request.start);
  const occupied = Array.from({ length: COLUMNS * ROWS }, () => 0);
  for (const mark of state.marks) occupied[mark.index]! += mark.weight * Math.exp(-Math.max(0, request.start - mark.createdAt) / 70)
    * clamp(1 - Math.max(0, request.start - mark.sceneEnd) / 6, 0, 1);
  const width = clamp(.29 + Math.sqrt(request.soundingSeconds) * .045 + request.energy * .08, .3, .68);
  const height = clamp(.16 + Math.tanh(request.pitchSpan / 9) * .29 + request.energy * .07, .16, .58);
  const prior = state.previous, gap = prior ? Math.max(0, request.start - prior.end) : Infinity;
  const keepOrigin = prior && gap < .4;
  const desiredY = .5 - Math.tanh((request.register - 60) / 24) * .22;
  const candidates: (PhraseLayout & { score: number; eligible: boolean })[] = [];
  for (const centerY of [.22, .5, .78]) for (const centerX of [.25, .5, .75]) for (const sign of [1, -1]) {
    const left = clamp(centerX - width / 2, MARGIN, 1 - MARGIN - width);
    const top = clamp(centerY - height / 2, MARGIN, 1 - MARGIN - height);
    const bounds = { left, right: left + width, top, bottom: top + height };
    const tendency = request.direction === 'ascending' ? -.7 : request.direction === 'descending' ? .7 : 0;
    const startPosition = keepOrigin ? { ...prior.position }
      : { x: sign > 0 ? bounds.left : bounds.right, y: top + height * (.5 - tendency * .43) };
    if (keepOrigin) {
      bounds.left = Math.min(bounds.left, startPosition.x); bounds.right = Math.max(bounds.right, startPosition.x);
      bounds.top = Math.min(bounds.top, startPosition.y); bounds.bottom = Math.max(bounds.bottom, startPosition.y);
    }
    const endPosition = { x: sign > 0 ? bounds.right : bounds.left, y: top + height * (.5 + tendency * .43) };
    const sampled = Array.from({ length: 11 }, (_, index) => ({ x: startPosition.x + (endPosition.x - startPosition.x) * index / 10,
      y: startPosition.y + (endPosition.y - startPosition.y) * index / 10 }));
    const overlap = sampled.reduce((sum, point) => sum + Math.min(1, occupied[cellAt(point)]! / 2), 0) / sampled.length;
    const continuity = prior ? Math.exp(-Math.hypot(startPosition.x - prior.position.x, startPosition.y - prior.position.y) / (.18 + Math.min(2, gap) * .18)) : 1;
    // Bounds may expand around a prior tip, but a candidate must still sweep
    // in its declared direction. Space alone must never select a vertical spindle.
    const signedSpan = (endPosition.x - startPosition.x) * sign;
    const eligible = signedSpan >= MIN_HORIZONTAL_SWEEP;
    const directionCompatibility = eligible ? 1 : 0;
    const rowUsage = occupied.slice(Math.floor(centerY * ROWS) * COLUMNS, (Math.floor(centerY * ROWS) + 1) * COLUMNS).reduce((sum, value) => sum + value, 0);
    const sectionBalance = 1 / (1 + rowUsage * .2) - Math.abs(centerY - desiredY) * .24;
    const availableSpace = 1 - overlap;
    // Artistic weights, recorded in score diagnostics; not musical constants.
    const score = continuity * .95 + availableSpace * 1.65 + directionCompatibility * .35 + sectionBalance * .65 - overlap * 1.25;
    const id = `r${Math.round(centerY * 100)}-c${Math.round(centerX * 100)}-${sign > 0 ? 'right' : 'left'}`;
    candidates.push({ candidateId: id, startPosition, endPosition, bounds, candidates: [], score, eligible,
      reason: '', });
    candidates.at(-1)!.candidates = [{ id, score, continuity, availableSpace, directionCompatibility, sectionBalance, overlap, eligible,
      ...(eligible ? {} : { rejectionReason: 'The candidate cannot sweep at least 0.22 canvas width in its declared direction.' }) }];
  }
  candidates.sort((a, b) => b.score - a.score || (a.candidateId < b.candidateId ? -1 : a.candidateId > b.candidateId ? 1 : 0));
  const selected = candidates.find(candidate => candidate.eligible);
  if (!selected) throw new Error('No bounded phrase layout can provide a coherent horizontal sweep.');
  return { candidateId: selected.candidateId, startPosition: selected.startPosition, endPosition: selected.endPosition, bounds: selected.bounds,
    candidates: candidates.map(candidate => candidate.candidates[0]!),
    reason: `${keepOrigin ? 'Continue from the preceding endpoint' : prior ? 'Reposition during the selected rest' : 'Place the first phrase'}; ${request.direction} contour; candidate ${selected.candidateId} sweeps ${Math.abs(selected.endPosition.x - selected.startPosition.x).toFixed(3)} canvas width and scores ${selected.score.toFixed(3)} for continuity, free space and balance.` };
}

/** Occupancy follows actual deposited knots, with the same six-second scene retention. */
export function retainGestureOccupancy(state: PhraseLayoutState, strokes: StrokeEvent[], sceneEnds: Map<number, number>): void {
  for (const stroke of strokes) {
    const cells = new Map<number, { weight: number; time: number }>();
    for (let index = 1; index < stroke.points.length; index++) {
      const from = stroke.points[index - 1]!, to = stroke.points[index]!;
      const count = Math.max(2, Math.ceil(Math.hypot(to.x - from.x, to.y - from.y) * Math.max(COLUMNS, ROWS) * 2));
      for (let step = 0; step <= count; step++) {
        const u = step / count, cell = cellAt({ x: from.x + (to.x - from.x) * u, y: from.y + (to.y - from.y) * u });
        cells.set(cell, { weight: Math.max(cells.get(cell)?.weight ?? 0, .35 + to.width * 18), time: from.time + (to.time - from.time) * u });
      }
    }
    for (const [index, sample] of cells) state.marks.push({ index, weight: sample.weight, createdAt: sample.time, sceneEnd: sceneEnds.get(stroke.sceneIndex) ?? stroke.end });
  }
  const final = strokes.at(-1);
  if (final) {
    const point = final.points.at(-1)!;
    state.previous = { position: { x: point.x, y: point.y }, end: final.end, sceneIndex: final.sceneIndex,
      pigment: { width: point.width, opacity: point.opacity } };
  }
}
