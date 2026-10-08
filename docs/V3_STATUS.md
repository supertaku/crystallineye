# V3 status — 2026-10-08

The foundation and desktop score-driven prototype are implemented on `codex/composition-driven-v3`. The project has reached the required music/art review stage, with open exit criteria. The full V3 roadmap is not complete.

## Completed evidence

- V2 preserved at tag `v2-fluid-reactive`, commit `2a9a9b0`; DEV comparison screen retained.
- Expo development-client migration, pinned Audio API 0.13.6, and reproducible Windows native build helper. `assembleDebug` passed for arm64-v8a and x86_64 in 6m 24s. APK: `android/app/build/outputs/apk/debug/app-debug.apk`.
- Full-track decoding/normalization path, file/resource guards, incremental SHA-256, local versioned cache, measured DSP fallback and real progress/cancellation.
- Separate validated MusicAnalysis and deterministic VisualScore, melodic abstraction, phrase/beat pressure, palettes, drops, washes, persistent cubic paint, pigment shader and section dissolves.
- Native-position transport with pause/buffering freeze and asynchronous-seek gate. Mock transport and pure-score tests pass; physical synchronization remains unchecked.
- Desktop Basic Pitch and both Beat This models ran on five original compositions, with real notes/logits/events/timing reports. All five JSON outputs and PCM feature parity passed TypeScript validation.
- Fourteen desktop Skia previews across known and actual model scores, including identical image bytes after seeking. The pigment RuntimeEffect compiled.
- Lint, TypeScript and all 60 tests passed. Android JavaScript export passed; `expo install --check` reported compatible versions.
- An isolated Android 14 x86_64 emulator launched V3 and the retained V2 screen without runtime errors. V3 imported both calibration and 32-second music through the real picker, accepted matching research JSON, rendered paint, advanced playback, sought backward while paused and resumed to completion. Native paused paint pixels were identical across captures. The 440 Hz input decoded to 22,050 Hz mono, 44,100 samples and a 441.43 Hz FFT peak (within one bin). Restarting and reimporting the same file restored the research analysis from disk and showed `cached`.

## Milestone exit criteria

| Milestone | State | Remaining evidence |
| --- | --- | --- |
| 0: baseline | Preserved; software baseline measured | Physical screenshot/video and device benchmark |
| 1: development build | Android APK builds | Physical Android launch and Skia render |
| 2: audio engine | Native WAV calibration and transport smoke pass in emulator | Physical transport/synchronization, stereo/resampling and codec coverage |
| 3: Python oracle | Basic Pitch/Beat This run; PARTIAL JSON | Actual All-In-One sections and five representative complete analyses |
| 4: VisualScore | Prototype and reference JSON loader implemented | Paired playback review showing stronger musical connection than V2 |
| 5: paint | Paths, pigment, drops, washes, diffusion implemented | Native appearance/performance and artistic review |
| 6: synchronization | Deterministic score/clock behavior tested | Actual native timestamp alignment, pause/seek/resume verification |
| 7: mobile Basic Pitch | Deferred by required gate | Milestones 3–6 accepted, then TFLite CPU/delegate/parity work |
| 8: mobile Beat This | Deferred by required gate | Export feasibility, ExecuTorch CPU/delegate benchmarks and fallback decision |
| 9: mobile sections | DSP implementation present | Compare boundaries with actual All-In-One on representative tracks |
| 10: fully on-device ML analysis | Not complete | Mobile notes and accepted rhythm/structure path |
| 11: cache | Unit tests and emulator restart/reimport pass | Physical-device persistence and long-track limits |
| 12: separation | Experiment criteria documented | Earlier gates passed, then controlled stem/visual evaluation |

All-In-One 1.1.0 installed, but importing it fails on missing madmom. No compatible madmom binary wheel was available on this Windows/Python 3.12 host, no Visual Studio C++ compiler was found, and no WSL distribution was listed. NATTEN is another required native dependency. The wrapper supports exact-source upstream JSON import; it never treats DSP novelty output as All-In-One.

ADB listed no physical device during this work. The emulator used an existing Android 14 Google APIs image, WHPX acceleration and a software GPU; its audio output was disabled. It proves native code/paint/clock paths execute, not audible musical alignment, physical Android performance or two-device memory/FPS/battery gates. Model inference is still outside the app, as explicitly required until the prototype has been reviewed. Native captures are saved under `research/results/generated/paint/`; the V2 emulator baseline is `fixtures/generated/shader/v2-android14-emulator.png`. The test emulator and Metro server were stopped after validation.

The native smoke run exposed Audio API 0.13.6's PCM copier using the backing ArrayBuffer size instead of a typed-array view's length. The final partial copy now uses an exactly sized buffer, and a regression test reproduces the native contract. Skia paths also use the current PathBuilder API rather than deprecated mutation methods.

## Next gate

Prepare All-In-One in a compatible desktop environment and analyze five representative legally usable songs. Load each exact WAV/JSON pair into V3, compare it with V2 while listening, and follow [the native checklist](V3_ANDROID_VALIDATION.md). Record preference and synchronization before adding mobile ML dependencies.

[Architecture](V3_ARCHITECTURE.md) · [Reference observations](../research/results/REFERENCE_RESULTS.md) · [Journal](../JOURNAL.md) · [User's full plan](V3_IMPLEMENTATION_PLAN.txt)
