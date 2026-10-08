# Music-to-paint rules — V3.1

**V3.2 superseding trajectory rules:** Default position now comes from adaptive musical phrases, scored canvas placement and confidence-gated nonlinear pitch intervals. Each note retains measured onset/offset, every positive selected rest lifts contact, and section knots/slices preserve planned geometry and pressure. Beat, palette, pigment and native clock rules below remain the shared material/transport baseline. The sine/cosine trajectory is available only through the retained V3.1 comparison. See [V3.2 trajectory rules](V3_2_MELODY_TRAJECTORY.md) and [matched reference evidence](V3_2_REFERENCE_BASELINE.md).

Audio analysis describes musical evidence and uncertainty. The composer turns that evidence into a fixed score. Paint reconstructs the score at supplied song time. The normal player remains minimal; diagnostics are behind the existing DEV triple-tap gesture.

| Musical evidence | Visual interpretation | Limits / settings |
| --- | --- | --- |
| Selected note onset/offset | Begin and stop brush contact; nearby notes form a gesture | Notes shorter than 60 ms or confidence below 0.15 are filtered; rests over 100 ms split contact. A note prediction is not an identified vocal. |
| Normalized melodic pitch | Small vertical movement | Track P10/P90 range with minimum seven semitones; confidence reduces specificity. |
| Sustained musical contact | Controlled continuous horizontal travel | Canvas travel depends on accumulated contact seconds, never a frame counter; seed affects static texture only. |
| Energy and note amplitude | Pressure, width and density | Width target 0.004–0.031 normalized; 0.35-second envelope; colors remain bounded. |
| Beat confidence | Targeted brush pressure increase | Causal sin-squared envelope, 0.22 seconds, at most 32%; no full-screen pulse. |
| Downbeat | Gesture articulation | Continuous endpoint/velocity preserved; low-confidence predictions do not teleport the brush. |
| Chord root/quality | New pigment palette | Known chord, confidence at least 0.35, interval at least 0.3 seconds; 0.6-second transition; unknown preserves palette. Circle-of-fifths colors are replaceable. |
| Strong onset + brightness + nearby beat | Local transient pigment disturbance | Energy at least 0.08, strength at least 0.55, 250 ms refractory period, within roughly 0.05 normalized distance of brush. This does not identify drums. |
| Bass-weighted energy | Soft underlying wash | No independent animation clock; static seeded placement and song-time age. |
| Section boundary | Reorganize scene while old pigment dissolves | Six-second overlap; incoming scene pre-mounted; multiple short prior sections remain for their valid dissolve interval. |
| Silence or a selected rest | Lift the brush | Existing pigment persists; no new decorative gesture. DSP silence uses decoded RMS threshold 1e-5. |

`BrushState` includes song time, position, velocity, direction, pressure, width, opacity, color and contact. Pure absolute-time lookup makes pause and backward seek reproducible. Control points closer than 10 ms are coalesced, retaining gesture endpoints. Explicit velocities carry intended tangent continuity across bars/sections; pressure is encoded into the deposition ribbon rather than changed on all old paint.

Normal imports still use whole-track DSP with no note model. They cannot promise recognized melody. DEV exact-source JSON imports supply Basic Pitch/Beat This/All-In-One predictions for research. A quality value of FULL means all reference subsystems are present; it does not mean perfect musical understanding.

Accessibility continues to use readable labeled controls, paused/scrubbing visibility, screen-reader visibility, reduced motion, fixed dark background, and localized intensity. Existing color-safety tests pass. Physical TalkBack, color-vision review, luminance/flash assessment, and listener acceptance have not been performed in this task.
