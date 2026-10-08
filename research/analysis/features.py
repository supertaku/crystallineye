"""Deterministic reference features and harmonic summaries at the shared schema rate."""
import math
import numpy as np

SAMPLE_RATE = 22050


def features(pcm):
    frames = []
    previous = np.zeros(1025)
    for offset in range(0, len(pcm), 512):
        samples = pcm[offset:offset + 2048]
        spectrum = np.abs(np.fft.rfft(samples * np.hanning(len(samples)), n=2048)) / len(samples)
        powers = spectrum * spectrum
        frequencies = np.arange(len(spectrum)) * SAMPLE_RATE / 2048
        total = float(powers[1:].sum())
        frames.append({"time": offset / SAMPLE_RATE, "rms": float(np.sqrt(np.mean(samples * samples))), "energy": 0.,
                       "bass": float(powers[(frequencies > 0) & (frequencies < 200)].sum() / total) if total > 1e-12 else 0.,
                       "brightness": min(1., float((powers * frequencies).sum() / total / 5000)) if total > 1e-12 else 0.,
                       "onset": float(np.maximum(0, spectrum[1:] - previous[1:]).sum()) if offset else 0.})
        previous = spectrum
    rms_scale = max(1e-5, sorted(frame["rms"] for frame in frames)[math.floor((len(frames) - 1) * .95)])
    onset_scale = max(1e-5, sorted(frame["onset"] for frame in frames)[math.floor((len(frames) - 1) * .98)])
    for frame in frames:
        frame["energy"] = min(1., frame["rms"] / rms_scale) if frame["rms"] >= 1e-5 else 0.
        frame["onset"] = min(1., frame["onset"] / onset_scale) if frame["rms"] >= 1e-5 else 0.
    return frames


def chroma_from_notes(notes, duration):
    frames, active, index = [], [], 0
    notes = sorted(notes, key=lambda note: note["start"])
    for time in np.arange(0, duration, .2):
        while index < len(notes) and notes[index]["start"] <= time:
            active.append(notes[index])
            index += 1
        active = [note for note in active if note["end"] > time]
        values = np.zeros(12)
        for note in active:
            values[note["midi"] % 12] += note["amplitude"] * note["confidence"]
        if values.sum() > 0:
            values /= values.sum()
        frames.append({"time": float(time), "values": values.tolist()})
    return frames


def estimate_chords(frames, duration):
    chords = []
    for start in np.arange(0, duration, .8):
        end = min(duration, float(start) + .8)
        window = [frame["values"] for frame in frames if start <= frame["time"] < end]
        values = np.sum(window, axis=0) if window else np.zeros(12)
        norm = np.linalg.norm(values)
        candidates = []
        for root in range(12):
            for quality, third in [("major", 4), ("minor", 3)]:
                score = float(values[[root, (root + third) % 12, (root + 7) % 12]].sum() / (norm * math.sqrt(3))) if norm else 0.
                candidates.append((score, root, quality))
        candidates.sort(key=lambda item: item[0], reverse=True)
        best, root, quality = candidates[0]
        confidence = min(1., (best - candidates[1][0]) * 5) if best > .72 else 0.
        if confidence < .12:
            quality = "unknown"
        if chords and chords[-1]["root"] == root and chords[-1]["quality"] == quality:
            last = chords[-1]
            last["confidence"] = min(1., max(0., (last["confidence"] * (last["end"] - last["start"]) + confidence * (end - start)) / (end - last["start"])))
            last["end"] = end
        else:
            chords.append({"start": float(start), "end": end, "root": root, "quality": quality, "confidence": confidence})
    return chords


def segment_sections(chroma, dynamics, notes, duration):
    windows = []
    for start in np.arange(0, duration, 2):
        harmonics = [frame["values"] for frame in chroma if start <= frame["time"] < start + 2]
        features_here = [frame for frame in dynamics if start <= frame["time"] < start + 2]
        values = np.zeros(15)
        if harmonics:
            values[:12] = np.mean(harmonics, axis=0)
        if features_here:
            values[12] = np.mean([frame["energy"] for frame in features_here])
            values[13] = np.mean([frame["brightness"] for frame in features_here])
        values[14] = min(1., sum(start <= note["start"] < start + 2 for note in notes) / 12)
        windows.append(values)

    def similarity(left, right):
        norm = np.linalg.norm(left) * np.linalg.norm(right)
        return float(np.dot(left, right) / norm) if norm > 1e-10 else 1.

    matrix = np.array([[similarity(left, right) for right in windows] for left in windows])
    novelty = np.zeros(len(windows))
    kernel = np.outer([-1, -1, 1, 1], [-1, -1, 1, 1])
    for i in range(2, len(windows) - 2):
        novelty[i] = max(0., float((matrix[i - 2:i + 2, i - 2:i + 2] * kernel).sum() / 8))
    threshold = max(.06, sorted(novelty)[math.floor((len(novelty) - 1) * .8)])
    boundaries = [0.]
    for i in range(4, len(windows) - 2):
        if novelty[i] >= threshold and novelty[i] > novelty[i - 1] and novelty[i] >= novelty[i + 1] and i * 2 - boundaries[-1] >= 8:
            boundaries.append(float(i * 2))
    boundaries.append(duration)
    signatures, sections = [], []
    for index, (start, end) in enumerate(zip(boundaries, boundaries[1:])):
        signature = np.mean([window for i, window in enumerate(windows) if start <= i * 2 < end], axis=0)
        match = next((i for i, prior in enumerate(signatures) if similarity(prior, signature) > .96 and abs(prior[12] - signature[12]) < .15), len(signatures))
        if match == len(signatures):
            signatures.append(signature)
        sections.append({"start": start, "end": end, "label": f"Section {chr(65 + match % 26)}", "confidence": .4 if index == 0 else min(1., float(novelty[round(start / 2)]) * 2)})
    return sections
