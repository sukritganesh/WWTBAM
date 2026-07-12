import type { IDBPDatabase } from 'idb';

import {
  assertSafeJsonData,
  BACKUP_FORMAT,
  BACKUP_SCHEMA_VERSION,
  MAX_BACKUP_BYTES,
  validateBackup
} from './backupService';
import { APP_DATABASE_VERSION } from './database';
import {
  MAX_NAMED_PROFILES,
  MAX_PROFILE_NAME_LENGTH,
  ownerKey,
  questionHistoryId,
  setProgressId,
  systemClock,
  systemIdFactory,
  type Clock,
  type IdFactory
} from './defaults';
import {
  ActiveSaveExistsError,
  ActiveSaveExpectationError,
  BackupValidationError,
  ProfileLimitError,
  RecordNotFoundError,
  UnsupportedBackupVersionError
} from './errors';
import type { ActiveSaveExpectation } from './activeSaveRepository';
import type {
  ActiveSaveRecord,
  AppDatabase,
  ProfileRecord,
  QuestionHistoryRecord,
  RunHistoryRecord,
  SetProgressRecord
} from './types';

export const PROFILE_EXPORT_FORMAT = 'one-million-profile';
export const PROFILE_EXPORT_SCHEMA_VERSION = 1;

export interface ProfileExportV1 {
  format: typeof PROFILE_EXPORT_FORMAT;
  schemaVersion: typeof PROFILE_EXPORT_SCHEMA_VERSION;
  exportedAt: string;
  profile: ProfileRecord;
  questionHistory: QuestionHistoryRecord[];
  runHistory: RunHistoryRecord[];
  setProgress: SetProgressRecord[];
  activeSave: ActiveSaveRecord | null;
}

export type ImportedActiveSavePolicy = 'reject' | 'discard' | 'replace';

export interface ImportProfileOptions {
  displayName?: string;
  activeSavePolicy?: ImportedActiveSavePolicy;
  expectedActiveSave?: ActiveSaveExpectation | null;
}

export interface ImportProfileResult extends ProfileRecord {
  profile: ProfileRecord;
  questionHistoryCount: number;
  runHistoryCount: number;
  setProgressCount: number;
  activeSaveImported: boolean;
}

export interface ProfileExportPreview {
  displayName: string;
  runCount: number;
  questionHistoryCount: number;
  setProgressCount: number;
  hasActiveSave: boolean;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new BackupValidationError('Profile export root must be an object.');
  }
  return value as Record<string, unknown>;
}

function parseProfileExport(input: unknown): unknown {
  if (typeof input !== 'string') return input;
  if (new TextEncoder().encode(input).byteLength > MAX_BACKUP_BYTES) {
    throw new BackupValidationError('Profile export exceeds the maximum size.');
  }
  try {
    return JSON.parse(input) as unknown;
  } catch {
    throw new BackupValidationError('Profile export is not valid JSON.');
  }
}

function normalizeName(name: string): string {
  const normalized = name.trim();
  if (!normalized) throw new TypeError('Profile name must not be empty.');
  if (normalized.length > MAX_PROFILE_NAME_LENGTH) {
    throw new TypeError(`Profile names may contain at most ${MAX_PROFILE_NAME_LENGTH} characters.`);
  }
  return normalized;
}

export function validateProfileExport(input: unknown): ProfileExportV1 {
  const candidate = parseProfileExport(input);
  assertSafeJsonData(candidate);
  const root = asRecord(candidate);
  if (root.format !== PROFILE_EXPORT_FORMAT) {
    throw new BackupValidationError('This file is not a One Million profile export.');
  }
  if (root.schemaVersion !== PROFILE_EXPORT_SCHEMA_VERSION) {
    throw new UnsupportedBackupVersionError('The profile export version is not supported.');
  }
  if (typeof root.exportedAt !== 'string' || !root.exportedAt) {
    throw new BackupValidationError('Profile export timestamp is missing.');
  }
  if (!root.profile || typeof root.profile !== 'object' || Array.isArray(root.profile)) {
    throw new BackupValidationError('Profile export is missing its profile.');
  }
  for (const field of ['questionHistory', 'runHistory', 'setProgress']) {
    if (!Array.isArray(root[field])) {
      throw new BackupValidationError(`Profile export ${field} must be an array.`);
    }
  }
  if (
    root.activeSave !== null &&
    (typeof root.activeSave !== 'object' || Array.isArray(root.activeSave))
  ) {
    throw new BackupValidationError('Profile export active save must be an object or null.');
  }

  const syntheticBackup = validateBackup({
    format: BACKUP_FORMAT,
    schemaVersion: BACKUP_SCHEMA_VERSION,
    databaseVersion: APP_DATABASE_VERSION,
    exportedAt: root.exportedAt,
    stores: {
      metadata: [],
      settings: [],
      profiles: [root.profile],
      questionHistory: root.questionHistory,
      runHistory: root.runHistory,
      setProgress: root.setProgress,
      activeSave: root.activeSave ? [root.activeSave] : [],
      importedPacks: [],
      importedQuestions: [],
      importedSets: []
    }
  });
  const sourceProfileId = syntheticBackup.stores.profiles[0].id;
  const expectedOwnerKey = ownerKey({ type: 'profile', profileId: sourceProfileId });
  if (
    syntheticBackup.stores.questionHistory.some(
      (history) => history.ownerKey !== expectedOwnerKey
    ) ||
    syntheticBackup.stores.setProgress.some(
      (progress) => progress.ownerKey !== expectedOwnerKey
    ) ||
    syntheticBackup.stores.runHistory.some(
      (run) => run.ownerKey !== expectedOwnerKey
    ) ||
    syntheticBackup.stores.activeSave.some(
      (save) => save.ownerKey !== expectedOwnerKey
    )
  ) {
    throw new BackupValidationError('Profile export contains data owned by another identity.');
  }

  return {
    format: PROFILE_EXPORT_FORMAT,
    schemaVersion: PROFILE_EXPORT_SCHEMA_VERSION,
    exportedAt: root.exportedAt,
    profile: syntheticBackup.stores.profiles[0],
    questionHistory: syntheticBackup.stores.questionHistory,
    runHistory: syntheticBackup.stores.runHistory,
    setProgress: syntheticBackup.stores.setProgress,
    activeSave: syntheticBackup.stores.activeSave[0] ?? null
  };
}

export class ProfileTransferService {
  constructor(
    private readonly database: IDBPDatabase<AppDatabase>,
    private readonly clock: Clock = systemClock,
    private readonly idFactory: IdFactory = systemIdFactory
  ) {}

  async export(
    profileId: string,
    options: boolean | { includeOwnedSave?: boolean } = false
  ): Promise<ProfileExportV1> {
    const includeActiveSave =
      typeof options === 'boolean' ? options : Boolean(options.includeOwnedSave);
    const transaction = this.database.transaction(
      ['profiles', 'questionHistory', 'runHistory', 'setProgress', 'activeSave'],
      'readonly'
    );
    const profile = await transaction.objectStore('profiles').get(profileId);
    if (!profile) throw new RecordNotFoundError('Profile not found.');
    const key = ownerKey({ type: 'profile', profileId });
    const [questionHistory, runHistory, setProgress, active] = await Promise.all([
      transaction.objectStore('questionHistory').index('by-owner').getAll(key),
      transaction.objectStore('runHistory').index('by-owner').getAll(key),
      transaction.objectStore('setProgress').index('by-owner').getAll(key),
      transaction.objectStore('activeSave').get('active')
    ]);
    await transaction.done;
    return {
      format: PROFILE_EXPORT_FORMAT,
      schemaVersion: PROFILE_EXPORT_SCHEMA_VERSION,
      exportedAt: this.clock().toISOString(),
      profile,
      questionHistory,
      runHistory,
      setProgress,
      activeSave:
        includeActiveSave && active?.owner.type === 'profile' && active.owner.profileId === profileId
          ? active
          : null
    };
  }

  async exportJson(profileId: string, includeActiveSave = false, space = 2): Promise<string> {
    return JSON.stringify(await this.export(profileId, includeActiveSave), null, space);
  }

  preview(input: unknown): ProfileExportPreview {
    const source = validateProfileExport(input);
    return {
      displayName: source.profile.displayName,
      runCount: source.runHistory.length,
      questionHistoryCount: source.questionHistory.length,
      setProgressCount: source.setProgress.length,
      hasActiveSave: Boolean(source.activeSave)
    };
  }

  async import(input: unknown, options: ImportProfileOptions = {}): Promise<ImportProfileResult> {
    const source = validateProfileExport(input);
    const displayName = normalizeName(options.displayName ?? source.profile.displayName);
    const transaction = this.database.transaction(
      ['profiles', 'questionHistory', 'runHistory', 'setProgress', 'activeSave', 'metadata'],
      'readwrite'
    );
    const profileStore = transaction.objectStore('profiles');
    if ((await profileStore.count()) >= MAX_NAMED_PROFILES) {
      throw new ProfileLimitError(`Only ${MAX_NAMED_PROFILES} named profiles are supported.`);
    }

    let profileId = '';
    for (let attempt = 0; attempt < 5 && !profileId; attempt += 1) {
      const candidate = this.idFactory();
      if (candidate && !(await profileStore.get(candidate))) profileId = candidate;
    }
    if (!profileId) {
      throw new BackupValidationError('Could not allocate a unique profile ID for import.');
    }

    const activeStore = transaction.objectStore('activeSave');
    const currentActive = await activeStore.get('active');
    const activePolicy = options.activeSavePolicy ?? 'reject';
    const shouldImportActive = Boolean(source.activeSave) && activePolicy !== 'discard';
    if (shouldImportActive && currentActive) {
      if (activePolicy !== 'replace') {
        throw new ActiveSaveExistsError('A global active save already exists.');
      }
      const expected = options.expectedActiveSave;
      if (
        !expected ||
        expected.runId !== currentActive.runId ||
        expected.revision !== currentActive.revision
      ) {
        throw new ActiveSaveExpectationError(
          'The active save changed after profile-import confirmation.'
        );
      }
    } else if (shouldImportActive && options.expectedActiveSave) {
      throw new ActiveSaveExpectationError('The expected active save no longer exists.');
    }

    const now = this.clock();
    const timestamp = now.toISOString();
    const newOwner = { type: 'profile', profileId } as const;
    const newOwnerKey = ownerKey(newOwner);
    const runIds = new Map<string, string>();
    const remapRunId = (runId: string | null): string | null => {
      if (runId === null) return null;
      const existing = runIds.get(runId);
      if (existing) return existing;
      const mapped = `${profileId}:imported-run:${encodeURIComponent(runId)}`;
      runIds.set(runId, mapped);
      return mapped;
    };

    const profile: ProfileRecord = {
      ...source.profile,
      id: profileId,
      displayName,
      createdAt: timestamp,
      updatedAt: timestamp
    };
    const histories: QuestionHistoryRecord[] = source.questionHistory.map((history) => ({
      ...history,
      id: questionHistoryId(newOwnerKey, history.questionId),
      ownerKey: newOwnerKey,
      lastSeenRunId: remapRunId(history.lastSeenRunId),
      lastAnsweredRunId: remapRunId(history.lastAnsweredRunId),
      lastHintRunId: remapRunId(history.lastHintRunId),
      lastPhoneRunId: remapRunId(history.lastPhoneRunId)
    }));
    const runs: RunHistoryRecord[] = source.runHistory.map((run) => ({
      ...run,
      id: remapRunId(run.id) as string,
      owner: newOwner,
      ownerKey: newOwnerKey
    }));
    const progress: SetProgressRecord[] = source.setProgress.map((entry) => ({
      ...entry,
      id: setProgressId(newOwnerKey, entry.setId),
      ownerKey: newOwnerKey,
      lastRunId: remapRunId(entry.lastRunId) as string
    }));

    let importedActive: ActiveSaveRecord | undefined;
    if (source.activeSave && shouldImportActive) {
      const metadata = transaction.objectStore('metadata');
      const sequence = await metadata.get('activeSaveRevision');
      const currentRevision =
        sequence && typeof sequence.value === 'number' ? sequence.value : 0;
      const revision = Math.max(
        currentRevision,
        currentActive?.revision ?? 0,
        source.activeSave.revision
      ) + 1;
      await metadata.put({ key: 'activeSaveRevision', value: revision });
      importedActive = {
        ...source.activeSave,
        runId: remapRunId(source.activeSave.runId) as string,
        owner: newOwner,
        ownerKey: newOwnerKey,
        revision,
        controller: {
          id: 'imported-unclaimed',
          epoch: Math.max(currentActive?.controller.epoch ?? 0, source.activeSave.controller.epoch) + 1,
          claimedAt: timestamp,
          heartbeatAt: timestamp,
          leaseExpiresAt: new Date(0).toISOString()
        },
        updatedAt: timestamp
      };
    }

    await profileStore.add(profile);
    const historyStore = transaction.objectStore('questionHistory');
    for (const history of histories) await historyStore.add(history);
    const runStore = transaction.objectStore('runHistory');
    for (const run of runs) await runStore.add(run);
    const progressStore = transaction.objectStore('setProgress');
    for (const entry of progress) await progressStore.add(entry);
    if (importedActive) await activeStore.put(importedActive);
    await transaction.done;

    return {
      ...profile,
      profile,
      questionHistoryCount: histories.length,
      runHistoryCount: runs.length,
      setProgressCount: progress.length,
      activeSaveImported: Boolean(importedActive)
    };
  }
}
