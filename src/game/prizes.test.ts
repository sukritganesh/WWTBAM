import { describe, expect, it } from 'vitest';

import {
  guaranteedWinningsForCompletedLevel,
  isCheckpointLevel,
  PRIZE_LADDER,
  prizeForLevel,
  walkAwayPayout,
  wrongAnswerPayout,
} from './prizes';
import { LADDER_LEVELS } from './types';

describe('prize and checkpoint rules', () => {
  it('maps every ladder level to its settled prize', () => {
    LADDER_LEVELS.forEach((level, index) => {
      expect(prizeForLevel(level)).toBe(PRIZE_LADDER[index]);
      expect(walkAwayPayout(level)).toBe(PRIZE_LADDER[index]);
    });
  });

  it.each([
    [0, 0],
    [4, 0],
    [5, 1_000],
    [9, 1_000],
    [10, 32_000],
    [15, 32_000],
  ])('guarantees %i completed levels at $%i', (completedLevel, amount) => {
    expect(guaranteedWinningsForCompletedLevel(completedLevel)).toBe(amount);
  });

  it.each([
    [1, 0],
    [5, 0],
    [6, 1_000],
    [10, 1_000],
    [11, 32_000],
    [15, 32_000],
  ] as const)('a wrong answer on Question %i pays $%i', (level, payout) => {
    expect(wrongAnswerPayout(level)).toBe(payout);
  });

  it('identifies only the two guaranteed checkpoint levels', () => {
    expect(LADDER_LEVELS.filter(isCheckpointLevel)).toEqual([5, 10]);
  });

  it('rejects impossible completed levels', () => {
    expect(() => guaranteedWinningsForCompletedLevel(-1)).toThrow(RangeError);
    expect(() => walkAwayPayout(16)).toThrow(RangeError);
  });
});
