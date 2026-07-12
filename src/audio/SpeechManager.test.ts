import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AudioManager } from './AudioManager';
import { SpeechManager } from './SpeechManager';
import { DEFAULT_AUDIO_PREFERENCES } from './types';

describe('SpeechManager', () => {
  const originalSpeech = window.speechSynthesis;
  const originalUtterance = globalThis.SpeechSynthesisUtterance;

  afterEach(() => {
    Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: originalSpeech });
    Object.defineProperty(globalThis, 'SpeechSynthesisUtterance', { configurable: true, value: originalUtterance });
  });

  it('discovers local English voices, ducks music, and cancels cleanly', () => {
    let spoken: SpeechSynthesisUtterance | null = null;
    const localVoice = { voiceURI: 'local-en', name: 'Local English', lang: 'en-US', localService: true, default: true } as SpeechSynthesisVoice;
    const foreignVoice = { voiceURI: 'foreign', name: 'Foreign', lang: 'fr-FR', localService: true, default: false } as SpeechSynthesisVoice;
    const synthesis = {
      getVoices: vi.fn(() => [foreignVoice, localVoice]),
      addEventListener: vi.fn(),
      speak: vi.fn((utterance: SpeechSynthesisUtterance) => { spoken = utterance; utterance.onstart?.({} as SpeechSynthesisEvent); }),
      cancel: vi.fn()
    };
    class FakeUtterance {
      text: string;
      voice: SpeechSynthesisVoice | null = null;
      rate = 1;
      volume = 1;
      onstart: ((event: SpeechSynthesisEvent) => void) | null = null;
      onend: ((event: SpeechSynthesisEvent) => void) | null = null;
      onerror: ((event: SpeechSynthesisErrorEvent) => void) | null = null;
      constructor(text: string) { this.text = text; }
    }
    Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: synthesis });
    Object.defineProperty(globalThis, 'SpeechSynthesisUtterance', { configurable: true, value: FakeUtterance });
    const setDucked = vi.fn();
    const manager = new SpeechManager({ setDucked } as unknown as AudioManager);

    expect(manager.getVoices()).toEqual([localVoice]);
    expect(manager.speak('Question text', { ...DEFAULT_AUDIO_PREFERENCES, narrationEnabled: true }, vi.fn())).toBe(true);
    expect(spoken).not.toBeNull();
    expect((spoken as SpeechSynthesisUtterance | null)?.voice).toBe(localVoice);
    expect(setDucked).toHaveBeenCalledWith(true);
    (spoken as SpeechSynthesisUtterance | null)?.onend?.({} as SpeechSynthesisEvent);
    expect(setDucked).toHaveBeenLastCalledWith(false);
    manager.cancel();
    expect(synthesis.cancel).toHaveBeenCalled();
  });

  it('never introduces a delay when narration is disabled', () => {
    const manager = new SpeechManager({ setDucked: vi.fn() } as unknown as AudioManager);
    expect(manager.speak('Visible question', DEFAULT_AUDIO_PREFERENCES)).toBe(false);
  });
});
