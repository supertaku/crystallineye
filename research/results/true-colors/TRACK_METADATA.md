# True Colors source identity and integrity

Checked locally on **2026-10-08, Asia/Manila**. I used the recording already in this workspace. I did not download another performance or upload this audio.

| Field | Verified value |
| --- | --- |
| Filename | `Justin Timberlake, Anna Kendrick - True Colors (Lyric).mp3` |
| Local source | `music/Justin Timberlake, Anna Kendrick - True Colors (Lyric).mp3` |
| Container / codec | MP3 / MPEG-1 Layer III |
| Bitrate | 192 kb/s constant bitrate; all 9,320 MPEG frame headers agree |
| Original sample rate / channels | 44,100 Hz / stereo |
| File size | 5,843,206 bytes |
| SHA-256 of original MP3 | `72621718f6e76530d87400479aed14bf7e1d7bf6ba71f857815db83007d45c92` |
| Decoded frame count / duration | 10,733,568 frames / 243.39156462585035 seconds (4:03.392) |
| Decoder | SoundFile 0.14.0, libsndfile 1.2.2, Python 3.12.14 |
| Model-analysis PCM | 5,366,784 mono samples at 22,050 Hz; same duration |
| Resampling | Arithmetic stereo mean, then librosa 0.11.0 `soxr_hq`; float32 |

FFprobe was not on PATH. I checked metadata with libsndfile and read the MPEG frame headers directly using [inspect_track.py](../../analysis/inspect_track.py). The header scan consumed every MPEG frame without skipped bytes, a partial frame, or trailing bytes. Full decoding produced finite samples and matched the reported frame count. Those checks show no observed corruption or truncation; they do not prove the recording contains the intended complete artistic performance.

The original left/right RMS levels were 0.225652/0.225542. Their correlation was 0.872375, and the best correlation within a ±32-sample alignment check occurred at zero lag. Mono RMS was 0.218280, only **0.286 dB below** mean channel power. This provides no evidence of severe downmix phase cancellation. Normalized RMS was 0.218204.

Original decoded peak was 0.896621, and normalized peak was 0.870866. Neither representation contained samples at or above full scale. With 100 ms windows and an RMS threshold of 0.00001, both had approximately 0.5 seconds of leading silence, 0.3 seconds of trailing silence, and a 0.329% silent-window fraction. Normalization did not introduce measurable silent windows under that check.

For All-In-One-Infer, I created a separate 44,100 Hz stereo FLOAT WAV from the same original decode. Its SHA-256 is `278d1c056125091a9b7625891b06441bdfe093b3112b25336914d005e51a6337`. That is a **prepared-audio hash**, not the track hash. The exported MusicAnalysis retains the original MP3 hash above. The local manifest records both identities. Android's MP3 decoding offset still requires comparison with this desktop decode; these checks do not establish physical audio/visual alignment.

Reproduce the check from the repository root:

```powershell
.\.venv-research\Scripts\python.exe research/analysis/inspect_track.py 'music/Justin Timberlake, Anna Kendrick - True Colors (Lyric).mp3'
```

Raw metadata JSON stays local at `research/results/true-colors/track-metadata.json`. The source MP3, normalized audio, model tensors, inference logs, and derived timelines remain in ignored folders. See [TRUE_COLORS_ANALYSIS.md](../../../docs/TRUE_COLORS_ANALYSIS.md) for actual model results and their limits.
