# DSP foundation and v2 integration

Runtime input is the actual `AudioPlayer` sample event, not synthetic signals, microphone recording or a precomputed timeline. Synthetic WAVs exist solely for tests and deliberate manual import.

## Sample interpretation

Available channels are averaged per frame: stereo `mono[n] = (left[n] + right[n]) / 2`. Uneven channel arrays use the shortest available length. The bounded ring rejects non-finite PCM and clamps to [-1, 1]. Expo's Android Visualizer already emits mono.

Parameters in `src/config.ts`: FFT size 2048, minimum continuous-stream hop 512, Hann window, maximum 30 analysis updates/second, music bands [20, 250, 2000, 8000] Hz. `JavaScriptFFT` wraps pure-JS `fft.js`. It reuses input, complex spectrum and magnitude arrays; downstream flux history explicitly copies the magnitude spectrum.

The Hann window is `0.5 * (1 - cos(2πn/(N-1)))`. For a short Android packet, N is its actual length, followed by zero padding to 2048. Padding increases the sampling density of the spectrum but does not improve the physical frequency resolution or reconstruct missing audio.

## Features

| Feature | Calculation / behavior |
| --- | --- |
| RMS | `sqrt(sum(x[n]^2) / N)` on unwindowed mono PCM |
| Magnitudes | `abs(FFT(Hann * x)) / N` |
| Hz centroid | `sum(f[k] * M[k]) / sum(M[k])`, only with a trusted effective sample rate |
| Normalized centroid | Magnitude-weighted bin index divided by Nyquist bin index, dimensionless |
| Music band ratios | Squared magnitude in 20–250, 250–2000, 2000–8000 Hz, divided by total energy in the three bands; no energy gives zero ratios |
| Spectrum thirds | Energy in normalized bin ranges [0, 1/3), [1/3, 2/3), [2/3, 1], for the explicitly uncalibrated fallback |
| Spectral flux | `sum(max(0, M[t][k] - M[t-1][k]))` |
| Onset | Positive flux novelty above running mean + 1.5 deviations, scaled/clamped to [0,1], with 250 ms warm-up |

Higher-frequency pure sines produce higher centroids. Band ratios exclude DC and bins outside the configured 20–8000 Hz span; they sum to one only when energy exists in that span. Flux is zero for the first frame, identical frames and the first frame after transient reset. Snapshot flux describes changes between observed windows, not continuous sample-accurate onset detection.

## Sample rate and honest fallback

Expo `AudioSample` has no sample-rate field. The continuous-stream estimator observes the previous per-channel frame count divided by the next start-timestamp delta. It requires eight plausible observations, retains 24, rejects non-increasing timestamps/large gaps/implausible rates and requires at least 85% of observations within 3% of the median. It returns `null` while warming up or uncertain. This strategy assumes contiguous samples and accurate start timestamps. Stable arithmetic alone cannot prove the stream is contiguous.

**The estimator is disabled for Android snapshots.** Their callback interval is not the duration represented by each PCM packet. The native Visualizer capture rate and waveform sample rate are different quantities. Expo receives the latter natively but discards it in the JS event. Guessing 44.1 or 48 kHz, or calculating packet length/callback interval, would produce invented frequency values. [Android's Visualizer API](https://developer.android.com/reference/android/media/audiofx/Visualizer) specifies both rates.

With an unknown rate, `spectralCentroidHz` and `bandRatios` are `null`, sample-rate confidence is zero, and the mapper uses the dimensionless normalized centroid and spectrum thirds. These are measured properties of the observed waveform; the debug overlay explicitly labels them **not Hz bands**. The installed iOS tap also currently emits constant-zero timestamps, which prevents this estimator from calibrating frequency there. Timing falls back to the player position.

## Normalization

Energy uses log RMS (dB), a 20-second exponential location/variance model, a minimum 8 dB deviation and bounded 24 dB statistical innovations. Output blends 65% relative context with 35% fixed -65 to -10 dB scaling. Silence is forced to zero. This avoids fast min/max remapping and keeps quieter sections quieter relative to recent context. It is not whole-track loudness or a LUFS calculation.

Known-rate centroid uses `log1p(Hz/250)/log(33)`; unknown-rate brightness uses `log1p(normalizedCentroid*64)/log(65)`. Both are bounded. Band/spectrum ratios and onset strength are already normalized. This preserves the direction of brightness change rather than mapping raw Hz directly to color.

## Historical color mapping

`perceptual-v1` maps normalized brightness primarily to lightness, energy primarily to chroma, spectral proportions to the gradient's palette composition and onset strength to a small accent. The restrained palette has fixed indigo/violet/amber hues (275°, 320°, 75°). All coefficients reside in `src/config.ts`.

The original `ColorEngine`, `FeatureSmoother`, mapper and limiter remain unchanged and tested for regression comparison. They are no longer stages in the production v2 pipeline, so the old second renderer safety limiter is removed from the primary path.

## Music-event and visual integration

The unchanged timestamped DSP features now feed `MusicEventEngine`. It combines onset, positive normalized energy change and relative spectral redistribution into bounded novelty history. Energy uses 50/300 ms attack/release, brightness 160/450 ms and spectral balance 120/350 ms. Onset and beat pulses retain immediate attacks and configurable exponential decay. Tempo estimates use feature history rather than raw PCM; no sample-rate assumption enters rhythm estimation.

The visual interpreter maps these signals to motion, scale, turbulence, pigment and palette. Reanimated advances time/beat progression between sample callbacks, interpolates ordinary controls and applies a single palette safety layer. Domain-warped noise runs on Skia/GPU. See [rhythm](RHYTHM_ENGINE.md) and [visual engine](VISUAL_ENGINE.md). Real sample-to-visual latency and beat synchronization remain hardware measurement items.

## Validation

Tests use silence, 100/440/1000/4000 Hz sines, ramps and impulses. Frequency tests run at 44.1/48/96 kHz. Pure-sine centroid tolerances are one FFT bin, and the expected music band must contain >97% of band-limited energy. Additional tests verify bounded buffering, unknown-rate output, rate acquisition/reset, no snapshot stitching, pause transient reset, deterministic mapping, safety slew and gamut conversion.

`npm run benchmark` preserves the 2048/1024 historical DSP+color comparison and adds snapshot DSP + rhythm + visual interpretation, including periodic autocorrelation. See [current validation measurements](VALIDATION.md). Native capture serialization, UI worklets and shader/GPU rendering are excluded; Android/Hermes performance remains pending.
