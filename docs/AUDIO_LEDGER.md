# Audio implementation ledger

## Music provenance and processing

The original one-shot handoff contained only `AUDIO_CURATION.md` and external candidate links, so the initial release used procedural ambient oscillators. On 2026-07-26, the repository owner explicitly approved replacing those ambient beds with twelve WAV files supplied in `Desktop/temp`.

- Source format: stereo 48 kHz, 16-bit PCM WAV.
- Production format: stereo 48 kHz, 192 kbps MP3.
- Processing: FFmpeg/libmp3lame transcode; no trimming, normalization, remixing, or source deletion.
- Source preservation: the Desktop WAV files were left untouched and are not committed.
- Production footprint: 12 files, approximately 36.95 MiB.
- Provenance: user-supplied project assets. The repository owner is responsible for confirming copyright and redistribution rights before public distribution.

| Production file | Supplied filename | Duration | Playback role |
| --- | --- | ---: | --- |
| `audio/music/intro/menu-intro.mp3` | `Intro Music.wav` | 2:56.800 | all title, profile, dashboard, setup, and other pre-game screens |
| `audio/music/gameplay/level-1-a.mp3` | `Level One Background Music A.wav` | 2:48.160 | Questions 1–5 candidate |
| `audio/music/gameplay/level-1-b.mp3` | `Level One Background Music B.wav` | 3:14.400 | Questions 1–5 candidate |
| `audio/music/gameplay/level-2-a.mp3` | `Level Two Background Music A.wav` | 2:39.600 | Questions 6–10 candidate |
| `audio/music/gameplay/level-2-b.mp3` | `Level Two Background Music B.wav` | 2:19.960 | Questions 6–10 candidate |
| `audio/music/gameplay/level-2-c.mp3` | `Level Two Background Music C.wav` | 1:09.000 | Questions 6–10 candidate |
| `audio/music/gameplay/level-3-a.mp3` | `Level Three Background Music A.wav` | 1:54.640 | Questions 11–15 candidate |
| `audio/music/gameplay/level-3-b.mp3` | `Level Three Background Music B.wav` | 3:09.720 | Questions 11–15 candidate |
| `audio/music/pause/pause-a.mp3` | `Pause Music A.wav` | 2:18.720 | Pause/Help candidate |
| `audio/music/pause/pause-b.mp3` | `Pause Music B.wav` | 2:29.760 | Pause/Help candidate |
| `audio/music/outro/outro-a.mp3` | `Outro Music A.wav` | 0:47.920 | completed-run candidate |
| `audio/music/outro/outro-b.mp3` | `Outro Music B.wav` | 1:04.880 | completed-run candidate |

## Music selection and playback

`src/audio/musicCatalog.ts` is the canonical asset catalog. Each new run already has a random unique run ID; hashing that ID with each music-group name selects exactly one track for Questions 1–5, Questions 6–10, Questions 11–15, Pause, and Outro. The result varies between runs but is deterministic for the same run, so refresh/resume never changes the playlist.

`AudioManager` owns one looped media element for each selected track. Scene switches pause rather than reset the outgoing element:

- Opening Pause or in-game Help pauses the current gameplay track and starts the selected pause loop.
- Resuming gameplay continues both the gameplay track and any later pause session from their retained `currentTime`.
- Reaching Questions 6 and 11 switches to the chosen next-level track.
- Completing a run starts the chosen outro and keeps it active through results/review until the player returns to a non-result flow.
- Title, profile, dashboard, setup, global Help, Settings, and Content Manager share the intro loop.
- Starting a different run creates a new stable playlist and fresh positions.

Music volume, music enablement, master mute, and narration ducking apply to the recorded tracks. A first user interaction retries playback when browser autoplay policy blocks the initial menu attempt. The MP3 extension is included in the PWA precache, with a 6 MiB per-file allowance, so every track remains available offline.

## Procedural sound-event ledger

Short effects remain original project Web Audio recipes. They contain no redistributed binary samples and are centralized in `src/audio/soundRegistry.ts`.

All effect rows use these source and processing values:

- Final game filename: **none — synthesized at runtime**.
- Original pack / filename / source page: **not applicable — original project Web Audio recipe**.
- License: **original project code; no third-party binary incorporated**.
- Processing: oscillator layering, short attack/release envelopes, event-specific frequency sequence, optional pitch sweep, channel gain, and rate limiting.

| Logical event | Waveform | Frequencies (Hz) | Duration | Recipe peak gain | Intended playback |
| --- | --- | --- | ---: | ---: | --- |
| press | sine | 420 | 45 ms | 0.045 | quiet interface press |
| back | sine | 360, 260 | 80 ms | 0.040 | navigation back |
| confirm | sine | 440, 660 | 110 ms | 0.055 | ordinary confirmation |
| cancel | triangle | 300, 230 | 100 ms | 0.040 | cancellation |
| panel-open | sine | 240, 420 + upward sweep | 130 ms | 0.035 | panel transition |
| save | sine | 520, 780 | 160 ms | 0.045 | durable-save confirmation |
| profile-create | sine | 392, 523, 659 | 200 ms | 0.050 | profile creation |
| profile-delete | triangle | 330, 247 | 180 ms | 0.045 | destructive profile completion |
| game-intro | sine | 110, 220, 440 + sweep | 380 ms | 0.065 | run opening |
| question-enter | sine | 280, 420 | 140 ms | 0.040 | question arrival registry slot |
| answer-select | sine | 500, 750 | 90 ms | 0.050 | answer selection |
| answer-lock | triangle | 180, 360, 720 + downward sweep | 300 ms | 0.070 | persisted final lock |
| correct | sine | 392, 523, 659 | 340 ms | 0.075 | correct reveal |
| incorrect | triangle | 240, 180, 120 + downward sweep | 380 ms | 0.070 | wrong reveal |
| checkpoint | sine | 392, 523, 659, 784 | 550 ms | 0.075 | Questions 5 and 10 |
| walk-away | sine | 440, 370, 294 | 420 ms | 0.060 | voluntary result |
| victory | sine | 262, 392, 523, 659, 784 + sweep | 900 ms | 0.085 | millionaire result |
| hint | sine | 620, 930 + upward sweep | 200 ms | 0.050 | hint reveal |
| phone-start | sine | 440, 520 | 160 ms | 0.045 | call activation |
| phone-tick | sine | 880 | 35 ms | 0.035 | final five seconds only |
| phone-end | sine | 520, 350 | 160 ms | 0.045 | call completion/early end |
| warning | triangle | 220, 220 | 240 ms | 0.055 | recoverable warning registry slot |

Every effect recipe stays below 0.1 peak gain before the effects-channel and master-channel controls. Repeated events are rate-limited, and `phone-tick` has its own longer gate.
