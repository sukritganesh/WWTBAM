export const LADDER_LEVELS = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15,
] as const;

export type LadderLevel = (typeof LADDER_LEVELS)[number];

export const ANSWER_LETTERS = ['A', 'B', 'C', 'D'] as const;
export type AnswerLetter = (typeof ANSWER_LETTERS)[number];

export interface QuestionChoice {
  readonly id: string;
  readonly text: string;
}

export type FourChoices<T extends QuestionChoice = QuestionChoice> = readonly [
  T,
  T,
  T,
  T,
];

export interface QuestionUsage {
  readonly freshMix: boolean;
  readonly setIds: readonly string[];
}

export interface QuestionSourceRef {
  readonly packId?: string;
  readonly packVersion?: string;
  readonly releaseId?: string;
  readonly sourceFile?: string;
  readonly builtIn?: boolean;
}

/**
 * The normalized catalog shape consumed by the game domain. Content ingestion
 * is responsible for validating untrusted JSON before it reaches this type.
 */
export interface QuestionDefinition {
  readonly id: string;
  readonly level: LadderLevel;
  readonly category: string;
  readonly tags?: readonly string[];
  readonly prompt: string;
  /** Runtime validation still enforces exactly four entries before resolution. */
  readonly choices: readonly QuestionChoice[];
  readonly correctChoiceId: string;
  readonly hint: string;
  readonly explanation: string;
  readonly usage: QuestionUsage;
  readonly source?: QuestionSourceRef;
  readonly origin?: 'built-in' | 'imported';
  readonly sourcePackId?: string;
  readonly sourceVersion?: string;
  readonly sourceFile?: string;
  readonly enabled?: boolean;
}

export interface ResolvedChoice extends QuestionChoice {
  readonly label: AnswerLetter;
  readonly originalIndex: 0 | 1 | 2 | 3;
}

export type FourResolvedChoices = FourChoices<ResolvedChoice>;

/** A self-contained question snapshot whose answer order never changes. */
export interface ResolvedQuestionSnapshot {
  readonly id: string;
  readonly level: LadderLevel;
  readonly category: string;
  readonly tags: readonly string[];
  readonly prompt: string;
  readonly choices: FourResolvedChoices;
  readonly correctChoiceId: string;
  readonly hint: string;
  readonly explanation: string;
  readonly usage: QuestionUsage;
  readonly source?: QuestionSourceRef;
  readonly origin?: 'built-in' | 'imported';
  readonly sourcePackId?: string;
  readonly sourceVersion?: string;
  readonly sourceFile?: string;
}

export type FifteenQuestionRun = readonly [
  ResolvedQuestionSnapshot,
  ResolvedQuestionSnapshot,
  ResolvedQuestionSnapshot,
  ResolvedQuestionSnapshot,
  ResolvedQuestionSnapshot,
  ResolvedQuestionSnapshot,
  ResolvedQuestionSnapshot,
  ResolvedQuestionSnapshot,
  ResolvedQuestionSnapshot,
  ResolvedQuestionSnapshot,
  ResolvedQuestionSnapshot,
  ResolvedQuestionSnapshot,
  ResolvedQuestionSnapshot,
  ResolvedQuestionSnapshot,
  ResolvedQuestionSnapshot,
];

export interface CuratedSetDefinition {
  readonly id: string;
  readonly title: string;
  readonly description?: string;
  readonly theme?: string;
  readonly tags?: readonly string[];
  readonly questionIds: readonly string[];
  readonly enabled?: boolean;
}

export interface QuestionEncounter {
  readonly seenCount: number;
  readonly lastSeenAtMs?: number | null;
}

export type QuestionHistory = Readonly<Record<string, QuestionEncounter>>;

export interface CuratedSetProgress {
  readonly setId: string;
  readonly attemptCount: number;
  readonly millionaireWon: boolean;
  readonly lastAttemptedAtMs?: number | null;
}

export type RunMode =
  | { readonly kind: 'fresh-mix' }
  | {
      readonly kind: 'curated-set';
      readonly setId: string;
      readonly setTitle: string;
    }
  | {
      readonly kind: 'surprise';
      readonly setId: string;
      readonly setTitle: string;
    };

export type RunOwner =
  | {
      readonly kind: 'profile';
      readonly profileId: string;
      readonly displayName?: string;
    }
  | { readonly kind: 'guest' };

export type GamePhase =
  | 'game-intro'
  | 'question-ready'
  | 'answer-selected'
  | 'final-confirmation'
  | 'phone-confirmation'
  | 'phone-active'
  | 'answer-locked'
  | 'correct-reveal'
  | 'incorrect-reveal'
  | 'millionaire-reveal'
  | 'between-questions'
  | 'completed';

export type GameOverlay =
  | { readonly kind: 'pause' }
  | { readonly kind: 'help'; readonly returnTo: 'game' | 'pause' }
  | {
      readonly kind: 'walk-away-confirmation';
      readonly returnTo: 'game' | 'pause';
    }
  | null;

export type HintLifelineState =
  | { readonly status: 'available' }
  | { readonly status: 'used'; readonly questionId: string };

export type PhoneLifelineState =
  | { readonly status: 'available' }
  | {
      readonly status: 'active';
      readonly questionId: string;
      /** Persisted wall-clock deadline used to recover after refresh. */
      readonly deadlineMs: number;
    }
  | { readonly status: 'used'; readonly questionId: string };

export interface LifelineState {
  readonly hint: HintLifelineState;
  readonly phone: PhoneLifelineState;
}

export interface QuestionResult {
  readonly questionId: string;
  readonly level: LadderLevel;
  readonly selectedChoiceId: string;
  readonly correctChoiceId: string;
  readonly isCorrect: boolean;
  readonly hintUsed: boolean;
  readonly phoneUsed: boolean;
  readonly winningsAfter: number;
  readonly guaranteedWinningsAfter: number;
  readonly answeredAtMs: number;
}

export type TerminalOutcome =
  | {
      readonly kind: 'incorrect';
      readonly amountWon: number;
      readonly failedQuestionId: string;
      readonly failedLevel: LadderLevel;
      readonly selectedChoiceId: string;
      readonly correctChoiceId: string;
      readonly endedAtMs: number;
    }
  | {
      readonly kind: 'walk-away';
      readonly amountWon: number;
      readonly atQuestionId: string;
      readonly nextPrizeLevel: LadderLevel;
      readonly completedLevel: 0 | LadderLevel;
      readonly endedAtMs: number;
    }
  | {
      readonly kind: 'millionaire';
      readonly amountWon: 1_000_000;
      readonly winningQuestionId: string;
      readonly endedAtMs: number;
    };

/**
 * Serializable, pure game state. It intentionally contains no React, audio,
 * browser, or repository objects.
 */
export interface GameRunState {
  readonly schemaVersion: 1;
  readonly runId: string;
  readonly owner: RunOwner;
  readonly mode: RunMode;
  readonly questions: FifteenQuestionRun;
  readonly currentQuestionIndex: number;
  readonly phase: GamePhase;
  readonly overlay: GameOverlay;
  readonly selectedChoiceId: string | null;
  readonly lockedChoiceId: string | null;
  readonly lockedAtMs: number | null;
  readonly revealedAtMs: number | null;
  readonly lifelines: LifelineState;
  readonly hintRevealedForQuestionId: string | null;
  readonly displayedQuestionIds: readonly string[];
  readonly results: readonly QuestionResult[];
  readonly currentWinnings: number;
  readonly guaranteedWinnings: number;
  readonly terminalOutcome: TerminalOutcome | null;
  readonly createdAtMs: number;
  /** Monotonically increases for every accepted, persistable transition. */
  readonly saveRevision: number;
}

export interface CreateGameRunInput {
  readonly runId: string;
  readonly owner: RunOwner;
  readonly mode: RunMode;
  readonly questions: readonly ResolvedQuestionSnapshot[];
  readonly createdAtMs: number;
}

export type GameAction =
  | { readonly type: 'SHOW_CURRENT_QUESTION' }
  | { readonly type: 'SELECT_ANSWER'; readonly choiceId: string }
  | { readonly type: 'CLEAR_SELECTION' }
  | { readonly type: 'REQUEST_LOCK' }
  | { readonly type: 'CANCEL_LOCK' }
  | { readonly type: 'CONFIRM_LOCK'; readonly nowMs: number }
  | { readonly type: 'REVEAL_ANSWER'; readonly nowMs: number }
  | { readonly type: 'ADVANCE_QUESTION' }
  | { readonly type: 'ACKNOWLEDGE_TERMINAL' }
  | { readonly type: 'USE_HINT' }
  | { readonly type: 'REQUEST_PHONE' }
  | { readonly type: 'CANCEL_PHONE' }
  | { readonly type: 'CONFIRM_PHONE'; readonly nowMs: number }
  | { readonly type: 'SYNC_PHONE_DEADLINE'; readonly nowMs: number }
  | { readonly type: 'END_PHONE_EARLY' }
  | { readonly type: 'OPEN_PAUSE' }
  | { readonly type: 'RESUME' }
  | { readonly type: 'OPEN_HELP' }
  | { readonly type: 'CLOSE_HELP' }
  | { readonly type: 'REQUEST_WALK_AWAY' }
  | { readonly type: 'CANCEL_WALK_AWAY' }
  | { readonly type: 'CONFIRM_WALK_AWAY'; readonly nowMs: number };
