import type { DBSchema } from 'idb';

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
export interface JsonObject {
  [key: string]: JsonValue;
}

export type SaveOwner =
  | { type: 'guest' }
  | { type: 'profile'; profileId: string };

export interface ProfileStatistics {
  gamesPlayed: number;
  correctAnswers: number;
  incorrectAnswers: number;
  walkAways: number;
  millionaireWins: number;
  highestQuestion: number;
  highestPrize: number;
  totalVirtualWinnings: number;
  totalDurationMs: number;
  lifelinesUsed: {
    hint: number;
    phone: number;
  };
}

export interface ProfileRecord {
  id: string;
  displayName: string;
  createdAt: string;
  updatedAt: string;
  lastPlayedAt: string | null;
  statistics: ProfileStatistics;
}

export interface GlobalSettingsRecord {
  id: 'global';
  masterMuted: boolean;
  musicEnabled: boolean;
  musicVolume: number;
  effectsEnabled: boolean;
  effectsVolume: number;
  narrationEnabled: boolean;
  narrationVolume: number;
  voiceSelectionId: string | null;
  speechRate: number;
  readAnswers: boolean;
  readHints: boolean;
  musicDucking: boolean;
  autoAdvance: boolean;
  fullscreenPreferred: boolean;
  reducedMotion: boolean;
  reducedGlow: boolean;
  highContrast: boolean;
  updatedAt: string;
}

export interface QuestionHistoryRecord {
  id: string;
  ownerKey: string;
  questionId: string;
  seenCount: number;
  answeredCount: number;
  correctCount: number;
  incorrectCount: number;
  hintUseCount: number;
  phoneUseCount: number;
  firstSeenAt: string | null;
  lastSeenAt: string | null;
  lastAnsweredAt: string | null;
  lastSeenRunId: string | null;
  lastAnsweredRunId: string | null;
  lastHintRunId: string | null;
  lastPhoneRunId: string | null;
}

export type RunOutcome = 'incorrect' | 'walked-away' | 'millionaire';

export interface RunQuestionResult {
  questionId: string;
  level: number;
  correct: boolean;
  hintUsed: boolean;
  phoneUsed: boolean;
  selectedChoiceId: string | null;
  correctChoiceId: string | null;
}

export interface RunHistoryRecord {
  id: string;
  schemaVersion: number;
  owner: SaveOwner;
  ownerKey: string;
  mode: 'fresh-mix' | 'curated-set';
  setId: string | null;
  sourcePackIds: string[];
  startedAt: string;
  completedAt: string;
  committedAt: string;
  outcome: RunOutcome;
  payout: number;
  guaranteedWinnings: number;
  highestQuestion: number;
  correctCount: number;
  incorrectCount: number;
  durationMs: number;
  lifelinesUsed: {
    hint: boolean;
    phone: boolean;
  };
  questionResults: RunQuestionResult[];
  resolvedQuestions: SavedQuestionSnapshot[];
  committed: true;
  committedKey: 1;
}

export interface SetProgressRecord {
  id: string;
  ownerKey: string;
  setId: string;
  attempts: number;
  wins: number;
  bestPrize: number;
  bestQuestion: number;
  lastPlayedAt: string;
  lastRunId: string;
}

export type SavedQuestionSnapshot = JsonObject & {
  id: string;
  level: number;
  answerOrder: string[];
};

export interface ControllerLease {
  id: string;
  epoch: number;
  claimedAt: string;
  heartbeatAt: string;
  leaseExpiresAt: string;
}

export interface ActiveSaveRecord<TSnapshot extends JsonValue = JsonValue> {
  id: 'active';
  schemaVersion: number;
  runId: string;
  owner: SaveOwner;
  ownerKey: string;
  revision: number;
  controller: ControllerLease;
  status: 'active' | 'completed';
  packIds: string[];
  resolvedQuestions: SavedQuestionSnapshot[];
  snapshot: TSnapshot;
  createdAt: string;
  updatedAt: string;
}

export interface ActiveSaveInput<TSnapshot extends JsonValue = JsonValue> {
  runId: string;
  owner: SaveOwner;
  controllerId: string;
  status?: 'active' | 'completed';
  packIds: string[];
  resolvedQuestions: SavedQuestionSnapshot[];
  snapshot: TSnapshot;
}

export interface ImportedPackRecord {
  id: string;
  schemaVersion: string;
  version: string;
  title: string;
  description: string;
  language: string;
  contentType: 'pool' | 'curated-sets' | 'combined';
  categories: string[];
  enabled: boolean;
  enabledKey: 0 | 1;
  contentHash: string;
  questionCount: number;
  setCount: number;
  metadata: JsonObject;
  installedAt: string;
  updatedAt: string;
}

export interface ImportedQuestionRecord {
  id: string;
  packId: string;
  localId: string;
  level: number;
  payload: JsonObject;
}

export interface ImportedSetRecord {
  id: string;
  packId: string;
  localId: string;
  questionIds: string[];
  payload: JsonObject;
}

export interface ImportedPackBundle {
  pack: Omit<
    ImportedPackRecord,
    'enabledKey' | 'installedAt' | 'updatedAt' | 'questionCount' | 'setCount'
  >;
  questions: ImportedQuestionRecord[];
  sets: ImportedSetRecord[];
}

export interface MetadataRecord {
  key: string;
  value: JsonValue;
}

export interface AppDatabase extends DBSchema {
  metadata: {
    key: string;
    value: MetadataRecord;
  };
  settings: {
    key: 'global';
    value: GlobalSettingsRecord;
  };
  profiles: {
    key: string;
    value: ProfileRecord;
    indexes: {
      'by-created-at': string;
      'by-display-name': string;
      'by-updated-at': string;
    };
  };
  questionHistory: {
    key: string;
    value: QuestionHistoryRecord;
    indexes: {
      'by-owner': string;
      'by-question': string;
      'by-owner-question': [string, string];
      'by-last-seen-at': string;
    };
  };
  runHistory: {
    key: string;
    value: RunHistoryRecord;
    indexes: {
      'by-owner': string;
      'by-completed-at': string;
      'by-owner-completed-at': [string, string];
      'by-committed': number;
    };
  };
  setProgress: {
    key: string;
    value: SetProgressRecord;
    indexes: {
      'by-owner': string;
      'by-set': string;
      'by-owner-set': [string, string];
    };
  };
  activeSave: {
    key: 'active';
    value: ActiveSaveRecord;
  };
  importedPacks: {
    key: string;
    value: ImportedPackRecord;
    indexes: {
      'by-title': string;
      'by-enabled': number;
      'by-updated-at': string;
    };
  };
  importedQuestions: {
    key: string;
    value: ImportedQuestionRecord;
    indexes: {
      'by-pack': string;
      'by-level': number;
      'by-pack-level': [string, number];
    };
  };
  importedSets: {
    key: string;
    value: ImportedSetRecord;
    indexes: {
      'by-pack': string;
    };
  };
}

export type AppStoreName =
  | 'metadata'
  | 'settings'
  | 'profiles'
  | 'questionHistory'
  | 'runHistory'
  | 'setProgress'
  | 'activeSave'
  | 'importedPacks'
  | 'importedQuestions'
  | 'importedSets';
