# Implementation Notes

These notes record the material implementation decisions made where the supplied specifications were ambiguous, internally inconsistent, or depended on assets that were not present in the handoff. They describe the current code, not a replacement for the product, design, technical, question-bank, or QA specifications.

## Run creation and save replacement

The application follows a generate-before-replace rule. New-game setup and confirmation do not touch the global save. The selected source scope is resolved, all 15 questions are selected, answer order is fixed, and the complete run snapshot is created before `ActiveSaveRepository.replace` is called. Replacement also carries the previously observed run ID and revision. If selection, set resolution, validation, or persistence fails, the prior save remains authoritative.

This resolves the tension between “starting a new run replaces the save” and the QA requirement that a failed run generation must preserve the previous run. In implementation, “starting” means successfully committing the fully generated run after confirmation, not entering setup or beginning selection.

## Active-state persistence and terminal commit

The reducer owns serializable gameplay state and increments its save revision for every accepted state change. The application serializes writes through one autosave queue. Resolved questions, their answer order, current phase, selection, locked choice, hint state, Phone deadline, results, and overlays are stored in the active snapshot.

Gameplay states that may look transient are intentionally persisted when they affect recovery or legality. These include:

- Final-answer confirmation and Phone activation confirmation.
- The absolute Phone a Friend deadline.
- Pause, Help, and walk-away overlays and their return state.
- Answer-locked, reveal, between-question, and completed phases.
- The current unconfirmed selection and revealed Hint.

The lock-in suspense timer does not begin until the locked state has been saved. A persistence failure leaves the in-memory answer locked, reports a save error, and prevents the reveal effect from advancing on an uncommitted revision. Non-game file pickers and ordinary application dialogs are not part of the run snapshot and may close after refresh.

Run completion uses `commitTerminalAndClearSave`. One IndexedDB transaction validates the active run, owner, controller, controller epoch, save revision, and resolved-question identity; commits run history; updates profile statistics, per-question history, and set progress; consumes the next global revision; and deletes the active save. A retry finds the already committed run and does not apply statistics twice. This is stricter than a separate “write history, then clear save” sequence and closes the crash window between those operations.

Historical results retain the selected choice, correct choice, correctness, Hint use, and Phone use for every answered question. Legacy records without the newer choice and Phone fields normalize to explicit unavailable/default values rather than failing migration.

## One global save and multiple tabs

There is one `activeSave` record with the fixed key `active`, shared by named profiles and Guest. A separate metadata counter makes revisions monotonic even across save deletion and replacement.

Control is enforced transactionally in IndexedDB through:

- A per-tab controller ID.
- A controller epoch that changes on takeover.
- A renewable lease, currently 15 seconds by default.
- A five-second application heartbeat while actively playing.
- Expected run, revision, controller, and epoch checks on every gameplay write.

The implementation deliberately does not depend on `BroadcastChannel`. IndexedDB is the source of authority, so a stale tab cannot overwrite progress even when messaging is unavailable. An old controller learns about takeover on its next heartbeat or write and becomes read-only; detection is safe but not necessarily instantaneous. Explicit takeover may supersede a live lease after user confirmation. Backup restore and imported active saves receive a higher revision and an expired, unclaimed controller so a pre-restore tab cannot resume writing.

## Profiles and the Guest boundary

Named profiles have permanent local statistics, question history, set progress, run history, and single-profile export/import. Imports always receive a new profile ID and rewritten run, history, set-progress, owner, and optional active-save identities. The 20-profile limit is checked inside the same transaction as import.

Guest can complete and resume a full run and can own the one global save. Completed Guest runs and question encounters are retained under the singleton `guest` owner key so refresh recovery and repeat avoidance work across local launches. They do not update a `ProfileRecord`, cannot overwrite or leak into a named career, are excluded from single-profile export, and cannot currently be converted into a profile. Full application backup includes them because it represents all local application data.

Retaining device-local Guest history is a small extension of the specification’s “current guest session” language. It still preserves the intended boundary: Guest has no named permanent career and no guest-to-profile import workflow.

## Built-in content normalization

The source release is validated before normalization. Integrity hashes are calculated over the exact source bytes, including any byte-order mark. JSON parsing then removes one leading UTF-8 BOM when present. The six original curated-set payloads contain BOMs; plain `JSON.parse` on those unmodified strings would fail. The v1.1.0 geography supplement and updated coverage index are UTF-8 without BOM.

The prose model describes question-level review metadata, but the 480 original questions and 45-question geography supplement do not contain individual `metadata` objects. Review status, author, language, human-review recommendation, and time-sensitive counts live at pack level. Normalization inherits those values into each question, while a future imported question may override supported fields explicitly. Unknown metadata is not copied into the runtime model.

Exactly five documented Hint repairs are applied to normalized built-in copies:

- `builtin-pool-technology-07`
- `builtin-pool-music-03`
- `builtin-pool-music-13`
- `builtin-pool-sports-and-games-05`
- `builtin-pool-mythology-and-religion-12`

The raw files and their stable IDs remain unchanged, so manifest hashes continue to describe the delivered source. Build validation fails if the repair set is no longer exactly those five records. Imported files use the same structural validation and normalization concepts, receive pack-namespaced identities, and never replace the built-in namespace.

## Content review status

The release passes structural validation: hashes, IDs, levels, choices, correct-answer references, curated-set ordering, references, and coverage are checked automatically. That does not establish factual correctness or final difficulty calibration.

All built-in questions currently inherit `assistant-reviewed-draft`. That status is visible in catalog reporting and remains eligible for play; only invalid, rejected, expired, or unverified content is automatically excluded. A human factual review, ambiguity review, Hint-leakage spot check, and play-test-based difficulty calibration are still required before treating the bank as publication-final.

## Audio implementation deviation

The handoff supplied an audio curation document and links to candidate CC0 packs, but no audio files or archives. The original one-shot implementation therefore used procedural Web Audio for both effects and ambient beds. During a later user-approved pass, twelve user-supplied WAV tracks were transcoded to 192 kbps MP3 and added as the recorded music layer. Effects remain short oscillator/envelope combinations, while browser `speechSynthesis` remains the optional narration channel.

Each random run ID deterministically selects one track for Questions 1–5, Questions 6–10, Questions 11–15, Pause, and Outro. This avoids changing the selection after refresh without expanding the persisted game schema. The selected media elements remain alive for the run so gameplay and pause music resume from their prior positions after repeated pauses.

Consequences of this decision:

- Audio is local, very small, immediately offline-capable, and has no third-party binary redistribution obligations.
- There is no binary-asset licensing ledger because no external audio asset ships.
- The registry and channel architecture remain replaceable if a later production audio pass selects and processes rights-cleared files.
- The procedural cues are intentionally functional and cohesive, but they are not a substitute for the auditioned, mastered asset set envisioned by the curation brief.

## Stage, scaling, and accessibility

The application renders into the largest 16:9 rectangle that fits the viewport, capped at 1920 by 1080, with natural letterboxing or pillarboxing and no stretching. Internal layout uses responsive CSS and `clamp` sizing rather than scaling a literal 1920-by-1080 canvas transform.

The technical specification names 1280 by 720 as the minimum fully supported stage. The implementation keeps that as the primary target but uses a more permissive hard-stop notice at less than 900 CSS pixels wide or 520 CSS pixels high. Intermediate desktop sizes therefore attempt the scaled layout instead of being blocked immediately. Mobile-specific reflow is still out of scope.

Accessibility decisions implemented in the shared presentation layer include:

- Keyboard A–D answer selection, with shortcuts suppressed while typing.
- Visible focus styling and accessible names for icon-only controls.
- Modal focus entry, focus trapping, Escape handling, and focus restoration.
- Text labels and screen-reader announcements for answer and phase states, rather than color alone.
- Settings for reduced motion, reduced glow, and high contrast; system reduced-motion preference is also honored.
- All narrated information remains visible as text, and unavailable TTS never blocks play.

The fixed desktop stage and minimum-size notice remain deliberate product constraints, not accessibility substitutes for a future responsive/mobile layout.

## PWA and offline boundary

The production build uses prompted service-worker updates rather than automatic reload. The application shell, local fonts, icons, generated catalog, JavaScript, CSS, and recorded MP3 music are bundled locally. The service worker allows music assets up to 6 MiB each and precaches the complete 36.95 MiB music set for offline play. Applying an update remains a user action surfaced from a safe settings flow.

Offline readiness is based on Workbox’s `onOfflineReady` signal or an already controlling service worker. The current implementation does not independently enumerate and hash every cache entry at runtime. If the readiness contract later includes large optional media or separately fetched content, that check should be strengthened before the UI claims complete readiness.

## Build-size note

The current production build succeeds, but Vite warns that the main JavaScript chunk is larger than 500 kB. The generated 525-question catalog and the single-screen application are compiled into that main chunk.

This is not currently a functional blocker for the desktop, offline-first target, and the whole precache remains modest. A future optimization pass can split infrequently used management/statistics screens and, if appropriate, load a separately precached catalog asset. Any split must retain complete offline availability and must not introduce gameplay-time network dependence.
