import {
  BUILT_IN_ID_PATTERN,
  IMPORT_LIMITS,
  LOCAL_ID_PATTERN,
  PACK_ID_PATTERN,
  SUPPORTED_CONTENT_SCHEMA_VERSION
} from '../constants';
import {
  PRIMARY_CATEGORIES,
  type PackContentType,
  type RawContentPack,
  type ReleaseManifest,
  type ValidationIssue,
  type ValidationResult
} from '../types';

type UnknownRecord = Record<string, unknown>;

export interface PackValidationOptions {
  origin: 'built-in' | 'imported';
  inputBytes?: number;
  expectedPackId?: string;
  expectedContentType?: 'pool' | 'curated-sets';
}

const CONTENT_TYPES = new Set<PackContentType>(['pool', 'curated-sets', 'mixed', 'both']);
const CATEGORY_SET = new Set<string>(PRIMARY_CATEGORIES);
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function addIssue(
  issues: ValidationIssue[],
  severity: ValidationIssue['severity'],
  code: string,
  path: string,
  message: string
): void {
  issues.push({ severity, code, path, message });
}

function hasUnsupportedMarkup(value: string): boolean {
  return (
    /<\/?[a-z][^>]*>/i.test(value) ||
    /javascript\s*:/i.test(value) ||
    /data\s*:\s*text\/html/i.test(value) ||
    /\bon[a-z]+\s*=/i.test(value) ||
    /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)
  );
}

function requiredString(
  object: UnknownRecord,
  key: string,
  path: string,
  errors: ValidationIssue[],
  maxLength: number,
  options: { markupSafe?: boolean } = {}
): string | undefined {
  const value = object[key];
  const fieldPath = `${path}.${key}`;
  if (typeof value !== 'string') {
    addIssue(errors, 'error', 'invalid-type', fieldPath, 'Expected a string.');
    return undefined;
  }
  if (value.trim().length === 0) {
    addIssue(errors, 'error', 'required-string', fieldPath, 'Value must not be blank.');
  }
  if ([...value].length > maxLength) {
    addIssue(errors, 'error', 'string-too-long', fieldPath, `Value exceeds ${maxLength} characters.`);
  }
  if (options.markupSafe !== false && hasUnsupportedMarkup(value)) {
    addIssue(errors, 'error', 'unsupported-markup', fieldPath, 'HTML, script URLs, event handlers, and control characters are not allowed.');
  }
  return value;
}

function optionalString(
  object: UnknownRecord,
  key: string,
  path: string,
  errors: ValidationIssue[],
  maxLength: number
): string | null | undefined {
  const value = object[key];
  if (value === undefined || value === null) return value;
  return requiredString(object, key, path, errors, maxLength);
}

function validateStringArray(
  value: unknown,
  path: string,
  errors: ValidationIssue[],
  maxItems: number,
  maxLength: number
): string[] {
  if (!Array.isArray(value)) {
    addIssue(errors, 'error', 'invalid-type', path, 'Expected an array of strings.');
    return [];
  }
  if (value.length > maxItems) {
    addIssue(errors, 'error', 'too-many-items', path, `Array exceeds ${maxItems} items.`);
  }
  const strings: string[] = [];
  value.forEach((item, index) => {
    if (typeof item !== 'string') {
      addIssue(errors, 'error', 'invalid-type', `${path}[${index}]`, 'Expected a string.');
      return;
    }
    if (item.trim().length === 0) {
      addIssue(errors, 'error', 'required-string', `${path}[${index}]`, 'Value must not be blank.');
    }
    if ([...item].length > maxLength) {
      addIssue(errors, 'error', 'string-too-long', `${path}[${index}]`, `Value exceeds ${maxLength} characters.`);
    }
    if (hasUnsupportedMarkup(item)) {
      addIssue(errors, 'error', 'unsupported-markup', `${path}[${index}]`, 'Unsupported markup is not allowed.');
    }
    strings.push(item);
  });
  return strings;
}

function localIdentity(id: string, packId: string, path: string, errors: ValidationIssue[]): string {
  if (!id.includes(':')) return id;
  const prefix = `${packId}:`;
  if (!id.startsWith(prefix) || id.length === prefix.length) {
    addIssue(errors, 'error', 'wrong-namespace', path, `Namespaced IDs must begin with "${prefix}".`);
    return id;
  }
  return id.slice(prefix.length);
}

function validateIdentity(
  id: string | undefined,
  packId: string,
  path: string,
  origin: PackValidationOptions['origin'],
  errors: ValidationIssue[]
): string | undefined {
  if (id === undefined) return undefined;
  if ([...id].length > IMPORT_LIMITS.maxIdLength) {
    addIssue(errors, 'error', 'id-too-long', path, `ID exceeds ${IMPORT_LIMITS.maxIdLength} characters.`);
  }
  if (origin === 'built-in') {
    if (!BUILT_IN_ID_PATTERN.test(id)) {
      addIssue(errors, 'error', 'invalid-id', path, 'Built-in IDs must use the reserved builtin-* kebab-case namespace.');
    }
    return id;
  }
  const localId = localIdentity(id, packId, path, errors);
  if (!LOCAL_ID_PATTERN.test(localId)) {
    addIssue(errors, 'error', 'invalid-id', path, 'Imported IDs must be lowercase kebab-case, optionally prefixed by their pack ID.');
  }
  return localId;
}

function validateMetadata(metadata: unknown, path: string, errors: ValidationIssue[]): UnknownRecord {
  if (!isRecord(metadata)) {
    addIssue(errors, 'error', 'invalid-type', path, 'Expected a metadata object.');
    return {};
  }
  for (const key of ['author', 'creator', 'reviewStatus', 'verificationNotes', 'sourceNotes', 'generatedBy', 'createdAt', 'modifiedAt']) {
    optionalString(metadata, key, path, errors, IMPORT_LIMITS.maxDescriptionLength);
  }
  for (const key of ['questionCount', 'questionsPerCategory', 'setCount', 'timeSensitiveQuestionCount']) {
    const value = metadata[key];
    if (value !== undefined && (!Number.isInteger(value) || (value as number) < 0)) {
      addIssue(errors, 'error', 'invalid-number', `${path}.${key}`, 'Expected a non-negative integer.');
    }
  }
  if (metadata.humanReviewRecommended !== undefined && typeof metadata.humanReviewRecommended !== 'boolean') {
    addIssue(errors, 'error', 'invalid-type', `${path}.humanReviewRecommended`, 'Expected a boolean.');
  }
  return metadata;
}

function validateQuestionMetadata(metadata: unknown, path: string, errors: ValidationIssue[]): void {
  if (metadata === undefined) return;
  if (!isRecord(metadata)) {
    addIssue(errors, 'error', 'invalid-type', path, 'Expected a metadata object.');
    return;
  }
  for (const key of [
    'language',
    'author',
    'reviewStatus',
    'verificationNotes',
    'sourceNotes',
    'generatedBy',
    'createdAt',
    'modifiedAt'
  ]) {
    optionalString(metadata, key, path, errors, IMPORT_LIMITS.maxDescriptionLength);
  }
  if (metadata.timeSensitive !== undefined && typeof metadata.timeSensitive !== 'boolean') {
    addIssue(errors, 'error', 'invalid-type', `${path}.timeSensitive`, 'Expected a boolean.');
  }
  if (metadata.validThrough !== undefined && metadata.validThrough !== null) {
    const date = optionalString(metadata, 'validThrough', path, errors, 10);
    if (typeof date === 'string' && !ISO_DATE_PATTERN.test(date)) {
      addIssue(errors, 'error', 'invalid-date', `${path}.validThrough`, 'Expected an ISO date in YYYY-MM-DD form.');
    }
  }
}

export function parseJsonData(text: string): ValidationResult<unknown> {
  try {
    const value: unknown = JSON.parse(text.replace(/^\uFEFF/, ''));
    return { valid: true, errors: [], warnings: [], value };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown JSON parse error.';
    const issue: ValidationIssue = {
      severity: 'error',
      code: 'malformed-json',
      path: '$',
      message: `Could not parse JSON: ${message}`
    };
    return { valid: false, errors: [issue], warnings: [] };
  }
}

export function validateContentPack(input: unknown, options: PackValidationOptions): ValidationResult<RawContentPack> {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];

  if (options.inputBytes !== undefined && options.inputBytes > IMPORT_LIMITS.maxBytes) {
    addIssue(errors, 'error', 'pack-too-large', '$', `Pack exceeds the ${IMPORT_LIMITS.maxBytes}-byte import limit.`);
  }
  if (!isRecord(input)) {
    addIssue(errors, 'error', 'invalid-pack', '$', 'Question pack must be a JSON object.');
    return { valid: false, errors, warnings };
  }

  const schemaVersion = requiredString(input, 'schemaVersion', '$', errors, 24, { markupSafe: false });
  if (schemaVersion !== undefined && schemaVersion !== SUPPORTED_CONTENT_SCHEMA_VERSION) {
    addIssue(errors, 'error', 'unsupported-schema', '$.schemaVersion', `Only schema ${SUPPORTED_CONTENT_SCHEMA_VERSION} is supported.`);
  }
  const packId = requiredString(input, 'id', '$', errors, IMPORT_LIMITS.maxIdLength, { markupSafe: false }) ?? '';
  if (options.origin === 'built-in') {
    if (!BUILT_IN_ID_PATTERN.test(packId)) {
      addIssue(errors, 'error', 'invalid-pack-id', '$.id', 'Built-in pack IDs must use the builtin-* namespace.');
    }
  } else {
    if (!PACK_ID_PATTERN.test(packId)) {
      addIssue(errors, 'error', 'invalid-pack-id', '$.id', 'Pack ID must be lowercase kebab-case and begin with a letter.');
    }
    if (packId.startsWith('builtin-')) {
      addIssue(errors, 'error', 'reserved-namespace', '$.id', 'The builtin-* namespace is reserved.');
    }
  }
  if (options.expectedPackId !== undefined && packId !== options.expectedPackId) {
    addIssue(errors, 'error', 'pack-id-mismatch', '$.id', `Manifest expected pack ID "${options.expectedPackId}".`);
  }

  requiredString(input, 'title', '$', errors, IMPORT_LIMITS.maxPackTitleLength);
  requiredString(input, 'description', '$', errors, IMPORT_LIMITS.maxDescriptionLength);
  requiredString(input, 'version', '$', errors, 64, { markupSafe: false });
  requiredString(input, 'language', '$', errors, 32, { markupSafe: false });

  const contentType = input.contentType;
  if (typeof contentType !== 'string' || !CONTENT_TYPES.has(contentType as PackContentType)) {
    addIssue(errors, 'error', 'invalid-content-type', '$.contentType', 'Expected pool, curated-sets, mixed, or both.');
  }
  if (options.expectedContentType !== undefined && contentType !== options.expectedContentType) {
    addIssue(errors, 'error', 'content-type-mismatch', '$.contentType', `Manifest expected "${options.expectedContentType}".`);
  }

  const categories = validateStringArray(input.categories, '$.categories', errors, PRIMARY_CATEGORIES.length, 80);
  const duplicateCategories = categories.filter((category, index) => categories.indexOf(category) !== index);
  if (duplicateCategories.length > 0) {
    addIssue(errors, 'error', 'duplicate-category', '$.categories', 'Pack category list contains duplicates.');
  }
  categories.forEach((category, index) => {
    if (!CATEGORY_SET.has(category)) {
      addIssue(errors, 'error', 'invalid-category', `$.categories[${index}]`, `Unknown primary category "${category}".`);
    }
  });

  const questions = Array.isArray(input.questions) ? input.questions : [];
  if (!Array.isArray(input.questions)) {
    addIssue(errors, 'error', 'invalid-type', '$.questions', 'Expected a question array.');
  }
  if (questions.length === 0) {
    addIssue(errors, 'error', 'empty-pack', '$.questions', 'Pack must contain at least one question.');
  }
  if (questions.length > IMPORT_LIMITS.maxQuestions) {
    addIssue(errors, 'error', 'too-many-questions', '$.questions', `Pack exceeds ${IMPORT_LIMITS.maxQuestions} questions.`);
  }

  const questionLocalIds = new Map<string, { index: number; level: number; usageSetIds: string[]; freshMix: boolean }>();
  const questionCategories = new Set<string>();
  questions.forEach((question, questionIndex) => {
    const path = `$.questions[${questionIndex}]`;
    if (!isRecord(question)) {
      addIssue(errors, 'error', 'invalid-question', path, 'Question must be an object.');
      return;
    }
    const rawId = requiredString(question, 'id', path, errors, IMPORT_LIMITS.maxIdLength, { markupSafe: false });
    const localId = validateIdentity(rawId, packId, `${path}.id`, options.origin, errors);
    if (localId !== undefined) {
      if (questionLocalIds.has(localId)) {
        addIssue(errors, 'error', 'duplicate-question-id', `${path}.id`, `Duplicate question ID "${rawId}".`);
      }
    }

    const level = question.level;
    if (!Number.isInteger(level) || (level as number) < 1 || (level as number) > 15) {
      addIssue(errors, 'error', 'invalid-level', `${path}.level`, 'Level must be an integer from 1 through 15.');
    }
    const category = requiredString(question, 'category', path, errors, 80);
    if (category !== undefined) {
      questionCategories.add(category);
      if (!CATEGORY_SET.has(category)) {
        addIssue(errors, 'error', 'invalid-category', `${path}.category`, `Unknown primary category "${category}".`);
      }
    }
    validateStringArray(
      question.tags,
      `${path}.tags`,
      errors,
      IMPORT_LIMITS.maxTagsPerQuestion,
      IMPORT_LIMITS.maxTagLength
    );
    requiredString(question, 'prompt', path, errors, IMPORT_LIMITS.maxPromptLength);
    requiredString(question, 'hint', path, errors, IMPORT_LIMITS.maxHintLength);
    requiredString(question, 'explanation', path, errors, IMPORT_LIMITS.maxExplanationLength);

    const choices = Array.isArray(question.choices) ? question.choices : [];
    if (!Array.isArray(question.choices)) {
      addIssue(errors, 'error', 'invalid-type', `${path}.choices`, 'Expected an answer-choice array.');
    }
    if (choices.length !== 4) {
      addIssue(errors, 'error', 'invalid-choice-count', `${path}.choices`, 'Every question must contain exactly four choices.');
    }
    const choiceIds = new Set<string>();
    const visibleChoices = new Set<string>();
    choices.forEach((choice, choiceIndex) => {
      const choicePath = `${path}.choices[${choiceIndex}]`;
      if (!isRecord(choice)) {
        addIssue(errors, 'error', 'invalid-choice', choicePath, 'Choice must be an object.');
        return;
      }
      const choiceId = requiredString(choice, 'id', choicePath, errors, IMPORT_LIMITS.maxIdLength, { markupSafe: false });
      if (choiceId !== undefined) {
        if (!LOCAL_ID_PATTERN.test(choiceId)) {
          addIssue(errors, 'error', 'invalid-choice-id', `${choicePath}.id`, 'Choice ID must be lowercase kebab-case.');
        }
        if (choiceIds.has(choiceId)) {
          addIssue(errors, 'error', 'duplicate-choice-id', `${choicePath}.id`, `Duplicate choice ID "${choiceId}".`);
        }
        choiceIds.add(choiceId);
      }
      const choiceText = requiredString(choice, 'text', choicePath, errors, IMPORT_LIMITS.maxChoiceLength);
      if (choiceText !== undefined) {
        const visibleKey = choiceText.trim().toLocaleLowerCase('en-US');
        if (visibleChoices.has(visibleKey)) {
          addIssue(errors, 'error', 'duplicate-choice-text', `${choicePath}.text`, 'Visible answer choices must be distinct.');
        }
        visibleChoices.add(visibleKey);
      }
    });
    const correctChoiceId = requiredString(question, 'correctChoiceId', path, errors, IMPORT_LIMITS.maxIdLength, {
      markupSafe: false
    });
    if (correctChoiceId !== undefined && !choiceIds.has(correctChoiceId)) {
      addIssue(errors, 'error', 'broken-correct-reference', `${path}.correctChoiceId`, 'Correct-choice ID does not reference one of the four choices.');
    }

    const usage = question.usage;
    let usageSetIds: string[] = [];
    let freshMix = false;
    if (!isRecord(usage)) {
      addIssue(errors, 'error', 'invalid-usage', `${path}.usage`, 'Usage membership must be an object.');
    } else {
      if (typeof usage.freshMix !== 'boolean') {
        addIssue(errors, 'error', 'invalid-type', `${path}.usage.freshMix`, 'Expected a boolean.');
      } else {
        freshMix = usage.freshMix;
      }
      const rawSetIds = validateStringArray(usage.setIds, `${path}.usage.setIds`, errors, IMPORT_LIMITS.maxSets, IMPORT_LIMITS.maxIdLength);
      usageSetIds = rawSetIds.map((setId, setIndex) => {
        const localSetId = options.origin === 'imported'
          ? localIdentity(setId, packId, `${path}.usage.setIds[${setIndex}]`, errors)
          : setId;
        validateIdentity(setId, packId, `${path}.usage.setIds[${setIndex}]`, options.origin, errors);
        return localSetId;
      });
      if (new Set(usageSetIds).size !== usageSetIds.length) {
        addIssue(errors, 'error', 'duplicate-set-membership', `${path}.usage.setIds`, 'Set membership list contains duplicates.');
      }
      if (!freshMix && usageSetIds.length === 0) {
        addIssue(errors, 'error', 'unused-question', `${path}.usage`, 'Question must be eligible for Fresh Mix, a curated set, or both.');
      }
    }
    validateQuestionMetadata(question.metadata, `${path}.metadata`, errors);
    if (localId !== undefined) {
      questionLocalIds.set(localId, {
        index: questionIndex,
        level: typeof level === 'number' ? level : 0,
        usageSetIds,
        freshMix
      });
    }
  });

  const sets = Array.isArray(input.sets) ? input.sets : [];
  if (!Array.isArray(input.sets)) {
    addIssue(errors, 'error', 'invalid-type', '$.sets', 'Expected a curated-set array.');
  }
  if (sets.length > IMPORT_LIMITS.maxSets) {
    addIssue(errors, 'error', 'too-many-sets', '$.sets', `Pack exceeds ${IMPORT_LIMITS.maxSets} curated sets.`);
  }
  const setLocalIds = new Map<string, { index: number; questionIds: string[] }>();
  sets.forEach((set, setIndex) => {
    const path = `$.sets[${setIndex}]`;
    if (!isRecord(set)) {
      addIssue(errors, 'error', 'invalid-set', path, 'Curated set must be an object.');
      return;
    }
    const rawId = requiredString(set, 'id', path, errors, IMPORT_LIMITS.maxIdLength, { markupSafe: false });
    const localId = validateIdentity(rawId, packId, `${path}.id`, options.origin, errors);
    if (localId !== undefined && setLocalIds.has(localId)) {
      addIssue(errors, 'error', 'duplicate-set-id', `${path}.id`, `Duplicate curated-set ID "${rawId}".`);
    }
    requiredString(set, 'title', path, errors, IMPORT_LIMITS.maxPackTitleLength);
    requiredString(set, 'description', path, errors, IMPORT_LIMITS.maxDescriptionLength);
    requiredString(set, 'theme', path, errors, 160);
    validateStringArray(set.tags, `${path}.tags`, errors, IMPORT_LIMITS.maxTagsPerQuestion, IMPORT_LIMITS.maxTagLength);
    optionalString(set, 'audience', path, errors, 240);
    optionalString(set, 'difficultyNote', path, errors, 500);
    const rawQuestionIds = validateStringArray(
      set.questionIds,
      `${path}.questionIds`,
      errors,
      15,
      IMPORT_LIMITS.maxIdLength
    );
    const questionIds = rawQuestionIds.map((questionId, questionIndex) => {
      const localQuestionId = options.origin === 'imported'
        ? localIdentity(questionId, packId, `${path}.questionIds[${questionIndex}]`, errors)
        : questionId;
      validateIdentity(questionId, packId, `${path}.questionIds[${questionIndex}]`, options.origin, errors);
      return localQuestionId;
    });
    if (questionIds.length !== 15) {
      addIssue(errors, 'error', 'invalid-set-length', `${path}.questionIds`, 'Curated set must reference exactly 15 questions.');
    }
    if (new Set(questionIds).size !== questionIds.length) {
      addIssue(errors, 'error', 'duplicate-set-question', `${path}.questionIds`, 'Curated set question references must be unique.');
    }
    if (localId !== undefined) setLocalIds.set(localId, { index: setIndex, questionIds });
  });

  for (const [setId, setData] of setLocalIds) {
    setData.questionIds.forEach((questionId, position) => {
      const question = questionLocalIds.get(questionId);
      const path = `$.sets[${setData.index}].questionIds[${position}]`;
      if (question === undefined) {
        addIssue(errors, 'error', 'broken-set-reference', path, `Question "${questionId}" does not exist in this pack.`);
        return;
      }
      if (question.level !== position + 1) {
        addIssue(errors, 'error', 'wrong-set-level', path, `Position ${position + 1} must reference a Level ${position + 1} question.`);
      }
      if (!question.usageSetIds.includes(setId)) {
        addIssue(errors, 'error', 'missing-set-membership', path, `Question "${questionId}" does not declare membership in set "${setId}".`);
      }
    });
  }
  for (const [questionId, question] of questionLocalIds) {
    question.usageSetIds.forEach((setId) => {
      const set = setLocalIds.get(setId);
      if (set === undefined) {
        addIssue(
          errors,
          'error',
          'broken-membership-reference',
          `$.questions[${question.index}].usage.setIds`,
          `Question references missing set "${setId}".`
        );
      } else if (!set.questionIds.includes(questionId)) {
        addIssue(
          errors,
          'error',
          'asymmetric-set-membership',
          `$.questions[${question.index}].usage.setIds`,
          `Set "${setId}" does not reference question "${questionId}".`
        );
      }
    });
  }

  if (contentType === 'pool' && sets.length !== 0) {
    addIssue(errors, 'error', 'pool-has-sets', '$.sets', 'A pool pack cannot contain curated sets.');
  }
  if (contentType === 'pool') {
    for (const [questionId, question] of questionLocalIds) {
      if (!question.freshMix || question.usageSetIds.length !== 0) {
        addIssue(errors, 'error', 'invalid-pool-usage', `$.questions[${question.index}].usage`, `Pool question "${questionId}" must be Fresh Mix only.`);
      }
    }
  }
  if (contentType === 'curated-sets' && sets.length === 0) {
    addIssue(errors, 'error', 'missing-curated-set', '$.sets', 'A curated-sets pack must contain at least one set.');
  }

  for (const category of questionCategories) {
    if (!categories.includes(category)) {
      addIssue(errors, 'error', 'undeclared-category', '$.categories', `Question category "${category}" is missing from the pack category list.`);
    }
  }
  for (const category of categories) {
    if (!questionCategories.has(category)) {
      addIssue(errors, 'error', 'unused-category', '$.categories', `Declared category "${category}" is not used by any question.`);
    }
  }

  const metadata = validateMetadata(input.metadata, '$.metadata', errors);
  if (metadata.questionCount !== undefined && metadata.questionCount !== questions.length) {
    addIssue(errors, 'error', 'metadata-count-mismatch', '$.metadata.questionCount', 'Metadata question count does not match the payload.');
  }
  if (metadata.setCount !== undefined && metadata.setCount !== sets.length) {
    addIssue(errors, 'error', 'metadata-count-mismatch', '$.metadata.setCount', 'Metadata set count does not match the payload.');
  }
  const actualTimeSensitiveCount = questions.filter(
    (question) => isRecord(question) && isRecord(question.metadata) && question.metadata.timeSensitive === true
  ).length;
  if (metadata.timeSensitiveQuestionCount !== undefined && metadata.timeSensitiveQuestionCount !== actualTimeSensitiveCount) {
    addIssue(errors, 'error', 'metadata-count-mismatch', '$.metadata.timeSensitiveQuestionCount', 'Metadata time-sensitive count does not match question metadata.');
  }

  if (options.origin === 'imported' && typeof metadata.author !== 'string' && typeof metadata.creator !== 'string') {
    addIssue(warnings, 'warning', 'missing-author', '$.metadata', 'Imported pack has no author or creator label.');
  }
  if (options.origin === 'imported' && typeof metadata.reviewStatus !== 'string') {
    addIssue(warnings, 'warning', 'missing-review-status', '$.metadata.reviewStatus', 'Imported questions should be human-reviewed before play.');
  } else if (
    options.origin === 'imported' &&
    typeof metadata.reviewStatus === 'string' &&
    ['unreviewed', 'assistant-reviewed-draft', 'draft'].includes(metadata.reviewStatus.toLocaleLowerCase('en-US'))
  ) {
    addIssue(
      warnings,
      'warning',
      'human-review-recommended',
      '$.metadata.reviewStatus',
      'Structural validation passed, but this pack still requires human factual and difficulty review.'
    );
  }

  const valid = errors.length === 0;
  return {
    valid,
    errors,
    warnings,
    ...(valid ? { value: input as unknown as RawContentPack } : {})
  };
}

export function validateReleaseManifest(input: unknown): ValidationResult<ReleaseManifest> {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];
  if (!isRecord(input)) {
    addIssue(errors, 'error', 'invalid-manifest', '$', 'Release manifest must be an object.');
    return { valid: false, errors, warnings };
  }
  const schemaVersion = requiredString(input, 'schemaVersion', '$', errors, 24, { markupSafe: false });
  if (schemaVersion !== undefined && schemaVersion !== SUPPORTED_CONTENT_SCHEMA_VERSION) {
    addIssue(errors, 'error', 'unsupported-schema', '$.schemaVersion', `Only schema ${SUPPORTED_CONTENT_SCHEMA_VERSION} is supported.`);
  }
  requiredString(input, 'id', '$', errors, IMPORT_LIMITS.maxIdLength, { markupSafe: false });
  requiredString(input, 'title', '$', errors, IMPORT_LIMITS.maxPackTitleLength);
  requiredString(input, 'version', '$', errors, 64, { markupSafe: false });
  requiredString(input, 'description', '$', errors, IMPORT_LIMITS.maxDescriptionLength);
  if (!isRecord(input.totals)) addIssue(errors, 'error', 'invalid-type', '$.totals', 'Expected a totals object.');
  if (!isRecord(input.integrity)) addIssue(errors, 'error', 'invalid-type', '$.integrity', 'Expected an integrity object.');
  if (isRecord(input.integrity)) {
    if (input.integrity.hashAlgorithm !== 'SHA-256') {
      addIssue(errors, 'error', 'unsupported-hash', '$.integrity.hashAlgorithm', 'Only SHA-256 is supported.');
    }
    requiredString(input.integrity, 'hashScope', '$.integrity', errors, 500);
    const date = requiredString(input.integrity, 'validatedAt', '$.integrity', errors, 10, { markupSafe: false });
    if (date !== undefined && !ISO_DATE_PATTERN.test(date)) {
      addIssue(errors, 'error', 'invalid-date', '$.integrity.validatedAt', 'Expected an ISO date in YYYY-MM-DD form.');
    }
  }
  const files = Array.isArray(input.files) ? input.files : [];
  if (!Array.isArray(input.files) || files.length === 0) {
    addIssue(errors, 'error', 'invalid-files', '$.files', 'Manifest must list at least one content file.');
  }
  const paths = new Set<string>();
  const packIds = new Set<string>();
  files.forEach((file, index) => {
    const path = `$.files[${index}]`;
    if (!isRecord(file)) {
      addIssue(errors, 'error', 'invalid-file-entry', path, 'Manifest file entry must be an object.');
      return;
    }
    if (file.kind !== 'pool' && file.kind !== 'set') {
      addIssue(errors, 'error', 'invalid-kind', `${path}.kind`, 'Kind must be pool or set.');
    }
    const relativePath = requiredString(file, 'path', path, errors, 500, { markupSafe: false });
    if (relativePath !== undefined) {
      if (relativePath.includes('..') || relativePath.startsWith('/') || /^[A-Za-z]:/.test(relativePath)) {
        addIssue(errors, 'error', 'unsafe-path', `${path}.path`, 'Manifest paths must be safe relative paths.');
      }
      if (paths.has(relativePath)) addIssue(errors, 'error', 'duplicate-path', `${path}.path`, 'Manifest path is duplicated.');
      paths.add(relativePath);
    }
    const packId = requiredString(file, 'packId', path, errors, IMPORT_LIMITS.maxIdLength, { markupSafe: false });
    if (packId !== undefined) {
      if (!BUILT_IN_ID_PATTERN.test(packId)) addIssue(errors, 'error', 'invalid-pack-id', `${path}.packId`, 'Built-in pack ID is invalid.');
      if (packIds.has(packId)) addIssue(errors, 'error', 'duplicate-pack-id', `${path}.packId`, 'Manifest pack ID is duplicated.');
      packIds.add(packId);
    }
    if (!Number.isInteger(file.questionCount) || (file.questionCount as number) < 1) {
      addIssue(errors, 'error', 'invalid-number', `${path}.questionCount`, 'Question count must be a positive integer.');
    }
    const categories = validateStringArray(file.categories, `${path}.categories`, errors, PRIMARY_CATEGORIES.length, 80);
    categories.forEach((category, categoryIndex) => {
      if (!CATEGORY_SET.has(category)) {
        addIssue(errors, 'error', 'invalid-category', `${path}.categories[${categoryIndex}]`, `Unknown category "${category}".`);
      }
    });
    if (typeof file.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(file.sha256)) {
      addIssue(errors, 'error', 'invalid-hash', `${path}.sha256`, 'Expected a lowercase SHA-256 digest.');
    }
    if (typeof file.defaultEnabled !== 'boolean') {
      addIssue(errors, 'error', 'invalid-type', `${path}.defaultEnabled`, 'Expected a boolean.');
    }
  });
  const valid = errors.length === 0;
  return { valid, errors, warnings, ...(valid ? { value: input as unknown as ReleaseManifest } : {}) };
}
