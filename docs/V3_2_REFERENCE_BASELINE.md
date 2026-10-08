# V3.2 exact-source baseline and trajectory comparison

I inspected and froze this baseline on **2026-10-08, Asia/Manila**, before replacing the V3.1 composer. This document separates executable desktop evidence from the user's artistic review and physical playback checks.

## Starting state

The actual starting commit is `b232a4a318300caaf4a7142544ef0e8fac74a595`. The lead preserved the existing JOURNAL.md change and created `codex/v3.2-melody-driven-paint-mobile-ml`. Fresh baseline lint, TypeScript and **87/87 tests** passed. Installed versions are Node 22.20.0, npm 11.18.0, Expo 57.0.27, React Native 0.86.3, Audio API 0.13.6, Skia 2.6.2 and Reanimated 4.5.1.

The existing Android debug APK is present; its earlier build is historical evidence. No phone is connected to ADB in this task. The journal says the user copied an APK onto a phone, so phone availability is not being denied. Installation, audible synchronization, native guide appearance, actual presented frames and user preference have not been verified here.

## Source and saved reference

I hashed `music/Justin Timberlake, Anna Kendrick - True Colors (Lyric).mp3` locally. Its SHA-256 is **`72621718f6e76530d87400479aed14bf7e1d7bf6ba71f857815db83007d45c92`**, exactly matching the saved FULL reference at `.build-tools/true-colors-allinone/true-colors.analysis.json`. `parseMusicAnalysis()` accepted its ordered timestamps and complete section coverage. Duration is **243.39156462585035 seconds**, with 22,050 Hz analysis audio and schema `analysis-v3.1`.

| Saved reference field | Verified count/version |
| --- | ---: |
| Polyphonic note predictions | 2,076 |
| Selected melodic contour notes | 614 |
| Beats / downbeats | 286 / 98 |
| Chord intervals / chroma frames | 210 / 1,217 |
| Dynamics frames / covering sections | 10,482 / 14 |
| Transcription | `basic-pitch-0.4.0-onnx` |
| Rhythm | `beat-this-1.1.0-small0` |
| Structure | `allin1-infer-3.1.0-harmonix-all` |
| Features / harmony | `whole-track-dsp-1` / `chroma-templates-1` |

These are prior desktop model predictions whose identity and schema I checked again, not a new inference run or verified singer transcription. FULL records subsystem availability. Note confidence is mean activation, and All-In-One's 0.5 section confidence is an uncalibrated placeholder. [The reference report](TRUE_COLORS_ANALYSIS.md) records inference provenance and limitations.

I froze the exact parsed analysis and legacy score under ignored `.build-tools/v32-baseline/`. The JSON serialization SHA-256 values are `44a57f6b8c9ddfab8dc327b6b46450194c2fcc67711b06ca6ead0524a7087a2d` for `full.analysis.json` and `149feb8833f43cfdf44ce9066ce43a7984625fdca01e582ac2b63dc0a10aed80` for `full.legacy.score.json`. These hashes describe the frozen serialized data, not the original formatting of the input JSON.

| Frozen `paint-composer-3.1` FULL score | Count |
| --- | ---: |
| Scenes / strokes | 14 / 149 |
| Timed stroke points | 1,981 |
| Local drops / washes / beat accents | 89 / 142 / 243 |

Earlier PARTIAL controlled comparisons used different fixed harmony/sections and had 155 strokes. That historical count does not describe this FULL score.

## What authors the old trajectory

`stroke-generator.ts` accumulates `contactSeconds` from the musical timestamps of sounding intervals. Silence pauses that accumulator. Horizontal position is primarily `0.5 - 0.36 * cos(contactSeconds * 0.25)`, a repeating sweep with about 25.13 sounding seconds per cycle. Its vertical target combines confidence-scaled track-relative pitch with `0.055 * sin(contactSeconds * 0.2)` and a 0.35-second exponential smoothing envelope. Pitch therefore decorates an independently repeating horizontal path.

Downbeats, section edges and bounded four-second chunks split allocation. Notes separated by at most 100 ms can share contact; larger gaps lift it. The cursor carries previous position, width, opacity and planned velocity, so V3.1 avoids the earlier origin jumps while retaining the oscillator. This precise implementation remains selectable with `composeVisualScore(analysis, { trajectory: 'legacy' })`, including the old composer version and score shape.

## Controlled modes

| Mode | Trajectory | Musical input |
| --- | --- | --- |
| A | Preserved V3.1 | Actual TypeScript DSP measured again from the exact normalized PCM; notes empty |
| B | Preserved V3.1 | Exact FULL desktop reference |
| C | New phrase planner | Exactly the same FULL analysis as B |
| D | New phrase planner | Same FULL rhythm, harmony, dynamics and sections as C; only notes/transcription provenance removed |

B versus C isolates trajectory/contact composition using the same palette algorithm, harmonic timeline, pitch-color rule and desktop renderer. Their point timing and pigment-run lists can differ, so cross-planner pixel equality is not an acceptance requirement. D is a **note ablation**, meaning a controlled removal of note evidence. It is not labeled a wholly DSP analysis. A is obtained through the real fallback analyzer rather than cloning FULL and erasing its notes.

`scripts/compare-v32.ts` verifies source hash, parser validity, exact PCM length, matched B/C analyses, fixed C/D non-note fields, harmonic palette equality and unchanged frozen B. It rejects output folders outside the ignored `.build-tools/` and `research/results/generated/` roots. Scores, timestamps and PNGs stay local; this tracked document contains only aggregate evidence and a few review candidates.

## Measurement definitions

| Measurement | Reproducible definition and practical limit |
| --- | --- |
| Total travel | Sum of distances along each renderer cubic sampled at 32 subdivisions; normalized canvas units; excludes airborne repositioning |
| Connected discontinuities | Adjacent temporal endpoints within 1 microsecond must share position; position mismatch over `1e-8` counts as unexplained; positive gaps are lifts and have their own reposition distance |
| Velocity continuity | Maximum Euclidean velocity difference at internal cubic knots and connected stroke edges; does not demand equal velocity across a rest |
| Gesture / phrase count | Stroke count includes contact and scene slices; precomputed phrase count is reported separately |
| Repeated shape | 32 equal-time samples per gesture, centered and divided by RMS radius; orientation/time profile retained; nearest shape RMS at most 0.08 is a match; stationary paths excluded; reports matching fraction and nearest-distance median |
| Brush coverage | Union of pressure-expanded cells in a 24×48 grid at the common 360×800 aspect; excludes washes, drops, diffusion and scene aging; PNG painted-pixel fractions are reported separately |
| Pitch / motion | Incoming selected-note interval versus upward displacement during that next note, within the same phrase and at most a 100 ms contact gap; reports pair count, correlation, directional agreement and flat movement count |
| Lagged onset statistic | Successive onset-position movement against incoming interval, retained descriptively because it measures the preceding note's motion |
| Onset / offset alignment | Nearest timed knot in the associated phrase's overlapping contact runs, or overlapping legacy strokes; missing notes are counted rather than matched to arbitrary distant knots |
| Phrase alignment | Associated stroke envelope onset and duration versus precomputed phrase timing; legacy scores honestly have no phrase diagnostic |
| Direction-change timing | Nearest vertical-velocity sign reversal sampled at 50 ms relative to predicted interval reversal; descriptive proximity, not causality or ground-truth accuracy |
| Rest representation | Exact union of selected predicted notes versus union of score contact; reports uncovered notes and contact inside internal selected gaps; accompaniment may continue in those gaps |
| Phrase horizontal span | Full phrase union of actual renderer cubic x positions, including contact and section slices, at 32 subdivisions per cubic; planned displacement is listed separately; actual span at most `1e-6` is degenerate and below 0.18 is narrow |

Repeated musical motifs or straight gestures can match the shape metric too. It cannot by itself establish an artificial loop or artistic quality. Larger coverage/travel and more gestures also do not automatically mean a better painting.

## Review iteration and final evidence

The first implementation produced only two phrases over this recording, leaving phrase placement too little opportunity to reorganize the canvas. Its initial pigment constants and fallback sampling also differed from the agreed control. I kept its full report/PNGs at `.build-tools/v32-iteration1/` and requested correction. Its onset-to-onset pitch statistic was also one note behind the planner's declared interval timing; the corrected contract measure is independently backed by synthetic trajectory tests.

The later contextual grouping produced 25 phrases and restored V3.1's pigment formula and 0.35-second pressure/opacity smoothing. Exact section knots now preserve those pressure intervals across renderer slices. Intermediate reports remain in `.build-tools/v32-iteration2/` and `v32-iteration3/`. Their near-vertical placement candidates failed developer image review: expanding bounds around a previous tip could make the candidate endpoint equal its origin. The final layout rejects any candidate whose signed horizontal displacement is below **0.22 canvas width**, while continuing from the previous tip during nearby phrases. All 18 candidates retain finite scores, and rejected candidates explain why they are unavailable.

I reran the authoritative comparison after that correction on **2026-10-08, Asia/Manila**. The original MP3 hash matched FULL again. Normalized PCM SHA-256 is `307d106f2ef78bbb8b18f8ca6b19a7fe7b1ee9417ce369f192eaa335447f16cb`: 5,366,784 mono samples at 22,050 Hz, exactly 243.39156462585035 seconds. Actual TypeScript DSP was remeasured from those samples. Its 10,482 frame timestamps match FULL exactly; maximum absolute RMS/energy/bass/brightness/onset differences are **3.00e-8 / 1.56e-7 / 2.77e-8 / 2.02e-8 / 4.47e-8**. This checks the PCM-to-reference feature/timing tie; it is not Android decode or model parity.

B still reproduces the frozen legacy score exactly, with serialization hash `149feb8833f43cfdf44ce9066ce43a7984625fdca01e582ac2b63dc0a10aed80`. C's hash is `bd8cf63c24a99e0d4dcbe3e7f949708c9672305d745c13b82d5b950a143a8360`. B/C harmonic palettes are identical, with **0 pigment mismatches across 564 common exact selected-note onset knots**. Different contact allocation yields 243 versus 241 local accents; the beat evidence and accent algorithm remain fixed.

| Final measurement | A: legacy + DSP | B: legacy + FULL | C: phrases + FULL | D: phrases, notes removed |
| --- | ---: | ---: | ---: | ---: |
| Strokes / phrases | 70 / unavailable | 149 / unavailable | 180 / 25 | 14 / 1 DSP contact run |
| Timed points | 1,299 | 1,981 | 2,532 | 1,606 |
| Total brush travel | 15.1080 | 18.1882 | 28.1778 | 2.7694 |
| Brush grid coverage | 11.72% | 19.53% | 37.33% | 4.77% |
| Shape-match fraction, RMS ≤0.08 | 41.43% | 14.09% | 7.78% | 0% |
| Median nearest shape RMS | 0.1091 | 0.1645 | 0.2577 | 0.4314 |
| Connected pairs / lifts | 69 / 0 | 73 / 75 | 7 / 172 | 13 / 0 |
| Connected position discontinuities | 0 | 0 | 0 | 0 |
| Invalid geometry samples | 0 | 0 | 0 | 0 |
| Contact inside selected internal gaps | 19.7846 s | 3.6700 s | 0 s | 19.7846 s |

All **25 C phrases** have actual horizontal span **0.234615–0.860000**, median **0.500439**; none are narrow or degenerate, and none have degenerate planned displacement. The script measures actual cubic geometry rather than trusting wide declared bounds. C's seven connected joins have zero position gap and maximum velocity difference **7.96e-15**; maximum internal velocity difference is **1.26e-12**. Its maximum lifted reposition is **0.053096 canvas units**. These rounding-scale velocity errors preserve the continuous geometry contract; velocity equality is not required across a selected rest.

C represents all **614 selected note onsets and offsets** with **zero associated-knot error**, and all **25 phrase envelopes** with zero onset/duration error. Its contact union is **221.184871 seconds**, equal to the selected-note union apart from about `2.6e-13` floating-point rounding, with zero deposition in internal selected gaps. B's maximum associated onset/offset errors are **22.600 / 49.721 ms** and it omits about **0.158464 seconds** of selected-note contact. A and D retain contact in those gaps because their measured mixture dynamics can include accompaniment.

The incoming-note pitch/motion statistic is **Pearson 0.880489 across 541 C pairs**, with **224/224 non-flat interval directions agreeing** and **317 flat-motion pairs**. B gives 0.602689 across 537 pairs and 175/222 non-flat directions agreeing. The retained lagged onset-position statistic is **−0.087835 for C** versus 0.115963 for B. Nearest predicted-direction-reversal timing is descriptive: C has 119 predicted reversals and 553 sampled motion reversals, mean/max proximity **134.769 / 621.519 ms**; B has 117/347 and **164.511 / 1,336.590 ms**. These counts use the documented eligibility filters and do not demonstrate singer identity, note accuracy or causality.

### Matched frames and developer review

The [local A/B/C/D gallery](../.build-tools/v32-comparison/index.html) contains **28 matched PNGs**, seven positions in each mode. The script verified deterministic composition, score seeks, paused PNG identity and seek reconstruction at every position. [The raw comparison report](../.build-tools/v32-comparison/report.json) retains exact measurements, frame hashes and source details.

| Review candidate | Passage / frame time | Same-time C preview |
| --- | --- | --- |
| Rising predictions | 145.706–147.124 s / 147.114 s | [C rising](../.build-tools/v32-comparison/C-rising-147.114.png) |
| Falling predictions | 66.985–67.788 s / 67.778 s | [C falling](../.build-tools/v32-comparison/C-falling-67.778.png) |
| Longest selected sustain | 230.315–232.000 s / 231.158 s | [C sustain](../.build-tools/v32-comparison/C-sustain-231.158.png) |
| Longest selected internal gap | 121.890–122.610 s / 122.250 s | [C lifted gap](../.build-tools/v32-comparison/C-rest-122.250.png) |
| Confident template harmony change | 164.000–165.600 s / 164.600 s | [C harmony](../.build-tools/v32-comparison/C-harmony-164.600.png) |
| Lowest measured non-silent relative energy | 88.932 s | [C quiet candidate](../.build-tools/v32-comparison/C-quiet-88.932.png) |
| Nearly complete phrase containing the rising candidate | 141.559–158.775 s / 158.765 s | [B](../.build-tools/v32-comparison/B-phrase-end-158.765.png), [C](../.build-tools/v32-comparison/C-phrase-end-158.765.png), [D](../.build-tools/v32-comparison/D-phrase-end-158.765.png) |

I inspected all seven C previews, B rising, and the nearly complete B/C/D phrase. The corrected falling and complete-phrase frames visibly sweep across the canvas. The rising preview is an early partial reveal and still looks compact/upright, so I added the same-time nearly complete phrase comparison instead of using whole-phrase span to claim that every partial view is broad. Some short pitch contours remain sharp and graph-like. D visibly loses the note contour. This is developer artifact review only; a still image cannot establish musical expression or listening preference.

The saved-C paint validator separately passed **26 timeline frames**, including the seven review positions and nearby section boundaries, plus five special-mode frames. It passed shader compilation, byte-identical pause/seek reconstruction, visible solid-color fallback, deterministic reduced motion, shader-independent simple diagnostic and local accent pixel difference. Existing paint at the 45.29, 57.38 and 73.21-second boundaries remained visible on both sides; the 0.77-second boundary had no prior visible paint and was classified as an initial onset. [Its report](../.build-tools/v32-comparison/C-validation/report.json) renders the saved final C score rather than silently recomposing a new input.

The nine specialist QA/comparison tests passed, including source-identity controls, note ablation, contact accounting, palette equality, deterministic review candidates and a regression that catches collapsed geometry despite wide planned bounds. Root subsequently added a tenth regression after actual emulator evidence: the native decoder is 69.66 ms longer than desktop PCM. Native comparison explicitly allows at most 100 ms on the same exact source hash, retains all original measured timestamps and warns in mode A; strict desktop comparison remains 1 ms. All ten comparison tests pass. Integrated lint/typecheck/full-test/export/build evidence is recorded in [the validation report](V3_2_VALIDATION.md). Native or physical playback and user artistic acceptance remain separate gates.

## Reproduce locally

```powershell
.\node_modules\.bin\tsx.cmd scripts/compare-v32.ts '.build-tools/true-colors-allinone/true-colors.analysis.json' 'music/Justin Timberlake, Anna Kendrick - True Colors (Lyric).mp3' 'research/results/generated/Justin Timberlake, Anna Kendrick - True Colors (Lyric)-72621718f6e7/normalized.f32' '.build-tools/v32-comparison'
.\node_modules\.bin\tsx.cmd --test tests/v32-comparison.test.ts
npm run validate:paint -- --score '.build-tools/v32-comparison/C.score.json' --output '.build-tools/v32-comparison/C-validation' --times '.build-tools/v32-comparison/times.json'
```

The extended paint validator keeps shader compilation, paused/seek PNG identity, fallback, reduced motion, accent difference, diagnostic shader independence and section visibility checks. It can render an already saved score with the same material rather than silently recomposing it with the current default planner.

## Open acceptance gate

Listen/watch the same positions in B and C, compare C with the reduced-note D, and record whether phrase gestures, lifts and harmonic changes communicate the intended music. Candidate labels come from saved predictions or measured relative energy; they are not asserted vocals, real rests, correct chords or recognized song sections. Physical audio alignment, displayed frame rate/memory/heat and the user's artistic evaluation remain open. Part 2 mobile Basic Pitch begins only after the Part 1 evaluation is accepted.
