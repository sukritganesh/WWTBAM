import { PRIMARY_CATEGORIES, type InternalTier, type NormalizedPack, type RuntimeContentCatalog, type SerializedContentCatalog } from '../types';

const DISPLAY_DIFFICULTIES = ['Easy', 'Moderate', 'Difficult', 'Millionaire'] as const;
const INTERNAL_TIERS: InternalTier[] = [
  'Foundation',
  'Accessible',
  'Intermediate',
  'Advanced',
  'Expert',
  'Elite',
  'Millionaire'
];

export interface CatalogBuildOptions {
  releaseId: string;
  releaseVersion: string;
  eligibilityDate?: string;
}

function increment(record: Record<string, number>, key: string): void {
  record[key] = (record[key] ?? 0) + 1;
}

function append(record: Record<string, string[]>, key: string, value: string): void {
  (record[key] ??= []).push(value);
}

function sortedRecord<T>(record: Record<string, T>): Record<string, T> {
  return Object.fromEntries(Object.entries(record).sort(([left], [right]) => left.localeCompare(right)));
}

function eligibleForSelection(
  question: NormalizedPack['questions'][number],
  eligibilityDate: string | undefined
): boolean {
  if (!question.enabled) return false;
  const blockedReviewStatuses = new Set(['invalid', 'rejected', 'expired', 'unverified']);
  if (blockedReviewStatuses.has(question.metadata.reviewStatus.toLocaleLowerCase('en-US'))) return false;
  if (
    question.metadata.timeSensitive &&
    question.metadata.validThrough !== null &&
    eligibilityDate !== undefined &&
    question.metadata.validThrough < eligibilityDate
  ) {
    return false;
  }
  return true;
}

export function createSerializedCatalog(
  packs: readonly NormalizedPack[],
  options: CatalogBuildOptions
): SerializedContentCatalog {
  const questions = packs.flatMap((pack) => pack.questions);
  const sets = packs.flatMap((pack) => pack.sets);
  const sources = packs.map((pack) => pack.source);

  if (new Set(questions.map((question) => question.id)).size !== questions.length) {
    throw new Error('Cannot create content catalog: duplicate normalized question IDs.');
  }
  if (new Set(sets.map((set) => set.id)).size !== sets.length) {
    throw new Error('Cannot create content catalog: duplicate normalized curated-set IDs.');
  }
  if (new Set(sources.map((source) => source.id)).size !== sources.length) {
    throw new Error('Cannot create content catalog: duplicate content source IDs.');
  }

  const questionIds = new Set(questions.map((question) => question.id));
  for (const set of sets) {
    for (const questionId of set.questionIds) {
      if (!questionIds.has(questionId)) {
        throw new Error(`Cannot create content catalog: set ${set.id} references missing question ${questionId}.`);
      }
    }
  }

  const byLevel: Record<string, string[]> = Object.fromEntries(
    Array.from({ length: 15 }, (_, index) => [String(index + 1), []])
  );
  const byCategory: Record<string, string[]> = Object.fromEntries(PRIMARY_CATEGORIES.map((category) => [category, []]));
  const byTag: Record<string, string[]> = {};
  const bySourcePack: Record<string, string[]> = {};
  const bySet: Record<string, string[]> = Object.fromEntries(sets.map((set) => [set.id, [...set.questionIds]]));
  const freshMixQuestionIds: string[] = [];
  const eligibleFreshMixQuestionIds: string[] = [];

  const summaryByLevel: Record<string, number> = Object.fromEntries(
    Array.from({ length: 15 }, (_, index) => [String(index + 1), 0])
  );
  const byDisplayDifficulty = Object.fromEntries(DISPLAY_DIFFICULTIES.map((band) => [band, 0])) as Record<
    (typeof DISPLAY_DIFFICULTIES)[number],
    number
  >;
  const byInternalTier = Object.fromEntries(INTERNAL_TIERS.map((tier) => [tier, 0])) as Record<InternalTier, number>;
  const summaryByCategory: Record<string, number> = Object.fromEntries(
    PRIMARY_CATEGORIES.map((category) => [category, 0])
  );
  const summaryBySourcePack: Record<string, number> = {};
  const byReviewStatus: Record<string, number> = {};

  for (const question of questions) {
    append(byLevel, String(question.level), question.id);
    append(byCategory, question.category, question.id);
    question.tags.forEach((tag) => append(byTag, tag, question.id));
    append(bySourcePack, question.sourcePackId, question.id);
    increment(summaryByLevel, String(question.level));
    byDisplayDifficulty[question.displayDifficulty] += 1;
    byInternalTier[question.internalTier] += 1;
    increment(summaryByCategory, question.category);
    increment(summaryBySourcePack, question.sourcePackId);
    increment(byReviewStatus, question.metadata.reviewStatus);
    if (question.usage.freshMix) {
      freshMixQuestionIds.push(question.id);
      if (eligibleForSelection(question, options.eligibilityDate)) eligibleFreshMixQuestionIds.push(question.id);
    }
  }

  const freshMixQuestions = questions.filter((question) => question.usage.freshMix);
  const missingFreshMixLevels = Array.from({ length: 15 }, (_, index) => index + 1).filter(
    (level) => !freshMixQuestions.some((question) => question.level === level && eligibleForSelection(question, options.eligibilityDate))
  );
  const missingCategoryLevelCells = PRIMARY_CATEGORIES.flatMap((category) =>
    Array.from({ length: 15 }, (_, index) => index + 1)
      .filter(
        (level) =>
          !freshMixQuestions.some(
            (question) =>
              question.category === category &&
              question.level === level &&
              eligibleForSelection(question, options.eligibilityDate)
          )
      )
      .map((level) => `${category}|${level}`)
  );

  return {
    schemaVersion: '1.0.0',
    releaseId: options.releaseId,
    releaseVersion: options.releaseVersion,
    questions,
    sets,
    sources,
    indexes: {
      byLevel,
      byCategory,
      byTag: sortedRecord(byTag),
      bySourcePack: sortedRecord(bySourcePack),
      bySet: sortedRecord(bySet),
      freshMixQuestionIds,
      eligibleFreshMixQuestionIds
    },
    summary: {
      questionCount: questions.length,
      freshMixQuestionCount: freshMixQuestions.length,
      curatedQuestionCount: questions.filter((question) => question.usage.setIds.length > 0).length,
      curatedSetCount: sets.length,
      sourceCount: sources.length,
      categoryCount: new Set(questions.map((question) => question.category)).size,
      byLevel: summaryByLevel,
      byDisplayDifficulty,
      byInternalTier,
      byCategory: summaryByCategory,
      bySourcePack: sortedRecord(summaryBySourcePack),
      byReviewStatus: sortedRecord(byReviewStatus),
      missingFreshMixLevels,
      missingCategoryLevelCells
    }
  };
}

export function createRuntimeCatalog(serialized: SerializedContentCatalog): RuntimeContentCatalog {
  const questionById = new Map(serialized.questions.map((question) => [question.id, question]));
  const setById = new Map(serialized.sets.map((set) => [set.id, set]));
  const sourceById = new Map(serialized.sources.map((source) => [source.id, source]));
  if (questionById.size !== serialized.questions.length) throw new Error('Catalog has duplicate question IDs.');
  if (setById.size !== serialized.sets.length) throw new Error('Catalog has duplicate set IDs.');
  if (sourceById.size !== serialized.sources.length) throw new Error('Catalog has duplicate source IDs.');
  return Object.assign({}, serialized, { questionById, setById, sourceById });
}
