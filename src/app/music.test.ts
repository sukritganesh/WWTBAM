import { describe, expect, it } from 'vitest';

import type { GameRunState, LadderLevel } from '../game';
import { musicSceneForApp } from './music';

function runAt(
  level: LadderLevel,
  overrides: Partial<GameRunState> = {},
): GameRunState {
  return {
    currentQuestionIndex: 0,
    questions: [{ id: `question-${level}`, level }],
    overlay: null,
    terminalOutcome: null,
    ...overrides,
  } as unknown as GameRunState;
}

describe('musicSceneForApp', () => {
  it.each([
    [1, 'level-1'],
    [5, 'level-1'],
    [6, 'level-2'],
    [10, 'level-2'],
    [11, 'level-3'],
    [15, 'level-3'],
  ] as const)('maps Question %i to %s', (level, scene) => {
    expect(musicSceneForApp('game', runAt(level))).toBe(scene);
  });

  it('uses pause music for Pause, Help, and pause-originated confirmations', () => {
    expect(musicSceneForApp('game', runAt(4, { overlay: { kind: 'pause' } }))).toBe('pause');
    expect(musicSceneForApp('game', runAt(4, { overlay: { kind: 'help', returnTo: 'game' } }))).toBe('pause');
    expect(
      musicSceneForApp('game', runAt(4, {
        overlay: { kind: 'walk-away-confirmation', returnTo: 'pause' },
      })),
    ).toBe('pause');
  });

  it('uses outro music through completed-run screens and intro elsewhere', () => {
    const completed = runAt(15, {
      terminalOutcome: {
        kind: 'millionaire',
        amountWon: 1_000_000,
        winningQuestionId: 'question-15',
        endedAtMs: 1,
      },
    });

    expect(musicSceneForApp('game', completed)).toBe('outro');
    expect(musicSceneForApp('results', completed)).toBe('outro');
    expect(musicSceneForApp('review', completed)).toBe('outro');
    expect(musicSceneForApp('statistics', completed)).toBe('outro');
    expect(musicSceneForApp('dashboard', completed)).toBe('intro');
    expect(musicSceneForApp('title', null)).toBe('intro');
  });
});
