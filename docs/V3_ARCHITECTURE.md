# V3 architecture

`Local file → normalized PCM → MusicAnalysis → VisualScore → audio currentTime → Skia paint`

The three central jobs are separate. Analysis contains musical events and their uncertainty. Composition makes replaceable artistic choices. Paint renders those choices at a supplied song position. Composer changes never require model inference to run again.

## Audio and resource limits

`src/audio-v3/` uses react-native-audio-api 0.13.6 for metadata duration, decoding and file-backed playback. `audio-metadata.ts` reads bounded container headers for WAV, FLAC, Ogg, MP3, AAC and MP4 before PCM allocation. Unknown or unsafe channel/rate bounds fail closed. Native decoding explicitly requests 22,050 Hz; downmixing copies short channel chunks into one Float32 mono buffer.

The guard estimates source PCM, resampled channel PCM, mono PCM and a 24 MiB reserve. The limits are six minutes, eight channels, 96 kHz source rate, 128 MiB encoded data and 192 MiB estimated decoding memory. This is a conservative allocation policy, not a measured device memory guarantee. Multichannel and native codec coverage still need device checks.

The file hash is incremental SHA-256. A matching cache is checked before PCM decoding. There is one analysis decode on a cache miss; file playback separately uses the native streaming decoder. The pinned JSI channel copier uses a destination's backing-buffer size, so the last short copy gets an exactly sized ArrayBuffer instead of a subarray view. Cancel is observed between cooperative DSP chunks and before/after native decoding, which currently has no abort API.

## MusicAnalysis

`src/analysis/analysis-schema.ts` and `research/analysis/schema.py` mirror each other. Imported JSON and caches are validated for version, SHA-256, sample rate, finite values, ordered event lists, bounded counts and complete section coverage.

The shipping prototype uses calibrated whole-track DSP: Hann-windowed FFT, RMS, percentile-normalized energy/onsets, bass-band power and spectral brightness. It estimates beats by onset alignment, harmony by peak chroma and triad templates, and repeated structural regions by a bounded self-similarity matrix with novelty peaks. No note events are invented. Four-beat visual anchors are explicitly inferred and low confidence; they do not establish a known meter.

The desktop oracle uses the official Basic Pitch ONNX preprocessing/inference/note creation and Beat This preprocessing plus its minimal postprocessor. Both small0 and final0 are measured. All-In-One is a reference-only adapter; DSP structure fallback is labeled PARTIAL and cannot satisfy strict reference validation. Upstream note activation and segment-confidence placeholders are identified as uncalibrated.

## VisualScore

`src/visual-score/` selects a continuous line from polyphonic notes using confidence, sustain and pitch-jump costs. A song/section/phrase seed fixes the geometry. Notes move the brush contour; rests split gestures; downbeats start phrases; ordinary beats alter pressure. Energy affects width/opacity, pitch classes and triads choose perceptual colors, isolated onsets add drops, bass adds broad washes, and sections change scenes.

This is an artistic interpretation, not a piano roll or a claim of objective pitch-to-color meaning. Chord estimates can remain unknown. Without note transcription, measured energy and spectrum supply a lower-confidence contour. Silence does not draw fallback strokes.

The composer emits only normalized geometry, times, colors and mark parameters. `paint-composer-2` is independently versioned. The palette is replaceable without changing the music schema.

## Painting and transport

`src/paint/` converts contour points to bounded cubic paths. Marks persist and fade slowly rather than clearing on every beat. Ink drops diffuse, washes expand slowly and previous scenes dissolve over six seconds. The small pigment RuntimeEffect adds static grain to paths; it does not invent motion. Reduced-motion mode keeps path reveals and substitutes steady diffusion/radii.

`AudioTransport.currentTime()` reads the native file source's position. UI frame callbacks sample that position and never integrate an elapsed timer into a visual clock. Pausing and buffering hold the last position. Native seeks are asynchronous, so the canvas holds the requested reconstructed position until the source clock acknowledges it.

The pinned Audio API Audio tag exposes `getFileSourceNode()` at runtime but omits it from its public handle type. `native-clock.ts` contains that narrow, checked adapter. A missing accessor stops playback with a clear error. Upgrading this dependency requires native clock validation; there is no timer-extrapolation fallback.

`ScorePlayer` performs a section lookup and reconstructs marks from the score and absolute song time. React mounts fixed event arrays for the current and previous section; shared values reveal the paths. Dense or very long sections may still mount many path nodes. Android frame time, long-track resource behavior and further scene caching remain to be measured.

## Cache and developer comparison

`AnalysisCache` keys music by audio content, analysis schema and sorted model versions. A composer version mismatch rebuilds only VisualScore. File writes use a temporary file followed by a move. Invalid or unavailable cache data falls back to analysis. Developer reference imports keep a pointer to their exact model versions for subsequent local reuse.

V2's modules remain in place and its original screen is copied into `src/legacy-v2/` for development-only A/B review. Expo Go selects V2 without initializing the V3 native module. Diagnostics, quality tiers and research import controls do not appear in the production UI.
