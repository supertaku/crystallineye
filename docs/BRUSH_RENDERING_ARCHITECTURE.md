# V3.1 continuous brush architecture

The score stores normalized timed points with pressure/color and optional planned velocity. `strokeSegments` builds time-scaled cubic Hermite curves. Neighboring cubics use the same shared velocity; a shared limiter keeps control points inside normalized canvas bounds without separately clipping tangents. Explicit planned velocities preserve continuity between consecutive gestures. Legacy points without velocities still use neighboring-point estimates.

`brushStateAt(stroke, songTime, accents)` performs deterministic timestamp lookup. Width/opacity use smooth interpolation. Accents are causal, target-local pressure envelopes. `prepareStrokeGeometry` samples pressure into ribbons, including accent onset/peak/relaxation. `revealedCubicsAt` uses exact de Casteljau subdivision: musical time selects the cubic prefix, rather than treating total path length as elapsed time. This retains event timing on uneven curves.

The native `StrokeLayer` mounts one filled ribbon per contiguous pigment run, plus one diffusion path and one strand per gesture. Pigment color/pressure belongs to the time when it was deposited. Completed paths are memoized; only the current tip prefix changes. The existing static-grain RuntimeEffect, wet/dry settings and age-based diffusion remain. Solid-color rendering is the shader compilation fallback. No independent paint clock or random per-frame noise is introduced.

`ScorePlayer.layersAt` pre-mounts the incoming scene and retains all scenes whose six-second dissolve can still be visible. It removes obsolete detailed sections instead of keeping a full song indefinitely. The DEV renderer estimate counts mounted curves, pigment paths/shaders, diffusion/blur, drops and washes. These are inferred counts, not native profiling.

`VisualTimeGate` publishes ordinary shared-time updates immediately when the required scene is mounted. Far seeks hold publication until React commits matching layers; a newer seek back into mounted layers cancels a pending destination. Native playback remains authoritative. Requested seek time reconstructs directly, then a native acknowledgment gate rejects stale source positions. Pause/buffering freezes all supplied musical time.

Desktop CanvasKit uses the same cubic lookup and pressure ribbon helpers and checks byte-identical pause/seek frames, shader fallback, reduced motion, accent differences and nonblank section transitions. Native rendering still requires a phone: desktop CPU raster, JS callbacks and node counts cannot measure Android frame presentation, GPU load, memory growth or audible synchronization.

Current bounds are per-song duration/resource gates, bounded melody candidates/frontier (16), gesture chunks at most four seconds, and section-local mount windows. Dense pigment/color changes can still create several runs per gesture; offscreen raster caching remains a future measured optimization, not implemented here.
