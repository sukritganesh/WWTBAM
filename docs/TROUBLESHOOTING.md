# Troubleshooting

## Start with a safe diagnosis

Before deleting data:

1. Record the exact command, browser, URL, and visible error.
2. Check the terminal and browser console.
3. Export a full backup if the Settings screen is reachable.
4. Avoid opening more gameplay tabs while diagnosing save/controller errors.
5. Distinguish IndexedDB data from service-worker caches; clearing one does not clear the other.

## Installation and startup

### `npm ci` reports an engine mismatch

Use Node 20.10 or newer. Confirm with:

```powershell
node --version
npm --version
```

Switch to the version in `.nvmrc`, remove no lockfile entries by hand, then rerun `npm ci`.

### A module or generated catalog is missing

Run from the repository root:

```powershell
npm run build:content
npm run typecheck
```

The app imports `src/content/generated/catalog.json`. `npm run dev` and `npm run build` regenerate it automatically, but a direct TypeScript/test command may expose a missing artifact in a fresh or partially prepared workspace.

### Content validation fails with a hash mismatch

Release 001 source bytes no longer match the manifest. Do not update the manifest merely to silence the error. Restore the original file under `content/source/release-001`, including its encoding and line endings, then rerun `npm run validate:content`.

### Content scripts cannot find `content/source`

Run scripts from the repository root. The pipeline resolves paths from the current working directory.

### Vite or preview cannot bind its port

Development uses `127.0.0.1:5173`; preview and Playwright use `127.0.0.1:4173`. Stop the process holding the port or close the earlier dev/preview terminal. Playwright uses strict port behavior and should not silently switch.

## Blank, boot, or recovery screen

### The app remains on the boot screen

Check the browser console for catalog parsing or IndexedDB open/upgrade failures. Also check whether another tab has an old database connection blocking an upgrade. Close every app tab and reload one tab.

### “One Million could not start” appears

The boot boundary caught a catalog or local-database failure. Try one normal reload. If it repeats:

- Run `npm run build:content` and `npm run typecheck` for bundle/catalog problems.
- Close other tabs for blocked IndexedDB upgrades.
- Inspect `one-million-local` in DevTools for storage problems.
- Export or preserve site data before resetting if local careers matter.

### An active save is reported as corrupt

The decoder rejected the snapshot instead of allowing malformed state into gameplay. Other stores remain available. Export a full backup before reset. Do not edit the snapshot unless developing and testing a migration; manual edits can break owner, answer-order, or revision invariants.

## IndexedDB and local data

### Where is local data stored?

Chromium DevTools: **Application → Storage → IndexedDB → `one-million-local`**.

The single live run is `activeSave/active`. Profiles, history, settings, and imported content are separate stores, so a bad save should not require deleting the whole database.

### A database upgrade is blocked

Close all tabs and installed-PWA windows using the same origin. DevTools itself can also keep a connection alive; close/reopen it, then reload. The app database version is upgraded transactionally.

### Save failed, quota was exceeded, or private browsing blocks storage

The app should stop claiming successful persistence and keep gameplay controls guarded. Do not Save and Exit until persistence succeeds.

Try:

- Free site/device storage.
- Leave private/restricted browsing.
- Export data if possible.
- Retry in one normal browser tab.
- Check the console for `QuotaExceededError`, transaction aborts, or database termination.

Avoid starting a replacement run while persistence is unhealthy.

### Reset all local data

Preferred: **Settings → Reset local data**. Export a backup first.

Development-only manual reset:

1. Close all app tabs.
2. Delete `one-million-local` in DevTools IndexedDB.
3. Reload the app.

This permanently removes profiles, the active save, histories, settings, set progress, and imported packs. Clearing browser cache alone does not remove IndexedDB.

### Backup restore is rejected

Restore validates format/version, safe JSON depth and keys, records, identities, references, and active-save consistency before writing. Use an unmodified `.millionaire-backup.json` produced by this app version. A preflight failure leaves current data unchanged.

For files over 25 MiB, reduce/remove unrelated content in a safe source environment; the application intentionally rejects oversized input.

### Profile import does not overwrite the existing profile

This is intentional. Profile import assigns a new internal ID and rewrites owned records. The 20-profile limit still applies. Delete an unwanted named profile only after exporting anything important.

## Saves and multiple tabs

### The game says it is read-only

Another tab owns the active controller lease, or this tab attempted a stale write. Use **Take Control** only if this tab should become authoritative. The previous tab will become read-only on its next heartbeat/write.

Reloading the same tab preserves its session controller ID. Opening or duplicating a separate tab creates competing control and requires a claim/takeover.

### Take Control reports a conflict

The active save changed or another claim won first. Return to the dashboard/reload the latest save summary, then retry deliberately. Do not keep answering in a stale tab.

### Refresh changed or lost a selection

This is a release-blocking symptom. Preserve the database and report:

- Run ID and `GameRunState.saveRevision` from the snapshot.
- `ActiveSaveRecord.revision`, controller ID, and epoch.
- Phase before and after refresh.
- Whether an autosave error was visible.

Do not continue the run if refresh changed questions, answer order, committed lock, or lifeline state.

### Save and Exit refuses to leave

The app waits for the serialized save queue. Resolve the visible persistence/controller error first. This guard prevents destructive navigation after a failed save.

## PWA, offline, and updates

### No service worker appears during `npm run dev`

Expected. PWA development mode is disabled. Use:

```powershell
npm run build
npm run preview
```

Then inspect `http://127.0.0.1:4173`.

### Offline reload fails

The first visit must be online, the service worker must install, and a subsequent page must be controlled. In DevTools verify:

- A service worker is activated for the preview origin.
- Cache Storage contains the Workbox precache.
- The app reported offline readiness before disconnecting.

Reload online once, wait for `navigator.serviceWorker.ready`, reload again, then test offline. Do not use the Vite dev server for this check.

### A stale build remains after rebuilding

Use the in-app update action when offered. For development recovery only:

1. Close app tabs.
2. Unregister the service worker in DevTools.
3. Clear Cache Storage for the origin.
4. Run `npm run build` again.
5. Open preview online.

Do not delete IndexedDB unless local data also needs resetting.

### Update activation reloads the page

Update registration is prompt-based, and applying the update asks the new service worker to activate and reload. Finish or safely save active gameplay before applying an update.

## Audio and narration

### Music or effects are silent

Check Master Audio, Music, Effects, and their volumes. Browsers suspend Web Audio until a user gesture; click a normal app control before concluding audio is broken. Also inspect the console for AudioContext permission or device errors.

Audio is procedural, so missing `.mp3` or `.ogg` files are not the cause in this implementation.

### Music starts twice or continues unexpectedly

Capture the current screen, selected music tier, tab visibility transition, and AudioContext state. A tier change should stop existing oscillators before starting new ones. Reload one tab after ensuring no second tab is playing the app.

### No narration voices are listed

Voice availability comes from the browser/operating system and may arrive asynchronously. Wait briefly, reopen Settings, and confirm an English system voice is installed. The app falls back to another compatible/default voice and remains playable with no voice.

### Narration overlaps or music stays ducked

Pause/Help/lock/question changes should cancel speech. Reproduce the exact transition and browser. Toggling narration off or reloading should cancel the browser speech queue; if not, use the browser's speech controls or restart the tab. All question content remains visible.

### Narration is disabled on first launch

Expected. Narration defaults off. Enable it in Settings and optionally choose a detected voice and speed.

## Fullscreen and layout

### Fullscreen is denied

Fullscreen requires a direct user gesture and can be blocked by browser policy. Use the visible fullscreen control again, or continue in windowed mode. The game does not require fullscreen for correctness.

### Controls are replaced by an “enlarge window” notice

The fixed 16:9 stage is below its hard-stop threshold (currently 900 CSS pixels wide or 520 CSS pixels high). Increase the browser window, reduce browser zoom, or enter fullscreen. The primary layout target remains 1280×720 or larger. Do not use page scrolling as a workaround during gameplay.

### Long text clips or overlaps

Record the viewport, zoom, question ID, fallback font, and whether reduced/increased-contrast settings are active. Verify at 1280×720 or larger. Treat clipped question, answer, ladder, or confirmation controls as a UI defect.

## Test failures

### Playwright cannot launch Chromium

```powershell
npx playwright install chromium
```

On Linux, install dependencies with `npx playwright install --with-deps chromium`.

### Playwright says `dist` is missing in UI mode

`test:e2e:ui` does not run the package build wrapper. Run:

```powershell
npm run build
npm run test:e2e:ui
```

### Offline E2E fails only after using the dev server

Stop the dev server and use the production preview started by Playwright. Service workers are intentionally disabled in development.

### A React test finds duplicate elements from earlier renders

Ensure the test calls React Testing Library `cleanup` after each test or uses the configured auto-cleanup correctly. Do not leave multiple rendered roots in one test unless queries are scoped with `within`.

### IndexedDB tests leak state

Use a unique database name per test, close repository/database handles, and delete the database in teardown. Do not make tests order-dependent.

### Coverage is lower than expected for screens or app code

The current V8 include list covers only `src/game`, `src/content`, and `src/data`. Screens, app orchestration, audio, and PWA behavior do not contribute to the configured percentage even when separately tested.

## Recovery order

When several systems appear broken, use this least-destructive order:

1. Save screenshots/logs and export a backup.
2. Close duplicate tabs and reload one tab.
3. Rebuild generated content and the production bundle.
4. Clear only service-worker/cache state when diagnosing PWA files.
5. Restore a validated backup if local records are damaged.
6. Reset IndexedDB only as the final option.
