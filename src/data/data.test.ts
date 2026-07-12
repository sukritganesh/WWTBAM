import { openDB } from 'idb';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  ActiveSaveExpectationError,
  ActiveSaveExistsError,
  BackupValidationError,
  ControllerConflictError,
  DataRepositories,
  PackConflictError,
  PackInUseError,
  ProfileLimitError,
  ProfileOwnsActiveSaveError,
  RecordNotFoundError,
  RunCommitConflictError,
  SaveOwnerMismatchError,
  StaleSaveRevisionError,
  UnsupportedBackupVersionError,
  deleteAppDatabase,
  emptyProfileStatistics,
  openAppDatabase,
  type AppBackupV1,
  type ImportedPackBundle,
  type JsonObject,
  type SavedQuestionSnapshot,
  type TerminalRunCommit
} from './index';

function resolvedQuestions(prefix = 'question'): SavedQuestionSnapshot[] {
  return Array.from({ length: 15 }, (_, index) => ({
    id: `${prefix}-${index + 1}`,
    level: index + 1,
    answerOrder: ['a', 'b', 'c', 'd'],
    prompt: `Question ${index + 1}`,
    choices: ['A', 'B', 'C', 'D']
  }));
}

function activeInput(
  owner: { type: 'guest' } | { type: 'profile'; profileId: string },
  overrides: Partial<{
    runId: string;
    controllerId: string;
    packIds: string[];
  }> = {}
) {
  return {
    runId: overrides.runId ?? 'run-active',
    owner,
    controllerId: overrides.controllerId ?? 'tab-a',
    packIds: overrides.packIds ?? [],
    resolvedQuestions: resolvedQuestions(),
    snapshot: {
      state: 'QUESTION_READY',
      questionIndex: 1,
      selectedAnswer: null
    } satisfies JsonObject
  };
}

function terminalRun(profileId: string, runId = 'run-finished'): TerminalRunCommit {
  return {
    runId,
    owner: { type: 'profile', profileId },
    mode: 'curated-set',
    setId: 'set-001',
    sourcePackIds: ['pack-001'],
    startedAt: '2026-07-11T10:00:00.000Z',
    completedAt: '2026-07-11T10:15:00.000Z',
    outcome: 'millionaire',
    payout: 1_000_000,
    guaranteedWinnings: 32_000,
    highestQuestion: 15,
    durationMs: 900_000,
    lifelinesUsed: { hint: true, phone: false },
    questionResults: resolvedQuestions().map((question) => ({
      questionId: question.id,
      level: question.level,
      correct: true,
      hintUsed: question.level === 8,
      phoneUsed: question.level === 9,
      selectedChoiceId: 'a',
      correctChoiceId: 'a'
    })),
    resolvedQuestions: resolvedQuestions()
  };
}

function importedPack(hash = 'hash-1', version = '1.0.0'): ImportedPackBundle {
  const packId = 'community-pack';
  const questions = Array.from({ length: 15 }, (_, index) => ({
    id: `${packId}:q-${index + 1}`,
    packId,
    localId: `q-${index + 1}`,
    level: index + 1,
    payload: {
      id: `q-${index + 1}`,
      prompt: `Imported question ${index + 1}`
    }
  }));
  return {
    pack: {
      id: packId,
      schemaVersion: '1.0.0',
      version,
      title: 'Community Pack',
      description: 'A deterministic test pack.',
      language: 'en-US',
      contentType: 'combined',
      categories: ['Science'],
      enabled: true,
      contentHash: hash,
      metadata: {}
    },
    questions,
    sets: [
      {
        id: `${packId}:set-1`,
        packId,
        localId: 'set-1',
        questionIds: questions.map((question) => question.id),
        payload: { id: 'set-1', title: 'Test Set' }
      }
    ]
  };
}

describe('IndexedDB persistence subsystem', () => {
  let databaseName: string;
  let repositories: DataRepositories;
  let nowMs: number;
  let idCounter: number;

  beforeEach(async () => {
    databaseName = `one-million-test-${crypto.randomUUID()}`;
    nowMs = Date.parse('2026-07-11T12:00:00.000Z');
    idCounter = 0;
    repositories = new DataRepositories(await openAppDatabase({ name: databaseName }), {
      clock: () => new Date(nowMs),
      idFactory: () => `profile-${++idCounter}`
    });
  });

  afterEach(async () => {
    repositories.close();
    await deleteAppDatabase(databaseName);
  });

  it('persists typed profiles, clamped settings, and idempotent seen events', async () => {
    const first = await repositories.profiles.create(' Alex ');
    const second = await repositories.profiles.create('Alex');
    expect(first.displayName).toBe('Alex');
    expect(second.displayName).toBe('Alex');
    expect(first.id).not.toBe(second.id);
    expect(first.statistics).toEqual(emptyProfileStatistics());

    const settings = await repositories.settings.update({
      musicVolume: 4,
      effectsVolume: -2,
      speechRate: 3
    });
    expect(settings.musicVolume).toBe(1);
    expect(settings.effectsVolume).toBe(0);
    expect(settings.speechRate).toBe(2);

    const owner = { type: 'profile', profileId: first.id } as const;
    const firstSeen = await repositories.questionHistory.markSeen(owner, 'question-1', 'run-1');
    const refresh = await repositories.questionHistory.markSeen(owner, 'question-1', 'run-1');
    const laterRun = await repositories.questionHistory.markSeen(owner, 'question-1', 'run-2');
    expect(firstSeen.applied).toBe(true);
    expect(refresh.applied).toBe(false);
    expect(laterRun.record.seenCount).toBe(2);
  });

  it('keeps answer and lifeline history idempotent and rejects orphan profile history', async () => {
    const profile = await repositories.profiles.create('Historian');
    const owner = { type: 'profile', profileId: profile.id } as const;
    expect((await repositories.questionHistory.markAnswered(
      owner,
      'question-1',
      'run-1',
      true
    )).applied).toBe(true);
    expect((await repositories.questionHistory.markAnswered(
      owner,
      'question-1',
      'run-1',
      true
    )).applied).toBe(false);
    await repositories.questionHistory.markHintUsed(owner, 'question-1', 'run-1');
    await repositories.questionHistory.markHintUsed(owner, 'question-1', 'run-1');
    await repositories.questionHistory.markPhoneUsed(owner, 'question-1', 'run-1');
    await repositories.questionHistory.markPhoneUsed(owner, 'question-1', 'run-1');
    expect(await repositories.questionHistory.get(owner, 'question-1')).toMatchObject({
      answeredCount: 1,
      correctCount: 1,
      hintUseCount: 1,
      phoneUseCount: 1
    });
    await expect(
      repositories.questionHistory.markSeen(
        { type: 'profile', profileId: 'missing-profile' },
        'question-1',
        'run-1'
      )
    ).rejects.toBeInstanceOf(RecordNotFoundError);
  });

  it('rejects stale revisions and stale controllers while keeping revisions monotonic', async () => {
    const created = await repositories.activeSave.create(activeInput({ type: 'guest' }));
    expect(created.revision).toBe(1);
    expect(created.controller.epoch).toBe(1);

    const updated = await repositories.activeSave.update({
      runId: created.runId,
      expectedRevision: created.revision,
      controllerId: 'tab-a',
      controllerEpoch: 1,
      patch: { snapshot: { state: 'ANSWER_SELECTED', selectedAnswer: 'b' } }
    });
    expect(updated.revision).toBe(2);

    await expect(
      repositories.activeSave.update({
        runId: created.runId,
        expectedRevision: created.revision,
        controllerId: 'tab-a',
        controllerEpoch: 1,
        patch: { snapshot: { state: 'STALE' } }
      })
    ).rejects.toBeInstanceOf(StaleSaveRevisionError);

    await expect(
      repositories.activeSave.claimController({
        runId: created.runId,
        expectedRevision: updated.revision,
        expectedControllerEpoch: 1,
        controllerId: 'tab-b'
      })
    ).rejects.toBeInstanceOf(ControllerConflictError);

    nowMs += 20_000;
    const takeover = await repositories.activeSave.claimController({
      runId: created.runId,
      expectedRevision: updated.revision,
      expectedControllerEpoch: 1,
      controllerId: 'tab-b'
    });
    expect(takeover.controller.epoch).toBe(2);

    await expect(
      repositories.activeSave.update({
        runId: created.runId,
        expectedRevision: updated.revision,
        controllerId: 'tab-a',
        controllerEpoch: 1,
        patch: { snapshot: { state: 'STALE_CONTROLLER' } }
      })
    ).rejects.toBeInstanceOf(ControllerConflictError);

    const controlledUpdate = await repositories.activeSave.update({
      runId: created.runId,
      expectedRevision: updated.revision,
      controllerId: 'tab-b',
      controllerEpoch: 2,
      patch: { snapshot: { state: 'CORRECT_REVEAL' } }
    });
    expect(controlledUpdate.revision).toBe(3);
    await repositories.activeSave.clear({
      runId: created.runId,
      expectedRevision: controlledUpdate.revision,
      controllerId: 'tab-b',
      controllerEpoch: 2
    });
    const next = await repositories.activeSave.create(
      activeInput({ type: 'guest' }, { runId: 'run-next', controllerId: 'tab-c' })
    );
    expect(next.revision).toBe(5);
  });

  it('guards owner access, replacement confirmation, heartbeat, and forced takeover', async () => {
    const profile = await repositories.profiles.create('Save Owner');
    const created = await repositories.activeSave.create(
      activeInput({ type: 'profile', profileId: profile.id })
    );
    await expect(repositories.activeSave.getForOwner({ type: 'guest' })).rejects.toBeInstanceOf(
      SaveOwnerMismatchError
    );
    await expect(
      repositories.activeSave.create(
        activeInput({ type: 'guest' }, { runId: 'other-run' })
      )
    ).rejects.toBeInstanceOf(ActiveSaveExistsError);
    await expect(
      repositories.activeSave.replace(
        activeInput({ type: 'guest' }, { runId: 'replacement' }),
        { runId: created.runId, revision: created.revision + 1 }
      )
    ).rejects.toBeInstanceOf(ActiveSaveExpectationError);

    nowMs += 1_000;
    const heartbeat = await repositories.activeSave.heartbeat({
      runId: created.runId,
      expectedRevision: created.revision,
      expectedControllerEpoch: created.controller.epoch,
      controllerId: created.controller.id
    });
    expect(heartbeat.revision).toBe(created.revision);
    expect(heartbeat.controller.heartbeatAt).not.toBe(created.controller.heartbeatAt);
    const forced = await repositories.activeSave.claimController({
      runId: created.runId,
      expectedRevision: created.revision,
      expectedControllerEpoch: created.controller.epoch,
      controllerId: 'tab-forced',
      force: true
    });
    expect(forced.controller).toMatchObject({ id: 'tab-forced', epoch: 2 });
    await expect(
      repositories.activeSave.heartbeat({
        runId: created.runId,
        expectedRevision: created.revision,
        expectedControllerEpoch: created.controller.epoch,
        controllerId: created.controller.id
      })
    ).rejects.toBeInstanceOf(ControllerConflictError);
  });

  it('commits terminal results and aggregate statistics exactly once', async () => {
    const profile = await repositories.profiles.create('Winner');
    const commit = terminalRun(profile.id);
    const first = await repositories.runHistory.commitTerminal(commit);
    const retry = await repositories.runHistory.commitTerminal(commit);
    expect(first.applied).toBe(true);
    expect(retry.applied).toBe(false);
    await expect(
      repositories.runHistory.commitTerminal({ ...commit, durationMs: commit.durationMs + 1 })
    ).rejects.toBeInstanceOf(RunCommitConflictError);

    const updatedProfile = await repositories.profiles.get(profile.id);
    expect(updatedProfile?.statistics).toMatchObject({
      gamesPlayed: 1,
      correctAnswers: 15,
      incorrectAnswers: 0,
      millionaireWins: 1,
      highestQuestion: 15,
      highestPrize: 1_000_000,
      totalVirtualWinnings: 1_000_000
    });
    expect(updatedProfile?.statistics.lifelinesUsed.hint).toBe(1);
    expect(await repositories.database.count('runHistory')).toBe(1);
    expect((await repositories.questionHistory.get(
      { type: 'profile', profileId: profile.id },
      'question-8'
    ))?.hintUseCount).toBe(1);
    expect((await repositories.questionHistory.get(
      { type: 'profile', profileId: profile.id },
      'question-9'
    ))?.phoneUseCount).toBe(1);
    expect(first.record.questionResults[8]).toMatchObject({
      selectedChoiceId: 'a',
      correctChoiceId: 'a',
      phoneUsed: true
    });
    const progress = await repositories.setProgress.get(
      { type: 'profile', profileId: profile.id },
      'set-001'
    );
    expect(progress).toMatchObject({ attempts: 1, wins: 1, bestPrize: 1_000_000 });
    expect(await repositories.setProgress.listForOwner({
      type: 'profile',
      profileId: profile.id
    })).toHaveLength(1);

    await repositories.settings.get();
    const legacyBackup = structuredClone(await repositories.backup.export());
    delete (legacyBackup.stores.settings[0] as unknown as Record<string, unknown>).autoAdvance;
    for (const history of legacyBackup.stores.questionHistory) {
      delete (history as unknown as Record<string, unknown>).phoneUseCount;
      delete (history as unknown as Record<string, unknown>).lastPhoneRunId;
    }
    for (const result of legacyBackup.stores.runHistory[0].questionResults) {
      delete (result as unknown as Record<string, unknown>).selectedChoiceId;
      delete (result as unknown as Record<string, unknown>).correctChoiceId;
      delete (result as unknown as Record<string, unknown>).phoneUsed;
    }
    await repositories.backup.restore(legacyBackup);
    expect((await repositories.settings.get()).autoAdvance).toBe(false);
    expect((await repositories.runHistory.get(commit.runId))?.questionResults[0]).toMatchObject({
      selectedChoiceId: null,
      correctChoiceId: null,
      phoneUsed: false
    });
    expect((await repositories.questionHistory.get(
      { type: 'profile', profileId: profile.id },
      'question-9'
    ))?.phoneUseCount).toBe(0);
  });

  it('atomically commits a terminal result and clears only the guarded active save', async () => {
    const profile = await repositories.profiles.create('Atomic Winner');
    const owner = { type: 'profile', profileId: profile.id } as const;
    const created = await repositories.activeSave.create(
      activeInput(owner, { runId: 'run-atomic' })
    );
    const newer = await repositories.activeSave.update({
      runId: created.runId,
      expectedRevision: created.revision,
      controllerId: created.controller.id,
      controllerEpoch: created.controller.epoch,
      patch: { snapshot: { state: 'RESULTS', payout: 1_000_000 } }
    });
    const terminal = terminalRun(profile.id, 'run-atomic');

    await expect(
      repositories.runHistory.commitTerminalAndClearSave(terminal, {
        runId: created.runId,
        expectedRevision: created.revision,
        controllerId: created.controller.id,
        controllerEpoch: created.controller.epoch
      })
    ).rejects.toBeInstanceOf(StaleSaveRevisionError);
    expect(await repositories.runHistory.get(terminal.runId)).toBeUndefined();
    expect((await repositories.profiles.get(profile.id))?.statistics.gamesPlayed).toBe(0);
    expect((await repositories.activeSave.get())?.revision).toBe(newer.revision);

    const committed = await repositories.runHistory.commitTerminalAndClearSave(terminal, {
      runId: newer.runId,
      expectedRevision: newer.revision,
      controllerId: newer.controller.id,
      controllerEpoch: newer.controller.epoch
    });
    expect(committed).toMatchObject({ applied: true, activeSaveCleared: true });
    expect(await repositories.activeSave.get()).toBeUndefined();
    expect((await repositories.profiles.get(profile.id))?.statistics.gamesPlayed).toBe(1);

    const retry = await repositories.runHistory.commitTerminalAndClearSave(terminal, {
      runId: newer.runId,
      expectedRevision: newer.revision,
      controllerId: newer.controller.id,
      controllerEpoch: newer.controller.epoch
    });
    expect(retry).toMatchObject({ applied: false, activeSaveCleared: false });
    expect((await repositories.profiles.get(profile.id))?.statistics.gamesPlayed).toBe(1);
  });

  it('installs imported packs atomically and protects packs referenced by a save', async () => {
    const bundle = importedPack();
    expect((await repositories.importedPacks.install(bundle)).status).toBe('installed');
    expect((await repositories.importedPacks.install(bundle)).status).toBe('already-installed');
    await expect(
      repositories.importedPacks.install(importedPack('changed-hash'))
    ).rejects.toBeInstanceOf(PackConflictError);
    expect(await repositories.importedPacks.getQuestions(bundle.pack.id)).toHaveLength(15);

    await repositories.importedPacks.setEnabled(bundle.pack.id, false);
    expect(await repositories.importedPacks.list({ enabledOnly: true })).toHaveLength(0);
    const upgraded = await repositories.importedPacks.install(
      importedPack('hash-2', '2.0.0')
    );
    expect(upgraded).toMatchObject({ status: 'updated', pack: { enabled: false } });
    expect(await repositories.importedPacks.getSets(bundle.pack.id)).toHaveLength(1);
    await expect(
      repositories.importedPacks.install(importedPack('hash-1', '1.0.0'))
    ).rejects.toBeInstanceOf(PackConflictError);
    expect((await repositories.importedPacks.install(
      importedPack('hash-1', '1.0.0'),
      { allowDowngrade: true }
    )).status).toBe('updated');
    await repositories.activeSave.create(
      activeInput({ type: 'guest' }, { packIds: [bundle.pack.id] })
    );
    await expect(repositories.importedPacks.remove(bundle.pack.id)).rejects.toBeInstanceOf(
      PackInUseError
    );
    expect(await repositories.importedPacks.get(bundle.pack.id)).toBeDefined();
    expect(
      await repositories.importedPacks.remove(bundle.pack.id, {
        allowActiveSaveReference: true
      })
    ).toBe(true);
    expect(await repositories.importedPacks.getQuestions(bundle.pack.id)).toHaveLength(0);
    expect(await repositories.activeSave.get()).toBeDefined();
    expect(await repositories.importedPacks.remove(bundle.pack.id)).toBe(false);
  });

  it('exports a consistent backup and validates fully before transactional replacement', async () => {
    const profile = await repositories.profiles.create('Backup Owner');
    await repositories.activeSave.create(
      activeInput({ type: 'profile', profileId: profile.id })
    );
    await repositories.importedPacks.install(importedPack());
    const backup = await repositories.backup.export();
    expect(repositories.backup.preview(backup)).toMatchObject({
      profiles: 1,
      importedPacks: 1,
      hasActiveSave: true
    });

    await repositories.profiles.rename(profile.id, 'Changed Locally');
    await repositories.backup.restore(JSON.stringify(backup));
    expect((await repositories.profiles.get(profile.id))?.displayName).toBe('Backup Owner');

    const invalid = structuredClone(backup) as AppBackupV1;
    invalid.stores.profiles.push(structuredClone(invalid.stores.profiles[0]));
    await expect(repositories.backup.restore(invalid)).rejects.toBeInstanceOf(
      BackupValidationError
    );
    expect((await repositories.profiles.get(profile.id))?.displayName).toBe('Backup Owner');
    expect(await repositories.activeSave.get()).toBeDefined();

    const missingQuestion = structuredClone(backup);
    missingQuestion.stores.activeSave[0].resolvedQuestions.pop();
    await expect(repositories.backup.restore(missingQuestion)).rejects.toBeInstanceOf(
      BackupValidationError
    );
    const future = structuredClone(backup);
    future.databaseVersion = 999;
    await expect(repositories.backup.restore(future)).rejects.toBeInstanceOf(
      UnsupportedBackupVersionError
    );
    await expect(
      repositories.backup.restore('{"__proto__":{"polluted":true}}')
    ).rejects.toBeInstanceOf(BackupValidationError);
    expect((await repositories.profiles.get(profile.id))?.displayName).toBe('Backup Owner');
  });

  it('round-trips a single profile under a new identity and rewrites all owned records', async () => {
    const profile = await repositories.profiles.create('Portable Player');
    const owner = { type: 'profile', profileId: profile.id } as const;
    await repositories.runHistory.commitTerminal(terminalRun(profile.id));
    const active = await repositories.activeSave.create(
      activeInput(owner, { runId: 'unfinished-run' })
    );
    await repositories.questionHistory.markSeen(owner, 'question-1', active.runId);
    const exported = await repositories.profileTransfer.export(profile.id, {
      includeOwnedSave: true
    });
    expect(repositories.profileTransfer.preview(exported)).toMatchObject({
      displayName: 'Portable Player',
      runCount: 1,
      questionHistoryCount: 15,
      hasActiveSave: true
    });

    await expect(repositories.profileTransfer.import(exported)).rejects.toThrow(
      'A global active save already exists.'
    );
    expect(await repositories.database.count('profiles')).toBe(1);
    await repositories.activeSave.clear({
      runId: active.runId,
      expectedRevision: active.revision,
      controllerId: active.controller.id,
      controllerEpoch: active.controller.epoch
    });

    const imported = await repositories.profileTransfer.import(JSON.stringify(exported));
    expect(imported).toMatchObject({
      questionHistoryCount: 15,
      runHistoryCount: 1,
      setProgressCount: 1,
      activeSaveImported: true
    });
    expect(imported.profile.id).not.toBe(profile.id);
    expect(imported.profile.statistics.gamesPlayed).toBe(1);
    const importedOwner = { type: 'profile', profileId: imported.profile.id } as const;
    const importedRuns = await repositories.runHistory.listForOwner(importedOwner);
    expect(importedRuns).toHaveLength(1);
    expect(importedRuns[0].id).toContain(`${imported.profile.id}:imported-run:`);
    expect((await repositories.questionHistory.listForOwner(importedOwner))).toHaveLength(15);
    expect((await repositories.setProgress.listForOwner(importedOwner))).toHaveLength(1);
    const importedSave = await repositories.activeSave.get();
    expect(importedSave?.owner).toEqual(importedOwner);
    expect(importedSave?.runId).not.toBe(active.runId);
    expect(importedSave?.controller.id).toBe('imported-unclaimed');
    expect(importedSave?.revision).toBeGreaterThan(active.revision);
  });

  it('enforces the profile limit before a profile import writes any records', async () => {
    const source = await repositories.profiles.create('Export Source');
    const exported = await repositories.profileTransfer.export(source.id);
    for (let index = 1; index < 20; index += 1) {
      await repositories.profiles.create(`Player ${index}`);
    }
    await expect(repositories.profileTransfer.import(exported)).rejects.toBeInstanceOf(
      ProfileLimitError
    );
    expect(await repositories.database.count('profiles')).toBe(20);
    expect(await repositories.database.count('runHistory')).toBe(0);
  });

  it('requires explicit deletion of a profile-owned save and removes owned data together', async () => {
    const profile = await repositories.profiles.create('Departing Player');
    const owner = { type: 'profile', profileId: profile.id } as const;
    await repositories.activeSave.create(activeInput(owner));
    await repositories.questionHistory.markSeen(owner, 'question-1', 'run-active');
    await repositories.runHistory.commitTerminal(terminalRun(profile.id));

    await expect(repositories.profiles.delete(profile.id)).rejects.toBeInstanceOf(
      ProfileOwnsActiveSaveError
    );
    expect(await repositories.profiles.get(profile.id)).toBeDefined();
    expect(await repositories.activeSave.get()).toBeDefined();

    const result = await repositories.profiles.delete(profile.id, 'delete-save');
    expect(result).toMatchObject({
      deleted: true,
      activeSaveDeleted: true,
      runHistoryDeleted: 1,
      setProgressDeleted: 1
    });
    expect(result.questionHistoryDeleted).toBe(15);
    expect(await repositories.profiles.get(profile.id)).toBeUndefined();
    expect(await repositories.activeSave.get()).toBeUndefined();
  });
});

describe('database migrations', () => {
  it('migrates a version-one profile without deleting it', async () => {
    const name = `one-million-migration-${crypto.randomUUID()}`;
    const legacy = await openDB(name, 1, {
      upgrade(database) {
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
        const packs = database.createObjectStore('importedPacks', { keyPath: 'id' });
        packs.createIndex('by-title', 'title');
        const questions = database.createObjectStore('importedQuestions', { keyPath: 'id' });
        questions.createIndex('by-pack', 'packId');
        questions.createIndex('by-level', 'level');
        const sets = database.createObjectStore('importedSets', { keyPath: 'id' });
        sets.createIndex('by-pack', 'packId');
      }
    });
    await legacy.put('profiles', {
      id: 'legacy-profile',
      displayName: 'Legacy',
      createdAt: '2025-01-01T00:00:00.000Z'
    });
    await legacy.put('settings', {
      id: 'global',
      masterMuted: true,
      updatedAt: '2025-01-01T00:00:00.000Z'
    });
    legacy.close();

    const upgraded = await openAppDatabase({ name });
    const profile = await upgraded.get('profiles', 'legacy-profile');
    expect(profile).toMatchObject({
      displayName: 'Legacy',
      updatedAt: '2025-01-01T00:00:00.000Z',
      statistics: emptyProfileStatistics()
    });
    expect(await upgraded.get('settings', 'global')).toMatchObject({
      masterMuted: true,
      autoAdvance: false
    });
    expect(upgraded.objectStoreNames.contains('activeSave')).toBe(true);
    upgraded.close();
    await deleteAppDatabase(name);
  });
});
