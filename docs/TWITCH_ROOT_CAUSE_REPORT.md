# Twitch root causes — 2026-10-08

## Confirmed in source and deterministic reproduction

1. **Bar origins reset.** `stroke-generator.ts` samples independent seeded positions/directions per bar. Randomness is reproducible but spatially discontinuous. Full-track ML inputs still produce normalized jumps over 0.73. Preserve brush endpoints across gestures; let music change contour and pressure.
2. **Path pieces render independently.** `StrokeLayer.tsx` mounts three paths, shader, blur, and shared-value calculations per cubic. Adjacent pieces use mean segment width and independent round caps. Consolidate timed deposition into pressure-aware ribbon paths, preserving already painted widths/colors.
3. **Beat accents are disconnected.** Composer emits accents but paint does not use them. Consume each accent as a bounded envelope localized on the targeted brush at its song time.
4. **Rapid seeks can accept stale native time.** Native 100 → requested 10 → requested 50 reproduces a return to 100. Acknowledge within a target plausibility window; explicit seek reconstructs immediately and keeps that image until native acknowledgment. Timeout must be recoverable.

## Confirmed music interpretation limitations

Normal mobile analysis has no note transcription. Its contour represents measured dynamics/spectrum; it cannot know a sung note's duration or pitch. Research import provides actual note predictions but mixed accompaniment still contaminates a dominant line. The main palette is sampled near section start, while drops use unrelated seeded canvas locations. These rules need explicit harmonic timing and local placement, independently of model accuracy.

## Hypotheses requiring native evidence

- React `sceneIndex` commit can lag shared `songTime`; this code permits a temporary mismatch, but no blank presented frame was captured in this task.
- Dense Skia trees, blur/shader cost, garbage collection, and per-frame native read overhead may affect pacing. Drawable counts and desktop CPU images alone do not prove GPU stalls.
- Native clock jitter/backward corrections outside explicit seek require the new trace; no physical clock result exists.

## Controlled experiments

DEV modes A (synthetic/simple), B (native/simple), C (synthetic/full), D (native/full) isolate delivery from geometry. A uses no audio. C needs a loaded complete score. Real device A/B/C/D traces, screen captures and presented frame-time measurements remain required. The synthetic clock is a diagnostic input; normal production painting still reads native musical time.

See [validation](V3_REMEDIATION_VALIDATION.md) for implemented fixes and measured after-results, and [Android performance](ANDROID_PERFORMANCE.md) for the outstanding physical gate.
