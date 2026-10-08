# V3 native validation

## V3.1 handoff

No physical phone was available during the remediation; the user asked to document the remaining gate. Use [Android performance](ANDROID_PERFORMANCE.md) and [remediation validation](V3_REMEDIATION_VALIDATION.md) for current build/software results. Behind the triple-tap DEV panel, run A synthetic/simple, B native/simple, C synthetic/full and D native/full. Record retained clock samples, save JSON, and navigate previous/next musical events. Pair source/supplied-time traces with actual presented frame profiling and audible event measurements. Prior emulator evidence below remains historical.

This checklist records physical tests still to run. A subset passed in the Android 14 emulator; [current status](V3_STATUS.md) records that narrower evidence. Run on a mid-range and a higher-end physical Android phone. Keep model/version, device, OS, thermal state, track hash and actual observations with each report.

## Build and comparison

- Install the development APK; connect to Metro and open V3. Confirm native Audio API initializes and Skia draws without a redbox or logcat error.
- Open the developer menu by triple tapping the top-right hotspot. Switch to V2, import the same song and verify original playback/rendering still work. Return to V3.
- Confirm normal controls hide during playback and stay visible during pause, scrubbing, import, errors and screen-reader use. Test TalkBack and reduced motion.

## Native calibration and transport

- Import `research/fixtures/generated/calibration-440.wav` through the real picker. Inspect normalized PCM/FFT: 22,050 Hz, mono, peak within one 2048-point FFT bin of 440 Hz and duration about two seconds. The existing software test covers Float32 DSP, not this native decode.
- Import known 44.1/48 kHz stereo WAVs, MP3, AAC/M4A, FLAC and Ogg files. Measure duration/seek offsets and sample normalization. Unsupported metadata should produce a recoverable message.
- Listen to a known click track and compare musical events to painting starts/pressure. Log actual file-source currentTime at each event; target tolerance is 70 ms where the source analysis supports it.
- Pause at several times: the same canvas must remain unchanged. Resume without skipped/duplicated events. Test native buffering/stalls and backgrounding.
- Seek forward/backward across phrase and section boundaries, including while paused, rapidly repeated seeks and seeking near the end. Compare to normal playback at the same position. Old pre-seek clock values must not overwrite the reconstructed canvas.
- Reimport the same URI/file and replace another song during playback. Cancel the picker and cancel analysis. No stale load/error callback may enable the wrong player.

## Persistence and resources

- Import the same exact file twice and restart the app; the second import should reuse analysis. Composer-version changes rebuild only visuals. Invalid cache/schema/hash references must fail safely.
- Test silent, sparse and dense six-minute tracks; reject files over six minutes or outside the resource budget before PCM allocation. Inspect native peak memory, JS heap, GC, analysis stage duration and cancellation recovery.
- Run painting for five minutes on both devices. Measure real presented FPS/frame time, mounted paths, memory growth, thermal behavior and battery cost. A desktop render duration or JavaScript callback FPS is not an Android GPU benchmark.

## Music/art gate

- Use at least five complete reference analyses from Basic Pitch, Beat This and All-In-One on representative legally usable songs. Note the source hash and versions. Synthetic plumbing fixtures alone cannot settle artistic quality.
- Compare V2 and V3 at the same song positions while listening. Ask which feels more connected, whether beats and phrase changes are visible, whether rests leave breathing room, and whether brush gestures feel coherent.
- Record failures by track/time and mapping. Tune the composer from those observations. Mark Milestones 3–6 accepted only when the requested reference, artistic and native synchronization evidence exists.

The TFLite and ExecuTorch work starts after this gate. CPU/GPU delegates, unsupported operators, model parity and two-device performance need their own measured reports then.
