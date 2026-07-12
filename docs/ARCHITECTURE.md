# Architecture

## System overview

One Million is a local-first React application built with TypeScript and Vite. It has no gameplay backend. Built-in content ships in the application bundle, while profiles, settings, imported content, encounter history, completed runs, and the one active save live in IndexedDB.

The main runtime boundaries are:

| Area | Responsibility |
| --- | --- |
| `src/app` | Boot, screen orchestration, side-effect coordination, adapters between domain and storage models |
| `src/game` | Pure rules, immutable run state, reducer, payouts, seeded selection and answer shuffling |
| `src/content` | Content types, validation, normalization, catalog indexes, transactional import preparation |
| `src/data` | Typed IndexedDB schema, migrations, repositories, backups, profile transfer, concurrency guards |
| `src/screens` and `src/components` | Controlled presentation and accessible interaction surfaces |
| `src/audio` | Procedural Web Audio effects/music and browser speech synthesis |
| `src/pwa` | Service-worker registration, offline/update status and user-requested activation |

`src/main.tsx` mounts `App` inside React Strict Mode. `App` renders a fixed 16:9 stage and switches screens with the typed `ScreenId` model; the project does not use a routing framework. Browser history is intercepted during gameplay so Back opens Pause rather than exposing earlier game state.

## Boot and application orchestration

On startup, `App.tsx`:

1. Loads the generated built-in catalog.
2. Opens IndexedDB and runs any required schema migrations.
3. Loads profiles, global settings, the global active save, and imported packs.
4. Defensively decodes the saved game snapshot.
5. Exposes recovery UI instead of discarding unrelated data when startup or save decoding fails.

`App.tsx` deliberately coordinates effects that do not belong in the game reducer:

- Serialized autosaves and controller-lease heartbeats.
- Seen, Hint, Phone, and answered-history writes.
- Answer-reveal timing and optional automatic advancement.
- Audio cues, music tier changes, and speech interruption.
- Terminal history/statistics commits.
- Content import/export, profile transfer, and backup/restore.
- PWA status, update activation, fullscreen, navigation, dialogs, and toasts.

Screens receive state and callbacks. In particular, `GameplayScreen` does not read a repository or mutate domain state directly; it emits typed `GameAction` values to the orchestrator.

## Pure game domain

`src/game/types.ts` defines the serializable run model. A run contains:

- A stable run ID, owner, and mode.
- Exactly 15 self-contained resolved question snapshots in level order.
- Fixed answer order and A–D labels for every question.
- Current phase, overlay, question index, selection, and committed answer.
- Lifeline state, including an absolute Phone a Friend deadline.
- Displayed-question IDs, resolved results, winnings, terminal outcome, and save revision.

The reducer in `src/game/gameReducer.ts` is pure: the same state and action always produce the same result, and illegal or stale actions return the original state object. Accepted transitions increment `saveRevision`. Representative phases include intro, question-ready, answer-selected, final confirmation, Phone confirmation/active, answer-locked, correct/incorrect/millionaire reveal, between questions, and completed.

Pause, Help, and walk-away confirmation are represented as an overlay separate from the underlying phase. This preserves the exact question interaction state across modal flows. Pause or Help during an active Phone call first converts the Phone lifeline to used, then opens the requested overlay.

Important domain invariants include:

- Locked answers are immutable.
- A consumed lifeline never becomes available again.
- Winnings and guaranteed payouts derive from centralized ladder rules.
- A question is marked displayed only when its screen is shown.
- Answer shuffles and question selection are seeded and deterministic.
- Fresh Mix applies unseen, least-seen, then least-recently-seen priority per level.
- Curated sets preserve authored order while generating a fixed answer order per attempt.
- Terminal outcomes cannot return to active play.

## Persist-before-reveal flow

The in-memory game revision and IndexedDB record revision are related but distinct:

- `GameRunState.saveRevision` orders accepted reducer transitions inside the snapshot.
- `ActiveSaveRecord.revision` is a global IndexedDB sequence used for compare-and-swap writes.

`App` dispatches the pure reducer, updates the controlled view, then serializes the resulting save through a promise queue. Each repository update checks the expected database revision, run ID, controller ID, and controller epoch. Older or unauthorized writes fail instead of overwriting newer progress.

Final-answer confirmation moves the reducer to `answer-locked` and is saved first. The suspense/reveal effect waits until `persistedGameRevision >= game.saveRevision` before dispatching `REVEAL_ANSWER`. A refresh during suspense therefore restores a committed answer, never an editable one.

Phone a Friend stores a wall-clock deadline in the snapshot. The UI derives remaining time from `nowMs`; the orchestrator updates the clock while Phone is active and dispatches deadline completion when the absolute deadline is reached.

## IndexedDB model

The database is named `one-million-local`; the current schema version is defined in `src/data/database.ts`. It uses the `idb` wrapper and these stores:

| Store | Purpose |
| --- | --- |
| `metadata` | Global sequences such as active-save revision |
| `settings` | Single device-global settings record |
| `profiles` | Named local profiles and aggregate statistics |
| `questionHistory` | Owner/question encounter and lifeline counters |
| `runHistory` | Idempotently committed terminal runs and review snapshots |
| `setProgress` | Per-owner curated-set attempts, wins, and best result |
| `activeSave` | Zero or one global resumable run, always at key `active` |
| `importedPacks` | Installed custom-pack metadata and enabled state |
| `importedQuestions` | Namespaced normalized imported questions |
| `importedSets` | Namespaced normalized imported curated sets |

Repositories are exposed through `DataRepositories`. UI code should use these typed services rather than issuing raw IndexedDB operations.

Database upgrades are incremental and preserve valid records. A schema change must increment the database version and add a migration; it must not clear the database as a shortcut.

## One global save and multi-tab control

There is one active-save slot across all profiles and Guest. The record stores its owner, all resolved question snapshots, the complete game snapshot, a database revision, and a controller lease.

A controller ID is held in `sessionStorage`. Reloading the same tab preserves it; a separate tab gets a different ID. The active controller heartbeats every five seconds and normally receives a 15-second lease. Taking control checks the run revision and controller epoch transactionally. A stale tab becomes read-only when its heartbeat or write is rejected.

New-run replacement is compare-and-swap: generation and validation happen before the existing save is replaced. A failed generation leaves the prior save intact.

## Terminal commit and idempotency

When a run reaches `completed` and its final snapshot has persisted, `RunHistoryRepository.commitTerminalAndClearSave` performs one read-write transaction across run history, profiles, question history, set progress, the active save, and metadata.

The transaction:

- Validates the active-save guard and resolved snapshots.
- Uses the run ID as the idempotency key.
- Adds the completed run and its review data once.
- Updates named-profile aggregates when applicable.
- Updates answered-question and curated-set progress once.
- Advances the global revision and clears the matching active save.

Recommitting an identical terminal result returns the existing record without duplicating statistics. Reusing a run ID for a different result is rejected.

## Content architecture

Built-in Release 001 follows three layers:

1. Immutable source files in `content/source/release-001`.
2. Normalized release and validation artifacts in `content/normalized/release-001`.
3. Runtime catalog artifacts in `src/content/generated`.

The scripts under `scripts/content` verify manifest paths and hashes, validate schemas and cross-references, apply only documented normalization repairs, build indexes, and write reproducible artifacts. The app loads the generated catalog synchronously at boot.

Custom packs are untrusted data. They are parsed, size-limited, structurally validated, checked for unsafe markup and identity conflicts, normalized, previewed, and only then committed transactionally to the imported-content stores. Imported data is never evaluated as code or inserted as unsanitized HTML. Disabling or removing a pack affects future selection; active saves and history retain resolved snapshots.

## Backup and profile transfer

Full backups and single-profile transfers use versioned JSON formats. Restore/import first parse and validate in memory, including ownership and cross-record references, then write through one IndexedDB transaction. A failed preflight or transaction leaves existing data unchanged.

Full restore replaces all stores and advances the active-save revision. Profile import creates a new internal profile identity and rewrites owned records rather than overwriting an existing profile.

## Audio and text to speech

Audio has independent music, effects, and voice settings plus master mute. `AudioManager` builds a Web Audio graph lazily after browser permission/user interaction. Music beds and effects are original procedural oscillators defined by logical events in `soundRegistry.ts`; the runtime does not fetch audio files.

`SpeechManager` uses the browser `speechSynthesis` API. It discovers English voices asynchronously, prefers the configured voice, then a local voice, then the first compatible voice. Starting speech cancels previous speech and ducks music; ending, cancellation, or an error restores music. Speech failure never blocks gameplay because all content remains visible.

## PWA and offline behavior

`vite-plugin-pwa` generates the manifest and Workbox service worker during production builds. The service worker precaches built JavaScript, CSS, HTML, SVG, local fonts, and JSON and uses `index.html` as the navigation fallback. No service worker is enabled in the Vite development server.

Registration uses prompt mode. `usePwa` reports online status, offline readiness, and an available update. Applying an update is an explicit user action. Built-in content, fonts, icons, and procedural audio are local, so gameplay makes no runtime network request.

## Presentation and accessibility

The application renders a centered 16:9 stage with uniform scaling. The primary design target is at least 1280×720; the current hard-stop notice appears below 900 CSS pixels wide or 520 CSS pixels high. Global CSS tokens define semantic colors, motion timing, typography, focus, reduced-motion, reduced-glow, and increased-contrast variants.

Interactive state is not communicated by color alone. Answer choices expose labels and textual states, dialogs trap and restore focus, icon buttons have accessible names, and gameplay supports A–D keyboard selection. Narration supplements rather than replaces visible content.
