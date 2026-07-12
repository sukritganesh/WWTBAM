import {
  guaranteedWinningsForCompletedLevel,
  prizeForLevel,
} from './prizes';
import {
  canLockAnswer,
  canSelectAnswer,
  canUseHint,
  canUsePhone,
  canWalkAway,
  completedLevel,
  currentQuestion,
  isWalkablePhase,
  PHONE_A_FRIEND_DURATION_MS,
} from './gameState';
import { LADDER_LEVELS } from './types';
import type {
  GameAction,
  GamePhase,
  GameRunState,
  LifelineState,
  QuestionResult,
  TerminalOutcome,
} from './types';

type StateChanges = Partial<Omit<GameRunState, 'saveRevision'>>;

function accepted(state: GameRunState, changes: StateChanges): GameRunState {
  return Object.freeze({
    ...state,
    ...changes,
    saveRevision: state.saveRevision + 1,
  });
}

function validNow(nowMs: number): boolean {
  return Number.isFinite(nowMs) && nowMs >= 0;
}

function answerablePhase(state: GameRunState): 'question-ready' | 'answer-selected' {
  return state.selectedChoiceId === null ? 'question-ready' : 'answer-selected';
}

function canOpenOverlay(phase: GamePhase): boolean {
  return (
    phase !== 'answer-locked' &&
    phase !== 'incorrect-reveal' &&
    phase !== 'millionaire-reveal' &&
    phase !== 'completed'
  );
}

function endActivePhone(state: GameRunState): {
  readonly phase: GamePhase;
  readonly lifelines: LifelineState;
} {
  if (state.lifelines.phone.status !== 'active') {
    return { phase: state.phase, lifelines: state.lifelines };
  }

  return {
    phase: answerablePhase(state),
    lifelines: Object.freeze({
      ...state.lifelines,
      phone: Object.freeze({
        status: 'used',
        questionId: state.lifelines.phone.questionId,
      }),
    }),
  };
}

function answerBelongsToCurrentQuestion(state: GameRunState, choiceId: string): boolean {
  return currentQuestion(state).choices.some((choice) => choice.id === choiceId);
}

function useHint(state: GameRunState): GameRunState {
  if (!canUseHint(state)) {
    return state;
  }

  const questionId = currentQuestion(state).id;
  return accepted(state, {
    lifelines: Object.freeze({
      ...state.lifelines,
      hint: Object.freeze({ status: 'used', questionId }),
    }),
    hintRevealedForQuestionId: questionId,
  });
}

function revealAnswer(state: GameRunState, nowMs: number): GameRunState {
  if (
    state.overlay !== null ||
    state.phase !== 'answer-locked' ||
    state.lockedChoiceId === null ||
    state.terminalOutcome !== null ||
    !validNow(nowMs)
  ) {
    return state;
  }

  const question = currentQuestion(state);
  const isCorrect = state.lockedChoiceId === question.correctChoiceId;
  const winningsAfter = isCorrect
    ? prizeForLevel(question.level)
    : state.currentWinnings;
  const guaranteedAfter = isCorrect
    ? guaranteedWinningsForCompletedLevel(question.level)
    : state.guaranteedWinnings;
  const result: QuestionResult = Object.freeze({
    questionId: question.id,
    level: question.level,
    selectedChoiceId: state.lockedChoiceId,
    correctChoiceId: question.correctChoiceId,
    isCorrect,
    hintUsed:
      state.lifelines.hint.status === 'used' &&
      state.lifelines.hint.questionId === question.id,
    phoneUsed:
      state.lifelines.phone.status !== 'available' &&
      state.lifelines.phone.questionId === question.id,
    winningsAfter,
    guaranteedWinningsAfter: guaranteedAfter,
    answeredAtMs: nowMs,
  });

  let phase: GamePhase;
  let terminalOutcome: TerminalOutcome | null = null;

  if (!isCorrect) {
    phase = 'incorrect-reveal';
    terminalOutcome = Object.freeze({
      kind: 'incorrect',
      amountWon: state.guaranteedWinnings,
      failedQuestionId: question.id,
      failedLevel: question.level,
      selectedChoiceId: state.lockedChoiceId,
      correctChoiceId: question.correctChoiceId,
      endedAtMs: nowMs,
    });
  } else if (question.level === 15) {
    phase = 'millionaire-reveal';
    terminalOutcome = Object.freeze({
      kind: 'millionaire',
      amountWon: 1_000_000,
      winningQuestionId: question.id,
      endedAtMs: nowMs,
    });
  } else {
    phase = 'correct-reveal';
  }

  return accepted(state, {
    phase,
    results: Object.freeze([...state.results, result]),
    currentWinnings: winningsAfter,
    guaranteedWinnings: guaranteedAfter,
    revealedAtMs: nowMs,
    terminalOutcome,
  });
}

function requestWalkAway(state: GameRunState): GameRunState {
  if (!canWalkAway(state)) {
    return state;
  }

  const returnTo = state.overlay?.kind === 'pause' ? 'pause' : 'game';
  return accepted(state, {
    overlay: Object.freeze({ kind: 'walk-away-confirmation', returnTo }),
  });
}

function confirmWalkAway(state: GameRunState, nowMs: number): GameRunState {
  if (
    state.overlay?.kind !== 'walk-away-confirmation' ||
    state.terminalOutcome !== null ||
    !isWalkablePhase(state.phase) ||
    !validNow(nowMs)
  ) {
    return state;
  }

  const question = currentQuestion(state);
  const lastCompletedLevel = completedLevel(state);
  const nextPrizeLevel =
    state.phase === 'correct-reveal'
      ? LADDER_LEVELS.find((level) => level === question.level + 1)
      : question.level;
  if (nextPrizeLevel === undefined) {
    // Level 15 resolves to millionaire-reveal and can never enter this branch.
    return state;
  }

  const outcome: TerminalOutcome = Object.freeze({
    kind: 'walk-away',
    amountWon: state.currentWinnings,
    atQuestionId: question.id,
    // A correct reveal is only walkable through Level 14.
    nextPrizeLevel,
    completedLevel: lastCompletedLevel,
    endedAtMs: nowMs,
  });

  return accepted(state, {
    phase: 'completed',
    overlay: null,
    terminalOutcome: outcome,
  });
}

export function gameReducer(state: GameRunState, action: GameAction): GameRunState {
  switch (action.type) {
    case 'SHOW_CURRENT_QUESTION': {
      if (
        state.overlay !== null ||
        state.terminalOutcome !== null ||
        (state.phase !== 'game-intro' && state.phase !== 'between-questions')
      ) {
        return state;
      }

      const questionId = currentQuestion(state).id;
      const displayedQuestionIds = state.displayedQuestionIds.includes(questionId)
        ? state.displayedQuestionIds
        : Object.freeze([...state.displayedQuestionIds, questionId]);
      return accepted(state, {
        phase: 'question-ready',
        displayedQuestionIds,
      });
    }

    case 'SELECT_ANSWER': {
      if (!canSelectAnswer(state) || !answerBelongsToCurrentQuestion(state, action.choiceId)) {
        return state;
      }

      const isDeselecting = state.selectedChoiceId === action.choiceId;
      return accepted(state, {
        selectedChoiceId: isDeselecting ? null : action.choiceId,
        phase: isDeselecting ? 'question-ready' : 'answer-selected',
      });
    }

    case 'CLEAR_SELECTION':
      if (!canSelectAnswer(state) || state.selectedChoiceId === null) {
        return state;
      }
      return accepted(state, {
        selectedChoiceId: null,
        phase: 'question-ready',
      });

    case 'REQUEST_LOCK':
      return canLockAnswer(state)
        ? accepted(state, { phase: 'final-confirmation' })
        : state;

    case 'CANCEL_LOCK':
      if (state.overlay !== null || state.phase !== 'final-confirmation') {
        return state;
      }
      return accepted(state, { phase: 'answer-selected' });

    case 'CONFIRM_LOCK':
      if (
        state.overlay !== null ||
        state.phase !== 'final-confirmation' ||
        state.selectedChoiceId === null ||
        state.lockedChoiceId !== null ||
        !validNow(action.nowMs)
      ) {
        return state;
      }
      return accepted(state, {
        phase: 'answer-locked',
        lockedChoiceId: state.selectedChoiceId,
        lockedAtMs: action.nowMs,
      });

    case 'REVEAL_ANSWER':
      return revealAnswer(state, action.nowMs);

    case 'ADVANCE_QUESTION': {
      const currentResult = state.results[state.results.length - 1];
      if (
        state.overlay !== null ||
        state.phase !== 'correct-reveal' ||
        state.terminalOutcome !== null ||
        state.currentQuestionIndex >= 14 ||
        !currentResult?.isCorrect ||
        currentResult.questionId !== currentQuestion(state).id
      ) {
        return state;
      }

      return accepted(state, {
        currentQuestionIndex: state.currentQuestionIndex + 1,
        phase: 'between-questions',
        selectedChoiceId: null,
        lockedChoiceId: null,
        lockedAtMs: null,
        revealedAtMs: null,
        hintRevealedForQuestionId: null,
      });
    }

    case 'ACKNOWLEDGE_TERMINAL':
      if (
        state.overlay !== null ||
        state.terminalOutcome === null ||
        (state.phase !== 'incorrect-reveal' && state.phase !== 'millionaire-reveal')
      ) {
        return state;
      }
      return accepted(state, { phase: 'completed' });

    case 'USE_HINT':
      return useHint(state);

    case 'REQUEST_PHONE':
      return canUsePhone(state)
        ? accepted(state, { phase: 'phone-confirmation' })
        : state;

    case 'CANCEL_PHONE':
      if (state.overlay !== null || state.phase !== 'phone-confirmation') {
        return state;
      }
      return accepted(state, { phase: answerablePhase(state) });

    case 'CONFIRM_PHONE': {
      if (
        state.overlay !== null ||
        state.phase !== 'phone-confirmation' ||
        state.lifelines.phone.status !== 'available' ||
        !validNow(action.nowMs)
      ) {
        return state;
      }

      return accepted(state, {
        phase: 'phone-active',
        lifelines: Object.freeze({
          ...state.lifelines,
          phone: Object.freeze({
            status: 'active',
            questionId: currentQuestion(state).id,
            deadlineMs: action.nowMs + PHONE_A_FRIEND_DURATION_MS,
          }),
        }),
      });
    }

    case 'SYNC_PHONE_DEADLINE':
      if (
        state.overlay !== null ||
        state.phase !== 'phone-active' ||
        state.lifelines.phone.status !== 'active' ||
        !validNow(action.nowMs) ||
        action.nowMs < state.lifelines.phone.deadlineMs
      ) {
        return state;
      }
      return accepted(state, endActivePhone(state));

    case 'END_PHONE_EARLY':
      if (
        state.overlay !== null ||
        state.phase !== 'phone-active' ||
        state.lifelines.phone.status !== 'active'
      ) {
        return state;
      }
      return accepted(state, endActivePhone(state));

    case 'OPEN_PAUSE': {
      if (state.overlay !== null || !canOpenOverlay(state.phase)) {
        return state;
      }
      const endedPhone = endActivePhone(state);
      return accepted(state, {
        ...endedPhone,
        overlay: Object.freeze({ kind: 'pause' }),
      });
    }

    case 'RESUME':
      return state.overlay?.kind === 'pause'
        ? accepted(state, { overlay: null })
        : state;

    case 'OPEN_HELP': {
      if (state.overlay?.kind === 'pause') {
        return accepted(state, {
          overlay: Object.freeze({ kind: 'help', returnTo: 'pause' }),
        });
      }
      if (state.overlay !== null || !canOpenOverlay(state.phase)) {
        return state;
      }
      const endedPhone = endActivePhone(state);
      return accepted(state, {
        ...endedPhone,
        overlay: Object.freeze({ kind: 'help', returnTo: 'game' }),
      });
    }

    case 'CLOSE_HELP':
      if (state.overlay?.kind !== 'help') {
        return state;
      }
      return accepted(state, {
        overlay:
          state.overlay.returnTo === 'pause'
            ? Object.freeze({ kind: 'pause' })
            : null,
      });

    case 'REQUEST_WALK_AWAY':
      return requestWalkAway(state);

    case 'CANCEL_WALK_AWAY':
      if (state.overlay?.kind !== 'walk-away-confirmation') {
        return state;
      }
      return accepted(state, {
        overlay:
          state.overlay.returnTo === 'pause'
            ? Object.freeze({ kind: 'pause' })
            : null,
      });

    case 'CONFIRM_WALK_AWAY':
      return confirmWalkAway(state, action.nowMs);
  }
}
