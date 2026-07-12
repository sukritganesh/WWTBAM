export type MusicTier = 'menu' | 'early' | 'middle' | 'late' | 'final' | 'silent';

export type SoundEvent =
  | 'press'
  | 'back'
  | 'confirm'
  | 'cancel'
  | 'panel-open'
  | 'save'
  | 'profile-create'
  | 'profile-delete'
  | 'game-intro'
  | 'question-enter'
  | 'answer-select'
  | 'answer-lock'
  | 'correct'
  | 'incorrect'
  | 'checkpoint'
  | 'walk-away'
  | 'victory'
  | 'hint'
  | 'phone-start'
  | 'phone-tick'
  | 'phone-end'
  | 'warning';

export interface AudioPreferences {
  masterMuted: boolean;
  musicEnabled: boolean;
  musicVolume: number;
  effectsEnabled: boolean;
  effectsVolume: number;
  narrationEnabled: boolean;
  narrationVolume: number;
  voiceURI: string | null;
  speechRate: number;
  readAnswers: boolean;
  readHints: boolean;
  reducedMotion: boolean;
  reducedGlow: boolean;
  highContrast: boolean;
  fullscreenPreferred: boolean;
  autoAdvance: boolean;
}

export const DEFAULT_AUDIO_PREFERENCES: AudioPreferences = {
  masterMuted: false,
  musicEnabled: true,
  musicVolume: 0.28,
  effectsEnabled: true,
  effectsVolume: 0.55,
  narrationEnabled: false,
  narrationVolume: 1,
  voiceURI: null,
  speechRate: 1,
  readAnswers: true,
  readHints: true,
  reducedMotion: false,
  reducedGlow: false,
  highContrast: false,
  fullscreenPreferred: false,
  autoAdvance: false
};
