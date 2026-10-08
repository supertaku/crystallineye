# Rhythm engine

`MusicEventEngine` accepts timestamped `AudioFeatureFrame`s, not PCM. The original DSP onset remains separately visible in diagnostics. The combined novelty heuristic is:

```text
0.55 × raw onset
+ 0.25 × clamp(positive normalized energy delta × 3)
+ 0.20 × clamp(sum(abs(relative region delta)) × 1.5)
```

Weights/gains are configurable in `RHYTHM_CONFIG`, and are artistic engineering choices rather than universal MIR coefficients. The first 250 ms after continuity reset suppress transients. Energy, brightness and spectral balance get a single attack/release envelope; onset and beat get timestamped exponential decay without the old multi-stage color damping.

## Bounded history and tempo

`OnsetEnvelope` is a fixed-size circular buffer: 360 timestamp/strength pairs and at most 12 seconds. Duplicate timestamps replace the existing strength with the maximum; backwards timestamps reset the ring. The stored strength is combined novelty. Tempo linearly resamples only those measured feature points onto a 30 Hz grid for fractional-delay autocorrelation. This is not contiguous PCM reconstruction, and cannot restore missed events.

No BPM is returned before eight seconds of useful history. Preferred history is ten seconds. Every 500 ms, normalized mean-centered autocorrelation searches 60–180 BPM, with a small weighted neighborhood around each candidate lag. Local peaks are ranked; comparable half/double-time peaks prefer the shortest period during initial acquisition, then the peak nearest the stable tempo. This tie-break is heuristic and can choose double-time for syncopated music.

Acquisition needs three agreeing candidates within four BPM from a five-candidate window and confidence ≥0.45. A locked BPM follows voted estimates with a two-second time constant and at most two BPM/sec slew. Estimates do not bounce immediately between 120 and 60. Weak correlation reduces confidence; absent recent novelty also reduces confidence. Constant/silent envelopes never acquire tempo. Historical evidence can leave a BPM with low confidence; the interpreter treats it as unknown and uses neutral flow.

## Beat clock

A thresholded rising novelty event, with a 220 ms refractory interval, creates an onset pulse. `BeatTracker` anchors to measured events, uses the confident tempo period to coast through missing onsets, and moves phase toward events within 22% of an expected beat with a correction gain of 0.35. Off-beat events outside that window remain onset disturbances and do not immediately reset the clock.

Phase 0 begins a beat, phase 0.5 is halfway. Every predicted cycle produces an exponential pulse with a configurable 240 ms decay. Diagnostics distinguish observed matches (`detected`) from predicted progression. Unknown/low-confidence tempo exposes phase 0 and an onset-derived pulse. The UI extrapolates phase between audio callbacks while playback is active; pausing stops progression.

Pause clears transients and beat location while retaining tempo evidence. Seek/replacement/replay and timestamp discontinuities clear all history. A 250 ms warm-up prevents a false post-seek novelty spike; the currently displayed palette is retained elsewhere in the visual layer.

## Tests and limitations

`tests/rhythm.test.ts` covers 60/90/120/150 BPM synthetic novelty, ±5 BPM tolerance, half-time stability, missing events, weaker extra onsets, broad low-rate events with timestamp jitter, silence/constant novelty, confidence decay, bounded history, beat phase/coasting and pulse decay. `tests/visual-engine.test.ts` includes real synthetic snapshot PCM through sampler → DSP → events → visual uniforms and deterministic 120 BPM recovery.

`npm run fixtures` adds original 24-second kick/click WAVs at 44.1/48 kHz for the same tempos plus 120 BPM missing/extra-onset variants. They are manual validation inputs, not production substitutes for real audio.

Android snapshots may miss short transients; Visualizer normalization alters energy information; low callback cadence and syncopation can lower confidence or produce a harmonic tempo. This is a lightweight heuristic, not research-grade beat tracking. Real pop/EDM, acoustic/ballad and rhythmically complex tracks remain necessary for genre tuning. No copyrighted songs are committed.
