import type { AudioPreferences } from './types';
import type { AudioManager } from './AudioManager';

export class SpeechManager {
  private voices: SpeechSynthesisVoice[] = [];
  private listeners = new Set<() => void>();

  constructor(private readonly audio: AudioManager) {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      this.refreshVoices();
      window.speechSynthesis.addEventListener('voiceschanged', this.refreshVoices);
    }
  }

  readonly refreshVoices = (): void => {
    if (!window.speechSynthesis) return;
    this.voices = window.speechSynthesis.getVoices().filter((voice) => /^en([-_]|$)/i.test(voice.lang));
    this.listeners.forEach((listener) => listener());
  };

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  getVoices(): readonly SpeechSynthesisVoice[] {
    return this.voices;
  }

  speak(text: string, settings: AudioPreferences, onEnd?: () => void): boolean {
    if (!settings.narrationEnabled || settings.masterMuted || !window.speechSynthesis || !text.trim()) return false;
    this.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    const preferred = this.voices.find((voice) => voice.voiceURI === settings.voiceURI)
      ?? this.voices.find((voice) => voice.localService)
      ?? this.voices[0];
    if (preferred) utterance.voice = preferred;
    utterance.rate = settings.speechRate;
    utterance.volume = settings.narrationVolume;
    utterance.onstart = () => this.audio.setDucked(true);
    const finish = () => {
      this.audio.setDucked(false);
      onEnd?.();
    };
    utterance.onend = finish;
    utterance.onerror = finish;
    window.speechSynthesis.speak(utterance);
    return true;
  }

  cancel(): void {
    window.speechSynthesis?.cancel();
    this.audio.setDucked(false);
  }
}

import { audioManager } from './AudioManager';
export const speechManager = new SpeechManager(audioManager);
