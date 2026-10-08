"""Desktop reference CLI. Output is accepted unchanged by the DEV MusicAnalysis loader."""
from __future__ import annotations

import argparse
import hashlib
import json
import platform
import sys
from importlib.util import find_spec
from pathlib import Path
from time import perf_counter

import librosa
import numpy as np
import soundfile as sf

from schema import SAMPLE_RATE, VERSION, validate_analysis
from features import features, chroma_from_notes, estimate_chords, segment_sections
from basic_pitch_reference import transcribe
from beat_this_reference import track_beats
from allinone_reference import analyze_sections


def write_json(path, data):
    path.write_text(json.dumps(data, indent=2, allow_nan=False), encoding="utf-8")


def peak_memory_bytes():
    if sys.platform == "win32":
        import ctypes
        from ctypes import wintypes
        class Counters(ctypes.Structure):
            _fields_ = [("cb", wintypes.DWORD), ("PageFaultCount", wintypes.DWORD)] + [(name, ctypes.c_size_t) for name in (
                "PeakWorkingSetSize", "WorkingSetSize", "QuotaPeakPagedPoolUsage", "QuotaPagedPoolUsage",
                "QuotaPeakNonPagedPoolUsage", "QuotaNonPagedPoolUsage", "PagefileUsage", "PeakPagefileUsage")]
        counters = Counters()
        counters.cb = ctypes.sizeof(counters)
        kernel = ctypes.WinDLL("kernel32", use_last_error=True)
        kernel.GetCurrentProcess.restype = wintypes.HANDLE
        psapi = ctypes.WinDLL("psapi", use_last_error=True)
        psapi.GetProcessMemoryInfo.argtypes = [wintypes.HANDLE, ctypes.POINTER(Counters), wintypes.DWORD]
        if psapi.GetProcessMemoryInfo(kernel.GetCurrentProcess(), ctypes.byref(counters), counters.cb):
            return int(counters.PeakWorkingSetSize)
        return None
    import resource
    value = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
    return int(value if sys.platform == "darwin" else value * 1024)


def analyze(path: Path, args):
    started = perf_counter()
    info = sf.info(path)
    if not 0 < info.duration <= 360 or not 1 <= info.channels <= 8 or not 0 < info.samplerate <= 96000:
        raise ValueError("Audio must be at most six minutes, eight channels and 96 kHz")
    estimated = info.frames * info.channels * 4 + round(info.duration * SAMPLE_RATE) * (info.channels + 1) * 4 + 24 * 1024**2
    if estimated > 192 * 1024**2 or path.stat().st_size > 128 * 1024**2:
        raise ValueError("Audio exceeds the PCM or encoded-file budget")
    with path.open("rb") as source:
        digest = hashlib.file_digest(source, "sha256").hexdigest()
    destination = args.output / f"{path.stem}-{digest[:12]}"
    destination.mkdir(parents=True, exist_ok=True)
    pcm, sample_rate = sf.read(path, dtype="float32", always_2d=True)
    pcm = np.mean(pcm, axis=1, dtype=np.float32)
    if sample_rate != SAMPLE_RATE:
        pcm = librosa.resample(pcm, orig_sr=sample_rate, target_sr=SAMPLE_RATE, res_type="soxr_hq").astype(np.float32)
    if not np.isfinite(pcm).all():
        raise ValueError("Decoded audio contains nonfinite samples")
    duration = len(pcm) / SAMPLE_RATE
    # The official Basic Pitch pipeline reads this same normalized input.
    normalized = destination / "normalized.wav"
    sf.write(normalized, pcm, SAMPLE_RATE, subtype="FLOAT")
    pcm.astype("<f4").tofile(destination / "normalized.f32")
    report = {"source": str(path), "hash": digest, "duration": duration, "sampleRate": SAMPLE_RATE,
              "decodeSeconds": perf_counter() - started, "models": {}, "hardware": platform.platform()}
    warnings, versions, notes = [], {"features": "whole-track-dsp-1", "harmony": "chroma-templates-1"}, []
    print(f"{path.name}: Basic Pitch", flush=True)
    try:
        notes, versions["transcription"], report["models"]["transcription"] = transcribe(normalized, duration, destination / "basic-pitch.npz")
        warnings.append("Note confidence is mean model activation, not a calibrated probability.")
    except Exception as error:
        if args.strict:
            raise
        warnings.append(f"Basic Pitch unavailable; no note events: {type(error).__name__}: {error}")
        report["models"]["transcription"] = {"error": str(error)}
    print(f"{path.name}: Beat This {args.beat_model}", flush=True)
    try:
        rhythm, versions["beatTracking"], report["models"]["rhythm"] = track_beats(pcm, SAMPLE_RATE, duration, args.beat_model, destination / f"beat-this-{args.beat_model}.npz")
    except Exception as error:
        if args.strict:
            raise
        _, beat_frames = librosa.beat.beat_track(y=pcm, sr=SAMPLE_RATE, hop_length=512)
        times = librosa.frames_to_time(beat_frames, sr=SAMPLE_RATE, hop_length=512)
        intervals = np.diff(times)
        rhythm = {"bpm": float(60 / np.median(intervals)) if len(intervals) else None,
                  "beats": [{"time": float(time), "confidence": .25} for time in times if time < duration], "downbeats": []}
        versions["beatTracking"] = "librosa-0.11-dsp-fallback"
        warnings.append(f"Beat This unavailable; DSP beats without downbeats: {type(error).__name__}: {error}")
        report["models"]["rhythm"] = {"error": str(error)}
    if args.compare_beats:
        other = "final0" if args.beat_model == "small0" else "small0"
        print(f"{path.name}: comparison Beat This {other}", flush=True)
        try:
            comparison, model_version, model_report = track_beats(pcm, SAMPLE_RATE, duration, other, destination / f"beat-this-{other}.npz")
            report["models"][f"rhythm-{other}"] = model_report
            write_json(destination / f"rhythm-{other}.json", {"modelVersion": model_version, **comparison})
        except Exception as error:
            report["models"][f"rhythm-{other}"] = {"error": str(error)}
            if args.strict:
                raise
    dynamics = features(pcm)
    if notes:
        chroma = chroma_from_notes(notes, duration)
    else:
        spectral = librosa.feature.chroma_stft(y=pcm, sr=SAMPLE_RATE, n_fft=2048, hop_length=4410, norm=1)
        chroma = [{"time": i * .2, "values": (values / max(1e-12, values.sum())).tolist()} for i, values in enumerate(spectral.T) if i * .2 < duration]
        versions["harmony"] = "librosa-chroma-fallback-1"
    chords = estimate_chords(chroma, duration)
    print(f"{path.name}: structure ({args.structure})", flush=True)
    try:
        if args.structure == "dsp":
            raise ImportError("DSP structure explicitly selected")
        structure_started = perf_counter()
        prepared_structure = None
        if not args.allinone_json and (args.structure_backend == "infer" or
                (args.structure_backend == "auto" and find_spec("allin1_infer") is not None)):
            # Preserve the original stereo decode for All-In-One's internal
            # separation while the final MusicAnalysis keeps the source MP3 hash.
            source_stereo, source_rate = sf.read(path, dtype="float32", always_2d=True)
            prepared_structure = destination / "structure-input.wav"
            sf.write(prepared_structure, source_stereo, source_rate, subtype="FLOAT")
            del source_stereo
        sections, versions["structure"] = analyze_sections(path, duration, args.allinone_json,
            backend=args.structure_backend, prepared_audio=prepared_structure, output_directory=destination / "allinone")
        report["models"]["structure"] = {"modelVersion": versions["structure"],
            "elapsedSeconds": perf_counter() - structure_started, "sourceHash": digest,
            "preparedInput": str(prepared_structure) if prepared_structure else None}
        warnings.append("All-In-One does not provide segment confidence; 0.5 is an uncalibrated placeholder.")
    except Exception as error:
        if args.structure == "allinone" or args.strict:
            raise
        sections = segment_sections(chroma, dynamics, notes, duration)
        versions["structure"] = "novelty-1"
        warnings.append(f"Structure uses DSP novelty, not All-In-One: {type(error).__name__}: {error}")
        report["models"]["structure"] = {"fallback": True, "reason": str(error)}
    complete = bool(notes and rhythm["beats"] and rhythm["downbeats"] and versions["structure"].startswith("allin"))
    analysis = validate_analysis({"version": VERSION, "track": {"hash": digest, "duration": duration, "analysisSampleRate": SAMPLE_RATE},
        "rhythm": rhythm, "notes": notes, "harmony": {"chromaFrames": chroma, "chords": chords}, "dynamics": dynamics,
        "structure": {"segments": sections}, "modelVersions": versions,
        "quality": "FULL" if complete else "PARTIAL" if notes or rhythm["beats"] else "BASIC", "warnings": warnings})
    write_json(destination / "song.analysis.json", analysis)
    report.update({"totalSeconds": perf_counter() - started, "processPeakWorkingSetBytes": peak_memory_bytes(),
                   "quality": analysis["quality"], "notes": len(notes), "beats": len(rhythm["beats"]),
                   "downbeats": len(rhythm["downbeats"]), "sections": len(sections), "warnings": warnings})
    write_json(destination / "report.json", report)
    print(f"Saved {destination / 'song.analysis.json'} ({analysis['quality']}, {len(notes)} notes)", flush=True)
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("audio", nargs="+", type=Path)
    parser.add_argument("--output", type=Path, default=Path("research/results/generated"))
    parser.add_argument("--beat-model", choices=["small0", "final0"], default="small0")
    parser.add_argument("--compare-beats", action="store_true")
    parser.add_argument("--structure", choices=["auto", "allinone", "dsp"], default="auto")
    parser.add_argument("--structure-backend", choices=["auto", "infer", "legacy"], default="auto",
                        help="Prefer modern all-in-one-infer when available; legacy explicitly uses allin1")
    parser.add_argument("--allinone-json", type=Path)
    parser.add_argument("--strict", action="store_true", help="Require all three official models; never pass a milestone with fallback output")
    args = parser.parse_args()
    if args.allinone_json and len(args.audio) != 1:
        parser.error("--allinone-json accepts exactly one audio file")
    args.output = args.output.resolve()
    reports, failures = [], []
    for path in args.audio:
        try:
            reports.append(analyze(path.resolve(), args))
        except Exception as error:
            failures.append({"source": str(path), "error": f"{type(error).__name__}: {error}"})
            print(f"FAILED {path}: {type(error).__name__}: {error}", file=sys.stderr, flush=True)
    args.output.mkdir(parents=True, exist_ok=True)
    write_json(args.output / "batch-report.json", {"tracks": reports, "failures": failures, "strict": args.strict})
    if failures:
        sys.exit(1)


if __name__ == "__main__":
    main()
