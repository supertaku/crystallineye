# V3.2 phrase-directed trajectory

Implemented on 2026-10-08, Asia/Manila. This is the Part 1 composer. Android note transcription remains behind the user's separate Part 1 artistic review gate.

`MusicAnalysis → selected mixed-recording contour → MusicalPhrase → planned timed geometry → VisualScore → native song time → existing Skia painter`

## Musical grouping and brush contact

The bounded dynamic-programming melody extractor is preserved. It selects a continuous interpretation of polyphonic predictions; it does not identify a singer or establish musical ground truth. `phrase-segmenter.ts` groups that selected line once, before rendering.

The configurable base rest threshold is `clamp(.16 + .65 × median beat period + .4 × local median note duration, .4, 1.2)` seconds. Local duration uses up to eight selected notes. Beat-period estimates ignore intervals outside .15–3 seconds; missing rhythm uses BPM or a .6-second default. A controlled experiment can override the rest setting.

The exact reference has mostly touching notes: 172 positive gaps among 613 adjacent pairs, with gap P90 about .116 seconds, P95 .209 seconds and maximum .720 seconds. A tempo-only threshold produced just two phrases over the entire song. That failed the composition review. Shorter **contextual rests** now need musical cues rather than a universal timer:

- A confident section boundary with an actual short rest can begin another phrase.
- A held predecessor followed by a confident large interval and a short rest can reset the gesture.
- A confident reversal of the recent contour with a short rest can separate gestures.
- A non-inferred, confident downbeat can strengthen a cadence/rest decision when sustain, repetition, contour reset or a substantial beat-relative gap also supports it.

The contextual gap is `clamp(baseRest × .12, .08, .2)` seconds. Section/rest uses .8 of that gap; cadence/rest uses 1.7. Sustained reset requires preceding duration at least `max(.45, beatPeriod × .65)`, an incoming interval of at least five semitones and minimum paired confidence .35. Contour reset requires at least three notes, a recent four-note trend of at least three semitones, an opposite incoming interval of at least two semitones and paired confidence .35. Cadence cues require downbeat confidence .5 and paired note confidence .3. These are inspectable artistic heuristics, not validated musicological constants.

Neither a bar ending nor elapsed four seconds splits a phrase. Every positive selected-note gap lifts brush **contact**, even when both notes belong to the same phrase. Phrase count, contact-run count and renderer section-slice count therefore mean different things. A sustained note keeps its true onset/offset and can span several bars. A selected melodic rest does not imply complete audio silence; accompaniment and prior pigment may remain visible.

## Canvas placement and note movement

`phrase-layout.ts` maintains a 12×16 occupancy grid from deposited gesture samples, with the existing 70-second pigment aging and six-second scene dissolve. Eighteen deterministic candidates combine three horizontal regions, three vertical regions and two sweep directions. Candidate evidence records continuity, available space, direction compatibility, section balance and overlap. Artistic score weights are .95, 1.65, .35, .65 and −1.25 respectively.

Nearby phrases continue from the preceding endpoint. Larger real rests permit explained airborne repositioning. Register, energy, sounding duration and pitch span influence candidate bounds. A candidate must sweep at least 0.22 canvas width in its declared direction; merely enlarging bounds around the prior endpoint must not leave the start and end at the same x coordinate. All eighteen candidates retain finite scores, eligibility and any rejection reason in diagnostics. This fixes the vertical spindle layout found during the saved-frame review.

Inside a phrase, horizontal progression allocates movement according to note duration raised to .65. Each movement still occurs during that note's actual measured onset/offset; duration weighting changes distance, not event time. Incoming pitch intervals influence vertical tendency through `tanh(interval / 7) × clamp((confidence − .15) / .65, 0, 1)²`. Phrase-scale normalization prevents an extreme interval from throwing paint off canvas. Repeated notes remain restrained, uncertain predictions have little directional authority, and a small polynomial bow adds curvature inside a sustained segment. No fixed sine/cosine loop authors the primary path.

The incoming interval moves the brush **during the incoming note**, while its onset remains connected to the previous endpoint. Comparing onset-to-onset movement with that same interval therefore measures the preceding note's motion. The comparison report retains that lagged statistic and also measures the declared onset-to-offset contract. Flat movement and pair counts are reported explicitly.

## Timed score and rendering

`gesture-generator.ts` converts phrases to contact runs and section-local stroke slices. Exact note, palette-transition and section timestamps become planned knots. Section knots are inserted before shared velocities and pressure smoothing are assigned; this preserves pressure intervals as well as position/velocity when the renderer slices a long phrase. The phrase ID and interpretation remain intact across those allocation slices.

The existing cubic Hermite painter, shared tangent limiter, pressure ribbons, exact de Casteljau prefixes, pigment shader, diffusion, local drops, washes and scene dissolve remain in place. Beat confidence still drives a causal .22-second pressure accent, at most 32% extra width. Palette confidence gates and the .6-second harmonic transition are unchanged. Pitch-color mixing remains confidence × .65; width/opacity targets and the .35-second smoothing envelope retain V3.1's material rules.

`VisualScore.trajectoryDiagnostics` stores render-ready phrase summaries, note anchors, timing, incoming intervals, boundary reasons and placement candidate scores. The DEV overlay displays previous/active/next geometry, note anchors, Bézier controls and the exact live tip. Its diagnostic index prepares geometry once and performs timestamp lookups. Rendering neither runs a neural network nor reconstructs phrase semantics from raw polyphonic notes.

With no transcription, notes remain empty. Measured brightness/energy use the same placement architecture with an explicit `dsp-fallback` label. Decoded RMS at or below `1e-5` lifts contact. Feature planning uses a bounded .2-second cadence plus exact silence, palette-transition and section boundaries rather than every DSP frame. No spectrum-derived MIDI events are fabricated.

## Versions, comparisons and remaining acceptance

`analysis-v3.1` and the expensive analysis cache keys remain unchanged. Default visuals now use `paint-composer-3.2`. A composer mismatch regenerates only the score from cached music. `composeVisualScore(analysis, {trajectory: 'legacy'})` preserves the old `paint-composer-3.1` output, including its original oscillators, for exact comparison. V2 remains available.

Painting A–D controls are separate from the retained clock A–D experiments. Preparing painting comparisons obtains genuine DSP analysis for A, uses one exact reference for B/C, and removes only notes for D while holding rhythm/harmony/dynamics/sections fixed. Mode switches pause at the trusted native position, change score geometry, and retain the same source transport. The normal bottom player still auto-hides.

Desktop comparisons require duration agreement within 1 ms. Actual native decoding of the exact MP3 is 69.66 ms longer than desktop PCM, which initially blocked the new controls despite passing the existing reference loader. The native caller now explicitly permits the loader's existing 100 ms allowance for the identical source hash and reuses that DSP cache. Mode A discloses the difference and retains measured timestamps/duration; B/C preserve the original reference. No timestamp correction, sample parity or audible alignment is implied.

Focused tests cover ascending/descending/repeated/sustained notes, separated and overlapping predictions, uncertain notes, long silence, contextual rests, no bar-only splits, exact contact bounds, deterministic placement, shared section geometry/pressure, local material targets and six-minute DSP planning bounds. [The baseline/comparison report](V3_2_REFERENCE_BASELINE.md) and [final validation](V3_2_VALIDATION.md) distinguish these checks from physical-device and artistic acceptance.

The result remains abstract pressure-ribbon painting. User preference, musical ground truth, realistic watercolor behavior, physical Android presented frames and audible synchronization cannot be inferred from numerical correspondence or desktop PNGs. Part 2 starts after the user evaluates and accepts Part 1.
