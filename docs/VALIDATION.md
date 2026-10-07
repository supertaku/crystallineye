# Validation record — October 7, 2026

User story: select a local song → native playback → real sample events → deterministic DSP → normalized, safe colors → Skia; pause/resume/seek keep the visual state aligned.

| Boundary/check | Result | Evidence / scope |
| --- | --- | --- |
| `npm install` | Passed | Installed locked dependencies; final install reported up to date |
| `npm run lint` | Passed | ESLint returned 0 errors/warnings |
| `npm run typecheck` | Passed | Strict TypeScript, including tests and scripts |
| `npm test` | Passed | 34 passed, 0 failed |
| Expo Doctor | Passed | 21/21 checks after adding Audio's Asset peer and SDK-matching TypeScript |
| Android release bundle | Passed | Expo export compiled 1873 modules to Android Hermes bytecode |
| Expo dev startup | Passed | Metro reached `Waiting on http://localhost:8082` |
| Android dev manifest | Passed | HTTP 200; `runtimeVersion: exposdk:57.0.0`; Android launchAsset URL |
| Mathematical DSP and PCM-to-color | Passed for synthetic JS inputs | Unit/integration tests at 44.1/48/96 kHz; deterministic snapshot fallback |
| Native import/playback/permission/sample events | Pending | No Android device/emulator/ADB available here |
| Actual Skia rendering, pause/resume/seek on hardware | Pending | Source wiring and bundle compilation do not execute native UI |
| Calibrated Android Hz features in Expo Go | Unavailable | Expo omits Visualizer sample rate; fallback explicitly reports null Hz values |

The first Android export under the Windows restricted process sandbox failed because the Hermes executable could not write a temporary `.hbc` file. Running the same export with approved access outside that sandbox succeeded. This was an environment permission issue, not a source compilation error.

## Desktop performance

`npm run benchmark`: Node v22.20.0 on Windows, 200 warm-up updates then 2000 measured updates per FFT size. Includes FFT, extraction, normalization, smoothing/mapping and safety; excludes native capture serialization and Skia rendering.

| FFT size | Mean | p95 | Max |
| --- | ---: | ---: | ---: |
| 2048 | 0.079 ms | 0.146 ms | 0.582 ms |
| 1024 | 0.038 ms | 0.070 ms | 0.421 ms |

Default remains 2048. Android snapshots may contain fewer samples; padding does not restore their resolution. No device performance threshold or actual rendered FPS has been certified.

## Scope review

Implemented: one screen, import/loading/error states, play/pause, time/duration, progress slider, restart/forward seek, explicit sampling permission explanation/retry/settings, real PCM buffering, deterministic features, normalization, one OKLCH mapper, safe smoothed gradient, compact DEV diagnostics, synthetic fixtures and documentation.

Deferred per reduced brief: library, database, catalog persistence, playlists, onboarding, settings/palette editor, cloud, streaming integrations, ML/AI, haptics, lyrics, advanced MIR and research dashboards.

Original PRD SHA-256 before/after: `F4E855C20CF6730AC466FF70CAF9AEAE23BE541C5C477D63D4EF10A6E51AB06D`.

Hardware acceptance remains [ANDROID_VALIDATION.md](ANDROID_VALIDATION.md); platform blockers and migration criteria are [KNOWN_LIMITATIONS.md](KNOWN_LIMITATIONS.md).
