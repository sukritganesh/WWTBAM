\# Technical Specification: Millionaire-Style Trivia Game

Status: Working architecture specification. This document records the settled technical architecture and the implementation guidance available at handoff. Codex may normalize schema details, choose exact compatible package versions, and add implementation-specific acceptance tests without changing the core architecture.

\#\# 1\. Architecture Summary

The product is web-first, offline-first, local-only, and intentionally lightweight.

The canonical implementation is a Progressive Web App built with React, TypeScript, and Vite. The browser/PWA build is the sole required delivery target for the first pass. Native desktop wrapping and installer packaging are explicitly deferred to a later version.

The application has no remote backend, no cloud database, no login service, no analytics, no advertising, no telemetry, and no gameplay-time network calls. All questions, fonts, graphics, audio, profiles, saves, statistics, settings, and imported content are stored locally or bundled with the application.

After the initial website load or installation, the entire game must be playable offline.

\#\# 2\. Supported Delivery Modes

\#\#\# 2.1 Browser application

The game must run as a normal static website in a modern desktop browser.

Required commands should remain conventional and simple:

\- npm install  
\- npm run dev  
\- npm run build  
\- npm run preview  
\- npm test

The production build should produce a static dist directory deployable to an ordinary static host. No application server is required.

\#\#\# 2.2 Progressive Web App

The web build must also be installable as a PWA.

The PWA should:

\- Launch in a standalone app-style window when installed.  
\- Cache the complete application shell and bundled game content.  
\- Work without internet access after the first successful load.  
\- Preserve IndexedDB data independently of service-worker updates.  
\- Display an installable application name and icon.  
\- Use the same 16:9 stage and fullscreen behavior as browser play.  
\- Detect an available update and offer it at a safe time.  
\- Never force an update or reload during an active run.

The update flow should wait until the dashboard, title screen, or another safe non-game state. If an update is found during a live run, the app may display a quiet notice but must defer activation.

\#\# 3\. Supported Browsers

Primary reference browser:

\- Current Chromium-based Chrome.

Also supported:

\- Current Microsoft Edge.  
\- Current Firefox.  
\- Current Safari on macOS.

Chromium is the primary visual, fullscreen, audio, PWA, and text-to-speech reference environment. Firefox and Safari should remain functionally usable, but browser-specific differences in installed speech voices, PWA installation, and fullscreen behavior must degrade gracefully.

No mobile browser layout is required in the initial release.

\#\# 4\. Recommended Technology Stack

\#\#\# 4.1 Core frontend

\- React  
\- TypeScript with strict mode enabled  
\- Vite  
\- CSS Modules or equivalently scoped ordinary CSS  
\- CSS custom properties for design tokens  
\- Inline React SVG components for interactive and decorative vector graphics

\#\#\# 4.2 Persistence

\- IndexedDB  
\- The small idb wrapper library

Application components must not call IndexedDB directly. All data access goes through typed repositories and services.

\#\#\# 4.3 Offline and installation

\- Web App Manifest  
\- Service worker generated through a lightweight Vite PWA integration

\#\#\# 4.4 Audio and speech

\- Native Web Audio API  
\- HTMLAudioElement where useful for long music loops  
\- Browser speechSynthesis for dynamic narration

A third-party audio framework should not be added unless native browser APIs prove insufficient during implementation.

\#\#\# 4.5 Testing

\- Vitest for unit tests  
\- React Testing Library for component behavior  
\- Playwright for end-to-end browser tests

\#\#\# 4.6 Libraries intentionally avoided

Do not introduce large or unnecessary frameworks such as:

\- Redux  
\- MobX  
\- XState unless the typed reducer approach demonstrably fails  
\- React Router unless independently addressable routes become necessary  
\- Tailwind  
\- Bootstrap  
\- Material UI  
\- Phaser or another canvas game engine  
\- Electron  
\- A remote database client

The target production dependency set should remain small and understandable.

\#\# 5\. No Remote Backend

Version one has no server-side application layer.

All of the following remain local:

\- Built-in question bank  
\- Imported question packs  
\- Local profiles  
\- One global saved run  
\- Game history  
\- Per-question history  
\- Set progress  
\- Audio and display settings  
\- Profile backups  
\- App metadata and data migrations

The application must make no network requests during gameplay. It must not load remote fonts, remote audio, remote graphics, analytics scripts, advertisements, AI services, or telemetry.

A strict Content Security Policy should be used where practical. Imported question content is data only and must never be evaluated as code or inserted as unsanitized HTML.

\#\# 6\. Project Structure

A recommended project layout is:

src/  
  app/  
    App.tsx  
    AppShell.tsx  
    appReducer.ts  
    appState.ts  
  screens/  
    title/  
    dashboard/  
    new-game/  
    gameplay/  
    statistics/  
    history/  
    settings/  
    help/  
    content-manager/  
  components/  
    answers/  
    prize-ladder/  
    lifelines/  
    dialogs/  
    controls/  
    svg/  
  game/  
    gameReducer.ts  
    gameState.ts  
    gameActions.ts  
    payouts.ts  
    questionSelection.ts  
    statistics.ts  
    saveSnapshot.ts  
  content/  
    built-in/  
      manifest.json  
      pool/  
      sets/  
    schemas/  
    validators/  
    ingestion/  
    catalog/  
    imports/  
  data/  
    database.ts  
    migrations.ts  
    repositories/  
  audio/  
    AudioManager.ts  
    SpeechManager.ts  
    soundRegistry.ts  
  styles/  
    tokens.css  
    global.css  
  utils/  
  tests/  
public/  
  audio/  
  fonts/  
  icons/

Exact names may vary, but game rules, persistence, content validation, audio, and presentation must remain separated rather than being embedded in screen components.

\#\# 7\. Application and Game State

The game should use a typed reducer/state-machine approach built from React primitives rather than a large state library.

Representative states include:

\- BOOTING  
\- TITLE  
\- PROFILE\_DASHBOARD  
\- NEW\_GAME\_SETUP  
\- PRE\_GAME\_CONFIRMATION  
\- GAME\_INTRO  
\- QUESTION\_READING  
\- QUESTION\_READY  
\- HINT\_ACTIVE  
\- PHONE\_ACTIVE  
\- ANSWER\_SELECTED  
\- FINAL\_CONFIRMATION  
\- ANSWER\_LOCKED  
\- CORRECT\_REVEAL  
\- INCORRECT\_REVEAL  
\- BETWEEN\_QUESTIONS  
\- PAUSED  
\- RESULTS  
\- RUN\_REVIEW  
\- CONTENT\_MANAGER

Each action must be legal only in appropriate states. Examples:

\- LOCK\_ANSWER is invalid while Phone a Friend is active.  
\- PAUSE during Phone a Friend first ends and consumes the call, then enters PAUSED.  
\- USE\_HINT is invalid after final answer confirmation.  
\- ADVANCE\_QUESTION is invalid until the current answer has been committed.  
\- A locked answer cannot be changed by keyboard input, refresh, history navigation, or stale UI callbacks.

The reducer should be pure and extensively unit tested. Side effects such as persistence, audio, speech, fullscreen, and file import should be coordinated outside the pure reducer.

\#\# 8\. Navigation

A heavy routing framework is not required.

Use a typed internal screen model for the application flow. Browser history must not allow the player to navigate backward from a later question into an earlier live question.

Non-game screens may optionally use history state or URL fragments for convenience, but the current run is controlled exclusively by the game state and saved snapshot.

The application should handle an accidental browser refresh by restoring the exact active state from the global save.

\#\# 9\. Local Database

\#\#\# 9.1 Storage engine

Use IndexedDB through a small typed repository layer.

Suggested object stores:

\- metadata  
\- settings  
\- profiles  
\- questionHistory  
\- runHistory  
\- setProgress  
\- activeSave  
\- importedPacks  
\- importedQuestions  
\- importedSets

The exact store design may be normalized further, but it must support indexed lookup by profile, question, set, pack, ladder level, and date without reading and rewriting one enormous JSON object.

\#\#\# 9.2 Global save slot

activeSave contains zero or one active record.

The record includes:

\- Owner type: named profile or Guest  
\- Owner profile ID when applicable  
\- Game mode and source selection  
\- All 15 resolved question snapshots  
\- Fixed answer ordering  
\- Current state and question index  
\- Current and guaranteed winnings  
\- Lifeline state  
\- Revealed hint state  
\- Current unconfirmed selection  
\- Completed answer results  
\- Elapsed active and paused time where tracked  
\- Pack IDs and versions used  
\- Save schema version  
\- Last-updated timestamp

The save should contain full resolved question snapshots, not only external question IDs. This ensures that a saved run survives an imported pack being disabled, updated, or removed later.

\#\#\# 9.3 Run-history snapshots

Completed run history should retain the question data needed for post-game review. Historical review must not depend on the current version or continued existence of an imported content pack.

\#\#\# 9.4 Idempotency

Each completed run receives a unique run ID and a committed flag or equivalent transaction marker. Refreshing or reopening the results screen must not add the same results to profile statistics twice.

\#\#\# 9.5 Migrations

The database has an explicit schema version.

Every incompatible data change requires a migration. Updates must preserve existing profiles, history, imported packs, and the active save whenever the stored data is valid. The app must never clear all local data merely because a newer build is installed.

\#\# 10\. Settings Storage

Device and presentation settings are global rather than profile-specific unless a later decision says otherwise.

Persist at least:

\- Master mute  
\- Music enabled and volume  
\- Sound effects enabled and volume  
\- Narration enabled and volume where supported  
\- Voice selection identifier  
\- Speech rate  
\- Read answers  
\- Read hints  
\- Music ducking  
\- Fullscreen preference  
\- Reduced motion  
\- Reduced glow  
\- High contrast if implemented

If a stored speech voice no longer exists, fall back safely to a suitable available English voice or the browser default.

\#\# 11\. Audio Architecture

Use a centralized AudioManager rather than constructing audio elements throughout UI components.

Conceptual channels:

\- Master  
\- Music  
\- Sound effects  
\- Voice narration

Music and effects may use separate Web Audio gain nodes. Speech synthesis remains a separately controlled channel but follows the same global settings.

The audio system must:

\- Initialize only after a user gesture when browser autoplay policy requires it.  
\- Preload or lazily decode sounds without blocking gameplay.  
\- Duck music while narration plays.  
\- Stop narration before lock-in, pause, help, question changes, or replacement speech.  
\- Prevent rapid hover and click sounds from stacking excessively.  
\- Transition smoothly between question-tier music.  
\- Continue functioning offline.  
\- Use only bundled and rights-cleared files.

See DESIGN\_SPEC.md and audio\_sources/AUDIO\_CURATION.md for detailed creative and asset requirements.

\#\# 12\. Text-to-Speech

Use browser speechSynthesis only. Do not call a cloud TTS service.

At startup or settings entry:

\- Discover installed voices.  
\- Prefer a high-quality local English voice.  
\- Permit user selection.  
\- Preserve a stable preference when possible.  
\- Fall back gracefully when a voice disappears.

The game remains fully playable without speech support. All spoken content is always visible as text.

Offline capability does not guarantee that every operating system has the same voices. Missing narration must be treated as a presentation limitation, not a gameplay error.

\#\# 13\. Built-In Question Content

Built-in questions ship as versioned static assets with the application.

Recommended structure:

src/content/built-in/  
  manifest.json  
  pool/  
    general-pool-001.json  
    general-pool-002.json  
    astronomy-pool-001.json  
    computation-pool-001.json  
    ...  
  sets/  
    mixed-general-01.json  
    astronomy-01.json  
    computation-challenge-01.json  
    ...

The manifest-driven build or startup ingestion process must confirm:

\- Unique IDs  
\- Exactly four answers  
\- Exactly one correct answer  
\- Valid ladder level  
\- Required hint  
\- Required explanation  
\- Valid set references  
\- Exactly 15 ordered questions in each curated set  
\- No missing question references  
\- Supported schema version

Invalid built-in content should fail development validation and automated tests rather than silently entering production.

\#\#\# 13.1 Modular built-in source files

Built-in content must be split across multiple manageable JSON files rather than one monolithic question bank. The recommended balance is approximately 50–200 independent pool questions per file, with one curated 15-question set per file unless a small group of closely related sets is clearer as one technical pack.

The source tree should support mixed pool batches, category-focused pool batches, and independently reviewable curated sets. Adding a new valid source file and manifest entry should expand the bank without rewriting older files or changing stable IDs.

\#\#\# 13.2 Manifest-driven loading

A versioned built-in manifest must explicitly enumerate every bundled content file. Runtime behavior must not rely on scanning directories.

Each manifest entry should identify at least:

\- Relative file path.  
\- Stable source or pack ID.  
\- Schema and content version.  
\- Content type: pool, curated set, or combined pack.  
\- Optional category or theme label.  
\- Optional integrity hash for accidental-corruption detection.

The build validation step must fail clearly when a listed file is missing, malformed, duplicated, or incompatible. Unlisted files must not silently enter the production bank.

\#\#\# 13.3 Ingestion and normalization pipeline

Raw JSON files are source and interchange artifacts, not the runtime selection database. At build time or safe application initialization, a content-ingestion service should:

1\. Load all manifest-listed built-in files.  
2\. Parse and validate every pack, question, and set.  
3\. Resolve stable namespaced IDs.  
4\. Reject duplicate IDs, invalid levels or categories, malformed choices, broken references, and unsupported schemas.  
5\. Normalize all valid records into common internal Question, CuratedSet, and ContentSource shapes.  
6\. Merge built-in records with enabled imported records into one unified content catalog.  
7\. Publish coverage summaries and indexes to the repository and Content Manager layers.

Fresh Mix and curated-set selection must query this normalized catalog. They must not choose a source JSON file first or depend on the file layout during gameplay.

\#\#\# 13.4 Catalog indexes

The content repository should support indexed or efficiently filtered access by:

\- Global question ID.  
\- Exact level 1–15.  
\- Derived internal tier and display band.  
\- Primary category and tags.  
\- Built-in or imported origin.  
\- Source pack and source-file ID.  
\- Fresh Mix eligibility.  
\- Curated-set membership.  
\- Enabled state.  
\- Review or verification state.  
\- Time-sensitive eligibility.

Profile-specific encounter information remains in questionHistory and is joined with the content catalog during selection. The same normalized question model should be used for built-in questions, imported packs, manually created content, and externally AI-assisted content.

\#\#\# 13.5 Coverage and organization reporting

The Content Manager and validation tooling should expose useful catalog summaries, including totals by level, difficulty band, internal tier, category, tag, source pack, eligibility, and review status. It should identify missing levels, underrepresented category-by-level combinations, duplicate IDs, broken set references, close subject overlap where detectable, expired questions, and invalid files.

These reports help authors grow a large balanced bank. They do not replace the profile-aware Fresh Mix freshness and diversity algorithm.

\#\# 14\. Extensible Question-Pack System

Extensible question content is a required feature.

Users must be able to add and organize questions without rebuilding the application. This includes content created manually, generated by an external AI system, or prepared in another editor.

The game itself never contacts an AI service.

\#\#\# 14.1 Required import methods

The Content Manager should support at least:

1\. Import a versioned question-pack JSON file.  
2\. Paste question-pack JSON into a validated import panel.  
3\. Create and edit a pack manually through an in-app form-based editor.  
4\. Export a blank schema template and an AI-generation prompt/template that can be given to an external AI tool.  
5\. Import the AI-generated result through the same validation pipeline.  
6\. Export any user-created or imported pack for backup, sharing, or further editing.

A future CSV importer may be added, but JSON is the required full-fidelity interchange format for version one.

\#\#\# 14.2 Pack types

A pack may contain:

\- Fresh Mix pool questions  
\- One or more curated 15-question sets  
\- Both pool questions and curated sets

The pack manifest should include:

\- Schema version  
\- Stable pack ID  
\- Pack title  
\- Description  
\- Author or creator label  
\- Pack version  
\- Language  
\- Tags or categories  
\- Creation and modification metadata when supplied  
\- Content type  
\- Questions  
\- Set manifests  
\- Optional provenance and review notes

\#\#\# 14.3 Question identity

Imported question identity must be globally stable and namespaced by pack ID.

A logical key may resemble:

pack-id:question-id

Built-in content should use its own reserved namespace. A user pack may not overwrite built-in questions.

\#\#\# 14.4 Validation

Imported data is untrusted.

Before import, validate:

\- Supported schema version  
\- Pack ID format  
\- Question ID uniqueness  
\- Maximum pack size  
\- Maximum string lengths  
\- Valid ladder levels  
\- Exactly four answers  
\- Exactly one correct answer  
\- Hint and explanation presence  
\- Set membership and ordering  
\- Exactly 15 unique questions per curated set  
\- No broken references  
\- No duplicate logical keys against enabled content unless explicitly treated as a pack update  
\- No executable code, HTML event handlers, script URLs, or unsupported embedded markup

The importer must show a preview containing errors, warnings, counts, levels represented, sets found, and duplicate conflicts.

Import is transactional: either the entire approved pack is committed or nothing is changed.

\#\#\# 14.5 AI-generated content

AI-assisted authoring is external and optional.

The application should provide:

\- A copyable prompt describing the exact pack schema and quality requirements.  
\- A downloadable empty pack template.  
\- A sample valid pack.  
\- Clear instructions that AI-generated questions require human fact-checking and difficulty review.  
\- Optional metadata such as generatedBy, sourceNotes, reviewStatus, and verificationNotes.

The app must not imply that generated questions are automatically accurate. Imported AI content passes structural validation, but factual correctness remains the pack creator's responsibility.

\#\#\# 14.6 Content Manager

The Content Manager should let users:

\- View installed custom packs  
\- Search and filter packs  
\- See question and set counts  
\- Enable or disable a pack  
\- Inspect pack metadata  
\- Edit user-created packs  
\- Duplicate a pack  
\- Export a pack  
\- Update a pack  
\- Remove a pack  
\- View validation warnings  
\- See whether an active save or historical run references the pack

Disabling a pack removes it from future question selection but does not delete it.

Removing a pack must not corrupt existing saves or history because those records contain question snapshots. If an active save references the pack, the UI should still warn before removal.

\#\#\# 14.7 Pack updates and conflicts

When importing a pack with an existing pack ID:

\- Same version and identical content: report that it is already installed.  
\- Same version but different content: require explicit conflict resolution.  
\- Higher version: present an update preview.  
\- Lower version: treat as a downgrade and require explicit confirmation.

Updates should preserve stable question IDs whenever the underlying question is conceptually the same. A changed question with the same ID should be clearly reported because it affects future statistics interpretation.

\#\#\# 14.8 Selection integration

Enabled custom content can participate in future games.

The repository layer should expose a unified content catalog merging:

\- Built-in Fresh Mix questions  
\- Enabled imported Fresh Mix questions  
\- Built-in curated sets  
\- Enabled imported curated sets

The New Game flow should be technically capable of selecting:

\- Built-in content only  
\- All enabled content  
\- Specific enabled packs  
\- A specific curated set

Codex should implement a clear, data-driven source-scope selector consistent with the supplied content catalog and the design specification.

\#\# 15\. Profile and Data Export/Import

Export and import are required because clearing browser storage may otherwise remove local progress.

\#\#\# 15.1 Full application backup

The user can export a versioned backup file containing:

\- All named profiles  
\- Profile statistics  
\- Run history  
\- Question history  
\- Set progress  
\- Global settings  
\- Active save  
\- Imported question packs  
\- Application metadata required for restoration

Recommended extension:

\- .millionaire-backup.json

Restoring a full backup should show a summary and then replace current local application data only after explicit confirmation. The restore must be transactional and validated before destructive replacement.

\#\#\# 15.2 Single-profile export

A named profile may be exported separately with its statistics and history.

If that profile owns the active save, the export may optionally include the save. Imported single-profile files should create a new internal profile ID rather than overwrite an existing profile. The 20-profile limit still applies.

\#\#\# 15.3 Question-pack export

Question packs have their own separate export format and should not require a full profile backup.

\#\#\# 15.4 File handling

Use standard browser file input and Blob download behavior as the baseline. Where the File System Access API is available, it may improve the experience, but it is not required for correctness.

\#\# 16\. Question Selection Service

Question selection should be a pure, deterministic service supplied with an explicit random seed or injectable random source for testing.

It must support:

\- One question per ladder level  
\- Profile-specific unseen-question priority  
\- Least-seen fallback  
\- Least-recently-seen fallback  
\- Source-scope filters  
\- Enabled/disabled pack state  
\- Curated-set order preservation  
\- Fixed answer-order generation  
\- No duplicate question in one run

Once a run is created, its 15 resolved question snapshots and answer orders are immutable.

\#\# 17\. Save and Autosave Coordinator

A persistence coordinator observes valid state transitions and writes the global save after meaningful changes.

Autosave triggers include:

\- Run creation  
\- Question display  
\- Answer selection or clearing  
\- Hint reveal  
\- Phone activation and completion  
\- Correct-answer commit  
\- Pause  
\- Save and exit  
\- Walk away  
\- Run completion

Writes should be serialized or debounced safely so older asynchronous writes cannot overwrite newer state.

Starting another run replaces the global save only after the replacement confirmation is accepted.

\#\# 18\. Offline and Asset Strategy

Bundle locally:

\- JavaScript and CSS  
\- Fonts  
\- SVGs  
\- Icons  
\- Built-in questions  
\- Audio  
\- App manifest

Do not depend on a CDN.

The service worker should precache the application shell and core content. Larger audio files may use a deliberate cache strategy, but every file required for a complete offline run must be available after the initial installation or first-load completion step.

The app should provide a visible readiness state if offline assets are still being cached. It must not claim full offline readiness until required assets are available.

\#\# 19\. Fullscreen and 16:9 Stage

The renderer uses a fixed conceptual 1920 x 1080 stage and scales it uniformly to the largest 16:9 rectangle that fits the available window.

\- No stretching.  
\- Letterboxing or pillarboxing is allowed.  
\- Minimum fully supported stage is 1280 x 720\.  
\- Smaller windows show a clear request to enlarge the window rather than producing an unusable layout.  
\- Fullscreen and windowed mode use identical game logic and proportions.

Fullscreen failures or denied permissions should produce a quiet recoverable message. The game remains usable in windowed mode.

\#\# 20\. Security and Content Safety

Imported content must be treated as inert data.

\- Never use eval or Function.  
\- Never inject imported strings with dangerouslySetInnerHTML.  
\- Render question text as ordinary text nodes.  
\- Reject unsupported URLs and embedded scripts.  
\- Enforce size and count limits to avoid memory abuse.  
\- Validate backups and packs before writing to IndexedDB.  
\- Use transactions for destructive restore operations.  
\- Escape or sanitize exported filenames.

The application must not read arbitrary files beyond those explicitly selected by the user.

\#\# 21\. Testing Strategy

\#\#\# 21.1 Unit tests

Test at minimum:

\- Prize and checkpoint rules  
\- Walking-away payouts  
\- Question selection priorities  
\- Pack source filters  
\- Answer shuffling  
\- Reducer transition legality  
\- Phone timer and pause behavior  
\- Save serialization  
\- Statistics aggregation  
\- Run commit idempotency  
\- Database migrations  
\- Built-in question validation  
\- Imported pack validation  
\- Pack update conflict handling  
\- Backup validation

\#\#\# 21.2 Component tests

Test:

\- Keyboard selection  
\- Final-answer confirmation  
\- Disabled controls  
\- Focus restoration after dialogs  
\- Audio-setting controls  
\- Pack import previews  
\- Profile-limit behavior  
\- Save-owner warnings

\#\#\# 21.3 End-to-end tests

Playwright flows should include:

\- Create profile and begin game  
\- Refresh and resume exact question state  
\- Use Hint  
\- Use Phone a Friend and end early  
\- Pause during Phone a Friend  
\- Lock correct and incorrect answers  
\- Walk away  
\- Reach both checkpoints  
\- Win Question 15 with a deterministic test pack  
\- Replace another profile's save after confirmation  
\- Export and restore a backup  
\- Import, enable, play, disable, and remove a custom pack  
\- Confirm no network requests occur during an offline game  
\- Verify Chromium fullscreen/windowed layout behavior at supported sizes

\#\# 22\. Performance Goals

The game should feel immediate on a typical modern Windows computer.

Guidelines:

\- Keep production dependencies minimal.  
\- Avoid loading every audio buffer at startup.  
\- Cache parsed content catalogs.  
\- Avoid re-rendering the full SVG background on every timer tick.  
\- Keep the Phone a Friend countdown isolated from heavy component trees.  
\- Use CSS transforms and opacity for most animation.  
\- Respect reduced motion.  
\- Avoid enormous imported packs by enforcing reasonable limits.

Question JSON and profile data should be small compared with bundled audio. Audio optimization is therefore the main download-size concern.

\#\# 23\. Build and Deployment

Required web outputs:

\- Development server  
\- Production static build  
\- PWA manifest  
\- Service worker  
\- Offline-ready asset bundle

The repository should include a clear README covering:

\- Prerequisites  
\- Development  
\- Testing  
\- Static deployment  
\- PWA installation  
\- Question-pack authoring  
\- Backup and restore  
\- Audio licensing ledger

\#\# 24\. Production Dependency Budget

Preferred runtime dependencies:

\- react  
\- react-dom  
\- idb

Build and testing dependencies may include:

\- typescript  
\- vite  
\- @vitejs/plugin-react  
\- vite-plugin-pwa  
\- vitest  
\- @testing-library/react  
\- @playwright/test

Avoid adding dependencies for functionality that can be implemented clearly and safely with browser APIs.

\#\# 25\. Current Technical Decisions

Settled:

\- Web-first PWA is the canonical build.  
\- Native desktop packaging is deferred beyond version one.  
\- Chromium is the primary browser reference.  
\- Current Edge, Firefox, and Safari remain supported where practical.  
\- Full offline play is mandatory.  
\- No remote backend exists.  
\- No analytics, advertisements, telemetry, or gameplay network calls are permitted.  
\- IndexedDB is the primary local persistence layer.  
\- Profile and application backup/restore are required.  
\- Extensible custom question packs are required.  
\- External AI may generate pack files, but the game never calls AI services.  
\- React, TypeScript, Vite, ordinary CSS, inline SVG, browser audio, and browser speech are the preferred implementation tools.

\#\# 26\. Open Technical Decisions

To be refined later:

\- Final production JSON Schema limits and compatibility rules for built-in and custom packs.  
\- Future content-expansion targets beyond Question Content Release 001\.  
\- Exact user interface for source-scope selection.  
\- Whether a CSV importer is worth adding after the JSON workflow is complete.  
\- Whether a native desktop wrapper should be added in a later release.  
\- Exact service-worker caching policy for larger music files.  
\- Exact maximum imported pack size and question count.  
\- Final browser test matrix and minimum browser versions.  
\- Whether single-profile imports may optionally merge with an existing profile in a later version.

These open items do not change the chosen architecture.

