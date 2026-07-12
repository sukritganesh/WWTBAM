import {
  BUILT_IN_HINT_REPAIRS,
  displayDifficultyForLevel,
  globallyNamespacedId,
  internalTierForLevel
} from './constants';
import type {
  ContentOrigin,
  NormalizationRepair,
  NormalizedContentSource,
  NormalizedPack,
  NormalizedQuestionMetadata,
  RawContentPack,
  RawPackMetadata,
  RawQuestionMetadata
} from './types';

export interface NormalizePackOptions {
  origin: ContentOrigin;
  sourceFile: string;
  enabled: boolean;
  sourceSha256?: string | null;
  applyBuiltInRepairs?: boolean;
}

function metadataString(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim().length > 0 ? value : fallback;
}

function nullableMetadataString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function normalizedPackMetadata(metadata: RawPackMetadata): RawPackMetadata {
  const allowedKeys = [
    'author',
    'creator',
    'questionCount',
    'questionsPerCategory',
    'setCount',
    'reviewStatus',
    'humanReviewRecommended',
    'timeSensitiveQuestionCount',
    'sourceNotes',
    'verificationNotes',
    'generatedBy',
    'createdAt',
    'modifiedAt'
  ] as const;
  return Object.fromEntries(
    allowedKeys
      .filter((key) => metadata[key] !== undefined)
      .map((key) => [key, metadata[key]])
  );
}

function inheritedQuestionMetadata(pack: RawContentPack, questionMetadata?: RawQuestionMetadata): NormalizedQuestionMetadata {
  const packAuthor = metadataString(pack.metadata.author ?? pack.metadata.creator, 'Unknown');
  const packReviewStatus = metadataString(pack.metadata.reviewStatus, 'unreviewed');
  const timeSensitive = questionMetadata?.timeSensitive ?? false;
  return {
    language: metadataString(questionMetadata?.language, pack.language),
    author: metadataString(questionMetadata?.author, packAuthor),
    reviewStatus: metadataString(questionMetadata?.reviewStatus, packReviewStatus),
    humanReviewRecommended:
      typeof pack.metadata.humanReviewRecommended === 'boolean' ? pack.metadata.humanReviewRecommended : true,
    verificationNotes: nullableMetadataString(
      questionMetadata?.verificationNotes ?? pack.metadata.verificationNotes
    ),
    sourceNotes: nullableMetadataString(questionMetadata?.sourceNotes ?? pack.metadata.sourceNotes),
    generatedBy: nullableMetadataString(questionMetadata?.generatedBy ?? pack.metadata.generatedBy),
    timeSensitive,
    validThrough: timeSensitive ? questionMetadata?.validThrough ?? null : null
  };
}

function normalizedIdentity(pack: RawContentPack, origin: ContentOrigin, id: string): string {
  return origin === 'built-in' ? id : globallyNamespacedId(pack.id, id);
}

export function normalizePack(pack: RawContentPack, options: NormalizePackOptions): NormalizedPack {
  const source: NormalizedContentSource = {
    id: pack.id,
    title: pack.title,
    description: pack.description,
    version: pack.version,
    schemaVersion: pack.schemaVersion,
    language: pack.language,
    contentType: pack.contentType,
    categories: [...pack.categories],
    origin: options.origin,
    sourceFile: options.sourceFile,
    enabled: options.enabled,
    // Only supported inert metadata is retained. Unknown import fields never enter
    // the runtime catalog even when a future authoring tool adds extra JSON keys.
    metadata: normalizedPackMetadata(pack.metadata),
    sourceSha256: options.sourceSha256 ?? null
  };

  const questions = pack.questions.map((question) => {
    let hint = question.hint;
    const normalizationRepairs: NormalizationRepair[] = [];
    if (options.origin === 'built-in' && options.applyBuiltInRepairs !== false) {
      const repair = BUILT_IN_HINT_REPAIRS[question.id as keyof typeof BUILT_IN_HINT_REPAIRS];
      if (repair !== undefined) {
        hint = repair.normalizedHint;
        normalizationRepairs.push({
          code: 'hint-answer-leakage',
          field: 'hint',
          sourceValue: question.hint,
          normalizedValue: hint
        });
      }
    }
    return {
      id: normalizedIdentity(pack, options.origin, question.id),
      localId: question.id.startsWith(`${pack.id}:`) ? question.id.slice(pack.id.length + 1) : question.id,
      level: question.level,
      displayDifficulty: displayDifficultyForLevel(question.level),
      internalTier: internalTierForLevel(question.level),
      category: question.category,
      tags: [...question.tags],
      prompt: question.prompt,
      choices: question.choices.map((choice) => ({ ...choice })),
      correctChoiceId: question.correctChoiceId,
      hint,
      explanation: question.explanation,
      usage: {
        freshMix: question.usage.freshMix,
        setIds: question.usage.setIds.map((setId) => normalizedIdentity(pack, options.origin, setId))
      },
      metadata: inheritedQuestionMetadata(pack, question.metadata),
      origin: options.origin,
      sourcePackId: pack.id,
      sourceFile: options.sourceFile,
      sourceVersion: pack.version,
      enabled: options.enabled,
      normalizationRepairs
    };
  });

  const sets = pack.sets.map((set) => ({
    id: normalizedIdentity(pack, options.origin, set.id),
    localId: set.id.startsWith(`${pack.id}:`) ? set.id.slice(pack.id.length + 1) : set.id,
    title: set.title,
    description: set.description,
    theme: set.theme,
    tags: [...set.tags],
    questionIds: set.questionIds.map((questionId) => normalizedIdentity(pack, options.origin, questionId)),
    audience: set.audience ?? null,
    difficultyNote: set.difficultyNote ?? null,
    origin: options.origin,
    sourcePackId: pack.id,
    sourceFile: options.sourceFile,
    sourceVersion: pack.version,
    enabled: options.enabled
  }));

  return { source, questions, sets };
}
