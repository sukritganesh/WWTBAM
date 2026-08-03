# Question Content

This directory contains the hash-protected built-in source release and its generated runtime forms. Gameplay reads the generated catalog; it does not open source packs or scan content directories while creating a run.

For validator behavior, schemas, custom imports, and extension instructions, see [the content pipeline guide](../docs/CONTENT_PIPELINE.md).

## Layout

```text
content/
  source/
    release-001/
      OVERVIEW.md
      manifests/
        manifest.json
        coverage-index.json
      pool/
        pool-001-*.json ... pool-005-*.json
      curated-sets/
        curated-001-*.json ... curated-007-*.json
  normalized/
    release-001/
      release.json
      catalog.json
      validation-report.json

src/content/
  catalog/                 Runtime catalog construction and loading
  generated/               Bundled catalog.json and catalog-report.json
  imports/                 Transactional custom-pack staging
  validators/              Manifest and pack validation
  constants.ts             Categories, limits, and five built-in repairs
  normalize.ts             Common normalized records and metadata inheritance
  types.ts                 Source, normalized, catalog, and import types

scripts/content/
  validate-content.ts      Read and validate without writing outputs
  normalize-content.ts     Write content/normalized/release-001
  build-catalog.ts         Write normalized and bundled generated artifacts
  pipeline.ts              Shared manifest-driven pipeline
```

The release manifest retains its original paths, such as `pool_json/pool-001-...json` and `curated_sets_json/curated-001-...json`. The repository stores those files in `pool/` and `curated-sets/`. The pipeline deliberately maps those two original prefixes while retaining the manifest and its provenance unchanged.

## Release 001 inventory

Release 001 contains:

- 5 Fresh Mix pool files containing 60 questions each.
- 300 Fresh Mix questions.
- 20 controlled primary categories.
- Exactly 15 pool questions per category: one at every level from 1 through 15.
- 7 curated-set files: six original 30-question/two-set packs and one 45-question/three-set geography supplement.
- 15 curated sets containing 15 questions each.
- 225 curated questions that do not overlap the Fresh Mix pool.
- 525 unique questions and 2,100 answer choices overall.
- 35 questions at every exact level: 20 pool questions plus one from each of the 15 sets.
- 9 single-category sets and 6 mixed-category sets.

All 12 source payload hashes match `manifests/manifest.json`. The coverage figures also match `manifests/coverage-index.json`.

## Source-integrity policy

Files under `content/source/release-001` are source and interchange artifacts protected by manifest hashes. Do not reformat, normalize line endings, add or remove a UTF-8 BOM, or apply editorial repairs in place without an intentional release-version and manifest update. SHA-256 covers exact bytes, including BOMs and final newlines.

In particular:

- The five pool files are minified UTF-8 without BOM and end with LF.
- The six original curated-set files are minified UTF-8 with BOM and no final newline.
- The v1.1.0 geography supplement is formatted UTF-8 without BOM.
- `coverage-index.json` is minified UTF-8 without BOM in v1.1.0.
- `manifest.json` is formatted UTF-8 without BOM.

The parser strips one leading BOM for JSON parsing only. Hash verification always uses the untouched byte buffer first.

Generated files under `content/normalized` and `src/content/generated` must not be edited manually. Rebuild them from source.

## Normalization repairs

The raw hashes remain valid because five documented answer-leaking hints are changed only in normalized records:

| Question ID | Normalized hint |
| --- | --- |
| `builtin-pool-technology-07` | The acronym describes an array designed to tolerate drive failures. |
| `builtin-pool-music-03` | This family also includes the viola, cello, and double bass. |
| `builtin-pool-music-13` | The interval spans six semitones. |
| `builtin-pool-sports-and-games-05` | A batter can accumulate two strikes and remain at the plate. |
| `builtin-pool-mythology-and-religion-12` | Its language gives this collection its conventional name. |

The build fails if the repair ID set is not exactly these five or if an immutable source hint no longer matches its documented source value.

## Provenance and editorial status

All supplied packs identify OpenAI as author and carry `reviewStatus: "assistant-reviewed-draft"`, `humanReviewRecommended: true`, and zero time-sensitive questions. These values are pack metadata in the raw release and are inherited by normalized questions.

Automated validation proves structure and internal consistency, not factual accuracy or difficulty calibration. The expected validation report therefore contains one non-blocking human-editorial-review warning.

## Commands

From the repository root:

```powershell
npm run validate:content
npm run normalize:content
npm run build:content
npx vitest run src/content/content.test.ts
```

`npm run build` runs `build:content` before TypeScript and Vite production compilation.

Successful validation currently reports:

```text
525 questions (300 pool + 225 curated), 15 sets, 12 source files, 5 repairs
```
