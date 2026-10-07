# Physical Android validation — pending

Run this on at least two Android devices from different manufacturers. No rows below have been marked passed by desktop tests.

Record model, Android version, Expo Go SDK/build, output route (speaker/headphones/Bluetooth), callback packet length/cadence, raw timestamp progression and debug DSP/UI callback metrics. Stay within the reduced MVP; no new screens or catalog are needed.

1. Install matching SDK 57 Expo Go, start `npm start`, scan the LAN QR code, and verify the native screen renders without errors. If required by the installed Expo Go build, sign into developer tooling as described in README.
2. Generate fixtures with `npm run fixtures`, transfer the WAVs to local storage, and import with the app's normal **Import Music** picker. The generator does not bundle fixture audio into the application.
3. Accept permission after the explanation. Verify PCM callbacks and frame counters increase only during playback. The native audio permission dialog must not appear before the explanation.
4. Repeat with permission denied. Verify playback remains usable, the color stays static, an explanatory status appears, and **Allow audio analysis** retries. Test permanent denial and the settings path.
5. Compare silence, 100, 1000 and 4000 Hz fixtures. Silence should have near-zero observed RMS and no onset. The dimensionless centroid should generally increase with frequency. Android **rate, Hz centroid and music bands must stay unavailable**, even if packet count/timing looks stable.
6. Play the amplitude ramp. Record whether native normalization obscures amplitude changes. Do not mark original-amplitude analysis validated solely from sampled RMS.
7. Import the validation sequence. Verify colors change at the corresponding sections without flashing or unrelated rainbow rotation. Measure sample-to-target latency if possible; smooth envelopes deliberately slow large transitions.
8. Pause halfway, record the displayed state, wait five seconds and verify it freezes. Resume and confirm callbacks and colors follow the resumed position without a stale onset accent.
9. Seek forward and backward while playing and paused, scrub the slider, restart, and replay after the end. Verify transient history resets, sampling recovers within approximately one second (subject to native callbacks), and pre-seek queued events do not appear as new-position analysis.
10. Import MP3, M4A/AAC, WAV, FLAC and OGG examples, plus a deliberately invalid file. Verify supported files load/play and errors stay readable/actionable. Cancel the picker and verify the prior track remains selected.
11. Test speaker/headphone/Bluetooth routes and route disconnect. Background/foreground the app: playback and visuals should pause; resume is a user action.
12. Exercise a 20+ minute track, repeated imports and repeated seeking. Check bounded JS analysis memory and absence of native resource leaks.
13. Record debug DSP duration and UI callback FPS across representative passages and system profiler measurements of GPU frames/JS stalls. Target average DSP <10 ms, ~60 FPS preferred, >=30 FPS minimum. Desktop benchmarks cannot pass this row.
14. Enable TalkBack and large fonts. Verify controls can be located, play/pause labels are meaningful, slider can seek, time and errors are readable, and no touch target is too small. Assess visual comfort with intended users before making accessibility-effectiveness claims.

Even if all interaction checks pass, accurate calibrated music bands cannot be accepted until Expo exposes the real waveform sample rate and a usable capture stream. Document this separately from the usability pass; maintain the current safe fallback while Expo Go is mandatory.
