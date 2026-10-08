# V3.2 Part 1 validation

Checked on 2026-10-08, Asia/Manila, on branch `codex/v3.2-melody-driven-paint-mobile-ml`, starting from `b232a4a318300caaf4a7142544ef0e8fac74a595`. Changes remain uncommitted and unpushed. The pre-existing journal edits were preserved.

## Delivered behavior

Default composition now uses adaptive musical phrases, duration-directed horizontal movement, confidence-weighted incoming pitch movement and deterministic occupancy-aware placement. Every positive selected-note gap lifts contact. Renderer-only section slices retain phrase identity and shared geometry/pressure. Beats still make local pressure accents; harmony still controls the existing pigment rules. V2 and the exact V3.1 oscillator composer remain selectable.

`analysis-v3.1` is unchanged; `paint-composer-3.2` invalidates only visual scores. DEV adds a precomputed note/control/tip overlay and controlled painting A–D: actual DSP with legacy trajectory, exact reference with legacy trajectory, identical reference with new trajectory, and new trajectory with only note evidence removed. The original clock A–D experiments remain separate.

See [trajectory implementation](V3_2_MELODY_TRAJECTORY.md), [source and controlled comparison](V3_2_REFERENCE_BASELINE.md), [Android/performance evidence](V3_2_ANDROID_PERFORMANCE.md), and the [saved implementation request](V3_2_IMPLEMENTATION_PLAN.txt).

## Automated and artifact evidence

| Check | Current evidence |
| --- | --- |
| Initial unchanged baseline | Lint/typecheck passed; 87/87 tests |
| Integrated final source | Lint and TypeScript passed; **123/123 tests passed**, zero skipped; Android/Hermes export passed, 4.6 MB bytecode |
| Reference validation | 6 Python JSON references verified, exact normalized PCM feature/timestamp parity, deterministic composition and seek |
| Synthetic desktop Skia | 10 timeline frames + 5 special captures passed |
| FULL desktop Skia | 19 timeline frames + 5 special captures passed |
| Final saved-C desktop Skia | 26 timeline frames + 5 special captures passed |
| Exact-source controlled comparison | Passed; frozen B byte-identical; 28 matched PNGs at 7 positions |
| Current Expo doctor | 21/21 passed after scoped network retry |
| Android native debug build | Passed, 5m50s, 753 tasks; native client unchanged |
| Android emulator smoke | Passed exact-source import/reference, cached A–D, retained paused position, overlay, paused pixels and pause/backseek/resume |
| Desktop JS benchmark | Passed; separate current report, no physical-device inference |

The desktop renderer checked shader compilation, paused/seek PNG byte identity, visible solid-color fallback, deterministic reduced motion, shader-independent simple diagnostic, local accent pixel difference and retained visible paint at section boundaries. Intro 0.77 seconds has no prior visible paint and is correctly classified as an initial onset. Scene edges at 45.29, 57.38 and 73.21 seconds retain paint on both sides.

Final integrated checks include the actual native-duration regression and active-mode provenance footer. Logs: [lint](../.build-tools/v32-final-lint.log), [TypeScript](../.build-tools/v32-final-typecheck.log), [tests](../.build-tools/v32-final-tests.log), [Android export](../.build-tools/v32-final-export.log), [reference](../.build-tools/v32-final-reference.log), [synthetic paint](../.build-tools/v32-final-synthetic-paint.log), [FULL paint](../.build-tools/v32-final-full-paint.log), [controlled comparison](../.build-tools/v32-comparison-final.log), [saved-C paint](../.build-tools/v32-paint-validation-final.log). Final Hermes bundle is `entry-87c07c92636618695a6dd7e0c15e350b.hbc` in ignored `.build-tools/v32-export/`.

Final C has **25 phrases, 180 strokes and 2,532 timed points**. Actual phrase horizontal spans are **0.234615–0.86**, median **0.500439**, with none collapsed. All **614 selected note onsets/offsets** and **25 phrase envelopes** have zero associated-knot error. Contact is **221.184871 seconds**, equal to selected-note union with rounding error about `2.6e-13`, and no deposition inside selected internal gaps. Connected position gaps are zero; internal/connected velocity differences are about `1.26e-12`/`7.96e-15`.

Frozen B serialization SHA-256 is `149feb8833f43cfdf44ce9066ce43a7984625fdca01e582ac2b63dc0a10aed80`; final C is `bd8cf63c24a99e0d4dcbe3e7f949708c9672305d745c13b82d5b950a143a8360`. B/C palettes match, with zero pigment mismatches at 564 eligible common exact note onsets. C brush-grid coverage is 37.33% versus B19.53%; incoming-note motion correlation is .880489, with 224/224 non-flat directions agreeing and 317 flat pairs. The retained onset-to-onset statistic is lagged and negative for C; the baseline report explains the contract and measurement limits. Neither correlation nor coverage proves artistic quality or correct singer transcription.

## Native smoke

The isolated emulator imported the real recording using the document picker and produced genuine native DSP, then loaded the exact FULL JSON: 2,076 raw notes, 286 beats, 25 phrases, 180 strokes and 14 scenes. Preparing painting comparisons initially failed visibly because native decode duration differs from desktop by 69.66 ms. Both pulled cache hashes match the exact original source. The native caller now explicitly permits at most 100 ms, matching the existing reference-loader allowance, and preserves measured timestamps/duration with a mode-A warning. Strict desktop comparison stays at 1 ms. Ten comparison tests pass, including rejection of another hash and differences over 100 ms, unchanged reference/timestamps and disclosure.

Fixed preparation succeeded using native DSP cache, with no extra decode after restart. Paused A/B/D/C switches all retained **47.551 seconds**, native clock D and the same Play control. C's diagnostic at that time identifies phrase 7, MIDI52 at47.491–48.235 seconds and the current brush. [Mode-switch evidence](../.build-tools/v32-emulator/mode-switch-evidence.json).

I inspected the matched native [C artwork](../.build-tools/v32-emulator/33-native-C-47s.png), [B artwork](../.build-tools/v32-emulator/34-native-B-47s.png) and [C trajectory overlay](../.build-tools/v32-emulator/36-native-C-trajectory.png). The overlay visibly contains controls, note anchors and the white tip near x27/y400 in the 360×800 view. Paint crop `(0,100,360,614)` is pixel-identical across captures 36/37 while paused. Native playback advanced to about 01:36, then verified capture42 showed the enabled Play control. [Backward seek](../.build-tools/v32-emulator/43-native-backseek.png) moved to 00:19; [resume then pause](../.build-tools/v32-emulator/45-native-resume-paused.png) advanced to 00:25 with Play enabled. UIAutomator timed out while the live trace panel updated; stale XML41 was preserved as a failed capture, not used as a successful state observation.

The saved [native clock trace](../.build-tools/v32-emulator/native-clock-trace.json) retains the latest 1,200 samples, all paused at 25.572408 seconds, clock D/painting C. Position/native position/supplied paint time agree while paused. Its 20.673-second span and 18.37 ms JavaScript frame p95 describe this paused DEV capture; zero error/playing-read summaries do not measure active playback, presented frames or audio alignment.

The [final native smoke summary](../.build-tools/v32-emulator/native-smoke-summary.json) and [runtime log](../.build-tools/v32-emulator/final-runtime-logcat.txt) preserve the results; the final log has zero relevant fatal/JavaScript-error matches. I stopped only identity-verified task Metro/emulator processes (Metro14632, emulator9712/qemu7600). [Cleanup evidence](../.build-tools/v32-emulator/cleanup-summary.json) confirms no owned processes remain and ADB lists no devices. Reports/gallery opening returned queued in the app, which does not establish that their panels were already visible.

The decoder's timestamp origin and audible alignment have not been independently measured. See the Android report for environment and preserved first-import transient. Native runtime appearance/control checks are distinct from desktop rendering and physical-device evidence.

## Review and acceptance

Open the [local matched gallery](../.build-tools/v32-comparison/index.html), [raw report](../.build-tools/v32-comparison/report.json), or [saved-C rendering checks](../.build-tools/v32-comparison/C-validation/report.json). Nearly complete phrase at158.765 seconds: [B](../.build-tools/v32-comparison/B-phrase-end-158.765.png), [C](../.build-tools/v32-comparison/C-phrase-end-158.765.png), [D](../.build-tools/v32-comparison/D-phrase-end-158.765.png).

Developer review found broad note-directed sweeps and a clear reduced-note difference. Some partial gestures remain sharp and graph-like. These are abstract pressure ribbons using the existing pigment shader, not a new fluid watercolor simulation. Listening, user preference and physical audio alignment remain unverified. Candidate passage labels describe saved mixed-recording predictions or measured energy; they do not assert the singers' actual notes or chords.

**The Part 1 artistic checkpoint remains open.** The plan requires evaluation before Part 2 and says, “If the result still looks like a single graph line, refine the gesture grammar before proceeding to Part 2.” I requested the user's judgment on the concrete gallery because some gestures remain graph-like; this is my handling of the unresolved artistic criterion. No TFLite/Nitro dependency, bundled mobile model, Android transcription, Python-to-Android parity, timing correction or mobile ML cache claim has been implemented. Ordinary imports still contain `notes: []`. Continue to the Android feasibility spike once the current style passes that evaluation, or refine its gesture grammar first.

## Reproduce and resume

```powershell
npm run lint
npm run typecheck
npm test
npm run validate:reference
npm run validate:paint -- --output '.build-tools/v32-synthetic-paint'
npm run validate:paint -- '.build-tools/true-colors-allinone/true-colors.analysis.json' --output '.build-tools/v32-full-paint'
npm run compare:v32 -- '.build-tools/true-colors-allinone/true-colors.analysis.json' 'music/Justin Timberlake, Anna Kendrick - True Colors (Lyric).mp3' 'research/results/generated/Justin Timberlake, Anna Kendrick - True Colors (Lyric)-72621718f6e7/normalized.f32' '.build-tools/v32-comparison'
npm run validate:paint -- --score '.build-tools/v32-comparison/C.score.json' --output '.build-tools/v32-comparison/C-validation' --times '.build-tools/v32-comparison/times.json'
npm run benchmark:v3
```

Native build: set command-local `JAVA_HOME` to `C:\Program Files\Android\Android Studio\jbr` and `ANDROID_HOME` to `C:\Users\joshu\AppData\Local\Android\Sdk`, then run `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/build-android.ps1`. Set command-local TEMP/TMP to workspace `.build-tools/export-tmp` for sandbox-compatible Android export. Model/music/reference/PCM/scores/captures/APK remain ignored local artifacts.
