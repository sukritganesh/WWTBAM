import { DEFAULT_AUDIO_PREFERENCES, type AudioPreferences } from '../audio/types';
import type { GlobalSettingsRecord } from '../data';

export function audioPreferencesFromRecord(record: GlobalSettingsRecord | null): AudioPreferences {
  if (!record) return DEFAULT_AUDIO_PREFERENCES;
  return {
    masterMuted: record.masterMuted,
    musicEnabled: record.musicEnabled,
    musicVolume: record.musicVolume,
    effectsEnabled: record.effectsEnabled,
    effectsVolume: record.effectsVolume,
    narrationEnabled: record.narrationEnabled,
    narrationVolume: record.narrationVolume,
    voiceURI: record.voiceSelectionId,
    speechRate: record.speechRate,
    readAnswers: record.readAnswers,
    readHints: record.readHints,
    reducedMotion: record.reducedMotion,
    reducedGlow: record.reducedGlow,
    highContrast: record.highContrast,
    fullscreenPreferred: record.fullscreenPreferred,
    autoAdvance: record.autoAdvance ?? false
  };
}

export function settingsPatchFromAudio(settings: AudioPreferences): Partial<Omit<GlobalSettingsRecord, 'id' | 'updatedAt'>> {
  return {
    masterMuted: settings.masterMuted,
    musicEnabled: settings.musicEnabled,
    musicVolume: settings.musicVolume,
    effectsEnabled: settings.effectsEnabled,
    effectsVolume: settings.effectsVolume,
    narrationEnabled: settings.narrationEnabled,
    narrationVolume: settings.narrationVolume,
    voiceSelectionId: settings.voiceURI,
    speechRate: settings.speechRate,
    readAnswers: settings.readAnswers,
    readHints: settings.readHints,
    fullscreenPreferred: settings.fullscreenPreferred,
    reducedMotion: settings.reducedMotion,
    reducedGlow: settings.reducedGlow,
    highContrast: settings.highContrast,
    autoAdvance: settings.autoAdvance
  };
}
