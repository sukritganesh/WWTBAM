import { musicSourceForScene, selectRunMusic, type RunMusicPlaylist } from './musicCatalog';
import { SOUND_REGISTRY } from './soundRegistry';
import {
  DEFAULT_AUDIO_PREFERENCES,
  type AudioPreferences,
  type MusicScene,
  type SoundEvent,
} from './types';

export interface MusicElement {
  loop: boolean;
  preload: string;
  volume: number;
  currentTime: number;
  readonly paused: boolean;
  play(): Promise<void>;
  pause(): void;
}

export type MusicElementFactory = (source: string) => MusicElement;

const createBrowserMusicElement: MusicElementFactory = (source) => {
  const element = new Audio(source);
  element.loop = true;
  element.preload = 'auto';
  return element;
};

export class AudioManager {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private effects: GainNode | null = null;
  private preferences: AudioPreferences = DEFAULT_AUDIO_PREFERENCES;
  private ducked = false;
  private lastPlayed = new Map<SoundEvent, number>();

  private musicScene: MusicScene = 'silent';
  private runPlaylist: RunMusicPlaylist | null = null;
  private musicElements = new Map<string, MusicElement>();
  private activeMusic: MusicElement | null = null;
  private activeMusicSource: string | null = null;

  constructor(
    private readonly createMusicElement: MusicElementFactory = createBrowserMusicElement,
  ) {}

  async unlock(): Promise<boolean> {
    // Calling play synchronously from the user's gesture is important for
    // browsers that reject delayed autoplay attempts.
    this.startActiveMusic();
    if (typeof window === 'undefined' || !('AudioContext' in window || 'webkitAudioContext' in window)) {
      return false;
    }
    try {
      if (!this.context) this.createGraph();
      if (this.context?.state === 'suspended') await this.context.resume();
      this.startActiveMusic();
      return this.context?.state === 'running';
    } catch {
      return false;
    }
  }

  configure(preferences: AudioPreferences): void {
    this.preferences = preferences;
    this.applyLevels();
    if (!this.musicCanPlay()) this.activeMusic?.pause();
    else this.startActiveMusic();
  }

  setMusicScene(scene: MusicScene, runId?: string): void {
    if (runId) this.ensureRunPlaylist(runId);
    const source = musicSourceForScene(scene, this.runPlaylist);
    this.musicScene = scene;

    if (source === this.activeMusicSource) {
      this.applyMusicLevel();
      this.startActiveMusic();
      return;
    }

    this.activeMusic?.pause();
    this.activeMusicSource = source;
    this.activeMusic = source ? this.getMusicElement(source) : null;
    this.applyMusicLevel();
    this.startActiveMusic();
  }

  setDucked(ducked: boolean): void {
    this.ducked = ducked;
    this.applyMusicLevel();
  }

  play(event: SoundEvent): void {
    if (this.preferences.masterMuted || !this.preferences.effectsEnabled) return;
    const now = performance.now();
    const last = this.lastPlayed.get(event) ?? -Infinity;
    if (now - last < (event === 'phone-tick' ? 250 : 70)) return;
    this.lastPlayed.set(event, now);
    void this.unlock().then((ready) => {
      if (!ready || !this.context || !this.effects) return;
      const recipe = SOUND_REGISTRY[event];
      const start = this.context.currentTime;
      recipe.frequencies.forEach((frequency, index) => {
        const oscillator = this.context!.createOscillator();
        const envelope = this.context!.createGain();
        const offset = index * Math.min(0.07, recipe.duration / Math.max(2, recipe.frequencies.length));
        oscillator.type = recipe.waveform;
        oscillator.frequency.setValueAtTime(frequency, start + offset);
        if (recipe.sweep) oscillator.frequency.exponentialRampToValueAtTime(Math.max(30, frequency + recipe.sweep), start + offset + recipe.duration);
        envelope.gain.setValueAtTime(0.0001, start + offset);
        envelope.gain.exponentialRampToValueAtTime(recipe.gain, start + offset + 0.012);
        envelope.gain.exponentialRampToValueAtTime(0.0001, start + offset + recipe.duration);
        oscillator.connect(envelope).connect(this.effects!);
        oscillator.start(start + offset);
        oscillator.stop(start + offset + recipe.duration + 0.02);
      });
    });
  }

  suspend(): void {
    this.activeMusic?.pause();
    void this.context?.suspend();
  }

  private ensureRunPlaylist(runId: string): void {
    if (this.runPlaylist?.runId === runId) return;

    for (const [source, element] of this.musicElements) {
      if (source.includes('/intro/')) continue;
      element.pause();
      this.musicElements.delete(source);
    }
    if (this.activeMusicSource && !this.activeMusicSource.includes('/intro/')) {
      this.activeMusic = null;
      this.activeMusicSource = null;
    }
    this.runPlaylist = selectRunMusic(runId);
  }

  private getMusicElement(source: string): MusicElement {
    const existing = this.musicElements.get(source);
    if (existing) return existing;
    const element = this.createMusicElement(source);
    element.loop = true;
    element.preload = 'auto';
    this.musicElements.set(source, element);
    return element;
  }

  private musicCanPlay(): boolean {
    return Boolean(
      this.activeMusic &&
      this.musicScene !== 'silent' &&
      !this.preferences.masterMuted &&
      this.preferences.musicEnabled,
    );
  }

  private startActiveMusic(): void {
    if (!this.musicCanPlay() || !this.activeMusic?.paused) return;
    try {
      void this.activeMusic.play().catch(() => {
        // Autoplay rejection is expected before the first user interaction.
      });
    } catch {
      // Some test and legacy media implementations throw synchronously.
    }
  }

  private applyMusicLevel(): void {
    if (!this.activeMusic) return;
    const level = this.preferences.musicVolume * (this.ducked ? 0.22 : 1);
    this.activeMusic.volume = Math.max(0, Math.min(1, level));
  }

  private createGraph(): void {
    const Context = window.AudioContext ?? window.webkitAudioContext;
    this.context = new Context();
    this.master = this.context.createGain();
    this.effects = this.context.createGain();
    this.effects.connect(this.master);
    this.master.connect(this.context.destination);
    this.applyLevels();
  }

  private applyLevels(): void {
    this.applyMusicLevel();
    if (!this.context || !this.master || !this.effects) return;
    const at = this.context.currentTime;
    this.master.gain.setTargetAtTime(this.preferences.masterMuted ? 0 : 1, at, 0.025);
    this.effects.gain.setTargetAtTime(this.preferences.effectsEnabled ? this.preferences.effectsVolume : 0, at, 0.02);
  }
}

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}

export const audioManager = new AudioManager();
