# Validation record — October 8, 2026

Story: local file → actual playback samples → retained DSP → musical events → visual interpretation → full-screen procedural ink; pause/seek preserve safe continuity and controls auto-hide during playback.

## Baseline before implementation

The working tree was clean. Existing repository/audio/DSP/color/tests/docs were inspected; the specified audio infrastructure and DSP primitives remain unchanged. `PRODUCT_REQUIREMENTS.md` SHA-256 remains `F4E855C20CF6730AC466FF70CAF9AEAE23BE541C5C477D63D4EF10A6E51AB06D`.

| Check | Baseline result |
| --- | --- |
| `npm install` | Up to date; existing audit reported 29 vulnerabilities (10 moderate, 19 high). No forced fixes or native upgrades applied. |
| Lint / strict TypeScript | Passed |
| Unit/integration tests | 34 passed, 0 failed |
| Benchmark, 2048 DSP + old color | Mean 0.0924 ms; p95 0.1667 ms; max 1.2849 ms |
| Benchmark, 1024 DSP + old color | Mean 0.0377 ms; p95 0.0661 ms; max 0.6017 ms |
| `npx expo-doctor@latest` | Initial sandbox attempt could not fetch due to registry DNS/network restriction. First successful run occurred after initial implementation, with dependencies unchanged: 21/21. |

The first network-enabled Doctor attempt was rejected by automatic approval review for unpinned external execution. Citing the user's exact requested command from plan sections 1/68 allowed the same check to run successfully. No workaround or different external tool was used.

## V2 checks

| Check | Result / scope |
| --- | --- |
| `npm run lint` | Passed, zero errors/warnings |
| `npm run typecheck` | Passed, strict TypeScript across app, source, tests, scripts |
| `npm test` | 50 passed, 0 failed; all 34 existing tests retained |
| `npm run fixtures` | 28 original synthetic WAVs generated: 16 existing + 12 rhythmic; ignored output, no copyrighted songs |
| `npm run validate:shader` | Actual RuntimeEffect SKSL compiled with installed CanvasKit; six software-Skia PNG previews rendered |
| Shader visual inspection | Portrait flow/beat/detail inspected; stronger domain folding/filaments replaced the first overly diffuse artistic settings |
| Expo Doctor | 21/21 passed; no new native dependency or SDK/Skia upgrade |
| Android export | Passed; 1884 modules, 4.3 MB Hermes bundle, 27 assets; output `dist/` |
| Native Android import/playback/permissions | Pending; no physical device or ADB session available here |
| Native RuntimeEffect rendering / smoothness / GPU presentation | Pending; software raster compilation and Hermes export do not run native UI |
| Player fade, touch priority, pause/resume/seek on hardware | Pending; source wiring reviewed, not a native interaction pass |
| Pop/EDM, ballad/acoustic, complex-rhythm tuning | Pending; synthetic clips cannot pass genre acceptance |
| Android calibrated Hz / notes | Intentionally unavailable; no fake sample rate or pitch mapping |

Android export initially failed in the restricted Windows sandbox because the installed Hermes compiler could not write its temporary `.hbc` file. The same user-requested export succeeded with approved access outside that sandbox. This is the same environment issue observed in the baseline project, not a source compilation failure.

## Algorithm evidence

New tests cover 60/90/120/150 BPM to ±5 BPM, eight-second unknown-tempo warm-up, half-time stability, missing beats, weaker extra onsets, low callback cadence with broad measured events and jitter, constant/silent envelopes, confidence decay, bounded timestamp history, beat phase/coasting/correction, pulse decay and seek/pause transient suppression.

Integration tests verify tempo → flow, beat → deformation input, upper relative spectrum → detail/turbulence, energy → pigment, onset → disturbance, dynamic visual time with unchanged targets, between-callback beat interpolation, reduced motion and one palette slew layer. A real synthetic 120 BPM waveform is passed through snapshot sampler → DSP → event engine → visual uniforms; it produces strong measured onset/beat inputs, approximately 120 BPM and identical results on repeated runs while Hz/bands remain null.

The shader validation previews cover portrait, changed visual time, a beat at the same time, upper-region detail, quiet energy and a wide viewport. These prove SKSL syntax/uniform wiring under desktop Skia and provide inspection artifacts; they do not certify Android GPU compatibility, 60 FPS, safety/comfort or native synchronization.

## Desktop performance

Node v22.20.0 / Windows; 200 warm-up + 2000 measured updates. Historical comparisons remain in `npm run benchmark`. The v2 path uses 1024-sample snapshots padded to FFT size 2048 and includes periodic tempo autocorrelation rather than timing only cheap frames.

| Pipeline | Mean | p95 | Max |
| --- | ---: | ---: | ---: |
| DSP 2048 + historical color | 0.0717 ms | 0.1314 ms | 0.7185 ms |
| DSP 1024 + historical color | 0.0430 ms | 0.0681 ms | 0.5724 ms |
| Snapshot DSP 2048 + rhythm + visual interpreter | 0.1812 ms | 1.2297 ms | 4.1610 ms |

These exclude capture serialization, UI worklets, native rendering and GPU cost. No Android/Hermes runtime measurement or actual presented-FPS claim is made. Diagnostics provide native-session DSP mean/p95 over the last 120 updates, latest event/interpreter duration, callback cadence/snapshot size and UI callback FPS for the hardware checklist.

## Scope and remaining acceptance

Implemented: Skia procedural ink and legacy fallback, bounded novelty/tempo/beat interpretation, music-to-motion/texture/pigment mapping, controlled dynamic palette and single safety layer, pause/seek gates, immersive minimal player with 2.8-second auto-hide, tap toggle, reduced-motion and screen-reader behavior, hidden DEV modes/manual checks, synthetic fixtures and documentation.

Preserved: local import/playback, offline audio path, Android snapshot isolation, unknown sample-rate reporting, original DSP primitives/tests/fixtures and original PRD. No ML, cloud service, WebView, Three.js, native audio replacement or fake note mapping introduced.

The complete product Definition of Done is **not certified** until physical Android checks and multi-genre tuning pass. Record actual observations in [ANDROID_VALIDATION.md](ANDROID_VALIDATION.md); limitations remain in [KNOWN_LIMITATIONS.md](KNOWN_LIMITATIONS.md).
