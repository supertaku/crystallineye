"""MusicAnalysis mirror of src/analysis/analysis-schema.ts (no drawing instructions)."""
from __future__ import annotations

import math
import re
from typing import TypedDict, Literal, NotRequired

VERSION = "analysis-v3.1"
SAMPLE_RATE = 22050


class BeatEvent(TypedDict):
    time: float
    confidence: float


class DownbeatEvent(BeatEvent):
    inferred: NotRequired[bool]


class NoteEvent(TypedDict):
    start: float
    end: float
    midi: int
    amplitude: float
    confidence: float
    pitchBends: NotRequired[list[float]]


class ChromaFrame(TypedDict):
    time: float
    values: list[float]


class ChordEvent(TypedDict):
    start: float
    end: float
    root: int
    quality: Literal["major", "minor", "unknown"]
    confidence: float


class FeatureFrame(TypedDict):
    time: float
    rms: float
    energy: float
    bass: float
    brightness: float
    onset: float


class SectionEvent(TypedDict):
    start: float
    end: float
    label: str
    confidence: float


class Track(TypedDict):
    hash: str
    duration: float
    analysisSampleRate: Literal[22050]


class Rhythm(TypedDict):
    bpm: float | None
    beats: list[BeatEvent]
    downbeats: list[DownbeatEvent]
    meter: NotRequired[int]


class Harmony(TypedDict):
    chromaFrames: list[ChromaFrame]
    chords: list[ChordEvent]


class Structure(TypedDict):
    segments: list[SectionEvent]


class ModelVersions(TypedDict, total=False):
    transcription: str
    beatTracking: str
    structure: str
    features: str
    harmony: str


class MusicAnalysis(TypedDict):
    version: str
    track: Track
    rhythm: Rhythm
    notes: list[NoteEvent]
    harmony: Harmony
    dynamics: list[FeatureFrame]
    structure: Structure
    modelVersions: ModelVersions
    quality: Literal["FULL", "PARTIAL", "BASIC"]
    warnings: list[str]


def validate_analysis(data: dict) -> MusicAnalysis:
    def number(value, low, high):
        if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value) or not low <= value <= high:
            raise ValueError(f"Invalid analysis number: {value!r}")

    if data["version"] != VERSION or data["track"]["analysisSampleRate"] != SAMPLE_RATE:
        raise ValueError("Incompatible music-analysis version or sample rate")
    if not re.fullmatch(r"[a-f0-9]{64}", data["track"]["hash"]):
        raise ValueError("Invalid audio hash")
    duration = data["track"]["duration"]
    number(duration, .001, 360)
    rhythm = data["rhythm"]
    if rhythm["bpm"] is not None:
        number(rhythm["bpm"], 20, 400)
    if "meter" in rhythm:
        number(rhythm["meter"], 2, 12)

    def events(items, interval=False, maximum=50000):
        if not isinstance(items, list) or len(items) > maximum:
            raise ValueError("Invalid event list")
        previous = -1
        for event in items:
            time = event["start" if interval else "time"]
            number(time, 0, duration)
            if time < previous:
                raise ValueError("Unsorted event list")
            previous = time
            if interval:
                number(event["end"], time, duration)
                if event["end"] <= time:
                    raise ValueError("Empty event interval")
            yield event

    for key in ("beats", "downbeats"):
        for event in events(rhythm[key], maximum=5000):
            number(event["confidence"], 0, 1)
            if "inferred" in event and not isinstance(event["inferred"], bool):
                raise ValueError("Invalid inferred flag")
    for note in events(data["notes"], True):
        number(note["midi"], 0, 127)
        if int(note["midi"]) != note["midi"]:
            raise ValueError("Noninteger MIDI pitch")
        number(note["amplitude"], 0, 1)
        number(note["confidence"], 0, 1)
        bends = note.get("pitchBends", [])
        if len(bends) > 10000:
            raise ValueError("Too many pitch bends")
        for bend in bends:
            number(bend, -128, 128)
    for frame in events(data["harmony"]["chromaFrames"]):
        if len(frame["values"]) != 12:
            raise ValueError("Chroma must have 12 pitch classes")
        for value in frame["values"]:
            number(value, 0, 1)
    for chord in events(data["harmony"]["chords"], True):
        number(chord["root"], 0, 11)
        if int(chord["root"]) != chord["root"] or chord["quality"] not in ("major", "minor", "unknown"):
            raise ValueError("Invalid chord")
        number(chord["confidence"], 0, 1)
    for frame in events(data["dynamics"]):
        number(frame["rms"], 0, 8)
        for key in ("energy", "bass", "brightness", "onset"):
            number(frame[key], 0, 1)
    end = 0
    for section in events(data["structure"]["segments"], True, 100):
        if abs(section["start"] - end) > .001 or not isinstance(section["label"], str) or len(section["label"]) > 80:
            raise ValueError("Invalid section coverage")
        number(section["confidence"], 0, 1)
        end = section["end"]
    if abs(end - duration) > .001:
        raise ValueError("Sections must cover the track")
    if data["quality"] not in ("FULL", "PARTIAL", "BASIC"):
        raise ValueError("Invalid quality tier")
    if len(data["warnings"]) > 50 or any(not isinstance(warning, str) or len(warning) > 1000 for warning in data["warnings"]):
        raise ValueError("Invalid warnings")
    for key, version in data["modelVersions"].items():
        if key not in ModelVersions.__annotations__ or not isinstance(version, str) or len(version) > 160:
            raise ValueError("Invalid model version")
    return data
