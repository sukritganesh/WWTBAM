# Implementation Report

Date: 2026-07-11  
Release: One Million 1.0.0

## Product and architecture summary

One Million is a complete local-first, desktop-oriented millionaire-style trivia game built with React 18, TypeScript, and Vite. It provides a fifteen-question prize ladder, the Hint and Phone a Friend lifelines, profiles and Guest play, one globally resumable active run, curated sets, Fresh Mix selection, results and review, statistics, content management, backups, settings, recorded music, procedural sound effects, speech synthesis, and an installable offline PWA.

The implementation is divided into explicit boundaries:

- `src/game` contains deterministic selection, prize rules, immutable run types, and a pure reducer. Resolved questions and shuffled answer order are captured in the run so reloads cannot change a live game.
- `src/data` owns the versioned IndexedDB schema and repositories. Monotonic save revisions, controller epochs, leases, and transactional terminal commits prevent stale-tab writes and duplicate history/statistics.
- `src/content` and `scripts/content` preserve the release source, validate it, normalize compatible defects, stage imports transactionally, and generate the runtime catalog.
- `src/screens`, `src/components`, and `src/styles` implement the fixed 16:9 stage, application flows, dialogs, settings, and accessible state presentation.
- `src/audio` provides recorded looped music, an original procedural Web Audio effects registry, and optional browser speech synthesis.
- Vite PWA generation precaches the application shell, local fonts, complete built-in catalog, and recorded music.

Deeper implementation detail is indexed in [docs/README.md](docs/README.md).

## Major features completed

- Complete start-to-finish gameplay for Fresh Mix and all fifteen curated fifteen-question sets.
- Seeded, replay-stable question selection and answer shuffling, all prize checkpoints and payouts, final-answer confirmation, reveal states, walk-away flow, and millionaire result.
- Hint and Phone a Friend, including persisted use, an absolute call deadline, reload recovery, early termination, and answer input suppression during a call.
- Up to five named profiles plus Guest, dashboard resume/replacement decisions, per-profile history, statistics, question review, and curated-set progress.
- Exactly one global active save with revision checks, profile ownership, autosave, recovery, explicit multi-tab takeover, stale-controller read-only mode, and atomic terminal settlement.
- Full backup/restore and single-profile transfer with schema checks and conflict-safe application.
- Content Manager with search, enable/disable, duplicate/remove, export, file and pasted-JSON import, import preview, manual question/set authoring, sample/template downloads, and an AI-authoring prompt.
- Transactional inert-data validation for custom packs; imported content is never evaluated as code or inserted as raw HTML.
- Settings for music, effects, narration, speech voice/rate, mute, reduced motion, reduced glow, increased contrast, auto-advance, and fullscreen preference.
- Original SVG visual system, locally bundled Sora and Rajdhani fonts, recorded looped music, procedural sound effects, browser TTS with music ducking, and equivalent visible gameplay information when muted or speech is unavailable.
- Installable PWA with an update prompt, local-only production runtime, offline relaunch, Content Security Policy, and no dependency on remote game assets.
- Developer documentation, content tooling, unit/component/integration tests, and production Playwright coverage.

## Material interpretations and deviations

- The supplied one-shot package contained curation notes and external candidate URLs but no audio files, so the original implementation synthesized every cue and ambient tier. A later user-approved pass replaced only the ambient music with twelve locally supplied tracks; effects remain procedural. Provenance, processing, mapping, and playback behavior are documented in [docs/AUDIO_LEDGER.md](docs/AUDIO_LEDGER.md).
- Five supplied hints disclosed or nearly disclosed their answers. The source files remain byte-for-byte unchanged; only generated normalized records receive narrowly scoped hint repairs. Every before/after value is recorded in the validation report.
- Guest play uses the same durable local history/statistics machinery as named profiles, keyed to the Guest owner. This makes refresh, offline, and crash behavior consistent while still avoiding a named-profile requirement.
- The presentation scales as a fixed widescreen stage and shows a hard unsupported-size notice below 900 x 520. This is a pragmatic lower bound beneath the specified desktop target, not a mobile layout.
- Fresh Mix exposes Built-in and All Enabled source scopes. Imported packs can be disabled individually in Content Manager, but a dedicated Custom Only source-scope preset is not included.
- PWA install readiness is treated as a production-build capability. Development mode intentionally does not pretend that the generated service worker is active.

## Content ingestion result

The immutable release copy under `content/source/release-001` was verified against its supplied SHA-256 manifest after ingestion.

| Measure | Accepted result |
| --- | ---: |
| Source JSON files | 12 (5 pool, 7 curated) |
| Accepted questions | 525 unique |
| Rejected questions | 0 |
| Pool questions | 300 |
| Curated questions | 180 |
| Curated sets | 12 |
| Categories | 20 |
| Blocking errors | 0 |
| Editorial warnings | 1 |
| Normalization repairs | 5 records |
| Hash mismatches | 0 |

Coverage is complete: every one of the 20 categories has exactly 15 pool questions, one at each level 1 through 15; each level has 20 Fresh Mix questions and 35 questions across the whole catalog; every curated set has exactly 15 ordered questions; and there are nine single-category plus six mixed-category sets. There are no missing Fresh Mix levels or category/level cells.

All 525 records retain the `assistant-reviewed-draft` review status. The one non-blocking warning explicitly recommends human factual review and play-test calibration. The machine-readable evidence is in `content/normalized/release-001/validation-report.json`.

## Commands actually run

The implementation was installed and verified with these commands, including focused reruns while fixing failures:

```text
npm install
npx playwright install chromium
npm run normalize:content
npm run build:content
npm run validate:content
npm run typecheck
npx tsc --noEmit --noUnusedLocals --noUnusedParameters
npm test
npm run test:coverage
npm run build
npm run test:e2e
npm run validate
npm audit --omit=dev
```

## Verification results

The post-geography `npm run validate` completed successfully in 66.1 seconds on 2026-07-26. It ran TypeScript checking, source/content validation, the Vitest suite, a fresh content catalog build, a production Vite/PWA build, and the production Playwright suite.

- TypeScript: passed with no emitted output; unused-local and unused-parameter checks also passed and are enabled in `tsconfig.json`.
- Content: valid; all 12 SHA-256 hashes matched; 525 accepted questions, 15 sets, five documented repairs, zero errors, one editorial warning.
- Unit/component/integration: 12 files passed, 87 tests passed, 0 failed.
- Coverage run: 80.24% statements, 67.06% branches, 90.65% functions, and 80.24% lines across the configured application domains. No numeric threshold is configured.
- Production build: passed; 100 modules transformed. The generated PWA precache contains 26 entries totaling 39,033.51 KiB, including all 12 recorded music tracks.
- Production browser suite: 8 Chromium scenarios passed in 38.3 seconds. These cover exact refresh/resume state, both lifelines, a deterministic full millionaire run, offline relaunch/no external runtime requests, wrong-answer and Browser Back behavior, custom-pack import/management, multi-tab takeover, walk-away idempotency, and global-save replacement across profiles.
- Runtime dependency audit: `npm audit --omit=dev` reported 0 vulnerabilities.

The only build diagnostic is Vite's advisory that the main JavaScript chunk is larger than 500 kB: 1,041.31 kB minified and 195.23 kB gzip. It does not fail the build.

## Offline and PWA verification

Offline behavior was tested against the generated production build, not the development server. Playwright first loaded and exercised the installed build, then relaunched it in an offline browser context and confirmed that the title/application shell still rendered. The same scenario monitored gameplay traffic and failed on any external HTTP request; none occurred.

The final build generated `manifest.webmanifest`, `sw.js`, Workbox runtime files, and a 26-entry precache containing the application, bundled fonts, generated catalog, and all recorded music. An update-ready prompt is wired through the PWA registration lifecycle. Browser storage remains entirely local in IndexedDB.

## Accessibility verification

The implementation provides semantic headings and controls, labeled answer groups, modal dialog roles, polite live regions, a phone timer role, decorative-art hiding, visible `:focus-visible` treatment, A-D answer shortcuts, Escape/Back pause behavior, non-color correct/incorrect labels and icons, full visible text alongside narration, and settings for reduced motion, reduced glow, increased contrast, mute, and narration disablement.

React Testing Library verifies labeled four-choice interaction, A-D keyboard selection, semantic dialogs, timer text, disabled states during Phone a Friend, and simultaneous text/icon/color answer results. The production browser suite exercises the major dialogs and full gameplay state machine. The title and millionaire result were also rendered and visually inspected at 1440 x 900.

This verification is not a formal WCAG conformance claim. No axe scan, screen-reader session, automated pixel-diff project, Firefox/WebKit run, or full keyboard-only tour of every management screen was performed.

## Post-run observed defects

A hands-on review after the one-shot implementation identified the following three defects. They are documented here as of 2026-07-12, with their remediation status recorded individually.

### Profile-name field loses focus after each character

In the Create Profile dialog, typing into the display-name field updates `createName` and rerenders `App`. `App` supplies the dialog with a newly created inline `onClose` callback on every render. Because the shared `Modal` focus-management effect depends on that callback, the effect cleans up and runs again after every keystroke, moving focus to the first focusable control—normally the dialog's Close button. The player must therefore click the text field again before typing each subsequent character.

This is a focus-lifecycle defect, not an input-validation or IndexedDB problem. It was not exposed by the existing component suite because profile creation was covered as a completed workflow rather than with character-by-character focus assertions.

**Status: fixed.** The modal now keeps the latest Close callback in a ref while running its initial-focus and focus-trap effect only for the modal lifecycle. A regression test types a complete controlled name and verifies that the field retains focus across rerenders.

### Resuming a completed question repeats its narration

When a saved run is claimed, `claimSavedRun` unconditionally resets `lastNarratedQuestion.current` to `null`. The narration effect then sees that the current question is present in `displayedQuestionIds` but no longer has an in-memory narration marker, so it speaks the question again. This also occurs when the persisted phase is already `correct-reveal`, such as after answering correctly and choosing Save and Exit before resuming the run.

The saved gameplay state itself remains correct; the defect is limited to narration replay. The narration guard is session-memory state and does not distinguish an unanswered newly displayed question from an already resolved question restored from persistence.

**Status: fixed.** Resuming now reconstructs the narration marker from the persisted current question and `displayedQuestionIds`. Previously displayed questions are not spoken automatically on load, while a genuinely undisplayed next question remains eligible for narration; the explicit Replay Question control is unchanged. Focused tests cover both cases.

### Background music is an unpleasant continuous oscillator drone

The effects channel works, but the background-music implementation does not produce conventional music. Each tier starts only two indefinitely running Web Audio oscillators: a low sine wave and a low triangle wave at a fixed frequency pair. For example, the menu tier uses 55 Hz and 82.41 Hz. There is no rhythm, sequencing, harmonic progression, modulation, filtering, or evolving amplitude envelope.

The result is technically an active background-audio signal, but perceptually it is a low electronic drone or buzz and may sound especially poor on some speakers. This is a product-quality failure in the procedural-audio interpretation, even though the audio graph is functioning as written and the separately enveloped sound effects remain audible.

**Status: fixed.** Twelve user-supplied recordings now provide the intro, three gameplay levels, pause, and outro scenes. One track per run scene is selected from the random run ID, all tracks loop, and gameplay/pause positions are retained across repeated pauses. The oscillator implementation remains only for short effects.

## Known limitations and human review

- The built-in questions are structurally validated assistant-reviewed drafts. A human editor should factual-check all questions, hints, explanations, dates, names, and ambiguity before public editorial release.
- Difficulty levels and Phone a Friend pacing/confidence should be calibrated through real-player sessions; structural coverage cannot establish empirical difficulty.
- Browser speech voice availability and pronunciation differ by operating system. Only local English voices are preferred, and visible text remains authoritative.
- Recorded music and procedural effects should receive a final mix review on varied speakers and headphones. The repository owner must also confirm redistribution rights for the user-supplied music before public release.
- The release is desktop-first. Additional viewport/zoom, reduced-motion, high-contrast, keyboard-only, and screen-reader passes remain worthwhile before a broad public launch.
- Automated browser verification currently targets Chromium only. Firefox, WebKit, installed-PWA UX on each desktop OS, quota exhaustion, and destructive storage failure deserve separate compatibility testing.
- The single initial JavaScript chunk is functional but above Vite's advisory size threshold; route-level code splitting is a future performance improvement.
- Imported data is schema-validated and transactionally applied, but community content still requires the player's own factual/editorial trust decision.

The implementation was recorded as twelve local, subsystem-focused commits following the review sequence in [docs/COMMIT_PLAN.md](docs/COMMIT_PLAN.md). No push or remote publication was performed.
