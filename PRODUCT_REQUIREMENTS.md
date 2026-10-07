# Music in Color

## Product Requirements Document

**Document Version:** 1.0  
**Product Phase:** Phase 1 — Music-to-Color  
**Primary Platform:** Android  
**Framework:** React Native + Expo  
**Development Environment:** Expo Go  
**Product Type:** Offline-first accessibility / music visualization application  
**Primary Audience:** Deaf and hard-of-hearing users, with broader applicability to anyone interested in visual music experiences  
**Working Product Name:** Music in Color  
**Status:** Initial product specification

---

# 1. Executive Summary

Music in Color is an Android-first mobile application that translates music into a continuously evolving visual color experience.

The application analyzes musical audio and extracts measurable acoustic characteristics such as:

- energy
- spectral brightness
- low-frequency energy
- mid-frequency energy
- high-frequency energy
- transient/onset strength
- rhythmic activity

These features are transformed through a deterministic **Color Mapping Engine** into visual properties such as:

- lightness
- chroma/saturation
- hue
- gradient composition
- transition speed
- temporary accents

The initial version deliberately focuses on only one sensory modality:

> **Music → Color**

Haptics, lyrics, semantic descriptions, sign language, instrument identification, source separation, and other multimodal features are explicitly deferred to later phases.

The purpose of Phase 1 is not merely to create an attractive music visualizer. The product must investigate whether musical characteristics can be represented through a consistent visual language that users can begin to understand intuitively.

The central hypothesis is:

> If measurable musical characteristics are mapped consistently onto perceptually meaningful dimensions of color, users can perceive changes in musical energy, brightness, texture, rhythm, and overall character through visual changes alone.

Research on music-color association suggests that associations between music and color frequently operate through shared affective dimensions rather than universal note-to-color correspondences. For example, faster major-mode music has been associated with lighter, more saturated, yellower colors, while slower minor-mode music has been associated with darker, less saturated, bluer colors. These findings motivate the project but are treated as hypotheses to validate rather than universal rules.

---

# 2. Product Vision

## 2.1 Vision Statement

Create a new visual language for music that allows musical change, intensity, and character to be experienced through color.

The long-term product should become a multimodal music accessibility platform capable of translating music into:

```text
Music
  │
  ├── Color
  ├── Haptics
  └── Language
```

Phase 1 develops only the first branch:

```text
Music
  │
  ▼
Audio Analysis
  │
  ▼
Musical Features
  │
  ▼
Color Interpretation
  │
  ▼
Visual Experience
```

The architectural decisions made in Phase 1 must not prevent haptic and language interpreters from being added later.

---

# 3. Product Philosophy

Music in Color shall follow six core principles.

## 3.1 Translation, Not Decoration

The visualization must respond to measurable musical information.

Colors should not change merely because an animation looks attractive.

Every significant visual change should be attributable to one or more musical features.

For example:

```text
Higher spectral brightness
        ↓
Higher visual lightness

Greater musical energy
        ↓
Greater chroma

Strong transient
        ↓
Temporary visual accent
```

---

## 3.2 Consistency

The same musical characteristic should generally produce the same class of visual response.

If increased high-frequency energy causes an increase in lightness in one song, it should not suddenly produce darkness in another unless a different mapping mode is deliberately selected.

Consistency is necessary for users to develop intuition.

---

## 3.3 Relative Musical Context

The system should primarily represent changes relative to the current song rather than relying exclusively on absolute signal measurements.

A loud jazz recording and a heavily compressed metal recording may have very different absolute loudness characteristics.

The visualization should therefore attempt to communicate:

> "This section is intense relative to the rest of this song."

rather than simply:

> "This waveform has a large amplitude."

---

## 3.4 Explainability

During development, the system must be able to explain why a visual state exists.

Developers must be able to inspect:

```text
Current audio timestamp

Energy
Spectral centroid
Low-band ratio
Mid-band ratio
High-band ratio
Onset strength
Rhythmic activity

↓

Lightness
Chroma
Hue
Accent intensity
```

A visually impressive but uninterpretable algorithm is not acceptable for the research phase.

---

## 3.5 Accessibility Before Spectacle

Visual effects must avoid:

- strobing
- extreme full-screen luminance changes
- unnecessarily rapid flashes
- unreadable controls
- information represented solely through arbitrary color labels
- animation that overwhelms the underlying musical representation

W3C guidance recommends avoiding content that flashes more than three times within one second; Music in Color should adopt the more conservative design strategy of avoiding intentional flashing altogether and representing rapid events through smooth envelopes instead.

---

## 3.6 Research Before Complexity

The application should use simple deterministic DSP algorithms before introducing machine learning.

Phase 1 must demonstrate that the fundamental mapping is useful before adding:

- emotion-recognition models
- source-separation models
- instrument classifiers
- neural music embeddings
- recommendation systems

The system should only become more complex when research demonstrates that additional complexity produces meaningful user benefit.

---

# 4. Problem Statement

Music is fundamentally multimodal in the human experience.

People experience music through combinations of:

- hearing
- vibration
- movement
- visual performance
- lyrics
- social context
- emotional interpretation

However, most digital music players communicate almost all musical information through sound.

Existing visualizers often display:

- waveforms
- equalizer bars
- frequency spectra
- decorative particles

These representations can be visually appealing but usually do not attempt to establish a stable visual vocabulary that communicates musical properties consistently.

Music in Color addresses the following product problem:

> How can a mobile application transform music into a structured color experience where meaningful musical changes produce understandable visual changes?

---

# 5. Research Question

The primary Phase 1 research question is:

> Can measurable musical characteristics be translated into a consistent color representation that Deaf and hard-of-hearing users perceive as coherent, meaningful, and enjoyable?

Secondary research questions include:

1. Which musical characteristics map most intuitively to color?
2. Is spectral brightness better represented through lightness than hue?
3. Is musical energy effectively represented through chroma?
4. Should hue represent spectral information, musical affect, or user-defined associations?
5. How much temporal smoothing is necessary before music-driven color changes stop appearing chaotic?
6. Do users prefer universal mappings or personalized mappings?
7. Can users identify relative changes in musical intensity from color alone?
8. Can users distinguish sections with different spectral characteristics?
9. Does a research-informed mapping outperform a generic spectrum-to-rainbow visualizer?
10. Does personalization improve perceived coherence?

---

# 6. Target Users

## 6.1 Primary User

A Deaf or hard-of-hearing person interested in experiencing music visually.

The product must not assume that all Deaf users:

- have identical hearing levels
- perceive bass similarly
- know music theory
- use sign language
- experience music identically
- want music represented emotionally

The application must therefore avoid assuming a single "Deaf music experience."

---

# 7. Secondary Users

Secondary audiences may include:

- hearing users interested in visual music
- musicians
- music producers
- accessibility researchers
- HCI researchers
- educators
- digital artists
- live-performance designers
- users with sensory-processing preferences

These audiences must not override the primary accessibility goal.

---

# 8. Jobs to Be Done

## JTBD-01 — Experience Music Visually

> When I play music, I want the visual experience to change with the music so that I can perceive its character through color.

## JTBD-02 — Understand Musical Change

> When a song becomes more energetic, brighter, quieter, heavier, or calmer, I want the visual system to communicate that change.

## JTBD-03 — Explore Different Interpretations

> When I experience a song, I want to compare different visual mappings so I can determine which interpretation feels most meaningful.

## JTBD-04 — Personalize the Experience

> When the default mapping does not match how I associate music with color, I want to adjust the visual mapping.

## JTBD-05 — Understand the System

> When a visual change surprises me, I want to inspect what musical characteristics caused it.

---

# 9. Product Goals

## G1 — Create a coherent visual music representation

The visualization must respond continuously and deterministically to musical features.

## G2 — Run completely offline

No internet connection should be required for:

- importing music
- playing music
- analyzing supported audio
- generating visualizations
- storing preferences

## G3 — Run in Expo Go during Phase 1 development

All required MVP functionality must use:

- Expo SDK modules available in Expo Go
- React Native APIs
- JavaScript/TypeScript libraries that require no additional native code

Expo Go supports only native modules bundled into the Expo Go application or libraries requiring no custom native code.

## G4 — Support Android first

Android is the primary development and QA platform.

iOS compatibility is desirable but shall not block Android development.

## G5 — Maintain future extensibility

The audio-analysis representation must later be consumable by:

```text
ColorMapper
HapticMapper
LanguageMapper
```

without redesigning the audio pipeline.

## G6 — Remain explainable

DSP and mapping algorithms should initially be deterministic and inspectable.

## G7 — Validate usefulness with users

Success shall ultimately depend on user evaluation rather than technical completion alone.

---

# 10. Non-Goals for Phase 1

The following features are explicitly out of scope.

## Not included

- haptic music
- vibration synchronization
- sign language
- lyric transcription
- karaoke captions
- lyric synchronization
- speech recognition
- automatic music description
- instrument-name display
- instrument source separation
- AI-generated interpretations
- AI chatbot
- Spotify integration
- Apple Music integration
- YouTube integration
- online streaming
- social accounts
- cloud storage
- cloud DSP
- music recommendations
- playlists shared between users
- artist profiles
- wearable hardware
- Bluetooth accessories
- music purchasing
- DRM decryption
- generative visuals based on neural networks
- production-scale analytics
- advertising
- subscriptions

These should not be implemented "while convenient."

Scope discipline is part of the product requirement.

---

# 11. Phase Definition

## Phase 0 — Research Laboratory

Purpose:

Validate audio features and color mappings before investing heavily in mobile implementation.

Technology:

```text
Python
NumPy
SciPy
librosa
Matplotlib
```

Primary output:

```text
Audio File
    ↓
Feature Timeline
    ↓
Color Timeline
    ↓
Song Color Signature
```

---

## Phase 1A — Expo Go Visual Prototype

Purpose:

Validate the UI and visual experience using precomputed test tracks.

Characteristics:

- bundled royalty-free audio
- bundled feature timelines
- bundled VisualScores
- React Native renderer
- no dependence on real-time DSP

This stage separates UI problems from DSP problems.

---

## Phase 1B — Expo Go Real-Time Analysis

Purpose:

Analyze user-imported music during playback.

Pipeline:

```text
Imported Song
    ↓
expo-audio
    ↓
PCM sample callbacks
    ↓
DSP Engine
    ↓
Feature Timeline
    ↓
Color Mapping
    ↓
Skia Renderer
```

Expo's `useAudioSampleListener()` exposes raw PCM waveform samples during playback and includes timestamps relative to the audio track. On Android, this sampling mechanism requires `RECORD_AUDIO` permission.

---

## Phase 1C — User Research

Purpose:

Compare visual mappings and determine whether users perceive useful musical information.

---

## Phase 1D — Production Hardening

This begins only after the core concept has been validated.

At this point, the project may migrate from Expo Go to an Expo development build if deeper native functionality becomes necessary.

Expo itself describes Expo Go as a learning/playground environment and recommends development builds for production-grade applications.

---

# 12. Technology Constraints

## 12.1 Required Stack

```text
React Native
TypeScript
Expo
Expo Go
Expo Router
expo-audio
expo-document-picker
expo-file-system
expo-sqlite
React Native Skia
```

React Native Skia is currently included in Expo Go and provides high-performance 2D graphics and programmable shaders suitable for the continuously changing visual field required by this application.

Expo Router, FileSystem, and the relevant Expo SDK modules are likewise available in Expo Go.

---

# 13. Expo Go Architectural Rule

During Phase 1:

> No dependency may be introduced if it requires custom Android native code not already included in Expo Go.

Before adding a dependency, verify one of the following:

```text
A. It is part of the Expo SDK.

OR

B. It is explicitly supported by Expo Go.

OR

C. It is implemented entirely in JS/TS.
```

If none apply, the dependency must be rejected for Phase 1.

---

# 14. System Architecture

```text
┌─────────────────────────────────────────────┐
│                 UI Layer                    │
│                                             │
│ Library / Player / Settings / Research UI  │
└──────────────────────┬──────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────┐
│             Playback Controller             │
│                 expo-audio                  │
└──────────────────────┬──────────────────────┘
                       │
                       │ PCM samples
                       ▼
┌─────────────────────────────────────────────┐
│                DSP Engine                   │
│                                             │
│ RMS                                         │
│ FFT                                         │
│ Spectral Centroid                           │
│ Band Energy                                 │
│ Spectral Flux                               │
│ Onset Estimation                            │
│ Rolling Statistics                          │
└──────────────────────┬──────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────┐
│          AudioFeatureTimeline               │
└──────────────────────┬──────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────┐
│              Color Engine                   │
│                                             │
│ Normalization                               │
│ Color Mapping                               │
│ Smoothing                                   │
│ Safety Limiting                             │
└──────────────────────┬──────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────┐
│              VisualScore                    │
└──────────────────────┬──────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────┐
│               Renderer                      │
│            React Native Skia                │
└─────────────────────────────────────────────┘
```

---

# 15. Architectural Separation

The following components must remain logically independent.

## AudioSource

Responsible for obtaining audio.

## PlaybackEngine

Responsible for playback state.

## AudioSampler

Responsible for receiving PCM samples.

## DSPProcessor

Responsible for calculating measurable audio features.

## FeatureNormalizer

Responsible for converting raw measurements into stable normalized ranges.

## ColorMapper

Responsible for translating normalized music features into perceptual color values.

## TemporalSmoother

Responsible for preventing visually chaotic state changes.

## SafetyLimiter

Responsible for controlling luminance and transition rates.

## VisualRenderer

Responsible only for rendering.

This separation is mandatory.

The renderer must never directly interpret PCM data.

---

# 16. Proposed Repository Structure

```text
music-in-color/
│
├── app/
│   ├── _layout.tsx
│   ├── index.tsx
│   ├── library.tsx
│   ├── player/
│   │   └── [trackId].tsx
│   ├── settings.tsx
│   └── research.tsx
│
├── src/
│   ├── audio/
│   │   ├── playback-controller.ts
│   │   ├── audio-sampler.ts
│   │   ├── import-audio.ts
│   │   └── audio-types.ts
│   │
│   ├── dsp/
│   │   ├── fft.ts
│   │   ├── rms.ts
│   │   ├── centroid.ts
│   │   ├── band-energy.ts
│   │   ├── spectral-flux.ts
│   │   ├── normalizer.ts
│   │   └── dsp-engine.ts
│   │
│   ├── color/
│   │   ├── color-types.ts
│   │   ├── color-engine.ts
│   │   ├── smoothing.ts
│   │   ├── safety-limiter.ts
│   │   └── mappings/
│   │       ├── perceptual-v1.ts
│   │       ├── spectral-v1.ts
│   │       └── personalized-v1.ts
│   │
│   ├── visualization/
│   │   ├── ColorField.tsx
│   │   ├── GradientRenderer.tsx
│   │   └── visual-controller.ts
│   │
│   ├── storage/
│   │   ├── database.ts
│   │   ├── track-repository.ts
│   │   └── score-repository.ts
│   │
│   ├── research/
│   │   ├── feature-overlay.tsx
│   │   ├── mapping-switcher.tsx
│   │   └── export-results.ts
│   │
│   └── shared/
│
├── research/
│   ├── notebooks/
│   ├── test-audio/
│   ├── generated-scores/
│   ├── experiments/
│   └── results/
│
├── assets/
│   └── demo-audio/
│
├── docs/
│   ├── PRD.md
│   ├── architecture.md
│   ├── visual-language.md
│   └── research-protocol.md
│
└── tests/
```

---

# 17. Core Data Flow

## Imported Audio

```text
User chooses file
      ↓
DocumentPicker
      ↓
File URI
      ↓
Copy to application storage
      ↓
Create Track record
      ↓
Load expo-audio player
      ↓
Request sampling permission if necessary
      ↓
Play
      ↓
Receive PCM samples
      ↓
DSP
      ↓
Color
      ↓
Render
```

`expo-document-picker` can invoke Android's system document UI and by default can copy the selected file into the application's cache, while `expo-file-system` can manage persistent application files.

---

# 18. Supported Audio Sources

## Phase 1

Supported source:

> Local audio files explicitly selected by the user.

Priority formats:

- MP3
- M4A/AAC
- WAV
- FLAC
- OGG/Vorbis

Android supports these formats broadly, although exact device support can vary.

The application shall not promise support for every codec or container.

Unsupported files must fail gracefully.

---

# 19. Music Ownership and Copyright

Music in Color shall not distribute copyrighted music.

The application processes:

1. royalty-free test tracks bundled with the application; or
2. files explicitly selected by the user from their device.

No copyrighted audio shall be uploaded to a server during Phase 1.

No audio fingerprint database is required.

No third-party streaming service shall be reverse engineered.

---

# 20. Core User Flow

```text
Launch
  ↓
Onboarding
  ↓
Library
  ↓
Import Song
  ↓
Choose Local File
  ↓
Track Added
  ↓
Open Track
  ↓
Music Player
  ↓
Play
  ↓
Music Generates Colors
  ↓
Optional:
  ├── change mapping
  ├── customize visual response
  └── inspect research view
```

---

# 21. Information Architecture

Primary screens:

```text
Onboarding
Library
Experience / Player
Visual Mapping
Settings
Research / Debug
About
```

The primary user journey should require no more than:

```text
Library
→ Song
→ Play
```

after onboarding.

---

# 22. Onboarding Requirements

## FR-ONB-001

The first launch shall explain the product in one concise statement.

Suggested copy:

> Experience music through color. Music in Color translates musical characteristics into a continuously changing visual experience.

## FR-ONB-002

The onboarding shall explicitly state:

> Colors are an interpretation of musical characteristics, not a universal translation of music.

## FR-ONB-003

The onboarding shall include an accessibility notice about rapidly changing visuals.

## FR-ONB-004

The default visualization shall use safe smooth transitions.

## FR-ONB-005

The user shall not be required to create an account.

## FR-ONB-006

The application shall explain why Android may request microphone/record-audio permission:

> Android requires audio-recording permission for the system API used to access waveform samples from music playing inside the app. Music in Color does not record or upload microphone audio during normal music playback.

This explanation is particularly important because Expo's playback sampling API requires `RECORD_AUDIO` permission on Android even when sampling an `AudioPlayer`.

---

# 23. Library Requirements

## FR-LIB-001

Users shall see all imported tracks.

## FR-LIB-002

Each track item should display:

- title or filename
- duration when available
- analysis/cache state
- most recent playback time

## FR-LIB-003

Users shall be able to import new audio.

## FR-LIB-004

Users shall be able to delete an imported track.

## FR-LIB-005

Deleting a track shall also delete:

- cached feature data
- generated VisualScore
- application-owned copy of the audio, if applicable

## FR-LIB-006

The application shall work with an empty library.

Empty-state copy should encourage import rather than present an error.

## FR-LIB-007

Bundled demonstration tracks may appear separately under:

> Try a Demo

---

# 24. Import Requirements

## FR-IMP-001

The application shall use the Android system file picker through `expo-document-picker`.

## FR-IMP-002

The picker should filter for audio MIME types where practical.

## FR-IMP-003

The system shall validate that the selected resource can be opened.

## FR-IMP-004

The system shall create an internal track identifier independent of the filename.

## FR-IMP-005

The system should persist an application-controlled copy when required for reliable future playback.

## FR-IMP-006

Large file imports shall display progress or an intermediate state when copying takes noticeable time.

## FR-IMP-007

Import failures must display actionable errors.

Examples:

```text
This file could not be opened.

This audio format is not supported on this device.

The file is no longer available.

The application does not have permission to access this file.
```

---

# 25. Playback Requirements

## FR-PLY-001

Users shall be able to:

- play
- pause
- seek
- restart

## FR-PLY-002

The application shall display:

```text
current time / total duration
```

## FR-PLY-003

Playback controls shall disappear after a period of inactivity while music is playing.

## FR-PLY-004

A screen tap shall reveal hidden controls.

## FR-PLY-005

The visual engine shall pause when playback pauses.

## FR-PLY-006

Seeking shall reset temporal DSP state where necessary.

Examples include:

- onset history
- rolling RMS averages
- spectral-flux history
- temporal smoothing buffers

This prevents stale pre-seek data from contaminating post-seek visualization.

## FR-PLY-007

Following a seek, the system may enter a short warm-up interval before all features are considered reliable.

Target:

```text
250–1000 ms
```

depending on feature type.

---

# 26. Experience Screen

The Experience screen is the primary product experience.

Default composition:

```text
┌─────────────────────────────────┐
│                                 │
│                                 │
│                                 │
│       DYNAMIC COLOR FIELD       │
│                                 │
│                                 │
│                                 │
│                                 │
│             01:24               │
│          ─────●──────           │
│          ↶    ▶    ↷            │
└─────────────────────────────────┘
```

The visualization should occupy as much screen area as practical.

UI chrome should remain secondary.

---

# 27. Visualization Requirements

## FR-VIS-001

The visualization shall be generated continuously from current music features.

## FR-VIS-002

The default renderer shall use gradients rather than a single flat color.

## FR-VIS-003

The visualization shall not use:

- equalizer bars
- particle explosions
- unrelated geometric effects

in the first research baseline.

These may confound evaluation of the color mapping.

## FR-VIS-004

Color changes shall be smoothly interpolated.

## FR-VIS-005

Different frequency regions may influence different portions of the gradient.

Example conceptual model:

```text
Low frequencies
      ↓
Base / deeper gradient component

Mid frequencies
      ↓
Central gradient component

High frequencies
      ↓
Highlight gradient component
```

## FR-VIS-006

Strong transient events may temporarily increase:

- lightness
- chroma

but shall not cause abrupt full-screen flashes.

## FR-VIS-007

Visual changes must remain synchronized with playback.

## FR-VIS-008

Rendering target:

```text
60 FPS preferred
30 FPS minimum acceptable
```

on supported Android hardware.

The color interpretation does not need to run at 60 Hz.

DSP states may update at a lower rate while rendering interpolates between them.

---

# 28. Rendering Strategy

The renderer should operate independently of DSP frequency.

Recommended model:

```text
Audio samples
    ↓
DSP ~20–40 updates/sec
    ↓
Target visual state
    ↓
Interpolation
    ↓
Renderer 60 FPS
```

This prevents unnecessarily expensive FFT calculations at display refresh frequency.

---

# 29. Audio Sampling

Expo's `AudioSample` provides:

- one or more audio channels
- normalized PCM frames
- timestamp relative to the current track

PCM samples are normalized between -1 and 1.

The application shall combine stereo channels into an analysis signal unless a future feature explicitly requires spatial-channel information.

Recommended mono conversion:

\[
x[n] = \frac{x_L[n]+x_R[n]}{2}
\]

for two-channel input.

---

# 30. Sample-Rate Handling

A critical Expo Go limitation must be explicitly handled.

The playback `AudioSample` structure exposes PCM frames and track timestamp, but it does not currently expose the source sample rate in the sample structure.

Therefore:

## DSP-001

The implementation must not permanently hard-code 44.1 kHz.

## DSP-002

During prototype development, the system shall investigate whether effective sample rate can be reliably estimated using:

```text
sample count / timestamp delta
```

across contiguous callbacks.

Conceptually:

\[
f_s \approx
\frac{N_t}{T_{t+1}-T_t}
\]

where:

- \(N_t\) = PCM frames received
- \(T_t\) = sample timestamp

## DSP-003

Sample-rate estimation must be tested across multiple Android devices.

## DSP-004

If reliable spectral frequency calculations cannot be achieved in Expo Go, this shall become a formal migration trigger for an Expo development build/native decoding path.

The team must not hide incorrect frequency calculations merely to preserve Expo Go compatibility.

---

# 31. DSP Processing Pipeline

The initial pipeline shall be:

```text
PCM
 ↓
Mono mix
 ↓
Analysis buffer
 ↓
Window function
 ↓
FFT
 ↓
Magnitude spectrum
 ↓
Feature extraction
 ├── RMS
 ├── spectral centroid
 ├── low-band energy
 ├── mid-band energy
 ├── high-band energy
 ├── spectral flux
 └── onset strength
 ↓
Normalization
 ↓
Temporal smoothing
 ↓
AudioFeatureFrame
```

---

# 32. Recommended FFT Parameters

Initial experimental configuration:

```text
FFT size:        2048 samples
Hop size:         512 samples
Window:           Hann
```

At 48 kHz:

```text
2048 samples ≈ 42.7 ms
512 samples  ≈ 10.7 ms
```

At 44.1 kHz:

```text
2048 samples ≈ 46.4 ms
512 samples  ≈ 11.6 ms
```

These are initial engineering defaults, not fixed research conclusions.

Performance testing may require:

```text
1024 FFT
```

on lower-end Android devices.

---

# 33. Windowing

Before FFT:

\[
x_w[n]=x[n]w[n]
\]

where \(w[n]\) is a Hann window.

The purpose is to reduce spectral leakage caused by abruptly cutting the waveform at analysis-frame boundaries.

---

# 34. Feature 1 — RMS Energy

Definition:

\[
RMS_t=
\sqrt{
\frac{1}{N}
\sum_{n=1}^{N}x_t[n]^2
}
\]

Interpretation:

```text
low RMS
→ low instantaneous energy

high RMS
→ high instantaneous energy
```

Primary visual influence:

```text
energy
→ chroma
→ secondary contribution to lightness
```

---

# 35. Feature 2 — Spectral Centroid

Definition:

\[
C_t =
\frac{\sum_k f_k M_t[k]}
{\sum_k M_t[k]}
\]

where:

- \(M_t[k]\) = magnitude of FFT bin \(k\)
- \(f_k\) = frequency associated with bin \(k\)

Interpretation:

> approximate spectral brightness

Primary visual influence:

```text
spectral brightness
→ visual lightness
```

This should initially be one of the strongest mappings.

---

# 36. Feature 3 — Frequency-Band Energy

Initial conceptual bands:

```text
LOW     20–250 Hz
MID     250–2,000 Hz
HIGH    2,000–8,000 Hz
```

These boundaries are experimental and must remain configurable.

Energy ratio:

\[
B_{low} =
\frac{
\sum_{k \in low}M[k]^2
}{
\sum_k M[k]^2+\epsilon
}
\]

Equivalent calculations apply to mid and high bands.

Band ratios should normally satisfy approximately:

\[
B_{low}+B_{mid}+B_{high}\approx1
\]

depending on the spectral range considered.

---

# 37. Feature 4 — Spectral Flux

Spectral flux:

\[
SF_t =
\sum_k
\max(0,M_t[k]-M_{t-1}[k])
\]

Interpretation:

> how much new spectral energy appeared compared with the previous frame.

This can reveal:

- percussion attacks
- strong musical changes
- note attacks
- abrupt timbral changes

---

# 38. Feature 5 — Onset Strength

Onset strength shall be derived from spectral flux or a related novelty function.

The resulting quantity shall be normalized:

```text
0.0 → no significant onset
1.0 → very strong onset
```

Onsets shall not directly trigger binary full-screen flashes.

Instead:

```text
onset
    ↓
visual accent envelope
    ↓
fast rise
    ↓
smooth decay
```

---

# 39. Feature 6 — Rhythmic Activity

Phase 1 does not require perfect BPM detection.

Instead, rhythmic activity can be defined initially from recent onset density.

Example:

\[
R_t =
\frac{\text{onset events in recent window}}
{\text{window duration}}
\]

Window:

```text
1–4 seconds
```

Interpretation:

```text
few events
→ low rhythmic activity

many events
→ high rhythmic activity
```

Primary visual contribution:

```text
rhythmic activity
→ chroma
→ transition responsiveness
```

---

# 40. Features Deferred From MVP

Do not initially implement:

- exact pitch tracking
- melody extraction
- chord recognition
- musical key recognition
- major/minor classification
- valence prediction
- arousal prediction
- source separation
- instrument recognition

These may be investigated once the simpler representation is validated.

---

# 41. Feature Frame Schema

```ts
type AudioFeatureFrame = {
  timestamp: number;

  rms: number;
  rmsNormalized: number;

  spectralCentroidHz: number | null;
  spectralBrightnessNormalized: number;

  lowEnergyRatio: number;
  midEnergyRatio: number;
  highEnergyRatio: number;

  spectralFlux: number;
  onsetStrength: number;

  rhythmicActivity: number;

  confidence: {
    sampleRate: number;
    spectrum: number;
    onset: number;
  };
};
```

Confidence values are important when platform limitations reduce analysis certainty.

---

# 42. Feature Normalization

Raw musical features shall not be passed directly into the color mapper.

Normalization must produce approximately:

```text
0 ≤ feature ≤ 1
```

---

# 43. Rolling Normalization During First Playback

Because Expo Go Phase 1B performs real-time processing rather than guaranteed whole-track preprocessing, normalization should maintain rolling statistics.

Example:

```text
rolling minimum
rolling maximum
rolling mean
rolling variance
rolling percentiles
```

A robust approach should avoid being dominated by individual outliers.

Candidate:

```text
recent P10
recent P90
```

or bounded exponential statistics.

---

# 44. Cached Song-Level Normalization

As a track is played, collected features shall optionally be cached.

After sufficient coverage exists, subsequent playback can use song-specific statistics.

Example:

```json
{
  "rms": {
    "p05": 0.023,
    "p50": 0.081,
    "p95": 0.173
  },
  "centroid": {
    "p05": 812,
    "p50": 1810,
    "p95": 4211
  }
}
```

This allows subsequent playback to become more context-aware.

---

# 45. Analysis Completeness

Each cached track shall maintain an analysis coverage indicator:

```text
0–100%
```

A track that has only been played halfway should not be falsely considered fully analyzed.

Example:

```ts
analysisCoverage: {
  durationSeconds: 240,
  analyzedRanges: [
    [0, 118.4]
  ],
  percent: 49.3
}
```

---

# 46. Research Preprocessing Path

For research tracks, Python shall remain available as a ground-truth/reference implementation.

Pipeline:

```text
song.wav
    ↓
Python DSP
    ↓
complete feature timeline
    ↓
VisualScore.json
    ↓
mobile application
```

Advantages:

- full-track context
- deterministic preprocessing
- easier plots
- easier algorithm comparison
- independent validation of TypeScript DSP
- easier debugging

The mobile TypeScript implementation should be checked against Python outputs for known test fixtures.

---

# 47. Color Space

Internal color calculations should use a perceptual color representation.

Recommended:

```text
OKLCH
```

Represented as:

\[
(L,C,H)
\]

where:

```text
L = perceptual lightness
C = chroma
H = hue
```

The final result shall be converted into a displayable RGB/sRGB color.

---

# 48. Default Color Mapping

Initial mapping shall be called:

```text
Perceptual Mapping v1
```

Inputs:

```text
e = normalized energy
b = normalized spectral brightness
r = normalized rhythmic activity
o = onset strength

low
mid
high
```

---

# 49. Lightness Mapping

Initial proposal:

\[
L_{target}
=
L_{base}
+
w_b b
+
w_e e
\]

Suggested initial values:

```text
Lbase = 0.30
wb    = 0.35
we    = 0.15
```

Then:

```text
L = clamp(Ltarget, 0.25, 0.85)
```

Meaning:

```text
brighter spectrum
→ lighter visual

greater energy
→ somewhat lighter visual
```

These parameters must remain configurable.

---

# 50. Chroma Mapping

Initial proposal:

\[
C_{target}
=
C_{base}
+
w_e e
+
w_r r
\]

Suggested initial values:

```text
Cbase = 0.04
we    = 0.12
wr    = 0.05
```

Meaning:

```text
calmer / lower energy
→ muted colors

higher energy
→ stronger colors
```

---

# 51. Hue Mapping — Experimental

Hue shall not be treated as scientifically solved.

The application must support interchangeable mapping strategies.

---

# 52. Mapping A — Spectral Palette

Frequency-band balance influences hue.

Example hypothesis:

```text
Low-frequency dominance
→ warmer/deeper base palette

Mid-frequency dominance
→ middle palette region

High-frequency dominance
→ cooler/brighter highlight palette
```

Exact hue values must be experimental.

---

# 53. Mapping B — Fixed Artistic Palette

The system defines a base palette for a song or session.

Example:

```text
Base:
deep indigo

Middle:
violet

Highlight:
warm amber
```

Music changes the proportions, lightness, and chroma rather than continuously rotating through a rainbow.

This may create a more aesthetically coherent experience.

---

# 54. Mapping C — User Palette

Users select:

```text
Low-frequency color
Mid-frequency color
High-frequency color
```

The DSP stays identical.

Only the interpretation changes.

---

# 55. Future Mapping — Affective

A future system may estimate:

```text
valence
arousal
```

and map:

```text
valence
→ hue / palette temperature

arousal
→ chroma and responsiveness
```

This is motivated by research indicating emotion-mediated associations between music and color.

This shall not be required for MVP.

---

# 56. Gradient Model

The renderer should receive approximately:

```ts
type VisualState = {
  background: Color;
  lowColor: Color;
  midColor: Color;
  highColor: Color;

  lowWeight: number;
  midWeight: number;
  highWeight: number;

  accentIntensity: number;

  transitionSpeed: number;
};
```

Skia shall interpolate these values into a continuously changing gradient.

---

# 57. Temporal Smoothing

All important visual dimensions require smoothing.

Basic exponential smoothing:

\[
y_t =
\alpha x_t
+
(1-\alpha)y_{t-1}
\]

Different dimensions should use different time constants.

Example starting points:

```text
Onset accent:
fast attack
medium decay

Energy:
medium response

Brightness:
medium response

Base hue:
slow response

Global palette:
very slow response
```

---

# 58. Attack and Release

A single smoothing constant may be insufficient.

Use different attack/release coefficients:

```text
if target > current:
    alpha = attackAlpha
else:
    alpha = releaseAlpha
```

This allows:

```text
musical event
→ rapid visual response
→ graceful visual decay
```

rather than flickering.

---

# 59. Visual Safety Layer

No mapping algorithm may write directly to the renderer.

Pipeline:

```text
ColorMapper
    ↓
TemporalSmoother
    ↓
SafetyLimiter
    ↓
Renderer
```

SafetyLimiter requirements:

## SAFE-001

Clamp minimum and maximum lightness.

## SAFE-002

Clamp chroma.

## SAFE-003

Limit maximum lightness change per unit time.

## SAFE-004

Prevent repeated high-contrast full-screen oscillations.

## SAFE-005

Avoid deliberate flashing above three transitions per second.

## SAFE-006

Provide Reduced Visual Intensity mode.

W3C specifically warns against rapid flashing due to seizure risk.

---

# 60. Reduced Visual Intensity Mode

When enabled:

- slower transitions
- lower maximum chroma
- narrower lightness range
- reduced onset accents
- no abrupt palette changes

Default:

```text
ON
```

during research builds unless user testing indicates another preferred default.

---

# 61. Mapping Screen

Example:

```text
VISUAL LANGUAGE

Mapping Style

● Perceptual
○ Spectral
○ Custom

Intensity
────────●────

Response Speed
─────●───────

Contrast
────●────────

Low Frequencies
[ color ]

Mid Frequencies
[ color ]

High Frequencies
[ color ]

Reduced Visual Intensity
[ ON ]
```

---

# 62. Customization Requirements

## FR-CUS-001

Users shall be able to change mapping mode.

## FR-CUS-002

Users shall be able to change global visual intensity.

## FR-CUS-003

Users shall be able to control transition responsiveness.

## FR-CUS-004

Users shall eventually be able to choose frequency-band colors.

## FR-CUS-005

Reset to default must always be available.

## FR-CUS-006

Changing visual preferences shall not change the underlying audio analysis.

---

# 63. Research / Debug Screen

The development build must include an internal research screen.

Example:

```text
RESEARCH VIEW

Timestamp
01:42.350

AUDIO

RMS                       0.68
Spectral brightness       0.72

Low                       0.61
Mid                       0.28
High                      0.11

Spectral flux             0.81
Onset                     0.91
Rhythm                    0.54

COLOR

Lightness                 0.71
Chroma                    0.17
Hue                       238°

ANALYSIS

Estimated sample rate     48,001 Hz
Sample confidence         0.97
Coverage                  62%
DSP time                  3.2 ms
FPS                       59
```

---

# 64. Explainability Requirement

Any surprising visual state must be diagnosable.

Developers should be able to trace:

```text
Visual output
    ↑
Color state
    ↑
normalized features
    ↑
raw features
    ↑
PCM timestamp
```

---

# 65. Song Color Signature

The application/research tool should support generation of a static visual summary.

Example:

```text
00:00                               04:12
│                                      │
████████████████████████████████████████
```

Each horizontal position corresponds to a moment in the song.

The color at that position corresponds to the mapped state.

This artifact shall be called:

> **Song Color Signature**

Uses:

- algorithm comparison
- regression testing
- research presentation
- visual inspection
- future track browsing

---

# 66. VisualScore

A mapped timeline shall be represented as:

```ts
type VisualFrame = {
  timestamp: number;

  lightness: number;
  chroma: number;
  hue: number;

  lowWeight: number;
  midWeight: number;
  highWeight: number;

  accent: number;
};
```

A complete score:

```ts
type VisualScore = {
  version: string;
  trackId: string;
  mappingId: string;

  generatedAt: string;

  coverage: number;

  frames: VisualFrame[];
};
```

---

# 67. Important Data Separation

Do not store only colors.

Store:

```text
AudioFeatureTimeline
```

separately from:

```text
VisualScore
```

Because:

```text
AudioFeatureTimeline
        │
        ├── PerceptualMapper
        ├── SpectralMapper
        ├── PersonalizedMapper
        │
        ├── future HapticMapper
        │
        └── future LanguageMapper
```

This is one of the most important long-term architectural requirements.

---

# 68. Persistent Data Model

## Track

```ts
type Track = {
  id: string;

  title: string;
  filename: string;

  uri: string;

  mimeType?: string;
  duration?: number;

  importedAt: number;
  lastPlayedAt?: number;

  analysisVersion: string;
  analysisCoverage: number;
};
```

---

# 69. Track Analysis

```ts
type TrackAnalysis = {
  trackId: string;

  algorithmVersion: string;

  estimatedSampleRate?: number;

  statistics: {
    rms?: DistributionStats;
    spectralCentroid?: DistributionStats;
    spectralFlux?: DistributionStats;
  };

  analyzedRanges: TimeRange[];

  frames: AudioFeatureFrame[];
};
```

---

# 70. Settings

```ts
type VisualPreferences = {
  mappingId:
    | "perceptual-v1"
    | "spectral-v1"
    | "custom-v1";

  intensity: number;

  responsiveness: number;

  reducedVisualIntensity: boolean;

  palette?: {
    low: string;
    mid: string;
    high: string;
  };
};
```

---

# 71. Storage Strategy

Use:

```text
SQLite
```

for structured metadata.

Use:

```text
FileSystem
```

for:

- imported audio copies
- large feature timelines
- VisualScore JSON
- exported research artifacts

`expo-file-system` and SQLite are available within Expo projects, including Expo Go support for their standard functionality.

---

# 72. Suggested Storage Layout

```text
documents/
│
├── audio/
│   ├── <track-id>.mp3
│   └── ...
│
├── analysis/
│   ├── <track-id>.features.json
│   └── ...
│
├── scores/
│   ├── <track-id>.perceptual-v1.json
│   └── ...
│
└── exports/
```

---

# 73. Offline-First Requirements

## NFR-OFF-001

The application shall start without internet.

## NFR-OFF-002

Previously imported music shall remain playable offline.

## NFR-OFF-003

Visualization shall operate offline.

## NFR-OFF-004

No DSP request may require a network API.

## NFR-OFF-005

User preferences shall be stored locally.

## NFR-OFF-006

No account shall be required.

---

# 74. Privacy Requirements

## PRIV-001

Audio files must remain on-device.

## PRIV-002

Raw PCM samples must not be transmitted externally.

## PRIV-003

The application shall not collect microphone audio during ordinary track visualization.

## PRIV-004

No personally identifying information shall be required.

## PRIV-005

Research participation shall be opt-in and separate from normal app usage.

## PRIV-006

If analytics are later added, no audio content or extracted audio fingerprint shall be uploaded by default.

---

# 75. Accessibility Requirements

## ACC-001

All buttons shall have accessibility labels.

## ACC-002

Controls must be usable with Android accessibility services.

## ACC-003

Touch targets should meet standard mobile accessibility sizing.

## ACC-004

Text contrast shall remain readable regardless of dynamic background color.

## ACC-005

Player controls shall use a dynamically selected foreground treatment:

```text
dark background
→ light controls

light background
→ dark controls
```

## ACC-006

Meaningful application status must not be communicated through color alone.

Examples:

Analysis status should use:

```text
text + icon + color
```

not merely green/red.

## ACC-007

Reduced visual intensity must be available.

## ACC-008

Visual transitions must obey safety limits.

## ACC-009

The application shall not rely on audio alerts to communicate errors or confirmations.

---

# 76. Color Vision Deficiency

Music in Color is inherently color-centered, but the architecture must prepare for users with color-vision differences.

Future presets should include palettes suitable for common forms of:

- protanopia
- deuteranopia
- tritanopia

The underlying feature mapping must remain independent from the chosen palette.

For example:

```text
musical energy
       ↓
normalized semantic intensity
       ↓
selected accessible palette
```

rather than hard-coding:

```text
high energy = red
```

inside the DSP engine.

---

# 77. Performance Requirements

## PERF-001 — UI

Target:

```text
60 FPS
```

during normal visualization.

Minimum acceptable:

```text
30 FPS
```

on lower-end supported Android hardware.

## PERF-002 — DSP

Average DSP processing time should remain below the analysis interval.

Target:

```text
< 10 ms per analysis update
```

on representative mid-range devices.

## PERF-003 — Memory

Audio sample buffers must use bounded memory.

Do not retain raw PCM for the entire song.

Store derived features instead.

## PERF-004 — Storage

Feature timelines should be downsampled if necessary.

It is unnecessary to store 60 feature frames per second permanently.

Suggested persistent resolution:

```text
10–20 frames/sec
```

unless research demonstrates a need for higher resolution.

## PERF-005 — Battery

Avoid unnecessary DSP while:

- music is paused
- screen is inactive
- application is not visualizing

---

# 78. Android Test Device Strategy

Testing must include multiple performance tiers.

Recommended minimum matrix:

```text
Device A
Entry / low-mid Android

Device B
Representative midrange Android

Device C
Higher-end Android
```

Test across at least two manufacturers.

Reasons include differences in:

- Android versions
- audio implementations
- CPU performance
- display refresh rates
- permission handling
- media codecs

---

# 79. Minimum Android Scope

The exact Android minimum version should follow the Expo SDK baseline used by the project.

Do not manually lower Android compatibility below what the current Expo SDK reliably supports.

The PRD should treat:

> "supported by the selected Expo SDK"

as the source of truth.

---

# 80. Permission Requirements

Normal Phase 1 permissions should be minimal.

Required:

```text
RECORD_AUDIO
```

because Expo's playback audio-sampling API currently requires it on Android.

File selection should use the system picker rather than requesting broad filesystem access whenever possible.

Location permission is prohibited.

Contacts permission is prohibited.

Camera permission is prohibited.

---

# 81. RECORD_AUDIO Permission UX

Because requesting microphone access for a music visualizer can appear suspicious, the application shall present a pre-permission explanation.

Example:

> **Why does Music in Color need audio permission?**
>
> Android requires this permission for the playback-sampling feature used to analyze the music playing inside this app. Music in Color does not upload your audio or continuously listen through your microphone.

Only after this explanation should the Android permission prompt appear.

---

# 82. Error Handling

Every important subsystem shall expose explicit failure states.

## Audio import failure

```text
We couldn't open this audio file.
```

## Unsupported format

```text
This audio format isn't supported on this device.
```

## Permission denied

```text
Audio analysis requires permission to access playback samples on Android.
```

Provide:

```text
Try Again
Open Settings
```

where appropriate.

## Analysis failure

Music should preferably remain playable.

Fallback:

```text
Playback available.
Visualization unavailable for this track.
```

## Renderer failure

Fall back to a static safe background rather than crashing playback.

---

# 83. Graceful Degradation

Subsystem independence is required.

If:

```text
DSP fails
```

then:

```text
audio player may continue
visualization shows fallback
```

If:

```text
cached VisualScore exists
```

then:

```text
visualization may continue even if live sampling fails
```

---

# 84. Research Baselines

Three initial visual conditions shall exist.

## Baseline A — Generic Spectral Rainbow

Purpose:

Represent the common "frequency → rainbow" visualizer approach.

## Experimental B — Perceptual Mapping

Uses:

```text
spectral brightness → lightness
energy → chroma
frequency balance → palette weighting
onsets → controlled accents
```

## Experimental C — Personalized Mapping

Same audio features, user-defined visual palette.

---

# 85. Evaluation Study

After technical stabilization, conduct formative testing with Deaf and hard-of-hearing participants.

The initial study should not attempt to prove medical or cognitive effectiveness.

It should investigate:

- coherence
- interpretability
- comfort
- enjoyment
- preference
- learnability

---

# 86. Research Tasks

Participants may be shown several short musical excerpts under different mappings.

Potential tasks:

## Task A — Energy Comparison

Show two visual excerpts.

Ask:

> Which section appears more musically intense?

## Task B — Change Detection

Ask participants to indicate when they perceive a significant musical change visually.

## Task C — Mapping Preference

Compare:

```text
Generic
Perceptual
Personalized
```

## Task D — Interpretation

Ask:

> What does this color change communicate to you?

Do not provide the expected answer first.

## Task E — Comfort

Ask whether the animation felt:

- comfortable
- distracting
- overwhelming
- too slow
- too fast

---

# 87. User Research Metrics

Use Likert-scale measures such as:

```text
1 = strongly disagree
5 = strongly agree
```

Example statements:

> The colors seemed connected to the music.

> Changes in the visualization felt meaningful.

> I could tell when the music became more intense.

> The visualization was comfortable to watch.

> The visualization changed too quickly.

> I would use an experience like this while listening to music.

> I would prefer to customize how music maps to color.

---

# 88. Qualitative Research

Open-ended questions are required.

Examples:

> What did the colors communicate to you?

> Which changes felt meaningful?

> Which changes felt random?

> Were there moments where the visualization did not match what you expected?

> What would you change?

> What musical information would you want colors to represent?

> Would you prefer stable mappings or different palettes for different songs?

> Would you want to choose your own associations?

---

# 89. Product Success Criteria

Technical completion alone does not equal product success.

Phase 1 should be considered promising if research shows evidence that:

1. users perceive systematic relationships between visual change and musical change;
2. the research-informed mapping scores higher than the generic baseline on coherence;
3. users can distinguish relative energy differences above chance;
4. the visualization remains comfortable during several minutes of playback;
5. personalization produces meaningful preference gains for at least a subset of users;
6. participants express interest in voluntarily using the experience.

---

# 90. Engineering Success Metrics

Initial targets:

| Metric | Target |
|---|---:|
| Crash-free normal playback sessions | ≥99% |
| Imported supported tracks playable | ≥95% |
| Visualization frame rate on midrange device | ~60 FPS |
| Minimum visualization frame rate | ≥30 FPS |
| Average DSP update processing | <10 ms |
| Audio/visual response lag | <100 ms target |
| Unexpected full-screen flashes | 0 |
| Network dependency for core functionality | 0 |
| Raw audio uploads | 0 |

These values are engineering targets and should be refined after profiling.

---

# 91. Visual Latency

Latency should be measured as:

```text
AudioSample timestamp
        ↓
Feature calculation
        ↓
Color calculation
        ↓
Renderer update
```

Target perceptual delay:

```text
<100 ms
```

Preferred:

```text
<50 ms
```

for transient visual accents.

Slow semantic properties such as palette character may deliberately respond over hundreds of milliseconds or several seconds.

---

# 92. Multi-Timescale Model

The system should distinguish:

## Fast layer

Approximate timescale:

```text
50–250 ms
```

Represents:

- attacks
- transients
- immediate spectral brightness

## Medium layer

Approximate timescale:

```text
250 ms–3 s
```

Represents:

- energy
- rhythmic density
- spectral balance

## Slow layer

Approximate timescale:

```text
3–30 s
```

Future representation:

- section character
- tonal context
- emotional context

This prevents every musical event from replacing the entire visual identity.

---

# 93. Testing Strategy

Testing should exist at four levels.

---

# 94. Unit Tests

Test pure mathematical functions.

Examples:

```text
RMS

zero signal
→ 0

constant signal
→ expected RMS
```

```text
band energy

synthetic 100 Hz sine
→ dominant low band
```

```text
spectral centroid

high-frequency sine
→ centroid higher than low-frequency sine
```

```text
normalizer

input below lower bound
→ 0
```

```text
color mapping

same feature frame
→ same color output
```

---

# 95. Synthetic Signal Tests

Generate known audio signals:

```text
100 Hz sine
440 Hz sine
4 kHz sine
white noise
pink noise
impulse
silence
amplitude ramp
```

These make DSP bugs easier to identify than real songs.

---

# 96. Golden Fixture Tests

Use small deterministic WAV files.

Python reference:

```text
fixture.wav
    ↓
Python output
```

TypeScript implementation:

```text
fixture.wav
    ↓
TS output
```

Compare features within tolerance.

---

# 97. Visual Regression Tests

Given a fixed VisualScore:

```text
score.json
```

the renderer should produce consistent reference states at defined timestamps.

Example:

```text
00:10
00:30
01:00
```

---

# 98. Device Tests

Test:

- importing MP3
- importing M4A
- importing WAV
- permission acceptance
- permission denial
- headphone playback
- speaker playback
- pause/resume
- seeking
- repeated track replay
- screen rotation behavior
- app background/foreground
- long track
- low battery mode
- track deletion

---

# 99. Profiling

Development research view should expose:

```text
DSP duration
DSP update rate
renderer FPS
PCM buffer size
estimated sample rate
feature cache size
memory estimate
```

Do not optimize based solely on assumption.

Profile real Android devices.

---

# 100. Analytics

Cloud analytics are not required in Phase 1.

For research builds, local anonymous event logging may be implemented.

Example:

```ts
{
  event: "mapping_changed",
  timestamp: ...,
  mapping: "spectral-v1"
}
```

Research sessions can optionally export a local JSON file with explicit participant consent.

Audio must never be included in analytics exports.

---

# 101. Research Export

Optional researcher mode may export:

```json
{
  "sessionId": "...",
  "trackId": "...",
  "mapping": "perceptual-v1",
  "settings": {},
  "interactions": [],
  "performance": {}
}
```

No personally identifiable information should be automatically included.

---

# 102. Versioning

All algorithms must be versioned.

Examples:

```text
DSP:
dsp-v1

Normalization:
norm-v1

Mapping:
perceptual-v1

VisualScore:
visual-score-1.0
```

If mapping coefficients change:

```text
perceptual-v1
```

should become:

```text
perceptual-v2
```

rather than silently changing existing research data.

---

# 103. Feature Flags

Experimental mappings should be controlled independently.

Example:

```ts
features = {
  spectralMapper: true,
  personalizedMapper: true,
  onsetAccents: true,
  songSignature: true,
  researchOverlay: __DEV__
};
```

---

# 104. MVP User Stories

## US-001

As a user, I want to import a song from my Android device so I can experience it visually.

### Acceptance Criteria

- system picker opens
- supported song loads
- song appears in library
- no internet required

---

## US-002

As a user, I want to play the song and see colors respond to it.

### Acceptance Criteria

- audio begins
- visualization begins
- visual state changes with audio
- pausing freezes musical progression
- resuming restores synchronization

---

## US-003

As a user, I want to seek within the song.

### Acceptance Criteria

- audio jumps to requested point
- visualization resets stale analysis state
- visualization resumes within approximately one second

---

## US-004

As a user, I want to change how the colors interpret the music.

### Acceptance Criteria

- at least two mapping modes exist
- mapping can change without reimporting audio
- change takes effect immediately

---

## US-005

As a user, I want to reduce visual intensity.

### Acceptance Criteria

- Reduced Visual Intensity mode exists
- onset accents weaken
- transitions slow
- lightness range decreases

---

## US-006

As a researcher/developer, I want to inspect audio features.

### Acceptance Criteria

- research screen shows current features
- research screen shows current color values
- timestamps are visible
- performance metrics are visible

---

# 105. MVP Definition of Done

Phase 1 MVP is complete when all of the following work on representative Android devices:

```text
✓ Expo Go launches project

✓ User can import local MP3/WAV/M4A audio

✓ Imported track can be replayed

✓ expo-audio exposes playback PCM

✓ PCM is converted to mono analysis buffers

✓ RMS calculates correctly

✓ FFT calculates correctly

✓ spectral centroid calculates correctly

✓ low/mid/high energy calculates correctly

✓ spectral flux calculates correctly

✓ onset strength works acceptably

✓ feature normalization works

✓ Perceptual Mapping v1 works

✓ second experimental mapping works

✓ Skia renders smooth color gradients

✓ playback and visuals remain synchronized

✓ pause/resume works

✓ seek works

✓ research overlay works

✓ unsafe flashing is prevented

✓ app works offline

✓ imported audio remains local

✓ mapping settings persist

✓ representative midrange Android device performs acceptably
```

---

# 106. Milestone Plan

## M0 — Research Foundation

Deliverables:

```text
DSP research notes
music-color research summary
feature definitions
color-mapping hypotheses
test dataset
```

---

## M1 — Python DSP Laboratory

Deliverables:

```text
audio loader
STFT
RMS
spectral centroid
band energy
spectral flux
onset strength
feature plots
```

Exit criteria:

Feature extraction visually and numerically behaves sensibly across representative songs and synthetic signals.

---

## M2 — Song Color Signature

Deliverables:

```text
OKLCH mapper
RGB conversion
static song color strip
three mapping strategies
```

Exit criteria:

Same track can be rendered using multiple mappings for comparison.

---

## M3 — Expo Foundation

Deliverables:

```text
Expo project
Expo Router
library UI
player UI
Skia renderer
bundled demo track
bundled VisualScore
```

Exit criteria:

Precomputed visualization plays smoothly on Android through Expo Go.

---

## M4 — Local Audio Import

Deliverables:

```text
DocumentPicker
FileSystem persistence
track library
delete/import flows
```

Exit criteria:

Supported local music can be imported and replayed offline.

---

## M5 — Live PCM Pipeline

Deliverables:

```text
expo-audio sampling
permissions
PCM buffering
timestamp synchronization
```

Exit criteria:

PCM samples are received reliably during playback on target Android test devices.

---

## M6 — Mobile DSP

Deliverables:

```text
FFT
RMS
centroid
band energy
spectral flux
onsets
```

Exit criteria:

Mobile outputs approximately match reference Python fixtures.

---

## M7 — Real-Time Color Engine

Deliverables:

```text
normalization
mapping
smoothing
safety layer
Skia integration
```

Exit criteria:

Imported music drives visualization continuously.

---

## M8 — Persistence

Deliverables:

```text
feature caching
analysis coverage
song statistics
VisualScore caching
```

Exit criteria:

Second playback benefits from previously collected analysis data.

---

## M9 — Research Tools

Deliverables:

```text
mapping comparison
debug overlay
research export
performance overlay
```

---

## M10 — Accessibility Hardening

Deliverables:

```text
reduced-motion/intensity
contrast validation
TalkBack labels
flash safeguards
error accessibility
```

---

## M11 — Formative User Study

Deliverables:

```text
participant protocol
mapping comparisons
qualitative interviews
survey
findings
```

---

## M12 — Phase 1 Decision

Choose one of:

```text
CONTINUE
core idea shows promise

ITERATE
mapping needs significant changes

PIVOT
users want a different visual representation

STOP
color-only translation does not provide enough value
```

Stopping is an acceptable research outcome.

---

# 107. Major Technical Risks

## Risk 1 — Expo Go playback sampling limitations

Problem:

The sampling API may behave differently across devices.

Mitigation:

- create a PCM diagnostics screen early
- test multiple Android devices before UI polish
- maintain Python/precomputed fallback
- establish migration criteria

---

## Risk 2 — Unknown/uncertain playback sample rate

Problem:

Accurate FFT frequency interpretation requires sample rate.

Mitigation:

- estimate from PCM frame count and timestamps
- verify using known-frequency test fixtures
- expose confidence
- migrate to a deeper native path if necessary

---

## Risk 3 — JavaScript DSP performance

Problem:

FFT and feature extraction may cause frame drops.

Mitigation:

- benchmark early
- reduce FFT size if necessary
- reduce analysis update rate
- avoid storing raw PCM
- separate DSP updates from rendering
- later move DSP to native/JSI only if measurements justify it

---

## Risk 4 — Colors feel random

Problem:

Technically correct DSP may still produce meaningless perception.

Mitigation:

- compare mappings
- perform user research early
- enable personalization
- avoid treating research hypotheses as universal truths

---

## Risk 5 — Excessive visual noise

Mitigation:

- multi-timescale smoothing
- attack/release envelopes
- transition-rate limits
- restrained gradients

---

## Risk 6 — Permission distrust

Mitigation:

Explain `RECORD_AUDIO` before asking for Android permission.

---

## Risk 7 — Scope creep

Common temptations:

```text
"Let's add lyrics."
"Let's add AI emotion recognition."
"Let's add Spotify."
"Let's add vibration."
"Let's identify instruments."
```

Mitigation:

Reject until Phase 1 validation.

---

# 108. Expo Go Migration Triggers

Moving from Expo Go to an Expo development build becomes justified if one or more of the following occur:

1. playback PCM sampling is inconsistent across target Android hardware;
2. source sample rate cannot be reliably determined;
3. JavaScript DSP cannot maintain acceptable performance;
4. whole-track offline preprocessing becomes necessary;
5. background analysis becomes necessary;
6. deeper Android Media3/ExoPlayer access is required;
7. native FFT libraries become necessary;
8. custom Android audio routing becomes necessary;
9. future haptic functionality requires custom native control;
10. production requirements exceed Expo Go's supported native environment.

This migration should be treated as an architectural evolution, not a project failure.

The Expo application architecture remains usable when switching from Expo Go to development builds. Expo explicitly supports custom native functionality through development builds while retaining the Expo workflow.

---

# 109. Phase 2 — Haptics

Explicitly deferred.

Future architecture:

```text
AudioFeatureTimeline
        │
        ├── ColorMapper
        │
        └── HapticMapper
```

Potential signals:

```text
onset
→ transient vibration

bass energy
→ sustained tactile intensity

rhythmic activity
→ tactile density
```

No Phase 1 feature may couple the feature representation exclusively to color.

---

# 110. Phase 3 — Language

Explicitly deferred.

Potential architecture:

```text
AudioFeatureTimeline
        │
        ├── ColorMapper
        ├── HapticMapper
        └── LanguageMapper
```

Possible future capabilities:

- song sections
- instrument events
- emotional descriptions
- synchronized lyrics
- semantic music descriptions

---

# 111. Phase 4 — Advanced Music Understanding

Potential future ML:

```text
source separation
instrument classification
music segmentation
valence/arousal estimation
melody extraction
music embeddings
personalization models
```

These models should generate higher-level information consumed by the same sensory interpretation layer.

---

# 112. Long-Term Architectural Vision

```text
                         MUSIC
                           │
                           ▼
                ┌────────────────────┐
                │ Music Intelligence │
                │      Engine        │
                └─────────┬──────────┘
                          │
                          ▼
                 MusicFeatureTimeline
                          │
          ┌───────────────┼──────────────┐
          │               │              │
          ▼               ▼              ▼
    ColorMapper      HapticMapper   LanguageMapper
          │               │              │
          ▼               ▼              ▼
       Vision           Touch          Meaning
```

Phase 1 builds:

```text
MusicFeatureTimeline
+
ColorMapper
```

correctly enough that the rest can eventually be attached.

---

# 113. Product Differentiation

Music in Color should not position itself as:

> A cool music visualizer.

It should position itself as:

> A system for translating musical characteristics into a learnable visual language.

Differentiators should eventually include:

- explainable music-to-color mapping
- research-informed visual encoding
- personalization
- Deaf/HoH co-design
- accessibility-first visual safety
- offline processing
- open sensory representation
- future cross-modal expansion

---

# 114. Key Product Hypothesis

The entire project currently rests on this hypothesis:

\[
\boxed{
\text{Consistent musical features}
\rightarrow
\text{consistent perceptual colors}
\rightarrow
\text{meaningful visual music experience}
}
\]

Every Phase 1 engineering decision should help test that hypothesis.

---

# 115. Anti-Goal

The product must avoid becoming:

```text
FFT
↓
rainbow
↓
particles
↓
"AI music visualizer"
```

with no validated relationship between musical information and visual meaning.

Technical sophistication is not the goal.

Meaningful translation is.

---

# 116. Immediate Build Order

Development should proceed in this order:

```text
1. Establish research fixtures

2. Implement Python DSP

3. Validate RMS

4. Validate FFT

5. Validate spectral centroid

6. Validate frequency-band energy

7. Validate spectral flux/onsets

8. Generate complete feature timelines

9. Implement OKLCH color mapping

10. Generate Song Color Signatures

11. Compare multiple mappings

12. Create Expo app

13. Render precomputed VisualScore with Skia

14. Add audio playback

15. Add file import

16. Validate expo-audio PCM sampling on Android

17. Implement TypeScript DSP

18. Compare TS DSP against Python

19. Connect live DSP to renderer

20. Add persistence and caching

21. Add customization

22. Add accessibility safeguards

23. Perform device profiling

24. Conduct DHH formative testing

25. Revise mapping from evidence
```

The mobile UI therefore does not begin until the fundamental music-to-color model has been demonstrated outside the app.

---

# 117. First Engineering Spike

Before committing to the complete mobile architecture, perform one dedicated Expo Go feasibility experiment.

Build a single-screen Android prototype containing:

```text
Pick Audio
Play
Pause

PCM callback count
PCM frame length
Sample timestamp
Estimated sample rate

RMS
Centroid
Low energy
Mid energy
High energy

Current color
FPS
```

No library.

No settings.

No polished UI.

No database.

No gradients beyond a simple background.

The purpose is to answer:

> Can Expo Go reliably provide enough playback PCM information on the target Android hardware to drive our Phase 1 DSP pipeline?

This spike should be completed before building the full application.

---

# 118. Feasibility Spike Pass Criteria

Proceed with the Expo Go architecture if:

```text
✓ PCM callbacks are stable

✓ timestamps increase correctly

✓ pause/resume behaves correctly

✓ seeking recovers correctly

✓ effective sample rate can be determined reliably enough

✓ known sine-wave fixtures produce expected frequency behavior

✓ RMS behaves correctly

✓ FFT processing does not cause serious UI stutter

✓ at least two Android devices behave consistently
```

If these conditions fail, move the audio-analysis layer to an Expo development build while keeping React Native/Expo for the rest of the application.

---

# 119. Product Decision Framework

When deciding whether to add a feature, ask:

### Question 1

Does this improve the user's ability to experience musical information visually?

### Question 2

Does it help validate the central hypothesis?

### Question 3

Can it be implemented without corrupting the clean separation between audio analysis and sensory interpretation?

### Question 4

Does evidence suggest users actually need it?

If the answer is no to all four:

> Do not add it.

---

# 120. Final Phase 1 Product Definition

**Music in Color Phase 1** is:

> An Android-first, offline React Native application that uses local music playback and signal processing to transform measurable musical characteristics into a synchronized, smoothly evolving, customizable color experience.

It will initially run through Expo Go during research and prototyping.

It will:

- import local audio
- play music
- access PCM playback samples
- analyze acoustic features
- maintain a time-aligned musical feature representation
- convert those features into perceptually structured colors
- render them through high-performance gradients
- allow mapping comparison and customization
- operate offline
- preserve user privacy
- avoid unsafe visual flashing
- support formal user evaluation

It will explicitly **not** attempt to solve haptics or language representation during Phase 1.

The primary outcome of Phase 1 is not a commercial application.

The primary outcome is evidence.

Specifically:

> Does a structured visual language based on musical features provide a meaningful music experience, and which mapping principles make that language understandable?

If that question is answered positively, the project has a strong technical and research foundation for Phase 2.

---

# 121. Phase 1 North-Star Statement

> **Make music visually meaningful before making the system more intelligent.**

---

# 122. Technical Reference Notes

At the time of this PRD:

- Expo Audio is included in Expo Go and supports Android playback plus real-time waveform sampling from an `AudioPlayer`.
- Playback `AudioSample` objects expose PCM channels, normalized sample values, and track-relative timestamps.
- Android requires `RECORD_AUDIO` permission for Expo's playback-sampling functionality.
- Expo DocumentPicker supports Android system file selection.
- Expo FileSystem is available in Expo Go for application-local file management.
- Expo Router is supported in Expo Go.
- React Native Skia is included in Expo Go and provides shader-based high-performance rendering.
- Expo recommends development builds rather than Expo Go once a project requires production-grade native customization.
- Android natively supports common audio formats including AAC/M4A, MP3, FLAC, WAV/PCM, Opus and Vorbis, subject to platform/device constraints.
- Music-color association research provides evidence for systematic relationships but supports emotional mediation rather than a universal fixed pitch-to-color dictionary.
- Visual safety requirements should conservatively avoid rapid flashing, informed by WCAG photosensitivity guidance.

---

# 123. PRD Status

**Approved conceptual scope:**

```text
Phase 1
Music → Visual Color
```

**Deferred:**

```text
Phase 2
Music → Haptics

Phase 3
Music → Language
```

**Primary implementation environment:**

```text
React Native
+
Expo
+
Expo Go
+
Android first
```

**Recommended first implementation task:**

```text
Expo Go PCM Feasibility Spike
```

before full application development.

---

**End of Product Requirements Document**