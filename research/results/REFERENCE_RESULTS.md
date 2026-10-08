# Reference run — 2026-10-08

Five original 32-second synthetic arrangements were analyzed on Windows 11 using Basic Pitch 0.4.0's official ONNX model and Beat This 1.1.0 with both small0 and final0. All-In-One import failed because madmom is unavailable, so every result is PARTIAL with explicit DSP structural fallback.

These fixtures validate the pipeline and expose errors. They do not establish model quality on representative real music or pass the complete reference milestone.

| Arrangement | Note onset/pitch F1 | small0 beat F1 | final0 beat F1 | DSP boundary F1 |
| --- | ---: | ---: | ---: | ---: |
| Acoustic | 0.593 | 1.000 | 1.000 | 0.000 |
| Dense | 0.768 | 0.957 | 0.673 | 1.000 |
| Jazz | 0.728 | 1.000 | 1.000 | 0.000 |
| Pop | 0.722 | 0.992 | 0.992 | 1.000 |
| Rock | 0.770 | 0.730 | 0.672 | 0.000 |

Notes match within 50 cents and 70 ms of their known onset; offsets are ignored for this metric. Beat matching uses 70 ms; internal section boundaries use three seconds. Dense and rock arrangements show beat/downbeat ambiguity. Basic Pitch finds many known notes but also extra notes, lowering precision. The DSP section detector misses some known arrangement changes. These issues should guide the next music/art review.

The downloaded checkpoint sizes are 8,451,101 bytes for small0 and 81,058,141 bytes for final0. In the corrected warm batch, small0 inference took about 1.1–1.4 seconds per 32-second clip and final0 about 1.9–2.3 seconds. Native compilation ran on the same host during these measurements, so these are development observations rather than controlled performance benchmarks. Cumulative process peak working set reached about 633 MiB; this is desktop memory, not an Android requirement.

All five Python JSON files passed the TypeScript parser. The measured PCM feature differences were at most 1.33e-7 across RMS, energy, bass, brightness and onset values. Composition and time-based seek reconstruction were deterministic. Both the known synthetic score and the actual model score produced seven desktop Skia previews with byte-identical repeated frames after seeking. The actual pigment shader compiled.

The generated batch report, raw model outputs, plots, parity report, scores and images are under `research/results/generated/`. Recreate them using [the research commands](../README.md). They are intentionally kept out of Git.

Open gates: actual All-In-One sections, five representative complete analyses, subjective A/B evaluation against V2, native audio calibration and synchronization, physical-device stability and two-device performance measurements. Mobile ML integration and the separate source-separation experiment have not started.
