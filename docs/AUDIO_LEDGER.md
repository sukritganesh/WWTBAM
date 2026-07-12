# Audio implementation ledger

## Decision

The supplied `audio_sources` directory contained only `AUDIO_CURATION.md`; it contained no downloadable ZIPs or audio bytes. Rather than ship unauditioned third-party assets or depend on the network, this release implements original procedural tones in `src/audio/soundRegistry.ts` and `src/audio/AudioManager.ts`.

There are no redistributed audio files, source-pack filenames, or third-party license obligations in the production bundle. The linked Kenney CC0 packs remain future curation candidates only and are not represented as shipped assets.

## Sound-event ledger

All rows use the same source and processing values:

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
| hint | sine | 620, 930 + sweep | 200 ms | 0.050 | hint reveal |
| phone-start | sine | 440, 520 | 160 ms | 0.045 | call activation |
| phone-tick | sine | 880 | 35 ms | 0.035 | final five seconds only |
| phone-end | sine | 520, 350 | 160 ms | 0.045 | call completion/early end |
| warning | triangle | 220, 220 | 240 ms | 0.055 | recoverable warning registry slot |

The registry deliberately keeps every recipe below 0.1 peak gain before the effects-channel and master-channel controls. Repeated events are rate-limited; `phone-tick` has its own longer gate.

## Ambient music ledger

The ambient layer is also procedural and contains no looped recording. `AudioManager` uses two very low-gain oscillators, smooth channel changes, and the following tier fundamentals:

| Tier | Frequencies (Hz) | Use |
| --- | --- | --- |
| menu | 55, 82.41 | title, dashboard, setup, results navigation |
| early | 65.41, 98 | Questions 1–5 |
| middle | 58.27, 87.31 | Questions 6–10 |
| late | 49, 73.42 | Questions 11–14 |
| final | 41.2, 61.74 | Question 15 |

Music and effects have independent enable/volume controls. Narration uses browser `speechSynthesis`, cancels before lock/pause/help/question changes, and ducks the music gain while speaking. The game remains fully understandable when every channel is disabled.

## Future binary-asset replacement

Future curated CC0 clips can replace recipes behind the same logical event registry. Any such change must add the actual source pack, original filename, source URL, license, processing, duration, and intended volume to this ledger; only final processed assets should enter the production bundle.
