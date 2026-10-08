"""Official Beat This preprocessing and minimal postprocessor, with raw logits saved."""
from functools import lru_cache
from importlib.metadata import version
from pathlib import Path
from time import perf_counter
import os

import numpy as np

os.environ.setdefault("TORCH_HOME", str(Path(__file__).resolve().parents[1] / "models" / "torch"))


@lru_cache(maxsize=2)
def load_model(checkpoint):
    import torch
    from beat_this.inference import Audio2Frames
    torch.set_num_threads(4)
    return Audio2Frames(checkpoint_path=checkpoint, device="cpu", float16=False)


def track_beats(pcm, sample_rate, duration, checkpoint, raw_output):
    import torch
    from beat_this.model.postprocessor import Postprocessor
    started = perf_counter()
    model = load_model(checkpoint)
    loaded = perf_counter()
    beat_logits, downbeat_logits = model(pcm, sample_rate)
    beats, downbeats = Postprocessor(type="minimal")(beat_logits, downbeat_logits)
    finished = perf_counter()
    beat_probability = torch.sigmoid(beat_logits).cpu().numpy()
    downbeat_probability = torch.sigmoid(downbeat_logits).cpu().numpy()
    np.savez_compressed(raw_output, beat=beat_logits.cpu().numpy(), downbeat=downbeat_logits.cpu().numpy(), fps=50)

    def events(times, probabilities):
        return [{"time": float(time), "confidence": float(probabilities[min(len(probabilities) - 1, round(float(time) * 50))])}
                for time in times if 0 <= time < duration]

    intervals = np.diff(beats)
    bpm = float(60 / np.median(intervals)) if len(intervals) else None
    checkpoint_path = Path(os.environ["TORCH_HOME"]) / "hub" / "checkpoints" / f"beat_this-{checkpoint}.ckpt"
    report = {"backend": "PyTorch CPU", "checkpoint": checkpoint, "loadSeconds": loaded - started,
              "inferenceSeconds": finished - loaded, "modelBytes": checkpoint_path.stat().st_size if checkpoint_path.exists() else None,
              "rawLogits": str(raw_output), "confidenceMeaning": "Sigmoid activation at the detected timestamp"}
    return {"bpm": bpm if bpm is None or 20 <= bpm <= 400 else None, "beats": events(beats, beat_probability), "downbeats": events(downbeats, downbeat_probability)}, f"beat-this-{version('beat-this')}-{checkpoint}", report
