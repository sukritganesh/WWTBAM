import { normalizePack } from '../normalize';
import type {
  ExistingContentIdentity,
  ImportConflict,
  ImportPreview,
  PreparedImportTransaction,
  RawContentPack,
  RuntimeContentCatalog,
  ValidationIssue
} from '../types';
import { parseJsonData, validateContentPack } from '../validators';

export interface PrepareImportOptions {
  allowPackUpdate?: boolean;
  enabled?: boolean;
}

export const EMPTY_CONTENT_IDENTITY: ExistingContentIdentity = {
  packVersions: new Map(),
  questionOwners: new Map(),
  setOwners: new Map()
};

function issue(severity: ValidationIssue['severity'], code: string, path: string, message: string): ValidationIssue {
  return { severity, code, path, message };
}

function semverParts(version: string): number[] | null {
  if (!/^\d+(?:\.\d+){0,2}(?:-[0-9A-Za-z.-]+)?$/.test(version)) return null;
  return version.split('-', 1)[0].split('.').map(Number);
}

function compareVersions(left: string, right: string): number | null {
  const leftParts = semverParts(left);
  const rightParts = semverParts(right);
  if (leftParts === null || rightParts === null) return null;
  for (let index = 0; index < 3; index += 1) {
    const difference = (leftParts[index] ?? 0) - (rightParts[index] ?? 0);
    if (difference !== 0) return Math.sign(difference);
  }
  return 0;
}

function previewFromUnknown(input: unknown): Omit<ImportPreview, 'valid' | 'conflicts' | 'errors' | 'warnings'> {
  const object = typeof input === 'object' && input !== null && !Array.isArray(input)
    ? (input as Record<string, unknown>)
    : {};
  const questions = Array.isArray(object.questions) ? object.questions : [];
  const sets = Array.isArray(object.sets) ? object.sets : [];
  const validQuestions = questions.filter(
    (question): question is Record<string, unknown> => typeof question === 'object' && question !== null && !Array.isArray(question)
  );
  return {
    packId: typeof object.id === 'string' ? object.id : null,
    packVersion: typeof object.version === 'string' ? object.version : null,
    questionCount: questions.length,
    freshMixQuestionCount: validQuestions.filter(
      (question) =>
        typeof question.usage === 'object' &&
        question.usage !== null &&
        !Array.isArray(question.usage) &&
        (question.usage as Record<string, unknown>).freshMix === true
    ).length,
    setCount: sets.length,
    levelsRepresented: [
      ...new Set(validQuestions.map((question) => question.level).filter((level): level is number => Number.isInteger(level)))
    ].sort((left, right) => left - right),
    categoriesRepresented: [
      ...new Set(validQuestions.map((question) => question.category).filter((category): category is string => typeof category === 'string'))
    ].sort()
  };
}

function rejectedPreview(
  input: unknown,
  errors: ValidationIssue[],
  warnings: ValidationIssue[] = [],
  conflicts: ImportConflict[] = []
): PreparedImportTransaction {
  return {
    status: 'rejected',
    preview: { ...previewFromUnknown(input), valid: false, conflicts, errors, warnings },
    payload: null
  };
}

function namespaced(packId: string, id: string): string {
  return id.startsWith(`${packId}:`) ? id : `${packId}:${id}`;
}

export function existingIdentityFromCatalog(catalog: RuntimeContentCatalog): ExistingContentIdentity {
  return {
    packVersions: new Map(catalog.sources.map((source) => [source.id, source.version])),
    questionOwners: new Map(catalog.questions.map((question) => [question.id, question.sourcePackId])),
    setOwners: new Map(catalog.sets.map((set) => [set.id, set.sourcePackId]))
  };
}

export function prepareCustomPackImport(
  input: string | unknown,
  existing: ExistingContentIdentity = EMPTY_CONTENT_IDENTITY,
  options: PrepareImportOptions = {}
): PreparedImportTransaction {
  let parsed: unknown = input;
  let inputBytes: number | undefined;
  if (typeof input === 'string') {
    inputBytes = new TextEncoder().encode(input).byteLength;
    const parseResult = parseJsonData(input);
    if (!parseResult.valid) return rejectedPreview(null, parseResult.errors);
    parsed = parseResult.value;
  }

  const validation = validateContentPack(parsed, { origin: 'imported', inputBytes });
  if (!validation.valid || validation.value === undefined) {
    return rejectedPreview(parsed, validation.errors, validation.warnings);
  }
  const pack: RawContentPack = validation.value;
  const conflicts: ImportConflict[] = [];
  const conflictErrors: ValidationIssue[] = [];
  const warnings = [...validation.warnings];
  const installedVersion = existing.packVersions.get(pack.id);
  const isUpdate = installedVersion !== undefined;

  if (installedVersion !== undefined) {
    conflicts.push({
      kind: 'pack',
      id: pack.id,
      existingPackId: pack.id,
      message: `Pack ${pack.id} version ${installedVersion} is already installed.`
    });
    if (!options.allowPackUpdate) {
      conflictErrors.push(
        issue('error', 'pack-already-installed', '$.id', 'Importing an existing pack ID requires an explicit update decision.')
      );
    } else {
      const comparison = compareVersions(pack.version, installedVersion);
      if (comparison === 0) {
        warnings.push(
          issue('warning', 'same-version-update', '$.version', 'The imported pack has the same version as the installed pack; compare content before replacing it.')
        );
      } else if (comparison !== null && comparison < 0) {
        warnings.push(
          issue('warning', 'pack-downgrade', '$.version', `This would downgrade ${pack.id} from ${installedVersion} to ${pack.version}.`)
        );
      } else if (comparison === null) {
        warnings.push(
          issue('warning', 'uncomparable-version', '$.version', 'Pack versions are not comparable as semantic versions.')
        );
      }
    }
  }

  for (const question of pack.questions) {
    const globalId = namespaced(pack.id, question.id);
    const owner = existing.questionOwners.get(globalId);
    if (owner !== undefined && !(options.allowPackUpdate && owner === pack.id)) {
      conflicts.push({
        kind: 'question',
        id: globalId,
        existingPackId: owner,
        message: `Question ID ${globalId} already belongs to ${owner}.`
      });
      conflictErrors.push(
        issue('error', 'duplicate-global-question-id', '$.questions', `Question ID ${globalId} conflicts with enabled content.`)
      );
    }
  }
  for (const set of pack.sets) {
    const globalId = namespaced(pack.id, set.id);
    const owner = existing.setOwners.get(globalId);
    if (owner !== undefined && !(options.allowPackUpdate && owner === pack.id)) {
      conflicts.push({
        kind: 'set',
        id: globalId,
        existingPackId: owner,
        message: `Curated-set ID ${globalId} already belongs to ${owner}.`
      });
      conflictErrors.push(
        issue('error', 'duplicate-global-set-id', '$.sets', `Curated-set ID ${globalId} conflicts with enabled content.`)
      );
    }
  }

  if (conflictErrors.length > 0) {
    return rejectedPreview(parsed, conflictErrors, warnings, conflicts);
  }

  const normalized = normalizePack(pack, {
    origin: 'imported',
    sourceFile: `import:${pack.id}`,
    enabled: options.enabled ?? true,
    sourceSha256: null,
    applyBuiltInRepairs: false
  });
  const preview: ImportPreview = {
    ...previewFromUnknown(pack),
    valid: true,
    conflicts,
    errors: [],
    warnings
  };

  // This is a complete staging payload: callers either persist every record in one
  // storage transaction or discard it. Invalid imports never expose a partial payload.
  return {
    status: 'ready',
    preview,
    payload: {
      pack: normalized,
      operation: isUpdate ? 'update' : 'install'
    }
  };
}
