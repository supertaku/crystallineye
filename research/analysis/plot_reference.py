"""Plot saved, local model predictions. No inference, uploads or human annotations."""
from __future__ import annotations

import argparse
import json
import subprocess
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
from matplotlib.collections import LineCollection


def read_json(path):
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path, data):
    path.write_text(json.dumps(data, indent=2, allow_nan=False) + "\n", encoding="utf-8")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("analysis", type=Path)
    parser.add_argument("--full-analysis", type=Path)
    parser.add_argument("--output", type=Path, default=Path(".build-tools/true-colors-diagnostics"))
    args = parser.parse_args()
    data = read_json(args.analysis)
    full = read_json(args.full_analysis) if args.full_analysis else data
    if full["track"]["hash"] != data["track"]["hash"]:
        raise ValueError("Plot variants must share the original audio hash")
    args.output.mkdir(parents=True, exist_ok=True)
    pcm = np.fromfile(args.analysis.parent / "normalized.f32", dtype="<f4")
    rate, duration = data["track"]["analysisSampleRate"], data["track"]["duration"]
    # Invoke the actual current TypeScript extractor, not a second Python implementation.
    expression = "import fs from 'node:fs'; import { extractMelody } from './src/analysis/melody-extractor.ts'; const a=JSON.parse(fs.readFileSync(process.argv[1],'utf8')); console.log(JSON.stringify(extractMelody(a.notes)));"
    result = subprocess.run([str(Path("node_modules/.bin/tsx.cmd").resolve()), "-e", expression, str(args.analysis.resolve())],
        check=True, capture_output=True, text=True)
    melody = json.loads(result.stdout)
    comparison_path = args.analysis.parent / "rhythm-final0.json"
    final = read_json(comparison_path) if comparison_path.exists() else None
    write_json(args.output / "basic-pitch-results.json", {"sourceHash": data["track"]["hash"],
        "modelVersion": data["modelVersions"]["transcription"], "notes": data["notes"], "selectedContour": melody,
        "meaning": "Model predictions and artistic contour, not singer annotations"})
    write_json(args.output / "manual-annotations.json", {"sourceHash": data["track"]["hash"], "annotations": [],
        "status": "Awaiting human listening review; no observations recorded"})
    windows = [("full-timeline", 0, duration), ("opening-model-notes", 0, 30),
               ("predicted-transition-89", 82, 102), ("predicted-transition-141", 134, 154),
               ("predicted-outro", 214, 240)]
    for name, start, end in windows:
        fig, axes = plt.subplots(5, 1, figsize=(16, 10), sharex=True, gridspec_kw={"height_ratios": [1, 2, 1, 1.2, 1]})
        first, last = max(0, round(start * rate)), min(len(pcm), round(end * rate))
        stride = max(1, (last - first) // 6000)
        indices = np.arange(first, last, stride)
        axes[0].plot(indices / rate, pcm[indices], color="#bdc7d1", linewidth=.35, label="Decoded mono waveform")
        frames = [frame for frame in data["dynamics"] if start <= frame["time"] <= end]
        axes[0].plot([f["time"] for f in frames], [f["rms"] for f in frames], color="#086a87", linewidth=1, label="RMS")
        axes[0].set_ylabel("PCM / RMS"); axes[0].legend(loc="upper right", fontsize=7)
        for notes, color, width in [(data["notes"], "#97a6b4", .8), (melody, "#a13720", 2)]:
            lines = [[(n["start"], n["midi"]), (n["end"], n["midi"])] for n in notes if n["end"] >= start and n["start"] <= end]
            axes[1].add_collection(LineCollection(lines, colors=color, linewidths=width))
        axes[1].set_ylim(25, 94); axes[1].set_ylabel("MIDI pitch\nGrey: model; red: selected")
        for rhythm, y, label in [(data["rhythm"], 1, "small0"), (final, 0, "final0")]:
            if rhythm:
                times = [b["time"] for b in rhythm["beats"] if start <= b["time"] <= end]
                downs = [b["time"] for b in rhythm["downbeats"] if start <= b["time"] <= end]
                axes[2].scatter(times, [y] * len(times), marker="|", color="#086a87", s=35)
                axes[2].scatter(downs, [y] * len(downs), marker="o", color="#a13720", s=9)
                axes[2].text(start, y + .12, label, fontsize=8)
        axes[2].set_ylim(-.4, 1.5); axes[2].set_ylabel("Beat | / downbeat o"); axes[2].set_yticks([])
        chroma = np.array([frame["values"] for frame in data["harmony"]["chromaFrames"]]).T
        axes[3].imshow(chroma, origin="lower", aspect="auto", extent=[0, duration, -.5, 11.5], cmap="cividis", vmin=0, vmax=1)
        axes[3].set_ylabel("Pitch class chroma"); axes[3].set_yticks(range(12), ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"], fontsize=6)
        for structure, y, label in [(data["structure"]["segments"], 1, "DSP"), (full["structure"]["segments"], 0, "AIO prediction")]:
            for i, section in enumerate(structure):
                if section["end"] < start or section["start"] > end:
                    continue
                left, right = max(start, section["start"]), min(end, section["end"])
                axes[4].broken_barh([(left, right - left)], (y - .35, .7), facecolors=plt.get_cmap("tab20")(i % 20))
                if right - left > (end - start) * .035:
                    axes[4].text((left + right) / 2, y, section["label"], fontsize=6, ha="center", va="center")
            axes[4].text(start, y + .4, label, fontsize=7)
        axes[4].set_ylim(-.6, 1.7); axes[4].set_yticks([]); axes[4].set_ylabel("Sections"); axes[4].set_xlabel("Decoded song time (seconds)")
        axes[-1].set_xlim(start, end)
        for axis in axes:
            axis.grid(axis="x", color="#dddddd", alpha=.5, linewidth=.4)
        fig.suptitle(f"True Colors: saved model predictions, not human annotations | {start:.2f}–{end:.2f} s", fontsize=12)
        fig.tight_layout(rect=(0, 0, 1, .97)); fig.savefig(args.output / f"{name}.png", dpi=140); plt.close(fig)
    write_json(args.output / "plot-manifest.json", {"sourceHash": data["track"]["hash"], "sourceAnalysis": str(args.analysis.resolve()),
        "fullAnalysis": str(args.full_analysis.resolve()) if args.full_analysis else None, "plots": [f"{name}.png" for name, _, _ in windows],
        "notes": "All evidence is saved predictions or measured waveform; no human listening observations."})
    print(args.output.resolve())


if __name__ == "__main__":
    main()
