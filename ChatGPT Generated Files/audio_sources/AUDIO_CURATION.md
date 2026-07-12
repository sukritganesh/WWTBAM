\# Audio Asset Curation

Status: Source manifest for the Millionaire-style trivia game. The current ChatGPT runtime could verify these official sources and licenses but could not transfer the external ZIP bytes into Google Drive. Codex should download, audition, trim, rename, normalize, and bundle only the final selected clips.

\#\# 1\. Licensing Rule

Use only assets with a clearly verified license that permits redistribution in the finished game. The preferred base below is Kenney's official audio collection. Every listed source page explicitly marks its pack as Creative Commons CC0. Attribution is not legally required for CC0, but keeping a source ledger is still recommended.

Do not use audio from the real television program, close recreations of its signature themes, YouTube rips, unverified “free” download sites, or assets limited to personal/noncommercial use.

\#\# 2\. Recommended Official Source Packs

\#\#\# 2.1 Kenney UI Audio

Source page: https://kenney.nl/assets/ui-audio  
Direct ZIP: https://kenney.nl/media/pages/assets/ui-audio/490d233f68-1677590494/kenney\_ui-audio.zip  
License: Creative Commons CC0  
Pack size: 50 files  
Best uses: hover responses, button presses, toggles, answer selection, deselection, small confirmations, unobtrusive menu feedback.

\#\#\# 2.2 Kenney Interface Sounds

Source page: https://kenney.nl/assets/interface-sounds  
Direct ZIP: https://kenney.nl/media/pages/assets/interface-sounds/fa43c1dd4d-1677589452/kenney\_interface-sounds.zip  
License: Creative Commons CC0  
Pack size: 100 files  
Best uses: panel opening and closing, modal confirmation, tab changes, save confirmation, profile creation, menu navigation, settings changes.

\#\#\# 2.3 Kenney Digital Audio

Source page: https://kenney.nl/assets/digital-audio  
Direct ZIP: https://kenney.nl/media/pages/assets/digital-audio/216eac4753-1677590265/kenney\_digital-audio.zip  
License: Creative Commons CC0  
Pack size: 60 files  
Best uses: futuristic data pulses, hint reveal, lifeline activation, countdown accents, scanning effects, question-loading effects, digital status cues.

\#\#\# 2.4 Kenney Sci-fi Sounds

Source page: https://kenney.nl/assets/sci-fi-sounds  
Direct ZIP: https://kenney.nl/media/pages/assets/sci-fi-sounds/6b296f9ecf-1677589334/kenney\_sci-fi-sounds.zip  
License: Creative Commons CC0  
Pack size: 70 files  
Best uses: stage startup, large panel sweeps, game transitions, answer lock-in, atmospheric machinery, major state changes. Avoid weapon-like or overly aggressive clips.

\#\#\# 2.5 Kenney Impact Sounds

Source page: https://kenney.nl/assets/impact-sounds  
Direct ZIP: https://kenney.nl/media/pages/assets/impact-sounds/87b4ddecda-1677589768/kenney\_impact-sounds.zip  
License: Creative Commons CC0  
Pack size: 130 files  
Best uses: layered correct-answer hits, wrong-answer impact, checkpoint arrival, dramatic lock-in release, results reveal, millionaire victory. Use softly and layer sparingly; avoid harsh cinematic booms.

\#\#\# 2.6 Kenney Music Jingles

Source page: https://kenney.nl/assets/music-jingles  
Direct ZIP: https://kenney.nl/media/pages/assets/music-jingles/f37e530b9e-1677590399/kenney\_music-jingles.zip  
License: Creative Commons CC0  
Pack size: 85 files  
Best uses: short success stingers, loss stingers, checkpoint celebration, game-start cue, results cue, and victory accents. This pack is for short musical cues, not necessarily the continuous question music beds.

\#\# 3\. Target Sound Inventory

Codex should audition the source packs and select a compact, cohesive set rather than shipping every file. Recommended logical asset names:

\#\#\# Interface  
\- ui-hover  
\- ui-press  
\- ui-back  
\- ui-confirm  
\- ui-cancel  
\- ui-toggle-on  
\- ui-toggle-off  
\- panel-open  
\- panel-close  
\- modal-open  
\- save-complete  
\- profile-create  
\- profile-delete

\#\#\# Game flow  
\- game-intro  
\- question-enter  
\- answer-select  
\- answer-deselect  
\- answer-final-confirm  
\- answer-lock  
\- correct-tier-1  
\- correct-tier-2  
\- correct-tier-3  
\- incorrect  
\- checkpoint-reached  
\- next-question  
\- walk-away  
\- results-open  
\- millionaire-victory

\#\#\# Lifelines  
\- hint-activate  
\- hint-reveal  
\- phone-start  
\- phone-countdown-tick  
\- phone-final-five  
\- phone-end

\#\#\# Utility  
\- warning  
\- fullscreen-enter  
\- fullscreen-exit  
\- help-open  
\- pause-open  
\- resume

\#\# 4\. Curation Direction

The selected clips must sound like one coherent futuristic broadcast system: clean, precise, cool, and expensive. Favor short electronic pulses, restrained metallic sweeps, glassy digital chimes, soft low-frequency impacts, and controlled confirmation tones.

Reject sounds that are cartoonish, retro-arcade, casino-like, excessively cheerful, militaristic, weapon-like, distorted, abrasive, or drenched in reverb. The game should never sound like a slot machine or a cyberpunk combat UI.

Use very quiet hover effects or omit hover audio entirely if repeated playback becomes irritating. Important state changes deserve stronger audio than ordinary navigation.

\#\# 5\. Layering Recommendations

A few major effects may be made by layering two or three CC0 clips:

\- Answer lock: short digital pulse plus a soft metallic closure.  
\- Correct answer: clean positive tone plus a restrained low impact.  
\- Wrong answer: brief tonal drop plus a soft low impact; never use a loud comedy buzzer.  
\- Checkpoint: correct-answer cue plus a short musical shimmer.  
\- Millionaire victory: unique musical jingle, wide digital sweep, and restrained celebratory impact.  
\- Hint: small data-unlock shimmer with no triumphant fanfare.  
\- Phone timer: subtle activation, quiet regular visual timer, audible ticks only in the final ten seconds, stronger cues at five seconds and zero.

\#\# 6\. Audio Processing Requirements

After selection:

\- Trim leading and trailing silence.  
\- Apply short fades to prevent clicks.  
\- Normalize clips to a consistent perceived loudness.  
\- Keep ordinary UI sounds substantially quieter than result and checkpoint cues.  
\- Prefer OGG or another broadly supported compressed web format, with fallback only where required.  
\- Keep original source files outside the production bundle; copy only final chosen and processed assets into the app.  
\- Do not play multiple interface sounds simultaneously without an intentional layering rule.  
\- Prevent rapid hover/click spam from stacking into excessive volume.

\#\# 7\. Music Gap

The Kenney Music Jingles pack can cover event stingers, but continuous menu ambience and tiered question tension beds may require a separate rights-cleared music source or original procedural/composed loops. Do not force short jingles into continuous looping music if they sound repetitive.

Preferred eventual music inventory:

\- menu-ambient-loop  
\- questions-1-5-loop  
\- questions-6-10-loop  
\- questions-11-14-loop  
\- question-15-loop  
\- checkpoint-stinger  
\- walk-away-stinger  
\- defeat-stinger  
\- millionaire-victory-theme

\#\# 8\. Implementation Notes

Music, sound effects, and text-to-speech voice are independent channels with separate mute toggles and volume controls. A master mute may silence all channels while retaining their individual settings. Music should duck beneath narration. Text-to-speech is dynamic browser speech and is not supplied by these packs.

Codex should create an asset registry rather than hard-code file paths throughout components. Each logical sound event should map to one final selected filename, enabling later replacement without changing gameplay code.

\#\# 9\. Final Source Ledger

For every sound actually shipped, record:

\- Final game filename  
\- Logical event name  
\- Original pack  
\- Original filename  
\- Source page  
\- License  
\- Processing performed  
\- Duration  
\- Intended playback volume

The source ledger should ship with the repository even though the selected assets are CC0.

