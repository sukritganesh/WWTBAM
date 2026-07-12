import { describe, expect, it } from 'vitest';

import type { GameRunState } from '../game';
import { narratedQuestionIdForResume } from './adapters';

function savedRun(currentQuestionIndex: number, displayedQuestionIds: readonly string[]): GameRunState {
  return {
    currentQuestionIndex,
    displayedQuestionIds,
    questions: [{ id: 'question-1' }, { id: 'question-2' }],
  } as unknown as GameRunState;
}

describe('narratedQuestionIdForResume', () => {
  it('marks a previously displayed current question as already narrated', () => {
    const run = savedRun(0, ['question-1']);

    expect(narratedQuestionIdForResume(run)).toBe('question-1');
  });

  it('allows narration when the current question has not been displayed', () => {
    const run = savedRun(1, ['question-1']);

    expect(narratedQuestionIdForResume(run)).toBeNull();
  });
});
