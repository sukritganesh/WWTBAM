import { ANSWER_LETTERS, LADDER_LEVELS } from './types';
import type {
  CreateGameRunInput,
  FifteenQuestionRun,
  GamePhase,
  GameRunState,
  ResolvedQuestionSnapshot,
} from './types';

export const PHONE_A_FRIEND_DURATION_MS = 60_000;

export class InvalidRunError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidRunError';
  }
}

function cloneQuestion(question: ResolvedQuestionSnapshot): ResolvedQuestionSnapshot {
  const choices = Object.freeze(
    question.choices.map((choice) => Object.freeze({ ...choice })),
  ) as ResolvedQuestionSnapshot['choices'];

  return Object.freeze({
    ...question,
    tags: Object.freeze([...question.tags]),
    choices,
    usage: Object.freeze({
      freshMix: question.usage.freshMix,
      setIds: Object.freeze([...question.usage.setIds]),
    }),
    ...(question.source ? { source: Object.freeze({ ...question.source }) } : {}),
  });
}

function validateAndCloneQuestions(
  questions: readonly ResolvedQuestionSnapshot[],
): FifteenQuestionRun {
  if (questions.length !== 15) {
    throw new InvalidRunError(`A game run requires 15 questions; received ${questions.length}.`);
  }

  const questionIds = new Set<string>();
  const cloned = questions.map((question, index) => {
    const expectedLevel = LADDER_LEVELS[index];
    if (question.level !== expectedLevel) {
      throw new InvalidRunError(
        `Question ${index + 1} must be Level ${expectedLevel}, not Level ${question.level}.`,
      );
    }
    if (questionIds.has(question.id)) {
      throw new InvalidRunError(`Question "${question.id}" appears twice in the run.`);
    }
    questionIds.add(question.id);

    if (question.choices.length !== 4) {
      throw new InvalidRunError(`Question "${question.id}" does not have four choices.`);
    }
    const choiceIds = new Set(question.choices.map((choice) => choice.id));
    if (choiceIds.size !== 4 || !choiceIds.has(question.correctChoiceId)) {
      throw new InvalidRunError(`Question "${question.id}" has an invalid answer structure.`);
    }
    question.choices.forEach((choice, choiceIndex) => {
      if (choice.label !== ANSWER_LETTERS[choiceIndex]) {
        throw new InvalidRunError(
          `Question "${question.id}" has an invalid resolved answer label order.`,
        );
      }
    });

    return cloneQuestion(question);
  });

  return Object.freeze(cloned) as FifteenQuestionRun;
}

function validTimestamp(value: number): boolean {
  return Number.isFinite(value) && value >= 0;
}

export function createGameRun(input: CreateGameRunInput): GameRunState {
  if (!input.runId.trim()) {
    throw new InvalidRunError('A game run requires a non-empty run ID.');
  }
  if (!validTimestamp(input.createdAtMs)) {
    throw new InvalidRunError('A game run requires a valid creation timestamp.');
  }
  if (input.owner.kind === 'profile' && !input.owner.profileId.trim()) {
    throw new InvalidRunError('A profile-owned run requires a profile ID.');
  }

  const state: GameRunState = {
    schemaVersion: 1,
    runId: input.runId,
    owner: Object.freeze({ ...input.owner }),
    mode: Object.freeze({ ...input.mode }),
    questions: validateAndCloneQuestions(input.questions),
    currentQuestionIndex: 0,
    phase: 'game-intro',
    overlay: null,
    selectedChoiceId: null,
    lockedChoiceId: null,
    lockedAtMs: null,
    revealedAtMs: null,
    lifelines: Object.freeze({
      hint: Object.freeze({ status: 'available' }),
      phone: Object.freeze({ status: 'available' }),
    }),
    hintRevealedForQuestionId: null,
    displayedQuestionIds: Object.freeze([]),
    results: Object.freeze([]),
    currentWinnings: 0,
    guaranteedWinnings: 0,
    terminalOutcome: null,
    createdAtMs: input.createdAtMs,
    // Revision 1 represents the initial run-creation save.
    saveRevision: 1,
  };

  return Object.freeze(state);
}

export function currentQuestion(state: GameRunState): ResolvedQuestionSnapshot {
  const question = state.questions[state.currentQuestionIndex];
  if (!question) {
    throw new InvalidRunError(
      `Current question index ${state.currentQuestionIndex} is outside this run.`,
    );
  }
  return question;
}

export function completedLevel(state: GameRunState): 0 | (typeof LADDER_LEVELS)[number] {
  for (let index = state.results.length - 1; index >= 0; index -= 1) {
    if (state.results[index].isCorrect) {
      return state.results[index].level;
    }
  }
  return 0;
}

export function phoneRemainingMs(state: GameRunState, nowMs: number): number {
  if (state.lifelines.phone.status !== 'active' || !Number.isFinite(nowMs)) {
    return 0;
  }

  return Math.max(
    0,
    Math.min(
      PHONE_A_FRIEND_DURATION_MS,
      state.lifelines.phone.deadlineMs - nowMs,
    ),
  );
}

export function canSelectAnswer(state: GameRunState): boolean {
  return (
    state.overlay === null &&
    state.terminalOutcome === null &&
    (state.phase === 'question-ready' || state.phase === 'answer-selected')
  );
}

export function canLockAnswer(state: GameRunState): boolean {
  return (
    state.overlay === null &&
    state.phase === 'answer-selected' &&
    state.selectedChoiceId !== null &&
    state.lockedChoiceId === null &&
    state.lifelines.phone.status !== 'active' &&
    state.terminalOutcome === null
  );
}

export function canUseHint(state: GameRunState): boolean {
  return (
    canSelectAnswer(state) &&
    state.lifelines.hint.status === 'available' &&
    state.lifelines.phone.status !== 'active'
  );
}

export function canUsePhone(state: GameRunState): boolean {
  return canSelectAnswer(state) && state.lifelines.phone.status === 'available';
}

export function isWalkablePhase(phase: GamePhase): boolean {
  return (
    phase === 'question-ready' ||
    phase === 'answer-selected' ||
    phase === 'final-confirmation' ||
    phase === 'correct-reveal'
  );
}

export function canWalkAway(state: GameRunState): boolean {
  if (state.terminalOutcome !== null || !isWalkablePhase(state.phase)) {
    return false;
  }

  return state.overlay === null || state.overlay.kind === 'pause';
}

export function isAnswerCommitted(state: GameRunState): boolean {
  return state.lockedChoiceId !== null;
}

export function isRunComplete(state: GameRunState): boolean {
  return state.phase === 'completed' && state.terminalOutcome !== null;
}
