import type { LadderLevel } from './types';

export const PRIZE_LADDER = [
  100,
  200,
  300,
  500,
  1_000,
  2_000,
  4_000,
  8_000,
  16_000,
  32_000,
  64_000,
  125_000,
  250_000,
  500_000,
  1_000_000,
] as const;

export const CHECKPOINT_LEVELS = [5, 10] as const;

function assertLevel(level: number): asserts level is LadderLevel {
  if (!Number.isInteger(level) || level < 1 || level > 15) {
    throw new RangeError(`Ladder level must be an integer from 1 to 15; received ${level}.`);
  }
}

function assertCompletedLevel(level: number): void {
  if (!Number.isInteger(level) || level < 0 || level > 15) {
    throw new RangeError(
      `Completed level must be an integer from 0 to 15; received ${level}.`,
    );
  }
}

export function prizeForLevel(level: LadderLevel): number {
  assertLevel(level);
  return PRIZE_LADDER[level - 1];
}

export function winningsForCompletedLevel(completedLevel: number): number {
  assertCompletedLevel(completedLevel);
  return completedLevel === 0 ? 0 : PRIZE_LADDER[completedLevel - 1];
}

export function guaranteedWinningsForCompletedLevel(completedLevel: number): number {
  assertCompletedLevel(completedLevel);

  if (completedLevel >= 10) {
    return 32_000;
  }

  if (completedLevel >= 5) {
    return 1_000;
  }

  return 0;
}

export function wrongAnswerPayout(questionLevel: LadderLevel): number {
  assertLevel(questionLevel);
  return guaranteedWinningsForCompletedLevel(questionLevel - 1);
}

export function walkAwayPayout(completedLevel: number): number {
  return winningsForCompletedLevel(completedLevel);
}

export function isCheckpointLevel(level: LadderLevel): boolean {
  return level === 5 || level === 10;
}
