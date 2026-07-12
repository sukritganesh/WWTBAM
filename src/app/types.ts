import type { ProfileRecord, RunHistoryRecord } from '../data/types';
import type { GameRunState } from '../game';

export type ScreenId =
  | 'title'
  | 'dashboard'
  | 'new-game'
  | 'pre-game'
  | 'game'
  | 'results'
  | 'review'
  | 'statistics'
  | 'history'
  | 'sets'
  | 'settings'
  | 'help'
  | 'content';

export type ActiveIdentity =
  | { kind: 'profile'; profile: ProfileRecord }
  | { kind: 'guest'; displayName: 'Guest' };

export type NewGameMode = 'fresh-mix' | 'curated-set' | 'surprise';
export type ContentScope = 'built-in' | 'all-enabled';

export interface NewGameConfig {
  mode: NewGameMode;
  selectedSetId: string | null;
  contentScope: ContentScope;
}

export interface ToastMessage {
  id: string;
  kind: 'info' | 'success' | 'warning' | 'error';
  message: string;
}

export interface CompletedRunView {
  state: GameRunState;
  history: RunHistoryRecord | null;
}
