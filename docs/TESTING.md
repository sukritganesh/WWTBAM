# Testing Guide

## Testing model

The suite separates fast deterministic rules from browser integration:

| Layer | Tool/environment | Current focus |
| --- | --- | --- |
| Pure domain | Vitest | Ladder/payout rules, seeded shuffling and selection, reducer legality and invariants |
| Content | Vitest | Built-in catalog integrity, normalization repairs, import validation and transactional staging |
| Persistence integration | Vitest + `fake-indexeddb` | Migrations, repositories, ownership, stale writes, terminal idempotency, backups and profile transfer |
| Component interaction | React Testing Library + jsdom | Gameplay keyboard/dialog/state behavior and Content Manager workflows |
| Audio unit | Vitest | Procedural registry completeness and bounded channel values |
| Browser workflow | Playwright Chromium | Full game paths, refresh/resume, offline PWA, Back, multi-tab takeover, imports and save replacement |

Test counts are intentionally not documented as a quality target; use command output as the current record. Add tests for unique risks and regressions rather than duplicating cases to inflate a number.

## Commands

```powershell
# Strict TypeScript
npm run typecheck

# All Vitest tests once
npm test

# Watch mode
npm run test:watch

# V8 coverage: terminal summary plus coverage/index.html
npm run test:coverage

# Production Chromium workflows; builds first
npm run test:e2e

# Complete local validation chain
npm run validate
```

`npm run test:unit` currently invokes Vitest and excludes an `e2e/**` pattern; browser tests are already outside Vitest's configured `src/**/*.test.{ts,tsx}` include.

Focused examples:

```powershell
npx vitest run src/game/gameReducer.test.ts
npx vitest run src/data/data.test.ts
npx vitest run src/screens/GameplayScreen.test.tsx
npx playwright test -g "multi-tab takeover"
```

## Vitest configuration

Vitest runs in jsdom. `src/tests/setup.ts` installs jest-dom matchers, `fake-indexeddb`, and a `matchMedia` test double. Tests must clean up mounted React trees and must not rely on execution order.

Randomized behavior should use explicit seeds. Time-sensitive code should use injected clocks or explicit `nowMs` values where possible. Persistence tests use unique database names and close/delete them after each case.

Production question wording should not be used to prove core rules. Domain tests use small purpose-built fixtures; built-in-content tests separately validate the real generated release.

## Coverage boundaries

`npm run test:coverage` uses V8 and currently includes:

- `src/game/**/*.ts`
- `src/content/**/*.ts`
- `src/data/**/*.ts`

The configured report formats are terminal text and HTML. Application orchestration, screens, audio, and PWA code are not currently part of the coverage percentage even though some have direct tests or Playwright coverage. Do not interpret the reported percentage as whole-application coverage.

No repository-wide numeric threshold is configured. Critical pure branches—reducer transitions, payouts, selection, validation, migration, stale-write protection, and terminal commits—should be tested exhaustively regardless of the aggregate number.

## Existing Vitest risk coverage

The source test files currently cover:

- Every prize level and checkpoint boundary.
- Selection/deselection, confirmation, committed lock immutability, reveals, advancement, and all terminal outcomes.
- Hint and absolute-deadline Phone behavior, including Pause/Help consequences.
- Fresh Mix priority, curated ordering, answer-shuffle stability, and Surprise Me priority.
- Built-in release totals, level/set coverage, documented repairs, unsafe markup, malformed imports, and atomic import staging.
- Profile limits/deletion, save ownership, revisions, controller epochs/leases, idempotent history, imported-pack transactions, migrations, backup restore, and profile identity rewriting.
- Gameplay keyboard, non-color answer labels, dialogs, controller read-only state, lifeline presentation, and narration callbacks.
- Content Manager validation, import, authoring, filter/toggle, and download callbacks.

When a defect is found, first reproduce it with the smallest test at the lowest useful layer, then fix it and run the broader affected suite.

## Playwright setup

Install Chromium after `npm ci`:

```powershell
npx playwright install chromium
```

The Playwright configuration:

- Uses `e2e/` as its test directory.
- Runs one Chromium desktop project at 1440×900.
- Starts `npm run preview -- --strictPort` on `127.0.0.1:4173`.
- Runs serially (`fullyParallel: false`).
- Uses no local retries and two retries when `CI` is set.
- Keeps traces and screenshots on failure and writes an HTML report.

`npm run test:e2e` runs a production build first. This matters because the service worker is disabled in development and the E2E module reads the generated catalog.

For Playwright UI mode, build first so `dist` exists and is current:

```powershell
npm run build
npm run test:e2e:ui
```

If another process owns port 4173, stop it before running the suite. The strict-port preview should fail rather than silently test a different port.

## Browser scenarios

The current `e2e/app.spec.ts` defines workflows for:

- Named-profile creation, both lifelines, selected-answer refresh, and exact resume.
- A full 15-answer millionaire run and run review.
- Production service-worker offline relaunch and absence of external gameplay requests.
- Browser Back opening Pause, then a wrong-answer result.
- Custom-pack validation/import and library visibility.
- Explicit multi-tab takeover and stale-controller read-only behavior.
- Walk-away before lock-in.
- Cross-profile replacement of the one global save.

These scenarios depend on a clean browser context per Playwright test. When diagnosing failures locally, do not reuse a manually contaminated profile as evidence.

## Accessibility and visual checks

Component tests verify core keyboard and semantic behavior, but there is no automated axe scan or pixel-diff visual-regression project configured. Manual release checks should include:

- Complete mouse-free gameplay.
- Visible focus and modal focus restoration.
- 1280×720, 1366×768, 1600×900, and 1920×1080 stage checks.
- Browser zoom, long question/answer wrapping, reduced motion, reduced glow, and increased contrast.
- Correct/incorrect/selected/locked meaning without relying on color.
- Muted play and unavailable speech synthesis.

Firefox and WebKit projects are not currently configured as release-blocking Playwright targets. Chromium is the automated browser target in this repository.

## Offline and service-worker testing

Do not validate offline behavior against `npm run dev`. Build and preview first. A meaningful offline check should:

1. Load online and wait for `navigator.serviceWorker.ready`.
2. Reload once so the page is controlled.
3. Take the browser context offline.
4. Reload and verify the title/profile flow still renders.
5. Confirm no external request is required for gameplay.

If the app has not yet been controlled by a service worker, `navigator.onLine === false` alone does not prove offline readiness.

## Validation and reports

`npm run validate` is the intended aggregate local gate. It currently repeats some work because `test:e2e` invokes a production build; this is deliberate in favor of testing the exact production artifact.

Do not record a command as passing unless it was run in the current environment. Preserve Playwright traces/screenshots and the failing seed or fixture when reporting a defect. The repository does not currently contain a hosted CI workflow, so local command output is the authoritative execution record unless CI is added later.
