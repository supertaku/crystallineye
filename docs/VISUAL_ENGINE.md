# Visual engine — fluid ink

`FluidInkField` uses `Skia.RuntimeEffect.Make(FLUID_INK_SKSL)` once, then `Canvas → Fill → Shader` over the complete viewport. No WebView, GL/Three.js, particle engine or fluid simulation is introduced. It retains Skia 2.6.2, supported by this project's pinned Expo SDK 57 dependencies.

## Musical grammar

| Measured meaning | Visual meaning |
| --- | --- |
| Confident tempo | Baseline flow speed, 0.08 + 0.30 × normalized tempo, with a modest energy term |
| Beat pulse | Macro coordinate expansion, transient warp; no global brightness flash |
| Onset envelope | Organic domain disturbance and bounded local highlight |
| Lower relative spectral region | Large structures through lower spatial frequency |
| Middle relative region | Primary fluid deformation |
| Upper relative region | Fine turbulence/detail |
| Energy | Pigment presence/density and chroma, rather than mainly luminance |
| Brightness | Palette lightness and filament prominence |

The interpreter maps energy/brightness/spectral character to a controlled three-color OKLCH palette. Hues can evolve slowly around the configured base and offsets; they do not pretend to represent notes. Spectrum regions are dimensionless on Android Expo Go. Low/middle/high names in code do not imply calibrated frequency bands.

## Procedural renderer

Aspect-correct centered coordinates feed four-octave fBm, two domain-warp stages, a second density field and a single fine-detail noise sample. Pigment boundaries/filaments use the warped field to suggest wet ink, folds, smoke and waves. A deterministic hash supplies spatial noise; no random music input is generated. Palette blending is computed on GPU and resolution comes from window dimensions.

`SHADER_CONFIG` controls octaves, warp stages/amplitude, macro/detail scales, onset warp, beat expansion, filament frequency and pigment contrast. Current artistic settings have been inspected on desktop software-Skia previews. They remain initial device-tuning values. Optimize octaves, warp stages, detail and palette cost in that order if Android GPU performance is poor; preserve DSP correctness.

## UI clock and uniforms

Reanimated's UI-thread frame callback continuously advances `time += dt × flowSpeed` while real sampling and playback are active, even if feature targets barely change. Pausing/backgrounding/buffering freezes it. The existing time is retained on resume and seek. Between feature callbacks, beat phase and pulse advance from the measured target phase and confident period. Ordinary uniform targets interpolate with a 55 ms time constant; transient envelopes retain their immediate attack.

Compact numeric uniforms contain resolution, visual time, energy/brightness, relative regions, onset, normalized tempo/confidence, beat phase/pulse, RGB palette, reduced motion and explicit deformation/density controls. They never contain PCM. `visual-frame.ts` applies one OKLCH color safety slew layer before gamut conversion. There is no second renderer limiter or `ColorEngine` damping in the v2 runtime.

Reduced motion slows visual time and attenuates displacement. Beats disturb shapes rather than globally switching from dark to light. Palette lightness/chroma/hue limits and bounded local bloom remain in force, but this is not a medical safety certification.

## Fallbacks and developer checks

Null/throwing compilation selects `LegacyGradientField` and records the failure for DEV diagnostics. Rendering errors attempt the legacy canvas through an error boundary; a second boundary provides a static dark background if Skia itself fails. The legacy renderer preserves the original fixed diagonal spatial grammar, using the new safe visible palette for comparison.

Triple tap the top-right DEV hotspot to access Fluid Ink / Legacy Gradient / Motion Debug and manual beat, energy, spectrum and tempo checks. Manual tests are visual-only, clearly labelled, isolated from event history and guarded by `__DEV__`. Closing diagnostics restores real inputs. Pause remains respected with a loaded track. Before importing, DEV manual preview can run independently.

`npm run validate:shader` compiles actual SKSL with the already-installed CanvasKit dependency and renders portrait, moving-time, beat, upper-spectrum, quiet and wide snapshots under `fixtures/generated/shader/`. It validates syntax/uniform wiring and permits visual inspection; software raster previews cannot establish Android GPU compilation, smoothness, touch behavior or actual presented FPS. Node unit tests check semantic state/uniform behavior, not pixel-perfect output.

## Remaining acceptance

On physical Android: verify continuous organic movement, obvious repeating spatial pulse, responsive texture/color changes, frozen pause/resume, clean seeks and a completely immersive screen after overlay fade. Measure ~60 presented FPS where possible and stable ≥30 FPS on slower devices. UI callback FPS is only a scheduling metric. Test multiple genres and output routes; record device/Android/Expo Go build plus callback size/rate and DSP mean/p95.
