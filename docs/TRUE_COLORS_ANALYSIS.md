# True Colors actual-recording analysis

I analyzed the exact local recording on **2026-10-08, Asia/Manila**, using desktop CPU inference. These are newly run results, separate from the older synthetic-song results. No human note annotations, listening accuracy scores, or user acceptance results are claimed here.

The source is `music/Justin Timberlake, Anna Kendrick - True Colors (Lyric).mp3`, duration **243.39156462585035 seconds**, original SHA-256 **`72621718f6e76530d87400479aed14bf7e1d7bf6ba71f857815db83007d45c92`**. [TRACK_METADATA.md](../research/results/true-colors/TRACK_METADATA.md) records codec, bitrate, decoder, channels, waveform integrity, and the separate prepared-WAV identity.

## What actually ran

| Component | Actual version and configuration | Result |
| --- | --- | --- |
| Transcription | Basic Pitch 0.4.0 official ONNX, ONNX Runtime 1.23.2 CPU, upstream default note postprocessing | 2,076 polyphonic note predictions |
| Rhythm, primary | Beat This 1.1.0 `small0`, Torch 2.9.1 CPU, float32, 4 Torch threads, official frontend and minimal postprocessor | 286 beats, 98 downbeats, median-interval tempo 71.429 BPM |
| Rhythm, comparison | Beat This 1.1.0 `final0`, same CPU/frontend/postprocessor settings | 288 beats, 100 downbeats, median-interval tempo 71.429 BPM |
| Initial structure | Existing `novelty-1` DSP segmentation | 14 sections with generic labels; PARTIAL analysis |
| Final structure | All-In-One-Infer 3.1.0 `harmonix-all`, CPU, 4 Torch threads, no multiprocessing or compilation; Demucs-Infer 4.4.0 and Madmom-Infer 0.2.0 | 14 model-predicted sections; validated FULL analysis |
| Harmony and dynamics | `chroma-templates-1`, `whole-track-dsp-1`; chroma from Basic Pitch notes; 0.8 s chord windows | 210 chord intervals, 85 labeled unknown |

`FULL` means every requested analysis subsystem produced valid data. It does **not** mean accurate transcription or verified verse/chorus identity. The combined reference uses **Beat This small0** for rhythm and All-In-One-Infer for structure. All-In-One's separate raw rhythm prediction remains local; it was not substituted into the controlled Beat This comparison.

Basic Pitch consumes the shared **22,050 Hz mono float waveform**. Beat This consumes the same samples through its official frontend. All-In-One receives an exact FLOAT WAV of the original **44,100 Hz stereo decode**, because its internal separation benefits from the original channels and this avoids introducing a different MP3 decoder. The source manifest distinguishes original and prepared hashes. Final structure coverage is clipped from the model's rounded 243.4 s endpoint to the exact decoded duration.

## What the predictions show

Basic Pitch's raw note duration median was **0.325 s**, range **0.129–3.892 s**. Pitches spanned MIDI **28–90**, with median **56**, and up to eight simultaneous notes. Mean-activation confidence ranged **0.219–0.836**, median **0.497**. These are mixed-voice/instrument predictions, not identified singer notes. Note overlap, octave ambiguity, and accompaniment contamination remain plausible and need human or annotated evidence before assigning an accuracy rate.

At a 70 ms one-to-one tolerance, small0 and final0 matched **283 beats**, giving **98.61% symmetric agreement**, but only **71 downbeats**, giving **71.72% agreement**. Agreement is between models, not ground truth. Final0 includes an **80 ms inter-beat interval**; small0's shortest is 420 ms. This is a useful review flag, not proof that either model is correct. Strong model activations cannot remove the observed uncertainty about bar alignment.

All-In-One predicted verse, chorus, outro, start, and end labels. Its major predicted label changes include chorus at **89.03 s**, verse at **141.54 s**, chorus at **169.06 s**, outro at **219.12 s**, and end at **236.53 s**. These few timestamps help choose listening windows; detailed section/note/beat timelines stay in ignored outputs. All-In-One supplies no calibrated segment confidence, so the adapter's **0.5 is explicitly a placeholder**.

The chord template method produced **85 unknown intervals out of 210**. Confidence is template contrast, not a probability that a chord label is right. A renderer should preserve a stable palette when that confidence is low.

## Melody interpretation change and failed attempt

The previous extractor already used dynamic programming, but required a choice at every onset group. It then trimmed each selected note at the next group's start. On this song, interleaved accompaniment therefore shortened held notes: **1,198** selected notes, median duration **0.163 s**, longest **1.348 s**, and **190** adjacent pitch jumps larger than an octave.

I changed selection to a bounded interval path. It can skip an onset while a selected note continues. It considers at most 16 candidates per onset and 16 predecessor paths, penalizes large pitch changes, permits at most 250 ms of overlap trimming, and resets the pitch penalty after a 1.2 s rest. It never stretches notes across a rest. Backtracking uses original timestamps, and ties are deterministic.

My first duration-weighted attempt picked a coherent **bass** path with median MIDI 35. That reduced jumps but failed the intended contour interpretation. I retained that finding and added a soft register preference based on the mix's own median candidate pitch, with no singer/instrument label. The final selected line has:

| Metric | Previous extractor | Revised extractor |
| --- | ---: | ---: |
| Selected note count | 1,198 | 614 |
| Median selected duration | 0.163 s | 0.280 s |
| Longest selected duration | 1.348 s | 1.685 s |
| Adjacent jumps >12 semitones | 190 | 0 |
| Median MIDI pitch | 56 | 59 |
| Union of selected intervals / track duration | 90.14% | 90.88% |

These measurements show a smoother and less fragmented abstraction. They do not prove the line follows the singers, that every removed leap was an error, or that subjective musical coherence improved. The central-register heuristic can favor accompaniment and can suppress valid large melodic leaps; listening/annotation remains the acceptance gate.

## Timing, memory, and local outputs

| Desktop measurement | Observed value |
| --- | ---: |
| Basic Pitch model load / inference | 0.098 s / 5.543 s |
| small0 load / inference | 0.467 s / 10.976 s |
| final0 load / inference | 0.618 s / 10.587 s |
| Basic Pitch + both beat models + DSP total | 48.731 s |
| That process's peak working set | 836,882,432 bytes (798 MiB) |
| Cold All-In-One reference, including preparation/download/preprocessing | 243.852 s |
| All-In-One process peak working set | 4,904,505,344 bytes (4.568 GiB) |

The beat checkpoint timings used already cached weights. Other agents were running desktop checks, so these are development observations, not controlled mobile benchmarks. All-In-One's structure forward pass alone appeared as approximately 78.58 s in its progress log; its reported total includes more work. Desktop working-set measurements include the entire process and libraries. Neither set of numbers estimates Android performance.

Actual local outputs:

- `research/results/generated/Justin Timberlake, Anna Kendrick - True Colors (Lyric)-72621718f6e7/song.analysis.json`: PARTIAL Basic Pitch + small0 + DSP structure, retained for controlled A/B/C comparisons.
- `.build-tools/true-colors-allinone/true-colors.analysis.json`: FULL combined reference, original MP3 hash, All-In-One sections.
- Adjacent normalized WAV/PCM, Basic Pitch `.npz`, both Beat This logits, final0 comparison JSON, reports, and source manifest: ignored local evidence.
- `.build-tools/true-colors-diagnostics/`: actual-source diagnostic plots and explicit empty human-annotation template; generated from saved outputs, not fresh inference.

## Reproduction and checks

```powershell
.\.venv-research\Scripts\python.exe research/analysis/analyze.py 'music/Justin Timberlake, Anna Kendrick - True Colors (Lyric).mp3' --compare-beats --structure dsp
.\.build-tools\aio-infer-env\Scripts\python.exe research/analysis/run_structure_reference.py 'music/Justin Timberlake, Anna Kendrick - True Colors (Lyric).mp3' 'research/results/generated/Justin Timberlake, Anna Kendrick - True Colors (Lyric)-72621718f6e7/song.analysis.json' --output .build-tools/true-colors-allinone --timeout 600
.\node_modules\.bin\tsx.cmd research/analysis/inspect_reference.ts 'research/results/generated/Justin Timberlake, Anna Kendrick - True Colors (Lyric)-72621718f6e7/song.analysis.json'
.\node_modules\.bin\tsx.cmd --test tests/melody-continuity.test.ts
.\.venv-research\Scripts\python.exe -m unittest discover -s research/analysis -p 'test_*.py'
.\.venv-research\Scripts\python.exe -m compileall -q research/analysis
```

Both Python validation and TypeScript parsing accepted the FULL exact-source analysis. Six focused melody regressions and four Python provenance tests passed. The actual source MP3 and its prepared stereo FLOAT WAV also passed an exact streamed sample comparison. Python compilation and scoped TypeScript lint passed; `git diff --check` found no whitespace errors. The first Python test attempt failed because Windows sandbox TEMP denied fixture writes; moving those synthetic temporary fixtures under the workspace's ignored `.build-tools` directory fixed it, and all four checks then passed.

The plotting helper generated five actual-source composite plots. I inspected the full timeline image for readable axes and correct waveform/note/rhythm/chroma/section panels. That is a diagnostic artifact review, not listening or paint acceptance. The plotting command is recorded in [ML_FEASIBILITY.md](ML_FEASIBILITY.md). No model was installed in Android. The original MP3, stems, and rich timed derivatives remain local.

The next acceptance step is manual review of selected model-transition, sustained-note, and sparse passages on the actual playback device. An empty annotation template is not listening evidence. Physical MP3 offset comparison, beat/downbeat ground truth, singer-layer interpretation, and user preference remain open.
