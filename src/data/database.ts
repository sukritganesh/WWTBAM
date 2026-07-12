import { deleteDB, openDB, type IDBPDatabase, type IDBPTransaction } from 'idb';

import { defaultSettings, emptyProfileStatistics } from './defaults';
import type {
  ActiveSaveRecord,
  AppDatabase,
  AppStoreName,
  GlobalSettingsRecord,
  ImportedPackRecord,
  ProfileRecord,
  QuestionHistoryRecord,
  RunHistoryRecord
} from './types';

export const APP_DATABASE_NAME = 'one-million-local';
export const APP_DATABASE_VERSION = 3;

const ALL_STORES = [
  'metadata',
  'settings',
  'profiles',
  'questionHistory',
  'runHistory',
  'setProgress',
  'activeSave',
  'importedPacks',
  'importedQuestions',
  'importedSets'
] as const satisfies readonly AppStoreName[];

type UpgradeTransaction = IDBPTransaction<
  AppDatabase,
  ArrayLike<AppStoreName>,
  'versionchange'
>;

export interface OpenAppDatabaseOptions {
  name?: string;
  blocked?: (currentVersion: number, blockedVersion: number | null) => void;
  blocking?: (currentVersion: number, blockedVersion: number | null) => void;
  terminated?: () => void;
}

function createVersionOneStores(database: IDBPDatabase<AppDatabase>): void {
  database.createObjectStore('metadata', { keyPath: 'key' });
  database.createObjectStore('settings', { keyPath: 'id' });

  const profiles = database.createObjectStore('profiles', { keyPath: 'id' });
  profiles.createIndex('by-created-at', 'createdAt');
  profiles.createIndex('by-display-name', 'displayName');

  const questionHistory = database.createObjectStore('questionHistory', { keyPath: 'id' });
  questionHistory.createIndex('by-owner', 'ownerKey');
  questionHistory.createIndex('by-question', 'questionId');

  const runHistory = database.createObjectStore('runHistory', { keyPath: 'id' });
  runHistory.createIndex('by-owner', 'ownerKey');
  runHistory.createIndex('by-completed-at', 'completedAt');

  const setProgress = database.createObjectStore('setProgress', { keyPath: 'id' });
  setProgress.createIndex('by-owner', 'ownerKey');

  database.createObjectStore('activeSave', { keyPath: 'id' });

  const importedPacks = database.createObjectStore('importedPacks', { keyPath: 'id' });
  importedPacks.createIndex('by-title', 'title');

  const importedQuestions = database.createObjectStore('importedQuestions', {
    keyPath: 'id'
  });
  importedQuestions.createIndex('by-pack', 'packId');
  importedQuestions.createIndex('by-level', 'level');

  const importedSets = database.createObjectStore('importedSets', { keyPath: 'id' });
  importedSets.createIndex('by-pack', 'packId');
}

async function migrateRecordsToVersionTwo(
  transaction: UpgradeTransaction
): Promise<void> {
  const profiles = transaction.objectStore('profiles');
  let profileCursor = await profiles.openCursor();
  while (profileCursor) {
    const legacy = profileCursor.value as Partial<ProfileRecord> & Pick<ProfileRecord, 'id' | 'displayName' | 'createdAt'>;
    const updated: ProfileRecord = {
      id: legacy.id,
      displayName: legacy.displayName,
      createdAt: legacy.createdAt,
      updatedAt: legacy.updatedAt ?? legacy.createdAt,
      lastPlayedAt: legacy.lastPlayedAt ?? null,
      statistics: {
        ...emptyProfileStatistics(),
        ...(legacy.statistics ?? {}),
        lifelinesUsed: {
          ...emptyProfileStatistics().lifelinesUsed,
          ...(legacy.statistics?.lifelinesUsed ?? {})
        }
      }
    };
    await profileCursor.update(updated);
    profileCursor = await profileCursor.continue();
  }

  const settings = transaction.objectStore('settings');
  const storedSettings = (await settings.get('global')) as Partial<GlobalSettingsRecord> | undefined;
  if (storedSettings) {
    const migrated = {
      ...defaultSettings(storedSettings.updatedAt ?? new Date(0).toISOString()),
      ...storedSettings,
      id: 'global'
    } as GlobalSettingsRecord;
    await settings.put(migrated);
  }

  const questionHistory = transaction.objectStore('questionHistory');
  let historyCursor = await questionHistory.openCursor();
  while (historyCursor) {
    const legacy = historyCursor.value as Partial<QuestionHistoryRecord> &
      Pick<QuestionHistoryRecord, 'id' | 'ownerKey' | 'questionId'>;
    const migrated: QuestionHistoryRecord = {
      id: legacy.id,
      ownerKey: legacy.ownerKey,
      questionId: legacy.questionId,
      seenCount: legacy.seenCount ?? 0,
      answeredCount: legacy.answeredCount ?? 0,
      correctCount: legacy.correctCount ?? 0,
      incorrectCount: legacy.incorrectCount ?? 0,
      hintUseCount: legacy.hintUseCount ?? 0,
      phoneUseCount: legacy.phoneUseCount ?? 0,
      firstSeenAt: legacy.firstSeenAt ?? null,
      lastSeenAt: legacy.lastSeenAt ?? null,
      lastAnsweredAt: legacy.lastAnsweredAt ?? null,
      lastSeenRunId: legacy.lastSeenRunId ?? null,
      lastAnsweredRunId: legacy.lastAnsweredRunId ?? null,
      lastHintRunId: legacy.lastHintRunId ?? null,
      lastPhoneRunId: legacy.lastPhoneRunId ?? null
    };
    await historyCursor.update(migrated);
    historyCursor = await historyCursor.continue();
  }

  const runs = transaction.objectStore('runHistory');
  let runCursor = await runs.openCursor();
  while (runCursor) {
    const legacy = runCursor.value as RunHistoryRecord & { committed?: boolean; committedKey?: 0 | 1 };
    if (legacy.committedKey !== (legacy.committed ? 1 : 0)) {
      await runCursor.update({
        ...legacy,
        committed: true,
        committedKey: 1
      } as RunHistoryRecord);
    }
    runCursor = await runCursor.continue();
  }

  const packs = transaction.objectStore('importedPacks');
  let packCursor = await packs.openCursor();
  while (packCursor) {
    const legacy = packCursor.value as ImportedPackRecord & {
      enabled?: boolean;
      enabledKey?: 0 | 1;
      updatedAt?: string;
    };
    const enabled = legacy.enabled ?? true;
    await packCursor.update({
      ...legacy,
      enabled,
      enabledKey: enabled ? 1 : 0,
      updatedAt: legacy.updatedAt ?? legacy.installedAt
    });
    packCursor = await packCursor.continue();
  }

  const activeSave = transaction.objectStore('activeSave');
  const active = (await activeSave.get('active')) as ActiveSaveRecord | undefined;
  const metadata = transaction.objectStore('metadata');
  const revisionRecord = await metadata.get('activeSaveRevision');
  const storedRevision =
    revisionRecord && typeof revisionRecord.value === 'number' ? revisionRecord.value : 0;
  const activeRevision = active?.revision ?? 0;
  if (storedRevision < activeRevision) {
    await metadata.put({ key: 'activeSaveRevision', value: activeRevision });
  }
}

async function migrateRecordsToVersionThree(
  transaction: UpgradeTransaction
): Promise<void> {
  const settings = transaction.objectStore('settings');
  const storedSettings = (await settings.get('global')) as Partial<GlobalSettingsRecord> | undefined;
  if (storedSettings) {
    await settings.put({
      ...defaultSettings(storedSettings.updatedAt ?? new Date(0).toISOString()),
      ...storedSettings,
      id: 'global',
      autoAdvance: storedSettings.autoAdvance ?? false
    });
  }

  const questionHistory = transaction.objectStore('questionHistory');
  let historyCursor = await questionHistory.openCursor();
  while (historyCursor) {
    const legacy = historyCursor.value as QuestionHistoryRecord & {
      phoneUseCount?: number;
      lastPhoneRunId?: string | null;
    };
    if (legacy.phoneUseCount === undefined || legacy.lastPhoneRunId === undefined) {
      await historyCursor.update({
        ...legacy,
        phoneUseCount: legacy.phoneUseCount ?? 0,
        lastPhoneRunId: legacy.lastPhoneRunId ?? null
      });
    }
    historyCursor = await historyCursor.continue();
  }

  const runs = transaction.objectStore('runHistory');
  let runCursor = await runs.openCursor();
  while (runCursor) {
    const run = runCursor.value;
    const resolvedById = new Map(run.resolvedQuestions.map((question) => [question.id, question]));
    const questionResults = run.questionResults.map((result) => {
      const resolved = resolvedById.get(result.questionId);
      return {
        ...result,
        selectedChoiceId: result.selectedChoiceId ?? null,
        correctChoiceId:
          result.correctChoiceId ??
          (typeof resolved?.correctChoiceId === 'string' ? resolved.correctChoiceId : null),
        phoneUsed: result.phoneUsed ?? false
      };
    });
    await runCursor.update({
      ...run,
      schemaVersion: Math.max(run.schemaVersion ?? 1, 2),
      questionResults
    });
    runCursor = await runCursor.continue();
  }
}

async function upgradeDatabase(
  database: IDBPDatabase<AppDatabase>,
  oldVersion: number,
  transaction: UpgradeTransaction
): Promise<void> {
  if (oldVersion < 1) {
    createVersionOneStores(database);
  }

  if (oldVersion < 2) {
    const profiles = transaction.objectStore('profiles');
    if (!profiles.indexNames.contains('by-updated-at')) {
      profiles.createIndex('by-updated-at', 'updatedAt');
    }

    const questionHistory = transaction.objectStore('questionHistory');
    if (!questionHistory.indexNames.contains('by-owner-question')) {
      questionHistory.createIndex('by-owner-question', ['ownerKey', 'questionId']);
    }
    if (!questionHistory.indexNames.contains('by-last-seen-at')) {
      questionHistory.createIndex('by-last-seen-at', 'lastSeenAt');
    }

    const runHistory = transaction.objectStore('runHistory');
    if (!runHistory.indexNames.contains('by-owner-completed-at')) {
      runHistory.createIndex('by-owner-completed-at', ['ownerKey', 'completedAt']);
    }
    if (!runHistory.indexNames.contains('by-committed')) {
      runHistory.createIndex('by-committed', 'committedKey');
    }

    const setProgress = transaction.objectStore('setProgress');
    if (!setProgress.indexNames.contains('by-set')) {
      setProgress.createIndex('by-set', 'setId');
    }
    if (!setProgress.indexNames.contains('by-owner-set')) {
      setProgress.createIndex('by-owner-set', ['ownerKey', 'setId']);
    }

    const importedPacks = transaction.objectStore('importedPacks');
    if (!importedPacks.indexNames.contains('by-enabled')) {
      importedPacks.createIndex('by-enabled', 'enabledKey');
    }
    if (!importedPacks.indexNames.contains('by-updated-at')) {
      importedPacks.createIndex('by-updated-at', 'updatedAt');
    }

    const importedQuestions = transaction.objectStore('importedQuestions');
    if (!importedQuestions.indexNames.contains('by-pack-level')) {
      importedQuestions.createIndex('by-pack-level', ['packId', 'level']);
    }

    await migrateRecordsToVersionTwo(transaction);
  }

  if (oldVersion < 3) {
    await migrateRecordsToVersionThree(transaction);
  }
}

export async function openAppDatabase(
  options: OpenAppDatabaseOptions = {}
): Promise<IDBPDatabase<AppDatabase>> {
  return openDB<AppDatabase>(options.name ?? APP_DATABASE_NAME, APP_DATABASE_VERSION, {
    upgrade: (database, oldVersion, _newVersion, transaction) =>
      upgradeDatabase(database, oldVersion, transaction),
    blocked: options.blocked,
    blocking: options.blocking,
    terminated: options.terminated
  });
}

export async function deleteAppDatabase(name = APP_DATABASE_NAME): Promise<void> {
  await deleteDB(name);
}

export { ALL_STORES };
