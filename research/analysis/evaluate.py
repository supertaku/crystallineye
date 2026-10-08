"""Compare actual model outputs with the original synthetic compositions' known events."""
import argparse
import json
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import mir_eval
import numpy as np


def times(events):
    return np.array([event["time"] for event in events], dtype=float)


def note_arrays(notes):
    return np.array([[note["start"], note["end"]] for note in notes], dtype=float).reshape((-1, 2)), np.array([440 * 2 ** ((note["midi"] - 69) / 12) for note in notes])


def boundary_f1(reference, estimate, tolerance=3):
    reference, estimate = reference[1:], estimate[1:]
    matches = mir_eval.util.match_events(reference, estimate, tolerance)
    precision = len(matches) / len(estimate) if len(estimate) else 0.
    recall = len(matches) / len(reference) if len(reference) else 0.
    return 2 * precision * recall / (precision + recall) if precision + recall else 0.


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--results", type=Path, default=Path("research/results/generated"))
    parser.add_argument("--truth", type=Path, default=Path("research/fixtures/generated"))
    args = parser.parse_args()
    rows = []
    for path in sorted(args.results.glob("*/song.analysis.json")):
        analysis = json.loads(path.read_text())
        report = json.loads(path.with_name("report.json").read_text())
        name = Path(report["source"]).stem
        truth_path = args.truth / f"{name}.ground-truth.json"
        if not truth_path.exists():
            continue
        truth = json.loads(truth_path.read_text())
        if analysis["track"]["hash"] != truth["track"]["hash"]:
            raise ValueError(f"Ground truth hash differs for {name}")
        reference_intervals, reference_pitch = note_arrays(truth["notes"])
        intervals, pitch = note_arrays(analysis["notes"])
        precision, recall, note_f1, _ = mir_eval.transcription.precision_recall_f1_overlap(reference_intervals, reference_pitch, intervals, pitch, onset_tolerance=.07, pitch_tolerance=50, offset_ratio=None)
        row = {"track": name, "quality": analysis["quality"], "notePrecision": float(precision), "noteRecall": float(recall), "noteOnsetPitchF1": float(note_f1),
               "sectionBoundaryF1At3s": boundary_f1(np.array([s["start"] for s in truth["structure"]["segments"]]), np.array([s["start"] for s in analysis["structure"]["segments"]])),
               "models": {}, "processPeakWorkingSetBytes": report["processPeakWorkingSetBytes"]}
        for model in ("small0", "final0"):
            rhythm = analysis["rhythm"] if analysis["modelVersions"]["beatTracking"].endswith(model) else json.loads(path.with_name(f"rhythm-{model}.json").read_text())
            model_report = report["models"].get("rhythm" if analysis["modelVersions"]["beatTracking"].endswith(model) else f"rhythm-{model}", {})
            row["models"][model] = {"beatF1At70ms": float(mir_eval.beat.f_measure(times(truth["rhythm"]["beats"]), times(rhythm["beats"]), f_measure_threshold=.07)),
                "downbeatF1At70ms": float(mir_eval.beat.f_measure(times(truth["rhythm"]["downbeats"]), times(rhythm["downbeats"]), f_measure_threshold=.07)),
                "bpm": rhythm["bpm"], "inferenceSeconds": model_report.get("inferenceSeconds"), "loadSeconds": model_report.get("loadSeconds"), "modelBytes": model_report.get("modelBytes")}
        rows.append(row)
        figure, axes = plt.subplots(3, 1, figsize=(12, 7), sharex=True)
        for label, notes, alpha, color in [("Known notes", truth["notes"], .35, "#888888"), ("Basic Pitch", analysis["notes"], .8, "#30748a")]:
            for i, note in enumerate(notes):
                axes[0].plot([note["start"], note["end"]], [note["midi"]] * 2, color=color, alpha=alpha, linewidth=2, label=label if i == 0 else None)
        axes[0].set_ylabel("MIDI pitch"); axes[0].legend(loc="upper right")
        axes[1].eventplot([times(truth["rhythm"]["beats"]), times(analysis["rhythm"]["beats"]), times(analysis["rhythm"]["downbeats"])], colors=["#777777", "#30748a", "#be8152"], lineoffsets=[2, 1, 0])
        axes[1].set_yticks([0, 1, 2], ["Model bars", "Model beats", "Known beats"])
        axes[2].plot([f["time"] for f in analysis["dynamics"]], [f["energy"] for f in analysis["dynamics"]], color="#30748a")
        for section in analysis["structure"]["segments"][1:]:
            axes[2].axvline(section["start"], color="#be8152")
        axes[2].set_ylabel("Energy"); axes[2].set_xlabel("Song time (seconds)")
        figure.suptitle(f"{name} — actual model output, {analysis['quality']}; synthetic arrangement")
        figure.tight_layout(); figure.savefig(path.with_name("timeline.png"), dpi=150); plt.close(figure)
    summary = {"dataset": "Original 32-second synthetic arrangements; not a real-music quality benchmark", "noteMatch": "Same pitch within 50 cents and onset within 70 ms; offsets ignored", "tracks": rows}
    (args.results / "evaluation.json").write_text(json.dumps(summary, indent=2, allow_nan=False))
    for row in rows:
        print(f"{row['track']}: note F1 {row['noteOnsetPitchF1']:.3f}; beat F1 small={row['models']['small0']['beatF1At70ms']:.3f} final={row['models']['final0']['beatF1At70ms']:.3f}")


if __name__ == "__main__":
    main()
