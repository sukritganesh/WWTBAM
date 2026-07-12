import type { IDBPDatabase } from 'idb';

import { ownerKey, setProgressId } from './defaults';
import type { AppDatabase, SaveOwner, SetProgressRecord } from './types';

export class SetProgressRepository {
  constructor(private readonly database: IDBPDatabase<AppDatabase>) {}

  async get(owner: SaveOwner, setId: string): Promise<SetProgressRecord | undefined> {
    return this.database.get('setProgress', setProgressId(owner, setId));
  }

  async listForOwner(owner: SaveOwner): Promise<SetProgressRecord[]> {
    const records = await this.database.getAllFromIndex(
      'setProgress',
      'by-owner',
      ownerKey(owner)
    );
    return records.sort((left, right) => right.lastPlayedAt.localeCompare(left.lastPlayedAt));
  }

  async listForSet(setId: string): Promise<SetProgressRecord[]> {
    return this.database.getAllFromIndex('setProgress', 'by-set', setId);
  }
}
