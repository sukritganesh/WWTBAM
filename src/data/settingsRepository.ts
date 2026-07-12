import type { IDBPDatabase } from 'idb';

import { clampVolume, defaultSettings, systemClock, type Clock } from './defaults';
import type { AppDatabase, GlobalSettingsRecord } from './types';

type SettingsPatch = Partial<Omit<GlobalSettingsRecord, 'id' | 'updatedAt'>>;

function normalizeSettings(record: Partial<GlobalSettingsRecord>): GlobalSettingsRecord {
  const merged: GlobalSettingsRecord = {
    ...defaultSettings(record.updatedAt ?? new Date(0).toISOString()),
    ...record,
    id: 'global'
  };
  return {
    ...merged,
    musicVolume: clampVolume(merged.musicVolume),
    effectsVolume: clampVolume(merged.effectsVolume),
    narrationVolume: clampVolume(merged.narrationVolume),
    speechRate: Math.max(0.5, Math.min(2, merged.speechRate))
  };
}

export class SettingsRepository {
  constructor(
    private readonly database: IDBPDatabase<AppDatabase>,
    private readonly clock: Clock = systemClock
  ) {}

  async get(): Promise<GlobalSettingsRecord> {
    const existing = await this.database.get('settings', 'global');
    if (existing) return normalizeSettings(existing);
    const created = defaultSettings(this.clock().toISOString());
    await this.database.put('settings', created);
    return created;
  }

  async update(patch: SettingsPatch): Promise<GlobalSettingsRecord> {
    const transaction = this.database.transaction('settings', 'readwrite');
    const current = (await transaction.store.get('global')) ??
      defaultSettings(this.clock().toISOString());
    const updated = normalizeSettings({
      ...current,
      ...patch,
      id: 'global',
      updatedAt: this.clock().toISOString()
    });
    await transaction.store.put(updated);
    await transaction.done;
    return updated;
  }

  async reset(): Promise<GlobalSettingsRecord> {
    const settings = defaultSettings(this.clock().toISOString());
    await this.database.put('settings', settings);
    return settings;
  }
}
