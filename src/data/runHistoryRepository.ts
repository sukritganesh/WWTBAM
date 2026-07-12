import type { IDBPDatabase } from 'idb';

import type { ActiveSaveGuard } from './activeSaveRepository';
import {
  assertValidResolvedQuestions,
  ownerKey,
  questionHistoryId,
  RUN_HISTORY_SCHEMA_VERSION,
  setProgressId,
  systemClock,
  type Clock
} from './defaults';
import {
  ActiveSaveExpectationError,
  ControllerConflictError,
  RecordNotFoundError,
  RunCommitConflictError,
  SaveOwnerMismatchError,
  StaleSaveRevisionError
} from './errors';
import { emptyQuestionHistory } from './questionHistoryRepository';
import type {
  ActiveSaveRecord,
  AppDatabase,
  RunHistoryRecord,
  RunOutcome,
  RunQuestionResult,
  SaveOwner,
  SavedQuestionSnapshot
} from './types';

export interface TerminalRunCommit {
  runId: string;
  owner: SaveOwner;
  mode: 'fresh-mix' | 'curated-set';
  setId?: string | null;
  sourcePackIds: string[];
  startedAt: string;
  completedAt: string;
  outcome: RunOutcome;
  payout: number;
  guaranteedWinnings: number;
  highestQuestion: number;
  durationMs: number;
  lifelinesUsed: {
    hint: boolean;
    phone: boolean;
  };
  questionResults: RunQuestionResult[];
  resolvedQuestions: SavedQuestionSnapshot[];
}

export interface TerminalCommitResult {
  record: RunHistoryRecord;
  applied: boolean;
  activeSaveCleared: boolean;
}

function assertNonnegativeInteger(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new TypeError(`${label} must be a nonnegative integer.`);
  }
}

function validateCommit(input: TerminalRunCommit): void {
  if (!input.runId.trim()) throw new TypeError('Run ID must not be empty.');
  assertValidResolvedQuestions(input.resolvedQuestions);
  assertNonnegativeInteger(input.payout, 'Payout');
  assertNonnegativeInteger(input.guaranteedWinnings, 'Guaranteed winnings');
  assertNonnegativeInteger(input.durationMs, 'Duration');
  if (
    !Number.isInteger(input.highestQuestion) ||
    input.highestQuestion < 1 ||
    input.highestQuestion > 15
  ) {
    throw new TypeError('Highest question must be between 1 and 15.');
  }
  if (input.guaranteedWinnings > input.payout) {
    throw new TypeError('Guaranteed winnings cannot exceed the terminal payout.');
  }
  const resolvedById = new Map(
    input.resolvedQuestions.map((question) => [question.id, question] as const)
  );
  const resultIds = new Set<string>();
  for (const result of input.questionResults) {
    if (!result.questionId || resultIds.has(result.questionId)) {
      throw new TypeError('Question results must have unique, nonempty question IDs.');
    }
    if (!Number.isInteger(result.level) || result.level < 1 || result.level > 15) {
      throw new TypeError('Question result levels must be between 1 and 15.');
    }
    if (resolvedById.get(result.questionId)?.level !== result.level) {
      throw new TypeError('Question results must match their resolved question snapshots.');
    }
    if (
      typeof result.selectedChoiceId !== 'string' ||
      !result.selectedChoiceId ||
      typeof result.correctChoiceId !== 'string' ||
      !result.correctChoiceId
    ) {
      throw new TypeError('New terminal results must retain selected and correct choice IDs.');
    }
    const answerOrder = resolvedById.get(result.questionId)?.answerOrder ?? [];
    if (
      !answerOrder.includes(result.selectedChoiceId) ||
      !answerOrder.includes(result.correctChoiceId)
    ) {
      throw new TypeError('Terminal choice IDs must exist in the saved answer order.');
    }
    if (typeof result.phoneUsed !== 'boolean') {
      throw new TypeError('Phone usage must be recorded for every terminal question result.');
    }
    resultIds.add(result.questionId);
  }
  if (input.outcome === 'millionaire' && !input.questionResults.some((result) => result.level === 15 && result.correct)) {
    throw new TypeError('A millionaire result must include a correct Level 15 answer.');
  }
  if (input.mode === 'curated-set' && !input.setId) {
    throw new TypeError('Curated-set runs require a set ID.');
  }
}

function isSameTerminalResult(existing: RunHistoryRecord, input: TerminalRunCommit): boolean {
  return (
    existing.ownerKey === ownerKey(input.owner) &&
    existing.mode === input.mode &&
    existing.setId === (input.setId ?? null) &&
    existing.outcome === input.outcome &&
    existing.payout === input.payout &&
    existing.guaranteedWinnings === input.guaranteedWinnings &&
    existing.highestQuestion === input.highestQuestion &&
    existing.durationMs === input.durationMs &&
    existing.startedAt === input.startedAt &&
    existing.completedAt === input.completedAt &&
    existing.correctCount === input.questionResults.filter((result) => result.correct).length &&
    existing.incorrectCount === input.questionResults.filter((result) => !result.correct).length &&
    JSON.stringify(existing.lifelinesUsed) === JSON.stringify(input.lifelinesUsed) &&
    JSON.stringify(existing.sourcePackIds) ===
      JSON.stringify([...new Set(input.sourcePackIds)]) &&
    JSON.stringify(existing.questionResults) === JSON.stringify(input.questionResults) &&
    JSON.stringify(
      existing.resolvedQuestions.map((question) => ({
        id: question.id,
        level: question.level,
        answerOrder: question.answerOrder
      }))
    ) ===
      JSON.stringify(
        input.resolvedQuestions.map((question) => ({
          id: question.id,
          level: question.level,
          answerOrder: question.answerOrder
        }))
      )
  );
}

function assertSaveMatchesCommit(
  input: TerminalRunCommit,
  guard: ActiveSaveGuard,
  save: ActiveSaveRecord
): void {
  if (save.runId !== input.runId || save.runId !== guard.runId) {
    throw new ActiveSaveExpectationError('The terminal result does not match the active run.');
  }
  if (save.revision !== guard.expectedRevision) {
    throw new StaleSaveRevisionError(
      `Expected save revision ${guard.expectedRevision}, found ${save.revision}.`
    );
  }
  if (
    save.controller.id !== guard.controllerId ||
    save.controller.epoch !== guard.controllerEpoch
  ) {
    throw new ControllerConflictError('This tab no longer controls the active run.');
  }
  if (save.ownerKey !== ownerKey(input.owner)) {
    throw new SaveOwnerMismatchError('The terminal result owner does not own the active save.');
  }
  const saveQuestions = save.resolvedQuestions.map((question) => ({
    id: question.id,
    level: question.level,
    answerOrder: question.answerOrder
  }));
  const committedQuestions = input.resolvedQuestions.map((question) => ({
    id: question.id,
    level: question.level,
    answerOrder: question.answerOrder
  }));
  if (JSON.stringify(saveQuestions) !== JSON.stringify(committedQuestions)) {
    throw new ActiveSaveExpectationError(
      'The terminal history snapshot differs from the active save.'
    );
  }
}

export class RunHistoryRepository {
  constructor(
    private readonly database: IDBPDatabase<AppDatabase>,
    private readonly clock: Clock = systemClock
  ) {}

  async get(runId: string): Promise<RunHistoryRecord | undefined> {
    return this.database.get('runHistory', runId);
  }

  async listForOwner(owner: SaveOwner): Promise<RunHistoryRecord[]> {
    const records = await this.database.getAllFromIndex(
      'runHistory',
      'by-owner',
      ownerKey(owner)
    );
    return records.sort((left, right) => right.completedAt.localeCompare(left.completedAt));
  }

  async commitTerminal(input: TerminalRunCommit): Promise<TerminalCommitResult> {
    return this.commitTerminalInternal(input);
  }

  async commitTerminalAndClearSave(
    input: TerminalRunCommit,
    guard: ActiveSaveGuard
  ): Promise<TerminalCommitResult> {
    return this.commitTerminalInternal(input, guard);
  }

  private async commitTerminalInternal(
    input: TerminalRunCommit,
    clearGuard?: ActiveSaveGuard
  ): Promise<TerminalCommitResult> {
    validateCommit(input);
    const transaction = this.database.transaction(
      [
        'runHistory',
        'profiles',
        'questionHistory',
        'setProgress',
        'activeSave',
        'metadata'
      ],
      'readwrite'
    );
    const runStore = transaction.objectStore('runHistory');
    const existing = await runStore.get(input.runId);
    if (existing) {
      if (!isSameTerminalResult(existing, input)) {
        throw new RunCommitConflictError('The run ID is already committed to another result.');
      }
      let activeSaveCleared = false;
      if (clearGuard) {
        const activeStore = transaction.objectStore('activeSave');
        const active = await activeStore.get('active');
        if (active) {
          assertSaveMatchesCommit(input, clearGuard, active);
          const metadata = transaction.objectStore('metadata');
          const sequence = await metadata.get('activeSaveRevision');
          const current = sequence && typeof sequence.value === 'number' ? sequence.value : 0;
          await metadata.put({ key: 'activeSaveRevision', value: current + 1 });
          await activeStore.delete('active');
          activeSaveCleared = true;
        }
      }
      await transaction.done;
      return { record: existing, applied: false, activeSaveCleared };
    }

    let activeSaveCleared = false;
    if (clearGuard) {
      const active = await transaction.objectStore('activeSave').get('active');
      if (!active) throw new RecordNotFoundError('No active save exists for terminal commit.');
      assertSaveMatchesCommit(input, clearGuard, active);
      activeSaveCleared = true;
    }

    const key = ownerKey(input.owner);
    const timestamp = this.clock().toISOString();
    const correctCount = input.questionResults.filter((result) => result.correct).length;
    const incorrectCount = input.questionResults.length - correctCount;
    const record: RunHistoryRecord = {
      id: input.runId,
      schemaVersion: RUN_HISTORY_SCHEMA_VERSION,
      owner: input.owner,
      ownerKey: key,
      mode: input.mode,
      setId: input.setId ?? null,
      sourcePackIds: [...new Set(input.sourcePackIds)],
      startedAt: input.startedAt,
      completedAt: input.completedAt,
      committedAt: timestamp,
      outcome: input.outcome,
      payout: input.payout,
      guaranteedWinnings: input.guaranteedWinnings,
      highestQuestion: input.highestQuestion,
      correctCount,
      incorrectCount,
      durationMs: input.durationMs,
      lifelinesUsed: input.lifelinesUsed,
      questionResults: input.questionResults,
      resolvedQuestions: input.resolvedQuestions,
      committed: true,
      committedKey: 1
    };

    if (input.owner.type === 'profile') {
      const profileStore = transaction.objectStore('profiles');
      const profile = await profileStore.get(input.owner.profileId);
      if (!profile) {
        throw new RecordNotFoundError('The run owner profile does not exist.');
      }
      const statistics = profile.statistics;
      await profileStore.put({
        ...profile,
        updatedAt: timestamp,
        lastPlayedAt: input.completedAt,
        statistics: {
          gamesPlayed: statistics.gamesPlayed + 1,
          correctAnswers: statistics.correctAnswers + correctCount,
          incorrectAnswers: statistics.incorrectAnswers + incorrectCount,
          walkAways: statistics.walkAways + (input.outcome === 'walked-away' ? 1 : 0),
          millionaireWins:
            statistics.millionaireWins + (input.outcome === 'millionaire' ? 1 : 0),
          highestQuestion: Math.max(statistics.highestQuestion, input.highestQuestion),
          highestPrize: Math.max(statistics.highestPrize, input.payout),
          totalVirtualWinnings: statistics.totalVirtualWinnings + input.payout,
          totalDurationMs: statistics.totalDurationMs + input.durationMs,
          lifelinesUsed: {
            hint: statistics.lifelinesUsed.hint + (input.lifelinesUsed.hint ? 1 : 0),
            phone: statistics.lifelinesUsed.phone + (input.lifelinesUsed.phone ? 1 : 0)
          }
        }
      });
    }

    const historyStore = transaction.objectStore('questionHistory');
    for (const result of input.questionResults) {
      const id = questionHistoryId(key, result.questionId);
      const current =
        (await historyStore.get(id)) ?? emptyQuestionHistory(input.owner, result.questionId);
      if (current.lastAnsweredRunId !== input.runId) {
        await historyStore.put({
          ...current,
          answeredCount: current.answeredCount + 1,
          correctCount: current.correctCount + (result.correct ? 1 : 0),
          incorrectCount: current.incorrectCount + (result.correct ? 0 : 1),
          hintUseCount:
            current.hintUseCount +
            (result.hintUsed && current.lastHintRunId !== input.runId ? 1 : 0),
          phoneUseCount:
            current.phoneUseCount +
            (result.phoneUsed && current.lastPhoneRunId !== input.runId ? 1 : 0),
          lastAnsweredAt: input.completedAt,
          lastAnsweredRunId: input.runId,
          lastHintRunId: result.hintUsed ? input.runId : current.lastHintRunId,
          lastPhoneRunId: result.phoneUsed ? input.runId : current.lastPhoneRunId
        });
      }
    }

    if (input.setId) {
      const progressStore = transaction.objectStore('setProgress');
      const id = setProgressId(key, input.setId);
      const progress = await progressStore.get(id);
      await progressStore.put({
        id,
        ownerKey: key,
        setId: input.setId,
        attempts: (progress?.attempts ?? 0) + 1,
        wins: (progress?.wins ?? 0) + (input.outcome === 'millionaire' ? 1 : 0),
        bestPrize: Math.max(progress?.bestPrize ?? 0, input.payout),
        bestQuestion: Math.max(progress?.bestQuestion ?? 0, input.highestQuestion),
        lastPlayedAt: input.completedAt,
        lastRunId: input.runId
      });
    }

    await runStore.add(record);
    if (activeSaveCleared) {
      const metadata = transaction.objectStore('metadata');
      const sequence = await metadata.get('activeSaveRevision');
      const current = sequence && typeof sequence.value === 'number' ? sequence.value : 0;
      await metadata.put({ key: 'activeSaveRevision', value: current + 1 });
      await transaction.objectStore('activeSave').delete('active');
    }
    await transaction.done;
    return { record, applied: true, activeSaveCleared };
  }
}
