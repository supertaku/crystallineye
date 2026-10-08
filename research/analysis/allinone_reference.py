"""Optional desktop-only All-In-One reference; never a phone dependency."""
from importlib.metadata import version
from pathlib import Path
import json
from importlib.util import find_spec


def verify_prepared_audio(source: Path, prepared: Path):
    """A prepared WAV must preserve every original decoded sample and channel."""
    import numpy as np
    import soundfile as sf
    with sf.SoundFile(source) as original, sf.SoundFile(prepared) as candidate:
        if original.samplerate != candidate.samplerate or original.channels != candidate.channels:
            raise ValueError("Prepared structure audio must preserve the original sample rate and channels")
        while True:
            left = original.read(65536, dtype="float32", always_2d=True)
            right = candidate.read(65536, dtype="float32", always_2d=True)
            if not np.array_equal(left, right):
                raise ValueError("Prepared structure audio must preserve the exact original decoded samples")
            if not len(left):
                break


def analyze_sections(path: Path, duration: float, imported_json: Path | None = None,
                     backend: str = "auto", model: str = "harmonix-all", prepared_audio: Path | None = None,
                     output_directory: Path | None = None):
    if imported_json:
        data = json.loads(imported_json.read_text(encoding="utf-8"))
        # The upstream result stores its source path; require matching file bytes.
        import hashlib
        source = Path(data["path"])
        if not source.is_file() or hashlib.sha256(source.read_bytes()).digest() != hashlib.sha256(path.read_bytes()).digest():
            raise ValueError("All-In-One JSON must identify the exact analyzed audio file")
        segments = data["segments"]
        model_version = "allinone-import-harmonix-all"
    else:
        if prepared_audio is not None:
            verify_prepared_audio(path, prepared_audio)
        if backend == "infer" or (backend == "auto" and find_spec("allin1_infer") is not None):
            import allin1_infer as implementation
            distribution = "all-in-one-infer"
            prefix = "allin1-infer"
        else:
            import allin1 as implementation
            distribution = "allin1"
            prefix = "allin1"
        options = {"device": "cpu", "multiprocess": False, "model": model}
        if output_directory is not None:
            # Keep all copyrighted derivatives under the caller's ignored local folder.
            options.update(out_dir=str(output_directory / "structure"),
                           demix_dir=str(output_directory / "demix"), spec_dir=str(output_directory / "spectrograms"))
        result = implementation.analyze(str(prepared_audio or path), **options)
        segments = [{"start": segment.start, "end": segment.end, "label": segment.label} for segment in result.segments]
        model_version = f"{prefix}-{version(distribution)}-{model}"
    result = []
    previous = 0.
    for segment in sorted(segments, key=lambda segment: segment["start"]):
        start, end = max(previous, float(segment["start"])), min(duration, float(segment["end"]))
        if start > previous:
            result.append({"start": previous, "end": start, "label": "Section unknown", "confidence": 0.})
        if end > start:
            result.append({"start": start, "end": end, "label": str(segment["label"]), "confidence": .5})
            previous = end
    if previous < duration:
        result.append({"start": previous, "end": duration, "label": "Section unknown", "confidence": 0.})
    return result, model_version
