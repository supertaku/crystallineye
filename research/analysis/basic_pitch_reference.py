"""Use Spotify's official preprocessing, inference, overlap and note creation unchanged."""
from functools import lru_cache
from importlib.metadata import version
from pathlib import Path
from time import perf_counter

import numpy as np


@lru_cache(maxsize=1)
def load_model():
    from basic_pitch import FilenameSuffix, build_icassp_2022_model_path
    from basic_pitch.inference import Model
    path = build_icassp_2022_model_path(FilenameSuffix.onnx)
    return Model(path), path


def transcribe(path: Path, duration: float, raw_output: Path):
    from basic_pitch.inference import predict
    started = perf_counter()
    model, model_path = load_model()
    loaded = perf_counter()
    tensors, _, events = predict(path, model_or_model_path=model)
    finished = perf_counter()
    np.savez_compressed(raw_output, **tensors)
    notes = []
    for start, end, midi, amplitude, bends in events:
        start, end = max(0., float(start)), min(duration, float(end))
        if end <= start or start >= duration:
            continue
        strength = min(1., max(0., float(amplitude)))
        note = {"start": start, "end": end, "midi": int(midi), "amplitude": strength, "confidence": strength}
        if bends is not None:
            note["pitchBends"] = [float(bend) for bend in bends]
        notes.append(note)
    return sorted(notes, key=lambda note: note["start"]), f"basic-pitch-{version('basic-pitch')}-onnx", {
        "backend": "ONNX CPU", "loadSeconds": loaded - started, "inferenceSeconds": finished - loaded,
        "modelBytes": model_path.stat().st_size, "rawTensors": str(raw_output),
        "confidenceMeaning": "Mean note activation, used as a strength proxy; not calibrated probability",
    }
