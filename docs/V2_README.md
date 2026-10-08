# Crystallineye — music in motion

An Android-first, offline music visualizer for Expo Go. Import a local song and its actual playback samples drive a full-screen Skia ink/smoke field: rhythm → expansion, tempo → flow speed, energy → pigment, spectrum → texture, onsets → disturbance. No ML, cloud services, fake notes, or streaming integrations.

**Software checks pass; physical Android playback, visual responsiveness, GPU performance, and genre tuning remain pending.** Expo Go Android supplies uncalibrated waveform snapshots. Relative spectrum regions are used honestly; sample rate, Hz bands, pitch classes and notes are never invented.

## Run

Use Node 22.20+ and Expo Go supporting **SDK 57**. The native dependency versions remain pinned, including Skia 2.6.2; no native dependencies were added. See [Expo Go downloads](https://expo.dev/go) for a matching build.

```sh
npm install
npm start
```

Scan the LAN QR code on your phone. `npm start -- --offline` skips development metadata requests. Audio and analysis work locally after Expo Go obtains the bundle; this does not make the development bundle a standalone offline distribution.

## Use

1. Import music through the system picker, then tap Play. Android sampling permission is explained before requesting it; playback also works without analysis permission.
2. The canvas fills the viewport. The bottom overlay contains a one-line title, Replace, seek slider, time/duration and play/pause.
3. During playback, controls fade after **2.8 seconds** without interaction. Tap the hidden field to show them; tap the visible field outside controls to hide them immediately.
4. Pausing freezes visual time and beat progression and keeps controls visible. Scrubbing, loading, errors and screen-reader use also keep them visible.
5. Seek resets all rhythm history and transient continuity while retaining the visible palette. Tempo warms up again. Replace selects another local file; cancelling leaves the previous track paused.

Tempo stays unknown for at least eight seconds of useful feature history. Rolling voting normally takes roughly nine seconds to lock on strong synthetic rhythms. Weak/nonperiodic content can remain unknown; onset pulses provide an immediate measured fallback. Real Android snapshots can miss short events, and native normalization can obscure original recording loudness.

## Developer validation

Triple tap the invisible **top-right 52 dp hotspot** (each tap within 650 ms) to open/close diagnostics in development builds. Close also restores real playback inputs. Normal production UI has no diagnostics or synthetic signal controls.

Diagnostics include raw onset, combined novelty, energy/brightness, calibrated-band availability or relative spectrum thirds, callback cadence/packet size, tempo/confidence, beat phase/pulse, DSP mean/p95, event/interpreter timing and UI frame callback FPS. FPS counts callbacks, not GPU presentation.

DEV renderer modes: **Fluid Ink**, **Legacy Gradient**, **Motion Debug**. Manual signals: **beat** (one pulse/second), **energy** (0–1 sweep), **spectrum** (lower → middle → upper), **tempo** (60–180 sweep). Before importing, manual signals can preview independently; with a track loaded they respect playback pause. These are isolated visual diagnostics, never injected PCM or event history, and production always uses measured audio.

```sh
npm run fixtures
npm run validate:shader
```

Fixtures generate the existing 16 original WAVs plus 12 rhythmic WAVs at 44.1/48 kHz: 60/90/120/150 BPM, missing beats and weaker extra onsets. Rhythm clips last 24 seconds. Import them normally; they are not bundled or auto-played. Shader validation uses the existing CanvasKit dependency to compile the actual SKSL and render six desktop preview PNGs under `fixtures/generated/shader/`; this is not native Android GPU validation.

## Checks

```sh
npm run lint
npm run typecheck
npm test
npm run benchmark
npm run validate:shader
npx expo-doctor@latest
npx expo export --platform android --max-workers 2
```

The retained DSP/audio/color tests are extended by rhythm, feature-to-visual, UI clock/palette safety, and real synthetic snapshot PCM integration tests. Benchmarks preserve the old comparison and add DSP + rhythm + visual interpretation, including periodic autocorrelation cost. Desktop figures do not certify Android performance.

See [validation](VALIDATION.md) and [the physical Android checklist](ANDROID_VALIDATION.md). Native runtime dependencies remain SDK 57 modules or Expo Go supported libraries; [Expo Skia](https://docs.expo.dev/versions/latest/sdk/skia/) and [Reanimated](https://docs.expo.dev/versions/latest/sdk/reanimated/) document support.

## Architecture

`audio/` → `dsp/` → `music/` → visual interpreter → Reanimated clock/uniforms → Skia RuntimeEffect. The shader performs procedural noise per pixel; JavaScript handles measured features and bounded event history. Color safety has one UI palette slew layer in v2, independent of motion. The original color engine remains for regression tests, and the legacy spatial gradient remains a debug/failure renderer.

[Architecture](ARCHITECTURE.md) · [DSP](DSP.md) · [Rhythm](RHYTHM_ENGINE.md) · [Visual engine](VISUAL_ENGINE.md) · [Limitations](KNOWN_LIMITATIONS.md)

The original `PRODUCT_REQUIREMENTS.md` is preserved. True pitch/harmony-to-color remains a future calibrated-audio development-build milestone.
