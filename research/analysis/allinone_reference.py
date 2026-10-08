"""Optional desktop-only All-In-One reference; never a phone dependency."""
from importlib.metadata import version
from pathlib import Path
import json


def analyze_sections(path: Path, duration: float, imported_json: Path | None = None):
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
        import allin1
        result = allin1.analyze(str(path), device="cpu", multiprocess=False)
        segments = [{"start": segment.start, "end": segment.end, "label": segment.label} for segment in result.segments]
        model_version = f"allin1-{version('allin1')}-harmonix-all"
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
