import type { IDBPDatabase } from 'idb';

import {
  ACTIVE_SAVE_SCHEMA_VERSION,
  assertValidResolvedQuestions,
  DEFAULT_CONTROLLER_LEASE_MS,
  ownerKey,
  sameOwner,
  systemClock,
  type Clock
} from './defaults';
import {
  ActiveSaveExpectationError,
  ActiveSaveExistsError,
  ControllerConflictError,
  RecordNotFoundError,
  SaveOwnerMismatchError,
  StaleSaveRevisionError
} from './errors';
import type {
  ActiveSaveInput,
  ActiveSaveRecord,
  AppDatabase,
  JsonValue,
  SaveOwner
} from './types';

interface MetadataStoreAccess {
  get(key: string): Promise<{ key: string; value: JsonValue } | undefined>;
  put(value: { key: string; value: JsonValue }): Promise<unknown>;
}

export interface ActiveSaveExpectation {
  runId: string;
  revision: number;
}

export interface ActiveSaveMutation<TSnapshot extends JsonValue = JsonValue> {
  runId: string;
  expectedRevision: number;
  controllerId: string;
  controllerEpoch: number;
  patch: Partial<
    Pick<
      ActiveSaveRecord<TSnapshot>,
      'status' | 'packIds' | 'resolvedQuestions' | 'snapshot'
    >
  >;
  leaseMs?: number;
}

export interface ControllerRequest {
  runId: string;
  expectedRevision: number;
  expectedControllerEpoch: number;
  controllerId: string;
  leaseMs?: number;
  force?: boolean;
}

export interface ActiveSaveGuard {
  runId: string;
  expectedRevision: number;
  controllerId: string;
  controllerEpoch: number;
}

function assertNonempty(value: string, label: string): void {
  if (!value.trim()) throw new TypeError(`${label} must not be empty.`);
}

function assertExpectation(
  current: ActiveSaveRecord | undefined,
  expected: ActiveSaveExpectation | null
): void {
  if (!current && expected !== null) {
    throw new ActiveSaveExpectationError('The expected active save no longer exists.');
  }
  if (current && expected === null) {
    throw new ActiveSaveExistsError('An active save already exists.');
  }
  if (
    current &&
    expected &&
    (current.runId !== expected.runId || current.revision !== expected.revision)
  ) {
    throw new ActiveSaveExpectationError('The active save changed after confirmation.');
  }
}

function assertController(save: ActiveSaveRecord, guard: ActiveSaveGuard): void {
  if (save.runId !== guard.runId) {
    throw new ActiveSaveExpectationError('The requested run is no longer active.');
  }
  if (save.revision !== guard.expectedRevision) {
    throw new StaleSaveRevisionError(
      `Expected save revision ${guard.expectedRevision}, found ${save.revision}.`
    );
  }
  if (
    save.controller.id !== guard.controllerId ||
    save.controller.epoch !== guard.controllerEpoch
  ) {
    throw new ControllerConflictError('This tab no longer controls the active run.');
  }
}

async function nextRevision(metadata: MetadataStoreAccess): Promise<number> {
  const current = await metadata.get('activeSaveRevision');
  const value = current && typeof current.value === 'number' ? current.value : 0;
  const revision = value + 1;
  await metadata.put({ key: 'activeSaveRevision', value: revision });
  return revision;
}

export class ActiveSaveRepository {
  constructor(
    private readonly database: IDBPDatabase<AppDatabase>,
    private readonly clock: Clock = systemClock
  ) {}

  async get<TSnapshot extends JsonValue = JsonValue>(): Promise<
    ActiveSaveRecord<TSnapshot> | undefined
  > {
    return (await this.database.get('activeSave', 'active')) as
      | ActiveSaveRecord<TSnapshot>
      | undefined;
  }

  async getForOwner<TSnapshot extends JsonValue = JsonValue>(
    owner: SaveOwner
  ): Promise<ActiveSaveRecord<TSnapshot> | undefined> {
    const save = await this.get<TSnapshot>();
    if (!save) return undefined;
    if (!sameOwner(save.owner, owner)) {
      throw new SaveOwnerMismatchError('The active save belongs to another player.');
    }
    return save;
  }

  async create<TSnapshot extends JsonValue>(
    input: ActiveSaveInput<TSnapshot>,
    leaseMs = DEFAULT_CONTROLLER_LEASE_MS
  ): Promise<ActiveSaveRecord<TSnapshot>> {
    return this.replace(input, null, leaseMs);
  }

  async replace<TSnapshot extends JsonValue>(
    input: ActiveSaveInput<TSnapshot>,
    expected: ActiveSaveExpectation | null,
    leaseMs = DEFAULT_CONTROLLER_LEASE_MS
  ): Promise<ActiveSaveRecord<TSnapshot>> {
    assertNonempty(input.runId, 'Run ID');
    assertNonempty(input.controllerId, 'Controller ID');
    assertValidResolvedQuestions(input.resolvedQuestions);
    if (!Number.isFinite(leaseMs) || leaseMs <= 0) {
      throw new TypeError('Controller lease duration must be positive.');
    }

    const transaction = this.database.transaction(
      ['activeSave', 'metadata', 'profiles'],
      'readwrite'
    );
    const activeStore = transaction.objectStore('activeSave');
    const current = await activeStore.get('active');
    assertExpectation(current, expected);

    if (input.owner.type === 'profile') {
      const profile = await transaction.objectStore('profiles').get(input.owner.profileId);
      if (!profile) {
        throw new RecordNotFoundError('The save owner profile does not exist.');
      }
    }

    const now = this.clock();
    const timestamp = now.toISOString();
    const revision = await nextRevision(transaction.objectStore('metadata'));
    const record: ActiveSaveRecord<TSnapshot> = {
      id: 'active',
      schemaVersion: ACTIVE_SAVE_SCHEMA_VERSION,
      runId: input.runId,
      owner: input.owner,
      ownerKey: ownerKey(input.owner),
      revision,
      controller: {
        id: input.controllerId,
        epoch: (current?.controller.epoch ?? 0) + 1,
        claimedAt: timestamp,
        heartbeatAt: timestamp,
        leaseExpiresAt: new Date(now.getTime() + leaseMs).toISOString()
      },
      status: input.status ?? 'active',
      packIds: [...new Set(input.packIds)],
      resolvedQuestions: input.resolvedQuestions,
      snapshot: input.snapshot,
      createdAt: timestamp,
      updatedAt: timestamp
    };
    await activeStore.put(record as ActiveSaveRecord);
    await transaction.done;
    return record;
  }

  async update<TSnapshot extends JsonValue>(
    mutation: ActiveSaveMutation<TSnapshot>
  ): Promise<ActiveSaveRecord<TSnapshot>> {
    const transaction = this.database.transaction(['activeSave', 'metadata'], 'readwrite');
    const activeStore = transaction.objectStore('activeSave');
    const current = await activeStore.get('active');
    if (!current) throw new RecordNotFoundError('No active save exists.');
    assertController(current, {
      runId: mutation.runId,
      expectedRevision: mutation.expectedRevision,
      controllerId: mutation.controllerId,
      controllerEpoch: mutation.controllerEpoch
    });

    if (mutation.patch.resolvedQuestions) {
      assertValidResolvedQuestions(mutation.patch.resolvedQuestions);
    }

    const now = this.clock();
    const timestamp = now.toISOString();
    const revision = await nextRevision(transaction.objectStore('metadata'));
    const leaseMs = mutation.leaseMs ?? DEFAULT_CONTROLLER_LEASE_MS;
    const updated: ActiveSaveRecord<TSnapshot> = {
      ...(current as ActiveSaveRecord<TSnapshot>),
      ...mutation.patch,
      id: 'active',
      runId: current.runId,
      owner: current.owner,
      ownerKey: current.ownerKey,
      revision,
      controller: {
        ...current.controller,
        heartbeatAt: timestamp,
        leaseExpiresAt: new Date(now.getTime() + leaseMs).toISOString()
      },
      updatedAt: timestamp
    };
    await activeStore.put(updated as ActiveSaveRecord);
    await transaction.done;
    return updated;
  }

  async heartbeat(request: ControllerRequest): Promise<ActiveSaveRecord> {
    const transaction = this.database.transaction('activeSave', 'readwrite');
    const store = transaction.store;
    const current = await store.get('active');
    if (!current) throw new RecordNotFoundError('No active save exists.');
    assertController(current, {
      runId: request.runId,
      expectedRevision: request.expectedRevision,
      controllerId: request.controllerId,
      controllerEpoch: request.expectedControllerEpoch
    });
    const now = this.clock();
    const leaseMs = request.leaseMs ?? DEFAULT_CONTROLLER_LEASE_MS;
    const updated: ActiveSaveRecord = {
      ...current,
      controller: {
        ...current.controller,
        heartbeatAt: now.toISOString(),
        leaseExpiresAt: new Date(now.getTime() + leaseMs).toISOString()
      }
    };
    await store.put(updated);
    await transaction.done;
    return updated;
  }

  async claimController(request: ControllerRequest): Promise<ActiveSaveRecord> {
    assertNonempty(request.controllerId, 'Controller ID');
    const transaction = this.database.transaction('activeSave', 'readwrite');
    const store = transaction.store;
    const current = await store.get('active');
    if (!current) throw new RecordNotFoundError('No active save exists.');
    if (current.runId !== request.runId || current.revision !== request.expectedRevision) {
      throw new StaleSaveRevisionError('The active save changed before control was claimed.');
    }
    if (current.controller.epoch !== request.expectedControllerEpoch) {
      throw new ControllerConflictError('Another controller claim won the race.');
    }

    const now = this.clock();
    const sameController = current.controller.id === request.controllerId;
    const leaseExpired = Date.parse(current.controller.leaseExpiresAt) <= now.getTime();
    if (!sameController && !leaseExpired && !request.force) {
      throw new ControllerConflictError('The active run is controlled by another live tab.');
    }

    const timestamp = now.toISOString();
    const leaseMs = request.leaseMs ?? DEFAULT_CONTROLLER_LEASE_MS;
    const updated: ActiveSaveRecord = {
      ...current,
      controller: {
        id: request.controllerId,
        epoch: sameController ? current.controller.epoch : current.controller.epoch + 1,
        claimedAt: sameController ? current.controller.claimedAt : timestamp,
        heartbeatAt: timestamp,
        leaseExpiresAt: new Date(now.getTime() + leaseMs).toISOString()
      }
    };
    await store.put(updated);
    await transaction.done;
    return updated;
  }

  async clear(guard: ActiveSaveGuard): Promise<void> {
    const transaction = this.database.transaction(['activeSave', 'metadata'], 'readwrite');
    const store = transaction.objectStore('activeSave');
    const current = await store.get('active');
    if (!current) throw new RecordNotFoundError('No active save exists.');
    assertController(current, guard);
    await nextRevision(transaction.objectStore('metadata'));
    await store.delete('active');
    await transaction.done;
  }
}
