# Crystallineye journal

I'm keeping this journal so we can pick up where we left off without losing the useful details. I'll explain what I checked, what I picked, why I picked it, what I tried, and what happened. I'll also explain the technical ideas in simple words and keep the tools, settings, commands, and unfinished work close by.

I keep the dated story below and a fuller [technical memory](#technical-memory--what-we-have-built-and-learned) after it. The story preserves what we knew at each step. The technical memory describes the current implementation and the earlier attempts that still matter. My first entries were brief; the expanded format replaces that earlier short-entry preference.

### Where I can find things quickly

- [The original journal entries](#2026-10-08--starting-the-journal)
- [The V3 implementation story](#2026-10-08--starting-v3)
- [The GitHub push record](#2026-10-08--pushing-the-v3-changes)
- [Our direction and V2 starting point](#1-the-direction-and-the-v2-starting-point)
- [The main tools and their jobs](#2-the-tools-i-used-and-what-each-one-does)
- [Local audio, memory limits, and cancellation](#3-how-i-prepare-a-song-without-wasting-memory)
- [The shared music data and measured analysis](#4-how-i-store-and-understand-the-music)
- [Python models and their setup problems](#5-the-python-reference-models-and-what-i-tried)
- [The visual score and paint rules](#6-how-i-turn-music-into-a-painting)
- [Playback time, UI, and cache](#7-how-i-keep-playback-the-picture-and-reuse-in-step)
- [Windows builds and native debugging](#8-the-windows-build-and-native-debugging-story)
- [Checks, measurements, and saved evidence](#9-what-i-checked-and-what-the-results-mean)
- [Commands and places to resume](#10-the-commands-and-files-i-want-to-remember)
- [Open gates and future options](#11-what-is-still-open-and-what-i-have-only-planned)
- [The format for future entries](#12-how-ill-record-the-next-steps)

## How I'll keep this going

- I'll add an entry after each meaningful step: finding something useful, choosing an approach, making a change, checking the result, or hitting a blocker.
- I'll use first person, everyday words, and a casual tone. I'll give each technical idea a simple explanation instead of leaving an unexplained name.
- I'll include enough detail to repeat the work: the approach, important settings, tool versions, useful commands, changed files, outputs, and checks.
- I'll record the decision and its practical reason, the alternatives I actually tried, their errors, the fix, and any evidence or uncertainty that matters.
- I'll make it clear when something is planned, tried, checked, or finished.
- I'll keep earlier entries and add a new one when I change direction, so we can follow how the decisions developed.
- I'll use dates in Manila time. If a day has several entries, I'll give each step a short title.
- I'll update the technical memory when the code or setup changes. I'll keep the old choice in the dated history so we can still understand the change.

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

### Step 12 — Pushing to main

I committed the V3 project changes as `385f3ef` and pushed them to GitHub's `main`. GitHub accepted the update from `2a9a9b0`; I haven't run any new app checks during this push task. I'm recording this completion so the next work starts from the right repository state.

## 2026-10-08 — Making the journal more complete

### Step 13 — Filling in the details we might forget

I read the existing journal, architecture, research results, validation checklists, dependency files, build helpers, and the main audio, analysis, composition, and paint code. I kept the earlier story and added the technical memory below. This gives us one place to remember the ideas, tools, settings, unsuccessful attempts, fixes, results, and open decisions.

I also changed [AGENTS.md](AGENTS.md) so future work keeps these details instead of shrinking each step to a few sentences. I'll keep the wording casual and explain the technical terms as I go.

The local Git history includes `385f3ef`, followed by `811bae9`, which recorded the push in this journal. The current branch is still `codex/composition-driven-v3`, and the V2 tag still points to `2a9a9b0`. I preserved the earlier GitHub push report; this journal revision did not repeat or independently check the remote push.

### Step 14 — Checking the expanded record

I checked the local file links, navigation anchors, and code fences, and compared the earlier dated entries with the committed journal. The original story is preserved. A stricter whitespace check caught mixed line endings around an older push entry, so I made the documentation's line endings consistent.

I checked the important descriptions against the source and reports, including schema and composer versions, the native clock, cache rules, model wrappers, and the Windows build helper. I also corrected the score description to say that confidence belongs to the stroke rather than each individual point.

This revision changes JOURNAL.md and AGENTS.md. I used documentation checks for it; I did not rerun the app tests, rebuild Android, or run the models. The previous 60-test result and native/model evidence remain historical results with their original limits.

## Technical memory — What we have built and learned

I expanded this reference on **2026-10-08, Manila time**. The checks described here come from the implementation work recorded above and its saved reports. This revision adds documentation; it does not turn an earlier result into a newly run check. If the code changes later, I'll update these sections and explain the change in a dated entry.

### 1. The direction and the V2 starting point

I want V3 to feel like someone painting a song. To get there, I first understand the whole song, then choose its visual gestures, then reveal the painting as the song plays. These are separate jobs:

| Job | What I mean | Why I keep it separate |
| --- | --- | --- |
| MusicAnalysis | I describe notes, beats, harmony, energy, and sections, including uncertainty. | I can change the art without asking the music models to run again. |
| VisualScore | I turn that music into timed strokes, drops, washes, colors, and scenes. | I can compare different painting rules using the same musical evidence. |
| Paint runtime | I draw the score at the audio player's current position. | I can pause or seek and rebuild the same picture directly. |

The path is `local file → normalized PCM → MusicAnalysis → VisualScore → native song time → Skia paint`. **PCM** means the decoded waveform stored as numbers. **DSP**, or digital signal processing, means measuring that waveform with algorithms. **MIR**, or music information retrieval, is the wider job of finding musical information such as notes and beats.

I kept V2 as our comparison. Its starting commit is `2a9a9b0`, tagged `v2-fluid-reactive`. Its original screen lives in [V2Screen.tsx](src/legacy-v2/V2Screen.tsx), and its old README lives in [V2_README.md](docs/V2_README.md). The original audio, DSP, music-event, color, and fluid-rendering modules remain available.

V2 measures live audio snapshots. It uses a **Hann window**, which softens a waveform window's edges before an **FFT**, the calculation that separates a waveform into frequency components. It measures RMS, spectral brightness, spectral flux, and relative spectrum regions. **RMS** is the waveform's average strength. **Spectral flux** measures how much the spectrum has increased since the previous observation; that helps spot an **onset**, the start of a sound.

I need to remember V2's sampling limit. On Android, Expo Audio uses the native Visualizer's 8-bit mono snapshots. They are not guaranteed to be consecutive pieces of a complete waveform. The native sampling rate is not forwarded to JavaScript, and the pinned Android timestamps need conversion from milliseconds. I therefore analyze each snapshot separately, use dimensionless brightness and spectrum thirds, and leave real Hz bands unknown. Joining unrelated snapshots or guessing 44.1 kHz would create misleading frequency results. Zero padding makes the FFT output denser; it does not recover missing audio or improve the original window's frequency resolution.

V2 also has a sample-rate estimator for genuinely continuous streams, but I disabled it for Android snapshots. It needs eight plausible observations and agreement around a median rate. The installed iOS tap uses zero timestamps, so that route is uncalibrated too. Native Visualizer normalization also means snapshot RMS is not the original recording's loudness.

V2's rhythm engine combines onset, positive energy changes, and spectral changes into **novelty**, meaning a measure of new activity. It keeps a bounded 12-second history, uses autocorrelation to look for repeated intervals, and searches 60–180 BPM. **BPM** means beats per minute. It waits for useful history and agreeing estimates, then lets a beat clock coast through missing onsets and gently correct its phase. This can still mistake half-time or double-time rhythms. Pause clears transients; seek or song replacement resets the history.

V2's fluid ink uses layered noise and **domain warping**, which bends the coordinates used to sample that noise. **fBm** means adding noise at several scales to create larger shapes with smaller details. Tempo affects flow, beats deform the field, onsets add local disturbances, and energy affects pigment density. The palette uses OKLCH and one color-change limiter. The old ColorEngine and gradient remain for comparison; they are not extra smoothing stages in the main V2 flow.

V2 has a shader-error fallback to the legacy gradient and then a static dark field if needed. Its live visual time is advanced by Reanimated while playback and sampling are active. V3 uses a different strategy: a fixed score reconstructed from actual audio time. I kept these distinctions because the V3 clock rules should not be assumed to describe V2.

I measured the V2 software baseline before the V3 changes: **50 tests**, lint, TypeScript, six desktop shader previews, and a desktop rhythm/visual pipeline mean of about **0.157 ms**, with **1.183 ms at the 95th percentile**. The 95th percentile means 95% of the measured runs were at or below that time. Those measurements exclude native capture and Android GPU rendering.

For the older details, I can return to [DSP.md](docs/DSP.md), [RHYTHM_ENGINE.md](docs/RHYTHM_ENGINE.md), [VISUAL_ENGINE.md](docs/VISUAL_ENGINE.md), and [KNOWN_LIMITATIONS.md](docs/KNOWN_LIMITATIONS.md).

### 2. The tools I used and what each one does

I keep the important versions here because native libraries, model runtimes, and build tools can change behavior. [package.json](package.json), [package-lock.json](package-lock.json), and [research/requirements.txt](research/requirements.txt) remain the exact dependency records.

| Tool or library | What I use it for | Version or state I want to remember |
| --- | --- | --- |
| Expo and Expo development client | I generate and run an app that includes our native audio library. | Expo `~57.0.27`; development client `57.0.19`. V3 needs this development build. |
| React and React Native | I build the screen, controls, lifecycle, and native app shell. | React `19.2.3`; React Native `0.86.3`. |
| TypeScript and tsx | I check data types and run TypeScript scripts and tests. | TypeScript `~6.0.3`; tsx `^4.23.15`. |
| ESLint | I check code rules and React usage. | `^9.39.5`, with Expo's ESLint configuration. |
| React Native Audio API | I read duration, decode audio, play files, and read the native source clock. | Pinned to `0.13.6`; its native clock and PCM copy behavior need special handling. |
| expo-audio | I keep V2's playback and live sampling available. | `~57.0.5`; retained for comparison. |
| React Native Skia | I draw paths, gradients, blur, ink drops, washes, and shaders. | `2.6.2`; current paths use `PathBuilder`. |
| Reanimated and Worklets | I update painting values without making React redraw the entire screen every frame. | Reanimated `4.5.1`; Worklets `0.10.1`. |
| fft.js | I calculate the FFT through our reusable JavaScriptFFT wrapper. | `^4.0.4`; shared DSP foundation. |
| @noble/hashes | I calculate incremental SHA-256 file hashes and cache filenames. | `2.4.0`. |
| Expo File System and Document Picker | I choose local files, read headers and chunks, import JSON, and save local cache files. | File System `57.0.7`; Document Picker `~57.0.3`. |
| Slider, Expo Router, Linking, and the normal Expo UI helpers | I handle seeking, app routing, development links, screen sizing, assets, and status-bar behavior. | Slider `5.2.0`; the full set is pinned or constrained in package.json. |
| Node and npm | I install JavaScript dependencies, run checks, bundle the app, and run research helpers. | The project asks for Node `22.20+`; `npm ci` uses the lockfile. |
| CanvasKit | I compile and render the actual Skia shaders and paths on desktop. | Already supplied through Skia's dependencies; a software-rendering check. |
| Python and venv | I isolate the desktop model packages from the app and other Python projects. | Tested Python `3.12.14`, in `.venv-research`. |
| NumPy, librosa, and resampy | I handle numeric audio arrays, loading/resampling, and model audio helpers. | NumPy `1.26.4`, librosa `0.11.0`, resampy `0.4.2`. |
| Basic Pitch and ONNX Runtime | I run official desktop note transcription on the CPU. | Basic Pitch `0.4.0`; ONNX Runtime `1.23.2`; actual inference ran. |
| Beat This, PyTorch, and torchaudio | I run official desktop beat/downbeat models on the CPU. | Beat This `1.1.0`; torch and torchaudio `2.9.1`; both checkpoints ran. |
| pretty-midi, mir-eval, and Matplotlib | I support note tooling, compare predictions with known events, and save timeline plots. | `0.2.11`, `0.8.2`, and `3.10.7` respectively. |
| setuptools | I provide the older `pkg_resources` helper that resampy still imports. | Pinned to `80.9.0` after a newer version broke that import. |
| All-In-One, madmom, and NATTEN | I want a desktop reference for musical sections. | All-In-One `1.1.0` installed, but did not run; native dependency setup is blocked. |
| Demucs | I encountered it as a desktop All-In-One dependency and a possible later separation tool. | Installed in that setup; no controlled separation experiment has run. |
| Git | I preserve V2, track V3 changes, and record the commits used for the handoff. | V2 tag, V3 branch, and recorded main push are in the history above. |
| PowerShell and rg | I read files, search code, run scripts, inspect processes, and manage this Windows workspace. | PowerShell is our shell; rg is the fast text/file search tool. |
| Android Studio JBR and Android SDK | I supply Java and the Android build/runtime tools. | I used Android Studio's Java 21 and the installed SDK. |
| Gradle, CMake, Ninja, and Git Bash utilities | I compile the native Android app and its C/C++ dependencies. | Project-local Ninja `1.13.2`; Git's `usr/bin` supplies required shell utilities. |
| SUBST | I give the same workspace a temporary short drive path during the native build. | The build helper chooses a free drive letter and removes the alias afterward. |
| ADB, Android emulator, WHPX, and SwiftShader | I install/debug the APK and test native paths without a connected phone. | Android 14 x86_64; WHPX CPU acceleration; software GPU; audio disabled. |
| UIAutomator, logcat, screenshots, and Pillow | I inspect native UI, diagnose errors, and compare paused paint pixels. | Used during the emulator checks; image differences were measured with Pillow. |

I also used the [React best-practices skill](C:/Users/joshu/.codex/plugins/cache/openai-curated-remote/vercel/0.54.1/skills/react-best-practices/SKILL.md) during the implementation review. It helped me check stable props, memoization, effect cleanup, accessibility, and shared-value updates. **Memoization** means keeping a computed object until its inputs change. I used Reanimated's `.set()` where callback mutation rules required it.

The Python used for research came from the bundled runtime at `C:/Users/joshu/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe`. I chose it for the isolated Python 3.12 setup. That host path is a record of this machine, not a portable requirement for every developer.

### 3. How I prepare a song without wasting memory

I first inspect metadata, then hash the source file, then look for cached analysis. On a cache miss, I decode and analyze it. A cache hit can skip the PCM analysis decode. Playback still has its own native file decoder, so “one decode” means one analysis decode on a cache miss.

I normalize the analysis input to **22,050 samples per second, one channel, Float32 PCM**. Resampling changes the sample rate; downmixing averages the channels into mono. Float32 means each sample takes four bytes. A known analysis rate lets me calculate real frequencies and feed the same kind of input into the desktop reference tools.

I read small container headers before allocating the full waveform. The header code handles WAV, FLAC, Ogg Opus/Vorbis, MP3, AAC, and MP4/M4A metadata. MP3 inspection skips ID3 tags; MP4 inspection walks bounded container entries. Some formats use conservative rate/channel bounds. Recognizing their headers does not prove that every native codec and resampling path has passed a phone test.

These are my current limits:

| Limit | Value | Why I keep it |
| --- | --- | --- |
| Song duration | At most 360 seconds, or six minutes | I bound full-track processing and the score size. |
| Encoded file size | At most 128 MiB | I reject very large imports early. |
| Source channels | At most eight | I bound multichannel allocations. |
| Source sample rate | 8,000–96,000 Hz | I reject invalid or excessive source rates. |
| Estimated decoding memory | At most 192 MiB | I check the likely allocation cost before decoding. |
| Reserve inside the estimate | 24 MiB | I leave space beyond the main PCM arrays. |

**MiB** means 1,048,576 bytes. My estimate includes source Float32 PCM, resampled channel PCM, mono PCM, and the reserve. It is a conservative policy, not a measurement of the complete app's peak memory. Long tracks, codecs, garbage collection, and real phones still need measurement.

I hash the original encoded bytes with **SHA-256**, a content fingerprint. Renaming the same file does not change the fingerprint; changing its bytes does. I read 65,536-byte chunks and yield about every MiB so cancellation and the UI get a chance to run. I downmix in sample chunks too.

I request 22,050 Hz explicitly from `decodeAudioData`. After it returns, I check that decoded channels stay within the inspected bound and duration agrees within 0.1 seconds. Unsafe or unknown metadata produces a recoverable error.

One native bug matters here. Audio API 0.13.6's **JSI** copier, the bridge between JavaScript and native code, uses a typed array's entire backing ArrayBuffer size. A short `subarray` still points to the larger buffer. Passing that view for the last PCM chunk caused the longer song import to fail. I fixed it by allocating an exactly sized final buffer and added a regression test that behaves like the native copier.

Cancellation is cooperative. I check before and after native decoding and during hashing and DSP. DSP yields every 64 FFT frames. The native decode call has no abort API, so Cancel must wait for that call to return before stopping the later work. I show actual stage progress rather than a timer pretending to know completion.

The main files are [audio-engine.ts](src/audio-v3/audio-engine.ts), [audio-decoder.ts](src/audio-v3/audio-decoder.ts), [audio-metadata.ts](src/audio-v3/audio-metadata.ts), and [audio-analysis-buffer.ts](src/audio-v3/audio-analysis-buffer.ts).

### 4. How I store and understand the music

#### The shared data contract

I use the same **schema**, meaning the agreed shape and rules for data, in TypeScript and Python. The current version is `analysis-v3.1`. The measured-feature version is `whole-track-dsp-1`, and the painting version is separately `paint-composer-2`.

| MusicAnalysis field | What I store and why |
| --- | --- |
| Track | I store the source SHA-256, duration in seconds, and 22,050 Hz analysis rate. |
| Rhythm | I store BPM or null, beat times, downbeat times, confidence, and an inferred flag where needed. A downbeat is the first beat of a bar. |
| Notes | I store start/end times, integer MIDI pitch, amplitude, confidence, and optional pitch bends. MIDI is a numeric way to name pitches. |
| Harmony | I store 12-value chroma frames and timed major/minor/unknown chord estimates. |
| Dynamics | I store time, RMS, normalized energy, bass ratio, brightness, and onset strength. |
| Structure | I store continuous sections from zero to the end, with labels and confidence. |
| Model versions | I name the transcription, beat, feature, harmony, and structure methods actually used. |
| Quality and warnings | I keep FULL, PARTIAL, or BASIC and explain missing or uncertain information. |

**Chroma** groups pitches into the 12 pitch classes, ignoring octave. C in different octaves contributes to the same group. This helps describe harmony without pretending every spectrum peak is a separately identified note.

I validate imported JSON and disk cache before composition. I reject incorrect versions/hashes/rates, non-finite numbers, confidence outside 0–1, unordered times, empty intervals, excessive arrays, and incomplete section coverage. Current caps include 50,000 notes, 5,000 beats or downbeats, and 100 sections. The contract is in [analysis-schema.ts](src/analysis/analysis-schema.ts) and [schema.py](research/analysis/schema.py).

FULL does not automatically mean “accurate music.” Our generated known-event fixture can be FULL because it is explicitly synthetic truth. A model result must still name its actual methods and be evaluated. The current app DSP path leaves `notes: []`; it never converts uncertain spectrum peaks into invented note events. It returns PARTIAL when it has beats and some known chord estimates, otherwise BASIC.

#### Measured features and rhythm

I use a 2,048-point Hann-windowed FFT with a 512-sample hop. **Hop** is how far I move the analysis window between frames. At 22,050 Hz, this is about 23.22 ms between frames and 10.77 Hz per FFT bin. I calculate RMS from the unwindowed samples.

I normalize energy using the song's 95th-percentile RMS and onsets using the 98th-percentile positive spectral flux. A percentile gives me a useful reference without letting one extreme peak set the whole scale. RMS below `1e-5` stays silent; I do not amplify an empty file into visible activity.

Bass is the fraction of spectral power below 200 Hz, excluding the zero-frequency bin. Brightness is a power-weighted frequency average divided by 5,000 and bounded to 0–1. DSP chroma uses local peaks between 65 and 2,100 Hz and is sampled every eight FFT frames. It is a harmonic hint with limited resolution.

For the mobile fallback beats, I take measured onset peaks, keep nearby peaks at least 0.15 seconds apart, and search 55–180 BPM with **autocorrelation**, which compares a signal with delayed copies of itself. I then use dynamic alignment to favor a chain of onset times that fits the likely beat interval. Missing beats can be inserted at reduced confidence. Weak or insufficient evidence returns no tempo.

I group some fallback beats into four-beat drawing anchors, with confidence reduced to 35% of their original value and `inferred: true`. I leave the time signature unknown. This keeps a useful drawing structure without claiming we proved a 4/4 meter.

The fallback version names are `dsp-alignment-1`, `chroma-templates-1`, and `novelty-1`. Their files are [feature-extractor.ts](src/analysis/feature-extractor.ts), [beat-tracker.ts](src/analysis/beat-tracker.ts), and [analysis-engine.ts](src/analysis/analysis-engine.ts).

#### Melody, chords, and sections

Actual transcription can contain several notes at once. I use **dynamic programming** to choose one coherent brush line: I compare possible note choices across time, keep good choices, and trace back the best chain. I favor confidence, strength, sustain, and smooth pitch movement. Large jumps cost more; a gap over two seconds lets the line start fresh.

I group starts within 0.04 seconds, discard notes below 0.15 confidence or 0.06 seconds, keep at most 16 candidates per group, and trim overlaps in the selected line. This is an artistic melody abstraction. It does not prove I found the singer or the listener's true main melody.

With notes, I build chroma every 0.2 seconds from active note amplitude × confidence. For chords, I compare 0.8-second chroma windows against 12 major and 12 minor triad templates. A triad is a three-note chord. **Cosine similarity** compares the shape of those pitch-class values while reducing the effect of overall magnitude. I require a strong match and a useful gap above the second-best match; otherwise the chord stays unknown. Adjacent identical estimates are merged.

For sections, I summarize two-second windows with 12 chroma values, energy, brightness, and note density. I build a **self-similarity matrix**, a table showing how alike the windows are, then use a checkerboard novelty calculation to spot changes. At six minutes, this table is bounded to 180 × 180 values. I separate boundaries by at least eight seconds and reuse labels for strongly similar regions.

Labels such as “Section A” mean similar musical regions. DSP does not know that a region is a verse or chorus. Its confidence is a heuristic, and our fixture evaluation shows missed boundaries.

I can return to [melody-extractor.ts](src/analysis/melody-extractor.ts), [chroma.ts](src/analysis/chroma.ts), [chord-estimator.ts](src/analysis/chord-estimator.ts), and [section-segmenter.ts](src/analysis/section-segmenter.ts) for the exact choices.

### 5. The Python reference models and what I tried

I built the desktop tools as a reference path, sometimes called an **oracle**. Here that means a stronger source of musical events to test the painting with. It does not mean the model is always right.

I use a separate Python environment, `.venv-research`, and CPU inference. The app does not contain these desktop models. I normalize the reference audio to the same 22,050 Hz mono format, hash the original source bytes, and save normalized PCM so TypeScript can check the exact same samples.

#### Basic Pitch

I first tried its usual TensorFlow dependency route. Basic Pitch's TensorFlow pin requires a version without a suitable Python 3.12 wheel, so installation failed. A **wheel** is a prebuilt Python package; without a compatible one, installation may need a difficult source build.

I chose the official ONNX model shipped with Basic Pitch 0.4.0 and installed Basic Pitch with `--no-deps` after installing our pinned requirements. **ONNX** is a model format supported by ONNX Runtime. I kept the official preprocessing, overlapping windows, inference, and note creation instead of replacing them with a home-made approximation.

The first model run also hit a missing `pkg_resources` import used by resampy. Newer setuptools had removed that helper, so I pinned setuptools to 80.9.0. Warnings about missing TensorFlow, CoreML, or TFLite backends are expected in this ONNX-only environment; the selected backend is what matters.

I save the real output tensors in `basic-pitch.npz`. A **tensor** is a numeric array used by a model, and NPZ is a compressed NumPy archive. The wrapper turns actual note events into our schema. It uses mean note activation as a strength/confidence proxy, which is not a calibrated probability. Pitch bends are retained when the model supplies them.

#### Beat This

I ran both official `small0` and `final0` checkpoints through the official Audio2Frames frontend and minimal postprocessor. A **checkpoint** is the saved learned weights. The **frontend** prepares audio for the model; **postprocessing** turns its output into events.

I use PyTorch CPU with four threads and keep both models cached within the research process. I save real beat/downbeat logits at 50 frames per second. **Logits** are raw model scores. Applying sigmoid maps a logit into 0–1; I sample that activation at each detected timestamp for confidence. I derive tempo from the median beat interval.

The downloaded checkpoint sizes were **8,451,101 bytes for small0** and **81,058,141 bytes for final0**. The larger model was not consistently better on our fixtures, so I want measured accuracy and resource costs to guide any mobile choice.

#### All-In-One and the remaining setup problem

I installed All-In-One 1.1.0, but importing it failed because madmom was unavailable. I found no compatible madmom binary wheel on this Windows/Python 3.12 setup, no Visual Studio C++ compiler, and no listed WSL distribution. **WSL** is a Linux environment available on Windows when installed. NATTEN, its native neighborhood-attention dependency, also needs a compatible build.

I did not run All-In-One inference. Installing its package and desktop Demucs dependency does not count as successful section analysis. The next option is a compatible prepared desktop environment, or an upstream All-In-One JSON whose source file can be verified.

The import adapter checks that the upstream result's source path points to audio with identical bytes. It converts sections into our contract, fills uncovered gaps with unknown regions, and uses an explicit 0.5 confidence placeholder for upstream labeled sections. That placeholder is not a measured probability.

#### CLI choices, failures, and outputs

I can pass several files to [analyze.py](research/analysis/analyze.py). `--beat-model small0|final0` chooses the rhythm source, and `--compare-beats` also runs the other checkpoint. `--structure auto` allows an explicitly labeled DSP fallback; `--structure allinone` requires that reference. `--allinone-json` accepts one exact-source upstream file.

**`--strict` requires the reference models and fails when a required one cannot run.** I exercised that failure with All-In-One's missing madmom import. A fallback result does not pass the full reference milestone. The five successful current analyses are PARTIAL.

Another early failure was a Python chord-confidence result barely above one from floating-point rounding. I clamped the merged confidence to the intended 0–1 range instead of relaxing schema validation. I also fixed a Python/TypeScript feature mismatch caused by including the zero-frequency FFT bin in one flux calculation.

For each input, I save a folder named with the song stem and hash prefix under `research/results/generated/`:

| Output | What I can recover from it |
| --- | --- |
| `song.analysis.json` | I get the validated musical events, actual method versions, quality, and warnings. |
| `normalized.wav` and `normalized.f32` | I get the exact shared FLOAT WAV and raw Float32 mono samples. |
| `basic-pitch.npz` | I get the actual transcription tensors. |
| `beat-this-small0.npz` and `beat-this-final0.npz` | I get the actual beat/downbeat logits and their frame rate. |
| `rhythm-small0.json` or `rhythm-final0.json` | I get the alternative checkpoint's event list for comparison. |
| `report.json` and `batch-report.json` | I get model load/inference times, checkpoint bytes, process peak memory, and failures. |
| `evaluation.json` and timeline plots | I get known-event comparisons and pictures of notes, beats, energy, and sections. |

Basic Pitch reads the normalized FLOAT WAV; Beat This reads the same mono sample values and then applies its own frontend. Python/native offsets for lossy codecs remain unchecked. **Load time** includes imports and any needed download; **inference time** covers the frontend, model, and postprocessing call. The corrected comparison used weights already downloaded.

The measured Windows peak working set is cumulative across the process and batch. It includes libraries and loaded models, so I must not describe it as isolated per-song memory or a phone requirement.

The wrappers are [basic_pitch_reference.py](research/analysis/basic_pitch_reference.py), [beat_this_reference.py](research/analysis/beat_this_reference.py), and [allinone_reference.py](research/analysis/allinone_reference.py). [research/README.md](research/README.md) keeps the setup and upstream links.

### 6. How I turn music into a painting

#### A fixed visual score

I compose the visual choices before playback. The score contains normalized positions, times, colors, and mark settings. **Normalized positions** use 0–1 coordinates, so the same composition can fit different screen sizes.

I use a seeded random generator based on the song hash, section, and phrase/bar. A **seed** is the starting value that makes the same sequence repeat. Our helpers use a small hash and a repeatable generator; I do not call fresh random choices every frame. The same audio and analysis versions produce the same geometry.

The score stores scenes, stroke points, drops, washes, and accent events. A scene carries its palette, brush style, density, background flow derived from bass, and seed. Each stroke point carries time, position, width, opacity, and color; confidence is stored on the stroke. The composer is in [composer.ts](src/visual-score/composer.ts), and the data shapes are in [schema.ts](src/visual-score/schema.ts).

These are my present artistic rules:

| Musical evidence | What I make it do | Detail I want to remember |
| --- | --- | --- |
| Selected melody | I bend the main brush contour with pitch movement. | I use the 10th–90th percentile pitch range, with a minimum seven-semitone span, so outliers do not dominate. |
| Downbeats or phrase anchors | I start gestures around larger musical units. | With no suitable downbeats, I use four-second drawing anchors; these are a fallback art rule. |
| Ordinary beats | I vary brush pressure. | I include beat times among the stroke points rather than making every beat clear the canvas. |
| Energy | I change width and opacity. | Stronger passages can carry more pigment. |
| Note confidence | I weight the visual commitment. | A weaker note estimate has less visual strength. |
| Rests | I split the gesture and leave room. | Gaps over 0.45 seconds split note runs. |
| Pitch classes and chords | I choose ink, support, and wash colors. | This is a replaceable artistic convention. |
| Isolated strong onsets | I add local drops. | I avoid duplicating an onset already used by a melody note. |
| Bass and energy | I add slow broad washes. | Washes support the line without creating a separate fast beat clock. |
| Sections | I change scenes and dissolve the old marks. | I retain some of the previous section instead of cutting to an empty field. |
| No transcription | I use measured energy and brightness for a modest contour. | I keep note data empty and its confidence lower. |
| Silence | I leave the field quiet. | A fallback stroke needs audible measured input. |

I choose pitch color by the **circle of fifths**, which groups musically related pitch classes, and map nearby groups to nearby hues. I use **OKLCH**, a color space with lightness, chroma, and hue, to keep the palette controlled. **Chroma** here means color intensity; it is different from musical chroma. Current note colors use chroma 0.11, and the background is `#14131b`. I do not treat pitch-to-color as a universal physical law.

I keep strokes to at most 64 timed points. Seeded origins and left/right sweeps give them room to travel; pitch makes a smaller vertical contour, with a gentle bend. Width currently starts at 0.004 of the smaller screen dimension and adds up to 0.031 with pressure. These are tuning choices, not musical facts.

I create drops from strong non-melody onsets above 0.55, keep them at least 0.18 seconds apart, and suppress ones close to a note start. Washes are created in four-second windows from bass × energy and chord color. Their positions are seeded too.

When I inspected the first desktop previews, the gestures felt too narrow and glowy. I widened their sweeps, reduced the vertical pitch excursion from 0.36 to 0.22, reduced diffusion opacity from 0.12 to 0.055, and added static pigment texture. I changed the composer version from `paint-composer-1` to **`paint-composer-2`** so cached analysis would produce the updated art. This was my inspection and tuning; the user's paired listening review is still open.

The exact mappings are in [stroke-generator.ts](src/visual-score/stroke-generator.ts), [palette.ts](src/visual-score/palette.ts), [drops.ts](src/visual-score/drops.ts), [washes.ts](src/visual-score/washes.ts), and [seed.ts](src/visual-score/seed.ts).

#### Persistent paint and reconstruction

I turn the points into **cubic Bézier curves**, smooth curves controlled by two handles. The conversion uses neighboring points, like a Catmull–Rom curve, and bounds the handles so a sudden pitch jump does not throw the path off screen.

I build Skia paths with the current `PathBuilder` API, then reveal only the part appropriate for the song time. I memoize paths and segments so they are not rebuilt on each frame.

Paint persists after it is laid down. Marks age with `exp(-age / 70)`, so they fade slowly instead of disappearing at every beat. The previous scene dissolves over six seconds. Blur grows from 1.5 toward a maximum of 6; drops diffuse over about three seconds and fade over about 14 seconds. Washes grow slowly and fade after they end.

The pigment shader is a small **SKSL RuntimeEffect**. SKSL is Skia's shader language, and RuntimeEffect compiles that small drawing program for use by Skia. It adds static grain/fiber variation within the path. Its seed and dryness are fixed for the scene: dry is 0.72 and wet is 0.32. It does not use an independent animation timer. I also reduced the thin central strand to keep the mark from looking like a glowing wire.

Reduced-motion mode still reveals the musical path but keeps diffusion and radius changes steady. The V3 shader can fall back to the colored path if it cannot compile. Dense section performance still needs phone measurements.

The key idea is **absolute-time reconstruction**. For any event, progress comes from its start, end, and the current song time. A mark's age also comes from that same time. I do not need to replay a hidden simulation or keep an ever-growing pixel history to seek.

[ScorePlayer](src/paint/score-player.ts) looks up the section by time using binary search, which repeatedly halves the search range. I mount only the current and previous section's fixed event arrays. Shared values control their reveal. This bounds section history, but a single dense or long section can still mount many path nodes; I have not measured the worst case on a phone.

The core drawing files are [scene-runtime.ts](src/paint/scene-runtime.ts), [PaintCanvas.tsx](src/paint/PaintCanvas.tsx), [StrokeLayer.tsx](src/paint/StrokeLayer.tsx), [DiffusionLayer.tsx](src/paint/DiffusionLayer.tsx), [DropLayer.tsx](src/paint/DropLayer.tsx), [WashLayer.tsx](src/paint/WashLayer.tsx), and [pigment.sksl.ts](src/paint/shaders/pigment.sksl.ts).

### 7. How I keep playback, the picture, and reuse in step

#### One time authority

I let the native file source's `currentTime` decide what to paint. A JavaScript timer or animation frame can ask for the position; it does not invent the next song position by adding elapsed time.

Audio API's runtime Audio handle exposes `getFileSourceNode()`, but the public TypeScript handle omits it. I kept this narrow, version-pinned adapter in [native-clock.ts](src/audio-v3/native-clock.ts). It checks that the accessor exists and reads the actual source node. A library upgrade needs a fresh native clock check. If that clock is unavailable, playback reports the problem instead of silently switching to guessed timing.

[AudioTransport](src/audio-v3/audio-transport.ts) holds play/pause/buffering/seek intent. Pause captures the position and holds it. Buffering holds it too. End moves it to the known duration. Detach clears the source even if reading or pausing has a problem.

I found that native seeks happen asynchronously. After a seek request, the old source time can still appear briefly. I immediately reconstruct the target painting and hold it until the source acknowledges the request, using a 0.07-second proximity test or directional progress past the relevant old position. That gate prevents stale time from briefly drawing the wrong section.

The acknowledgement threshold is not proof of audible 70 ms synchronization. I still need a real click track, native timestamps, and listening evidence on a physical device.

#### Keeping the screen quiet and responsive

I sample the native transport with `requestAnimationFrame` and set a Reanimated shared value. A **shared value** lets the drawing work read changing data without rebuilding the whole React tree. The visible time label updates about every 250 ms; section state changes only when the section changes.

I use a new generation key when importing so the native player remounts even if the URI is the same. I ignore callbacks from an older transport and cancel/clean up work on replacement or unmount. **Stale callbacks** are late results from work that is no longer the active song. Backgrounding pauses through AppState.

The small player hides after 2.8 seconds of playback and appears when tapped. It stays visible for pause, seeking, imports, errors, and screen-reader use. TalkBack and reduced motion have explicit handling.

Development mode has a top-right triple-tap menu, with the taps close together. It lets me switch to V2 or load research JSON. The loader accepts at most 16 MiB, validates the schema, and requires the exact source hash and duration within 0.1 seconds. Ordinary production controls do not show model-quality diagnostics.

Expo Go loads V2 without initializing V3's custom native module. The development build defaults to V3. I kept Expo prebuild/config plugins rather than making an unrelated bare-native migration.

The main screen is [V3MusicScreen.tsx](src/components/V3MusicScreen.tsx). I can check [NativeAudio.tsx](src/audio-v3/NativeAudio.tsx) and [use-player-auto-hide.ts](src/components/use-player-auto-hide.ts) for the audio/UI wiring.

#### Reusing music without redoing the expensive work

I key analysis by **audio content hash + analysis schema version + sorted model/method versions**. Sorting makes the same version set produce the same key regardless of object property order.

I version the composer separately. On cache read, I validate the music and compose the expected visual score. A stored score is reused only when its composer version and content agree; otherwise I rebuild the visuals from the cached music. That avoids another decode or model run for an art-only change.

The cache lives in the app's document directory, `music-analysis-v3`. I hash each cache key into a filename. Writes go to a temporary file and then move into place, reducing the chance of a half-written final record. Reads are bounded to 24 MiB.

A developer reference import stores a hash-to-model-version pointer. On reimport, I try that reference before the ordinary DSP cache, so the app remembers the richer analysis across a restart. Corrupt, invalid, or unavailable cache data falls back to analysis. A failed save explains that the work will need to run again.

I tested cache versions in software and restored the reference after an emulator restart. I still need physical-device persistence and long-track resource evidence. The files are [analysis-cache.ts](src/analysis/analysis-cache.ts), [file-cache.ts](src/analysis/file-cache.ts), and [versions.ts](src/analysis/versions.ts).

### 8. The Windows build and native debugging story

#### What failed before the APK built

I generated Android with Expo prebuild and compiled a development APK with Gradle. Audio API's FFmpeg support is enabled for local codecs. I chose Android Studio's Java 21 for this setup.

| Attempt | What happened | What I changed or learned |
| --- | --- | --- |
| First native audio build | I hit missing shell utilities such as mkdir/rm in the dependency's Bash steps. | I added Git's `C:/Program Files/Git/usr/bin` to the build process PATH. |
| Initial CMake/Ninja compilation | I hit Windows' roughly 260-character path limit in generated native object paths. | I needed shorter generated paths, not an app logic change. |
| CMake object-name shortening | I first tried `CMAKE_OBJECT_PATH_MAX=180`. | The parent staging path was still too long; that alone failed. |
| Newer Ninja alone | I downloaded official Ninja 1.13.2 into `.build-tools`. | It still rejected the remaining generated paths. |
| Short workspace alias plus short CMake staging | I used SUBST and a staging directory such as `R:/.build-tools/cxx`. | This combination built successfully; the workspace and SDK stayed in place. |

I saved the solution in [build-android.ps1](scripts/build-android.ps1), [setup-windows-build.ps1](scripts/setup-windows-build.ps1), and [withWindowsCmake.js](plugins/withWindowsCmake.js).

The helper chooses a free letter from R through Z, points it at this workspace, sets `CRYSTALLINEYE_CMAKE_STAGING`, runs prebuild and Gradle, and removes the alias in a finally block. The Expo config plugin reapplies the Windows CMake/Ninja settings after prebuild. The final object-path setting is 250. Ninja stays project-local rather than replacing the SDK copy.

The helper also supplies JAVA_HOME/ANDROID_HOME when absent, uses development NODE_ENV, and adds Git's utilities. The Java path used here is `C:/Program Files/Android/Android Studio/jbr`; the SDK is `C:/Users/joshu/AppData/Local/Android/Sdk`.

The successful `assembleDebug` built **arm64-v8a and x86_64 in 6 minutes 24 seconds**. The debug APK is about 223 MB because this is a development build with both architectures. That size is not a release-size measurement.

I also exported the Android JavaScript bundle and checked Expo dependency compatibility. Metro once fell back from an unreadable transform cache to a fresh crawl and then succeeded; I did not treat that as a source-code failure.

#### Getting the emulator and Metro to talk

ADB showed no connected physical phone. I used the existing Android 14 Google APIs x86_64 system image instead of downloading a new one. The SDK had no usable avdmanager setup or existing AVD configuration, so I created an isolated `CrystallineyeV3` virtual-device configuration under `.build-tools/avd`.

The test used port 5556, 2,048 MiB RAM, four cores, a 360 × 800 display at 160 dpi, WHPX acceleration, and SwiftShader software graphics. I ran it headless, with no audio, boot animation, or snapshots. The isolated ANDROID_AVD_HOME kept this separate from the user's normal emulator setup.

Metro needed its own fixes:

- I first tried mutually exclusive offline/localhost flags. I moved offline mode to `EXPO_OFFLINE=1` and kept the localhost option.
- Port 8081 was already used by another process, so I used 8082 for this task.
- Metro initially listened on IPv6 `::1`. ADB's local IPv4 connection could not reach it reliably.
- I inspected the listener and HTTP response, then restarted the task's Metro with `NODE_OPTIONS=--dns-result-order=ipv4first`. It listened on `127.0.0.1`, and the reverse connection worked.

I installed the APK with ADB, reversed port 8082, and opened the Expo development-client link. I pushed the calibration WAV, the 32-second pop WAV, and its matching analysis JSON into the emulator's Downloads folder. I used the real document picker, not an internal shortcut around import validation.

I inspected UIAutomator labels/bounds and screenshots before sending taps. The picker initially had no useful Recent entries, so I opened Downloads through its roots menu. UIAutomator could fail to become idle while playback kept changing the screen; stale XML was not current evidence. I used fresh captures and logcat for those moments.

#### The native results and fixes

The real 440 Hz calibration import decoded to **22,050 Hz, mono, two seconds, and 44,100 samples**. Its first FFT peak was **441.43 Hz**, within one 2,048-point FFT bin of the intended tone.

The 32-second import exposed the backing-buffer copier problem described earlier. After fixing the final buffer and restarting with the updated bundle, the longer import worked. I also replaced deprecated Skia path mutation calls with PathBuilder.

The matching research analysis supplied **180 notes, 64 beats, two scenes, and 17 strokes** for the pop fixture. I saw native paint during playback, sought backward to 12 seconds while paused, compared unchanged paint pixels across captures, and resumed to the 32-second end.

I restarted and reimported the same file; the developer panel showed the saved reference and “cached.” I also opened the retained V2 screen and saw its fluid field without a runtime error. That V2 launch was not a full native audio regression test.

I saved captures under `research/results/generated/paint/` and the V2 emulator capture under `fixtures/generated/shader/v2-android14-emulator.png`. I stopped emulator-5556 and the Metro process used on 8082 after checking their identity.

The emulator had no audible output and used software graphics. I treat these results as native execution, decode, transport, rendering, and persistence smoke tests. Listening alignment, real GPU speed, phone memory, battery, and heat remain open.

### 9. What I checked and what the results mean

#### Software and desktop checks

I kept the original V2 checks and added V3 behavior checks. The count grew from **50 to 59**, then to **60** after the native PCM-copy regression fix. Lint and TypeScript passed with the final implementation.

The tests cover calibrated sine-wave DSP, downmixing, unsafe file budgets, invalid schemas, silence, empty note fallback, deterministic composition, bounded curves, persistent marks, section lookup, seek reconstruction, stalled clocks, pause, asynchronous seek acknowledgement, failure handling, and cache/composer versions. Older tests also cover V2 sampling, color mapping, rhythm, and visual uniforms.

I use **regression tests** to keep a fixed bug from returning. The final-buffer test is an example: its fake native copier reads the backing buffer length, matching the actual contract that had broken the song import. A test whose fake simply accepts any view would miss that bug.

Android export passed, and `expo install --check` reported compatible dependencies. I did not record a completed V3 `expo-doctor` run, so I should not add it to the passed checks. Compilation and bundling do not settle native listening or artistic quality.

I compiled V2's actual fluid shader with CanvasKit and rendered six baseline images. For V3, I compiled the actual pigment shader and rendered seven times for both synthetic truth and actual model analysis: **0, 4, 12, 16.5, 20, 27, and 31.95 seconds**, giving 14 previews.

I jumped away and returned to each tested song time; the repeated desktop PNG bytes matched. That is strong evidence that this renderer reconstructs the same image from the score/time. It is not a phone GPU benchmark or a listener preference result.

CanvasKit's trim operation rejected a fully complete path in the initial desktop helper. I used a full path copy when progress is one and trimming for partial progress. I kept the desktop helper aligned with the shared curve and pigment logic rather than hiding the rendering failure.

All five Python JSON outputs passed the TypeScript parser. Recomputing DSP from the exact exported PCM produced a maximum feature difference of **1.33e-7**, about 0.000000133. This is **parity**, meaning agreement between the implementations. It covers measured features, not unimplemented mobile ML tensor parity.

#### What our synthetic songs can tell us

I generated ten original arrangements named pop, rock, EDM, acoustic, classical, jazz, hip-hop, ballad, dense, and sparse. They contain known harmonic tones, chords, percussion, and event times. They help expose pipeline mistakes because I know what I put in them. Their style names do not make them representative recordings of those genres.

I also generated a two-second 440 Hz calibration WAV. The arrangement WAVs use PCM16, and their known-feature data is computed from those actual quantized samples. The known-event JSON explicitly identifies `synthetic-truth-1`; it is never labeled as inferred model output.

I ran real Basic Pitch and both Beat This checkpoints on five **32-second** arrangements:

| Arrangement | Note onset/pitch F1 | small0 beat F1 | final0 beat F1 | DSP section-boundary F1 |
| --- | ---: | ---: | ---: | ---: |
| Acoustic | 0.593 | 1.000 | 1.000 | 0.000 |
| Dense | 0.768 | 0.957 | 0.673 | 1.000 |
| Jazz | 0.728 | 1.000 | 1.000 | 0.000 |
| Pop | 0.722 | 0.992 | 0.992 | 1.000 |
| Rock | 0.770 | 0.730 | 0.672 | 0.000 |

**Precision** asks how many detected events were right. **Recall** asks how many true events were found. **F1** combines both on a 0–1 scale. Extra Basic Pitch notes lower precision even when it finds many intended notes. Beat/downbeat ambiguity appears in the dense and rock arrangements, and DSP misses some known section changes.

I match notes within **50 cents of pitch and 70 ms of onset**, ignoring their end times for this metric. A cent is one hundredth of a semitone. I match beats/downbeats within 70 ms and internal section boundaries within three seconds. These tolerances explain what the scores measure; they do not establish the final painting's quality.

In the corrected warm CPU batch, small0 took about **1.1–1.4 seconds** per 32-second clip, and final0 took about **1.9–2.3 seconds**. Native compilation was running on the same host, so these are development observations, not controlled speed benchmarks. The process peak working set reached about **633 MiB**, cumulatively across the desktop process.

My practical conclusions are that the music-to-score path works, the models make useful but imperfect events, and the smaller beat model deserves attention. I still need complete reference outputs on real representative songs, then listening comparisons.

The result record is [REFERENCE_RESULTS.md](research/results/REFERENCE_RESULTS.md). The evaluation code is [evaluate.py](research/analysis/evaluate.py), with fixtures in [v3-fixtures.ts](scripts/v3-fixtures.ts).

#### What the native checks add

The emulator proved that the custom native audio module, real picker, longer decode, reference loader, paint rendering, backward seek, paused picture, resume-to-end, and restart cache path execute together. It exposed a native behavior that the first mocks missed.

For the paused picture, I compared the paint area of captures with Pillow rather than relying only on “looks the same.” The crop excluded changing controls. The paint pixels matched. Native screenshots and logcat observations support this narrower claim.

I still cannot claim physical audio timing, audible output quality, sustained presented FPS, codec coverage, stereo/resampling coverage, six-minute stability, or two-device memory/battery acceptance. I keep those as explicit work items in [V3_ANDROID_VALIDATION.md](docs/V3_ANDROID_VALIDATION.md).

### 10. The commands and files I want to remember

#### Everyday app and check commands

I run these from the repository root. This list records useful commands; it does not mean I reran them while expanding the journal.

| Command | When I use it |
| --- | --- |
| `npm ci` | I install the JavaScript dependencies exactly from the lockfile. |
| `npm run lint` | I check code rules. |
| `npm run typecheck` | I check TypeScript without emitting files. |
| `npm test` | I run the behavior tests. |
| `npm run fixtures` | I regenerate the older V2 test WAVs. |
| `npm run benchmark` | I rerun the V2 desktop DSP/rhythm/visual processing measurements. |
| `npm run validate:shader` | I compile/render the V2 fluid shader on desktop. |
| `npm run fixtures:v3` | I regenerate the ten V3 arrangements, known analyses, and calibration WAV. |
| `npm run validate:reference` | I parse Python results, compare exact-PCM features, and check score determinism. |
| `npm run validate:paint` | I render the known-score desktop paint previews. |
| `npm run validate:paint -- research/results/generated/pop-8ad8874d7c15/song.analysis.json` | I render that actual model score after its research output exists. |
| `npx expo export --platform android --max-workers 2` | I check the Android JavaScript/Hermes export. |
| `npx expo install --check` | I check dependency compatibility with Expo. |
| `powershell -ExecutionPolicy Bypass -File scripts/build-android.ps1` | I make the Windows native debug build with the path fixes. |
| `npm run android` | I use the normal Expo Android development workflow after the native setup is ready. |
| `npm start` | I start Metro for the V3 development client. |
| `npm run start:v2` | I start the V2 Expo Go comparison workflow. |
| `git status --short` and `git diff --check` | I inspect changed files and whitespace issues before a handoff. |

The debug APK path is `android/app/build/outputs/apk/debug/app-debug.apk`. It is generated and ignored by Git. A debug client needs Metro. Local audio preparation and cache use do not send music to a cloud service.

For the particular localhost problem seen here, my working Metro setup was:

```powershell
$env:EXPO_OFFLINE = '1'
$env:NODE_OPTIONS = '--dns-result-order=ipv4first'
npx expo start --dev-client --localhost --port 8082
```

I use these settings when that connection problem appears; 8082 is the port chosen for this run, not a universal project requirement.

#### Research commands

I explicitly choose the tested Python when creating the environment. If another machine uses `python`, I first check its version.

```powershell
& 'C:/Users/joshu/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe' -m venv .venv-research
.\.venv-research\Scripts\python.exe -m pip install -r research/requirements.txt
.\.venv-research\Scripts\python.exe -m pip install basic-pitch==0.4.0 --no-deps
npm run fixtures:v3
.\.venv-research\Scripts\python.exe research/analysis/analyze.py research/fixtures/generated/pop.wav --compare-beats
.\.venv-research\Scripts\python.exe research/analysis/evaluate.py
npm run validate:reference
```

To request complete references after the All-In-One environment is ready, I use:

```powershell
.\.venv-research\Scripts\python.exe research/analysis/analyze.py path/to/song.wav --strict --structure allinone
.\.venv-research\Scripts\python.exe research/analysis/analyze.py path/to/song.wav --allinone-json path/to/upstream-result.json --strict
```

`path/to/...` is a placeholder I replace with real files. The second route also needs the source path recorded inside the upstream JSON to identify the exact input bytes.

#### Native inspection commands

I use the SDK's ADB, with emulator-5556 as the target from this test. A future physical phone will have a different serial.

```powershell
adb devices
adb -s emulator-5556 install -r android/app/build/outputs/apk/debug/app-debug.apk
adb -s emulator-5556 reverse tcp:8082 tcp:8082
adb -s emulator-5556 shell am start -a android.intent.action.VIEW -d 'music-in-color://expo-development-client/?url=http%3A%2F%2F127.0.0.1%3A8082'
adb -s emulator-5556 push research/fixtures/generated/pop.wav /sdcard/Download/pop.wav
adb -s emulator-5556 push research/results/generated/pop-8ad8874d7c15/song.analysis.json /sdcard/Download/pop.analysis.json
adb -s emulator-5556 logcat -d
```

The ADB executable is under the installed SDK's `platform-tools`; I add that directory to the process PATH or call its full path if the command is unavailable. I still select the WAV and JSON through the app's picker after pushing them.

For emulator recreation, the original flags included `-port 5556 -no-window -no-audio -no-boot-anim -no-snapshot -gpu swiftshader_indirect -memory 2048 -cores 4`. They need the isolated AVD configuration mentioned earlier. I check process identity before stopping test helpers, especially because another Metro server may already be running.

The app scheme is `music-in-color`, and the Android package is `com.musicincolor.mvp`. [app.json](app.json) holds the native plugin setup. Its retained RECORD_AUDIO permission supports V2's Visualizer sampling; it is not a microphone-analysis workaround for V3. Background playback is disabled.

#### Where I resume each kind of work

| Place | What I find there |
| --- | --- |
| [README.md](README.md) | I get current setup and the user workflow. |
| [V3_IMPLEMENTATION_PLAN.txt](docs/V3_IMPLEMENTATION_PLAN.txt) | I get the user's complete intended design and gates. |
| [V3_STATUS.md](docs/V3_STATUS.md) | I get the implemented evidence and milestone limits. |
| [V3_ARCHITECTURE.md](docs/V3_ARCHITECTURE.md) | I get the main data flow and engineering choices. |
| [V3_ANDROID_VALIDATION.md](docs/V3_ANDROID_VALIDATION.md) | I get the physical test checklist. |
| [research/README.md](research/README.md) | I get model setup, flags, outputs, and upstream project links. |
| [REFERENCE_RESULTS.md](research/results/REFERENCE_RESULTS.md) | I get the measured synthetic model results and their limits. |
| [source-separation/README.md](research/source-separation/README.md) | I get the later full-mix-versus-stems experiment rules. |
| [tests/v3.test.ts](tests/v3.test.ts) | I get the V3 behavior checks and regressions. |
| [validate-reference.ts](scripts/validate-reference.ts) and [validate-paint.ts](scripts/validate-paint.ts) | I get the desktop parity and image reconstruction checks. |
| [AGENTS.md](AGENTS.md) | I get the rule to keep this journal complete during future work. |

I keep generated audio, results, model weights, the Python environment, Android/iOS output, and local build tools outside Git through [.gitignore](.gitignore). That includes `research/fixtures/generated/`, `research/results/generated/`, `research/models/`, `.venv-research/`, `.build-tools/`, and `fixtures/generated/`. Their absence in a fresh checkout does not mean their tests never ran; I regenerate them with the commands above. I keep personal music local and use original or legally usable material for repeatable comparisons.

### 11. What is still open and what I have only planned

#### The milestone map

I keep partial evidence separate from an accepted exit criterion. This is where the implementation stood after the native smoke run:

| Milestone | What I have | What I still need |
| --- | --- | --- |
| 0 — Preserve V2 | I have the tag, software baseline, and desktop previews. | Physical baseline captures and a device benchmark. |
| 1 — Development build | I have a successful APK and emulator launch. | Physical Android launch and Skia render. |
| 2 — New audio engine | I have known-rate PCM, resource guards, WAV calibration, and emulator transport. | Physical timing, stereo/resampling, and codec coverage. |
| 3 — Python references | I ran Basic Pitch and both Beat This checkpoints on five synthetic songs. | Actual All-In-One plus five representative complete analyses. |
| 4 — VisualScore prototype | I have deterministic composition and exact-source JSON import. | Paired listening review showing stronger musical connection than V2. |
| 5 — Persistent paint | I have paths, pigment, drops, washes, diffusion, and desktop/native execution. | Artistic acceptance and real phone performance. |
| 6 — Synchronization | I have deterministic seek tests and emulator pause/seek/resume evidence. | Measured native alignment, buffering, rapid seeks, and listening on a phone. |
| 7 — Mobile Basic Pitch | I have only the intended runtime/port strategy. | Accepted earlier gates, then mobile model and Python parity. |
| 8 — Mobile Beat This | I have only the export/runtime experiment plan. | Android feasibility report and a model-versus-DSP decision. |
| 9 — Mobile sections | I have bounded DSP similarity/novelty segmentation. | Comparison with actual All-In-One on representative songs. |
| 10 — Fully on-device ML | I have the local DSP prototype and desktop import path. | Actual mobile note transcription and accepted rhythm/structure methods. |
| 11 — Cache | I have versioned unit checks and emulator restart/reimport evidence. | Physical persistence, corruption recovery, and long-track resource checks. |
| 12 — Source separation | I have documented experiment criteria. | Earlier gates accepted, then a controlled full-mix/stem evaluation. |

My next concrete gate is to prepare All-In-One in a compatible desktop environment, analyze at least five representative legally usable songs completely, and load each exact WAV/JSON pair into V3. I then compare V2 and V3 while listening and follow the native checklist on a midrange and a higher-end Android phone.

I record track hashes, model versions, device/OS, heat state, timings, and actual observations. I check whether beats, phrases, rests, and sections are visible and whether gestures feel intentional. A **paired A/B comparison** means comparing both versions on the same source and musical positions so unrelated changes do not decide the result.

I target about 50–70 ms for supported beat/downbeat events, a rendered frame for note/stroke onset where practical, and no growing drift. I measure presented frame time/FPS, memory, garbage collection, heat, battery, and cancellation. A JavaScript callback rate is not the same as frames actually shown by the GPU.

#### Mobile tools I have considered but not integrated

| Candidate | Why it is in the plan | Its actual state |
| --- | --- | --- |
| Basic Pitch TFLite + react-native-fast-tflite | I can start from an official mobile model serialization. | Planned; not installed into the mobile app or tested there. |
| CPU inference first | I can establish correct input/output and deterministic reference agreement. | Planned mobile validation strategy. |
| Android GPU delegate | I may reduce latency by assigning supported model work to the GPU. | Deferred until CPU correctness and benchmarks exist. |
| torch.export → ExecuTorch → .pte + react-native-executorch | I can investigate exporting Beat This small0 into a mobile runtime. | Planned feasibility spike; no successful export or Android inference claim. |
| XNNPACK | I can try an optimized CPU backend for exported Beat This. | Planned benchmark candidate. |
| Vulkan | I can try supported GPU execution for the exported model. | Planned candidate; compatibility unproven. |
| Stronger calibrated DSP beat fallback | I can retain whole-track measured rhythm if the mobile model fails its resource/export gate. | The current autocorrelation/alignment fallback exists; richer alternatives remain optional work. |
| Quantization | I may make models smaller by using lower-precision numbers. | Deferred until reference accuracy checks show that quality survives. |

For mobile Basic Pitch, I need to port the official resampling, window sizes, overlap, input preparation, thresholds, output interpretation, and note creation exactly. I compare raw tensors, onset times, pitches, and durations against Python on identical PCM before trusting the result visually.

For Beat This, I test export, supported operators, loading, spectrogram preparation, logits, postprocessing, runtime, and peak memory. **Operators** are the mathematical steps the runtime must support. A **spectrogram** is a time-by-frequency picture of the audio; a **mel spectrogram** groups frequencies on a scale closer to hearing. A **tempogram** summarizes how rhythmic repetition changes over time.

If small0 cannot export or is too costly, I improve deterministic rhythm using known-rate full-track PCM rather than letting one model block V3. I only consider the larger final0 mobile model when a visible accuracy problem justifies its cost.

The intended optimization order is to remove repeated preparation, batch model windows, move suitable work to background/threaded execution, then test delegates and possibly quantization. I first measure where the time goes. The plan hopes for a normal four-minute song analyzed in tens of seconds, but I have not measured or promised that mobile result.

#### Separation is a later experiment

I have not run the product source-separation experiment. **Source separation** splits a mixture into approximate stems such as vocals, drums, bass, and accompaniment.

The candidates are **Demucs, BS-RoFormer, and MelBand-RoFormer**. I would compare full-mix Basic Pitch with relevant separated stems while holding composer settings and playback positions fixed. Vocals could drive the main contour, accompaniment could support harmony, drums could drive drops, and bass could drive washes.

I would measure precision/recall, melody continuity, harmonic stability, visual preference, processing time, peak memory, and model size. I admit the extra work only if a visible full-mix failure improves consistently and the cost is acceptable. Better transcription numbers alone do not prove a better painting.

All-In-One's internal desktop Demucs preprocessing is a separate reference-model dependency. It does not count as this controlled experiment, and it does not put separation into the mobile core.

### 12. How I'll record the next steps

I want future entries to be easy to read but complete enough to repeat. I can use this shape and skip a field only when it truly does not apply:

> **What I'm trying to do:** I name the concrete behavior or question.
>
> **What I found:** I describe the relevant code, data, previous result, or uncertainty.
>
> **The idea in simple words:** I explain the concept or algorithm and the important settings.
>
> **What I picked and why:** I record the practical reason, tradeoff, and alternatives.
>
> **Tools and files:** I name tools, versions, useful commands, changed files, and saved outputs.
>
> **What I tried:** I keep unsuccessful attempts, the meaningful error, and what changed next.
>
> **What I checked:** I state the exact check, input, environment, and result, including useful measurements.
>
> **What that proves:** I separate implemented behavior from desktop, emulator, and physical evidence.
>
> **What is still open:** I name limits, blockers, unanswered questions, and the next concrete step.

I keep this as a practical decision record. I explain choices and evidence, link to exact code or reports, and preserve uncertainty. I do not need a transcript of every terminal line to remember the work well.

## 2026-10-08 — Pushing the journal update

### Step 15 — Keeping personal audio out of the repository

I found the expanded journal and updated project instructions, plus a local MP3 in `music/`. The technical memory says personal music stays local and comparisons should use original or legally usable audio. I followed that project rule by adding `music/` to `.gitignore`; I will push the documentation and ignore-rule changes without tracking the MP3. The attempted remote lookup could not start a DNS helper thread, so I still need the push result to confirm GitHub accepts this update.
