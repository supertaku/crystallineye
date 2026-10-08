# Crystallineye — paint the song

An Android-first, offline visual music prototype built with Expo, React Native and Skia. V3 analyzes the whole imported file, composes a deterministic visual score, and reveals persistent brush marks using the audio player's actual position.

V3.1 preserves continuous brush motion, consumes beat pressure accents, follows a timed harmonic palette, and fixes stale rapid-seek acknowledgment. **The mobile app currently uses measured DSP analysis; on-device note transcription is pending the music/art evaluation gate.** Basic Pitch, Beat This and All-In-One-Infer have run locally on the exact True Colors recording; their complete reference can drive the DEV JSON loader. Physical Android and listening validation remain open. See [remediation validation](docs/V3_REMEDIATION_VALIDATION.md), [music mapping](docs/MUSIC_VISUAL_MAPPING.md) and [current status](docs/V3_STATUS.md).

## Run V3

Use Node 22.20+, Java 17/21, the Android SDK and an Expo SDK 57 development build. Install the pinned dependencies with `npm ci`.

```sh
npm run android
npm start
```

On Windows, use the build helper first. It adds Git Bash utilities to the build's PATH, uses Android Studio's Java when needed, downloads a pinned official Ninja into `.build-tools/`, and creates a temporary drive alias of this workspace for short CMake paths.

```powershell
powershell -ExecutionPolicy Bypass -File scripts/build-android.ps1
npm start
```

Install `android/app/build/outputs/apk/debug/app-debug.apk` on your Android device. A debug development build needs Metro; the production app's imported audio and analysis use local files and need no cloud service.

## Use

1. Import a local song. The app checks the file and memory budget, decodes to 22,050 Hz mono, analyzes it, and composes its painting before enabling playback.
2. Play, pause, seek or replace using the small bottom controls. During playback, controls hide after 2.8 seconds. Tap the field to show them.
3. Pause freezes the painting. Seeking reconstructs the marks for that song position. Only the current and previous musical section are mounted.
4. Importing the same file again reuses analysis cached by content hash and schema/model versions. Changing the composer rebuilds the visual score from cached music.

Files are limited to six minutes, 128 MiB encoded size and an estimated 192 MiB PCM budget. Unsupported or unsafe metadata is rejected before full decoding. Cache files live in the app's document directory. The native decode operation cannot be interrupted midway; Cancel prevents later analysis and waits for that native operation to return.

## Compare with V2

The original implementation is preserved at tag `v2-fluid-reactive` (`2a9a9b0`), and its screen remains in `src/legacy-v2/`. Development builds expose **Visualizer V2** and **Score-Driven V3** through the top-right triple-tap menu. V2 still uses expo-audio.

`npm run start:v2` starts the Expo Go comparison workflow. Expo Go loads V2 only; V3's native audio engine requires a development build. [V2's original README](docs/V2_README.md), validation and architecture docs remain as historical baseline records.

## Desktop music and paint research

```sh
npm run fixtures:v3
```

This generates ten original synthetic arrangements and a 440 Hz calibration WAV. Follow [research setup](research/README.md) to produce `song.analysis.json` with official desktop models, raw tensors, beat logits and timing reports.

```sh
npm run validate:reference
npm run validate:paint -- research/results/generated/pop-8ad8874d7c15/song.analysis.json
```

For app review, copy the WAV and its matching JSON to your device. Import the WAV normally, then choose **Load research MusicAnalysis JSON** from the developer menu. The loader checks the exact audio SHA-256 and duration before replacing the score. Quality labels and inference warnings remain in developer diagnostics.

## Checks

```sh
npm run lint
npm run typecheck
npm test
npm run validate:paint
npx expo export --platform android --max-workers 2
npx expo install --check
```

The V2 checks remain available through `npm run benchmark` and `npm run validate:shader`. Desktop rendering and mock transport tests do not certify native decoding, playback synchronization, Android GPU speed or artistic quality.

[V3 architecture](docs/V3_ARCHITECTURE.md) · [V3 validation checklist](docs/V3_ANDROID_VALIDATION.md) · [reference results](research/results/REFERENCE_RESULTS.md) · [project journal](JOURNAL.md) · [full implementation request](docs/V3_IMPLEMENTATION_PLAN.txt)
