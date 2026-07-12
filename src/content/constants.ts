import type { DisplayDifficulty, InternalTier, LadderLevel } from './types';

export const SUPPORTED_CONTENT_SCHEMA_VERSION = '1.0.0';

export const IMPORT_LIMITS = {
  maxBytes: 5 * 1024 * 1024,
  maxQuestions: 5_000,
  maxSets: 500,
  maxIdLength: 128,
  maxPackTitleLength: 160,
  maxDescriptionLength: 2_000,
  maxPromptLength: 500,
  maxChoiceLength: 240,
  maxHintLength: 500,
  maxExplanationLength: 1_200,
  maxTagsPerQuestion: 24,
  maxTagLength: 80
} as const;

export const BUILT_IN_HINT_REPAIRS = {
  'builtin-pool-technology-07': {
    sourceHint: "The acronym begins 'Redundant Array'.",
    normalizedHint: 'The acronym describes an array designed to tolerate drive failures.'
  },
  'builtin-pool-music-03': {
    sourceHint: 'Its sound is produced by bowed or plucked strings.',
    normalizedHint: 'This family also includes the viola, cello, and double bass.'
  },
  'builtin-pool-music-13': {
    sourceHint: 'Its name literally refers to three tones.',
    normalizedHint: 'The interval spans six semitones.'
  },
  'builtin-pool-sports-and-games-05': {
    sourceHint: 'A foul ball usually cannot become strike three unless bunted.',
    normalizedHint: 'A batter can accumulate two strikes and remain at the plate.'
  },
  'builtin-pool-mythology-and-religion-12': {
    sourceHint: 'It includes texts in the Avestan language.',
    normalizedHint: 'Its language gives this collection its conventional name.'
  }
} as const;

export type BuiltInRepairQuestionId = keyof typeof BUILT_IN_HINT_REPAIRS;

export const LOCAL_ID_PATTERN = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;
export const PACK_ID_PATTERN = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
export const BUILT_IN_ID_PATTERN = /^builtin-[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function displayDifficultyForLevel(level: LadderLevel): DisplayDifficulty {
  if (level <= 5) return 'Easy';
  if (level <= 10) return 'Moderate';
  if (level <= 14) return 'Difficult';
  return 'Millionaire';
}

export function internalTierForLevel(level: LadderLevel): InternalTier {
  if (level <= 3) return 'Foundation';
  if (level <= 5) return 'Accessible';
  if (level <= 8) return 'Intermediate';
  if (level <= 10) return 'Advanced';
  if (level <= 12) return 'Expert';
  if (level <= 14) return 'Elite';
  return 'Millionaire';
}

export function globallyNamespacedId(packId: string, localOrGlobalId: string): string {
  return localOrGlobalId.startsWith(`${packId}:`) ? localOrGlobalId : `${packId}:${localOrGlobalId}`;
}
