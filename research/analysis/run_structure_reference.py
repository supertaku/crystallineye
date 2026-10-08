"""Run a bounded local structure experiment while preserving the MP3 identity."""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import subprocess
import sys
from pathlib import Path
from time import perf_counter


def write_json(path, value):
    path.write_text(json.dumps(value, indent=2, allow_nan=False) + "\n", encoding="utf-8")


def worker(args):
    import soundfile as sf
    import torch
    from analyze import peak_memory_bytes
    from allinone_reference import analyze_sections
    from schema import validate_analysis
    torch.set_num_threads(4)
    started = perf_counter()
    digest = hashlib.sha256(args.audio.read_bytes()).hexdigest()
    base = json.loads(args.analysis.read_text(encoding="utf-8"))
    if base["track"]["hash"] != digest:
        raise ValueError("Reference analysis does not match the original audio bytes")
    decoded, rate = sf.read(args.audio, dtype="float32", always_2d=True)
    # WAV preserves the original stereo decode; MP3 identity remains the original digest.
    prepared = args.output / "structure-input.wav"
    sf.write(prepared, decoded, rate, subtype="FLOAT")
    write_json(args.output / "structure-source-manifest.json", {
        "originalPath": str(args.audio.resolve()), "originalSha256": digest,
        "preparedPath": str(prepared.resolve()), "preparedSha256": hashlib.sha256(prepared.read_bytes()).hexdigest(),
        "sampleRate": rate, "channels": decoded.shape[1], "frames": len(decoded),
        "decoder": f"soundfile {sf.__version__} / libsndfile {sf.__libsndfile_version__}",
        "purpose": "Exact stereo decode of original MP3, avoids a separate MP3 decoder offset"})
    del decoded
    sections, model_version = analyze_sections(args.audio, base["track"]["duration"], backend="infer",
        model=args.model, prepared_audio=prepared, output_directory=args.output)
    base["structure"]["segments"] = sections
    base["modelVersions"]["structure"] = model_version
    base["warnings"] = [warning for warning in base["warnings"] if not warning.startswith("Structure uses DSP novelty")]
    base["warnings"].append("All-In-One-Infer does not provide segment confidence; 0.5 is an uncalibrated placeholder.")
    base["quality"] = "FULL" if base["notes"] and base["rhythm"]["beats"] and base["rhythm"]["downbeats"] else "PARTIAL"
    validate_analysis(base)
    write_json(args.output / "true-colors.analysis.json", base)
    write_json(args.output / "structure-report.json", {"status": "completed", "sourceHash": digest,
        "modelVersion": model_version, "elapsedSeconds": perf_counter() - started,
        "processPeakWorkingSetBytes": peak_memory_bytes(), "sections": len(sections), "confidenceIsCalibrated": False})


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("audio", type=Path)
    parser.add_argument("analysis", type=Path)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--model", choices=["harmonix-all", *[f"harmonix-fold{i}" for i in range(8)]], default="harmonix-all")
    parser.add_argument("--timeout", type=int, default=600)
    parser.add_argument("--worker", action="store_true", help=argparse.SUPPRESS)
    args = parser.parse_args()
    args.output = args.output.resolve()
    args.output.mkdir(parents=True, exist_ok=True)
    if args.worker:
        worker(args)
        return
    environment = dict(os.environ)
    environment["HF_HOME"] = str(Path("research/models/huggingface").resolve())
    environment["TORCH_HOME"] = str(Path("research/models/torch").resolve())
    environment["HF_HUB_DISABLE_XET"] = "1"
    started = perf_counter()
    try:
        with (args.output / "structure-inference.log").open("w", encoding="utf-8") as log:
            result = subprocess.run([sys.executable, str(Path(__file__).resolve()), *sys.argv[1:], "--worker"],
                env=environment, stdout=log, stderr=subprocess.STDOUT, timeout=args.timeout, check=False)
        if result.returncode:
            raise RuntimeError(f"Inference process exited {result.returncode}; see structure-inference.log")
    except (subprocess.TimeoutExpired, RuntimeError) as error:
        write_json(args.output / "structure-report.json", {"status": "failed", "model": args.model,
            "error": str(error), "elapsedSeconds": perf_counter() - started, "timeoutSeconds": args.timeout})
        print(error, file=sys.stderr)
        sys.exit(1)
    print(args.output / "structure-report.json")


if __name__ == "__main__":
    main()
