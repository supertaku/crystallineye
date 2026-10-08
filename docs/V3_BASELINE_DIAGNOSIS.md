# V3.1 baseline diagnosis — 2026-10-08

Starting commit `e498f9941ba615c9b7b597baf06a4f845eb565aa`; clean working tree on `codex/composition-driven-v3`. Remediation branch: `codex/v3-music-alignment-remediation`. V2 preserved. Source audio is the local `music/Justin Timberlake, Anna Kendrick - True Colors (Lyric).mp3`, SHA-256 `72621718f6e76530d87400479aed14bf7e1d7bf6ba71f857815db83007d45c92`.

## Checks actually run before changes

Dependency install (existing tree, scripts disabled), lint, typecheck, all 60 tests, V2 benchmark, six shader previews, and seven paint previews passed. Desktop JS snapshot pipeline mean 0.1643 ms, p95 1.1823 ms. No native Android GPU timing was measured. Expo doctor attempted separately; final status is in [validation](V3_REMEDIATION_VALIDATION.md).

## Reproduced mechanisms

| Layer | Evidence | Practical effect |
| --- | --- | --- |
| Score geometry | Generated sparse/pop/dense maximum adjacent connected stroke distance 0.643/0.523/0.574 in normalized coordinates | New bar gestures can jump to another canvas region. |
| Paint geometry | Per-cubic round caps and independently revealed width/color; neighboring width ratios up to 2.357 | Connected pieces can have conspicuous joins and pressure steps. |
| Event use | `VisualScore.accents` has no renderer consumer | Beat events do not provide explicit pressure articulation. |
| Transport | Mock native time 100, seek 10 then 50, returns stale 100 | Latest seek can be overwritten by a stale native position. |
| Analysis | Normal import uses DSP with `notes=[]` | Note recognition is unavailable without exact-source research JSON. |
| Harmony | Section palette samples one early chord | Later harmonic transitions in the section cannot consistently affect the main paint palette. |

Frozen generated scores/metrics: ignored `research/results/generated/v31-render-baseline/`. True Colors A/B/C baseline: ignored `research/results/generated/true-colors-ab/baseline/`. Same waveform, DSP features/harmony/sections, composer `paint-composer-2`, and renderer were held fixed. A has 71 strokes, B 111, C 113; see local report for exact counts. Maximum connected distances are 0.7246 in A and 0.7371 in C. Adding model events does not cure independent origins. [The controlled comparison](TRUE_COLORS_AB_TEST.md) records final counts separately.

## Native and perceptual limits

The user confirmed no physical Android phone is available. ADB lists no devices. There is no new physical recording, logcat playback trace, audible passage annotation, or native frame-time result. Previous emulator evidence is historical and its audio was disabled. This report reproduces source mechanisms with deterministic input; it does not assert that every reported physical twitch has been reproduced.

Candidate passages must be selected from actual waveform/model inspection and then reviewed by listening. No timestamps are labeled as a recognized vocal phrase, verse, chorus, rest, or correct downbeat without that review. [Music analysis](TRUE_COLORS_ANALYSIS.md) records predictions separately.
