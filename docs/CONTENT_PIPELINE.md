# Content Pipeline

## Purpose

The content subsystem converts modular, reviewable JSON sources into one normalized, indexed runtime catalog. It also validates untrusted custom packs and prepares all-or-nothing import payloads for the persistence layer.

The boundaries are intentional:

1. `content/source` is immutable authoring and release evidence.
2. `scripts/content` performs deterministic build-time ingestion.
3. `content/normalized` records the normalized release and audit report.
4. `src/content/generated` is the application-bundled catalog.
5. `src/content/catalog` constructs runtime maps and indexes.
6. `src/content/imports` validates and stages custom content but does not write IndexedDB.

Fresh Mix, set browsing, and selection services should consume the normalized catalog. They must not select a source file first, read raw JSON during a run, or depend on source-file grouping.

## Current source release

### Exact coverage

Release 001 contains 480 distinct questions:

| Content | Files | Questions | Sets |
| --- | ---: | ---: | ---: |
| Fresh Mix pool | 5 | 300 | 0 |
| Curated content | 6 | 180 | 12 |
| Total | 11 | 480 | 12 |

Pool coverage is a complete 20-category by 15-level grid. Each category has one pool question at every exact level. Every curated set also has exactly one question at Levels 1 through 15. Consequently, the full catalog has 32 questions at every level: 20 pool questions and 12 curated questions.

Full-catalog display bands are:

- Easy, Levels 1-5: 160 questions.
- Moderate, Levels 6-10: 160 questions.
- Difficult, Levels 11-14: 128 questions.
- Millionaire, Level 15: 32 questions.

The pool-only figures are 100 Easy, 100 Moderate, 80 Difficult, and 20 Millionaire questions. There are six single-category sets and six mixed-category sets. Pool and curated question IDs and prompts do not overlap.

The controlled categories are exported as `PRIMARY_CATEGORIES` from `src/content/types.ts`. A source or imported question with any other primary category is invalid.

### Source files and BOM handling

The byte-level variants in the supplied release are meaningful:

| Files | Encoding/format |
| --- | --- |
| Five `pool/*.json` payloads | UTF-8, no BOM, one minified line plus final LF |
| Six `curated-sets/*.json` payloads | UTF-8 with BOM, one minified line, no final newline |
| `manifests/coverage-index.json` | UTF-8 with BOM, one minified line |
| `manifests/manifest.json` | UTF-8 without BOM, formatted |

`parseJsonData()` removes one leading U+FEFF before `JSON.parse()`. This is required because direct Node `JSON.parse()` rejects the BOM-prefixed curated payloads. The pipeline calculates SHA-256 from the original `Buffer`, not the BOM-stripped text.

The source manifest uses its original release paths:

- `pool_json/...` maps to repository directory `pool/...`.
- `curated_sets_json/...` maps to repository directory `curated-sets/...`.

This mapping is in `scripts/content/pipeline.ts`. Source identity recorded in normalized records remains the original manifest path.

## Actual schemas

Schema version `1.0.0` is the only supported version.

### Pack root

All 11 built-in packs have the same root keys:

```json
{
  "schemaVersion": "1.0.0",
  "id": "stable-pack-id",
  "title": "Pack title",
  "description": "Pack description",
  "version": "1.0.0",
  "language": "en-US",
  "contentType": "pool | curated-sets",
  "categories": [],
  "questions": [],
  "sets": [],
  "metadata": {}
}
```

The custom validator also accepts `mixed` and `both` content types.

Built-in pool packs contain 60 questions and an empty `sets` array. Built-in curated packs contain 30 questions and two sets.

### Question

All 480 source questions contain exactly these keys:

```json
{
  "id": "stable-question-id",
  "level": 1,
  "category": "Science",
  "tags": ["subject"],
  "prompt": "Question?",
  "choices": [
    { "id": "a", "text": "First" },
    { "id": "b", "text": "Second" },
    { "id": "c", "text": "Third" },
    { "id": "d", "text": "Fourth" }
  ],
  "correctChoiceId": "b",
  "hint": "Handcrafted clue.",
  "explanation": "Concise answer explanation.",
  "usage": { "freshMix": true, "setIds": [] }
}
```

Question-level `metadata` is absent from Release 001 but is accepted for custom packs. Every source question has four unique choice IDs, four distinct visible texts, and one valid correct reference.

### Curated set

All 12 source set manifests contain:

```json
{
  "id": "stable-set-id",
  "title": "Set title",
  "description": "Set description",
  "theme": "Theme",
  "tags": ["tag"],
  "questionIds": ["15 ordered IDs"]
}
```

The validator also accepts optional `audience` and `difficultyNote` fields. A set must reference exactly 15 distinct questions. Position 1 must resolve to Level 1, position 2 to Level 2, and so on. Question `usage.setIds` and set `questionIds` must be reciprocal.

### Pack metadata variants

There are two built-in metadata key sets:

- Five pool packs: `author`, `questionCount`, `questionsPerCategory`, `reviewStatus`, `humanReviewRecommended`, `timeSensitiveQuestionCount`.
- Six curated packs: `author`, `questionCount`, `setCount`, `reviewStatus`, `humanReviewRecommended`, `timeSensitiveQuestionCount`.

Release 001 questions inherit `language`, author, review status, human-review recommendation, source notes, verification notes, generated-by label, and time-sensitive fields during normalization. Unknown imported metadata keys are not copied to the runtime catalog.

## Manifest and integrity validation

`content/source/release-001/manifests/manifest.json` is the authoritative inclusion list. Runtime and build behavior never treats an unlisted payload as valid content merely because it exists in a directory.

For every entry the pipeline validates:

- Safe relative path.
- Unique path and pack ID.
- `pool` or `set` manifest kind.
- Expected pack ID and matching pack content type.
- Declared question count.
- Declared categories against both the pack and its questions.
- Lowercase 64-character SHA-256 digest.
- `defaultEnabled` boolean.
- Exact file availability.

The build also scans the two known source payload directories as a development safeguard. A missing manifest-listed file or an unlisted JSON payload is a blocker.

Release-wide validation rejects duplicate question IDs, duplicate prompts, duplicate set IDs, mismatched manifest totals, and any discrepancy against `coverage-index.json`. Coverage validation includes pool category, level, display-band and internal-tier counts, curated category counts, total set/question counts, and the six-single/six-mixed split.

Do not hash parsed JSON or normalized text. Hash exact source bytes:

```powershell
(Get-FileHash -Algorithm SHA256 -LiteralPath "path\to\pack.json").Hash.ToLowerInvariant()
```

Formatting, BOM changes, and final-newline changes alter the digest.

## Immutable source and five repairs

Release 001 source payloads and their manifest hashes are immutable. Never fix a source hint in place. `BUILT_IN_HINT_REPAIRS` in `src/content/constants.ts` records both the expected source value and normalized value for exactly five questions:

| ID | Source hint | Normalized hint |
| --- | --- | --- |
| `builtin-pool-technology-07` | The acronym begins 'Redundant Array'. | The acronym describes an array designed to tolerate drive failures. |
| `builtin-pool-music-03` | Its sound is produced by bowed or plucked strings. | This family also includes the viola, cello, and double bass. |
| `builtin-pool-music-13` | Its name literally refers to three tones. | The interval spans six semitones. |
| `builtin-pool-sports-and-games-05` | A foul ball usually cannot become strike three unless bunted. | A batter can accumulate two strikes and remain at the plate. |
| `builtin-pool-mythology-and-religion-12` | It includes texts in the Avestan language. | Its language gives this collection its conventional name. |

The pipeline fails if a source value changes, a repair disappears, or any extra built-in repair is introduced without explicitly updating the documented repair set.

## Normalized records and generated catalog

`normalizePack()` produces common source, question, and set records for built-in and imported content. It adds:

- Derived display difficulty and internal tier from the authoritative level.
- Origin: `built-in` or `imported`.
- Source pack, source file, source version, and enabled state.
- Inherited question metadata.
- Globally namespaced custom IDs in `pack-id:local-id` form.
- Per-question normalization repair records.

`createSerializedCatalog()` rejects normalized duplicate IDs or broken set references, then publishes:

- Questions, sets, and content sources.
- Question IDs indexed by exact level, category, tag, source pack, and set.
- All Fresh Mix IDs and currently eligible Fresh Mix IDs.
- Counts by level, display difficulty, internal tier, category, source pack, and review status.
- Missing Fresh Mix levels and missing category/level cells.

`loadBuiltInCatalog()` loads `src/content/generated/catalog.json` once and adds `questionById`, `setById`, and `sourceById` maps. It caches that runtime catalog.

### Generated outputs

`npm run normalize:content` writes:

- `content/normalized/release-001/release.json`
- `content/normalized/release-001/catalog.json`
- `content/normalized/release-001/validation-report.json`

`npm run build:content` writes all three plus:

- `src/content/generated/catalog.json`
- `src/content/generated/catalog-report.json`

Outputs are deterministic and contain the manifest's source validation date rather than a build-time timestamp. Do not hand-edit or treat generated JSON as an authoring source.

## Review status and warning policy

Release 001 provenance is:

- Author: OpenAI.
- Review status: `assistant-reviewed-draft`.
- `humanReviewRecommended: true`.
- Time-sensitive questions: zero.

Structural validation cannot establish factual correctness or final difficulty calibration. The built-in validation report intentionally contains one warning, `human-editorial-review-recommended`. This warning does not fail the build.

The distinction is strict:

- An **error** is a blocker. Built-in pipeline output has `valid: false`; `assertValidPipeline()` exits unsuccessfully. A custom import has `status: "rejected"` and `payload: null`.
- A **warning** is visible review information. It does not make an otherwise complete pack uncommittable.

Custom-import warnings include missing author, missing review status, unreviewed/draft status, same-version update, downgrade, and versions that cannot be compared semantically. The storage layer may still require a separate explicit confirmation for replacement or downgrade.

## Validation rules and limits

Both built-in and custom packs are checked for:

- Supported schema and content type.
- Required nonblank strings and safe IDs.
- Allowed primary categories and accurate declared category membership.
- Integer Levels 1-15.
- Exactly four distinct choices and a valid correct-choice reference.
- Nonblank hint and explanation.
- Valid usage membership.
- Valid, reciprocal, correctly ordered curated sets.
- Accurate metadata counts when supplied.
- Duplicate pack-local IDs.
- HTML-like markup, event handlers, script URLs, data HTML URLs, and unsafe control characters.

Custom import limits are:

| Limit | Value |
| --- | ---: |
| UTF-8 JSON size | 5 MiB |
| Questions per pack | 5,000 |
| Curated sets per pack | 500 |
| ID length | 128 characters |
| Pack title | 160 characters |
| Description | 2,000 characters |
| Prompt | 500 characters |
| Visible answer | 240 characters |
| Hint | 500 characters |
| Explanation | 1,200 characters |
| Tags per question | 24 |
| Tag length | 80 characters |

Imported pack IDs must be lowercase kebab-case, begin with a letter, and must not use the reserved `builtin-*` namespace. Local question/set IDs may arrive unprefixed or already prefixed by their own pack ID. Normalization stores them globally as `pack-id:local-id`.

## Transactional custom imports

Use `prepareCustomPackImport()` from `src/content/imports` for JSON files, pasted JSON, form-authored packs, and externally AI-assisted content. All paths use the same validator.

The function accepts a JSON string or already parsed value, existing content identity maps, and options such as explicit pack update permission. It returns:

```ts
type PreparedImportTransaction =
  | { status: 'ready'; preview: ImportPreview; payload: PreparedImportPayload }
  | { status: 'rejected'; preview: ImportPreview; payload: null };
```

The preview includes pack/version identity, question and set counts, Fresh Mix count, levels, categories, warnings, errors, and conflicts. A matching installed pack ID is a blocker unless `allowPackUpdate` is explicit. Global question/set collisions owned by another pack remain blockers.

The content subsystem never partially writes a pack and never accesses IndexedDB. A caller must pass the complete ready payload through an adapter and commit all pack, question, and set records in one persistence transaction. Discard the complete payload if that transaction fails.

## Adding pool files

Release 001 is already hash-published. Prefer creating a new versioned release rather than modifying it. The current script paths are deliberately fixed to `release-001`; introducing `release-002` requires updating the source/output constants or generalizing the pipeline before changing the default built-in release.

For a new development release:

1. Copy the prior release into a new versioned source directory without altering the prior directory.
2. Add a medium-sized JSON pack under its `pool/` directory.
3. Give the pack a unique reserved built-in pack ID and supported schema/version.
4. Use `contentType: "pool"`, an empty `sets` array, and Fresh Mix-only usage on every question.
5. Ensure every question has a unique built-in ID, allowed category, exact level, tags, four choices, correct reference, hint, and explanation.
6. Add an explicit manifest entry with kind `pool`, repository-relative/original release path, pack ID, exact count, actual categories, lowercase SHA-256, and default enabled state.
7. Recalculate manifest totals and regenerate the coverage index accurately.
8. Point/generalize `scripts/content/pipeline.ts` for the new release and output location.
9. Run validation, normalization, focused tests, and the production build.

Adding a file to the directory without a manifest entry is intentionally rejected.

## Adding curated sets

For a new versioned release:

1. Add a curated pack under `curated-sets/` with `contentType: "curated-sets"`.
2. Include each referenced question in that same pack.
3. Give every set and question a globally unique built-in ID.
4. For each set, include exactly 15 unique question IDs ordered Level 1 through Level 15.
5. Set each curated question's `freshMix` flag as intended and make `usage.setIds` exactly reciprocal with set membership.
6. Update pack metadata `questionCount`, `setCount`, review fields, and time-sensitive count.
7. Add the manifest entry with kind `set`, exact count, categories, SHA-256, and default state.
8. Update manifest totals and every affected coverage-index value, including single/mixed set counts and curated category totals.
9. Run the complete command sequence below.

## Commands and expected workflow

Run commands from the repository root.

Read and validate without writing generated files:

```powershell
npm run validate:content
```

Validate and rewrite only normalized artifacts:

```powershell
npm run normalize:content
```

Validate and rewrite both normalized and application-generated artifacts:

```powershell
npm run build:content
```

Run focused content tests:

```powershell
npx vitest run src/content/content.test.ts
```

Run the broader checks:

```powershell
npm run typecheck
npm test
npm run build
```

`npm run build` already starts with `npm run build:content`. Current successful content output is:

```text
Content catalog built: 480 questions (300 pool + 180 curated), 12 sets, 11 source files, 5 repairs.
```

After a content change, inspect `content/normalized/release-001/validation-report.json`. Its `valid` flag must be true, `errors` must be empty, all source hashes must match, totals and coverage must be expected, and only understood editorial warnings may remain.
