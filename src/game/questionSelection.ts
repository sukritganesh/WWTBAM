import { shuffleWithSeed, normalizeSeed, randomIndex, type RandomSeed } from './random';
import {
  ANSWER_LETTERS,
  LADDER_LEVELS,
  type CuratedSetDefinition,
  type CuratedSetProgress,
  type FifteenQuestionRun,
  type FourResolvedChoices,
  type LadderLevel,
  type QuestionDefinition,
  type QuestionEncounter,
  type QuestionHistory,
  type ResolvedQuestionSnapshot,
} from './types';

export type QuestionSelectionErrorCode =
  | 'duplicate-question-id'
  | 'invalid-question'
  | 'missing-level'
  | 'invalid-curated-set'
  | 'missing-curated-question'
  | 'no-surprise-set'
  | 'invalid-history';

export class QuestionSelectionError extends Error {
  readonly code: QuestionSelectionErrorCode;
  readonly level?: LadderLevel;

  constructor(
    code: QuestionSelectionErrorCode,
    message: string,
    options: { readonly level?: LadderLevel } = {},
  ) {
    super(message);
    this.name = 'QuestionSelectionError';
    this.code = code;
    this.level = options.level;
  }
}

export interface FreshMixSelectionOptions {
  readonly seed: RandomSeed;
  readonly history?: QuestionHistory;
  /** Pack/review/expiration/source filters belong at this explicit boundary. */
  readonly isEligible?: (question: QuestionDefinition) => boolean;
  /** Prefers an unused category only after all freshness priorities tie. */
  readonly preferCategoryDiversity?: boolean;
}

export interface FreshMixSelectionResult {
  readonly questions: FifteenQuestionRun;
  readonly nextSeed: number;
  readonly unseenQuestionCount: number;
  readonly repeatedQuestionCount: number;
}

export interface CuratedSelectionResult {
  readonly set: CuratedSetDefinition;
  readonly questions: FifteenQuestionRun;
  readonly nextSeed: number;
}

export interface SurpriseSelectionOptions {
  readonly seed: RandomSeed;
  readonly isEligible?: (set: CuratedSetDefinition) => boolean;
}

export interface SurpriseSetSelectionResult {
  readonly set: CuratedSetDefinition;
  readonly nextSeed: number;
}

export interface SurpriseRunSelectionResult extends CuratedSelectionResult {
  readonly selectedBySurprise: true;
}

function assertUniqueCatalogIds(catalog: readonly QuestionDefinition[]): void {
  const ids = new Set<string>();

  for (const question of catalog) {
    if (ids.has(question.id)) {
      throw new QuestionSelectionError(
        'duplicate-question-id',
        `Question ID "${question.id}" appears more than once in the catalog.`,
      );
    }
    ids.add(question.id);
  }
}

function assertQuestionCanResolve(question: QuestionDefinition): void {
  if (question.choices.length !== 4) {
    throw new QuestionSelectionError(
      'invalid-question',
      `Question "${question.id}" must have exactly four choices.`,
    );
  }

  const choiceIds = new Set(question.choices.map((choice) => choice.id));
  if (choiceIds.size !== 4) {
    throw new QuestionSelectionError(
      'invalid-question',
      `Question "${question.id}" has duplicate choice IDs.`,
    );
  }

  if (!choiceIds.has(question.correctChoiceId)) {
    throw new QuestionSelectionError(
      'invalid-question',
      `Question "${question.id}" references a missing correct choice.`,
    );
  }
}

function toFifteenQuestionRun(
  questions: readonly ResolvedQuestionSnapshot[],
): FifteenQuestionRun {
  if (questions.length !== 15) {
    throw new QuestionSelectionError(
      'invalid-curated-set',
      `A run requires exactly 15 questions; received ${questions.length}.`,
    );
  }

  questions.forEach((question, index) => {
    const expectedLevel = LADDER_LEVELS[index];
    if (question.level !== expectedLevel) {
      throw new QuestionSelectionError(
        'invalid-curated-set',
        `Run position ${index + 1} requires Level ${expectedLevel}, but question "${question.id}" is Level ${question.level}.`,
      );
    }
  });

  return Object.freeze([...questions]) as FifteenQuestionRun;
}

export function resolveQuestionWithSeed(
  question: QuestionDefinition,
  seed: RandomSeed,
): { readonly question: ResolvedQuestionSnapshot; readonly nextSeed: number } {
  assertQuestionCanResolve(question);

  const indexedChoices = question.choices.map((choice, originalIndex) =>
    Object.freeze({
      id: choice.id,
      text: choice.text,
      originalIndex: originalIndex as 0 | 1 | 2 | 3,
    }),
  );
  const shuffled = shuffleWithSeed(indexedChoices, seed);
  const choices = Object.freeze(
    shuffled.value.map((choice, index) =>
      Object.freeze({
        ...choice,
        label: ANSWER_LETTERS[index],
      }),
    ),
  ) as FourResolvedChoices;

  const resolved = Object.freeze({
    id: question.id,
    level: question.level,
    category: question.category,
    tags: Object.freeze([...(question.tags ?? [])]),
    prompt: question.prompt,
    choices,
    correctChoiceId: question.correctChoiceId,
    hint: question.hint,
    explanation: question.explanation,
    usage: Object.freeze({
      freshMix: question.usage.freshMix,
      setIds: Object.freeze([...question.usage.setIds]),
    }),
    ...(question.source ? { source: Object.freeze({ ...question.source }) } : {}),
    ...(question.origin ? { origin: question.origin } : {}),
    ...(question.sourcePackId ? { sourcePackId: question.sourcePackId } : {}),
    ...(question.sourceVersion ? { sourceVersion: question.sourceVersion } : {}),
    ...(question.sourceFile ? { sourceFile: question.sourceFile } : {}),
  }) satisfies ResolvedQuestionSnapshot;

  return { question: resolved, nextSeed: shuffled.nextSeed };
}

function encounterFor(
  questionId: string,
  history: QuestionHistory,
): Required<QuestionEncounter> {
  const encounter = history[questionId] ?? { seenCount: 0, lastSeenAtMs: null };
  if (!Number.isInteger(encounter.seenCount) || encounter.seenCount < 0) {
    throw new QuestionSelectionError(
      'invalid-history',
      `Question history for "${questionId}" has an invalid seen count.`,
    );
  }
  if (
    encounter.lastSeenAtMs != null &&
    (!Number.isFinite(encounter.lastSeenAtMs) || encounter.lastSeenAtMs < 0)
  ) {
    throw new QuestionSelectionError(
      'invalid-history',
      `Question history for "${questionId}" has an invalid last-seen time.`,
    );
  }

  return {
    seenCount: encounter.seenCount,
    lastSeenAtMs: encounter.lastSeenAtMs ?? null,
  };
}

function narrowToBestFreshness(
  candidates: readonly QuestionDefinition[],
  history: QuestionHistory,
): readonly QuestionDefinition[] {
  const minimumSeenCount = Math.min(
    ...candidates.map((question) => encounterFor(question.id, history).seenCount),
  );
  const leastSeen = candidates.filter(
    (question) => encounterFor(question.id, history).seenCount === minimumSeenCount,
  );

  // Unseen questions are already tied. Their absent last-seen values should not
  // manufacture a distinction before the random tie-break.
  if (minimumSeenCount === 0) {
    return leastSeen;
  }

  const oldestLastSeen = Math.min(
    ...leastSeen.map(
      (question) => encounterFor(question.id, history).lastSeenAtMs ?? 0,
    ),
  );
  return leastSeen.filter(
    (question) =>
      (encounterFor(question.id, history).lastSeenAtMs ?? 0) === oldestLastSeen,
  );
}

export function selectFreshMix(
  catalog: readonly QuestionDefinition[],
  options: FreshMixSelectionOptions,
): FreshMixSelectionResult {
  assertUniqueCatalogIds(catalog);

  const history = options.history ?? {};
  const preferCategoryDiversity = options.preferCategoryDiversity ?? true;
  const usedCategories = new Set<string>();
  const selected: ResolvedQuestionSnapshot[] = [];
  let nextSeed = normalizeSeed(options.seed);
  let unseenQuestionCount = 0;

  for (const level of LADDER_LEVELS) {
    const eligible = catalog.filter(
      (question) =>
        question.level === level &&
        question.usage.freshMix &&
        question.enabled !== false &&
        (options.isEligible?.(question) ?? true),
    );

    if (eligible.length === 0) {
      throw new QuestionSelectionError(
        'missing-level',
        `Fresh Mix has no eligible question at Level ${level}.`,
        { level },
      );
    }

    let tied = narrowToBestFreshness(eligible, history);
    if (preferCategoryDiversity) {
      const newCategoryCandidates = tied.filter(
        (question) => !usedCategories.has(question.category),
      );
      if (newCategoryCandidates.length > 0) {
        tied = newCategoryCandidates;
      }
    }

    const selectedIndex = randomIndex(tied.length, nextSeed);
    nextSeed = selectedIndex.nextSeed;
    const authoredQuestion = tied[selectedIndex.value];
    if (encounterFor(authoredQuestion.id, history).seenCount === 0) {
      unseenQuestionCount += 1;
    }
    usedCategories.add(authoredQuestion.category);

    const resolved = resolveQuestionWithSeed(authoredQuestion, nextSeed);
    nextSeed = resolved.nextSeed;
    selected.push(resolved.question);
  }

  return {
    questions: toFifteenQuestionRun(selected),
    nextSeed,
    unseenQuestionCount,
    repeatedQuestionCount: 15 - unseenQuestionCount,
  };
}

export function selectCuratedSet(
  set: CuratedSetDefinition,
  catalog: readonly QuestionDefinition[],
  seed: RandomSeed,
): CuratedSelectionResult {
  assertUniqueCatalogIds(catalog);

  if (set.enabled === false || set.questionIds.length !== 15) {
    throw new QuestionSelectionError(
      'invalid-curated-set',
      `Curated set "${set.id}" must be enabled and contain exactly 15 question IDs.`,
    );
  }

  const uniqueIds = new Set(set.questionIds);
  if (uniqueIds.size !== 15) {
    throw new QuestionSelectionError(
      'invalid-curated-set',
      `Curated set "${set.id}" contains a duplicate question ID.`,
    );
  }

  const byId = new Map(catalog.map((question) => [question.id, question]));
  const selected: ResolvedQuestionSnapshot[] = [];
  let nextSeed = normalizeSeed(seed);

  set.questionIds.forEach((questionId, index) => {
    const question = byId.get(questionId);
    if (!question) {
      throw new QuestionSelectionError(
        'missing-curated-question',
        `Curated set "${set.id}" references missing question "${questionId}".`,
      );
    }

    const expectedLevel = LADDER_LEVELS[index];
    if (question.level !== expectedLevel) {
      throw new QuestionSelectionError(
        'invalid-curated-set',
        `Question "${question.id}" must be Level ${expectedLevel} at position ${index + 1}.`,
      );
    }
    if (!question.usage.setIds.includes(set.id)) {
      throw new QuestionSelectionError(
        'invalid-curated-set',
        `Question "${question.id}" does not declare membership in set "${set.id}".`,
      );
    }

    const resolved = resolveQuestionWithSeed(question, nextSeed);
    nextSeed = resolved.nextSeed;
    selected.push(resolved.question);
  });

  return {
    set,
    questions: toFifteenQuestionRun(selected),
    nextSeed,
  };
}

function progressFor(
  setId: string,
  progress: Readonly<Record<string, CuratedSetProgress>>,
): CuratedSetProgress {
  const value =
    progress[setId] ??
    ({ setId, attemptCount: 0, millionaireWon: false, lastAttemptedAtMs: null } as const);

  if (!Number.isInteger(value.attemptCount) || value.attemptCount < 0) {
    throw new QuestionSelectionError(
      'invalid-history',
      `Set progress for "${setId}" has an invalid attempt count.`,
    );
  }
  if (
    value.lastAttemptedAtMs != null &&
    (!Number.isFinite(value.lastAttemptedAtMs) || value.lastAttemptedAtMs < 0)
  ) {
    throw new QuestionSelectionError(
      'invalid-history',
      `Set progress for "${setId}" has an invalid last-attempted time.`,
    );
  }

  return value;
}

function surpriseBucket(progress: CuratedSetProgress): 0 | 1 | 2 {
  if (progress.attemptCount === 0) {
    return 0;
  }
  return progress.millionaireWon ? 2 : 1;
}

export function selectSurpriseSet(
  sets: readonly CuratedSetDefinition[],
  progress: Readonly<Record<string, CuratedSetProgress>>,
  options: SurpriseSelectionOptions,
): SurpriseSetSelectionResult {
  const eligible = sets.filter(
    (set) => set.enabled !== false && (options.isEligible?.(set) ?? true),
  );
  if (eligible.length === 0) {
    throw new QuestionSelectionError(
      'no-surprise-set',
      'Surprise Me has no eligible curated set.',
    );
  }

  const bestBucket = Math.min(
    ...eligible.map((set) => surpriseBucket(progressFor(set.id, progress))),
  );
  const inBucket = eligible.filter(
    (set) => surpriseBucket(progressFor(set.id, progress)) === bestBucket,
  );
  const oldestAttempt = Math.min(
    ...inBucket.map((set) => progressFor(set.id, progress).lastAttemptedAtMs ?? 0),
  );
  const tied = inBucket.filter(
    (set) => (progressFor(set.id, progress).lastAttemptedAtMs ?? 0) === oldestAttempt,
  );

  const selected = randomIndex(tied.length, normalizeSeed(options.seed));
  return { set: tied[selected.value], nextSeed: selected.nextSeed };
}

export function selectSurpriseRun(
  sets: readonly CuratedSetDefinition[],
  catalog: readonly QuestionDefinition[],
  progress: Readonly<Record<string, CuratedSetProgress>>,
  options: SurpriseSelectionOptions,
): SurpriseRunSelectionResult {
  const selected = selectSurpriseSet(sets, progress, options);
  const run = selectCuratedSet(selected.set, catalog, selected.nextSeed);
  return { ...run, selectedBySurprise: true };
}
