import { describe, expect, it } from 'vitest';

import { gameReducer } from './gameReducer';
import {
  createGameRun,
  currentQuestion,
  isRunComplete,
  phoneRemainingMs,
} from './gameState';
import { resolveQuestionWithSeed } from './questionSelection';
import type {
  FourChoices,
  GameAction,
  GameRunState,
  LadderLevel,
  QuestionDefinition,
} from './types';
import { LADDER_LEVELS } from './types';

const authoredChoices: FourChoices = [
  { id: 'a', text: 'Answer A' },
  { id: 'b', text: 'Answer B' },
  { id: 'c', text: 'Answer C' },
  { id: 'd', text: 'Answer D' },
];

function authoredQuestion(level: LadderLevel): QuestionDefinition {
  return {
    id: `question-${level}`,
    level,
    category: 'Test',
    prompt: `Question ${level}?`,
    choices: authoredChoices,
    correctChoiceId: 'b',
    hint: `Hint ${level}`,
    explanation: `Explanation ${level}`,
    usage: { freshMix: true, setIds: [] },
  };
}

function newRun(): GameRunState {
  let seed = 100;
  const questions = LADDER_LEVELS.map((level) => {
    const resolved = resolveQuestionWithSeed(authoredQuestion(level), seed);
    seed = resolved.nextSeed;
    return resolved.question;
  });

  return createGameRun({
    runId: 'run-one',
    owner: { kind: 'profile', profileId: 'profile-one', displayName: 'Player' },
    mode: { kind: 'fresh-mix' },
    questions,
    createdAtMs: 0,
  });
}

function dispatch(state: GameRunState, ...actions: readonly GameAction[]): GameRunState {
  return actions.reduce(gameReducer, state);
}

function showQuestion(state: GameRunState): GameRunState {
  return gameReducer(state, { type: 'SHOW_CURRENT_QUESTION' });
}

function lockAndReveal(
  state: GameRunState,
  choiceId: string,
  nowMs: number,
): GameRunState {
  return dispatch(
    state,
    { type: 'SELECT_ANSWER', choiceId },
    { type: 'REQUEST_LOCK' },
    { type: 'CONFIRM_LOCK', nowMs },
    { type: 'REVEAL_ANSWER', nowMs: nowMs + 1 },
  );
}

function answerCorrectAndAdvance(state: GameRunState, nowMs: number): GameRunState {
  const revealed = lockAndReveal(state, currentQuestion(state).correctChoiceId, nowMs);
  if (revealed.phase === 'millionaire-reveal') {
    return revealed;
  }
  return dispatch(
    revealed,
    { type: 'ADVANCE_QUESTION' },
    { type: 'SHOW_CURRENT_QUESTION' },
  );
}

describe('run creation and answer commitment', () => {
  it('creates an immutable 15-question run and marks questions seen only on display', () => {
    const initial = newRun();
    expect(initial.phase).toBe('game-intro');
    expect(initial.displayedQuestionIds).toEqual([]);
    expect(initial.saveRevision).toBe(1);
    expect(Object.isFrozen(initial.questions)).toBe(true);
    expect(Object.isFrozen(initial.questions[0].choices)).toBe(true);

    const ready = showQuestion(initial);
    expect(ready.phase).toBe('question-ready');
    expect(ready.displayedQuestionIds).toEqual(['question-1']);
    expect(ready.saveRevision).toBe(2);
  });

  it('supports selection, deselection, confirmation cancellation, and monotonic revisions', () => {
    let state = showQuestion(newRun());
    const noSelectionRevision = state.saveRevision;
    expect(gameReducer(state, { type: 'REQUEST_LOCK' })).toBe(state);
    expect(state.saveRevision).toBe(noSelectionRevision);

    state = gameReducer(state, { type: 'SELECT_ANSWER', choiceId: 'a' });
    expect(state.phase).toBe('answer-selected');
    expect(state.selectedChoiceId).toBe('a');

    state = gameReducer(state, { type: 'REQUEST_LOCK' });
    expect(state.phase).toBe('final-confirmation');
    state = gameReducer(state, { type: 'CANCEL_LOCK' });
    expect(state.phase).toBe('answer-selected');
    expect(state.selectedChoiceId).toBe('a');

    state = gameReducer(state, { type: 'SELECT_ANSWER', choiceId: 'a' });
    expect(state.phase).toBe('question-ready');
    expect(state.selectedChoiceId).toBeNull();
    expect(state.saveRevision).toBe(noSelectionRevision + 4);
  });

  it('persists the lock before reveal and rejects every stale answer mutation', () => {
    let state = showQuestion(newRun());
    state = dispatch(
      state,
      { type: 'SELECT_ANSWER', choiceId: 'a' },
      { type: 'REQUEST_LOCK' },
      { type: 'CONFIRM_LOCK', nowMs: 100 },
    );

    expect(state.phase).toBe('answer-locked');
    expect(state.lockedChoiceId).toBe('a');
    expect(state.lockedAtMs).toBe(100);
    const committed = state;

    expect(gameReducer(state, { type: 'SELECT_ANSWER', choiceId: 'b' })).toBe(
      committed,
    );
    expect(gameReducer(state, { type: 'CLEAR_SELECTION' })).toBe(committed);
    expect(gameReducer(state, { type: 'USE_HINT' })).toBe(committed);
    expect(gameReducer(state, { type: 'OPEN_PAUSE' })).toBe(committed);
    expect(gameReducer(state, { type: 'CONFIRM_LOCK', nowMs: 200 })).toBe(
      committed,
    );
    expect(state.lockedChoiceId).toBe('a');
  });
});

describe('answer reveals, payouts, and terminal outcomes', () => {
  it('updates winnings once and advances only after a correct reveal', () => {
    let state = showQuestion(newRun());
    state = lockAndReveal(state, currentQuestion(state).correctChoiceId, 10);

    expect(state.phase).toBe('correct-reveal');
    expect(state.currentWinnings).toBe(100);
    expect(state.guaranteedWinnings).toBe(0);
    expect(state.results).toHaveLength(1);
    expect(gameReducer(state, { type: 'REVEAL_ANSWER', nowMs: 20 })).toBe(state);

    state = gameReducer(state, { type: 'ADVANCE_QUESTION' });
    expect(state.phase).toBe('between-questions');
    expect(state.currentQuestionIndex).toBe(1);
    expect(state.selectedChoiceId).toBeNull();
    expect(state.lockedChoiceId).toBeNull();
  });

  it('awards the latest checkpoint after a wrong answer', () => {
    let state = showQuestion(newRun());
    for (let level = 1; level <= 5; level += 1) {
      state = answerCorrectAndAdvance(state, level * 100);
    }
    expect(currentQuestion(state).level).toBe(6);
    expect(state.currentWinnings).toBe(1_000);
    expect(state.guaranteedWinnings).toBe(1_000);

    const wrongChoice = currentQuestion(state).choices.find(
      (choice) => choice.id !== currentQuestion(state).correctChoiceId,
    )?.id;
    expect(wrongChoice).toBeDefined();
    state = lockAndReveal(state, wrongChoice ?? 'a', 1_000);

    expect(state.phase).toBe('incorrect-reveal');
    expect(state.terminalOutcome).toMatchObject({
      kind: 'incorrect',
      amountWon: 1_000,
      failedLevel: 6,
    });
    expect(state.results.at(-1)).toMatchObject({
      isCorrect: false,
      selectedChoiceId: wrongChoice,
      correctChoiceId: currentQuestion(state).correctChoiceId,
    });

    state = gameReducer(state, { type: 'ACKNOWLEDGE_TERMINAL' });
    expect(isRunComplete(state)).toBe(true);
    expect(gameReducer(state, { type: 'ACKNOWLEDGE_TERMINAL' })).toBe(state);
  });

  it('reaches a dedicated millionaire terminal reveal after 15 correct answers', () => {
    let state = showQuestion(newRun());
    for (let level = 1; level <= 14; level += 1) {
      state = answerCorrectAndAdvance(state, level * 100);
    }
    state = lockAndReveal(
      state,
      currentQuestion(state).correctChoiceId,
      2_000,
    );

    expect(state.phase).toBe('millionaire-reveal');
    expect(state.currentWinnings).toBe(1_000_000);
    expect(state.results).toHaveLength(15);
    expect(state.terminalOutcome).toEqual({
      kind: 'millionaire',
      amountWon: 1_000_000,
      winningQuestionId: 'question-15',
      endedAtMs: 2_001,
    });
    expect(gameReducer(state, { type: 'ADVANCE_QUESTION' })).toBe(state);
  });
});

describe('lifelines, pause, and help', () => {
  it('consumes Hint once without changing the selected answer', () => {
    let state = showQuestion(newRun());
    state = gameReducer(state, { type: 'SELECT_ANSWER', choiceId: 'd' });
    state = gameReducer(state, { type: 'USE_HINT' });

    expect(state.selectedChoiceId).toBe('d');
    expect(state.hintRevealedForQuestionId).toBe('question-1');
    expect(state.lifelines.hint).toEqual({
      status: 'used',
      questionId: 'question-1',
    });
    expect(gameReducer(state, { type: 'USE_HINT' })).toBe(state);
  });

  it('uses an absolute Phone deadline and blocks answer actions until it ends', () => {
    let state = showQuestion(newRun());
    state = dispatch(
      state,
      { type: 'SELECT_ANSWER', choiceId: 'd' },
      { type: 'REQUEST_PHONE' },
      { type: 'CONFIRM_PHONE', nowMs: 1_000 },
    );

    expect(state.phase).toBe('phone-active');
    expect(state.lifelines.phone).toEqual({
      status: 'active',
      questionId: 'question-1',
      deadlineMs: 61_000,
    });
    expect(phoneRemainingMs(state, 11_000)).toBe(50_000);
    expect(gameReducer(state, { type: 'SELECT_ANSWER', choiceId: 'b' })).toBe(state);
    expect(gameReducer(state, { type: 'USE_HINT' })).toBe(state);
    expect(gameReducer(state, { type: 'REQUEST_LOCK' })).toBe(state);
    expect(
      gameReducer(state, { type: 'SYNC_PHONE_DEADLINE', nowMs: 60_999 }),
    ).toBe(state);

    state = gameReducer(state, { type: 'SYNC_PHONE_DEADLINE', nowMs: 61_000 });
    expect(state.phase).toBe('answer-selected');
    expect(state.selectedChoiceId).toBe('d');
    expect(state.lifelines.phone).toEqual({
      status: 'used',
      questionId: 'question-1',
    });
    expect(phoneRemainingMs(state, 61_000)).toBe(0);
  });

  it.each(['OPEN_PAUSE', 'OPEN_HELP'] as const)(
    '%s immediately ends and consumes an active Phone call',
    (type) => {
      let state = showQuestion(newRun());
      state = dispatch(
        state,
        { type: 'REQUEST_PHONE' },
        { type: 'CONFIRM_PHONE', nowMs: 10 },
        { type },
      );

      expect(state.phase).toBe('question-ready');
      expect(state.lifelines.phone).toEqual({
        status: 'used',
        questionId: 'question-1',
      });
      expect(state.overlay?.kind).toBe(type === 'OPEN_PAUSE' ? 'pause' : 'help');
    },
  );

  it('returns Help to Pause and then resumes the exact gameplay phase', () => {
    let state = showQuestion(newRun());
    state = gameReducer(state, { type: 'SELECT_ANSWER', choiceId: 'a' });
    state = gameReducer(state, { type: 'OPEN_PAUSE' });
    expect(state.phase).toBe('answer-selected');
    expect(state.overlay).toEqual({ kind: 'pause' });

    state = gameReducer(state, { type: 'OPEN_HELP' });
    expect(state.overlay).toEqual({ kind: 'help', returnTo: 'pause' });
    state = gameReducer(state, { type: 'CLOSE_HELP' });
    expect(state.overlay).toEqual({ kind: 'pause' });
    state = gameReducer(state, { type: 'RESUME' });
    expect(state.overlay).toBeNull();
    expect(state.phase).toBe('answer-selected');
    expect(state.selectedChoiceId).toBe('a');
  });
});

describe('walk-away behavior', () => {
  it('allows walking away before Question 1 for $0', () => {
    let state = showQuestion(newRun());
    state = dispatch(
      state,
      { type: 'REQUEST_WALK_AWAY' },
      { type: 'CONFIRM_WALK_AWAY', nowMs: 50 },
    );

    expect(isRunComplete(state)).toBe(true);
    expect(state.terminalOutcome).toEqual({
      kind: 'walk-away',
      amountWon: 0,
      atQuestionId: 'question-1',
      nextPrizeLevel: 1,
      completedLevel: 0,
      endedAtMs: 50,
    });
  });

  it('allows walking away from a correct reveal with the newly earned amount', () => {
    let state = showQuestion(newRun());
    state = lockAndReveal(state, currentQuestion(state).correctChoiceId, 10);
    state = dispatch(
      state,
      { type: 'REQUEST_WALK_AWAY' },
      { type: 'CONFIRM_WALK_AWAY', nowMs: 20 },
    );

    expect(state.terminalOutcome).toMatchObject({
      kind: 'walk-away',
      amountWon: 100,
      nextPrizeLevel: 2,
      completedLevel: 1,
    });
  });

  it('cancels back to Pause without altering the run', () => {
    let state = showQuestion(newRun());
    state = dispatch(
      state,
      { type: 'OPEN_PAUSE' },
      { type: 'REQUEST_WALK_AWAY' },
      { type: 'CANCEL_WALK_AWAY' },
    );
    expect(state.overlay).toEqual({ kind: 'pause' });
    expect(state.terminalOutcome).toBeNull();
  });
});
