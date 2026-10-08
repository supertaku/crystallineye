# Desktop music ML feasibility and mobile gate

Checked **2026-10-08, Asia/Manila**, on Windows 11 10.0.26300, Python 3.12.14. Actual Basic Pitch, both Beat This checkpoints, and All-In-One-Infer ran locally on the supplied True Colors MP3. The results support desktop reference analysis. They do not authorize a claim that on-device inference or musical user acceptance is ready.

## Basic Pitch and Beat This

The existing isolated `.venv-research` supplied Basic Pitch 0.4.0, ONNX Runtime 1.23.2, NumPy 1.26.4, librosa 0.11.0, Beat This 1.1.0, Torch/Torchaudio 2.9.1. I used the official Basic Pitch ONNX preprocessing/postprocessing and Beat This frontend/minimal postprocessor, preserving raw model outputs.

| Checkpoint | Actual local bytes | True Colors CPU inference |
| --- | ---: | ---: |
| Basic Pitch official ONNX | 230,444 | 5.543 s |
| Beat This small0 | 8,451,101 | 10.976 s |
| Beat This final0 | 81,058,141 | 10.587 s |

These cached-weight runs overlapped other development work. final0 being slightly faster in this one run is not evidence that it is generally cheaper. small0 is about one tenth the checkpoint size and produced similar beat predictions, but downbeat disagreement remains substantial. Default confidence values are activation strengths, not calibrated probabilities.

Basic Pitch's default TensorFlow dependency problem is an older documented failure on this Python version. This task reused the working ONNX setup rather than retrying TensorFlow. The missing CoreML/TFLite/TensorFlow warnings in Basic Pitch did not prevent actual ONNX inference. The repository still pins setuptools 80.9.0 for resampy's legacy `pkg_resources` import.

Official references: [Spotify Basic Pitch](https://github.com/spotify/basic-pitch), [CPJKU Beat This](https://github.com/CPJKU/beat_this).

## All-In-One-Infer: the newer package works here

The old `allin1==1.1.0` was rechecked and failed to import with `ModuleNotFoundError: No module named 'madmom'`. That earlier limitation no longer describes the newer fork's tested path.

I checked the [All-In-One-Infer primary repository](https://github.com/openmirlab/all-in-one-infer). Its packaging uses pure PyTorch neighborhood attention by default, with NATTEN optional. The current repository source and released wheel differ in dependency declarations; I tested the released **3.1.0 wheel**, not GitHub HEAD. The isolated install used:

| Package | Installed version |
| --- | --- |
| all-in-one-infer | 3.1.0 |
| demucs-infer | 4.4.0 |
| madmom-infer | 0.2.0 |

I created `.build-tools/aio-infer-env`. Its `reference-env.pth` points to the existing research environment's site-packages, letting this experiment reuse Torch and other large libraries without modifying that environment. The three newer packages install into the experiment environment itself. This is an isolated overlay, not an independently frozen full environment.

I first tried normal `venv` creation; `ensurepip` exited nonzero. The resulting Python interpreter still worked. The unprivileged uv install failed after DNS retries. A network-enabled uv retry resolved packages but its distribution-cache rename failed with `Access is denied (os error 5)`. Using the existing pip with `--python`, `--no-cache-dir`, and `--no-deps` succeeded. I checked imports before running actual inference. No compiler, NATTEN build, or original madmom install was needed.

Recreate the tested overlay, using `--without-pip` to avoid the observed ensurepip failure:

```powershell
.\.venv-research\Scripts\python.exe -m venv --without-pip .build-tools/aio-infer-env
$referenceSite = (Resolve-Path '.venv-research/Lib/site-packages').Path
Set-Content -LiteralPath '.build-tools/aio-infer-env/Lib/site-packages/reference-env.pth' -Value $referenceSite
.\.venv-research\Scripts\python.exe -m pip --python .build-tools/aio-infer-env/Scripts/python.exe install --no-cache-dir --no-deps all-in-one-infer==3.1.0 demucs-infer==4.4.0 madmom-infer==0.2.0
.\.build-tools\aio-infer-env\Scripts\python.exe -c "import allin1_infer; print(allin1_infer.__version__)"
```

`--no-deps` is appropriate only after the research environment is installed; it is not a standalone installation recipe. The release metadata requires Torch, NumPy, librosa, hydra-core, omegaconf, huggingface_hub, matplotlib, scipy, SoundFile, and the two inference packages. Model weights were downloaded from the upstream hosts. Audio was never sent to those hosts.

The actual `harmonix-all` run used all eight upstream Harmonix folds, CPU float32, 4 Torch threads, and no `torch.compile`, multiprocessing, or optional reduced-overlap/half-precision setting. Its internal Demucs preprocessing is part of the structure reference. It is separate from the later product experiment comparing original-mix Basic Pitch with vocal-stem Basic Pitch. I did not run that product A/B or deploy separation to Android.

The eight downloaded Harmonix checkpoint files total **11,204,568 bytes** (1,400,571 bytes each). This excludes the separate Demucs model and runtime libraries; it is not the complete inference footprint. Supporting installed versions were SoundFile 0.14.0, scipy 1.17.1, hydra-core 1.3.7, omegaconf 2.3.1, and huggingface_hub 2.1.1.

The cold structure reference completed in **243.852 s** with a **4.568 GiB** process peak working set. It produced 14 sections and a schema-valid FULL combined analysis. This measured cost favors keeping All-In-One as a desktop reference. An adapter now prefers `allin1_infer` when available, supports explicit legacy selection, preserves failure fallback, and places its byproducts under the caller's ignored output directory. Prepared audio must match the original decoded sample rate, channels, and every float32 sample; matching metadata alone cannot pass that gate. The actual MP3-to-stereo-WAV pair passed the streamed comparison. The bounded runner stops its worker after 600 seconds and saves failures rather than hanging indefinitely.

All-In-One label confidence is unavailable, so section confidence 0.5 stays explicitly uncalibrated. Learned boundaries and verse/chorus labels need human review. Source hashes, timestamps, and schema validity establish provenance and executable behavior, not musical accuracy.

## Diagnostics without another inference run

Generate local waveform/RMS, raw-note/selected-contour, beat/downbeat, chroma, and DSP-versus-All-In-One section plots from saved model outputs:

```powershell
.\.venv-research\Scripts\python.exe research/analysis/plot_reference.py 'research/results/generated/Justin Timberlake, Anna Kendrick - True Colors (Lyric)-72621718f6e7/song.analysis.json' --full-analysis .build-tools/true-colors-allinone/true-colors.analysis.json --output .build-tools/true-colors-diagnostics
```

The helper records the original track hash, saves timed note/rhythm JSON locally, and creates an empty manual-annotation template. No template entry is labeled as an observation. [TRUE_COLORS_ANALYSIS.md](TRUE_COLORS_ANALYSIS.md) reports the actual counts and the failed bass-biased melody experiment.

## Deployment decision

Mobile ML integration remains **deferred**. Six-minute phone memory/performance, native decoder timing parity, visible music-event coherence, and user acceptance still need the earlier gates. No TFLite, ExecuTorch, mobile model, GPU delegate, quantization, or training work was installed or validated in this task.

Basic Pitch's official TFLite model remains the first candidate after those gates, with exact preprocessing/tensor/note parity against these desktop references. Beat This small0 remains a smaller checkpoint to investigate later, but no successful export or mobile operator compatibility is claimed. Retain deterministic whole-track DSP as an explicit fallback. Model improvements must be tested independently from composer changes on the same audio/timestamps; reduced pitch jumps alone cannot justify mobile deployment.
