import type { IDBPDatabase } from 'idb';

import { ActiveSaveRepository } from './activeSaveRepository';
import { BackupService } from './backupService';
import { openAppDatabase, type OpenAppDatabaseOptions } from './database';
import { systemClock, systemIdFactory, type Clock, type IdFactory } from './defaults';
import { ImportedPackRepository } from './importedPackRepository';
import { ProfileRepository } from './profileRepository';
import { ProfileTransferService } from './profileTransferService';
import { QuestionHistoryRepository } from './questionHistoryRepository';
import { RunHistoryRepository } from './runHistoryRepository';
import { SetProgressRepository } from './setProgressRepository';
import { SettingsRepository } from './settingsRepository';
import type { AppDatabase } from './types';

export interface RepositoryOptions {
  clock?: Clock;
  idFactory?: IdFactory;
}

export class DataRepositories {
  readonly profiles: ProfileRepository;
  readonly profileTransfer: ProfileTransferService;
  readonly settings: SettingsRepository;
  readonly questionHistory: QuestionHistoryRepository;
  readonly runHistory: RunHistoryRepository;
  readonly importedPacks: ImportedPackRepository;
  readonly activeSave: ActiveSaveRepository;
  readonly setProgress: SetProgressRepository;
  readonly backup: BackupService;

  constructor(
    readonly database: IDBPDatabase<AppDatabase>,
    options: RepositoryOptions = {}
  ) {
    const clock = options.clock ?? systemClock;
    this.profiles = new ProfileRepository(
      database,
      clock,
      options.idFactory ?? systemIdFactory
    );
    this.profileTransfer = new ProfileTransferService(
      database,
      clock,
      options.idFactory ?? systemIdFactory
    );
    this.settings = new SettingsRepository(database, clock);
    this.questionHistory = new QuestionHistoryRepository(database, clock);
    this.runHistory = new RunHistoryRepository(database, clock);
    this.importedPacks = new ImportedPackRepository(database, clock);
    this.activeSave = new ActiveSaveRepository(database, clock);
    this.setProgress = new SetProgressRepository(database);
    this.backup = new BackupService(database, clock);
  }

  close(): void {
    this.database.close();
  }
}

export async function createDataRepositories(
  databaseOptions: OpenAppDatabaseOptions = {},
  repositoryOptions: RepositoryOptions = {}
): Promise<DataRepositories> {
  const database = await openAppDatabase(databaseOptions);
  return new DataRepositories(database, repositoryOptions);
}

export * from './activeSaveRepository';
export * from './backupService';
export * from './database';
export * from './defaults';
export * from './errors';
export * from './importedPackRepository';
export * from './profileRepository';
export * from './profileTransferService';
export * from './questionHistoryRepository';
export * from './runHistoryRepository';
export * from './setProgressRepository';
export * from './settingsRepository';
export * from './types';
