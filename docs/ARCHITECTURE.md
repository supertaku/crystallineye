# Architecture

The MVP implements one session and one screen. Its boundaries support replacing a sampler, FFT or mapper later without coupling PCM to rendering.

```text
System document picker (cache copy)
  → ImportedAudio URI
  → expo-audio AudioPlayer
  → permission-gated audioSampleUpdate subscription
  → timestamp adapter + AudioSampler
  → mono ring / independent Android snapshot
  → Hann + fft.js abstraction
  → raw features
  → FeatureNormalizer
  → AudioFeatureFrame
  → ColorEngine (perceptual-v1 + separate feature envelopes)
  → SafetyLimiter
  → Reanimated shared target
  → UI-thread interpolation + second safety limit
  → Skia full-screen gradient
```

## Responsibilities

| Module | Responsibility |
| --- | --- |
| `audio/import-audio.ts` | System picker, single file, cache copy, empty/unavailable file handling |
| `audio/playback-controller.ts` | Player lifetime, import, load timeout, playback, seek, foreground-only operation |
| `audio/sampling-permission.ts` | Explanation before Android permission; denied/retry/settings flow |
| `audio/use-audio-analysis.ts` | Subscribe after load and permission, gate callbacks, freeze visuals, detect stalled sampling, recover on a new track |
| `audio/audio-sampler.ts` | Source continuity, bounded PCM buffer, rate estimation only for continuous streams, capped analysis frequency |
| `dsp/` | Pure waveform/spectrum features and slow bounded normalization |
| `color/` | Independent mapper, smoothing, lightness/chroma/blend slew limits, OKLCH conversion |
| `visualization/` | Interpolate safe visual states and render; no PCM interpretation |

The sample subscription is the event equivalent of `useAudioSampleListener`, intentionally implemented manually. That Expo hook enables sampling once per player ID; enabling before Android permission can fail without automatically retrying after permission is granted. Our effect enables after permission and loading, retries on those changes and disables/removes the subscription on cleanup.

## Scheduling and memory

DSP runs on JavaScript, at most 30 updates/second, subject to actual callback availability. Continuous data uses a 2048-sample ring and a minimum 512-sample hop; analysis takes the newest complete window when the 30 Hz deadline is due. Intermediate overlapping windows are intentionally skipped rather than queued. Snapshot data is never concatenated between callbacks. Each packet is analyzed independently, using a Hann window over its actual length and padding to the configured FFT size.

The ring and scratch arrays each retain at most 2048 mono samples, with fixed FFT workspace and previous spectrum. The estimator retains at most 24 rate candidates. No PCM or feature timeline grows with song duration. Native playback owns decoding and its own buffers.

Mapped targets update shared values directly, without React state updates on each PCM event. The UI thread interpolates at the device's frame cadence while playback is active. It does no progression while paused. Diagnostic React state refreshes at 2 Hz; displayed UI callback FPS samples at 1 Hz. This FPS metric does not measure GPU frame presentation.

## Synchronization

User pause/seek/import actions immediately freeze the visual gate. Native paused, buffering, finished and error events also freeze it. Callbacks additionally check the player's live playing/buffering state. A seek pauses playback, resets the sampler (including rate, normalizer, flux and onset history), resets the color envelopes while retaining the visible safe state, seeks, then resumes if previously playing. Android queued events whose adapted timestamp differs from the live playhead by more than 350 ms are discarded.

A pause breaks PCM/spectrum continuity and suppresses a stale onset on resume while retaining normalization statistics and displayed colors. New tracks release the previous native player through `useAudioPlayer` and reset all analysis. Negative/missing/repeated timestamps use the player position for feature timing, without using wall-clock callback timing as a made-up sample rate.

## Failure boundaries

Permission denial disables analysis without blocking playback. Unsupported sampling, native enable failures, missing callbacks and DSP exceptions have explicit textual statuses. The Skia error boundary falls back to a static dark background. No exception handler generates fallback music features or random colors. Backgrounding pauses the player and shuts off visual progression; background analysis is outside this slice.

## Safety defaults

Reduced intensity is always enabled. OKLCH L is bounded to 0.28–0.68; C to 0–0.12. Lightness changes at most 0.18 units/second, chroma 0.10 units/second, with slower blend changes. Palette hues stay fixed. Onsets use a small smooth accent. A second limiter after UI interpolation prevents targets/reset states from bypassing the safety layer. RGB conversion reduces chroma for gamut mapping. Controls sit on dark scrims, have text labels, accessibility roles and 48+ dp touch targets.

These are conservative engineering safeguards, not a medical safety certification. Device inspection and user research are still required.
