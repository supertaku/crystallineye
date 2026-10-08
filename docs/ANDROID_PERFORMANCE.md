# Android performance and evidence — 2026-10-08

No physical phone was connected (`adb devices -l` returned an empty list). The user confirmed no phone is available and requested this remaining gate be documented. There is no new emulator run in this remediation task. Prior Android 14 emulator results are historical, used audio disabled and a software GPU, and do not establish physical performance.

## Measurements actually run

Node 22.20.0 on Windows, 32-second original generated arrangements, composer `paint-composer-3.1`. A 1,000-position deterministic seek/lookup benchmark records JS computation only:

| Complexity | Composition ms | Geometry preparation ms | Lookup p95 ms | Mounted drawables | Legacy renderer on same new geometry |
| --- | ---: | ---: | ---: | ---: | ---: |
| Simple / sparse | 9.46 | 3.73 | 0.0152 | 118 | 358 |
| Medium / pop | 5.02 | 4.72 | 0.0111 | 99 | 515 |
| Dense | 4.35 | 1.36 | 0.0059 | 87 | 509 |

Baseline actual old geometry had maximum mounted drawable counts 176/443/397. These counts include strokes/drops/washes, not grouping/animation infrastructure. The new score also changes event filtering, so old-versus-new combines composer and renderer effects. The last column isolates node allocation on identical new geometry. More scenes can mount during short-section dissolves/preloading, but obsolete history is released.

The final FULL True Colors score has 14 scenes and an inferred peak of 478 mounted drawables, versus 1,671 for the old per-cubic renderer on those same layers. The final benchmark above was repeated after the planned-velocity correction. Timing varies with host load; negative measured heap deltas mean garbage collection ran, not that the renderer consumes negative memory.

Commands: `npm run benchmark:v3`, `npm run validate:paint`, and `npm run validate:paint -- .build-tools/true-colors-allinone/true-colors.analysis.json`. Reports live in ignored `research/results/generated/v31-performance/` and `research/results/generated/paint/`. CPU raster times include PNG encoding; heap deltas include GC variation. Neither is Android frame-time/memory evidence.

## Required physical protocol

Use a midrange and higher-end Android phone. Record model/composer versions, track hash, build, device/OS, refresh rate and thermal state. Compare A synthetic/simple, B native/simple, C synthetic/full, D native/full behind triple-tap DEV. Record traces while closing the panel during playback. Saved JSON retains 1,200 samples (about 20 seconds at 60 Hz), so capture each representative passage separately.

Measure native position versus supplied paint time, seek status, buffering, scene commit state, native read cost and JS intervals. These traces do not include audio output latency or GPU presentation. Pair them with actual audio/video event measurement and Android frame/memory profiling. Targets: no unexplained backward jumps, no growing drift, pause pixel identity, reproducible seek, supported event error preferably at most 70 ms, at least 30 presented FPS and preferably 60 (16.7 ms budget at 60 Hz).

Run sustained five/six-minute sparse/dense playback, forward/backward/rapid seeks, buffering/backgrounding, codec/stereo/resampling checks, memory/GC, section transition cost, thermal and battery measurement, cache corruption/restart and cancellation. Do not infer these from the desktop model process. All-In-One's roughly 4.57 GiB desktop peak reinforces keeping it outside the Android app.
