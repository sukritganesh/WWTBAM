import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { audioManager } from '../audio/AudioManager';
import { speechManager } from '../audio/SpeechManager';
import type { AudioPreferences } from '../audio/types';
import { useSpeechVoices } from '../audio/useSpeechVoices';
import { BrandMark } from '../components/BrandMark';
import { Modal } from '../components/Modal';
import { SettingsPanel } from '../components/SettingsPanel';
import { StageBackground } from '../components/StageBackground';
import { ToastRegion } from '../components/ToastRegion';
import {
  loadBuiltInCatalog,
  prepareCustomPackImport,
  type ExistingContentIdentity,
  type ImportPreview,
  type PreparedImportPayload,
  type RuntimeContentCatalog
} from '../content';
import {
  ControllerConflictError,
  createDataRepositories,
  deleteAppDatabase,
  type ActiveSaveRecord,
  type BackupSummary,
  type DataRepositories,
  type GlobalSettingsRecord,
  type ImportedPackRecord,
  type ImportedQuestionRecord,
  type ImportedSetRecord,
  type ProfileRecord,
  type QuestionHistoryRecord,
  type RunHistoryRecord,
  type SaveOwner,
  type SetProgressRecord,
  validateProfileExport
} from '../data';
import {
  createGameRun,
  currentQuestion,
  gameReducer,
  selectCuratedSet,
  selectFreshMix,
  selectSurpriseRun,
  type GameAction,
  type GameRunState,
  type LadderLevel,
  type QuestionHistory
} from '../game';
import { usePwa } from '../pwa/usePwa';
import { DashboardScreen } from '../screens/DashboardScreen';
import { ContentManagerScreen, type ManagedContentPack } from '../screens/ContentManagerScreen';
import { GameplayScreen, type NarrationStatus } from '../screens/GameplayScreen';
import { HelpContent } from '../screens/HelpScreen';
import { HistoryScreen, SetProgressScreen, StatisticsScreen } from '../screens/InsightsScreens';
import { NewGameScreen, type SetDisplayInfo } from '../screens/NewGameScreen';
import { PreGameScreen } from '../screens/PreGameScreen';
import { ResultsScreen, RunReviewScreen } from '../screens/ResultsScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { TitleScreen } from '../screens/TitleScreen';
import { downloadJson, downloadText, readTextFile } from '../utils/files';
import { createId, formatMoney } from '../utils/format';
import { toggleFullscreen } from '../utils/fullscreen';
import {
  builtInGameCatalog,
  decodeGameRun,
  importedBundleFromNormalized,
  importedGameCatalog,
  narratedQuestionIdForResume,
  resolvedQuestionFromSaved,
  resolvedQuestionsForSave,
  serializeGameRun,
  terminalCommitFromRun
} from './adapters';
import { rawPackFromStored } from './packTransfer';
import { musicSceneForApp } from './music';
import { audioPreferencesFromRecord, settingsPatchFromAudio } from './settings';
import type { ActiveIdentity, NewGameConfig, ScreenId, ToastMessage } from './types';

type DialogState =
  | { kind: 'create-profile' }
  | { kind: 'delete-profile'; profile: ProfileRecord }
  | { kind: 'take-control' }
  | { kind: 'reset-all' }
  | { kind: 'restore'; source: string; summary: BackupSummary }
  | { kind: 'profile-import'; source: string; summary: string }
  | null;

interface ImportedState {
  packs: ImportedPackRecord[];
  questions: ImportedQuestionRecord[];
  sets: ImportedSetRecord[];
}

const EMPTY_IMPORTED: ImportedState = { packs: [], questions: [], sets: [] };
const DEFAULT_CONFIG: NewGameConfig = { mode: 'fresh-mix', selectedSetId: null, contentScope: 'built-in' };

function currentTabControllerId(): string {
  const navigation = performance.getEntriesByType?.('navigation')[0] as PerformanceNavigationTiming | undefined;
  const stored = sessionStorage.getItem('one-million-controller-id');
  if (navigation?.type === 'reload' && stored) return stored;
  const id = createId('controller');
  sessionStorage.setItem('one-million-controller-id', id);
  return id;
}

// Module scope is intentional: hook initializer expressions run on every render.
// A stable document-scoped identity survives reload through sessionStorage while a
// separately opened/duplicated tab (a navigation, not a reload) receives a new ID.
const TAB_CONTROLLER_ID = currentTabControllerId();

export function App() {
  const [booting, setBooting] = useState(true);
  const [fatalError, setFatalError] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<ProfileRecord[]>([]);
  const [settingsRecord, setSettingsRecord] = useState<GlobalSettingsRecord | null>(null);
  const [activeSave, setActiveSaveState] = useState<ActiveSaveRecord | null>(null);
  const [savedRun, setSavedRun] = useState<GameRunState | null>(null);
  const [imported, setImported] = useState<ImportedState>(EMPTY_IMPORTED);
  const [identity, setIdentity] = useState<ActiveIdentity | null>(null);
  const [runs, setRuns] = useState<RunHistoryRecord[]>([]);
  const [questionHistory, setQuestionHistory] = useState<QuestionHistoryRecord[]>([]);
  const [setProgress, setSetProgress] = useState<SetProgressRecord[]>([]);
  const [screen, setScreen] = useState<ScreenId>('title');
  const [returnScreen, setReturnScreen] = useState<ScreenId>('title');
  const [config, setConfig] = useState<NewGameConfig>(DEFAULT_CONFIG);
  const [game, setGameState] = useState<GameRunState | null>(null);
  const [persistedGameRevision, setPersistedGameRevision] = useState(0);
  const [persistenceError, setPersistenceError] = useState<string | null>(null);
  const [controllerStatus, setControllerStatus] = useState<'active' | 'read-only' | 'taking-control' | 'save-error'>('active');
  const [dialog, setDialog] = useState<DialogState>(null);
  const [createName, setCreateName] = useState('');
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [inGameSettings, setInGameSettings] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [narrationStatus, setNarrationStatus] = useState<NarrationStatus>('idle');
  const [commitPending, setCommitPending] = useState(false);
  const [commitError, setCommitError] = useState<string | null>(null);
  const [lastCommitted, setLastCommitted] = useState<RunHistoryRecord | null>(null);
  const [selectedHistoryRun, setSelectedHistoryRun] = useState<RunHistoryRecord | null>(null);
  const [storageMessage, setStorageMessage] = useState<string | null>(null);
  const [beginBusy, setBeginBusy] = useState(false);

  const repositories = useRef<DataRepositories | null>(null);
  const activeSaveRef = useRef<ActiveSaveRecord | null>(null);
  const gameRef = useRef<GameRunState | null>(null);
  const saveQueue = useRef<Promise<boolean>>(Promise.resolve(true));
  const controllerId = TAB_CONTROLLER_ID;
  const lastNarratedQuestion = useRef<string | null>(null);
  const builtInCatalogRef = useRef<RuntimeContentCatalog | null>(null);
  const pwa = usePwa();
  const voices = useSpeechVoices();
  const audioSettings = useMemo(() => audioPreferencesFromRecord(settingsRecord), [settingsRecord]);

  const setActiveSave = useCallback((value: ActiveSaveRecord | null) => {
    activeSaveRef.current = value;
    setActiveSaveState(value);
  }, []);
  const setGame = useCallback((value: GameRunState | null) => {
    gameRef.current = value;
    setGameState(value);
  }, []);

  const notify = useCallback((kind: ToastMessage['kind'], message: string) => {
    const id = createId('toast');
    setToasts((items) => [...items.slice(-3), { id, kind, message }]);
    window.setTimeout(() => setToasts((items) => items.filter((item) => item.id !== id)), 5200);
  }, []);

  const loadImported = useCallback(async (repos: DataRepositories): Promise<ImportedState> => {
    const packs = await repos.importedPacks.list();
    const questionGroups = await Promise.all(packs.map((pack) => repos.importedPacks.getQuestions(pack.id)));
    const setGroups = await Promise.all(packs.map((pack) => repos.importedPacks.getSets(pack.id)));
    return { packs, questions: questionGroups.flat(), sets: setGroups.flat() };
  }, []);

  const loadOwnerData = useCallback(async (activeIdentity: ActiveIdentity | null) => {
    const repos = repositories.current;
    if (!repos || !activeIdentity) {
      setRuns([]); setQuestionHistory([]); setSetProgress([]);
      return;
    }
    const owner: SaveOwner = activeIdentity.kind === 'profile' ? { type: 'profile', profileId: activeIdentity.profile.id } : { type: 'guest' };
    const [nextRuns, history, progress, nextProfiles] = await Promise.all([
      repos.runHistory.listForOwner(owner),
      repos.questionHistory.listForOwner(owner),
      repos.setProgress.listForOwner(owner),
      repos.profiles.list()
    ]);
    setRuns(nextRuns); setQuestionHistory(history); setSetProgress(progress); setProfiles(nextProfiles);
    if (activeIdentity.kind === 'profile') {
      const refreshed = nextProfiles.find((profile) => profile.id === activeIdentity.profile.id);
      if (refreshed) setIdentity({ kind: 'profile', profile: refreshed });
    }
  }, []);

  const reloadAll = useCallback(async () => {
    const repos = repositories.current;
    if (!repos) return;
    const [nextProfiles, nextSettings, nextSave, nextImported] = await Promise.all([
      repos.profiles.list(), repos.settings.get(), repos.activeSave.get(), loadImported(repos)
    ]);
    setProfiles(nextProfiles); setSettingsRecord(nextSettings); setImported(nextImported);
    setActiveSave(nextSave ?? null);
    if (nextSave) {
      const decoded = decodeGameRun(nextSave.snapshot);
      setSavedRun(decoded);
      if (!decoded) setStorageMessage('The active-save record is corrupt and has been quarantined from gameplay. Export a backup before resetting it.');
    } else setSavedRun(null);
    await loadOwnerData(identity);
  }, [identity, loadImported, loadOwnerData, setActiveSave]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        builtInCatalogRef.current = loadBuiltInCatalog();
        const repos = await createDataRepositories();
        if (cancelled) { repos.close(); return; }
        repositories.current = repos;
        const [nextProfiles, nextSettings, nextSave, nextImported] = await Promise.all([
          repos.profiles.list(), repos.settings.get(), repos.activeSave.get(), loadImported(repos)
        ]);
        setProfiles(nextProfiles); setSettingsRecord(nextSettings); setImported(nextImported);
        setActiveSave(nextSave ?? null);
        if (nextSave) {
          const decoded = decodeGameRun(nextSave.snapshot);
          setSavedRun(decoded);
          if (!decoded) setStorageMessage('A corrupt active save was isolated. Other local data remains available for backup and recovery.');
        }
      } catch (error) {
        setFatalError(error instanceof Error ? error.message : 'Local startup failed.');
      } finally {
        if (!cancelled) setBooting(false);
      }
    })();
    return () => { cancelled = true; repositories.current?.close(); };
  }, [loadImported, setActiveSave]);

  useEffect(() => { audioManager.configure(audioSettings); }, [audioSettings]);
  useEffect(() => {
    const unlock = () => {
      void audioManager.unlock();
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
    window.addEventListener('pointerdown', unlock, { passive: true });
    window.addEventListener('keydown', unlock);
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);
  useEffect(() => {
    document.documentElement.dataset.reducedMotion = String(audioSettings.reducedMotion);
    document.documentElement.dataset.reducedGlow = String(audioSettings.reducedGlow);
    document.documentElement.dataset.highContrast = String(audioSettings.highContrast);
  }, [audioSettings.highContrast, audioSettings.reducedGlow, audioSettings.reducedMotion]);

  useEffect(() => {
    audioManager.setMusicScene(musicSceneForApp(screen, game), game?.runId);
  }, [game, screen]);

  useEffect(() => {
    if (screen !== 'game' || !game || game.phase !== 'phone-active') return;
    const timer = window.setInterval(() => setNowMs(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, [game, screen]);

  const gameCatalog = useMemo(() => {
    const builtIn = builtInCatalogRef.current ? builtInGameCatalog(builtInCatalogRef.current) : { questions: [], sets: [] };
    const custom = importedGameCatalog(imported.packs, imported.questions, imported.sets);
    return { builtIn, all: { questions: [...builtIn.questions, ...custom.questions], sets: [...builtIn.sets, ...custom.sets] } };
  }, [imported]);
  const selectedCatalog = config.contentScope === 'built-in' ? gameCatalog.builtIn : gameCatalog.all;
  const owner = useMemo<SaveOwner | null>(() => identity ? identity.kind === 'profile' ? { type: 'profile', profileId: identity.profile.id } : { type: 'guest' } : null, [identity]);
  const profileHistory = useMemo<QuestionHistory>(() => Object.fromEntries(questionHistory.map((record) => [record.questionId, { seenCount: record.seenCount, lastSeenAtMs: record.lastSeenAt ? Date.parse(record.lastSeenAt) : null }])), [questionHistory]);
  const freshness = useMemo(() => Array.from({ length: 15 }, (_, index) => index + 1).filter((level) => selectedCatalog.questions.some((question) => question.level === level && question.usage.freshMix && !profileHistory[question.id]?.seenCount)).length, [profileHistory, selectedCatalog.questions]);
  const progressBySet = useMemo(() => new Map(setProgress.map((item) => [item.setId, item])), [setProgress]);
  const setDisplay = useMemo<SetDisplayInfo[]>(() => selectedCatalog.sets.map((set) => {
    const progress = progressBySet.get(set.id);
    return { ...set, sourceLabel: set.id.startsWith('builtin') ? 'Built-in' : 'Custom', attempts: progress?.attempts ?? 0, bestPrize: progress?.bestPrize ?? 0, millionaireWon: Boolean(progress?.wins), seenCount: set.questionIds.filter((id) => profileHistory[id]?.seenCount).length };
  }), [profileHistory, progressBySet, selectedCatalog.sets]);
  const managedPacks = useMemo<ManagedContentPack[]>(() => imported.packs.map((pack) => ({
    id: pack.id,
    title: pack.title,
    description: pack.description,
    version: pack.version,
    author: typeof pack.metadata.author === 'string' ? pack.metadata.author : 'Local author',
    enabled: pack.enabled,
    questionCount: pack.questionCount,
    setCount: pack.setCount,
    categories: pack.categories,
    reviewStatus: typeof pack.metadata.reviewStatus === 'string' ? pack.metadata.reviewStatus : 'unreviewed',
    updatedLabel: new Date(pack.updatedAt).toLocaleDateString()
  })), [imported.packs]);
  const contentIdentity = useMemo<ExistingContentIdentity>(() => {
    const builtIn = builtInCatalogRef.current;
    return {
      packVersions: new Map([
        ...(builtIn?.sources.map((source) => [source.id, source.version] as const) ?? []),
        ...imported.packs.map((pack) => [pack.id, pack.version] as const)
      ]),
      questionOwners: new Map([
        ...(builtIn?.questions.map((question) => [question.id, question.sourcePackId] as const) ?? []),
        ...imported.questions.map((question) => [question.id, question.packId] as const)
      ]),
      setOwners: new Map([
        ...(builtIn?.sets.map((set) => [set.id, set.sourcePackId] as const) ?? []),
        ...imported.sets.map((set) => [set.id, set.packId] as const)
      ])
    };
  }, [imported]);
  const saveOwnerName = useMemo(() => {
    if (!activeSave) return null;
    const saveOwner = activeSave.owner;
    if (saveOwner.type === 'guest') return 'Guest';
    const profile = profiles.find((item) => item.id === saveOwner.profileId);
    return profile ? profile.displayName : 'Deleted profile';
  }, [activeSave, profiles]);
  const ownsSave = useMemo(() => {
    if (!activeSave || !owner) return false;
    if (activeSave.owner.type === 'guest') return owner.type === 'guest';
    return owner.type === 'profile' && owner.profileId === activeSave.owner.profileId;
  }, [activeSave, owner]);
  const playerName = identity?.kind === 'profile' ? identity.profile.displayName : 'Guest';

  const updateSettings = useCallback(async (next: AudioPreferences) => {
    const previous = settingsRecord;
    setSettingsRecord((record) => record ? { ...record, ...settingsPatchFromAudio(next) } : record);
    try {
      const updated = await repositories.current?.settings.update(settingsPatchFromAudio(next));
      if (updated) setSettingsRecord(updated);
    } catch (error) {
      if (previous) setSettingsRecord(previous);
      notify('error', error instanceof Error ? error.message : 'Settings could not be saved.');
    }
  }, [notify, settingsRecord]);

  const openGlobalScreen = useCallback((destination: ScreenId) => {
    setReturnScreen(screen);
    setScreen(destination);
    speechManager.cancel();
  }, [screen]);

  const selectIdentity = useCallback(async (next: ActiveIdentity) => {
    setIdentity(next); setScreen('dashboard'); setConfig(DEFAULT_CONFIG); setSelectedHistoryRun(null);
    await loadOwnerData(next);
    audioManager.play('confirm');
  }, [loadOwnerData]);

  const createProfile = useCallback(async () => {
    setDialogError(null);
    try {
      const profile = await repositories.current?.profiles.create(createName);
      if (!profile) return;
      setDialog(null); setCreateName('');
      await selectIdentity({ kind: 'profile', profile });
      setProfiles(await repositories.current!.profiles.list());
      audioManager.play('profile-create'); notify('success', `${profile.displayName} is ready to play.`);
    } catch (error) { setDialogError(error instanceof Error ? error.message : 'Profile creation failed.'); }
  }, [createName, notify, selectIdentity]);

  const deleteProfile = useCallback(async (profile: ProfileRecord) => {
    setDialogError(null);
    try {
      const result = await repositories.current?.profiles.delete(profile.id, 'delete-save');
      setDialog(null); setProfiles(await repositories.current!.profiles.list());
      if (result?.activeSaveDeleted) { setActiveSave(null); setSavedRun(null); }
      if (identity?.kind === 'profile' && identity.profile.id === profile.id) { setIdentity(null); setScreen('title'); }
      audioManager.play('profile-delete'); notify('success', `${profile.displayName} and its local career were deleted.`);
    } catch (error) { setDialogError(error instanceof Error ? error.message : 'Profile deletion failed.'); }
  }, [identity, notify, setActiveSave]);

  const enqueuePersist = useCallback((next: GameRunState): Promise<boolean> => {
    saveQueue.current = saveQueue.current.catch(() => false).then(async () => {
      const repos = repositories.current;
      const save = activeSaveRef.current;
      if (!repos || !save) throw new Error('The active save is unavailable.');
      const updated = await repos.activeSave.update({
        runId: next.runId,
        expectedRevision: save.revision,
        controllerId,
        controllerEpoch: save.controller.epoch,
        patch: { snapshot: serializeGameRun(next), resolvedQuestions: resolvedQuestionsForSave(next) }
      });
      setActiveSave(updated); setSavedRun(next); setPersistedGameRevision(next.saveRevision); setPersistenceError(null); setControllerStatus('active');
      return true;
    }).catch((error) => {
      const message = error instanceof Error ? error.message : 'Autosave failed.';
      setPersistenceError(message);
      setControllerStatus(error instanceof ControllerConflictError ? 'read-only' : 'save-error');
      return false;
    });
    return saveQueue.current;
  }, [controllerId, setActiveSave]);

  const dispatchGame = useCallback((action: GameAction): Promise<boolean> => {
    const previous = gameRef.current;
    if (!previous || controllerStatus !== 'active') return Promise.resolve(false);
    const next = gameReducer(previous, action);
    if (next === previous) return Promise.resolve(false);
    setGame(next);
    if (action.type === 'SELECT_ANSWER') audioManager.play('answer-select');
    if (action.type === 'USE_HINT') audioManager.play('hint');
    if (action.type === 'CONFIRM_PHONE') audioManager.play('phone-start');
    if (action.type === 'END_PHONE_EARLY' || action.type === 'SYNC_PHONE_DEADLINE') audioManager.play('phone-end');
    if (action.type === 'CONFIRM_LOCK') { speechManager.cancel(); audioManager.play('answer-lock'); }
    if (action.type === 'OPEN_PAUSE' || action.type === 'OPEN_HELP') speechManager.cancel();
    if (action.type === 'CONFIRM_WALK_AWAY') audioManager.play('walk-away');
    if (action.type === 'REVEAL_ANSWER') {
      const result = next.results.at(-1);
      audioManager.play(result?.isCorrect ? (result.level === 5 || result.level === 10 ? 'checkpoint' : result.level === 15 ? 'victory' : 'correct') : 'incorrect');
    }
    if (owner && action.type === 'SHOW_CURRENT_QUESTION') {
      const questionId = currentQuestion(next).id;
      if (!previous.displayedQuestionIds.includes(questionId)) void repositories.current?.questionHistory.markSeen(owner, questionId, next.runId).then(() => loadOwnerData(identity));
    }
    if (owner && action.type === 'USE_HINT' && next !== previous) void repositories.current?.questionHistory.markHintUsed(owner, currentQuestion(next).id, next.runId);
    if (owner && action.type === 'CONFIRM_PHONE' && next !== previous) void repositories.current?.questionHistory.markPhoneUsed(owner, currentQuestion(next).id, next.runId);
    return enqueuePersist(next);
  }, [controllerStatus, enqueuePersist, identity, loadOwnerData, owner, setGame]);

  useEffect(() => {
    if (!game || game.phase !== 'answer-locked' || controllerStatus !== 'active' || persistedGameRevision < game.saveRevision) return;
    const level = currentQuestion(game).level;
    const delay = audioSettings.reducedMotion ? 160 : level >= 11 ? 1500 : level >= 6 ? 1050 : 700;
    const timer = window.setTimeout(() => void dispatchGame({ type: 'REVEAL_ANSWER', nowMs: Date.now() }), delay);
    return () => window.clearTimeout(timer);
  }, [audioSettings.reducedMotion, controllerStatus, dispatchGame, game, persistedGameRevision]);

  useEffect(() => {
    if (!game || game.phase !== 'phone-active' || game.lifelines.phone.status !== 'active') return;
    if (nowMs >= game.lifelines.phone.deadlineMs) void dispatchGame({ type: 'SYNC_PHONE_DEADLINE', nowMs });
    else if (game.lifelines.phone.deadlineMs - nowMs <= 10_000 && Math.ceil((game.lifelines.phone.deadlineMs - nowMs) / 1000) <= 5) audioManager.play('phone-tick');
  }, [dispatchGame, game, nowMs]);

  const narrateCurrent = useCallback(() => {
    const state = gameRef.current;
    if (!state || state.phase === 'game-intro' || state.phase === 'between-questions') return;
    const question = currentQuestion(state);
    const choiceText = audioSettings.readAnswers ? ` ${question.choices.map((choice) => `${choice.label}. ${choice.text}.`).join(' ')}` : '';
    const spoke = speechManager.speak(`${question.prompt}${choiceText}`, audioSettings, () => setNarrationStatus('idle'));
    setNarrationStatus(spoke ? 'speaking' : audioSettings.narrationEnabled ? 'unavailable' : 'disabled');
  }, [audioSettings]);

  useEffect(() => {
    if (!game || !game.displayedQuestionIds.includes(currentQuestion(game).id) || lastNarratedQuestion.current === currentQuestion(game).id) return;
    lastNarratedQuestion.current = currentQuestion(game).id;
    narrateCurrent();
  }, [game, narrateCurrent]);

  useEffect(() => {
    if (!game || !audioSettings.autoAdvance || game.phase !== 'correct-reveal' || controllerStatus !== 'active') return;
    const timer = window.setTimeout(async () => {
      if (await dispatchGame({ type: 'ADVANCE_QUESTION' })) await dispatchGame({ type: 'SHOW_CURRENT_QUESTION' });
    }, audioSettings.reducedMotion ? 500 : 1800);
    return () => window.clearTimeout(timer);
  }, [audioSettings.autoAdvance, audioSettings.reducedMotion, controllerStatus, dispatchGame, game]);

  const beginNewGame = useCallback(async () => {
    if (!identity || !owner || beginBusy) return;
    setBeginBusy(true);
    setDialogError(null);
    try {
      const seed = Date.now() ^ Math.floor(Math.random() * 0xffffffff);
      let questions;
      let mode: GameRunState['mode'];
      if (config.mode === 'fresh-mix') {
        questions = selectFreshMix(selectedCatalog.questions, { seed, history: profileHistory, preferCategoryDiversity: true }).questions;
        mode = { kind: 'fresh-mix' };
      } else if (config.mode === 'curated-set') {
        const set = selectedCatalog.sets.find((item) => item.id === config.selectedSetId);
        if (!set) throw new Error('Select a valid curated set before beginning.');
        questions = selectCuratedSet(set, selectedCatalog.questions, seed).questions;
        mode = { kind: 'curated-set', setId: set.id, setTitle: set.title };
      } else {
        const progress = Object.fromEntries(setProgress.map((item) => [item.setId, { setId: item.setId, attemptCount: item.attempts, millionaireWon: item.wins > 0, lastAttemptedAtMs: Date.parse(item.lastPlayedAt) }]));
        const selection = selectSurpriseRun(selectedCatalog.sets, selectedCatalog.questions, progress, { seed });
        questions = selection.questions;
        mode = { kind: 'surprise', setId: selection.set.id, setTitle: selection.set.title };
      }
      const next = createGameRun({ runId: createId('run'), owner: identity.kind === 'profile' ? { kind: 'profile', profileId: identity.profile.id, displayName: identity.profile.displayName } : { kind: 'guest' }, mode, questions, createdAtMs: Date.now() });
      const input = { runId: next.runId, owner, controllerId, packIds: [...new Set(next.questions.map((q) => q.source?.packId).filter((id): id is string => Boolean(id)))], resolvedQuestions: resolvedQuestionsForSave(next), snapshot: serializeGameRun(next) };
      const record = activeSave ? await repositories.current!.activeSave.replace(input, { runId: activeSave.runId, revision: activeSave.revision }) : await repositories.current!.activeSave.create(input);
      setActiveSave(record); setSavedRun(next); setGame(next); setPersistedGameRevision(next.saveRevision); setPersistenceError(null); setControllerStatus('active'); setScreen('game'); setCommitError(null); setLastCommitted(null); lastNarratedQuestion.current = null;
      audioManager.play('game-intro');
    } catch (error) { setDialogError(error instanceof Error ? error.message : 'The new run could not be generated.'); }
    finally { setBeginBusy(false); }
  }, [activeSave, beginBusy, config, controllerId, identity, owner, profileHistory, selectedCatalog.questions, selectedCatalog.sets, setActiveSave, setGame, setProgress]);

  const claimSavedRun = useCallback(async (force = false) => {
    if (!activeSave || !savedRun || !ownsSave) return;
    setControllerStatus('taking-control');
    try {
      const claimed = await repositories.current!.activeSave.claimController({ runId: activeSave.runId, expectedRevision: activeSave.revision, expectedControllerEpoch: activeSave.controller.epoch, controllerId, force });
      setActiveSave(claimed); setGame(savedRun); setPersistedGameRevision(savedRun.saveRevision); setControllerStatus('active'); setDialog(null); setScreen('game'); lastNarratedQuestion.current = narratedQuestionIdForResume(savedRun);
    } catch (error) {
      setControllerStatus('read-only');
      if (error instanceof ControllerConflictError) setDialog({ kind: 'take-control' });
      else notify('error', error instanceof Error ? error.message : 'The save could not be resumed.');
    }
  }, [activeSave, controllerId, notify, ownsSave, savedRun, setActiveSave, setGame]);

  useEffect(() => {
    if (screen !== 'game' || controllerStatus !== 'active' || !activeSave) return;
    const timer = window.setInterval(() => {
      const save = activeSaveRef.current;
      if (!save) return;
      void repositories.current?.activeSave.heartbeat({ runId: save.runId, expectedRevision: save.revision, expectedControllerEpoch: save.controller.epoch, controllerId }).then((updated) => setActiveSave(updated)).catch(() => setControllerStatus('read-only'));
    }, 5000);
    return () => window.clearInterval(timer);
  }, [activeSave, controllerId, controllerStatus, screen, setActiveSave]);

  useEffect(() => {
    if (screen !== 'game') return;
    history.pushState({ oneMillionGame: true }, '', location.href);
    const onPopState = () => { if (gameRef.current && controllerStatus === 'active') void dispatchGame({ type: 'OPEN_PAUSE' }); history.pushState({ oneMillionGame: true }, '', location.href); };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [controllerStatus, dispatchGame, screen]);

  const commitCompletedRun = useCallback(async () => {
    const state = gameRef.current;
    if (!state?.terminalOutcome || state.phase !== 'completed') return;
    const save = activeSaveRef.current;
    if (!save) {
      const existing = await repositories.current?.runHistory.get(state.runId);
      if (existing) { setLastCommitted(existing); setCommitError(null); return; }
      setCommitError('The active save is missing. Export a backup before leaving this result.'); return;
    }
    setCommitPending(true); setCommitError(null);
    try {
      const result = await repositories.current!.runHistory.commitTerminalAndClearSave(terminalCommitFromRun(state), { runId: save.runId, expectedRevision: save.revision, controllerId, controllerEpoch: save.controller.epoch });
      setLastCommitted(result.record); setActiveSave(null); setSavedRun(null); setCommitError(null); await loadOwnerData(identity); notify('success', 'Result secured in local history.');
    } catch (error) { setCommitError(error instanceof Error ? error.message : 'The result could not be committed.'); }
    finally { setCommitPending(false); }
  }, [controllerId, identity, loadOwnerData, notify, setActiveSave]);

  useEffect(() => {
    if (game?.phase === 'completed' && game.terminalOutcome && persistedGameRevision >= game.saveRevision && !commitPending && !lastCommitted) void commitCompletedRun();
  }, [commitCompletedRun, commitPending, game, lastCommitted, persistedGameRevision]);

  const saveAndExit = useCallback(async () => {
    const saved = await saveQueue.current;
    if (!saved || persistenceError) { notify('error', 'The run cannot exit until its local save succeeds.'); return; }
    speechManager.cancel(); setScreen('dashboard'); setGame(null); await loadOwnerData(identity); audioManager.play('save');
  }, [identity, loadOwnerData, notify, persistenceError, setGame]);

  const finishToResults = useCallback(() => { if (gameRef.current?.phase === 'completed') setScreen('results'); }, []);
  useEffect(() => { if (game?.phase === 'completed' && screen === 'game') finishToResults(); }, [finishToResults, game?.phase, screen]);

  const reviewHistoryRun = useCallback((run: RunHistoryRecord) => { setSelectedHistoryRun(run); setScreen('review'); }, []);

  const exportBackup = useCallback(async () => {
    try { const backup = await repositories.current!.backup.export(); downloadJson(`one-million-backup-${new Date().toISOString().slice(0, 10)}.millionaire-backup.json`, backup); notify('success', 'Full local backup exported.'); }
    catch (error) { notify('error', error instanceof Error ? error.message : 'Backup export failed.'); }
  }, [notify]);
  const stageRestore = useCallback(async (file: File) => {
    try { const source = await readTextFile(file, 25 * 1024 * 1024); const summary = repositories.current!.backup.preview(source); setDialog({ kind: 'restore', source, summary }); setDialogError(null); }
    catch (error) { notify('error', error instanceof Error ? error.message : 'Backup validation failed.'); }
  }, [notify]);
  const confirmRestore = useCallback(async (source: string) => {
    try { await repositories.current!.backup.restore(source); setDialog(null); setIdentity(null); setScreen('title'); await reloadAll(); notify('success', 'Backup restored transactionally.'); }
    catch (error) { setDialogError(error instanceof Error ? error.message : 'Backup restore failed.'); }
  }, [notify, reloadAll]);

  const exportProfile = useCallback(async () => {
    if (identity?.kind !== 'profile') return;
    try {
      const service = repositories.current?.profileTransfer;
      if (!service) throw new Error('Profile transfer service is unavailable.');
      const payload = await service.export(identity.profile.id, true);
      downloadJson(`${identity.profile.displayName}-one-million-profile.json`, payload); notify('success', 'Profile package exported.');
    } catch (error) { notify('error', error instanceof Error ? error.message : 'Profile export failed.'); }
  }, [identity, notify]);
  const stageProfileImport = useCallback(async (file: File) => {
    try { const source = await readTextFile(file, 25 * 1024 * 1024); const preview = validateProfileExport(source); setDialog({ kind: 'profile-import', source, summary: `${preview.profile.displayName} · ${preview.runHistory.length} run${preview.runHistory.length === 1 ? '' : 's'} · ${preview.questionHistory.length} questions tracked` }); }
    catch (error) { notify('error', error instanceof Error ? error.message : 'Profile package validation failed.'); }
  }, [notify]);
  const confirmProfileImport = useCallback(async (source: string) => {
    try { const result = await repositories.current!.profileTransfer.import(source, { activeSavePolicy: activeSaveRef.current ? 'discard' : 'reject' }); setDialog(null); setProfiles(await repositories.current!.profiles.list()); await selectIdentity({ kind: 'profile', profile: result.profile }); notify('success', `${result.profile.displayName} imported as a new local profile.`); }
    catch (error) { setDialogError(error instanceof Error ? error.message : 'Profile import failed.'); }
  }, [notify, selectIdentity]);

  const refreshImported = useCallback(async () => {
    if (!repositories.current) return;
    setImported(await loadImported(repositories.current));
  }, [loadImported]);

  const commitContentPack = useCallback(async (payload: PreparedImportPayload, preview: ImportPreview) => {
    const bundle = await importedBundleFromNormalized(payload.pack);
    const downgrade = preview.warnings.some((warning) => warning.code === 'pack-downgrade');
    const result = await repositories.current!.importedPacks.install(bundle, {
      allowSameVersionReplacement: payload.operation === 'update',
      allowDowngrade: downgrade
    });
    await refreshImported();
    notify('success', `${result.pack.title} ${result.status === 'installed' ? 'installed' : result.status === 'updated' ? 'updated' : 'is already installed'}.`);
  }, [notify, refreshImported]);

  const storedPackParts = useCallback((packId: string) => {
    const pack = imported.packs.find((item) => item.id === packId);
    if (!pack) throw new Error('Custom pack not found.');
    return {
      pack,
      questions: imported.questions.filter((item) => item.packId === packId),
      sets: imported.sets.filter((item) => item.packId === packId)
    };
  }, [imported]);

  const exportContentPack = useCallback(async (packId: string) => {
    const parts = storedPackParts(packId);
    downloadJson(`${packId}.json`, rawPackFromStored(parts.pack, parts.questions, parts.sets));
    notify('success', `${parts.pack.title} exported.`);
  }, [notify, storedPackParts]);

  const duplicateContentPack = useCallback(async (packId: string) => {
    const parts = storedPackParts(packId);
    const raw = rawPackFromStored(parts.pack, parts.questions, parts.sets);
    raw.id = `${raw.id}-copy-${Date.now().toString(36)}`;
    raw.title = `${raw.title} Copy`;
    raw.version = '1.0.0';
    const prepared = prepareCustomPackImport(raw, contentIdentity, { enabled: true });
    if (prepared.status !== 'ready' || !prepared.payload) throw new Error(prepared.preview.errors[0]?.message ?? 'The pack copy did not validate.');
    await commitContentPack(prepared.payload, prepared.preview);
  }, [commitContentPack, contentIdentity, storedPackParts]);

  const toggleContentPack = useCallback(async (packId: string, enabled: boolean) => {
    await repositories.current!.importedPacks.setEnabled(packId, enabled);
    await refreshImported();
    notify('success', `${packId} ${enabled ? 'enabled' : 'disabled'} for future games.`);
  }, [notify, refreshImported]);

  const removeContentPack = useCallback(async (packId: string) => {
    await repositories.current!.importedPacks.remove(packId);
    await refreshImported();
    notify('success', `${packId} removed. Saved and historical snapshots remain intact.`);
  }, [notify, refreshImported]);

  if (booting) return <StageFrame><div className="boot-screen"><BrandMark /><div className="boot-line"><i /></div><p>Validating local systems and 525-question catalog…</p></div></StageFrame>;
  if (fatalError) return <StageFrame><div className="fatal-screen"><span className="kicker">Recovery mode</span><h1>One Million could not start.</h1><p>{fatalError}</p><div className="button-row"><button className="primary-button" type="button" onClick={() => location.reload()}>Retry startup</button></div></div></StageFrame>;

  const modeTitle = config.mode === 'fresh-mix' ? 'Fresh Mix' : config.mode === 'surprise' ? 'Surprise Me' : setDisplay.find((set) => set.id === config.selectedSetId)?.title ?? 'Curated Set';
  const audioLabel = audioSettings.masterMuted ? 'Muted' : [audioSettings.musicEnabled && 'Music', audioSettings.effectsEnabled && 'Effects', audioSettings.narrationEnabled && 'Narration'].filter(Boolean).join(' · ') || 'Silent';
  const historyReviewQuestions = selectedHistoryRun?.resolvedQuestions.map(resolvedQuestionFromSaved).filter((item): item is NonNullable<typeof item> => item !== null) ?? [];
  const historyReviewResults = selectedHistoryRun ? selectedHistoryRun.questionResults.map((result) => ({ questionId: result.questionId, level: result.level as LadderLevel, selectedChoiceId: result.selectedChoiceId ?? '', correctChoiceId: result.correctChoiceId ?? '', isCorrect: result.correct, hintUsed: result.hintUsed, phoneUsed: result.phoneUsed ?? false, winningsAfter: 0, guaranteedWinningsAfter: 0, answeredAtMs: Date.parse(selectedHistoryRun.completedAt) })) : [];

  return (
    <StageFrame>
      {screen === 'title' && <TitleScreen profiles={profiles} savedRun={savedRun} saveOwnerName={saveOwnerName} offlineReady={pwa.offlineReady} online={pwa.online} onSelectProfile={(profile) => void selectIdentity({ kind: 'profile', profile })} onGuest={() => void selectIdentity({ kind: 'guest', displayName: 'Guest' })} onCreateProfile={() => { setCreateName(''); setDialogError(null); setDialog({ kind: 'create-profile' }); }} onDeleteProfile={(profile) => { setDialogError(null); setDialog({ kind: 'delete-profile', profile }); }} onSettings={() => openGlobalScreen('settings')} onHelp={() => openGlobalScreen('help')} onContent={() => openGlobalScreen('content')} onFullscreen={() => void toggleFullscreen()} />}
      {screen === 'dashboard' && identity && <DashboardScreen identity={identity} savedRun={savedRun} saveOwnerName={saveOwnerName} ownsSave={ownsSave} runCount={runs.length} setWins={runs.filter((run) => run.outcome === 'millionaire').length} uniqueSeen={questionHistory.length} onContinue={() => void claimSavedRun()} onNewGame={() => { setConfig((current) => ({ ...current, selectedSetId: current.selectedSetId ?? setDisplay[0]?.id ?? null })); setDialogError(null); setScreen('new-game'); }} onStatistics={() => setScreen('statistics')} onHistory={() => setScreen('history')} onSets={() => setScreen('sets')} onContent={() => openGlobalScreen('content')} onSettings={() => openGlobalScreen('settings')} onHelp={() => openGlobalScreen('help')} onSwitchProfile={() => { setIdentity(null); setScreen('title'); }} onFullscreen={() => void toggleFullscreen()} />}
      {screen === 'new-game' && identity && <NewGameScreen playerName={playerName} config={config} sets={setDisplay} freshness={freshness} existingSave={savedRun} existingSaveOwner={saveOwnerName} settings={audioSettings} onConfig={setConfig} onSettings={(next) => void updateSettings(next)} onContinue={() => { setDialogError(null); setScreen('pre-game'); }} onBack={() => setScreen('dashboard')} onHelp={() => openGlobalScreen('help')} />}
      {screen === 'pre-game' && identity && <PreGameScreen playerName={playerName} config={config} modeTitle={modeTitle} freshness={freshness} audioLabel={audioLabel} existingSave={savedRun} existingSaveOwner={saveOwnerName} busy={beginBusy} error={dialogError} onBegin={() => void beginNewGame()} onBack={() => setScreen('new-game')} />}
      {screen === 'game' && game && <GameplayScreen state={game} nowMs={nowMs} playerName={playerName} controllerStatus={controllerStatus} controllerMessage={persistenceError ?? undefined} narrationStatus={narrationStatus} muted={audioSettings.masterMuted} onAction={(action) => { void dispatchGame(action); }} onReplayNarration={narrateCurrent} onSkipNarration={() => { speechManager.cancel(); setNarrationStatus('idle'); }} onToggleMute={() => void updateSettings({ ...audioSettings, masterMuted: !audioSettings.masterMuted })} onSaveAndExit={() => void saveAndExit()} onOpenSettings={() => setInGameSettings(true)} onTakeControl={() => setDialog({ kind: 'take-control' })} onCompleted={finishToResults} />}
      {screen === 'results' && game?.terminalOutcome && <ResultsScreen run={game} playerName={playerName} commitPending={commitPending} commitError={commitError} onRetryCommit={() => void commitCompletedRun()} onReview={() => setScreen('review')} onStatistics={() => setScreen('statistics')} onDashboard={() => { setGame(null); setScreen('dashboard'); }} onPlayAgain={() => { setGame(null); setScreen('new-game'); }} onSwitchProfile={() => { setGame(null); setIdentity(null); setScreen('title'); }} />}
      {screen === 'review' && game && !selectedHistoryRun && <RunReviewScreen questions={game.questions} results={game.results} displayedQuestionIds={game.displayedQuestionIds} title={`${modeTitle} · ${playerName}`} onBack={() => setScreen('results')} />}
      {screen === 'review' && selectedHistoryRun && <RunReviewScreen questions={historyReviewQuestions} results={historyReviewResults} displayedQuestionIds={historyReviewQuestions.map((q) => q.id)} title={`${selectedHistoryRun.setId ?? 'Fresh Mix'} · ${formatMoney(selectedHistoryRun.payout)}`} onBack={() => { setSelectedHistoryRun(null); setScreen('history'); }} />}
      {screen === 'statistics' && identity && <StatisticsScreen profile={identity.kind === 'profile' ? identity.profile : null} runs={runs} questionHistory={questionHistory} playerName={playerName} onBack={() => setScreen(game?.terminalOutcome ? 'results' : 'dashboard')} />}
      {screen === 'history' && identity && <HistoryScreen runs={runs} playerName={playerName} onBack={() => setScreen('dashboard')} onSelect={reviewHistoryRun} />}
      {screen === 'sets' && identity && <SetProgressScreen sets={gameCatalog.all.sets} progress={setProgress} playerName={playerName} onBack={() => setScreen('dashboard')} onPlay={(setId) => { setConfig({ mode: 'curated-set', selectedSetId: setId, contentScope: 'all-enabled' }); setScreen('pre-game'); }} />}
      {screen === 'settings' && <SettingsScreen settings={audioSettings} voices={voices} playerIsProfile={identity?.kind === 'profile'} offlineReady={pwa.offlineReady} online={pwa.online} updateAvailable={pwa.updateAvailable} storageMessage={storageMessage} onChange={(next) => void updateSettings(next)} onBack={() => setScreen(returnScreen === 'game' ? 'dashboard' : returnScreen)} onFullscreen={() => void toggleFullscreen()} onApplyUpdate={() => void pwa.applyUpdate()} onExportBackup={() => void exportBackup()} onRestoreBackup={(file) => void stageRestore(file)} onExportProfile={() => void exportProfile()} onImportProfile={(file) => void stageProfileImport(file)} onResetAll={() => { setDialogError(null); setDialog({ kind: 'reset-all' }); }} />}
      {screen === 'help' && <GenericScreen title="How to Play" kicker="Knowledge ascent handbook" onBack={() => setScreen(returnScreen)}><HelpContent /></GenericScreen>}
      {screen === 'content' && <ContentManagerScreen installedPacks={managedPacks} existingIdentity={contentIdentity} builtInSummary={builtInCatalogRef.current?.summary} onBack={() => setScreen(returnScreen)} onTogglePack={toggleContentPack} onExportPack={exportContentPack} onDuplicatePack={duplicateContentPack} onRemovePack={removeContentPack} onCommitPack={commitContentPack} onDownloadText={(filename, contents, mimeType) => downloadText(filename, contents, mimeType)} />}

      {inGameSettings && <Modal wide title="In-game settings" onClose={() => setInGameSettings(false)} actions={<button type="button" className="primary-button" onClick={() => setInGameSettings(false)}>Return to Game</button>}><SettingsPanel compact settings={audioSettings} voices={voices} onChange={(next) => void updateSettings(next)} /></Modal>}
      <DialogLayer dialog={dialog} createName={createName} error={dialogError} onName={setCreateName} onClose={() => { setDialog(null); setDialogError(null); }} onCreate={() => void createProfile()} onDelete={(profile) => void deleteProfile(profile)} onTakeControl={() => void claimSavedRun(true)} onReset={async () => { repositories.current?.close(); await deleteAppDatabase(); location.reload(); }} onRestore={(source) => void confirmRestore(source)} onProfileImport={(source) => void confirmProfileImport(source)} />
      <ToastRegion messages={toasts} onDismiss={(id) => setToasts((items) => items.filter((item) => item.id !== id))} />
    </StageFrame>
  );
}

function StageFrame({ children }: { children: React.ReactNode }) {
  return <div className="app-frame"><div className="stage"><StageBackground />{children}<div className="minimum-notice"><div className="minimum-notice__card"><BrandMark compact /><h1>Give the stage a little more room.</h1><p>One Million is designed for a widescreen desktop. Enlarge this window to keep every answer and control comfortably visible.</p></div></div></div></div>;
}

function GenericScreen({ title, kicker, onBack, children }: { title: string; kicker: string; onBack: () => void; children: React.ReactNode }) {
  return <main className="screen generic-screen"><header className="utility-bar"><div><div className="utility-label">Reference</div><div className="utility-value">{title}</div></div><div className="utility-bar__spacer" /><button type="button" className="quiet-button" onClick={onBack}>← Back</button></header><div className="generic-body screen-scroll"><span className="kicker">{kicker}</span><h1>{title}</h1>{children}</div></main>;
}

function DialogLayer(props: {
  dialog: DialogState; createName: string; error: string | null; onName: (name: string) => void; onClose: () => void; onCreate: () => void; onDelete: (profile: ProfileRecord) => void; onTakeControl: () => void; onReset: () => void; onRestore: (source: string) => void; onProfileImport: (source: string) => void;
}) {
  const dialog = props.dialog;
  if (!dialog) return null;
  if (dialog.kind === 'create-profile') return <Modal title="Create local profile" onClose={props.onClose} actions={<><button type="button" className="secondary-button" onClick={props.onClose}>Cancel</button><button type="button" className="primary-button" onClick={props.onCreate} disabled={!props.createName.trim()}>Create Profile</button></>}><label className="field-stack"><span>Display name</span><input autoComplete="off" maxLength={40} type="text" value={props.createName} onChange={(event) => props.onName(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && props.createName.trim()) props.onCreate(); }} /><small className="field-help">1–40 characters. Duplicate display names are allowed; profiles use separate internal IDs.</small></label>{props.error && <p className="field-error" role="alert">{props.error}</p>}</Modal>;
  if (dialog.kind === 'delete-profile') return <Modal destructive title={`Delete ${dialog.profile.displayName}?`} onClose={props.onClose} actions={<><button type="button" className="secondary-button" onClick={props.onClose}>Keep Profile</button><button type="button" className="danger-button" onClick={() => props.onDelete(dialog.profile)}>Delete Permanently</button></>}><p>This permanently removes the profile’s career statistics, question encounters, set progress, and run history.</p><div className="notice notice--error"><span>!</span><div>If this profile owns the single global saved run, that save is deleted too. This cannot be undone without an exported backup.</div></div>{props.error && <p className="field-error">{props.error}</p>}</Modal>;
  if (dialog.kind === 'take-control') return <Modal title="Run active in another tab" onClose={props.onClose} actions={<><button type="button" className="secondary-button" onClick={props.onClose}>Leave It There</button><button type="button" className="primary-button" onClick={props.onTakeControl}>Take Control Here</button></>}><p>Only one tab may control a saved run. Taking control makes the other tab read-only and protects newer progress from stale writes.</p>{props.error && <p className="field-error">{props.error}</p>}</Modal>;
  if (dialog.kind === 'reset-all') return <Modal destructive title="Reset all local data?" onClose={props.onClose} actions={<><button type="button" className="secondary-button" onClick={props.onClose}>Cancel</button><button type="button" className="danger-button" onClick={props.onReset}>Reset Everything</button></>}><p>This deletes every profile, run, question encounter, setting, active save, and imported pack in this browser.</p><div className="notice notice--error"><span>!</span><div>Export a full backup first if any of this data matters. The operation cannot be undone.</div></div></Modal>;
  if (dialog.kind === 'restore') return <Modal destructive title="Replace local data with this backup?" onClose={props.onClose} actions={<><button type="button" className="secondary-button" onClick={props.onClose}>Cancel</button><button type="button" className="danger-button" onClick={() => props.onRestore(dialog.source)}>Validate Again & Restore</button></>}><div className="modal-card-grid"><div className="data-stat"><span>Profiles</span><strong>{dialog.summary.profiles}</strong></div><div className="data-stat"><span>Completed runs</span><strong>{dialog.summary.runs}</strong></div><div className="data-stat"><span>Custom packs</span><strong>{dialog.summary.importedPacks}</strong></div><div className="data-stat"><span>Active save</span><strong>{dialog.summary.hasActiveSave ? 'Yes' : 'No'}</strong></div></div><p>The complete file was parsed, schema-checked, and cross-reference-checked in memory. Restore is transactional: current data remains unchanged if any write fails.</p>{props.error && <p className="field-error">{props.error}</p>}</Modal>;
  return <Modal title="Import this profile?" onClose={props.onClose} actions={<><button type="button" className="secondary-button" onClick={props.onClose}>Cancel</button><button type="button" className="primary-button" onClick={() => props.onProfileImport(dialog.source)}>Create New Profile</button></>}><p>{dialog.summary}</p><p>A fresh internal profile ID will be assigned. Existing profiles and their history are never overwritten.</p>{props.error && <p className="field-error">{props.error}</p>}</Modal>;
}
