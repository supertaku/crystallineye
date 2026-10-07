# DSP v1

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

## Color mapping and temporal behavior

`perceptual-v1` maps normalized brightness primarily to lightness, energy primarily to chroma, spectral proportions to the gradient's palette composition and onset strength to a small accent. The restrained palette has fixed indigo/violet/amber hues (275°, 320°, 75°). All coefficients reside in `src/config.ts`.

Energy uses 180/650 ms attack/release, brightness 300/750 ms, balance 700/1100 ms, and onset 100/400 ms. The mapper receives these smoothed values, then safety limits output. UI interpolation has a 50 ms time constant followed by the same safety constraints. These intentionally smooth responses mean a musical change is not an instantaneous flash; sub-100 ms visible latency is a measurement goal, not a claim.

## Validation

Tests use silence, 100/440/1000/4000 Hz sines, ramps and impulses. Frequency tests run at 44.1/48/96 kHz. Pure-sine centroid tolerances are one FFT bin, and the expected music band must contain >97% of band-limited energy. Additional tests verify bounded buffering, unknown-rate output, rate acquisition/reset, no snapshot stitching, pause transient reset, deterministic mapping, safety slew and gamut conversion.

`npm run benchmark` compares 2048 and 1024 FFT configurations without changing the default. Recorded desktop means: 0.079 ms and 0.038 ms; p95: 0.146 ms and 0.070 ms. Real-device measurements remain pending; callback serialization and rendering are not included in the desktop benchmark.
