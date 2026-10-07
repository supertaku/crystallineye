# Music in Color — functional MVP

A single-screen Android-first Expo app: import a local song, play/pause it, seek or restart, and analyze actual playback waveform samples to drive a smooth full-screen Skia gradient. Audio and analysis stay on the device. No ML, accounts, playlists, persistence, or cloud services are implemented.

**Implementation is ready for Android feasibility testing; physical-device proof is still pending.** Current Expo Go Android sampling supplies 8-bit mono waveform snapshots without the capture sample rate. Consequently this MVP computes real RMS, FFT, normalized spectral brightness, spectral distribution, flux and onsets, but deliberately reports Hz centroid and the 20–250/250–2000/2000–8000 Hz bands as unavailable on Android. The Hz algorithms are implemented and tested with known-rate signals. See [known limitations](docs/KNOWN_LIMITATIONS.md).

## Install and run

Use Node.js 22.20+ and an Android phone with an **Expo Go build supporting SDK 57**. Expo Go's SDK must match the project. Get a matching version from [Expo Go downloads](https://expo.dev/go); store releases can lag SDK releases. [Expo's version-mismatch guide](https://docs.expo.dev/troubleshooting/expo-go-version-mismatch/) explains this requirement.

```sh
npm install
npm start
```

Connect the computer and phone to the same network. Scan the QR code using Expo Go. If needed, allow Node through the computer's firewall. No native build or custom module is required. Keep the terminal running while loading the development bundle.

Expo recommends signing into the CLI (`npx expo login`) and Expo Go with the same Expo account; current Expo Go releases can require this for development loading. This is development tooling, not an account feature in Music in Color. See [Expo's loading policy](https://expo.dev/changelog/expo-go-57-login).

For a connected Android emulator/device with ADB installed:

```sh
npm run android
```

To start Metro without fetching network metadata, while still serving the bundle over the local network:

```sh
npm start -- --offline
```

The core playback/DSP has no network calls. Expo Go must first obtain the development bundle; cold-launching the development app entirely offline is not a shipped standalone-app guarantee.

## Use

1. Tap **Import Music** and select a local MP3, M4A/AAC, WAV, FLAC or OGG file.
2. Wait for **Ready to play**, then tap **Play**.
3. On Android, read the playback-sampling permission explanation and choose **Continue** before the system audio permission prompt.
4. The screen follows the real samples. **Pause** freezes the visual state. Resume with **Play**.
5. Drag the progress slider to seek, use **+10 sec**, or tap **Restart**. Seeking resets buffering, rate estimation, normalization and transient history before analysis warms up again.
6. **Import another song** replaces the current session's track. Imports are copied to the app cache; restart persistence is intentionally absent.

Android's `RECORD_AUDIO` permission is needed for playback sampling. The app never starts a microphone recorder and uploads nothing. If permission is denied, music can still play with the current static background. Tap **Allow audio analysis** to retry. Permanently denied permission leads to **Open Settings**. File access uses the system picker, without broad storage permission. [Expo Audio](https://docs.expo.dev/versions/latest/sdk/audio/) documents the sampling permission.

Unsupported or corrupt files show an actionable error. If sampling fails or stops delivering callbacks, playback remains available and the UI reports the missing analysis. The app pauses when it leaves the foreground.

## Diagnostics and device validation

Tap **DEV** in a development build to inspect actual callback count, PCM frame count, packet length, raw/adapted timestamp, RMS, normalized energy, centroid availability, spectrum/band ratios, flux, onset, sample-rate confidence, DSP duration and UI callback FPS. No sample values are fabricated.

```sh
npm run fixtures
```

This writes 16 original PCM16 mono WAVs in `fixtures/generated/`, at 44.1 and 48 kHz. Copy them to the phone and import through the ordinary picker. `validation-sequence-48000.wav` has five 4-second sections: silence → 100 Hz → 1000 Hz → 4000 Hz → a 440 Hz amplitude ramp. No audio fixture is auto-played or injected into the app pipeline.

Use [the Android checklist](docs/ANDROID_VALIDATION.md) on at least two devices. Check actual samples, response, permissions, pause/resume, seeks, codec support and performance. The current source-level Android limitations cannot be resolved merely by passing these UI checks.

## Checks

```sh
npm run lint
npm run typecheck
npm test
npm run benchmark
npx expo-doctor@latest
npx expo export --platform android --max-workers 2
```

Tests cover signal math at 44.1/48/96 kHz, rate estimation, snapshot isolation, timestamp adaptation, bounded buffering, transient resets, normalization, smoothing, safety, gamut conversion, and deterministic PCM-to-color integration.

Validation recorded on October 7, 2026: 34 tests passed, 0 failed; lint and TypeScript passed; Expo Doctor passed 21/21; Android Hermes export passed; Metro started and served an SDK 57 Android manifest. Physical Android playback/Skia rendering was not available in this workspace. Desktop Node benchmark (2048 samples, FFT + features + normalization + color): mean **0.079 ms**, p95 **0.146 ms** over 2000 measured updates after 200 warm-up updates. These are not Android/Hermes runtime measurements or an FPS claim. See [validation details](docs/VALIDATION.md).

## Structure and compatibility

`app/` contains one experience screen and the Router layout. `src/audio/`, `src/dsp/`, `src/color/`, and `src/visualization/` separate the pipeline. `src/config.ts` centralizes analysis parameters, mapping coefficients, smoothing and safety limits. The original `PRODUCT_REQUIREMENTS.md` is preserved unchanged; this task follows the reduced vertical-slice brief.

Native runtime dependencies are Expo SDK modules or explicitly included in Expo Go: Audio, DocumentPicker, Asset, Router and its linking/constants/status-bar dependencies; Skia; Reanimated/Worklets; safe-area context; screens; slider. Expo CLI selected their SDK 57 versions. `fft.js`, React, React DOM (Router peer), and development tooling are JS/TS packages. No custom native modules were added. [Expo Skia](https://docs.expo.dev/versions/latest/sdk/skia/), [Reanimated](https://docs.expo.dev/versions/latest/sdk/reanimated/) and [Slider](https://docs.expo.dev/versions/latest/sdk/slider/) list Expo Go support.

Further details: [architecture](docs/ARCHITECTURE.md), [DSP](docs/DSP.md), [limitations](docs/KNOWN_LIMITATIONS.md).
