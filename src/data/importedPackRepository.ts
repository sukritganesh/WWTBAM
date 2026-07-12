import type { IDBPDatabase } from 'idb';

import { systemClock, type Clock } from './defaults';
import {
  PackConflictError,
  PackInUseError,
  RecordNotFoundError
} from './errors';
import type {
  AppDatabase,
  ImportedPackBundle,
  ImportedPackRecord,
  ImportedQuestionRecord,
  ImportedSetRecord
} from './types';

export interface InstallPackOptions {
  allowSameVersionReplacement?: boolean;
  allowDowngrade?: boolean;
}

export type InstallPackStatus = 'installed' | 'updated' | 'already-installed';

export interface InstallPackResult {
  status: InstallPackStatus;
  pack: ImportedPackRecord;
}

export interface RemovePackOptions {
  allowActiveSaveReference?: boolean;
}

function compareVersions(left: string, right: string): number {
  const tokenize = (value: string): Array<number | string> =>
    value
      .split(/[.-]/u)
      .filter(Boolean)
      .map((part) => (/^\d+$/u.test(part) ? Number(part) : part));
  const leftParts = tokenize(left);
  const rightParts = tokenize(right);
  const length = Math.max(leftParts.length, rightParts.length);
  for (let index = 0; index < length; index += 1) {
    const l = leftParts[index] ?? 0;
    const r = rightParts[index] ?? 0;
    if (l === r) continue;
    if (typeof l === 'number' && typeof r === 'number') return l < r ? -1 : 1;
    return String(l).localeCompare(String(r));
  }
  return 0;
}

function assertBundle(bundle: ImportedPackBundle): void {
  const { pack, questions, sets } = bundle;
  if (!pack.id.trim()) throw new TypeError('Pack ID must not be empty.');
  if (pack.id.startsWith('builtin')) {
    throw new TypeError('The built-in namespace is reserved.');
  }
  if (!pack.contentHash.trim()) throw new TypeError('Pack content hash must not be empty.');
  if (!pack.title.trim()) throw new TypeError('Pack title must not be empty.');
  const prefix = `${pack.id}:`;
  const questionIds = new Set<string>();
  for (const question of questions) {
    if (
      question.packId !== pack.id ||
      !question.id.startsWith(prefix) ||
      !question.localId ||
      questionIds.has(question.id)
    ) {
      throw new TypeError('Imported question IDs must be unique and namespaced by pack ID.');
    }
    if (!Number.isInteger(question.level) || question.level < 1 || question.level > 15) {
      throw new TypeError('Imported question levels must be between 1 and 15.');
    }
    questionIds.add(question.id);
  }
  const setIds = new Set<string>();
  for (const set of sets) {
    if (
      set.packId !== pack.id ||
      !set.id.startsWith(prefix) ||
      !set.localId ||
      setIds.has(set.id)
    ) {
      throw new TypeError('Imported set IDs must be unique and namespaced by pack ID.');
    }
    if (set.questionIds.length !== 15 || new Set(set.questionIds).size !== 15) {
      throw new TypeError('Imported curated sets must reference exactly 15 unique questions.');
    }
    if (set.questionIds.some((id) => !questionIds.has(id))) {
      throw new TypeError('Imported curated sets contain a broken question reference.');
    }
    setIds.add(set.id);
  }
}

async function deleteByPack(
  store: {
    index(name: 'by-pack'): {
      openCursor(query: string): Promise<
        | {
            delete(): Promise<void>;
            continue(): Promise<unknown>;
          }
        | null
      >;
    };
  },
  packId: string
): Promise<void> {
  let cursor = await store.index('by-pack').openCursor(packId);
  while (cursor) {
    await cursor.delete();
    cursor = (await cursor.continue()) as typeof cursor;
  }
}

export class ImportedPackRepository {
  constructor(
    private readonly database: IDBPDatabase<AppDatabase>,
    private readonly clock: Clock = systemClock
  ) {}

  async get(id: string): Promise<ImportedPackRecord | undefined> {
    return this.database.get('importedPacks', id);
  }

  async list(options: { enabledOnly?: boolean } = {}): Promise<ImportedPackRecord[]> {
    const records = options.enabledOnly
      ? await this.database.getAllFromIndex('importedPacks', 'by-enabled', 1)
      : await this.database.getAll('importedPacks');
    return records.sort((left, right) => left.title.localeCompare(right.title));
  }

  async getQuestions(packId: string): Promise<ImportedQuestionRecord[]> {
    return this.database.getAllFromIndex('importedQuestions', 'by-pack', packId);
  }

  async getSets(packId: string): Promise<ImportedSetRecord[]> {
    return this.database.getAllFromIndex('importedSets', 'by-pack', packId);
  }

  async install(
    bundle: ImportedPackBundle,
    options: InstallPackOptions = {}
  ): Promise<InstallPackResult> {
    assertBundle(bundle);
    const transaction = this.database.transaction(
      ['importedPacks', 'importedQuestions', 'importedSets'],
      'readwrite'
    );
    const packStore = transaction.objectStore('importedPacks');
    const existing = await packStore.get(bundle.pack.id);
    if (existing?.version === bundle.pack.version && existing.contentHash === bundle.pack.contentHash) {
      await transaction.done;
      return { status: 'already-installed', pack: existing };
    }
    if (
      existing?.version === bundle.pack.version &&
      existing.contentHash !== bundle.pack.contentHash &&
      !options.allowSameVersionReplacement
    ) {
      throw new PackConflictError('The same pack version is already installed with different content.');
    }
    if (
      existing &&
      compareVersions(bundle.pack.version, existing.version) < 0 &&
      !options.allowDowngrade
    ) {
      throw new PackConflictError('Pack downgrades require explicit confirmation.');
    }

    if (existing) {
      await deleteByPack(transaction.objectStore('importedQuestions'), bundle.pack.id);
      await deleteByPack(transaction.objectStore('importedSets'), bundle.pack.id);
    }

    const timestamp = this.clock().toISOString();
    const enabled = existing?.enabled ?? bundle.pack.enabled;
    const pack: ImportedPackRecord = {
      ...bundle.pack,
      enabled,
      enabledKey: enabled ? 1 : 0,
      questionCount: bundle.questions.length,
      setCount: bundle.sets.length,
      installedAt: existing?.installedAt ?? timestamp,
      updatedAt: timestamp
    };
    await packStore.put(pack);
    const questionStore = transaction.objectStore('importedQuestions');
    for (const question of bundle.questions) await questionStore.add(question);
    const setStore = transaction.objectStore('importedSets');
    for (const set of bundle.sets) await setStore.add(set);
    await transaction.done;
    return { status: existing ? 'updated' : 'installed', pack };
  }

  async setEnabled(id: string, enabled: boolean): Promise<ImportedPackRecord> {
    const transaction = this.database.transaction('importedPacks', 'readwrite');
    const existing = await transaction.store.get(id);
    if (!existing) throw new RecordNotFoundError('Imported pack not found.');
    const updated: ImportedPackRecord = {
      ...existing,
      enabled,
      enabledKey: enabled ? 1 : 0,
      updatedAt: this.clock().toISOString()
    };
    await transaction.store.put(updated);
    await transaction.done;
    return updated;
  }

  async remove(id: string, options: RemovePackOptions = {}): Promise<boolean> {
    const transaction = this.database.transaction(
      ['importedPacks', 'importedQuestions', 'importedSets', 'activeSave'],
      'readwrite'
    );
    const packStore = transaction.objectStore('importedPacks');
    const existing = await packStore.get(id);
    if (!existing) {
      await transaction.done;
      return false;
    }
    const active = await transaction.objectStore('activeSave').get('active');
    if (active?.packIds.includes(id) && !options.allowActiveSaveReference) {
      throw new PackInUseError('The active save references this pack.');
    }
    await deleteByPack(transaction.objectStore('importedQuestions'), id);
    await deleteByPack(transaction.objectStore('importedSets'), id);
    await packStore.delete(id);
    await transaction.done;
    return true;
  }
}
