# Known limitations and feasibility decision

**Do not consider the Android Expo Go feasibility spike proven.** The source and deterministic algorithms are implemented, the JS checks pass and the Android bundle compiles, but no physical device was available for native playback, permission prompts, sample callback or rendered-frame validation.

## Current Expo sampling blockers

The installed `expo-audio` 57.0.5 Android implementation was inspected in `node_modules/expo-audio/android/src/main/java/expo/modules/audio/AudioPlayer.kt`:

- It uses Android's Visualizer attached to the player's audio session.
- Waveforms are **8-bit mono snapshots**, expanded to [-1,1], not a guaranteed contiguous high-resolution decoded stream.
- `onWaveFormDataCapture` receives `samplingRate`, but Expo does not forward it to JavaScript.
- The capture listener runs at half `Visualizer.getMaxCaptureRate()`. Capture callback frequency is not waveform sample frequency.
- `sendAudioSampleUpdate` forwards `ref.currentPosition` in **milliseconds**, although the public AudioSample documentation describes seconds. This MVP adapts Android timestamps explicitly for the pinned SDK 57 package.
- Expo leaves Visualizer scaling at its native default. Android's normalized scaling can amplify content; sampled RMS must not be presented as original recording loudness or a reliable amplitude-envelope measurement.

These findings are supported by [Expo Android source](https://github.com/expo/expo/blob/main/packages/expo-audio/android/src/main/java/expo/modules/audio/AudioPlayer.kt) and [Android Visualizer documentation](https://developer.android.com/reference/android/media/audiofx/Visualizer). Reaudit native source and timestamp units before changing Expo versions; do not infer milliseconds from a numerical heuristic.

The installed iOS `AudioTapProcessor.m` currently calls the sample callback with `timestamp = 0.0`. Thus the continuous estimator cannot obtain a rate from those timestamps either. The app uses the live playhead for non-increasing sample timestamps. iOS is secondary and untested on a device.

## Correct fallback currently implemented

Android snapshots are analyzed independently, with Hann over the actual packet and zero-padding to the configured FFT size. No unrelated snapshots are stitched into a fictitious 2048-sample waveform. Hz centroid and music-band ratios remain explicitly unavailable; **dimensionless spectral brightness and spectrum thirds** drive the fallback gradient. RMS/flux/onset are real observations of the supplied data, subject to quantization/scaling and incomplete sampling.

Sample-count/timestamp estimation is implemented and tested for genuinely contiguous streams, but is never used on Android snapshots. A WAV source rate is not assumed to be the output/capture rate. No hardcoded sample rate, guessed frequency bands, random colors, simulated features, or microphone-capture workaround are used.

The fallback can test whether *waveform-derived* colors are useful. It cannot prove the original requirement for calibrated 20–250/250–2000/2000–8000 Hz music analysis in current Expo Go on Android. If that calibration is mandatory, the PRD's migration trigger is met: a future development build would need native access to the actual capture/decoder sample rate and preferably contiguous unscaled PCM. No such native changes were made because this task requires Expo Go.

## Device and application limits

- Visualizer availability, capture length, callback cadence, audio routing, normalization, codecs and permissions vary by Android device. Two-manufacturer device checks remain required.
- MP3/M4A/AAC/WAV/FLAC/OGG are priority import formats, not guaranteed decoder support. DRM, malformed files and some codec/container combinations may fail. Native error events or a 15-second load timeout produce an actionable message.
- Audio must be explicitly selected through the system picker. Cache copies are session-oriented and can be removed by the OS; no catalog or restart persistence exists.
- Analysis stops while paused/buffering/backgrounded. The app pauses on backgrounding; sustained background playback/analysis is not supported.
- Frequency accuracy, callback latency, UI/GPU frame presentation, headphone/speaker/Bluetooth behavior, TalkBack, font scaling and long-track memory must be checked on hardware.
- Rolling normalization reflects recent playback, not full-track statistics. Replay/seek resets can produce a different contextual trajectory. The pure mapper is deterministic for identical feature input, and the complete synthetic sequence is deterministic after reset.
- Stereo averaging may cancel anti-phase content. Android samples are already downmixed mono, so spatial information is unavailable there.
- Flux between snapshots misses unobserved events and can react to waveform changes/quantization. Onsets are a novelty heuristic, not beat or BPM detection.
- The color interpretation is experimental. Fixed hues and spectral weighting are artistic hypotheses, without claims of universal music-color meaning or accessibility effectiveness.
- Conservative safety limits and dark text scrims are implemented; visual comfort and contrast still require device and user validation. No medical safety certification is claimed.
- Skia UI frame callbacks target the device's refresh cadence. The debug FPS counts callbacks, not GPU present events. No actual device FPS has been measured.
- Web is outside this Android-first slice; no CanvasKit web setup is included.
- Metro serves an Expo Go development bundle. Expo Go loading/authentication policy can require developer login, and an initial bundle load is not a standalone offline distribution.

See [the physical-device checklist](ANDROID_VALIDATION.md) for the remaining work.
