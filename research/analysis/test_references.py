"""Synthetic, offline provenance regressions; no copyrighted audio fixtures."""
import json
import tempfile
import unittest
from pathlib import Path

import numpy as np
import soundfile as sf

from allinone_reference import analyze_sections, verify_prepared_audio


class ProvenanceTests(unittest.TestCase):
    def setUp(self):
        # Windows sandbox TEMP can be readable but deny writes inside new folders.
        # Keep every temporary fixture and its automatic cleanup inside this repo.
        workspace = Path(__file__).resolve().parents[2]
        self.temp_root = (workspace / ".build-tools" / "reference-test-tmp").resolve()
        if not self.temp_root.is_relative_to(workspace):
            raise ValueError("Test temporary files must stay inside the workspace")
        self.temp_root.mkdir(parents=True, exist_ok=True)

    def test_imported_result_accepts_identical_bytes_under_a_different_name(self):
        with tempfile.TemporaryDirectory(dir=self.temp_root) as directory:
            root = Path(directory)
            source, renamed = root / "source.wav", root / "renamed.wav"
            source.write_bytes(b"synthetic-source-identity")
            renamed.write_bytes(source.read_bytes())
            result = root / "result.json"
            result.write_text(json.dumps({"path": str(renamed), "segments": [{"start": 0, "end": 1, "label": "intro"}]}))
            segments, _ = analyze_sections(source, 1, imported_json=result)
            self.assertEqual(segments[0]["end"], 1)

    def test_imported_result_rejects_another_recording(self):
        with tempfile.TemporaryDirectory(dir=self.temp_root) as directory:
            root = Path(directory)
            source, other = root / "source.wav", root / "other.wav"
            source.write_bytes(b"one-recording")
            other.write_bytes(b"another-recording")
            result = root / "result.json"
            result.write_text(json.dumps({"path": str(other), "segments": []}))
            with self.assertRaisesRegex(ValueError, "exact analyzed audio"):
                analyze_sections(source, 1, imported_json=result)

    def test_prepared_audio_requires_exact_samples_not_only_matching_metadata(self):
        with tempfile.TemporaryDirectory(dir=self.temp_root) as directory:
            root = Path(directory)
            source, prepared, wrong = (root / name for name in ("source.wav", "prepared.wav", "wrong.wav"))
            pcm = np.column_stack([np.linspace(-.5, .5, 100, dtype=np.float32)] * 2)
            sf.write(source, pcm, 44100, subtype="FLOAT")
            sf.write(prepared, pcm, 44100, subtype="FLOAT")
            sf.write(wrong, -pcm, 44100, subtype="FLOAT")
            verify_prepared_audio(source, prepared)
            with self.assertRaisesRegex(ValueError, "exact original decoded samples"):
                verify_prepared_audio(source, wrong)

    def test_prepared_audio_cannot_drop_a_channel_or_change_rate(self):
        with tempfile.TemporaryDirectory(dir=self.temp_root) as directory:
            root = Path(directory)
            source, prepared = root / "source.wav", root / "prepared.wav"
            sf.write(source, np.ones((100, 2), dtype=np.float32) * .1, 44100, subtype="FLOAT")
            sf.write(prepared, np.ones(100, dtype=np.float32) * .1, 22050, subtype="FLOAT")
            with self.assertRaisesRegex(ValueError, "sample rate and channels"):
                verify_prepared_audio(source, prepared)


if __name__ == "__main__":
    unittest.main()
