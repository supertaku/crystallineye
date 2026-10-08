# Architecture — visual engine v2

```text
local file → expo-audio player → sample event
  → AudioSampler (independent Android snapshots / bounded continuous buffer)
  → DSPEngine → timestamped AudioFeatureFrame
  → MusicEventEngine (novelty history / tempo / PLL beat clock)
  → interpretMusic → MusicVisualState target shared value
  → UI frame clock + single palette safety slew → compact uniforms
  → Canvas / Fill / Shader (Skia RuntimeEffect)
```

## Boundaries

- `audio/`: existing import, native playback/permissions, timestamp adaptation, snapshot isolation, rate estimation and buffer ownership. No decoder/capture rate is guessed.
- `dsp/`: retained tested FFT, RMS, brightness, flux/onsets, normalization and calibrated-band/relative-spectrum fallback.
- `music/`: no PCM dependency; bounded timestamped novelty, event envelopes, deterministic tempo and beat phase/pulse.
- `visualization/`: musical interpretation, GPU domain-warped ink, UI frame progression and palette safety. SKSL does not interpret PCM.
- `components/`: minimal player, hide intent timeout and hidden development diagnostics.

`src/config.ts` groups DSP, historical color, rhythm, visual, shader and safety parameters. Historical `ColorEngine` remains covered by existing tests but is not another safety/smoothing stage in the v2 runtime.

## Scheduling and memory

The sampler still analyzes at most 30 updates/sec, subject to native callback availability. Continuous data retains a 2048-sample ring with a 512-sample minimum hop. Android snapshots are never stitched; Hann is applied to the actual packet before padding. Rate candidates remain bounded to 24. New event history uses two fixed arrays, at most 360 points / 12 seconds. Tempo evaluates at most twice per second using a bounded resampled feature envelope, with five retained votes. Resampling novelty does not reconstruct audio or claim an audio sampling rate.

JavaScript updates target shared values without per-sample React rendering. Reanimated advances visual time, interpolates ordinary controls, extrapolates beat phase/pulse between sample events and applies palette safety on the UI thread. Procedural noise runs in the Skia shader. Diagnostic state refreshes at 2 Hz and visible frame metrics at 1 Hz. UI callback FPS is not a GPU-present metric.

## Playback continuity

Pause/import/seek gestures freeze the analysis/visual gate immediately. Native paused/buffering/finished/error status and AppState background changes also freeze it. A pause discards spectrum/onset/beat-location continuity while retaining normalization and tempo evidence. Resume waits for real sample delivery, warms transient detection for 250 ms and reanchors the beat clock to a measured event. Visual time resumes from its prior value.

Seek, replay from end and track replacement use the existing reset generation: all DSP/event/tempo history resets, beat phase/pulse clear, and current palette/visual time remain. Every seek resets tempo (a conservative extension of the large-jump requirement). Unexpected backward timestamps or gaps >500 ms reset event history. Duplicate timestamps replace history points rather than growing it. Android queued events >350 ms from the native playhead are discarded.

No native callbacks for two seconds freezes progression and shows an actionable message. The clock is also gated on loaded, allowed, playing, not buffering, not busy and not importing. No fake events substitute for missing samples.

## Rendering and failure

The SKSL RuntimeEffect compiles once at module initialization, including one failed attempt. Null or throwing compilation returns the legacy gradient with the same once-limited visible palette; DEV diagnostics expose the failure. A rendering exception boundary attempts the legacy canvas under a second boundary; if Skia itself is unavailable it uses the retained dark background. No random audio features are generated.

The Canvas fills the viewport. A background Pressable and the overlay are siblings so background toggles cannot consume slider/button touches. The overlay fades on the UI thread after a hide-intent timeout. It stays visible while paused, scrubbing, loading/error, diagnostics or screen-reader interaction. The status bar hides in immersive playback.

## Safety and accessibility

V2 limits OKLCH lightness to 0.28–0.62, chroma to 0–0.12, lightness slew to 0.18/sec, chroma to 0.10/sec and hue to 18 degrees/sec in one UI-frame layer. GPU interpolation does not apply the historical limiter again. Beat/onset effects deform coordinates and locally adjust pigment rather than globally flashing luminance. Bloom is bounded to 0.22. RGB conversion retains chroma-reduction gamut mapping.

Reduced-motion preference slows advection and attenuates rhythmic displacement to 18%, and removes the player transition. Preference changes are observed. Controls have dark scrims, accessibility labels, slider values and 48+ dp button targets. Screen-reader users keep controls visible. Visual comfort and native accessibility remain device-validation items.
