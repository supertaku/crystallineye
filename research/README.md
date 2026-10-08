# Desktop research

The reference tools write the same MusicAnalysis accepted by V3. These models are desktop research dependencies; none is bundled into the mobile app.

V3.1 update, 2026-10-08: the exact local True Colors MP3 now has a FULL reference using All-In-One-Infer 3.1.0, Basic Pitch 0.4.0 and Beat This 1.1.0. The older `allin1==1.1.0` import failure below remains a legacy-path result. See [actual song analysis](../docs/TRUE_COLORS_ANALYSIS.md) and [the tested overlay setup](../docs/ML_FEASIBILITY.md) for versions, commands, provenance, local outputs and open listening/device gates. One complete recording does not fulfill the five-song study.

## Setup

The tested Windows setup uses Python 3.12.14 with ONNX CPU inference for Basic Pitch and PyTorch CPU inference for Beat This. Create a separate environment:

```powershell
python -m venv .venv-research
.\.venv-research\Scripts\python.exe -m pip install -r research/requirements.txt
.\.venv-research\Scripts\python.exe -m pip install basic-pitch==0.4.0 --no-deps
```

Basic Pitch's default TensorFlow pin does not resolve on this Python version. The official package also includes its ONNX model, which the wrapper explicitly selects. The requirements include its ONNX path's dependencies and setuptools 80.9.0 because resampy imports the removed `pkg_resources` helper. This environment deliberately omits TensorFlow/CoreML/TFLite; their upstream import warnings do not mean ONNX failed.

The legacy All-In-One package needs its upstream installation procedure, including madmom and a compatible NATTEN build. Installing `allin1==1.1.0` alone did not supply those dependencies on this host. The newer tested `all-in-one-infer==3.1.0` overlay uses pure PyTorch attention and imported successfully; the adapter now prefers it when present. Keep either workflow in a separately prepared desktop environment, and validate the exact source identity when importing upstream results.

## Run

```sh
npm run fixtures:v3
```

```powershell
.\.venv-research\Scripts\python.exe research/analysis/analyze.py research/fixtures/generated/pop.wav --compare-beats
.\.venv-research\Scripts\python.exe research/analysis/analyze.py path/to/song.wav --strict --structure allinone
.\.venv-research\Scripts\python.exe research/analysis/analyze.py path/to/song.wav --allinone-json path/to/upstream-result.json --strict
```

Multiple input files are accepted. `--beat-model small0|final0` chooses the score's rhythm source; `--compare-beats` saves the other checkpoint's output too. `--structure auto` labels unavailable All-In-One as DSP fallback. **`--strict` fails instead of accepting missing models.** Complete JSON files from at least five representative songs are required to pass the reference milestone.

The output folder is `<stem>-<hash-prefix>/` under `research/results/generated/`:

- `song.analysis.json`: validated schema and actual model versions.
- `normalized.wav` / `normalized.f32`: the shared 22,050 Hz mono input.
- `basic-pitch.npz`: actual official output tensors.
- `beat-this-small0.npz` / `beat-this-final0.npz`: actual logits and frame rate.
- `rhythm-final0.json` or `rhythm-small0.json`: comparison events.
- `report.json`: measured load/inference time, checkpoint size and process peak working set.

The original source bytes determine the audio hash. Basic Pitch reads the normalized FLOAT WAV; Beat This receives the same mono samples and applies its own official frontend. Python/native decoding offsets for lossy codecs still need comparison. Process peak working set is cumulative for the batch, not isolated per-track model memory. Cold load time includes imports and any checkpoint download; inference time covers the actual frontend/model/postprocessing call. The corrected comparison batch used already downloaded weights.

Beat This downloads its official checkpoints to `research/models/torch/`. All-In-One may download weights and use desktop Demucs internally; keep that reference workflow separate from the later product source-separation experiment. Outputs, audio and model weights are ignored by Git.

## Compare and inspect

```powershell
.\.venv-research\Scripts\python.exe research/analysis/evaluate.py
npm run validate:reference
npm run validate:paint -- research/results/generated/pop-8ad8874d7c15/song.analysis.json
```

Evaluation matches synthetic known notes by pitch and 70 ms onset tolerance, measures beat/downbeat F1 at 70 ms, and compares internal section boundaries at three seconds. It writes `evaluation.json` and timeline plots. TypeScript validation reads Python JSON, recomputes measured DSP on the exact PCM, and checks deterministic composition/seek. V3.1 paint validation compiles the actual pigment shader and samples timeline/boundary frames plus fallback, reduced-motion, simple-brush and accent comparisons; repeat frames after a simulated seek must be byte-identical.

The ten generated arrangement names span the requested categories but are simple synthesis fixtures, not representative recordings of those genres. Keep personal songs local; don't commit copyrighted commercial audio. Their ground-truth JSON is explicitly identified as synthetic truth, never labeled as inferred ML output.

[Reference results](results/REFERENCE_RESULTS.md) · [Basic Pitch upstream](https://github.com/spotify/basic-pitch) · [Beat This upstream](https://github.com/CPJKU/beat_this) · [All-In-One upstream](https://github.com/mir-aidj/all-in-one) · [NATTEN installation](https://natten.org/install/)
