# V3.2 performance and Android evidence

Current check date: 2026-10-08, Asia/Manila. Part 1 is implemented; user artistic acceptance and physical-device measurements are open. Part 2 Android Basic Pitch has not started.

## Checks actually run

The current native debug client built successfully with Android Studio's Java 21, Hermes and the new architecture. Gradle finished in **5m50s**, 753 tasks (721 executed, 32 up to date). [The build log](../.build-tools/v32-native-build.log) and [debug APK](../android/app/build/outputs/apk/debug/app-debug.apk) are local ignored artifacts. APK size is 223,433,401 bytes; SHA-256 is `795e785075777d843ab500176b889f9ed1ff62351bbf76284853e9e18742faf2`. It matches the previous native client because native dependencies did not change. This development APK loads current JavaScript from Metro and requires that server.

Current versions: Expo 57.0.27, React Native 0.86.3, React Native Audio API 0.13.6, Skia 2.6.2, Reanimated 4.5.1, Node 22.20.0 and npm 11.18.0. The network-enabled `npx expo-doctor@latest` retry passed 21/21 checks; the first restricted-network attempt failed with registry `ENOTFOUND`. [Doctor log](../.build-tools/v32-doctor-network.log).

Final Android/Hermes export passed after the actual native-duration fix: 4.6 MB bytecode, bundle `entry-87c07c92636618695a6dd7e0c15e350b.hbc`, [export log](../.build-tools/v32-final-export.log). Final lint/typecheck passed and all 123 tests passed. This compiled-JavaScript evidence is separate from native build and emulator behavior.

`npm run benchmark:v3` measured the current composer, prepared ribbon geometry and 1,000 score lookups for each 32-second synthetic input. Results are saved separately from V3.1 at [the current report](../research/results/generated/v32-performance/report.json).

| Desktop JS measurement | Simple / sparse | Medium / pop | Dense |
| --- | ---: | ---: | ---: |
| Composition | 56.04 ms | 13.71 ms | 6.92 ms |
| Geometry preparation | 18.28 ms | 10.25 ms | 2.35 ms |
| Lookup p95 | 0.0747 ms | 0.0367 ms | 0.0104 ms |
| Maximum mounted drawable count | 106 | 108 | 93 |
| Earlier per-segment layout on same prepared layers | 403 | 602 | 590 |
| Strokes / prepared ribbon samples | 14 / 988 | 17 / 1,838 | 19 / 1,892 |

These are desktop JavaScript timings under concurrent host load. They exclude native Skia path construction, GPU rendering, presented frames, audio output, peak process memory and thermal/battery behavior. Heap deltas vary with garbage collection and are not a memory budget. The dense fixture being faster does not establish performance scaling.

Phrase extraction, occupancy placement and note interpretation run during score composition. The renderer receives timed geometry. Diagnostic geometry is indexed once, with binary timestamp lookup and a previous/active/next gesture window. DSP fallback samples at a bounded 0.2-second planning cadence plus exact boundaries; the six-minute regression stays below 1,830 knots. Normal rendering retains the existing consolidated ribbons and scene lifecycle.

## Emulator smoke and remaining measurement

The task uses an isolated Android 14 x86_64 AVD, 360×800, 2,048 MB RAM, SwiftShader, audio disabled, emulator port 5556 and Metro port 8083. Emulator logs/captures are under [the local evidence folder](../.build-tools/v32-emulator/). Real document-picker import of the exact MP3 succeeded and created measured DSP analysis; the native decoder reported 5,368,320 mono samples at 22,050 Hz, 243.46122449 seconds. Desktop normalized PCM is 5,366,784 samples, 243.39156463 seconds. The 69.66 ms difference is decoder evidence, not a measured start offset or model parity result.

The exact FULL reference loaded successfully. Painting comparison initially failed its stricter 1 ms duration requirement; identical pulled cache hashes and native duration established the mismatch. The native caller now explicitly permits the existing reference-loader allowance of at most 100 ms for the identical source hash. It reuses native DSP, preserves all timestamps/durations, warns in mode A and leaves strict desktop comparison unchanged. Ten comparison regressions pass. This is an exact-source decoder tolerance, not a timing correction. The final comparison/overlay/transport smoke outcome is recorded in [the validation report](V3_2_VALIDATION.md).

One first import returned to the welcome view with no captured runtime exception; a bounded retry succeeded. This remains an unconfirmed transient. Emulator animation/control evidence does not establish audible synchronization or physical-device performance.

Fixed preparation, all four paused painting mode switches at 47.551 seconds, trajectory guides/live tip and paused crop identity passed. Native controls advanced to 01:36, paused, sought backward to 00:19, resumed and paused at 00:25. The saved trace retains 1,200 **paused** samples at 25.572408 seconds (20.673-second span, JavaScript frame p95 18.37 ms). It shows paused shared-time consistency only; its zero playing error/read summary is not an active-playback or GPU benchmark. UIAutomator timed out during live DEV trace updates; stale capture41 was excluded from successful state evidence. The report preserves verified captures42/43/45 instead.

The [native smoke summary](../.build-tools/v32-emulator/native-smoke-summary.json) records zero relevant fatal/JavaScript-error matches in the final runtime log. Identity-verified task Metro14632 and emulator9712/qemu7600 were stopped; [cleanup](../.build-tools/v32-emulator/cleanup-summary.json) confirms no owned processes remain and ADB lists no devices. Start a new Metro/emulator session to repeat playback; the task helpers are no longer running.

## Repeat on a physical device

1. Install the development APK, run `npm start`, and connect Crystallineye to that Metro development server. Expo Go intentionally runs V2; it cannot load this V3 native audio client.
2. Import the exact local recording, triple-tap to open DEV, and load `.build-tools/true-colors-allinone/true-colors.analysis.json`. Prepare painting A–D, distinct from the retained clock A–D controls.
3. Pause at the same position and switch B/C, then C/D. Review rising/falling/sustain/rest/harmony/quiet passages and the nearly complete phrase at 158.765 seconds. Record listening preference and whether the gestures communicate the music.
4. Exercise pause/resume, backward/forward seek, section edges, overlay, background/resume and a long track. Save native clock traces and externally observed presented frames/audio timing; do not infer displayed frame rate from a React callback rate.
5. Record device/OS/build mode, frame-time percentiles, peak memory, analysis duration, thermal/battery behavior and cancellation. A standalone release build is needed for representative release performance; DEV overlays and Metro are additional workload.

Only the isolated emulator has been exercised in this task. The earlier journal says the user copied an APK to a phone; installation, playback and performance on that phone remain unverified. No physical frame-rate, memory, heat or audio-alignment claim is made.
