export class PersistenceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class RecordNotFoundError extends PersistenceError {}
export class ProfileLimitError extends PersistenceError {}
export class ProfileOwnsActiveSaveError extends PersistenceError {}
export class ActiveSaveExistsError extends PersistenceError {}
export class ActiveSaveExpectationError extends PersistenceError {}
export class SaveOwnerMismatchError extends PersistenceError {}
export class StaleSaveRevisionError extends PersistenceError {}
export class ControllerConflictError extends PersistenceError {}
export class RunCommitConflictError extends PersistenceError {}
export class PackConflictError extends PersistenceError {}
export class PackInUseError extends PersistenceError {}
export class BackupValidationError extends PersistenceError {}
export class UnsupportedBackupVersionError extends BackupValidationError {}
