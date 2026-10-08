# Crystallineye journal

I'm keeping this journal so we can pick up where we left off and remember why we made each choice. I'll write it like a quick conversation: what I checked, what I decided, why it made sense, and what happened next.

## How I'll keep this going

- I'll add a short entry after each meaningful step: finding something useful, choosing an approach, making a change, checking the result, or hitting a blocker.
- I'll use first person, everyday words, and a casual tone. A few clear sentences are usually enough.
- I'll record the decision and its practical reason, along with any evidence or uncertainty that matters.
- I'll make it clear when something is planned, tried, checked, or finished.
- I'll keep earlier entries and add a new one when I change direction, so we can follow how the decisions developed.
- I'll use dates in Manila time. If a day has several entries, I'll give each step a short title.

## 2026-10-08 — Starting the journal

### Step 1 — Getting my bearings

I read the README, the opening of the original product requirements, and your V3 implementation plan. I also checked the project files. The current app has the V2 audio, rhythm, and fluid-ink systems, along with tests and validation docs.

The README says software checks passed previously, while physical Android playback, visual responsiveness, and performance still need checking. I'm treating that as the documented starting point. I haven't run those checks during this journal task.

### Step 2 — Recording where we're headed

Your V3 goal gives us a clear direction: the song should feel like it's being painted. The plan is to analyze the whole song, turn that musical information into a visual score, and play the painting using the song's playback time.

I'm keeping three separate jobs in view: understanding the music, composing the visuals, and drawing the paint. That lets us change how the painting looks without analyzing the song again.

The plan also puts the Python music analysis and score-driven painting prototype ahead of on-device ML. The reason is simple: we need to see whether the brush gestures actually feel connected to the music before spending time fitting the models onto Android. V2 stays available as our comparison baseline.

These are the intended V3 choices from your plan. Their implementation and validation are still ahead of us.

### Step 3 — Making the journal part of our workflow

I added this journal and a short instruction in [AGENTS.md](AGENTS.md) to keep it updated during future work. I chose short entries for each meaningful step so we can follow the decisions without getting buried in a log of every command.

For future entries, I'll use this simple shape when it helps:

> **What I checked or changed:** ...
>
> **What I picked and why:** ...
>
> **What happened when I checked it:** ...
>
> **What I'll do next:** ...

The next V3 task in the plan is to preserve the V2 baseline and record its validation results before starting the migration.

### Step 4 — Reviewing the files

I read both new files and checked their formatting. The first check caught extra spaces in the entry template, so I cleaned those up. I kept this task to documentation; app tests aren't needed for these changes.

## 2026-10-08 — Starting V3

### Step 1 — Preserving our starting point

I read your full implementation request and checked the current app wiring. I tagged commit `2a9a9b0` as `v2-fluid-reactive` and created `codex/composition-driven-v3`. The journal files were still uncommitted and came along with the new branch.

I'm running the baseline checks before changing the app. I'll build the score-driven prototype and its desktop music-analysis tools before integrating mobile ML, following the decision gates in your plan. I'm also checking which Android tools and Python packages are actually available here.

### Step 2 — Checking the baseline and the tools

The V2 lint and TypeScript checks passed, all 50 tests passed, and the fluid shader compiled and produced six desktop previews. The desktop rhythm/visual pipeline measured about 0.157 ms on average and 1.183 ms at the 95th percentile. Those numbers cover desktop processing, so Android performance still needs a device run.

I found the Android SDK and Java, but ADB lists no connected device. The bundled Python has NumPy but none of the requested music models. I installed pinned Audio API and Expo development-client dependencies while retaining expo-audio for comparison. I'm starting with shared schemas, measured DSP features, and separate composition code so the painting prototype can accept Python reference results later.

### Step 3 — Keeping the music and painting separate

I added the music schema, full-track DSP fallback, melody selection, chord templates, and section novelty tools. The fallback leaves note events empty and labels its four-beat drawing anchors as inferred. That gives us a usable lower-quality path while keeping uncertainty visible in developer diagnostics.

I built a separate visual composer with song-based seeds, note contours, brush pressure, supporting washes, and local ink drops. The paint runtime looks up the current and previous section using song time, so seeking can reconstruct the same marks without replaying a hidden animation clock.

### Step 4 — Wiring the app and research setup

I changed the default workflow to an Expo development build and kept V2 in a developer comparison screen. The V3 screen analyzes before enabling playback, shows real stage progress, keeps the small auto-hiding player, and can load a matching research JSON file in development mode. The audio path checks metadata and memory before allocating PCM and hashes the file in small chunks.

Basic Pitch's default TensorFlow dependency failed on Python 3.12. I'm setting up its official ONNX model instead. The Android prebuild succeeded and Gradle is compiling the native project. I also checked the pinned Audio API source: file seeks happen asynchronously, so I added a gate to hold the reconstructed painting until the native clock reaches the seek target.

### Step 5 — Checking the new behavior

All 59 tests passed, along with lint and TypeScript. The new checks cover calibrated 440 Hz audio, unsafe files, silent music, deterministic scores, persistent marks, seeking, a stalled audio clock, and cache versions. I kept the checks tied to behavior we care about.

The Android build got through the audio library but hit Windows' long-path limit in CMake. I added an Expo config plugin that lets CMake shorten its object paths, so the fix survives a fresh prebuild. That build is still running.

### Step 6 — Running real reference models

I built the Python CLI and ran the official Basic Pitch ONNX model and both Beat This checkpoints on five original synthetic compositions. That first run found a missing old Python helper and a tiny rounding overflow in chord confidence. I fixed those instead of loosening the schema checks.

The CLI saves model tensors, beat logits, normalized audio, and timing reports. Its strict mode requires all three reference models. All-In-One is installed now, but I'm still checking its extra native dependencies, so I haven't called the research milestone complete.

I also rendered seven desktop paint frames with Skia. Returning to the same song position produced identical image bytes after a simulated seek. Those images let us review the brush shapes, but they don't prove Android GPU performance or that the artwork feels better than V2.

### Step 7 — Looking at the music and the paint

The corrected batch produced five valid files with actual Basic Pitch notes and Beat This beats and downbeats. Python and TypeScript agreed on the measured audio features to within about 0.00000014. The synthetic comparisons also showed extra note detections and some beat/bar confusion. I kept those results in the research notes so we can tune from evidence.

I looked at the paint previews and widened the gestures, reduced the glow, and added a small static pigment texture. I bumped the composer version so cached music gets the new painting. Both the known-score and model-score previews still reproduced identical frames after a seek.

### Step 8 — Getting Android to compile

Shortening object names alone didn't fix Windows' path limit, and a newer Ninja still rejected the generated paths. I used a temporary drive alias of this workspace to shorten the CMake staging path. That worked: the development APK built for arm64 and x86_64 in 6 minutes 24 seconds. I saved the setup in a build helper so we can repeat it without moving the project or changing the installed Android SDK.

The Android JavaScript export and Expo dependency check passed too. I added separate V3 architecture, status and native validation docs, and kept the old README as the V2 record. All-In-One still can't import without madmom/NATTEN on this host, and ADB has no physical phone. Those gates stay open; I'm following your requirement to finish the music/paint review before integrating mobile ML.

### Step 9 — Trying the actual native paths

I created an isolated emulator from the Android image already installed here. Metro first listened only on IPv6, which didn't work with ADB's local connection. Switching its localhost lookup to IPv4 fixed that. V3 launched, and the real picker imported the calibration WAV. Native decoding gave us 22,050 Hz mono, two seconds, and an FFT peak of 441.43 Hz for the 440 Hz input. That's within one FFT bin.

The longer song then exposed a bug I missed in the mock decoder: Audio API copies the whole backing buffer, even when we pass a shorter view. I gave the last PCM chunk its own small buffer and added a test matching that native behavior. The 32-second import then worked. Lint, TypeScript and all 60 tests passed after the fix.

I loaded the matching Python JSON in the emulator and saw its 180 notes and 64 beats drive the native paint. Playback advanced, seeking backward rebuilt the picture at 12 seconds, and the paused paint stayed pixel-identical across captures. Resume reached the song's end. This is a useful native smoke test, but the emulator has audio disabled and a software GPU, so listening tests and phone performance are still ahead of us.

### Step 10 — Checking reuse and leaving a clear handoff

I restarted the app, imported the same song, and checked the developer panel. It restored the saved research analysis and showed “cached.” I also opened V2 inside the new native build; its screen and fluid field still launched without a runtime error. The final Android JavaScript export passed after the native-copy fix.

I kept the milestone table honest: the foundation, desktop references and native smoke path are ready for review, while All-In-One, listening comparisons and physical-device checks still need evidence. I didn't add mobile ML or run source separation past your decision gate. I'm saving the test captures and stopping the emulator and Metro process I started for this check.

## 2026-10-08 — Pushing the V3 changes

### Step 11 — Checking the GitHub target

I checked the current branch and working tree before pushing. The V3 files are on `codex/composition-driven-v3`, and GitHub's `main` still points to the shared base commit `2a9a9b0`. I'll commit the current project changes here and push that commit to `main`, so the V3 work is available on the branch you asked for.
