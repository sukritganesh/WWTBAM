\# Quality Assurance and Comprehensive Test Strategy

Status: Working QA specification for the first-pass browser/PWA implementation. This document defines the required testing philosophy, risk areas, test layers, representative scenarios, release gates, and instructions for Codex to create a comprehensive but maintainable automated test suite.

\#\# 1\. Purpose and Non-Negotiable Testing Standard

Testing is a first-class product requirement, not a cleanup task after implementation.

The central integrity promise is:

Once a run begins, the player’s selected question sequence, answer ordering, current question, winnings, guaranteed checkpoint, lifeline state, profile ownership, seen-question history, and completed-run statistics must remain correct through ordinary play, refreshes, crashes, tab duplication, navigation attempts, interrupted writes, malformed content, service-worker updates, and unsupported browser features.

This checklist is a minimum coverage map, not an exhaustive enumeration of every test Codex must write.

Codex must inspect the actual implementation and derive additional tests from:

\- Every application state.  
\- Every game-state transition.  
\- Every reducer action.  
\- Every persistence write and migration.  
\- Every imported-data field and validation branch.  
\- Every browser lifecycle event used by the application.  
\- Every user-visible error and recovery path.  
\- Every asynchronous operation and potential race condition.  
\- Every destructive action.  
\- Every discovered bug or implementation-specific risk.

The final suite must be comprehensive without becoming bloated. Avoid many near-identical tests that exercise the same branch without adding risk coverage. Prefer table-driven tests, generated cases, reusable fixtures, parameterized scenarios, properties, and shared helpers when they express the behavior more clearly.

No feature is considered complete merely because its happy path works manually.

\#\# 2\. Test-Suite Design Principles

The suite should follow these principles:

\- Test externally meaningful behavior and critical invariants, not private implementation trivia.  
\- Test pure game rules exhaustively and cheaply.  
\- Test browser integration selectively but realistically.  
\- Make all random behavior deterministic under test through seeded or injectable randomness.  
\- Make time deterministic through fake clocks where appropriate.  
\- Test errors and recovery at the same priority as ordinary success paths.  
\- Use real IndexedDB behavior in repository and end-to-end tests where practical.  
\- Use mocks only at clear system boundaries.  
\- Keep tests independent and order-insensitive.  
\- Never depend on production question wording for core logic tests.  
\- Never let screenshots be the only evidence that a feature works.  
\- Add a permanent regression test for every meaningful defect discovered.  
\- Fail loudly when built-in content, migrations, or schemas are invalid.  
\- Do not silently skip critical tests because a browser feature is inconvenient.

A test should exist because it protects a rule, state transition, data invariant, recovery path, browser integration, or previously observed failure—not simply to increase a coverage percentage.

\#\# 3\. Required Test Layers

The implementation should use multiple complementary layers.

\#\#\# 3.1 Pure unit tests

Use fast unit tests for deterministic logic that does not require React, IndexedDB, audio, or a browser UI.

Primary subjects include:

\- Prize and checkpoint calculations.  
\- Walk-away payouts.  
\- Question selection and fallback ordering.  
\- Answer shuffling.  
\- Seen-question rules.  
\- State reducers and action legality.  
\- Statistics aggregation.  
\- Pack and question validation.  
\- Serialization and deserialization.  
\- Backup migration and validation.  
\- Content conflict resolution.

These tests should form the largest portion of the suite.

\#\#\# 3.2 Repository and persistence integration tests

Test the typed repository layer against a realistic IndexedDB test environment.

Primary subjects include:

\- Database creation and opening.  
\- Object-store reads and writes.  
\- Transactions and rollback.  
\- Save replacement.  
\- Profile deletion.  
\- Imported-pack lifecycle.  
\- Schema upgrades.  
\- Backup restoration.  
\- Corrupt or incomplete record handling.  
\- Write ordering and stale-write prevention.

\#\#\# 3.3 Component and interaction tests

Use React Testing Library or equivalent behavior-focused tools.

Primary subjects include:

\- Selection and focus behavior.  
\- Dialog confirmation.  
\- Disabled controls.  
\- Lifeline UI states.  
\- Settings controls.  
\- Profile limits.  
\- Error and warning presentation.  
\- Import preview and validation results.  
\- Keyboard interaction.

\#\#\# 3.4 End-to-end browser tests

Use Playwright for complete workflows in real browser contexts.

Primary subjects include:

\- Full games and terminal outcomes.  
\- Refresh and resume.  
\- Offline launch.  
\- Browser Back and Forward.  
\- Multi-tab control.  
\- PWA update behavior.  
\- Import and export.  
\- Fullscreen and window resizing.  
\- Browser storage recovery.

Chromium is the primary release-blocking E2E environment. Compatibility checks should also cover current Edge-equivalent Chromium behavior, Firefox, and WebKit/Safari where practical.

\#\#\# 3.5 Resilience, randomized, property-based, and adversarial tests

Use generated data and intentionally hostile scenarios for areas where enumerating a few examples is insufficient.

Primary subjects include:

\- Random legal and illegal action sequences.  
\- Pack schema fuzzing.  
\- Long strings and unusual Unicode.  
\- Transaction interruptions.  
\- Multiple-tab races.  
\- Corrupt database records.  
\- Old-schema migrations.  
\- Storage failures.  
\- Repeated save/load cycles.

\#\# 4\. Core Invariants

Codex should encode critical invariants as reusable assertions and check them after relevant actions.

At all times during an active run:

\- Current question index is between 1 and 15\.  
\- Exactly 15 resolved question snapshots exist for a valid run.  
\- No question appears twice in the same run.  
\- Answer ordering for a displayed or saved question is stable.  
\- At most one answer is selected.  
\- A locked answer never changes.  
\- A consumed lifeline never becomes available again.  
\- Winnings equal the value of the last correctly completed question.  
\- Guaranteed winnings equal the highest completed checkpoint.  
\- Guaranteed winnings never exceed current winnings.  
\- A profile can resume only its own save.  
\- There is at most one global saved run.  
\- A question is marked seen only after its screen is first displayed.  
\- A completed run cannot return to active gameplay.  
\- A committed completed run affects statistics exactly once.  
\- A stale tab or stale asynchronous callback cannot overwrite newer state.

After every import, restore, migration, or destructive operation:

\- Either the complete operation succeeds or the previous valid data remains unchanged.  
\- Active saves and historical reviews remain internally consistent.  
\- Built-in content cannot be overwritten by imported content.  
\- Imported content remains inert data and is never executed as code.

\#\# 5\. Game-Rule Coverage

Test the prize ladder and payout behavior at every level, not only at checkpoints.

For Questions 1 through 15, cover:

\- Prize before answering.  
\- Prize after a correct answer.  
\- Guaranteed payout after a wrong answer.  
\- Walk-away amount.  
\- Checkpoint status.  
\- Next-question transition.

Explicit boundary cases include:

\- Wrong on Question 1 awards $0.  
\- Wrong before completing Question 5 awards $0.  
\- Correct Question 5 secures $1,000.  
\- Wrong on Question 6 awards $1,000.  
\- Correct Question 10 secures $32,000.  
\- Wrong on Question 11 awards $32,000.  
\- Walking away after Question 14 awards $500,000.  
\- Correct Question 15 awards $1,000,000 and ends the game.  
\- Question 15 victory never presents a normal Continue action.

Use table-driven tests for all ladder levels to avoid repetitive test code.

\#\# 6\. Answer Selection, Confirmation, Lock-In, and Reveal

Cover the complete sequence:

No selection → selected answer → changed selection → lock request → final confirmation → committed lock → suspense → result reveal.

Required scenarios include:

\- Selecting A, B, C, or D.  
\- Changing the selected answer repeatedly before lock-in.  
\- Clicking the selected answer again.  
\- Mouse and keyboard producing equivalent state.  
\- Lock In disabled with no answer selected.  
\- Canceling final confirmation without losing the selection.  
\- Final confirmation displaying the exact selected letter and answer text.  
\- Double-clicking or repeatedly pressing Enter not submitting twice.  
\- Stale callbacks not changing the answer after lock-in.  
\- Other controls being unavailable during suspense.  
\- Correct reveal updating winnings once.  
\- Incorrect reveal showing both the chosen wrong answer and the correct answer.

The lock must be persisted before the suspense sequence begins. Test a crash, refresh, or tab closure immediately after final confirmation and verify that the run never returns to an editable answer state.

\#\# 7\. Lifeline Coverage

\#\#\# 7.1 Hint

Cover:

\- Use before selecting an answer.  
\- Use after selecting but before lock-in.  
\- One use per run.  
\- Repeated rapid clicks consuming it only once.  
\- Persistence after refresh or crash.  
\- Hint remaining visible for the current question.  
\- Narration enabled, muted, interrupted, and unavailable.  
\- Hint never selecting, eliminating, or locking an answer.  
\- Hint unavailable after final answer confirmation.

\#\#\# 7.2 Phone a Friend

Cover:

\- Activation confirmation.  
\- Exactly 60 seconds of call time.  
\- Single use per run.  
\- Lock In disabled during the call.  
\- Hint temporarily unavailable during the active countdown.  
\- End Call Early.  
\- Timer reaching zero.  
\- Pause ending and consuming the call.  
\- Help ending and consuming the call.  
\- Refresh during the call.  
\- Browser background-tab throttling.  
\- System clock changes.  
\- Timer never becoming negative.  
\- Final countdown sounds stopping after call completion.  
\- Repeated activation clicks not creating multiple timers.

The call should be driven by an absolute deadline rather than relying only on decrementing UI state. Tests should advance fake time and also use real-browser timing for representative E2E checks.

\#\# 8\. Walk-Away Coverage

Cover:

\- Walking away before answering Question 1\.  
\- Walking away before final lock-in on later questions.  
\- Walking away after a correct answer and before proceeding.  
\- Exact amount shown in confirmation.  
\- Cancel preserving the live run.  
\- Confirm ending the run exactly once.  
\- Double-click and repeated-key protection.  
\- Unavailability during suspense and after an incorrect answer.  
\- Refresh while the confirmation dialog is open.  
\- Correct history and statistics entry.

\#\# 9\. Question Selection and Content-Source Coverage

\#\#\# 9.1 Fresh Mix

For every ladder level, test:

\- Exactly one eligible question is selected.  
\- Never-seen questions receive first priority.  
\- Seen-fewest questions receive the next priority.  
\- Least-recently-seen questions receive the next priority.  
\- Random selection occurs only among valid ties.  
\- Disabled packs are excluded.  
\- Source filters are respected.  
\- Curated-set-only content is excluded unless explicitly selected.  
\- No duplicate appears in the run.  
\- A fixed random seed produces repeatable output.

Cover exhaustion and failure:

\- No unseen questions at one level.  
\- Only one eligible question at one level.  
\- No eligible question at one level.  
\- A pack becoming disabled during setup.  
\- A malformed eligible question being rejected.  
\- Run generation failure preserving the previous global save.

\#\#\# 9.2 Curated sets

Cover:

\- Exactly 15 unique questions.  
\- One valid level from 1 through 15\.  
\- Fixed question order.  
\- Answer order reshuffled for a new attempt.  
\- Answer order fixed within a saved attempt.  
\- Replay not mutating old history.  
\- Imported and built-in sets behaving consistently.

\#\#\# 9.3 Content changes after run creation

A run stores resolved snapshots. Cover pack disabling, updating, or removal after the run starts and verify that the current save and historical review remain playable and accurate.

\#\# 10\. Seen, Answered, and History Semantics

Cover the distinctions among reserved, displayed, seen, answered, and reviewed.

Required cases include:

\- Reserving all 15 questions does not mark them seen.  
\- The pre-game screen marks nothing seen.  
\- First display marks only the current question seen.  
\- Refreshing the same question does not increment its seen count again.  
\- Undisplayed questions remain unseen after abandonment or save replacement.  
\- A displayed walk-away question is seen but unanswered.  
\- Hint usage is attributed only to the current question.  
\- Post-game review does not add another seen event.  
\- Correct and incorrect counts update only for submitted answers.

\#\# 11\. Save Integrity, Autosave, Crash, and Recovery

Simulate closure, crash, forced reload, and process interruption at every meaningful state boundary, including:

\- Immediately after run creation.  
\- During question narration.  
\- After answer selection.  
\- With final confirmation open.  
\- Immediately after final answer commitment.  
\- During suspense.  
\- Immediately after correct reveal.  
\- Before Continue.  
\- During Phone a Friend.  
\- After Hint reveal.  
\- While paused.  
\- During Save and Exit.  
\- During walk-away commit.  
\- During completed-run statistics commit.

After restoration, verify:

\- Same questions.  
\- Same answer ordering.  
\- Same current question.  
\- Same selection.  
\- Same lifelines.  
\- Same hint state.  
\- Same winnings and checkpoint.  
\- Same profile ownership.  
\- No duplicated run result.  
\- No editable committed answer.

\#\#\# 11.1 Save revision ordering

Every saved snapshot should carry a monotonically increasing revision or equivalent ordering token.

Test delayed writes in which an older write completes after a newer write. The newer state must remain authoritative.

Test failed writes, retries, duplicated callbacks, and app shutdown during a transaction.

\#\# 12\. Browser Back, Forward, Refresh, and Direct Navigation

During active gameplay:

\- Back must never reveal a prior question as editable.  
\- Forward must never replay a stale transition or duplicate an answer result.  
\- Refresh must restore the exact state.  
\- Repeated refreshes must not duplicate seen counts or statistics.  
\- Direct access to a gameplay location without a valid save must return safely to the title or profile flow.  
\- Browser history must not bypass final-answer, save-replacement, profile-deletion, restore, or walk-away confirmations.

Test Back and Forward from dialogs, Pause, Help, results, dashboard, setup, and active gameplay.

\#\# 13\. Multi-Tab and Multiple-Window Behavior

Use a single active gameplay controller policy.

Only one tab may actively control the current saved run. Another tab may access safe menus but must not answer, consume lifelines, or write gameplay state unless it explicitly takes control.

Test:

\- Tab A starts a run and Tab B opens the app.  
\- Tab B detects that the run is active elsewhere.  
\- Tab B cannot interact with the live run.  
\- Explicit takeover transfers authority.  
\- The old controller becomes read-only or safely exits the active game view.  
\- Tab A crashes and Tab B takes over after the defined safe condition.  
\- Both tabs attempt takeover simultaneously.  
\- A stale background tab returns and tries to save old state.  
\- One tab starts a replacement run while another controls the current save.  
\- One tab changes settings while another plays.  
\- One tab imports, disables, updates, or removes a referenced pack.  
\- One tab restores a backup while another is active.  
\- BroadcastChannel unavailable or interrupted.

The controller mechanism should use controller identity, save revision, and heartbeat or equivalent coordination. Stale controllers must never overwrite newer progress.

\#\# 14\. Profiles, Guest Mode, and Ownership

Cover:

\- Profile creation.  
\- Duplicate display names with distinct internal IDs.  
\- Maximum 20 named profiles.  
\- Guest availability at the profile limit.  
\- Empty and whitespace-only names.  
\- Unicode, punctuation, and maximum-length names.  
\- Profile deletion and cancellation.  
\- Deleting the save-owning profile.  
\- Deleting a non-owning profile.  
\- Switching profiles without history leakage.  
\- Guest save ownership.  
\- Wrong-profile resume attempts.  
\- Single-profile export and import.  
\- Import at the 20-profile limit.  
\- New internal ID assignment on import.

\#\# 15\. Statistics, Run History, and Idempotency

Cover all terminal outcomes and ensure every completed run is committed once.

Verify:

\- Games played.  
\- Correct and incorrect answers.  
\- Accuracy.  
\- Walk-away count.  
\- Millionaire wins.  
\- Highest question.  
\- Highest prize.  
\- Total virtual winnings.  
\- Lifeline usage.  
\- Seen versus answered counts.  
\- Curated-set attempts and wins.  
\- First-attempt and no-lifeline recognition.  
\- Run duration.

Test repeated results-screen visits, refreshes, Back and Forward, multiple tabs, failed transactions, and backup restores. None may record the same run twice.

Removing or updating a content pack must not erase or rewrite historical results.

\#\# 16\. Question-Pack and Imported-Data Validation

Create a fixture matrix covering malformed, hostile, outdated, and boundary-valid files.

Representative invalid cases include:

\- Invalid or truncated JSON.  
\- Empty input.  
\- Wrong root type.  
\- Missing or unsupported schema version.  
\- Missing or invalid pack ID.  
\- Duplicate pack, set, or question IDs.  
\- Built-in namespace collision.  
\- Missing prompt.  
\- Wrong field types.  
\- Zero, three, five, or otherwise invalid answer counts.  
\- No correct answer.  
\- Multiple correct answers.  
\- Correct answer referencing a missing choice.  
\- Missing hint or explanation.  
\- Level 0, Level 16, non-integer, or missing level.  
\- Curated sets with fewer or more than 15 questions.  
\- Repeated question within a set.  
\- Duplicate ladder level within a set.  
\- Missing set reference.  
\- Broken question reference.  
\- Null values in required fields.  
\- Overlong strings.  
\- Excessive pack size or question count.  
\- Unicode control characters.  
\- Prototype-pollution-shaped keys such as \_\_proto\_\_.  
\- Script tags, event handlers, javascript URLs, or unsupported markup.  
\- Same pack version with different content.  
\- Downgrade and update conflicts.

The importer must never partially commit an invalid pack. It must preserve existing packs, profiles, saves, and history after every failed import.

Validation errors should identify the location and reason clearly enough for the user or an external AI authoring workflow to correct the file.

\#\# 17\. Built-In Content and Asset Tampering

Validate bundled content during development and at safe runtime boundaries.

Test:

\- Missing question file.  
\- Invalid built-in JSON.  
\- Duplicate built-in IDs.  
\- Broken set references.  
\- Missing Fresh Mix ladder level.  
\- Invalid answer structure.  
\- Missing hint or explanation.  
\- Mismatched manifest or content version.  
\- Missing audio asset.  
\- Missing font or SVG.  
\- Corrupt service-worker asset manifest.

Invalid built-in content must not enter gameplay. The app should fail safely, preserve all user data, provide a useful diagnostic, and retain backup/export access where possible.

A generated file manifest or hashes may be used to detect accidental corruption, but this is not intended as DRM or anti-tamper security.

\#\# 18\. Backup, Restore, and Export

Cover:

\- Valid full backup export and restore.  
\- Single-profile export and import.  
\- Question-pack export and reimport.  
\- Round-trip semantic equivalence.  
\- Wrong schema version.  
\- Truncated or manually altered backup.  
\- Missing required stores or fields.  
\- Duplicate profile IDs.  
\- More than 20 profiles.  
\- Malformed active save.  
\- Malformed custom packs inside a backup.  
\- Restore while a game is active.  
\- Restore while another tab is active.  
\- Canceling restore.  
\- Transaction failure during restore.  
\- Migration from older backup schemas.

The restore sequence must parse, validate, migrate in memory, show a summary, request confirmation, commit transactionally, and verify the committed data. Current data must remain unchanged after any pre-commit failure.

\#\# 19\. IndexedDB and Storage Failure Coverage

Simulate or inject:

\- Database open failure.  
\- Upgrade failure.  
\- Transaction abort.  
\- Quota exceeded.  
\- Missing object store.  
\- Unexpected schema version.  
\- Corrupt record.  
\- Storage cleared while the application is open.  
\- Private or restricted browsing behavior.  
\- Delayed and out-of-order writes.  
\- Partial browser shutdown during persistence.

The UI must never claim that a save succeeded when it did not.

A failed autosave should produce a clear warning, preserve in-memory state where safe, prevent silent destructive navigation, and offer retry or emergency export where feasible.

\#\# 20\. PWA, Service Worker, Offline, and Update Coverage

Cover:

\- First online load.  
\- Installation prompt and installed launch.  
\- Complete offline relaunch.  
\- Offline refresh.  
\- Cache readiness reporting.  
\- Partial initial cache.  
\- Missing cached audio.  
\- Cache storage cleared.  
\- Update discovered on the dashboard.  
\- Update discovered during a live run.  
\- Update deferred until a safe state.  
\- Failed update download.  
\- Old service worker with new IndexedDB schema.  
\- New application code with old cached assets.  
\- Recovery from a failed asset cache.

The app must never claim complete offline readiness until all assets required for a complete run are available. A service-worker update must never force a reload during an active run.

\#\# 21\. Audio and Text-to-Speech Coverage

\#\#\# 21.1 Audio channels

Verify independently:

\- Master mute.  
\- Music mute and volume.  
\- Effects mute and volume.  
\- Voice mute and available volume behavior.  
\- Restoration of previous channel settings after master mute.  
\- Music ducking during narration.  
\- No duplicated music loops after tab visibility changes.  
\- AudioContext suspend and resume.  
\- Missing or corrupt audio asset fallback.  
\- Rapid clicks and hover events not causing excessive stacking.

\#\#\# 21.2 Speech synthesis

Cover:

\- No voices available.  
\- Voice list arriving asynchronously.  
\- Stored voice disappearing.  
\- Fallback voice selection.  
\- Question-only narration.  
\- Question-and-answer narration.  
\- Hint narration.  
\- Replay and Skip Voice.  
\- Pause, Help, lock-in, question change, and replacement speech interrupting active narration.  
\- Muted narration creating no gameplay delay.  
\- Speech errors not blocking gameplay.  
\- Browser-specific voice differences.

\#\# 22\. Fullscreen, Scaling, Resizing, and Visual Regression

Test representative viewport and display configurations:

\- 1920 x 1080\.  
\- 1600 x 900\.  
\- 1366 x 768\.  
\- 1280 x 720\.  
\- Ultrawide display.  
\- 4:3 or taller display.  
\- Browser zoom changes.  
\- High device-pixel ratio.  
\- Entering and exiting fullscreen.  
\- Fullscreen permission denied.  
\- Resize during ordinary play.  
\- Resize during Phone a Friend.  
\- Very long valid question and answer text.  
\- Font fallback.  
\- Reduced motion and reduced glow.

Verify aspect-ratio preservation, no stretching, no essential clipping, visible primary controls, readable question text, stable prize ladder, and correct letterboxing or pillarboxing.

Use targeted screenshot comparisons for major stable screens, but do not overuse fragile pixel-perfect snapshots for animated or browser-variable content.

\#\# 23\. Keyboard, Focus, and Accessibility

Cover:

\- Complete mouse-free gameplay.  
\- A, B, C, and D shortcuts.  
\- Shortcuts disabled while typing in a text field.  
\- Enter activating only the intended focused action.  
\- Escape behavior in dialogs, fullscreen, and ordinary gameplay.  
\- No keyboard shortcut bypassing a destructive or final-answer confirmation.  
\- Visible focus.  
\- Focus trapping in modals.  
\- Focus restoration after closing a modal.  
\- Icon-only controls having accessible names.  
\- Correct and incorrect states conveyed by more than color alone.  
\- Screen-reader announcements for important state changes where implemented.  
\- Reduced-motion behavior.  
\- Muted play remaining fully understandable.

\#\# 24\. Randomized State-Machine and Property Testing

Generate many legal and illegal action sequences against the pure reducer and state coordinator.

Examples may combine:

\- Answer selection.  
\- Selection changes.  
\- Hint.  
\- Phone a Friend.  
\- Pause and resume.  
\- Help.  
\- Lock-in.  
\- Confirmation cancellation.  
\- Refresh simulation.  
\- Continue.  
\- Walk away.

After each generated action, assert all core invariants.

Useful properties include:

\- Answer shuffling returns each original answer exactly once.  
\- Fresh Mix returns one eligible question per level.  
\- No question repeats within a run.  
\- Save serialize/deserialize preserves semantic state.  
\- Import/export round trips preserve semantic content.  
\- Migrations are deterministic and idempotent.  
\- Guaranteed payout never exceeds current winnings.  
\- Statistics equal the valid committed run records.  
\- Invalid actions never create illegal state.

Use shrinking or minimized failure output where the selected property-testing tool supports it so failures remain understandable.

\#\# 25\. Performance, Scale, and Longevity

Test with realistic maximum and stress fixtures:

\- 20 profiles.  
\- Large run histories.  
\- Large question histories.  
\- Many installed packs.  
\- Large but valid question banks.  
\- Repeated save/load cycles.  
\- Repeated profile switching.  
\- Long-running game sessions.  
\- Repeated PWA updates.  
\- Repeated import, disable, update, and remove operations.

Measure or assert reasonable behavior for:

\- Startup.  
\- Database opening and migration.  
\- Question selection.  
\- Autosave latency.  
\- Content Manager search and filtering.  
\- Memory growth.  
\- Audio-buffer use.  
\- Phone timer stability.

Avoid brittle microbenchmarks. Protect against obvious regressions and unbounded growth.

\#\# 26\. Required Test Fixtures

Create dedicated deterministic fixtures rather than relying on production content.

Include at least:

\- A valid 15-question set with predictable correct answers.  
\- A deterministic millionaire-win set.  
\- A deterministic wrong-answer path.  
\- A maximum-length valid-content pack.  
\- A minimal valid Fresh Mix bank.  
\- An exhausted-question bank.  
\- A bank missing one ladder level.  
\- Valid and invalid imported packs for each validation class.  
\- Corrupt active saves.  
\- Old database snapshots for every supported migration path.  
\- Old backup files for every supported backup migration.  
\- Multi-tab and stale-controller states.  
\- Storage-error and quota-error doubles.

Fixtures should be small, readable, named by purpose, and shared across test layers where appropriate.

\#\# 27\. Coverage and Quality Gates

Coverage numbers are indicators, not substitutes for meaningful testing.

Expected standards:

\- Near-complete branch coverage for prize rules, reducers, question selection, validators, migrations, backup logic, and statistics.  
\- Approximately 95% branch coverage or better for critical pure logic unless an exclusion is justified.  
\- Interaction coverage for all gameplay controls and destructive dialogs.  
\- End-to-end coverage of incorrect answer, walk-away, and millionaire victory.  
\- At least one browser-level recovery test for every major persistence or lifecycle class.  
\- Every discovered regression receives a permanent test.

Do not add meaningless tests solely to raise a percentage. Uncovered critical branches must be tested or explicitly justified.

\#\# 28\. Continuous Integration Pipeline

The normal validation pipeline should include:

1\. TypeScript type checking.  
2\. Linting or equivalent static checks.  
3\. Built-in question-bank validation.  
4\. Unit tests.  
5\. Repository and migration tests.  
6\. Component tests.  
7\. Production build.  
8\. PWA manifest and service-worker validation.  
9\. Playwright Chromium suite.  
10\. Offline Playwright suite.  
11\. Multi-tab and crash-recovery suite.  
12\. Firefox and WebKit compatibility suite where practical.

Tests should produce useful failure output, preserve Playwright traces or screenshots on failure, and use deterministic seeds that can be replayed.

\#\# 29\. Release-Blocking Conditions

The implementation is not complete if any of these remain possible:

\- A locked answer can change.  
\- Refresh changes questions or answer order.  
\- Refresh refunds a lifeline.  
\- A completed run records twice.  
\- Another profile resumes the save.  
\- Two tabs silently overwrite one another.  
\- Browser Back exposes an earlier editable question.  
\- Starting a failed new run destroys the previous save.  
\- Invalid packs partially import.  
\- A restore destroys current data before complete validation.  
\- A service-worker update interrupts a live run.  
\- Offline play fails after the app claims readiness.  
\- Missing audio or TTS blocks gameplay.  
\- A malformed built-in question reaches gameplay.  
\- A stale asynchronous write overwrites newer state.  
\- A removed or updated pack corrupts an active save or historical review.  
\- A persistence failure is falsely reported as a successful save.  
\- Critical keyboard or confirmation behavior can be bypassed.

\#\# 30\. Regression and Test-Maintenance Policy

For every meaningful bug found during implementation or QA:

1\. Reproduce the failure.  
2\. Add the smallest test that proves the bug.  
3\. Confirm the test fails before the fix when practical.  
4\. Implement the fix.  
5\. Confirm the regression test and broader suite pass.

Periodically remove redundant tests that protect no unique behavior, but never remove coverage for a critical invariant or prior regression without an equivalent replacement.

When an implementation detail changes, update tests to preserve product behavior rather than mechanically preserving obsolete internals.

\#\# 31\. Codex Completion Requirement

Codex must not stop after implementing only the examples in this document.

Before declaring the project complete, Codex must:

\- Enumerate the implemented states, transitions, repositories, schemas, asynchronous boundaries, browser APIs, and destructive operations.  
\- Map each of them to appropriate automated coverage.  
\- Identify implementation-specific risks not explicitly listed here.  
\- Add concise tests for those risks.  
\- Run the complete suite.  
\- Fix all failures caused by the implementation.  
\- Report any environment-limited browser checks honestly.  
\- Leave the repository with clear commands for unit, component, E2E, offline, and full validation runs.

The desired outcome is not the largest possible test count. It is a compact, understandable, high-confidence suite that comprehensively protects the game’s rules, data, browser behavior, recovery paths, and future extensibility.

