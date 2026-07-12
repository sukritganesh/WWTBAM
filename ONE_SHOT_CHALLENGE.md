# The One-Shot Vibecoding Challenge

> **One prompt. One uninterrupted implementation run. One complete game.**

This repository is the result of a one-shot vibecoding challenge: give Codex the complete product brief, supporting specifications, and source content, then ask it to build the finished application autonomously without pausing for clarification or waiting for another round of instructions.

The challenge prompt was simple in spirit and demanding in practice:

> Read `CODEX_PROMPT.md` and execute it fully.

That prompt pointed to a much larger planning package covering product behavior, visual design, technical architecture, content rules, quality assurance, audio direction, and a 480-question release. The objective was not to produce a scaffold or mockup. The run had to leave behind a polished, working, documented, and tested browser game.

## How the prompt was executed

Codex treated the supplied files as an implementation contract and worked through the repository in one continuous run:

1. **Read and reconciled the complete planning package.** Requirements were prioritized according to the prompt, with gameplay, persistence, content integrity, offline behavior, accessibility, and user safety treated as hard invariants.
2. **Audited the supplied content before using it.** The original Question Content Release 001 files were copied into immutable source storage, checked against their SHA-256 manifest, parsed with BOM-safe tooling, and normalized without editing the originals.
3. **Built the application from the domain outward.** Deterministic game rules and question selection came first, followed by IndexedDB persistence, global-save ownership, multi-tab protection, content imports, audio, narration, screens, and application orchestration.
4. **Implemented the complete player experience.** The run produced profiles and Guest play, Fresh Mix and curated sets, the full fifteen-question ladder, both lifelines, walk-away and result paths, review/history/statistics, settings, content management, backup/restore, and profile transfer.
5. **Created an original presentation layer.** The game uses a custom widescreen stage, original SVG treatment, locally bundled fonts, procedural Web Audio cues and ambience, browser speech synthesis, keyboard controls, visible focus, non-color state labels, and reduced-effects settings.
6. **Hardened the local-first architecture.** Resolved question order is persisted, writes use monotonic revisions, stale tabs become read-only, terminal history/statistics settle atomically, imported packs are staged transactionally, and the production PWA runs without remote gameplay dependencies.
7. **Tested the real production application and fixed failures.** Verification covered pure rules, React interactions, IndexedDB behavior, content integrity, refresh recovery, full gameplay, offline relaunch, multi-tab takeover, imports, walk-away settlement, and cross-profile save replacement.
8. **Documented the decisions and results.** The repository includes architecture, development, testing, troubleshooting, content-pipeline, audio-ledger, implementation-notes, and final validation documentation.

Focused review tracks were used for the product/gameplay, content, and persistence/QA subsystems while the primary implementation remained coordinated in the shared workspace. Findings were integrated and validated as one release rather than delivered as disconnected prototypes.

## What the one shot produced

| Result | Verified outcome |
| --- | ---: |
| Accepted questions | 480 |
| Fresh Mix pool questions | 300 |
| Curated questions | 180 |
| Curated fifteen-question sets | 12 |
| Categories | 20 |
| Source hash mismatches | 0 |
| Rejected questions | 0 |
| Documented normalization repairs | 5 |
| Unit/component/integration tests | 72 passed |
| Production browser scenarios | 8 passed |
| Runtime dependency vulnerabilities | 0 |

The final aggregate validation passed TypeScript checking, source-content validation, all Vitest suites, a fresh deterministic catalog build, the production Vite/PWA build, and the Chromium end-to-end suite. The browser tests included a complete millionaire run and a production-build offline relaunch with no external runtime requests.

## The result

The finished repository is a complete React, TypeScript, and Vite PWA—not a generated screenshot, a collection of placeholders, or an unfinished architecture exercise. It can be installed, run, played from start to finish, refreshed mid-game, used offline, extended with custom content, backed up, restored, and tested by the next developer.

The detailed evidence is preserved in [`IMPLEMENTATION_REPORT.md`](IMPLEMENTATION_REPORT.md), with setup instructions in [`README.md`](README.md) and the documentation index in [`docs/README.md`](docs/README.md).

---

### Challenge inscription

**Built in one uninterrupted Codex run from the supplied prompt and planning package.**  
**Validated on July 11, 2026.**  
**Committed on `agent/complete-wwtbam-game`.**

