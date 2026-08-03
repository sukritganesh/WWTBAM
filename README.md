# One Million

One Million: The Knowledge Ascent is a cinematic, offline-first trivia game for desktop browsers. A player climbs a fifteen-question prize ladder, protects checkpoint winnings, uses two single-use lifelines, and decides when to risk another answer or walk away.

The application is a local-only React, TypeScript, and Vite PWA. It has no backend, account, analytics, advertisements, telemetry, or gameplay-time network dependency.

## Highlights

- Fifteen exact difficulty levels from $100 to $1,000,000, with $1,000 and $32,000 checkpoints.
- Deliberate answer selection, final-answer confirmation, suspense, explanations, walk-away payouts, and millionaire victory.
- Fresh Mix with profile-aware unseen/least-seen/least-recent selection and soft category diversity.
- Fifteen authored curated sets, including three geography collections, plus Surprise Me selection.
- Hint and absolute-deadline 60-second Phone a Friend lifelines.
- Up to 20 named local profiles, Guest play, career statistics, set progress, history, and full run review.
- Exactly one global, owner-bound resumable save with immutable question/answer snapshots and multi-tab takeover protection.
- Transactional custom-pack import, pasted JSON, manual form authoring, templates, pack lifecycle controls, and inert-data validation.
- Versioned full backup/restore and single-profile transfer.
- Local Sora/Rajdhani fonts, original SVG stage art, recorded looped music, procedural Web Audio effects, and browser speech synthesis.
- Keyboard play, visible focus, non-color answer states, reduced motion/glow, increased contrast, and muted-play equivalence.
- Installable PWA with a precached application shell and complete built-in catalog.

## Prerequisites

- Node.js 20.10 or newer. The tested baseline is recorded in `.nvmrc`.
- npm 10 or a compatible npm version.
- A current desktop browser. Chromium is the primary reference; current Edge, Firefox, and Safari are intended to degrade gracefully.

No secrets, external services, or global build tools are required.

## Install and run

```bash
npm install
npm run dev
```

Open the local URL printed by Vite, normally `http://127.0.0.1:5173`.

For a reproducible clean install from the committed lockfile, use `npm ci` instead of `npm install`.

## Production build and preview

```bash
npm run build
npm run preview
```

The static production application is written to `dist/`. It can be deployed to an ordinary static host; server-side application code is not required.

## Validation and tests

```bash
npm run typecheck          # strict TypeScript checking
npm test                   # unit, repository, and component tests
npm run test:unit          # same fast Vitest layers, excluding e2e
npm run test:coverage      # V8 coverage report
npm run test:e2e           # production build + Chromium Playwright suite
npm run validate:content   # immutable source, hashes, schemas, references, coverage
npm run normalize:content  # regenerate normalized release and report
npm run build:content      # regenerate the bundled runtime catalog
npm run validate           # aggregate release gate
```

Playwright downloads its isolated Chromium runtime on first setup if it is not already present:

```bash
npx playwright install chromium
```

See [Testing](docs/TESTING.md) for layers, fixtures, recovery coverage, and browser notes.

## Offline and PWA behavior

The production service worker precaches the application shell, local fonts, SVG icons, and normalized built-in question catalog. After the first successful production load reports offline readiness, the app can be refreshed and relaunched offline. Development mode intentionally does not register the service worker; verify offline behavior with `npm run build` and `npm run preview`.

Updates are prompted at safe non-game screens. A waiting service worker never forces a reload during an active run. IndexedDB profiles and saves are independent of Cache Storage updates.

Browser data can still be cleared outside the application. Use **Settings & Data → Export full backup** for durable local recovery.

## Content workflow

Immutable Release 001 source files live under `content/source/release-001`. Build tooling verifies their manifest SHA-256 hashes, strips compatible UTF-8 BOMs during parsing, inherits pack-level review metadata, applies five documented hint-only repairs to normalized copies, and emits the runtime catalog under `src/content/generated`.

```bash
npm run validate:content
npm run normalize:content
npm run build:content
```

The accepted release contains 300 Fresh Mix questions and 225 separate questions in 15 curated sets: 525 unique questions across 20 primary categories. The three supplemental geography sets cover physical geography, borders and human geography, and islands and seas. See [Content Pipeline](docs/CONTENT_PIPELINE.md) and [content/README.md](content/README.md) before changing source content.

## Project structure

```text
src/app/          application orchestration, adapters, settings
src/game/         pure reducer, rules, selection, prizes, immutable run types
src/content/      validators, normalization, import staging, runtime catalog
src/data/         IndexedDB schema, migrations, repositories, backup/profile transfer
src/screens/      title, dashboard, setup, gameplay, results, insights, content manager
src/components/   shared accessible stage components and dialogs
src/audio/        recorded-music catalog/controller, procedural effects, speech manager
src/styles/       semantic tokens and fixed-stage visual system
scripts/content/  deterministic validation/normalization/catalog commands
content/source/   byte-preserved immutable release
content/normalized/ reproducible normalized release and validation report
e2e/              production-like Playwright workflows
docs/             architecture, development, testing, content, and release notes
```

## Documentation

- [Documentation index](docs/README.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Development](docs/DEVELOPMENT.md)
- [Content pipeline](docs/CONTENT_PIPELINE.md)
- [Testing](docs/TESTING.md)
- [Implementation decisions](docs/IMPLEMENTATION_NOTES.md)
- [Troubleshooting](docs/TROUBLESHOOTING.md)
- [Audio implementation ledger](docs/AUDIO_LEDGER.md)
- [Proposed commit plan](docs/COMMIT_PLAN.md)
- [Implementation report](IMPLEMENTATION_REPORT.md)

## Known limitations

- The launch layout targets landscape desktop windows at 1280×720 or larger; mobile/tablet layouts are not part of this release.
- Speech voice quality and availability depend on locally installed browser/operating-system voices. Missing speech never blocks gameplay.
- The original planning package included audio source links but no audio files. A later user-approved music pass added twelve locally supplied tracks under `public/audio/music`; procedural Web Audio remains in use for short sound effects.
- Music choices are derived from the random run ID: one loop each for Questions 1–5, 6–10, 11–15, Pause, and Outro. Refreshing retains the same selection, while repeated pauses preserve both gameplay and pause-track positions within the browser session.
- The repository owner must confirm redistribution rights for the user-supplied music before public distribution.
- Release 001 is structurally validated and marked `assistant-reviewed-draft`. Human factual spot-checking and empirical difficulty calibration remain recommended before public editorial certification.
- The normalized catalog makes the initial JavaScript chunk comparatively large (roughly 1,041 kB minified, about 195 kB gzip in the verified build). It remains fully precached; future content growth should move the catalog to a separately loaded cached chunk.
- The source-scope UI exposes Built-in and All Enabled. Individual imported curated sets are directly selectable, while a custom-pack-only Fresh Mix scope is not exposed in this release.

## Repository state

The repository is prepared for version control but no implementation commits, pushes, or pull requests are created by the build process. A proposed reviewable history is documented in [docs/COMMIT_PLAN.md](docs/COMMIT_PLAN.md).
