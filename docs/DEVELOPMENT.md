# Development Guide

## Prerequisites

- Node.js 20.10 or newer, as declared in `package.json` and `.nvmrc`.
- npm with the committed `package-lock.json`.
- A current Chromium-based browser for ordinary development.
- Playwright Chromium for browser tests.

From the repository root:

```powershell
npm ci
npx playwright install chromium
```

On a Linux machine that also needs browser system libraries, use `npx playwright install --with-deps chromium`.

## Common commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Rebuild content, then start Vite at `http://127.0.0.1:5173` |
| `npm run build` | Rebuild content, type-check, and create `dist` |
| `npm run preview` | Serve the existing production build at `http://127.0.0.1:4173` |
| `npm run typecheck` | Run strict TypeScript checks without emitting files |
| `npm test` | Run all Vitest unit, integration, and component tests |
| `npm run test:watch` | Run Vitest in watch mode |
| `npm run test:coverage` | Run Vitest with text and HTML coverage reports |
| `npm run test:e2e` | Build, start preview, and run Playwright Chromium tests |
| `npm run validate:content` | Validate source content and manifest integrity without writing artifacts |
| `npm run normalize:content` | Validate and write normalized release artifacts |
| `npm run build:content` | Validate and write normalized plus runtime catalog artifacts |
| `npm run validate` | Type-check, validate content, run Vitest, build, and run Playwright |

There is currently no separate lint script. `npm run typecheck`, content validation, tests, and production build are the enforced static checks.

## Repository map

```text
src/app/          Application orchestration and domain/storage adapters
src/game/         Pure game rules, state, reducer, selection, payouts
src/content/      Content validation, normalization, catalog and imports
src/data/         IndexedDB schema, migrations, repositories and transfers
src/audio/        Procedural Web Audio and speech synthesis
src/pwa/          Service-worker registration/status hook
src/screens/      Controlled full-screen presentation components
src/components/   Shared UI primitives
src/styles/       Tokens and screen-specific styles
scripts/content/  Reproducible built-in content pipeline
content/source/   Immutable supplied release files
content/normalized/ Generated normalized release and validation report
e2e/              Playwright production-browser workflows
```

## Recommended workflow

1. Run `npm ci` after cloning or after lockfile changes.
2. Run `npm run dev` from the repository root.
3. Keep domain rules in `src/game`, browser/storage effects in `src/app` or a repository, and rendering in screens/components.
4. Add the smallest focused test with each behavior change or defect fix.
5. Run `npm run typecheck` and the relevant focused Vitest file while iterating.
6. Run `npm test` and `npm run build` before handoff.
7. Run `npm run test:e2e` for navigation, persistence, PWA, or cross-tab changes.

Do not edit files under `src/content/generated` or `content/normalized` by hand. Regenerate them with the content scripts.

## Coding boundaries

### Game rules

`src/game` must stay deterministic and side-effect free. Reducer actions must be legal only in their intended phases. An invalid or stale action should leave state unchanged. Accepted persistable transitions must advance `saveRevision`.

When adding a game action or phase:

1. Update the types in `src/game/types.ts`.
2. Implement legality and immutable transition behavior in the reducer.
3. Add domain tests for valid, invalid, duplicate, and stale transitions.
4. Update save decoding in `src/app/adapters.ts` if the serialized shape changes.
5. Coordinate persistence/audio/history effects in `App.tsx`, not in the reducer.
6. Update controlled presentation and keyboard/accessibility behavior as needed.

Never move reveal timing or repository calls into the reducer.

### Persistence

Use `DataRepositories` rather than raw IndexedDB from UI code. Multi-store changes must be transactional. Active-save writes require the current run ID, database revision, controller ID, and controller epoch.

If the database schema changes:

- Increment `APP_DATABASE_VERSION`.
- Add an upgrade branch that migrates older valid records.
- Add a migration fixture/test.
- Keep existing profiles, saves, imports, and history when valid.
- Update backup validation/migration if persisted record shapes change.

The serialized game snapshot currently has its own `schemaVersion`. Changing it also requires defensive decode/migration work; simply accepting a new TypeScript shape is not sufficient.

### Presentation

Screens should accept data and callbacks. They should not open IndexedDB or contain duplicated payout/selection logic. Use shared semantic tokens, visible focus, real buttons, accessible names, modal focus management, and text/icon state labels in addition to color.

Gameplay must remain usable at the supported 16:9 stage size without scrolling. Long content should wrap inside bounded panels.

### Audio and speech

Trigger logical `SoundEvent` names through `AudioManager`; keep synthesis recipes centralized in `soundRegistry.ts`. Browser audio may remain suspended until a user gesture, so audio calls must fail quietly.

Always cancel active speech before incompatible transitions. New speech must never overlap old speech. Every spoken string must remain visible in the UI.

## Built-in content workflow

The supplied Release 001 source is immutable. The pipeline expects this layout:

```text
content/source/release-001/
  pool/
  curated-sets/
  manifests/
```

Use:

```powershell
npm run validate:content
npm run build:content
```

`validate:content` checks JSON, source hashes, manifest paths/counts, unique identities, set references, exact level coverage, and documented normalization behavior. `build:content` writes:

- `content/normalized/release-001/release.json`
- `content/normalized/release-001/catalog.json`
- `content/normalized/release-001/validation-report.json`
- `src/content/generated/catalog.json`
- `src/content/generated/catalog-report.json`

Run scripts from the repository root because the pipeline resolves paths from `process.cwd()`.

Custom packs should be exercised through the import preparation path or Content Manager. Never bypass validation by writing directly to imported-content stores.

## IndexedDB debugging

In Chromium DevTools, open **Application → Storage → IndexedDB → `one-million-local`**. The current stores are documented in `ARCHITECTURE.md`.

Useful checks:

- `activeSave/active`: owner, revision, controller lease, resolved questions, serialized snapshot.
- `metadata/activeSaveRevision`: monotonic global save sequence.
- `runHistory`: one record per terminal run ID.
- `questionHistory`: owner/question counters and last-run idempotency markers.
- `settings/global`: device-global audio and accessibility preferences.

Treat DevTools edits as destructive experiments. Prefer the in-app backup/export tools. If manual inspection changes data, reload all tabs before drawing conclusions because the running app may hold a newer in-memory snapshot.

### Safe reset

The supported reset is **Settings → Reset local data**, which closes the repository, deletes the database, and reloads. Export a full backup first.

For a development-only manual reset:

1. Close every tab running the app.
2. Delete `one-million-local` in DevTools IndexedDB.
3. If debugging PWA state too, unregister the service worker and clear Cache Storage.
4. Reload online once.

Deleting IndexedDB removes profiles, saves, history, settings, and imported packs. Clearing Cache Storage alone does not reset game data.

## Service-worker development

The Vite development server intentionally disables the service worker. Use a production build for PWA work:

```powershell
npm run build
npm run preview
```

Then inspect **Application → Service Workers**, Manifest, and Cache Storage at `http://127.0.0.1:4173`. Because registration uses prompt mode, an update waits for explicit activation through the app instead of silently replacing the current page.

## Local exports and generated artifacts

Backup files matching `*.millionaire-backup.json`, Playwright reports, coverage, `dist`, logs, and local database exports are ignored by Git. Required source content, generated runtime catalog files, and the package lockfile are not disposable local artifacts.
