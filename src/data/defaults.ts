import type {
  GlobalSettingsRecord,
  ProfileStatistics,
  SaveOwner,
  SavedQuestionSnapshot
} from './types';

export const MAX_NAMED_PROFILES = 20;
export const MAX_PROFILE_NAME_LENGTH = 40;
export const ACTIVE_SAVE_SCHEMA_VERSION = 1;
export const RUN_HISTORY_SCHEMA_VERSION = 2;
export const DEFAULT_CONTROLLER_LEASE_MS = 15_000;

export type Clock = () => Date;
export type IdFactory = () => string;

export const systemClock: Clock = () => new Date();
export const systemIdFactory: IdFactory = () => crypto.randomUUID();

export function emptyProfileStatistics(): ProfileStatistics {
  return {
    gamesPlayed: 0,
    correctAnswers: 0,
    incorrectAnswers: 0,
    walkAways: 0,
    millionaireWins: 0,
    highestQuestion: 0,
    highestPrize: 0,
    totalVirtualWinnings: 0,
    totalDurationMs: 0,
    lifelinesUsed: {
      hint: 0,
      phone: 0
    }
  };
}

export function defaultSettings(now = new Date().toISOString()): GlobalSettingsRecord {
  return {
    id: 'global',
    masterMuted: false,
    musicEnabled: true,
    musicVolume: 0.6,
    effectsEnabled: true,
    effectsVolume: 0.75,
    narrationEnabled: false,
    narrationVolume: 1,
    voiceSelectionId: null,
    speechRate: 1,
    readAnswers: true,
    readHints: true,
    musicDucking: true,
    autoAdvance: false,
    fullscreenPreferred: false,
    reducedMotion: false,
    reducedGlow: false,
    highContrast: false,
    updatedAt: now
  };
}

export function ownerKey(owner: SaveOwner): string {
  return owner.type === 'guest' ? 'guest' : `profile:${owner.profileId}`;
}

export function sameOwner(left: SaveOwner, right: SaveOwner): boolean {
  return ownerKey(left) === ownerKey(right);
}

export function questionHistoryId(owner: SaveOwner | string, questionId: string): string {
  const key = typeof owner === 'string' ? owner : ownerKey(owner);
  return `${encodeURIComponent(key)}::${encodeURIComponent(questionId)}`;
}

export function setProgressId(owner: SaveOwner | string, setId: string): string {
  const key = typeof owner === 'string' ? owner : ownerKey(owner);
  return `${encodeURIComponent(key)}::${encodeURIComponent(setId)}`;
}

export function assertValidResolvedQuestions(
  questions: SavedQuestionSnapshot[]
): void {
  if (questions.length !== 15) {
    throw new TypeError('An active run must contain exactly 15 resolved questions.');
  }

  const ids = new Set<string>();
  const levels = new Set<number>();
  for (const question of questions) {
    if (!question || typeof question !== 'object') {
      throw new TypeError('Every resolved question must be an object.');
    }
    if (!question.id || ids.has(question.id)) {
      throw new TypeError('Resolved question IDs must be nonempty and unique.');
    }
    if (!Number.isInteger(question.level) || question.level < 1 || question.level > 15) {
      throw new TypeError('Resolved question levels must be integers from 1 through 15.');
    }
    if (levels.has(question.level)) {
      throw new TypeError('A run must contain one resolved question per ladder level.');
    }
    if (
      !Array.isArray(question.answerOrder) ||
      question.answerOrder.length !== 4 ||
      new Set(question.answerOrder).size !== 4 ||
      question.answerOrder.some((choiceId) => typeof choiceId !== 'string' || !choiceId)
    ) {
      throw new TypeError('Every resolved question must have four unique answer IDs.');
    }
    ids.add(question.id);
    levels.add(question.level);
  }

  for (let level = 1; level <= 15; level += 1) {
    if (!levels.has(level)) {
      throw new TypeError(`Resolved questions are missing ladder level ${level}.`);
    }
  }
}

export function clampVolume(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}
