"""Fingerprint a local track and check the waveform without exporting its audio."""
from __future__ import annotations

import argparse
import hashlib
import json
import platform
from pathlib import Path

import librosa
import numpy as np
import soundfile as sf


def mp3_frames(path: Path):
    """Read MPEG-1 Layer III frame headers; never infer bitrate from file size."""
    data = path.read_bytes()
    offset = 0
    if data[:3] == b"ID3":
        offset = 10 + sum((data[6 + i] & 127) << (7 * (3 - i)) for i in range(4))
        if data[5] & 16:
            offset += 10
    rates = [44100, 48000, 32000]
    bitrates = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320]
    counts, frames, invalid, first = {}, 0, 0, None
    while offset + 4 <= len(data):
        header = int.from_bytes(data[offset:offset + 4], "big")
        version, layer = (header >> 19) & 3, (header >> 17) & 3
        rate_index, bitrate_index = (header >> 10) & 3, (header >> 12) & 15
        if header >> 21 != 2047 or version != 3 or layer != 1 or rate_index == 3 or bitrate_index in (0, 15):
            # ID3v1/APEv2 trailing tags are metadata, not corrupt MPEG frames.
            if data[offset:offset + 3] == b"TAG" or data[offset:offset + 8] == b"APETAGEX":
                break
            invalid += 1
            offset += 1
            continue
        rate, bitrate = rates[rate_index], bitrates[bitrate_index]
        length = 144000 * bitrate // rate + ((header >> 9) & 1)
        if offset + length > len(data):
            return {"error": "Truncated MPEG frame", "byteOffset": offset, "verifiedFrames": frames}
        if first is None:
            first = {"mpegVersion": "MPEG-1", "layer": "III", "sampleRate": rate,
                     "channelMode": ["stereo", "joint stereo", "dual channel", "mono"][(header >> 6) & 3]}
        counts[str(bitrate)] = counts.get(str(bitrate), 0) + 1
        frames += 1
        offset += length
    return {**(first or {}), "verifiedFrames": frames, "bitrateKbpsFrameCounts": counts,
            "nonFrameBytesSkipped": invalid, "trailingBytes": len(data) - offset,
            "bitrateMode": "CBR" if len(counts) == 1 else "VBR"}


def rms(x):
    return float(np.sqrt(np.mean(np.square(x, dtype=np.float64))))


def silence_summary(samples, rate):
    size = max(1, round(rate * .1))
    quiet = [rms(samples[start:start + size]) < 1e-5 for start in range(0, len(samples), size)]
    leading = next((i for i, value in enumerate(quiet) if not value), len(quiet)) * .1
    trailing = next((i for i, value in enumerate(reversed(quiet)) if not value), len(quiet)) * .1
    return {"windowSeconds": .1, "rmsThreshold": 1e-5, "silentWindowFraction": sum(quiet) / len(quiet),
            "leadingSilenceSeconds": leading, "trailingSilenceSeconds": trailing}


def inspect(path: Path, destination: Path):
    with path.open("rb") as source:
        digest = hashlib.file_digest(source, "sha256").hexdigest()
    info = sf.info(path)
    stereo, rate = sf.read(path, dtype="float32", always_2d=True)
    if not np.isfinite(stereo).all() or not len(stereo):
        raise ValueError("Empty or nonfinite decoded audio")
    mono = np.mean(stereo, axis=1, dtype=np.float32)
    normalized = librosa.resample(mono, orig_sr=rate, target_sr=22050, res_type="soxr_hq").astype(np.float32)
    channel_rms = [rms(stereo[:, channel]) for channel in range(stereo.shape[1])]
    mean_channel_power = sum(value ** 2 for value in channel_rms) / len(channel_rms)
    mono_rms = rms(mono)
    result = {"source": str(path.resolve()), "filename": path.name, "sha256": digest, "fileBytes": path.stat().st_size,
              "container": info.format, "codec": info.subtype, "decoder": f"soundfile {sf.__version__} / libsndfile {sf.__libsndfile_version__}",
              "sampleRate": rate, "channels": stereo.shape[1], "headerFrames": info.frames, "decodedFrames": len(stereo),
              "headerDurationSeconds": info.duration, "decodedDurationSeconds": len(stereo) / rate,
              "normalizedSampleRate": 22050, "normalizedFrames": len(normalized), "normalizedDurationSeconds": len(normalized) / 22050,
              "channelRms": channel_rms, "monoRms": mono_rms, "normalizedRms": rms(normalized),
              "monoPowerToMeanChannelPowerDb": float(10 * np.log10(mono_rms ** 2 / mean_channel_power)),
              "decodedPeakAbsolute": float(np.max(np.abs(stereo))), "normalizedPeakAbsolute": float(np.max(np.abs(normalized))),
              "decodedSamplesAtOrAboveFullScale": int(np.sum(np.abs(stereo) >= 1)),
              "normalizedSamplesAtOrAboveFullScale": int(np.sum(np.abs(normalized) >= 1)),
              "finiteSamples": True, "silence": silence_summary(mono, rate), "normalizedSilence": silence_summary(normalized, 22050),
              "hardware": platform.platform()}
    if stereo.shape[1] == 2:
        result["stereoCorrelation"] = float(np.corrcoef(stereo[:, 0], stereo[:, 1])[0, 1])
        # This catches a gross channel shift; it is not a microphone alignment estimate.
        decimated = stereo[::4]
        correlations = []
        for lag in range(-8, 9):
            left = decimated[max(0, lag):len(decimated) + min(0, lag), 0]
            right = decimated[max(0, -lag):len(decimated) - max(0, lag), 1]
            correlations.append(float(np.dot(left, right) / max(1e-12, np.linalg.norm(left) * np.linalg.norm(right))))
        result["bestStereoCorrelationLagSamples"] = (int(np.argmax(correlations)) - 8) * 4
        result["alignmentSearchRangeSamples"] = [-32, 32]
    if path.suffix.lower() == ".mp3":
        result["mpegHeaders"] = mp3_frames(path)
    destination.mkdir(parents=True, exist_ok=True)
    (destination / "track-metadata.json").write_text(json.dumps(result, indent=2, allow_nan=False) + "\n", encoding="utf-8")
    print(json.dumps(result, indent=2, allow_nan=False))
    return result


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("audio", type=Path)
    parser.add_argument("--output", type=Path, default=Path("research/results/true-colors"))
    args = parser.parse_args()
    inspect(args.audio, args.output)
