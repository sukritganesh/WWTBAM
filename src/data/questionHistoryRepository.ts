import type { IDBPDatabase } from 'idb';

import {
  ownerKey,
  questionHistoryId,
  systemClock,
  type Clock
} from './defaults';
import { RecordNotFoundError } from './errors';
import type { AppDatabase, QuestionHistoryRecord, SaveOwner } from './types';

export interface HistoryMutationResult {
  record: QuestionHistoryRecord;
  applied: boolean;
}

function emptyQuestionHistory(
  owner: SaveOwner,
  questionId: string
): QuestionHistoryRecord {
  const key = ownerKey(owner);
  return {
    id: questionHistoryId(key, questionId),
    ownerKey: key,
    questionId,
    seenCount: 0,
    answeredCount: 0,
    correctCount: 0,
    incorrectCount: 0,
    hintUseCount: 0,
    phoneUseCount: 0,
    firstSeenAt: null,
    lastSeenAt: null,
    lastAnsweredAt: null,
    lastSeenRunId: null,
    lastAnsweredRunId: null,
    lastHintRunId: null,
    lastPhoneRunId: null
  };
}

function assertIdentifiers(questionId: string, runId: string): void {
  if (!questionId.trim()) throw new TypeError('Question ID must not be empty.');
  if (!runId.trim()) throw new TypeError('Run ID must not be empty.');
}

async function assertOwnerProfileExists(
  owner: SaveOwner,
  profileStore: { get(id: string): Promise<unknown> }
): Promise<void> {
  if (owner.type === 'profile' && !(await profileStore.get(owner.profileId))) {
    throw new RecordNotFoundError('The question-history owner profile does not exist.');
  }
}

export class QuestionHistoryRepository {
  constructor(
    private readonly database: IDBPDatabase<AppDatabase>,
    private readonly clock: Clock = systemClock
  ) {}

  async get(owner: SaveOwner, questionId: string): Promise<QuestionHistoryRecord | undefined> {
    return this.database.get('questionHistory', questionHistoryId(owner, questionId));
  }

  async listForOwner(owner: SaveOwner): Promise<QuestionHistoryRecord[]> {
    return this.database.getAllFromIndex('questionHistory', 'by-owner', ownerKey(owner));
  }

  async markSeen(
    owner: SaveOwner,
    questionId: string,
    runId: string,
    at = this.clock().toISOString()
  ): Promise<HistoryMutationResult> {
    assertIdentifiers(questionId, runId);
    const transaction = this.database.transaction(
      ['questionHistory', 'profiles'],
      'readwrite'
    );
    await assertOwnerProfileExists(owner, transaction.objectStore('profiles'));
    const id = questionHistoryId(owner, questionId);
    const historyStore = transaction.objectStore('questionHistory');
    const current = (await historyStore.get(id)) ?? emptyQuestionHistory(owner, questionId);
    if (current.lastSeenRunId === runId) {
      await transaction.done;
      return { record: current, applied: false };
    }
    const updated: QuestionHistoryRecord = {
      ...current,
      seenCount: current.seenCount + 1,
      firstSeenAt: current.firstSeenAt ?? at,
      lastSeenAt: at,
      lastSeenRunId: runId
    };
    await historyStore.put(updated);
    await transaction.done;
    return { record: updated, applied: true };
  }

  async markAnswered(
    owner: SaveOwner,
    questionId: string,
    runId: string,
    correct: boolean,
    at = this.clock().toISOString()
  ): Promise<HistoryMutationResult> {
    assertIdentifiers(questionId, runId);
    const transaction = this.database.transaction(
      ['questionHistory', 'profiles'],
      'readwrite'
    );
    await assertOwnerProfileExists(owner, transaction.objectStore('profiles'));
    const id = questionHistoryId(owner, questionId);
    const historyStore = transaction.objectStore('questionHistory');
    const current = (await historyStore.get(id)) ?? emptyQuestionHistory(owner, questionId);
    if (current.lastAnsweredRunId === runId) {
      await transaction.done;
      return { record: current, applied: false };
    }
    const updated: QuestionHistoryRecord = {
      ...current,
      answeredCount: current.answeredCount + 1,
      correctCount: current.correctCount + (correct ? 1 : 0),
      incorrectCount: current.incorrectCount + (correct ? 0 : 1),
      lastAnsweredAt: at,
      lastAnsweredRunId: runId
    };
    await historyStore.put(updated);
    await transaction.done;
    return { record: updated, applied: true };
  }

  async markHintUsed(
    owner: SaveOwner,
    questionId: string,
    runId: string
  ): Promise<HistoryMutationResult> {
    assertIdentifiers(questionId, runId);
    const transaction = this.database.transaction(
      ['questionHistory', 'profiles'],
      'readwrite'
    );
    await assertOwnerProfileExists(owner, transaction.objectStore('profiles'));
    const id = questionHistoryId(owner, questionId);
    const historyStore = transaction.objectStore('questionHistory');
    const current = (await historyStore.get(id)) ?? emptyQuestionHistory(owner, questionId);
    if (current.lastHintRunId === runId) {
      await transaction.done;
      return { record: current, applied: false };
    }
    const updated: QuestionHistoryRecord = {
      ...current,
      hintUseCount: current.hintUseCount + 1,
      lastHintRunId: runId
    };
    await historyStore.put(updated);
    await transaction.done;
    return { record: updated, applied: true };
  }

  async markPhoneUsed(
    owner: SaveOwner,
    questionId: string,
    runId: string
  ): Promise<HistoryMutationResult> {
    assertIdentifiers(questionId, runId);
    const transaction = this.database.transaction(
      ['questionHistory', 'profiles'],
      'readwrite'
    );
    await assertOwnerProfileExists(owner, transaction.objectStore('profiles'));
    const id = questionHistoryId(owner, questionId);
    const historyStore = transaction.objectStore('questionHistory');
    const current = (await historyStore.get(id)) ?? emptyQuestionHistory(owner, questionId);
    if (current.lastPhoneRunId === runId) {
      await transaction.done;
      return { record: current, applied: false };
    }
    const updated: QuestionHistoryRecord = {
      ...current,
      phoneUseCount: current.phoneUseCount + 1,
      lastPhoneRunId: runId
    };
    await historyStore.put(updated);
    await transaction.done;
    return { record: updated, applied: true };
  }
}

export { emptyQuestionHistory };
