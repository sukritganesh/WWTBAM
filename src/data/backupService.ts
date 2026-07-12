import type { IDBPDatabase } from 'idb';

import { ALL_STORES, APP_DATABASE_VERSION } from './database';
import {
  assertValidResolvedQuestions,
  MAX_NAMED_PROFILES,
  ownerKey,
  questionHistoryId,
  setProgressId,
  systemClock,
  type Clock
} from './defaults';
import { BackupValidationError, UnsupportedBackupVersionError } from './errors';
import type {
  ActiveSaveRecord,
  AppDatabase,
  GlobalSettingsRecord,
  ImportedPackRecord,
  ImportedQuestionRecord,
  ImportedSetRecord,
  JsonValue,
  MetadataRecord,
  ProfileRecord,
  QuestionHistoryRecord,
  RunHistoryRecord,
  SaveOwner,
  SetProgressRecord
} from './types';

export const BACKUP_FORMAT = 'one-million-backup';
export const BACKUP_SCHEMA_VERSION = 1;
export const MAX_BACKUP_BYTES = 25 * 1024 * 1024;

export interface BackupStores {
  metadata: MetadataRecord[];
  settings: GlobalSettingsRecord[];
  profiles: ProfileRecord[];
  questionHistory: QuestionHistoryRecord[];
  runHistory: RunHistoryRecord[];
  setProgress: SetProgressRecord[];
  activeSave: ActiveSaveRecord[];
  importedPacks: ImportedPackRecord[];
  importedQuestions: ImportedQuestionRecord[];
  importedSets: ImportedSetRecord[];
}

export interface AppBackupV1 {
  format: typeof BACKUP_FORMAT;
  schemaVersion: typeof BACKUP_SCHEMA_VERSION;
  databaseVersion: number;
  exportedAt: string;
  stores: BackupStores;
}

export interface BackupSummary {
  profiles: number;
  profileCount: number;
  runs: number;
  runCount: number;
  questionHistory: number;
  importedPacks: number;
  importedPackCount: number;
  importedQuestions: number;
  importedSets: number;
  hasActiveSave: boolean;
}

type UnknownRecord = Record<string, unknown>;

function fail(path: string, message: string): never {
  throw new BackupValidationError(`${path}: ${message}`);
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function assertSafeJsonData(
  value: unknown,
  path = '$',
  depth = 0
): asserts value is JsonValue {
  if (depth > 100) fail(path, 'maximum nesting depth exceeded');
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) fail(path, 'numbers must be finite');
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((entry, index) =>
      assertSafeJsonData(entry, `${path}[${index}]`, depth + 1)
    );
    return;
  }
  if (!isRecord(value)) fail(path, 'value is not JSON data');
  for (const [key, entry] of Object.entries(value)) {
    if (key === '__proto__' || key === 'prototype' || key === 'constructor') {
      fail(`${path}.${key}`, 'unsafe object key');
    }
    assertSafeJsonData(entry, `${path}.${key}`, depth + 1);
  }
}

function assertString(record: UnknownRecord, key: string, path: string): string {
  const value = record[key];
  if (typeof value !== 'string' || !value) fail(`${path}.${key}`, 'must be a nonempty string');
  return value;
}

function assertFiniteNumber(record: UnknownRecord, key: string, path: string): number {
  const value = record[key];
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    fail(`${path}.${key}`, 'must be a finite number');
  }
  return value;
}

function assertNonnegativeInteger(record: UnknownRecord, key: string, path: string): number {
  const value = assertFiniteNumber(record, key, path);
  if (!Number.isInteger(value) || value < 0) {
    fail(`${path}.${key}`, 'must be a nonnegative integer');
  }
  return value;
}

function assertBoolean(record: UnknownRecord, key: string, path: string): boolean {
  const value = record[key];
  if (typeof value !== 'boolean') fail(`${path}.${key}`, 'must be a boolean');
  return value;
}

function assertNullableString(record: UnknownRecord, key: string, path: string): void {
  const value = record[key];
  if (value !== null && typeof value !== 'string') {
    fail(`${path}.${key}`, 'must be a string or null');
  }
}

function assertStringArray(record: UnknownRecord, key: string, path: string): string[] {
  const values = assertArray(record, key, path);
  if (values.some((value) => typeof value !== 'string' || !value)) {
    fail(`${path}.${key}`, 'must contain only nonempty strings');
  }
  if (new Set(values).size !== values.length) {
    fail(`${path}.${key}`, 'must not contain duplicates');
  }
  return values as string[];
}

function assertArray(record: UnknownRecord, key: string, path: string): unknown[] {
  const value = record[key];
  if (!Array.isArray(value)) fail(`${path}.${key}`, 'must be an array');
  return value;
}

function assertOwner(value: unknown, path: string): asserts value is SaveOwner {
  if (!isRecord(value)) fail(path, 'must be a save owner object');
  if (value.type === 'guest') return;
  if (value.type === 'profile' && typeof value.profileId === 'string' && value.profileId) return;
  fail(path, 'must identify Guest or a named profile');
}

function assertUnique<T>(
  records: T[],
  key: (record: T) => string,
  path: string
): void {
  const found = new Set<string>();
  records.forEach((record, index) => {
    const value = key(record);
    if (found.has(value)) fail(`${path}[${index}]`, `duplicate key ${value}`);
    found.add(value);
  });
}

function assertRecordArray(root: UnknownRecord, key: keyof BackupStores, limit: number): UnknownRecord[] {
  const value = root[key];
  if (!Array.isArray(value)) fail(`$.stores.${key}`, 'must be an array');
  if (value.length > limit) fail(`$.stores.${key}`, `contains more than ${limit} records`);
  value.forEach((entry, index) => {
    if (!isRecord(entry)) fail(`$.stores.${key}[${index}]`, 'must be an object');
  });
  return value as UnknownRecord[];
}

function assertProfile(record: UnknownRecord, path: string): void {
  assertString(record, 'id', path);
  assertString(record, 'displayName', path);
  assertString(record, 'createdAt', path);
  assertString(record, 'updatedAt', path);
  assertNullableString(record, 'lastPlayedAt', path);
  if (!isRecord(record.statistics)) fail(`${path}.statistics`, 'must be an object');
  for (const key of [
    'gamesPlayed',
    'correctAnswers',
    'incorrectAnswers',
    'walkAways',
    'millionaireWins',
    'highestQuestion',
    'highestPrize',
    'totalVirtualWinnings',
    'totalDurationMs'
  ]) {
    assertNonnegativeInteger(record.statistics, key, `${path}.statistics`);
  }
  if (!isRecord(record.statistics.lifelinesUsed)) {
    fail(`${path}.statistics.lifelinesUsed`, 'must be an object');
  }
  assertNonnegativeInteger(
    record.statistics.lifelinesUsed,
    'hint',
    `${path}.statistics.lifelinesUsed`
  );
  assertNonnegativeInteger(
    record.statistics.lifelinesUsed,
    'phone',
    `${path}.statistics.lifelinesUsed`
  );
}

function assertSettings(record: UnknownRecord, path: string): void {
  if (record.id !== 'global') fail(`${path}.id`, 'must be global');
  for (const key of [
    'masterMuted',
    'musicEnabled',
    'effectsEnabled',
    'narrationEnabled',
    'readAnswers',
    'readHints',
    'musicDucking',
    'fullscreenPreferred',
    'reducedMotion',
    'reducedGlow',
    'highContrast'
  ]) {
    assertBoolean(record, key, path);
  }
  if (record.autoAdvance !== undefined) assertBoolean(record, 'autoAdvance', path);
  for (const key of ['musicVolume', 'effectsVolume', 'narrationVolume']) {
    const value = assertFiniteNumber(record, key, path);
    if (value < 0 || value > 1) fail(`${path}.${key}`, 'must be between 0 and 1');
  }
  const speechRate = assertFiniteNumber(record, 'speechRate', path);
  if (speechRate < 0.5 || speechRate > 2) fail(`${path}.speechRate`, 'must be between 0.5 and 2');
  assertNullableString(record, 'voiceSelectionId', path);
  assertString(record, 'updatedAt', path);
}

function assertActiveSave(record: UnknownRecord, path: string): void {
  if (record.id !== 'active') fail(`${path}.id`, 'must be active');
  assertNonnegativeInteger(record, 'schemaVersion', path);
  assertString(record, 'runId', path);
  if (assertNonnegativeInteger(record, 'revision', path) < 1) {
    fail(`${path}.revision`, 'must be positive');
  }
  assertOwner(record.owner, `${path}.owner`);
  if (record.ownerKey !== ownerKey(record.owner)) fail(`${path}.ownerKey`, 'does not match owner');
  if (!isRecord(record.controller)) fail(`${path}.controller`, 'must be an object');
  assertString(record.controller, 'id', `${path}.controller`);
  if (assertNonnegativeInteger(record.controller, 'epoch', `${path}.controller`) < 1) {
    fail(`${path}.controller.epoch`, 'must be positive');
  }
  assertString(record.controller, 'claimedAt', `${path}.controller`);
  assertString(record.controller, 'heartbeatAt', `${path}.controller`);
  assertString(record.controller, 'leaseExpiresAt', `${path}.controller`);
  if (record.status !== 'active' && record.status !== 'completed') {
    fail(`${path}.status`, 'must be active or completed');
  }
  assertStringArray(record, 'packIds', path);
  assertString(record, 'createdAt', path);
  assertString(record, 'updatedAt', path);
  const questions = assertArray(record, 'resolvedQuestions', path);
  try {
    assertValidResolvedQuestions(questions as ActiveSaveRecord['resolvedQuestions']);
  } catch (error) {
    fail(`${path}.resolvedQuestions`, error instanceof Error ? error.message : 'is invalid');
  }
  assertSafeJsonData(record.snapshot, `${path}.snapshot`);
}

function assertRun(record: UnknownRecord, path: string): void {
  assertString(record, 'id', path);
  assertNonnegativeInteger(record, 'schemaVersion', path);
  assertOwner(record.owner, `${path}.owner`);
  if (record.ownerKey !== ownerKey(record.owner)) fail(`${path}.ownerKey`, 'does not match owner');
  if (record.committed !== true || record.committedKey !== 1) {
    fail(path, 'run history must be committed exactly once');
  }
  assertString(record, 'completedAt', path);
  assertString(record, 'startedAt', path);
  assertString(record, 'committedAt', path);
  if (record.mode !== 'fresh-mix' && record.mode !== 'curated-set') {
    fail(`${path}.mode`, 'must be fresh-mix or curated-set');
  }
  if (!['incorrect', 'walked-away', 'millionaire'].includes(String(record.outcome))) {
    fail(`${path}.outcome`, 'is invalid');
  }
  for (const key of [
    'payout',
    'guaranteedWinnings',
    'highestQuestion',
    'correctCount',
    'incorrectCount',
    'durationMs'
  ]) {
    assertNonnegativeInteger(record, key, path);
  }
  assertStringArray(record, 'sourcePackIds', path);
  if (!Array.isArray(record.questionResults)) fail(`${path}.questionResults`, 'must be an array');
  const resultQuestionIds = new Set<string>();
  record.questionResults.forEach((result, index) => {
    const resultPath = `${path}.questionResults[${index}]`;
    if (!isRecord(result)) fail(resultPath, 'must be an object');
    const questionId = assertString(result, 'questionId', resultPath);
    if (resultQuestionIds.has(questionId)) fail(`${resultPath}.questionId`, 'is duplicated');
    resultQuestionIds.add(questionId);
    const level = assertNonnegativeInteger(result, 'level', resultPath);
    if (level < 1 || level > 15) fail(`${resultPath}.level`, 'must be between 1 and 15');
    assertBoolean(result, 'correct', resultPath);
    assertBoolean(result, 'hintUsed', resultPath);
    if (result.phoneUsed !== undefined) assertBoolean(result, 'phoneUsed', resultPath);
    for (const field of ['selectedChoiceId', 'correctChoiceId']) {
      const value = result[field];
      if (value !== undefined && value !== null && typeof value !== 'string') {
        fail(`${resultPath}.${field}`, 'must be a string or null');
      }
    }
  });
  if (!isRecord(record.lifelinesUsed)) fail(`${path}.lifelinesUsed`, 'must be an object');
  assertBoolean(record.lifelinesUsed, 'hint', `${path}.lifelinesUsed`);
  assertBoolean(record.lifelinesUsed, 'phone', `${path}.lifelinesUsed`);
  const questions = assertArray(record, 'resolvedQuestions', path);
  try {
    assertValidResolvedQuestions(questions as RunHistoryRecord['resolvedQuestions']);
  } catch (error) {
    fail(`${path}.resolvedQuestions`, error instanceof Error ? error.message : 'is invalid');
  }
  const resolvedById = new Map(
    (questions as RunHistoryRecord['resolvedQuestions']).map((question) => [question.id, question])
  );
  let correctResults = 0;
  let incorrectResults = 0;
  for (const result of record.questionResults) {
    if (!isRecord(result)) continue;
    const resolved = resolvedById.get(String(result.questionId));
    if (!resolved || resolved.level !== result.level) {
      fail(`${path}.questionResults`, 'contains a result that does not match a saved question');
    }
    if (result.correct === true) correctResults += 1;
    else incorrectResults += 1;
    const selected = result.selectedChoiceId;
    const correct = result.correctChoiceId;
    if (
      typeof selected === 'string' &&
      selected &&
      !resolved.answerOrder.includes(selected)
    ) {
      fail(`${path}.questionResults`, 'contains an unknown selected choice');
    }
    if (typeof correct === 'string' && correct && !resolved.answerOrder.includes(correct)) {
      fail(`${path}.questionResults`, 'contains an unknown correct choice');
    }
    if (
      typeof selected === 'string' &&
      typeof correct === 'string' &&
      ((result.correct === true && selected !== correct) ||
        (result.correct === false && selected === correct))
    ) {
      fail(`${path}.questionResults`, 'choice IDs contradict the recorded result');
    }
  }
  if (
    Number(record.correctCount) !== correctResults ||
    Number(record.incorrectCount) !== incorrectResults
  ) {
    fail(path, 'answer totals do not match question results');
  }
}

function assertQuestionHistory(record: UnknownRecord, path: string): void {
  const id = assertString(record, 'id', path);
  const key = assertString(record, 'ownerKey', path);
  const questionId = assertString(record, 'questionId', path);
  if (id !== questionHistoryId(key, questionId)) fail(`${path}.id`, 'does not match its owner and question');
  for (const counter of [
    'seenCount',
    'answeredCount',
    'correctCount',
    'incorrectCount',
    'hintUseCount'
  ]) {
    assertNonnegativeInteger(record, counter, path);
  }
  if (record.phoneUseCount !== undefined) {
    assertNonnegativeInteger(record, 'phoneUseCount', path);
  }
  for (const field of [
    'firstSeenAt',
    'lastSeenAt',
    'lastAnsweredAt',
    'lastSeenRunId',
    'lastAnsweredRunId',
    'lastHintRunId'
  ]) {
    assertNullableString(record, field, path);
  }
  if (record.lastPhoneRunId !== undefined) {
    assertNullableString(record, 'lastPhoneRunId', path);
  }
  if (Number(record.correctCount) + Number(record.incorrectCount) !== Number(record.answeredCount)) {
    fail(path, 'correct and incorrect counts must equal answered count');
  }
}

function assertSetProgress(record: UnknownRecord, path: string): void {
  const id = assertString(record, 'id', path);
  const key = assertString(record, 'ownerKey', path);
  const setId = assertString(record, 'setId', path);
  if (id !== setProgressId(key, setId)) fail(`${path}.id`, 'does not match its owner and set');
  for (const field of ['attempts', 'wins', 'bestPrize', 'bestQuestion']) {
    assertNonnegativeInteger(record, field, path);
  }
  assertString(record, 'lastPlayedAt', path);
  assertString(record, 'lastRunId', path);
  if (Number(record.wins) > Number(record.attempts)) fail(path, 'wins cannot exceed attempts');
}

export function backupSummary(backup: AppBackupV1): BackupSummary {
  return {
    profiles: backup.stores.profiles.length,
    profileCount: backup.stores.profiles.length,
    runs: backup.stores.runHistory.length,
    runCount: backup.stores.runHistory.length,
    questionHistory: backup.stores.questionHistory.length,
    importedPacks: backup.stores.importedPacks.length,
    importedPackCount: backup.stores.importedPacks.length,
    importedQuestions: backup.stores.importedQuestions.length,
    importedSets: backup.stores.importedSets.length,
    hasActiveSave: backup.stores.activeSave.length === 1
  };
}

export function validateBackup(input: unknown): AppBackupV1 {
  let candidate: unknown = input;
  if (typeof input === 'string') {
    if (new TextEncoder().encode(input).byteLength > MAX_BACKUP_BYTES) {
      fail('$', 'backup exceeds the maximum size');
    }
    try {
      candidate = JSON.parse(input) as unknown;
    } catch {
      fail('$', 'backup is not valid JSON');
    }
  }
  assertSafeJsonData(candidate);
  if (!isRecord(candidate)) fail('$', 'backup root must be an object');
  if (candidate.format !== BACKUP_FORMAT) fail('$.format', 'is not a One Million backup');
  if (candidate.schemaVersion !== BACKUP_SCHEMA_VERSION) {
    throw new UnsupportedBackupVersionError('The backup schema version is not supported.');
  }
  assertString(candidate, 'exportedAt', '$');
  const databaseVersion = assertFiniteNumber(candidate, 'databaseVersion', '$');
  if (!Number.isInteger(databaseVersion) || databaseVersion < 1) {
    fail('$.databaseVersion', 'must be a positive integer');
  }
  if (databaseVersion > APP_DATABASE_VERSION) {
    throw new UnsupportedBackupVersionError(
      'The backup was created by a newer database version.'
    );
  }
  if (!isRecord(candidate.stores)) fail('$.stores', 'must be an object');

  const metadata = assertRecordArray(candidate.stores, 'metadata', 1_000);
  const settings = assertRecordArray(candidate.stores, 'settings', 1);
  const profiles = assertRecordArray(candidate.stores, 'profiles', MAX_NAMED_PROFILES);
  const questionHistory = assertRecordArray(candidate.stores, 'questionHistory', 100_000);
  const runHistory = assertRecordArray(candidate.stores, 'runHistory', 20_000);
  const setProgress = assertRecordArray(candidate.stores, 'setProgress', 20_000);
  const activeSave = assertRecordArray(candidate.stores, 'activeSave', 1);
  const importedPacks = assertRecordArray(candidate.stores, 'importedPacks', 1_000);
  const importedQuestions = assertRecordArray(candidate.stores, 'importedQuestions', 50_000);
  const importedSets = assertRecordArray(candidate.stores, 'importedSets', 10_000);

  profiles.forEach((record, index) => assertProfile(record, `$.stores.profiles[${index}]`));
  settings.forEach((record, index) =>
    assertSettings(record, `$.stores.settings[${index}]`)
  );
  questionHistory.forEach((record, index) =>
    assertQuestionHistory(record, `$.stores.questionHistory[${index}]`)
  );
  setProgress.forEach((record, index) =>
    assertSetProgress(record, `$.stores.setProgress[${index}]`)
  );
  activeSave.forEach((record, index) =>
    assertActiveSave(record, `$.stores.activeSave[${index}]`)
  );
  runHistory.forEach((record, index) => assertRun(record, `$.stores.runHistory[${index}]`));

  for (const [name, records] of Object.entries({
    metadata,
    profiles,
    questionHistory,
    runHistory,
    setProgress,
    importedPacks,
    importedQuestions,
    importedSets
  })) {
    records.forEach((record, index) => assertString(record, name === 'metadata' ? 'key' : 'id', `$.stores.${name}[${index}]`));
    assertUnique(records, (record) => String(record[name === 'metadata' ? 'key' : 'id']), `$.stores.${name}`);
  }

  const profileIds = new Set(profiles.map((record) => String(record.id)));
  const assertOwnerKeyExists = (key: unknown, path: string): void => {
    if (key === 'guest') return;
    if (
      typeof key !== 'string' ||
      !key.startsWith('profile:') ||
      !profileIds.has(key.slice('profile:'.length))
    ) {
      fail(path, 'references a missing profile');
    }
  };
  const assertOwnerExists = (record: UnknownRecord, path: string): void => {
    assertOwner(record.owner, `${path}.owner`);
    if (record.owner.type === 'profile' && !profileIds.has(record.owner.profileId)) {
      fail(`${path}.owner.profileId`, 'references a missing profile');
    }
  };
  activeSave.forEach((record, index) => assertOwnerExists(record, `$.stores.activeSave[${index}]`));
  runHistory.forEach((record, index) => assertOwnerExists(record, `$.stores.runHistory[${index}]`));
  questionHistory.forEach((record, index) =>
    assertOwnerKeyExists(record.ownerKey, `$.stores.questionHistory[${index}].ownerKey`)
  );
  setProgress.forEach((record, index) =>
    assertOwnerKeyExists(record.ownerKey, `$.stores.setProgress[${index}].ownerKey`)
  );

  const packIds = new Set(importedPacks.map((record) => String(record.id)));
  importedPacks.forEach((record, index) => {
    const path = `$.stores.importedPacks[${index}]`;
    if (String(record.id).startsWith('builtin')) fail(`${path}.id`, 'uses the reserved namespace');
    assertString(record, 'version', path);
    assertString(record, 'contentHash', path);
    assertString(record, 'schemaVersion', path);
    assertString(record, 'title', path);
    assertString(record, 'language', path);
    assertBoolean(record, 'enabled', path);
    const enabledKey = assertNonnegativeInteger(record, 'enabledKey', path);
    if (enabledKey !== (record.enabled ? 1 : 0)) fail(`${path}.enabledKey`, 'does not match enabled');
    assertNonnegativeInteger(record, 'questionCount', path);
    assertNonnegativeInteger(record, 'setCount', path);
    assertString(record, 'installedAt', path);
    assertString(record, 'updatedAt', path);
  });
  importedQuestions.forEach((record, index) => {
    const path = `$.stores.importedQuestions[${index}]`;
    const packId = assertString(record, 'packId', path);
    if (!packIds.has(packId)) fail(`${path}.packId`, 'references a missing pack');
    if (!String(record.id).startsWith(`${packId}:`)) fail(`${path}.id`, 'is not namespaced');
    assertString(record, 'localId', path);
    const level = assertNonnegativeInteger(record, 'level', path);
    if (level < 1 || level > 15) fail(`${path}.level`, 'must be between 1 and 15');
    if (!isRecord(record.payload)) fail(`${path}.payload`, 'must be an object');
  });
  const importedQuestionIds = new Set(importedQuestions.map((record) => String(record.id)));
  importedSets.forEach((record, index) => {
    const path = `$.stores.importedSets[${index}]`;
    const packId = assertString(record, 'packId', path);
    if (!packIds.has(packId)) fail(`${path}.packId`, 'references a missing pack');
    if (!String(record.id).startsWith(`${packId}:`)) fail(`${path}.id`, 'is not namespaced');
    assertString(record, 'localId', path);
    const questionIds = assertStringArray(record, 'questionIds', path);
    if (questionIds.length !== 15) fail(`${path}.questionIds`, 'must contain 15 questions');
    if (questionIds.some((questionId) => !importedQuestionIds.has(questionId))) {
      fail(`${path}.questionIds`, 'contains a broken question reference');
    }
    if (!isRecord(record.payload)) fail(`${path}.payload`, 'must be an object');
  });
  for (const pack of importedPacks) {
    const questionCount = importedQuestions.filter((record) => record.packId === pack.id).length;
    const setCount = importedSets.filter((record) => record.packId === pack.id).length;
    if (pack.questionCount !== questionCount || pack.setCount !== setCount) {
      fail(`$.stores.importedPacks[${String(pack.id)}]`, 'stored content counts do not match');
    }
  }

  const activeRevisionRecord = metadata.find((record) => record.key === 'activeSaveRevision');
  if (
    activeRevisionRecord &&
    (typeof activeRevisionRecord.value !== 'number' ||
      !Number.isInteger(activeRevisionRecord.value) ||
      activeRevisionRecord.value < 0)
  ) {
    fail('$.stores.metadata.activeSaveRevision', 'must be a nonnegative integer');
  }

  const encoded = JSON.stringify(candidate);
  if (new TextEncoder().encode(encoded).byteLength > MAX_BACKUP_BYTES) {
    fail('$', 'backup exceeds the maximum size');
  }
  const normalized = structuredClone(candidate) as unknown as AppBackupV1;
  normalized.stores.settings = normalized.stores.settings.map((settingsRecord) => ({
    ...settingsRecord,
    autoAdvance: settingsRecord.autoAdvance ?? false
  }));
  normalized.stores.questionHistory = normalized.stores.questionHistory.map((history) => ({
    ...history,
    phoneUseCount: history.phoneUseCount ?? 0,
    lastPhoneRunId: history.lastPhoneRunId ?? null
  }));
  normalized.stores.runHistory = normalized.stores.runHistory.map((run) => {
    const resolvedById = new Map(run.resolvedQuestions.map((question) => [question.id, question]));
    return {
      ...run,
      schemaVersion: Math.max(run.schemaVersion ?? 1, 2),
      questionResults: run.questionResults.map((result) => {
        const resolved = resolvedById.get(result.questionId);
        return {
          ...result,
          selectedChoiceId: result.selectedChoiceId ?? null,
          correctChoiceId:
            result.correctChoiceId ??
            (typeof resolved?.correctChoiceId === 'string' ? resolved.correctChoiceId : null),
          phoneUsed: result.phoneUsed ?? false
        };
      })
    };
  });
  return normalized;
}

export class BackupService {
  constructor(
    private readonly database: IDBPDatabase<AppDatabase>,
    private readonly clock: Clock = systemClock
  ) {}

  async export(): Promise<AppBackupV1> {
    const transaction = this.database.transaction(ALL_STORES, 'readonly');
    const [
      metadata,
      settings,
      profiles,
      questionHistory,
      runHistory,
      setProgress,
      activeSave,
      importedPacks,
      importedQuestions,
      importedSets
    ] = await Promise.all([
      transaction.objectStore('metadata').getAll(),
      transaction.objectStore('settings').getAll(),
      transaction.objectStore('profiles').getAll(),
      transaction.objectStore('questionHistory').getAll(),
      transaction.objectStore('runHistory').getAll(),
      transaction.objectStore('setProgress').getAll(),
      transaction.objectStore('activeSave').getAll(),
      transaction.objectStore('importedPacks').getAll(),
      transaction.objectStore('importedQuestions').getAll(),
      transaction.objectStore('importedSets').getAll()
    ]);
    await transaction.done;
    return {
      format: BACKUP_FORMAT,
      schemaVersion: BACKUP_SCHEMA_VERSION,
      databaseVersion: APP_DATABASE_VERSION,
      exportedAt: this.clock().toISOString(),
      stores: {
        metadata,
        settings,
        profiles,
        questionHistory,
        runHistory,
        setProgress,
        activeSave,
        importedPacks,
        importedQuestions,
        importedSets
      }
    };
  }

  async exportJson(space = 2): Promise<string> {
    return JSON.stringify(await this.export(), null, space);
  }

  preview(input: unknown): BackupSummary {
    return backupSummary(validateBackup(input));
  }

  async restore(input: unknown): Promise<BackupSummary> {
    const backup = validateBackup(input);
    const transaction = this.database.transaction(ALL_STORES, 'readwrite');
    const metadataStore = transaction.objectStore('metadata');
    const currentRevisionRecord = await metadataStore.get('activeSaveRevision');
    const currentRevision =
      currentRevisionRecord && typeof currentRevisionRecord.value === 'number'
        ? currentRevisionRecord.value
        : 0;
    const backupRevisionRecord = backup.stores.metadata.find(
      (record) => record.key === 'activeSaveRevision'
    );
    const backupRevision =
      backupRevisionRecord && typeof backupRevisionRecord.value === 'number'
        ? backupRevisionRecord.value
        : 0;
    const backedUpActive = backup.stores.activeSave[0];
    const restoreRevision =
      Math.max(currentRevision, backupRevision, backedUpActive?.revision ?? 0) + 1;
    const restoredAt = this.clock().toISOString();
    const restoredActive: ActiveSaveRecord | undefined = backedUpActive
      ? {
          ...backedUpActive,
          revision: restoreRevision,
          controller: {
            id: 'restored-unclaimed',
            epoch: backedUpActive.controller.epoch + 1,
            claimedAt: restoredAt,
            heartbeatAt: restoredAt,
            leaseExpiresAt: new Date(0).toISOString()
          },
          updatedAt: restoredAt
        }
      : undefined;
    for (const storeName of ALL_STORES) {
      await transaction.objectStore(storeName).clear();
    }

    for (const record of backup.stores.metadata) {
      await transaction.objectStore('metadata').put(record);
    }
    for (const record of backup.stores.settings) {
      await transaction.objectStore('settings').put(record);
    }
    for (const record of backup.stores.profiles) {
      await transaction.objectStore('profiles').put(record);
    }
    for (const record of backup.stores.questionHistory) {
      await transaction.objectStore('questionHistory').put(record);
    }
    for (const record of backup.stores.runHistory) {
      await transaction.objectStore('runHistory').put(record);
    }
    for (const record of backup.stores.setProgress) {
      await transaction.objectStore('setProgress').put(record);
    }
    if (restoredActive) {
      await transaction.objectStore('activeSave').put(restoredActive);
    }
    for (const record of backup.stores.importedPacks) {
      await transaction.objectStore('importedPacks').put(record);
    }
    for (const record of backup.stores.importedQuestions) {
      await transaction.objectStore('importedQuestions').put(record);
    }
    for (const record of backup.stores.importedSets) {
      await transaction.objectStore('importedSets').put(record);
    }

    await transaction
      .objectStore('metadata')
      .put({ key: 'activeSaveRevision', value: restoreRevision });
    await transaction.done;

    const verification = await Promise.all([
      this.database.count('metadata'),
      this.database.count('settings'),
      this.database.count('profiles'),
      this.database.count('questionHistory'),
      this.database.count('runHistory'),
      this.database.count('setProgress'),
      this.database.count('activeSave'),
      this.database.count('importedPacks'),
      this.database.count('importedQuestions'),
      this.database.count('importedSets')
    ]);
    const addedRevisionMetadata = !backup.stores.metadata.some(
      (record) => record.key === 'activeSaveRevision'
    );
    const expected = [
      backup.stores.metadata.length + (addedRevisionMetadata ? 1 : 0),
      backup.stores.settings.length,
      backup.stores.profiles.length,
      backup.stores.questionHistory.length,
      backup.stores.runHistory.length,
      backup.stores.setProgress.length,
      backup.stores.activeSave.length,
      backup.stores.importedPacks.length,
      backup.stores.importedQuestions.length,
      backup.stores.importedSets.length
    ];
    if (verification.some((count, index) => count !== expected[index])) {
      throw new BackupValidationError('Backup restore verification failed.');
    }
    return backupSummary(backup);
  }
}
