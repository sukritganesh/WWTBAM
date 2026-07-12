import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { BUILT_IN_HINT_REPAIRS } from '../../src/content/constants';
import { createSerializedCatalog } from '../../src/content/catalog/createCatalog';
import { normalizePack } from '../../src/content/normalize';
import {
  PRIMARY_CATEGORIES,
  type NormalizedPack,
  type RawContentPack,
  type ReleaseManifest,
  type SerializedContentCatalog,
  type ValidationIssue
} from '../../src/content/types';
import { parseJsonData, validateContentPack, validateReleaseManifest } from '../../src/content/validators';

const REPOSITORY_ROOT = process.cwd();
const SOURCE_ROOT = path.join(REPOSITORY_ROOT, 'content', 'source', 'release-001');
const NORMALIZED_ROOT = path.join(REPOSITORY_ROOT, 'content', 'normalized', 'release-001');
const GENERATED_ROOT = path.join(REPOSITORY_ROOT, 'src', 'content', 'generated');

interface SourceFileReport {
  manifestPath: string;
  repositoryPath: string;
  packId: string;
  kind: 'pool' | 'set';
  byteLength: number;
  utf8Bom: boolean;
  sourceSha256: string;
  expectedSha256: string;
  hashMatches: boolean;
  questionCount: number;
  setCount: number;
  categories: string[];
}

interface SignatureCount {
  keys: string[];
  count: number;
}

export interface ContentValidationReport {
  schemaVersion: string;
  releaseId: string;
  releaseVersion: string;
  validatedAt: string;
  valid: boolean;
  sourceIntegrity: {
    algorithm: 'SHA-256';
    allHashesMatch: boolean;
    sourceFiles: SourceFileReport[];
  };
  totals: {
    sourceFiles: number;
    poolFiles: number;
    curatedSetFiles: number;
    questions: number;
    poolQuestions: number;
    curatedQuestions: number;
    curatedSets: number;
    categories: number;
    normalizationRepairs: number;
  };
  coverage: SerializedContentCatalog['summary'];
  releaseCoverage: {
    poolQuestionsPerCategory: Record<string, number>;
    poolQuestionsPerLevel: Record<string, number>;
    curatedQuestionsPerCategory: Record<string, number>;
    allQuestionsPerLevel: Record<string, number>;
    singleCategorySets: number;
    mixedCategorySets: number;
  };
  schemaSignatures: {
    pack: SignatureCount[];
    question: SignatureCount[];
    choice: SignatureCount[];
    usage: SignatureCount[];
    packMetadata: SignatureCount[];
    curatedSet: SignatureCount[];
  };
  normalizationRepairs: Array<{
    questionId: string;
    field: 'hint';
    sourceValue: string;
    normalizedValue: string;
  }>;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
}

export interface NormalizedRelease {
  schemaVersion: string;
  id: string;
  version: string;
  sourceManifest: string;
  sourceValidatedAt: string;
  sources: NormalizedPack['source'][];
  questions: NormalizedPack['questions'];
  sets: NormalizedPack['sets'];
}

export interface ContentPipelineResult {
  manifest: ReleaseManifest;
  packs: NormalizedPack[];
  release: NormalizedRelease;
  catalog: SerializedContentCatalog;
  report: ContentValidationReport;
}

function validationIssue(code: string, pathValue: string, message: string): ValidationIssue {
  return { severity: 'error', code, path: pathValue, message };
}

function warningIssue(code: string, pathValue: string, message: string): ValidationIssue {
  return { severity: 'warning', code, path: pathValue, message };
}

async function readJsonFile(filePath: string): Promise<{ bytes: Buffer; value: unknown }> {
  const bytes = await readFile(filePath);
  const parsed = parseJsonData(bytes.toString('utf8'));
  if (!parsed.valid) {
    const detail = parsed.errors.map((item) => item.message).join(' ');
    throw new Error(`${filePath}: ${detail}`);
  }
  return { bytes, value: parsed.value };
}

function sha256(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function repositoryPathForManifestPath(manifestPath: string): string {
  const mapped = manifestPath
    .replace(/^pool_json\//, 'pool/')
    .replace(/^curated_sets_json\//, 'curated-sets/');
  return mapped;
}

function absoluteSourcePath(manifestPath: string): string {
  const repositoryPath = repositoryPathForManifestPath(manifestPath);
  const resolved = path.resolve(SOURCE_ROOT, ...repositoryPath.split('/'));
  const sourcePrefix = `${path.resolve(SOURCE_ROOT)}${path.sep}`;
  if (!resolved.startsWith(sourcePrefix)) throw new Error(`Unsafe manifest path: ${manifestPath}`);
  return resolved;
}

function sameStrings(left: readonly string[], right: readonly string[]): boolean {
  return [...left].sort().join('\u0000') === [...right].sort().join('\u0000');
}

function sameNumberRecord(left: Record<string, number>, right: Record<string, number>): boolean {
  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
  return [...keys].every((key) => left[key] === right[key]);
}

function increment(record: Record<string, number>, key: string): void {
  record[key] = (record[key] ?? 0) + 1;
}

function recordSignature(target: Map<string, number>, value: object): void {
  const signature = Object.keys(value).join(',');
  target.set(signature, (target.get(signature) ?? 0) + 1);
}

function signatureReport(signatures: Map<string, number>): SignatureCount[] {
  return [...signatures.entries()].map(([signature, count]) => ({
    keys: signature.length === 0 ? [] : signature.split(','),
    count
  }));
}

async function validateNoUnlistedPayloads(manifest: ReleaseManifest, errors: ValidationIssue[]): Promise<void> {
  const listed = new Set(manifest.files.map((file) => repositoryPathForManifestPath(file.path)));
  const discovered: string[] = [];
  for (const directory of ['pool', 'curated-sets']) {
    const entries = await readdir(path.join(SOURCE_ROOT, directory), { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith('.json')) discovered.push(`${directory}/${entry.name}`);
    }
  }
  for (const file of discovered) {
    if (!listed.has(file)) {
      errors.push(validationIssue('unlisted-source-file', file, 'JSON payload is present but not listed in the release manifest.'));
    }
  }
  for (const file of listed) {
    if (!discovered.includes(file)) {
      errors.push(validationIssue('missing-source-file', file, 'Manifest-listed JSON payload is missing.'));
    }
  }
}

export async function runContentPipeline(): Promise<ContentPipelineResult> {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];
  const manifestFile = await readJsonFile(path.join(SOURCE_ROOT, 'manifests', 'manifest.json'));
  const manifestValidation = validateReleaseManifest(manifestFile.value);
  if (!manifestValidation.valid || manifestValidation.value === undefined) {
    throw new Error(`Invalid release manifest:\n${manifestValidation.errors.map((item) => `${item.path}: ${item.message}`).join('\n')}`);
  }
  const manifest = manifestValidation.value;
  await validateNoUnlistedPayloads(manifest, errors);

  const signatureMaps = {
    pack: new Map<string, number>(),
    question: new Map<string, number>(),
    choice: new Map<string, number>(),
    usage: new Map<string, number>(),
    packMetadata: new Map<string, number>(),
    curatedSet: new Map<string, number>()
  };
  const rawPacks: RawContentPack[] = [];
  const normalizedPacks: NormalizedPack[] = [];
  const sourceReports: SourceFileReport[] = [];

  for (const manifestEntry of manifest.files) {
    const absolutePath = absoluteSourcePath(manifestEntry.path);
    let source: { bytes: Buffer; value: unknown };
    try {
      source = await readJsonFile(absolutePath);
    } catch (error) {
      errors.push(
        validationIssue(
          'source-read-failed',
          manifestEntry.path,
          error instanceof Error ? error.message : 'Could not read source file.'
        )
      );
      continue;
    }
    const digest = sha256(source.bytes);
    const packValidation = validateContentPack(source.value, {
      origin: 'built-in',
      inputBytes: source.bytes.byteLength,
      expectedPackId: manifestEntry.packId,
      expectedContentType: manifestEntry.kind === 'pool' ? 'pool' : 'curated-sets'
    });
    errors.push(...packValidation.errors.map((item) => ({ ...item, path: `${manifestEntry.path}:${item.path}` })));
    warnings.push(...packValidation.warnings.map((item) => ({ ...item, path: `${manifestEntry.path}:${item.path}` })));
    if (digest !== manifestEntry.sha256) {
      errors.push(validationIssue('source-hash-mismatch', manifestEntry.path, 'Exact source bytes do not match the manifest SHA-256 digest.'));
    }
    if (!packValidation.valid || packValidation.value === undefined) continue;
    const pack = packValidation.value;
    rawPacks.push(pack);

    if (pack.questions.length !== manifestEntry.questionCount) {
      errors.push(validationIssue('manifest-count-mismatch', manifestEntry.path, 'Manifest question count does not match source payload.'));
    }
    const actualCategories = [...new Set(pack.questions.map((question) => question.category))];
    if (!sameStrings(actualCategories, manifestEntry.categories)) {
      errors.push(validationIssue('manifest-category-mismatch', manifestEntry.path, 'Manifest categories do not match source payload.'));
    }
    if (!sameStrings(actualCategories, pack.categories)) {
      errors.push(validationIssue('pack-category-mismatch', manifestEntry.path, 'Pack categories do not match contained questions.'));
    }

    recordSignature(signatureMaps.pack, pack);
    recordSignature(signatureMaps.packMetadata, pack.metadata);
    for (const question of pack.questions) {
      recordSignature(signatureMaps.question, question);
      recordSignature(signatureMaps.usage, question.usage);
      question.choices.forEach((choice) => recordSignature(signatureMaps.choice, choice));
    }
    pack.sets.forEach((set) => recordSignature(signatureMaps.curatedSet, set));

    normalizedPacks.push(
      normalizePack(pack, {
        origin: 'built-in',
        sourceFile: manifestEntry.path,
        enabled: manifestEntry.defaultEnabled,
        sourceSha256: digest,
        applyBuiltInRepairs: true
      })
    );
    sourceReports.push({
      manifestPath: manifestEntry.path,
      repositoryPath: repositoryPathForManifestPath(manifestEntry.path),
      packId: pack.id,
      kind: manifestEntry.kind,
      byteLength: source.bytes.byteLength,
      utf8Bom: source.bytes.subarray(0, 3).equals(Buffer.from([0xef, 0xbb, 0xbf])),
      sourceSha256: digest,
      expectedSha256: manifestEntry.sha256,
      hashMatches: digest === manifestEntry.sha256,
      questionCount: pack.questions.length,
      setCount: pack.sets.length,
      categories: actualCategories
    });
  }

  const questionIds = rawPacks.flatMap((pack) => pack.questions.map((question) => question.id));
  const prompts = rawPacks.flatMap((pack) => pack.questions.map((question) => question.prompt));
  const setIds = rawPacks.flatMap((pack) => pack.sets.map((set) => set.id));
  if (new Set(questionIds).size !== questionIds.length) {
    errors.push(validationIssue('duplicate-release-question-id', '$release', 'Question IDs are duplicated across source packs.'));
  }
  if (new Set(prompts).size !== prompts.length) {
    errors.push(validationIssue('duplicate-release-prompt', '$release', 'Question prompts are duplicated across source packs.'));
  }
  if (new Set(setIds).size !== setIds.length) {
    errors.push(validationIssue('duplicate-release-set-id', '$release', 'Curated-set IDs are duplicated across source packs.'));
  }

  const poolPacks = rawPacks.filter((pack) => pack.contentType === 'pool');
  const curatedPacks = rawPacks.filter((pack) => pack.contentType === 'curated-sets');
  const poolQuestions = poolPacks.flatMap((pack) => pack.questions);
  const curatedQuestions = curatedPacks.flatMap((pack) => pack.questions);
  const curatedSets = curatedPacks.flatMap((pack) => pack.sets);
  const computedTotals = {
    poolFiles: poolPacks.length,
    curatedSetFiles: curatedPacks.length,
    poolQuestions: poolQuestions.length,
    curatedSetQuestions: curatedQuestions.length,
    totalUniqueQuestions: questionIds.length,
    curatedSets: curatedSets.length,
    primaryCategories: new Set(rawPacks.flatMap((pack) => pack.questions.map((question) => question.category))).size
  };
  for (const [key, value] of Object.entries(computedTotals)) {
    if (manifest.totals[key as keyof typeof manifest.totals] !== value) {
      errors.push(validationIssue('manifest-total-mismatch', `$.totals.${key}`, `Expected computed total ${value}.`));
    }
  }

  const normalizedRepairs = normalizedPacks.flatMap((pack) =>
    pack.questions.flatMap((question) =>
      question.normalizationRepairs.map((repair) => ({
        questionId: question.id,
        field: repair.field,
        sourceValue: repair.sourceValue,
        normalizedValue: repair.normalizedValue
      }))
    )
  );
  const expectedRepairIds = Object.keys(BUILT_IN_HINT_REPAIRS);
  if (!sameStrings(normalizedRepairs.map((repair) => repair.questionId), expectedRepairIds)) {
    errors.push(validationIssue('normalization-repair-mismatch', '$release', 'The normalized repair set is not exactly the five documented hint repairs.'));
  }
  for (const [questionId, repair] of Object.entries(BUILT_IN_HINT_REPAIRS)) {
    const rawQuestion = rawPacks.flatMap((pack) => pack.questions).find((question) => question.id === questionId);
    if (rawQuestion?.hint !== repair.sourceHint) {
      errors.push(validationIssue('repair-source-mismatch', questionId, 'Source hint does not match the documented immutable source value.'));
    }
  }

  const catalog = createSerializedCatalog(normalizedPacks, {
    releaseId: manifest.id,
    releaseVersion: manifest.version,
    eligibilityDate: manifest.integrity.validatedAt
  });

  const coverageFile = await readJsonFile(path.join(SOURCE_ROOT, 'manifests', 'coverage-index.json'));
  const coverage = coverageFile.value as {
    releaseId?: string;
    poolCoverage?: {
      questionsPerCategory?: Record<string, number>;
      questionsPerLevel?: Record<string, number>;
      questionsPerDisplayBand?: Record<string, number>;
      questionsPerInternalTier?: Record<string, number>;
    };
    curatedSetCoverage?: {
      setCount?: number;
      questionCount?: number;
      singleCategorySets?: number;
      mixedCategorySets?: number;
      questionsByCategory?: Record<string, number>;
    };
  };
  const poolByCategory: Record<string, number> = {};
  const poolByLevel: Record<string, number> = {};
  const poolByBand: Record<string, number> = {};
  const poolByTier: Record<string, number> = {};
  const curatedByCategory: Record<string, number> = {};
  normalizedPacks
    .filter((pack) => pack.source.contentType === 'pool')
    .flatMap((pack) => pack.questions)
    .forEach((question) => {
      increment(poolByCategory, question.category);
      increment(poolByLevel, String(question.level));
      increment(poolByBand, question.displayDifficulty);
      increment(poolByTier, question.internalTier);
    });
  normalizedPacks
    .filter((pack) => pack.source.contentType === 'curated-sets')
    .flatMap((pack) => pack.questions)
    .forEach((question) => increment(curatedByCategory, question.category));
  const normalizedQuestionById = new Map(catalog.questions.map((question) => [question.id, question]));
  const singleCategorySets = catalog.sets.filter(
    (set) => new Set(set.questionIds.map((id) => normalizedQuestionById.get(id)?.category)).size === 1
  ).length;
  if (coverage.releaseId !== manifest.id) errors.push(validationIssue('coverage-release-mismatch', '$coverage.releaseId', 'Coverage release ID does not match manifest.'));
  if (!sameNumberRecord(poolByCategory, coverage.poolCoverage?.questionsPerCategory ?? {})) errors.push(validationIssue('coverage-mismatch', '$coverage.poolCoverage.questionsPerCategory', 'Coverage index does not match source questions.'));
  if (!sameNumberRecord(poolByLevel, coverage.poolCoverage?.questionsPerLevel ?? {})) errors.push(validationIssue('coverage-mismatch', '$coverage.poolCoverage.questionsPerLevel', 'Coverage index does not match source questions.'));
  if (!sameNumberRecord(poolByBand, coverage.poolCoverage?.questionsPerDisplayBand ?? {})) errors.push(validationIssue('coverage-mismatch', '$coverage.poolCoverage.questionsPerDisplayBand', 'Coverage index does not match source questions.'));
  if (!sameNumberRecord(poolByTier, coverage.poolCoverage?.questionsPerInternalTier ?? {})) errors.push(validationIssue('coverage-mismatch', '$coverage.poolCoverage.questionsPerInternalTier', 'Coverage index does not match source questions.'));
  if (!sameNumberRecord(curatedByCategory, coverage.curatedSetCoverage?.questionsByCategory ?? {})) errors.push(validationIssue('coverage-mismatch', '$coverage.curatedSetCoverage.questionsByCategory', 'Coverage index does not match curated questions.'));
  if (coverage.curatedSetCoverage?.setCount !== catalog.sets.length) errors.push(validationIssue('coverage-mismatch', '$coverage.curatedSetCoverage.setCount', 'Coverage set count does not match.'));
  if (coverage.curatedSetCoverage?.questionCount !== curatedQuestions.length) errors.push(validationIssue('coverage-mismatch', '$coverage.curatedSetCoverage.questionCount', 'Coverage curated question count does not match.'));
  if (coverage.curatedSetCoverage?.singleCategorySets !== singleCategorySets) errors.push(validationIssue('coverage-mismatch', '$coverage.curatedSetCoverage.singleCategorySets', 'Coverage single-category set count does not match.'));
  if (coverage.curatedSetCoverage?.mixedCategorySets !== catalog.sets.length - singleCategorySets) errors.push(validationIssue('coverage-mismatch', '$coverage.curatedSetCoverage.mixedCategorySets', 'Coverage mixed-category set count does not match.'));

  warnings.push(
    warningIssue(
      'human-editorial-review-recommended',
      '$release',
      'Source packs are assistant-reviewed drafts; structural validation does not replace human factual review or play-test calibration.'
    )
  );

  const report: ContentValidationReport = {
    schemaVersion: manifest.schemaVersion,
    releaseId: manifest.id,
    releaseVersion: manifest.version,
    validatedAt: manifest.integrity.validatedAt,
    valid: errors.length === 0,
    sourceIntegrity: {
      algorithm: 'SHA-256',
      allHashesMatch: sourceReports.length === manifest.files.length && sourceReports.every((source) => source.hashMatches),
      sourceFiles: sourceReports
    },
    totals: {
      sourceFiles: sourceReports.length,
      poolFiles: poolPacks.length,
      curatedSetFiles: curatedPacks.length,
      questions: catalog.questions.length,
      poolQuestions: poolQuestions.length,
      curatedQuestions: curatedQuestions.length,
      curatedSets: catalog.sets.length,
      categories: new Set(catalog.questions.map((question) => question.category)).size,
      normalizationRepairs: normalizedRepairs.length
    },
    coverage: catalog.summary,
    releaseCoverage: {
      poolQuestionsPerCategory: Object.fromEntries(
        PRIMARY_CATEGORIES.map((category) => [category, poolByCategory[category] ?? 0])
      ),
      poolQuestionsPerLevel: Object.fromEntries(
        Array.from({ length: 15 }, (_, index) => [String(index + 1), poolByLevel[String(index + 1)] ?? 0])
      ),
      curatedQuestionsPerCategory: Object.fromEntries(
        PRIMARY_CATEGORIES.map((category) => [category, curatedByCategory[category] ?? 0])
      ),
      allQuestionsPerLevel: catalog.summary.byLevel,
      singleCategorySets,
      mixedCategorySets: catalog.sets.length - singleCategorySets
    },
    schemaSignatures: {
      pack: signatureReport(signatureMaps.pack),
      question: signatureReport(signatureMaps.question),
      choice: signatureReport(signatureMaps.choice),
      usage: signatureReport(signatureMaps.usage),
      packMetadata: signatureReport(signatureMaps.packMetadata),
      curatedSet: signatureReport(signatureMaps.curatedSet)
    },
    normalizationRepairs: normalizedRepairs,
    errors,
    warnings
  };

  const release: NormalizedRelease = {
    schemaVersion: manifest.schemaVersion,
    id: manifest.id,
    version: manifest.version,
    sourceManifest: 'content/source/release-001/manifests/manifest.json',
    sourceValidatedAt: manifest.integrity.validatedAt,
    sources: normalizedPacks.map((pack) => pack.source),
    questions: normalizedPacks.flatMap((pack) => pack.questions),
    sets: normalizedPacks.flatMap((pack) => pack.sets)
  };
  return { manifest, packs: normalizedPacks, release, catalog, report };
}

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

export async function writeNormalizedArtifacts(result: ContentPipelineResult): Promise<void> {
  await mkdir(NORMALIZED_ROOT, { recursive: true });
  await Promise.all([
    writeJson(path.join(NORMALIZED_ROOT, 'release.json'), result.release),
    writeJson(path.join(NORMALIZED_ROOT, 'catalog.json'), result.catalog),
    writeJson(path.join(NORMALIZED_ROOT, 'validation-report.json'), result.report)
  ]);
}

export async function writeGeneratedArtifacts(result: ContentPipelineResult): Promise<void> {
  await mkdir(GENERATED_ROOT, { recursive: true });
  await Promise.all([
    writeJson(path.join(GENERATED_ROOT, 'catalog.json'), result.catalog),
    writeJson(path.join(GENERATED_ROOT, 'catalog-report.json'), result.report)
  ]);
}

export function assertValidPipeline(result: ContentPipelineResult): void {
  if (!result.report.valid) {
    throw new Error(
      `Content validation failed:\n${result.report.errors.map((item) => `${item.path} [${item.code}] ${item.message}`).join('\n')}`
    );
  }
}

export function contentSummaryLine(result: ContentPipelineResult): string {
  const totals = result.report.totals;
  return `${totals.questions} questions (${totals.poolQuestions} pool + ${totals.curatedQuestions} curated), ${totals.curatedSets} sets, ${totals.sourceFiles} source files, ${totals.normalizationRepairs} repairs`;
}
