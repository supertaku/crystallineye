# V3.1 remediation validation — 2026-10-08

The available code/research remediation is implemented on `codex/v3-music-alignment-remediation`, starting from clean `e498f9941ba615c9b7b597baf06a4f845eb565aa`. It has not been committed/pushed in this task. The full product acceptance remains open because no physical phone or paired listening evaluation is available. V2 and source audio are preserved. No mobile ML dependency or unrelated product feature was added.

## Confirmed causes and implemented corrections

| Cause reproduced | Correction | Evidence |
| --- | --- | --- |
| Seeded bar origins jump across canvas | Carry brush position and planned velocity through all gestures | True Colors connected endpoint distance 0.7246–0.7371 → 0 in controlled A/B/C. |
| Independently revealed cubic pieces and width steps | Time-scaled shared-velocity cubics, exact-time prefixes, pressure ribbons, cached completed geometry | Deterministic geometry tests and desktop pause/seek frames; native appearance remains pending. |
| Tiny intervals failed to complete under old 1 ms floor | Coalesce generated knots within 10 ms; honor true positive durations | Short-interval regression and shared-tangent tests. |
| Beat event list unused | Consume target-local causal pressure envelopes | Accent-on/off geometry and pixel difference; no whole-screen pulse. |
| Rapid seek accepts stale source time | Target plausibility window, pause/buffer-aware active wait and recoverable timeout | Reproduction native 100 → seek 10 → seek 50 no longer reveals 100; rapid/forward/backward/pause/buffer/end tests. |
| Forced onset selection truncates sustained notes | Bounded interval path can skip interfering polyphonic events | Selected median duration 0.163 → 0.280 s, 190 → 0 over-octave jumps on this input; not ground-truth accuracy. |
| Main palette fixed per section; drops detached | Timed confidence-gated harmony, fixed deposited colors, local transient effects | Stable/uncertain-palette, silence and drop-proximity tests. |

Scene commit lag and native/GPU frame pacing remain unverified physical hypotheses. Incoming layers are pre-mounted and far-seek publication is gated by committed layers; deterministic tests cover the coordination contract. [Root cause report](TWITCH_ROOT_CAUSE_REPORT.md) separates evidence levels.

## Exact reference and model evidence

File: `music/Justin Timberlake, Anna Kendrick - True Colors (Lyric).mp3`.

SHA-256: `72621718f6e76530d87400479aed14bf7e1d7bf6ba71f857815db83007d45c92`.

Verified duration 243.39156462585 seconds, MPEG-1 Layer III MP3, 192 kb/s CBR, 44,100 Hz stereo, 5,843,206 bytes. Normalized 22,050 Hz mono has 5,366,784 samples. Full decode and frame scan succeeded; no clipped full-scale samples, corrupt/truncated MPEG frames, large channel shift or severe mono cancellation was found. [Track metadata](../research/results/true-colors/TRACK_METADATA.md) records methods and limits.

| Subsystem | Actual version/model | Reference result |
| --- | --- | --- |
| Notes | Basic Pitch 0.4.0 official ONNX CPU | 2,076 polyphonic predictions; 614 selected contour events. |
| Rhythm | Beat This 1.1.0 small0 | 286 beats, 98 downbeats, median tempo 71.43 BPM. |
| Comparison rhythm | Beat This 1.1.0 final0 | 288 beats, 100 downbeats; 98.61% beat agreement and 71.72% downbeat agreement with small0, not ground truth. |
| Structure | All-In-One-Infer 3.1.0 harmonix-all CPU | 14 predicted sections; confidence 0.5 is an uncalibrated placeholder. |
| Measured features/harmony | whole-track-dsp-1 / chroma-templates-1 | Same schema; note-derived reference chroma differs deliberately from DSP-only controlled comparison. |

FULL reference JSON: `.build-tools/true-colors-allinone/true-colors.analysis.json`. PARTIAL model+DSP JSON and exact normalized PCM: `research/results/generated/Justin Timberlake, Anna Kendrick - True Colors (Lyric)-72621718f6e7/`. Original source hash is retained even though internal preprocessing uses a separately hashed decoded WAV. All music, tensors, generated timelines/plots, internal stems and captures remain local/ignored. FULL records subsystem presence, not accuracy.

Basic Pitch/Beat This total local pipeline took 48.73 s; small0/final0 inference took 10.98/10.59 s, with desktop peak about 798 MiB. AIO cold run including internal preparation/model loading took 243.85 s, with desktop peak 4.57 GiB. These are host observations with other work running, not controlled phone benchmarks. [Analysis](TRUE_COLORS_ANALYSIS.md), [ML feasibility](ML_FEASIBILITY.md) and [controlled A/B](TRUE_COLORS_AB_TEST.md) provide details.

In the controlled same-PCM/DSP-feature/harmony/section comparison, DSP found 60 beats and inferred 15 downbeats at roughly 147 BPM; substituting small0 supplied 286/98 at roughly 71.43 BPM. Basic Pitch supplied note events absent from normal DSP import. These different predictions explain added event semantics without establishing which beat grid or voice is correct. With the old composer, better model events still left 0.7371-unit brush jumps. With the revised composer, all three input variants have zero adjacent endpoint gaps. Ordinary mobile import remains DSP-only; the FULL reference is loaded explicitly through DEV.

## Checks actually executed

| Command/check | Result |
| --- | --- |
| `npm install --ignore-scripts --no-audit --no-fund` | Existing pinned dependency tree up to date; no native/model dependency added to app. |
| Baseline `npm run lint`, `npm run typecheck`, `npm test` | Passed before changes; 60 tests. |
| Final `npm run lint`, `npm run typecheck`, `npm test` | Zero lint errors/warnings; TypeScript passed after final diagnostic-array annotation; 87/87 tests passed. |
| Python `unittest discover -s research/analysis -p 'test_*.py'` | 4/4 offline provenance regressions passed. Actual prepared WAV also matched every original decoded sample. |
| Python `compileall -q research/analysis` | Passed. |
| `npm run benchmark` | Baseline V2 desktop pipeline mean 0.1643 ms, p95 1.1823 ms; not Android. |
| `npm run benchmark:v3` | Simple/medium/dense composer, geometry, 1,000 lookups and node estimates; no GPU claim. |
| `npm run validate:shader` | Six baseline Skia shader previews compiled/rendered. |
| `npm run validate:reference` | Six Python analyses passed exact-PCM feature parity and deterministic score/seek; worst feature error 1.56e-7. FULL analysis also passed Python/TypeScript schema parsing. |
| `npm run validate:paint` and FULL-reference paint validation | Synthetic and 19 FULL timeline frames passed pause/seek identity, bounded continuity, accent difference, fallback, reduced-motion and scene coverage. Five extra special-mode images were saved. |
| `npx expo-doctor@latest` | 21/21 passed after approved network retry. |
| Final `npx expo export --platform android --max-workers 2` | Android/Hermes export passed with workspace TEMP/TMP; 1,984 modules, 4.6 MB bytecode. |
| `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/build-android.ps1` | Java 21 retry built arm64-v8a and x86_64 debug APK successfully in 5 m 13 s; 753 tasks. |
| `adb devices -l` | No connected devices; user confirms no phone available. |
| `git diff --check` | Passed; Git only reports expected Windows LF/CRLF conversion warnings. Ignore checks confirmed source music and rich generated derivatives stay local. |

The debug APK is `android/app/build/outputs/apk/debug/app-debug.apk` (223,433,401 bytes), SHA-256 `795e785075777d843ab500176b889f9ed1ff62351bbf76284853e9e18742faf2`. It needs Metro; start `npm start` for the existing development-client workflow. Compilation/export do not prove new native worklet rendering at runtime. No new emulator playback run occurred.

Failed attempts were retained: doctor registry DNS failure; isolated research installer DNS/cache denial; default Hermes sandbox temp write denial (fixed workspace temp); SUBST sandbox denial (approved scoped build retry); inherited Java 26 JDK image/CMake failure (fixed command-local Java 21); Python fixtures denied default TEMP writes (fixed workspace fixture root). A final TypeScript check overlapped the validator handoff and caught an untyped boundary array; the explicit type fixed it and the final check passed. Native build/dependency deprecation warnings remain; Expo doctor has no failing check.

## Final render and diagnostic evidence

Final FULL desktop output is `research/results/generated/paint/72621718f6e7-reference-v31-full/report.json`, separate from earlier PARTIAL/failed-attempt output. Across 144 near-adjacent gestures, position gaps were exactly zero; maximum internal and cross-gesture velocity differences were 1.85e-14 and 1.52e-14, with no invalid coordinates. Painted transitions at 45.29, 57.38 and 73.21 seconds retained visible pigment before, on and after the boundary. The 0.77-second intro boundary had no visible prior paint, so it is correctly treated as an initial onset rather than a disappearing frame.

Inferred simple/medium/dense mounted drawables fell from 176/443/397 to 118/99/87. On identical new geometry, the legacy renderer would allocate 358/515/509. The FULL song peaks at 478 versus 1,671 for legacy rendering on the same layers. These estimates and desktop lookup timings are in [Android performance](ANDROID_PERFORMANCE.md); they do not establish actual presented FPS or Android memory.

Five actual-source composite plots in `.build-tools/true-colors-diagnostics/` show waveform/RMS, raw versus selected notes, both rhythm grids, chroma and DSP versus learned sections. The manual annotation template is empty. I inspected the full diagnostic plot and 27-second paint image; the agents also inspected 45.29 seconds and the simple brush. Static previews show connected teal/green layering with local pigment texture. No listening preference or singer-transcription claim follows from that observation.

The paint validator initially chose a silent/faint intro frame for fallback testing and incorrectly equated scheduled marks with visible quantized pixels. It now selects known visible frames and checks retained pixels at already-painted boundaries. The resulting FULL checks pass without inventing intro paint.

## Milestone disposition

| Milestones | Current disposition |
| --- | --- |
| M0–M4: exact source, baseline, cause isolation, continuity, real note/rhythm models | Source identity and executable desktop evidence complete; physical symptom reproduction remains pending. |
| M5–M7: controlled comparison, contour, harmony and articulation | Implemented and deterministically checked; musical listening acceptance remains pending. |
| M8–M9: paint appearance, renderer/scene efficiency | Targeted continuity/pressure/consolidation fixes complete; broader artistic approval and real-device stability remain pending. |
| M10–M12: conditional stem comparison, mobile ML, final user study | Deferred behind the original acceptance gates; no mobile model or product stem experiment was added. |

## What is still unaccepted

- Physical audio/render synchronization, actual presented 30–60 FPS, p95 frame time, dropped frames, long-track memory/GC, heat/battery and codec/device coverage.
- Paired listening preference versus V2 and old V3, manually verified phrase/note/beat/section passages, event precision/recall against human truth, physical accessibility/color-vision review.
- Broad paint realism/artistic approval, controlled vocal-separation A/B, mobile Basic Pitch/TFLite or Beat This/ExecuTorch parity/resource feasibility.

Developer evidence establishes continuity and model/score availability, not that a listener prefers the new performance. Static desktop painting has been inspected; no subjective claim that it follows the song better is made. The next phase is to load the exact MP3/FULL JSON pair, run DEV A–D on two phones, annotate selected passages through listening, and measure actual timing/frame presentation. Only accepted results justify mobile ML. All-In-One stays desktop-only.

Current implementation details: [mapping](MUSIC_VISUAL_MAPPING.md), [brush architecture](BRUSH_RENDERING_ARCHITECTURE.md), [Android protocol](ANDROID_PERFORMANCE.md), and [journal](../JOURNAL.md).
