import type {
  NormalizedCuratedSet,
  NormalizedPack,
  NormalizedQuestion,
  RuntimeContentCatalog
} from '../content';
import type {
  ImportedPackBundle,
  ImportedPackRecord,
  ImportedQuestionRecord,
  ImportedSetRecord,
  JsonObject,
  JsonValue,
  RunOutcome,
  SaveOwner,
  SavedQuestionSnapshot,
  TerminalRunCommit
} from '../data';
import type {
  CuratedSetDefinition,
  GameRunState,
  QuestionDefinition,
  ResolvedQuestionSnapshot
} from '../game';

export function toJsonValue(value: unknown): JsonValue {
  const parsed: unknown = JSON.parse(JSON.stringify(value));
  if (!isJsonValue(parsed)) throw new TypeError('Value is not serializable JSON data.');
  return parsed;
}

export function toJsonObject(value: unknown): JsonObject {
  const json = toJsonValue(value);
  if (!isRecord(json)) throw new TypeError('Expected a JSON object.');
  return json;
}

function isJsonValue(value: unknown, depth = 0): value is JsonValue {
  if (depth > 100) return false;
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) return value.every((item) => isJsonValue(item, depth + 1));
  if (!isRecord(value)) return false;
  return Object.keys(value).every((key) => key !== '__proto__' && key !== 'constructor' && key !== 'prototype')
    && Object.values(value).every((item) => isJsonValue(item, depth + 1));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function gameQuestionFromNormalized(question: NormalizedQuestion): QuestionDefinition {
  if (question.choices.length !== 4) throw new TypeError(`Question ${question.id} has invalid choices.`);
  const choices = question.choices.map((choice) => ({ id: choice.id, text: choice.text }));
  return {
    id: question.id,
    level: question.level,
    category: question.category,
    tags: question.tags,
    prompt: question.prompt,
    choices: [choices[0], choices[1], choices[2], choices[3]],
    correctChoiceId: question.correctChoiceId,
    hint: question.hint,
    explanation: question.explanation,
    usage: question.usage,
    source: {
      packId: question.sourcePackId,
      packVersion: question.sourceVersion,
      releaseId: question.origin === 'built-in' ? 'builtin-question-content-release-001' : undefined,
      sourceFile: question.sourceFile,
      builtIn: question.origin === 'built-in'
    }
  };
}

export function gameSetFromNormalized(set: NormalizedCuratedSet): CuratedSetDefinition {
  return {
    id: set.id,
    title: set.title,
    description: set.description,
    theme: set.theme,
    tags: set.tags,
    questionIds: set.questionIds,
    enabled: set.enabled
  };
}

export function builtInGameCatalog(catalog: RuntimeContentCatalog): {
  questions: QuestionDefinition[];
  sets: CuratedSetDefinition[];
} {
  return {
    questions: catalog.questions.filter((question) => question.enabled).map(gameQuestionFromNormalized),
    sets: catalog.sets.filter((set) => set.enabled).map(gameSetFromNormalized)
  };
}

export function importedGameCatalog(
  packs: readonly ImportedPackRecord[],
  questionRecords: readonly ImportedQuestionRecord[],
  setRecords: readonly ImportedSetRecord[]
): { questions: QuestionDefinition[]; sets: CuratedSetDefinition[] } {
  const enabled = new Set(packs.filter((pack) => pack.enabled).map((pack) => pack.id));
  const questions = questionRecords
    .filter((record) => enabled.has(record.packId))
    .map((record) => decodeNormalizedQuestion(record.payload))
    .filter((value): value is NormalizedQuestion => value !== null)
    .map(gameQuestionFromNormalized);
  const sets = setRecords
    .filter((record) => enabled.has(record.packId))
    .map((record) => decodeNormalizedSet(record.payload))
    .filter((value): value is NormalizedCuratedSet => value !== null)
    .map(gameSetFromNormalized);
  return { questions, sets };
}

function decodeNormalizedQuestion(value: unknown): NormalizedQuestion | null {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.prompt !== 'string' || !Array.isArray(value.choices) || value.choices.length !== 4) return null;
  return value as unknown as NormalizedQuestion;
}

function decodeNormalizedSet(value: unknown): NormalizedCuratedSet | null {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.title !== 'string' || !Array.isArray(value.questionIds) || value.questionIds.length !== 15) return null;
  return value as unknown as NormalizedCuratedSet;
}

export async function importedBundleFromNormalized(pack: NormalizedPack): Promise<ImportedPackBundle> {
  const contentHash = await sha256(JSON.stringify(pack));
  const packId = pack.source.id;
  return {
    pack: {
      id: packId,
      schemaVersion: pack.source.schemaVersion,
      version: pack.source.version,
      title: pack.source.title,
      description: pack.source.description,
      language: pack.source.language,
      contentType: pack.source.contentType === 'mixed' || pack.source.contentType === 'both' ? 'combined' : pack.source.contentType,
      categories: [...pack.source.categories],
      enabled: pack.source.enabled,
      contentHash,
      metadata: toJsonObject(pack.source.metadata)
    },
    questions: pack.questions.map((question) => ({
      id: question.id,
      packId,
      localId: question.localId,
      level: question.level,
      payload: toJsonObject(question)
    })),
    sets: pack.sets.map((set) => ({
      id: set.id,
      packId,
      localId: set.localId,
      questionIds: [...set.questionIds],
      payload: toJsonObject(set)
    }))
  };
}

async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  if (globalThis.crypto?.subtle) {
    const hash = await globalThis.crypto.subtle.digest('SHA-256', bytes);
    return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  }
  // Deterministic non-cryptographic fallback only identifies identical local payloads.
  let state = 2166136261;
  for (const byte of bytes) state = Math.imul(state ^ byte, 16777619) >>> 0;
  return state.toString(16).padStart(8, '0');
}

export function serializeGameRun(run: GameRunState): JsonValue {
  return toJsonValue(run);
}

export function decodeGameRun(value: unknown): GameRunState | null {
  if (!isRecord(value) || value.schemaVersion !== 1 || typeof value.runId !== 'string') return null;
  if (!Array.isArray(value.questions) || value.questions.length !== 15) return null;
  if (!Number.isInteger(value.currentQuestionIndex) || Number(value.currentQuestionIndex) < 0 || Number(value.currentQuestionIndex) > 14) return null;
  if (!Number.isInteger(value.saveRevision) || Number(value.saveRevision) < 1) return null;
  if (!value.questions.every((question, index) => isResolvedQuestion(question, index + 1))) return null;
  const phases = new Set(['game-intro', 'question-ready', 'answer-selected', 'final-confirmation', 'phone-confirmation', 'phone-active', 'answer-locked', 'correct-reveal', 'incorrect-reveal', 'millionaire-reveal', 'between-questions', 'completed']);
  if (typeof value.phase !== 'string' || !phases.has(value.phase)) return null;
  if (!isRecord(value.owner) || (value.owner.kind !== 'guest' && value.owner.kind !== 'profile')) return null;
  if (!isRecord(value.mode) || !['fresh-mix', 'curated-set', 'surprise'].includes(String(value.mode.kind))) return null;
  if (!Array.isArray(value.results) || !Array.isArray(value.displayedQuestionIds)) return null;
  if (!isRecord(value.lifelines)) return null;
  return value as unknown as GameRunState;
}

function isResolvedQuestion(value: unknown, level: number): value is ResolvedQuestionSnapshot {
  if (!isRecord(value) || typeof value.id !== 'string' || value.level !== level || typeof value.prompt !== 'string' || typeof value.correctChoiceId !== 'string') return false;
  if (!Array.isArray(value.choices) || value.choices.length !== 4) return false;
  const labels = ['A', 'B', 'C', 'D'];
  return value.choices.every((choice, index) => isRecord(choice) && typeof choice.id === 'string' && typeof choice.text === 'string' && choice.label === labels[index]);
}

export function savedQuestionFromResolved(question: ResolvedQuestionSnapshot): SavedQuestionSnapshot {
  return {
    id: question.id,
    level: question.level,
    answerOrder: question.choices.map((choice) => choice.id),
    category: question.category,
    tags: [...question.tags],
    prompt: question.prompt,
    choices: question.choices.map((choice) => ({ ...choice })),
    correctChoiceId: question.correctChoiceId,
    hint: question.hint,
    explanation: question.explanation,
    usage: { freshMix: question.usage.freshMix, setIds: [...question.usage.setIds] },
    ...(question.source ? { source: { ...question.source } } : {})
  };
}

export function resolvedQuestionFromSaved(value: SavedQuestionSnapshot): ResolvedQuestionSnapshot | null {
  if (!isResolvedQuestion(value, value.level)) return null;
  return value as unknown as ResolvedQuestionSnapshot;
}

export function ownerForRun(run: GameRunState): SaveOwner {
  return run.owner.kind === 'profile' ? { type: 'profile', profileId: run.owner.profileId } : { type: 'guest' };
}

export function terminalCommitFromRun(run: GameRunState): TerminalRunCommit {
  const outcome = run.terminalOutcome;
  if (!outcome) throw new TypeError('Cannot commit a run without a terminal outcome.');
  const outcomeName: RunOutcome = outcome.kind === 'walk-away' ? 'walked-away' : outcome.kind;
  const sourcePackIds = [...new Set(run.questions.map((question) => question.source?.packId).filter((id): id is string => Boolean(id)))];
  return {
    runId: run.runId,
    owner: ownerForRun(run),
    mode: run.mode.kind === 'fresh-mix' ? 'fresh-mix' : 'curated-set',
    setId: run.mode.kind === 'fresh-mix' ? null : run.mode.setId,
    sourcePackIds,
    startedAt: new Date(run.createdAtMs).toISOString(),
    completedAt: new Date(outcome.endedAtMs).toISOString(),
    outcome: outcomeName,
    payout: outcome.amountWon,
    guaranteedWinnings: run.guaranteedWinnings,
    highestQuestion: outcome.kind === 'walk-away' ? Math.max(1, outcome.completedLevel) : outcome.kind === 'incorrect' ? outcome.failedLevel : 15,
    durationMs: Math.max(0, Math.round(outcome.endedAtMs - run.createdAtMs)),
    lifelinesUsed: {
      hint: run.lifelines.hint.status === 'used',
      phone: run.lifelines.phone.status === 'used'
    },
    questionResults: run.results.map((result) => ({
      questionId: result.questionId,
      level: result.level,
      correct: result.isCorrect,
      hintUsed: result.hintUsed,
      phoneUsed: result.phoneUsed,
      selectedChoiceId: result.selectedChoiceId,
      correctChoiceId: result.correctChoiceId
    })),
    resolvedQuestions: run.questions.map(savedQuestionFromResolved)
  };
}

export function resolvedQuestionsForSave(run: GameRunState): SavedQuestionSnapshot[] {
  return run.questions.map(savedQuestionFromResolved);
}
