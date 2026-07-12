import type { IDBPDatabase } from 'idb';

import {
  emptyProfileStatistics,
  MAX_NAMED_PROFILES,
  MAX_PROFILE_NAME_LENGTH,
  ownerKey,
  systemClock,
  systemIdFactory,
  type Clock,
  type IdFactory
} from './defaults';
import {
  ProfileLimitError,
  ProfileOwnsActiveSaveError,
  RecordNotFoundError
} from './errors';
import type { AppDatabase, JsonValue, ProfileRecord } from './types';

export type OwnedSaveDeletionPolicy = 'reject' | 'delete-save';

export interface DeleteProfileResult {
  deleted: boolean;
  activeSaveDeleted: boolean;
  questionHistoryDeleted: number;
  runHistoryDeleted: number;
  setProgressDeleted: number;
}

function normalizeDisplayName(name: string): string {
  const normalized = name.trim();
  if (!normalized) throw new TypeError('Profile name must not be empty.');
  if (normalized.length > MAX_PROFILE_NAME_LENGTH) {
    throw new TypeError(`Profile names may contain at most ${MAX_PROFILE_NAME_LENGTH} characters.`);
  }
  return normalized;
}

async function deleteOwnerRecords(
  store: {
    index(name: 'by-owner'): {
      openCursor(query: string): Promise<
        | {
            delete(): Promise<void>;
            continue(): Promise<unknown>;
          }
        | null
      >;
    };
  },
  key: string
): Promise<number> {
  let count = 0;
  let cursor = await store.index('by-owner').openCursor(key);
  while (cursor) {
    await cursor.delete();
    count += 1;
    cursor = (await cursor.continue()) as typeof cursor;
  }
  return count;
}

export class ProfileRepository {
  constructor(
    private readonly database: IDBPDatabase<AppDatabase>,
    private readonly clock: Clock = systemClock,
    private readonly idFactory: IdFactory = systemIdFactory
  ) {}

  async create(displayName: string): Promise<ProfileRecord> {
    const transaction = this.database.transaction('profiles', 'readwrite');
    const count = await transaction.store.count();
    if (count >= MAX_NAMED_PROFILES) {
      throw new ProfileLimitError(`Only ${MAX_NAMED_PROFILES} named profiles are supported.`);
    }
    const timestamp = this.clock().toISOString();
    const record: ProfileRecord = {
      id: this.idFactory(),
      displayName: normalizeDisplayName(displayName),
      createdAt: timestamp,
      updatedAt: timestamp,
      lastPlayedAt: null,
      statistics: emptyProfileStatistics()
    };
    await transaction.store.add(record);
    await transaction.done;
    return record;
  }

  async get(id: string): Promise<ProfileRecord | undefined> {
    return this.database.get('profiles', id);
  }

  async list(): Promise<ProfileRecord[]> {
    const profiles = await this.database.getAllFromIndex('profiles', 'by-created-at');
    return profiles;
  }

  async rename(id: string, displayName: string): Promise<ProfileRecord> {
    const transaction = this.database.transaction('profiles', 'readwrite');
    const profile = await transaction.store.get(id);
    if (!profile) throw new RecordNotFoundError('Profile not found.');
    const updated: ProfileRecord = {
      ...profile,
      displayName: normalizeDisplayName(displayName),
      updatedAt: this.clock().toISOString()
    };
    await transaction.store.put(updated);
    await transaction.done;
    return updated;
  }

  async delete(
    id: string,
    policy: OwnedSaveDeletionPolicy = 'reject'
  ): Promise<DeleteProfileResult> {
    const transaction = this.database.transaction(
      [
        'profiles',
        'questionHistory',
        'runHistory',
        'setProgress',
        'activeSave',
        'metadata'
      ],
      'readwrite'
    );
    const profileStore = transaction.objectStore('profiles');
    const profile = await profileStore.get(id);
    if (!profile) {
      await transaction.done;
      return {
        deleted: false,
        activeSaveDeleted: false,
        questionHistoryDeleted: 0,
        runHistoryDeleted: 0,
        setProgressDeleted: 0
      };
    }

    const activeStore = transaction.objectStore('activeSave');
    const active = await activeStore.get('active');
    const ownsSave = active?.owner.type === 'profile' && active.owner.profileId === id;
    if (ownsSave && policy === 'reject') {
      throw new ProfileOwnsActiveSaveError(
        'This profile owns the active save; explicit save deletion is required.'
      );
    }

    let activeSaveDeleted = false;
    if (ownsSave) {
      const metadata = transaction.objectStore('metadata');
      const sequence = await metadata.get('activeSaveRevision');
      const current = sequence && typeof sequence.value === 'number' ? sequence.value : 0;
      await metadata.put({ key: 'activeSaveRevision', value: current + 1 } as {
        key: string;
        value: JsonValue;
      });
      await activeStore.delete('active');
      activeSaveDeleted = true;
    }

    const key = ownerKey({ type: 'profile', profileId: id });
    const questionHistoryDeleted = await deleteOwnerRecords(
      transaction.objectStore('questionHistory'),
      key
    );
    const runHistoryDeleted = await deleteOwnerRecords(
      transaction.objectStore('runHistory'),
      key
    );
    const setProgressDeleted = await deleteOwnerRecords(
      transaction.objectStore('setProgress'),
      key
    );
    await profileStore.delete(id);
    await transaction.done;
    return {
      deleted: true,
      activeSaveDeleted,
      questionHistoryDeleted,
      runHistoryDeleted,
      setProgressDeleted
    };
  }
}
