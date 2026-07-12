\# One-Shot Codex Implementation Prompt

\#\# Mission

Build the complete, polished, production-quality browser game described by the full planning package in this project directory. This is not a request for a scaffold, mockup, architecture sketch, or partial prototype. Implement the working application, integrate the supplied question content, test it thoroughly, document it, and leave a repository that another developer can clone and run successfully.

The required first release is a local-first React, TypeScript, and Vite web application with PWA support. It must implement the millionaire-style fifteen-question trivia experience, profiles, one global resumable save, Fresh Mix, curated sets, lifelines, history, statistics, content management, accessibility, audio and speech behavior, offline operation, persistence, recovery, and the other requirements described in the project files.

Work autonomously. Do not stop to ask clarifying questions. Do not use Plan Mode. Inspect the complete project package, make thoughtful implementation decisions, execute the work, run the relevant checks, fix failures, and finish the repository in this run.

\#\# 1\. Read and understand the complete input package

Before making major architectural or implementation decisions, inspect all planning documents and content files available in the project, including at minimum:

\- PRODUCT\_SPEC.md  
\- DESIGN\_SPEC.md  
\- TECHNICAL\_SPEC.md  
\- QA\_CHECKLIST.md  
\- QUESTION\_BANK\_SPEC.md, the question-bank and content specification  
\- AUDIO\_CURATION.md and the audio\_sources folder  
\- Question Content Release 001 \- Overview  
\- Question Content Release 001/manifests/manifest.json  
\- Question Content Release 001/manifests/coverage-index.json  
\- Every JSON file in Question Content Release 001/pool\_json  
\- Every JSON file in Question Content Release 001/curated\_sets\_json  
\- Any other planning, content, schema, or reference files present in the supplied project directory

Do not rely only on filenames or summaries. Inspect the actual text and actual JSON structures. Understand the product as a whole before deciding how its pieces fit together.

The planning package is the source of product intent. It is possible that some details are incomplete, examples are outdated, wording differs across files, or two documents imply slightly different implementation choices. This must not block the build.

\#\# 2\. Interpretation, precedence, and creative discretion

Treat the supplied files as strong and detailed guidance, not as a brittle collection of isolated sentences that must be implemented literally even when they conflict.

Follow this precedence order when reconciling the package:

1\. This final Codex prompt.  
2\. Clearly marked settled decisions, hard invariants, and explicit final requirements in the planning files.  
3\. Product behavior and data-integrity requirements.  
4\. Technical architecture, persistence, recovery, and QA requirements.  
5\. Design-system and user-experience guidance.  
6\. Illustrative examples, conceptual schemas, suggested filenames, and older wording.

Apply these rules:

\- Preserve core gameplay, persistence, content-integrity, offline, accessibility, and user-safety invariants.  
\- Reconcile contradictions intelligently rather than implementing two incompatible behaviors.  
\- Fill unspecified gaps with sensible, polished, internally consistent decisions.  
\- Create missing components, screens, states, utilities, schemas, copy, error handling, migration behavior, and visual details when required for a complete product.  
\- Prefer a coherent working product over a literal but broken transcription of the documents.  
\- Do not discard a major requested feature merely because a minor detail is unclear.  
\- When an example conflicts with a later settled rule, follow the later settled rule.  
\- When several valid implementation approaches exist, choose the one that best supports reliability, maintainability, testing, and the intended premium game experience.  
\- Be creative where creativity is needed, while remaining faithful to the project’s visual identity and product intent.

Record material interpretation decisions in docs/IMPLEMENTATION\_NOTES.md. Include contradictions found, the interpretation chosen, important gaps filled, and any material deviation from the planning package. Do not clutter this file with trivial coding choices.

\#\# 3\. Complete-product expectation

Implement the actual game and all supporting systems needed for it to function as a polished standalone product. At completion, a user should be able to install dependencies, start the application, create or use a profile, begin either a Fresh Mix or curated-set run, answer questions, use lifelines, walk away, lose, win, resume after refresh or restart, review history, inspect statistics, manage content, configure settings, and use the application offline after the required PWA assets have been cached.

Do not pass off placeholders, dead buttons, static mock screens, TODO-driven architecture, empty data repositories, or superficial happy-path demonstrations as completion.

The application must remain local-only during gameplay. Do not add a backend, login service, cloud database, analytics, advertising, telemetry, or gameplay-time network dependency.

\#\# 4\. Supplied question content: preserve, inspect, normalize, and load

The supplied question JSON files are substantial source material. Codex is responsible for understanding their real structures and making them load correctly in the finished application.

\#\#\# 4.1 Preserve immutable originals

Copy the supplied release into the repository as immutable source content. A recommended arrangement is:  
Apply the known wording-only normalization repairs listed in the Question Content Release 001 overview to generated or normalized copies. Preserve every original source file, stable question ID, prompt, answer set, correct answer, category, level, and usage membership.

content/  
  source/  
    release-001/  
      pool/  
      curated-sets/  
      manifests/  
  normalized/  
    release-001/

The exact directory names may be adjusted if a clearer repository structure is chosen, but the following invariant is mandatory: the original supplied JSON files must remain unmodified and distinguishable from any sanitized, migrated, normalized, or generated copies.

Do not edit the original question JSON files in place.

\#\#\# 4.2 Inspect both specifications and actual files

Use the text specifications to understand intended semantics, but use the actual JSON files to understand the supplied representation. Do not assume that conceptual examples in QUESTION\_BANK\_SPEC.md exactly match every release file.

If the planning documents and the JSON files differ in compatible ways, create an ingestion and normalization layer that resolves those differences. The game must know how to load the supplied content rather than requiring a human to rewrite it first.

\#\#\# 4.3 Safe automatic normalization

Codex may create normalized copies and may automatically repair compatible source issues such as:

\- UTF-8 byte-order marks.  
\- Line-ending differences.  
\- Whitespace and trimming problems.  
\- Missing optional arrays or optional metadata.  
\- Compatible older schema versions.  
\- Category capitalization or known category aliases.  
\- Derivable display difficulty bands and internal difficulty tiers.  
\- Minor field-name differences that can be mapped unambiguously.  
\- Manifest paths that need adaptation to the repository layout.  
\- Embedded curated-set content that needs conversion into the chosen normalized set representation.  
\- Harmless ordering and formatting inconsistencies.

Preserve stable IDs whenever the logical question is unchanged. Preserve provenance for every normalized record, including its source release, source filename, source pack or set, and original question ID.

\#\#\# 4.4 Do not silently rewrite substantive content

Do not casually change question wording, answers, hints, or explanations. A substantive content change is permitted only when needed to repair an obvious defect, eliminate an unambiguous structural inconsistency, or make a supplied question safely loadable. Record every substantive repair in a generated validation or normalization report.

The supplied review status may indicate assistant-reviewed draft content. Structurally valid built-in questions should still be available to the game while retaining their review metadata. Do not reject the entire bank merely because human factual review is still recommended.

\#\#\# 4.5 Warnings versus blocking failures

Distinguish repairable warnings from blocking errors.

Repairable warnings may include encoding markers, line endings, missing derived metadata, empty optional fields, known category aliases, or a compatible schema version.

Blocking errors include irrecoverably malformed JSON, missing prompts, an invalid exact level, fewer or more than four usable choices, no correct answer, multiple correct answers, duplicate global identities that cannot be namespaced safely, broken curated-set membership that cannot be resolved, unsupported executable content, or ambiguity that makes the correct answer unknowable.

A malformed file or record must not partially corrupt the runtime catalog. Use transactional ingestion behavior where appropriate.

\#\#\# 4.6 Runtime catalog

Raw source files are not runtime silos. Create a validated, normalized catalog that combines built-in content and enabled imported content under a common internal model.

Fresh Mix must select from this normalized catalog by exact level, profile encounter history, source eligibility, review and expiration eligibility, and category or subject diversity. It must not randomly choose a JSON file and then select only from that file.

Curated sets must retain fixed level order while allowing answer-position shuffling for each new attempt and preserving that shuffle inside a saved run.

The expected supplied release contains approximately:

\- 300 Fresh Mix pool questions.  
\- 20 primary categories.  
\- 15 pool questions per category, covering Levels 1 through 15\.  
\- 12 curated fifteen-question sets.  
\- 180 curated-set questions.  
\- 480 unique questions in total.

Verify the actual files and report the actual accepted counts. Repair compatible issues when possible. If any records must be rejected, explain exactly why and preserve the original source files.

\#\#\# 4.7 Content tooling

Create maintainable content tooling, such as:

scripts/content/validate-content.ts  
scripts/content/normalize-content.ts  
scripts/content/build-catalog.ts

Equivalent locations and filenames are acceptable. Provide package scripts that perform content validation and catalog generation reproducibly. Generated runtime content must either be committed deliberately or be rebuilt automatically by documented install or build commands; the application must never depend on an untracked artifact that existed only in the Codex environment.

Create tests for valid content, repairable content, blocking failures, manifest integrity, duplicate IDs, category aliases, set references, complete level coverage, and transactional import behavior.

\#\# 5\. Repository architecture and maintainability

Use the architecture described in TECHNICAL\_SPEC.md as the primary foundation: React, TypeScript, Vite, PWA support, typed state transitions or reducer/state-machine behavior, IndexedDB through the selected repository abstraction, and comprehensive tests.

Keep domain rules separate from rendering. Centralize prize and checkpoint logic, question-selection rules, save ownership, content normalization, persistence migrations, and run completion so they are not duplicated across components.

Use strong TypeScript types. Validate all untrusted imported content at runtime. Avoid unsafe casts that bypass the content model or persisted-state schema.

Implement migrations and defensive loading for persisted application data. A corrupt record must not make the whole application permanently unusable. Provide safe reset, recovery, or quarantine behavior where appropriate.

Comment code where the reason is non-obvious, especially for:

\- State invariants.  
\- Persistence ordering.  
\- Save revisions and stale-write prevention.  
\- Multi-tab ownership.  
\- Crash recovery.  
\- Content migration and repair logic.  
\- Service-worker update behavior.  
\- Browser-specific audio or speech workarounds.

Do not add comments that merely narrate obvious syntax.

\#\# 6\. Repository must be cloneable and runnable

Leave a self-contained repository that works after a fresh clone.

The repository must include:

\- package.json with complete and useful scripts.  
\- A committed package-manager lockfile.  
\- A supported Node version declaration through engines, .nvmrc, or an equivalent clear mechanism.  
\- All required application, content, test, and configuration files.  
\- No undeclared globally installed tools.  
\- No hidden dependency on the Codex workspace.  
\- No absolute machine-specific paths.  
\- No required secrets for ordinary local operation.  
\- A production build that can be previewed locally.  
\- Correct PWA manifest, icons or generated substitutes, service-worker configuration, and offline assets.

At minimum, provide clear equivalents of these workflows:

\- Install dependencies.  
\- Start the development server.  
\- Build the production application.  
\- Preview the production build.  
\- Run unit and component tests.  
\- Run end-to-end tests.  
\- Validate and normalize question content.  
\- Run the complete validation suite.

The exact package manager and script names may differ, but every documented command must actually work.

\#\# 7\. Required documentation

Documentation is part of the product, not optional cleanup.

Create an easy-to-read root README.md that includes:

\- What the project is.  
\- Major features.  
\- Prerequisites.  
\- Installation.  
\- Development startup.  
\- Production build and preview.  
\- Test commands.  
\- Content-validation commands.  
\- Offline and PWA notes.  
\- Project structure.  
\- Links to deeper documentation.  
\- Known limitations that genuinely remain.

Create focused documentation under docs, including at minimum:

\- docs/README.md — documentation index.  
\- docs/ARCHITECTURE.md — application architecture, state model, persistence, catalog, PWA, audio, and major boundaries.  
\- docs/DEVELOPMENT.md — environment, scripts, coding conventions, IndexedDB debugging, data reset, and development workflow.  
\- docs/CONTENT\_PIPELINE.md — immutable sources, normalization, schemas, manifests, provenance, validation, adding a pool file, and adding a curated set.  
\- docs/TESTING.md — test layers, commands, fixtures, coverage expectations, Playwright setup, and regression workflow.  
\- docs/IMPLEMENTATION\_NOTES.md — material interpretation decisions, contradictions resolved, and meaningful deviations.  
\- docs/TROUBLESHOOTING.md — common setup, browser, storage, service-worker, audio, and test issues.  
\- docs/COMMIT\_PLAN.md — a proposed logical commit sequence, described below.

Create content/README.md explaining the content directory, question schema, category and level model, immutable source policy, normalized outputs, stable IDs, and review-status meanings.

Create IMPLEMENTATION\_REPORT.md at the repository root as the final implementation and validation record.

Additional focused README files are encouraged where they genuinely make a subsystem easier to understand. Avoid redundant documentation that says the same thing in several places.

\#\# 8\. Git preparation without committing

Create a correct root .gitignore suitable for this repository. It should ignore at minimum dependency directories, build outputs, coverage, Playwright artifacts, temporary browser profiles, local logs, operating-system files, local environment files, editor-specific clutter, temporary content staging, and local database exports. Do not ignore required source content or required reproducible runtime assets.

Prepare the repository for clean version control, but do not create Git commits, do not push, do not open a pull request, and do not claim that commits occurred.

Create docs/COMMIT\_PLAN.md with a proposed logical history. It should break the work into reviewable commits rather than one giant initial commit. A sensible sequence may include:

1\. Project initialization and tooling.  
2\. Application shell and design system.  
3\. Core game domain and prize rules.  
4\. Persistence, profiles, and global save ownership.  
5\. Content ingestion and normalized catalog.  
6\. Fresh Mix and curated-set selection.  
7\. Lifelines and gameplay interactions.  
8\. History, statistics, and content management.  
9\. Audio, speech, settings, and accessibility.  
10\. PWA and offline behavior.  
11\. Unit, integration, and browser tests.  
12\. Documentation and release validation.

Adjust the sequence to match the actual implementation. For every proposed commit, include its purpose and the main files or subsystems that belong to it. Do not fabricate commit hashes.

\#\# 9\. Testing and quality assurance

Treat QA\_CHECKLIST.md as a mandatory minimum coverage map, not an exhaustive list. After implementation, inspect the real architecture and identify additional implementation-specific risks.

Test at multiple levels:

\- Pure domain and reducer tests.  
\- Content schema, migration, normalization, and selection tests.  
\- Repository and IndexedDB tests.  
\- React component and interaction tests.  
\- End-to-end browser tests.  
\- Offline and service-worker tests.  
\- Multi-tab ownership and stale-write tests.  
\- Refresh and crash-recovery tests.  
\- Accessibility and keyboard tests.  
\- Randomized or property-style state-machine tests where valuable.  
\- Visual or layout regression checks where practical.

Explicitly test prize boundaries, checkpoints, walk-away payouts, wrong-answer payouts, answer locking, persistence before suspense, both lifelines, Phone a Friend deadline recovery, Fresh Mix freshness and diversity, curated-set order, answer shuffle persistence, profile ownership, Guest behavior, run-history idempotency, import transactions, malformed content, backup and restore, storage failures, Back and Forward navigation, direct navigation, service-worker update handling, TTS, audio settings, reduced motion, fullscreen and scaling, and complete keyboard operation.

Run the tests and fix failures. Do not merely write tests that are never executed. Run a production build and preview or smoke-test it. Verify offline behavior using a production-like build, not only the Vite development server.

Where the environment genuinely prevents a specific verification, implement the relevant automated test or defensive behavior where possible and document the exact limitation honestly. Do not claim tests passed if they were not run.

\#\# 10\. Required package scripts and validation flow

Provide clear package scripts for the real repository. Names may be adjusted, but the repository should support workflows equivalent to:

npm run dev  
npm run build  
npm run preview  
npm test  
npm run test:unit  
npm run test:e2e  
npm run validate:content  
npm run build:content  
npm run validate

The aggregate validation command should run the important static checks, content checks, tests, and production build in a sensible order. Avoid a script that silently skips important failures.

\#\# 11\. Final implementation report

Create IMPLEMENTATION\_REPORT.md containing:

\- A concise product and architecture summary.  
\- Major features completed.  
\- Material interpretations and deviations.  
\- Commands actually run.  
\- Test results and production-build result.  
\- Content-ingestion totals: source files, accepted questions, rejected questions, warnings, repaired records, pool counts, set counts, and category or level coverage.  
\- Offline and PWA verification performed.  
\- Accessibility verification performed.  
\- Known limitations.  
\- Items that still warrant human review, such as factual spot-checking and empirical difficulty calibration.

The report must be factual. Do not invent successful commands, tests, screenshots, or browser verification.

\#\# 12\. Definition of done

The task is complete only when all of the following are true:

\- The repository contains a real working game, not a scaffold.  
\- A fresh clone can be installed and run by following README.md.  
\- The production build succeeds.  
\- The supplied question release is copied into immutable source storage.  
\- The original question files remain unchanged.  
\- Compatible inconsistencies are handled through a documented normalization pipeline.  
\- The normalized catalog loads successfully and supports Fresh Mix and curated sets.  
\- The expected game modes, rules, profiles, one global save, recovery, lifelines, history, statistics, settings, content management, accessibility, audio, speech, and offline behavior are implemented.  
\- Critical persistence and content-integrity paths are tested.  
\- QA\_CHECKLIST.md has been treated as minimum coverage and implementation-specific risks have been tested.  
\- README files and required documentation are complete and accurate.  
\- .gitignore and docs/COMMIT\_PLAN.md exist.  
\- No Git commits or pushes were performed.  
\- IMPLEMENTATION\_REPORT.md accurately records what was built and verified.  
\- There are no known launch-blocking errors hidden behind TODOs or undocumented manual steps.

\#\# 13\. Final execution instruction

Proceed now. Read the complete package, implement the product, reconcile gaps intelligently, preserve source content, normalize and validate copies, test the real application, fix failures, document the repository, and leave the strongest complete implementation possible in the current run.  
