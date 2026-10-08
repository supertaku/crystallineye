# Physical Android validation — v2 pending

No physical Android device or ADB session has been available to this implementation environment. Desktop tests and software-Skia previews do not pass the rows below. Test at least a representative midrange Android and, if available, an older/entry device and a high-refresh device. Use actual local songs; do not commit copyrighted audio.

## Device record

| Item | Actual observation |
| --- | --- |
| Device model / Android version | Pending |
| Expo Go version / SDK | Pending (must support SDK 57) |
| Refresh rate / viewport dimensions | Pending |
| Audio route (speaker/headphones/Bluetooth) | Pending |
| Callback rate / waveform snapshot size | Pending |
| RMS / sample-rate availability | Pending (Android Hz must remain unknown) |
| DSP mean / p95, event/interpreter duration | Pending |
| UI callback FPS / separately measured presented FPS | Pending |
| Tempo behavior, warm-up, beat synchronization | Pending |
| Genre / import format, no copyrighted file committed | Pending |

## Signal and shader checks

1. Start `npm start`, load matching Expo Go through the LAN QR code and verify Fluid Ink renders without native errors. Triple tap the top-right hidden DEV hotspot to inspect any shader failure. It must select Legacy Gradient if RuntimeEffect compilation fails.
2. Before artistic tuning, deliberately choose DEV **beat**: one pulse/second should visibly expand the field without a global black/white flash. Choose **energy**: a 0–1 sweep changes pigment presence. Choose **spectrum**: lower/middle/upper regions change macro/flow/detail. Choose **tempo**: 60–180 sweep increases flow speed. Close diagnostics to restore real inputs.
3. Generate fixtures with `npm run fixtures`, copy original WAVs to the phone and import through the normal system picker. Existing silence/sine/ramp/validation-sequence files are retained. No fixture is auto-played or bundled in production.
4. Play 60/90/120/150 BPM rhythmic fixtures for at least 20 seconds. BPM stays unknown during the first eight seconds, then should settle approximately near the fixture tempo when callback evidence is sufficient. Record ambiguity, confidence and visible repeating pulse. Check missing-beat and extra-onset fixtures; predicted beats should coast through occasional gaps.
5. Silence has near-zero observed RMS and no new onsets. Compare 100/1000/4000 Hz and the amplitude ramp: spectral texture should change; record whether Android normalization hides original amplitude. Android sample rate, Hz centroid and calibrated music-band values must stay unavailable.

## Musical acceptance

Use one clear pop/EDM track, one acoustic/ballad and one rhythmically complex track. For each record:

- Within several seconds, is there continuous organic ink/smoke movement, visible onset disturbances, texture change and shifting musical color character?
- Once rhythm evidence is useful, can a watcher identify a repeating spatial pulse without concentrating on the audio?
- Does tempo remain reasonably stable, or get stuck at half/double time? Does confidence honestly fall on unclear rhythms?
- Are beats conveyed through expansion/folding rather than whole-screen brightness flashing?

Do not tune only to EDM. These qualitative rows are pending even when deterministic tests pass.

## Playback and UI

1. Import MP3/M4A/AAC/WAV/FLAC/OGG and a malformed file. Verify loading/error states, cancel behavior, Replace and one-line title/time. Native decoder support varies.
2. Verify the sampling explanation precedes Android permission. Denial keeps playback usable with static visuals and a visible retry. Permanent denial offers Settings.
3. Start playback: minimal controls show, fade after 2.8 seconds of inactivity, and leave the entire app canvas visible. Tap hidden field → show; tap visible field outside controls → hide. Buttons/slider must not toggle the background.
4. Pause, wait five seconds: visual time and beat progression stay frozen, player stays visible. Resume preserves visual time/colors and suppresses stale transient onset. Repeat during buffering and at end-of-track.
5. Scrub longer than three seconds: controls never hide. Seek forward/backward while playing and paused. Verify all rhythmic history resets, no giant false onset, queued old events are ignored and tempo warms up again. Replay from end resets safely.
6. Background/foreground: playback and visual progression pause; user resumes. Test output-route disconnects, speaker, headphones and Bluetooth.
7. With reduced motion, verify slower/attenuated displacement and immediate player transitions. Enable TalkBack and large fonts: controls stay visible, labels/touch targets/slider/time/errors remain usable.
8. Try portrait screens at different sizes, a long track, repeated imports/seeks, rotation if allowed by system, and repeated pause/resume. Record memory/native resource behavior.

## Performance

Record diagnostics across representative passages: callback cadence/packet size, DSP mean and p95 (last 120 updates), event/interpreter ms and UI callback FPS. Use system/GPU profiling for actual presented frames; callback FPS is not a presentation guarantee. Aim for ~60 presented FPS, with stable ≥30 FPS on slower hardware, and DSP that does not obstruct frames.

If shader cost is too high, reduce fBm octaves, warp stages, fine detail, then palette calculation cost. Preserve tested DSP correctness. Record thermal throttling and long-session behavior. Desktop Node/software-raster figures cannot certify these targets.

Calibrated pitch/harmony-to-color remains outside this Expo Go milestone regardless of interaction results.
