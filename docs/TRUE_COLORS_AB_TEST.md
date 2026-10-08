# True Colors controlled comparison — 2026-10-08

Exact MP3 SHA-256: `72621718f6e76530d87400479aed14bf7e1d7bf6ba71f857815db83007d45c92`. Normalized duration: 243.391565 seconds. No human preference or transcription-accuracy result is claimed.

## Analysis-only comparison

`scripts/compare-true-colors.ts` reads the same normalized PCM and runs the actual TypeScript fallback. It holds DSP features, DSP harmony and DSP sections fixed across A/B/C. A uses DSP rhythm and no notes; B substitutes Beat This small0 rhythm; C adds Basic Pitch notes. Composer and renderer versions are held fixed within each batch. The separate FULL All-In-One reference uses its own inferred harmony/sections and is not substituted into this controlled batch.

| Variant | BPM estimate | Beats / downbeats | Notes | Baseline strokes | V3.1 strokes | Baseline connected jump | V3.1 connected jump |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| A: DSP | 147 | 60 / 15 inferred | 0 | 71 | 70 | 0.7246 | 0 |
| B: model rhythm | 71.43 | 286 / 98 | 0 | 111 | 112 | 0.7371 | 0 |
| C: rhythm + notes | 71.43 | 286 / 98 | 2,076 | 113 | 155 | 0.7371 | 0 |

Distances use normalized canvas coordinates and adjacent gestures with gaps at most 0.45 seconds. Baseline composer is `paint-composer-2`; final composer is `paint-composer-3.1`. Comparing those batches evaluates combined composition changes, including melody selection; it is not an analysis-only isolation. A/B/C within each batch remains controlled. More strokes in C reflects real selected rests splitting contact, and does not by itself mean better art.

In V3.1 A/B/C, drops are 118/147/89, washes 130/130/130, and local accents 56/286/245. All use the same 250 DSP chord estimates and 12 DSP sections. The Python PARTIAL reference has 14 DSP sections because its structure/harmony derives from notes; that difference is deliberate and not parser disagreement. The FULL reference also has 14 sections, now predicted by All-In-One-Infer.

Old forced-onset melody selection yielded 1,198 notes with median duration 0.163 seconds and 190 adjacent jumps over an octave. The bounded interval path yields 614 notes with median 0.280 seconds, no adjacent over-octave jumps, and similar source-time coverage (90.88% versus 90.14%). These describe interpretation stability, not singer identity or correctness. A rejected duration-only prototype preferred bass; a soft mixture-derived register prior corrected that bias on this input.

The DSP rhythm differs markedly from both models on this recording: 60 beats versus 286 and a near double-time tempo estimate. Model agreement is high for beats (98.61% one-to-one symmetric agreement within 70 ms) and lower for downbeats (71.72%). Agreement cannot establish correct meter. Keep ambiguous bar events lower-confidence; no listening-based downbeat accuracy was measured.

## Reproduce locally

```powershell
npm run compare:reference -- 'research/results/generated/Justin Timberlake, Anna Kendrick - True Colors (Lyric)-72621718f6e7/song.analysis.json' remediated
```

Ignored outputs live at `research/results/generated/true-colors-ab/baseline/` and `remediated/`: analyses, scores and report. The baseline is frozen; running current code with the label `baseline` would overwrite it and would not reproduce the old version. Recreate the original in a separate checkout of the recorded starting commit using the same source PCM and the comparison script.

## Listening/device gate

Compare V2, old DSP V3, ML V3 with old composition, and fixed ML V3 on the same physical phone, screen size, song positions and recording. Score predicted passages after listening; record human annotations separately from model output. No phone is available in this task, so visible melodic coherence, beat error against audible events, accessibility preference and final user acceptance remain pending.

The evidence justifies keeping the continuous composer and evaluating note/rhythm models further. It does not justify bundling mobile ML yet. [Mapping](MUSIC_VISUAL_MAPPING.md), [analysis](TRUE_COLORS_ANALYSIS.md), and [validation](V3_REMEDIATION_VALIDATION.md) describe the implementation and remaining gates.
