import { SOUND_REGISTRY } from './soundRegistry';
import { DEFAULT_AUDIO_PREFERENCES, type AudioPreferences, type MusicTier, type SoundEvent } from './types';

const TIER_FREQUENCIES: Record<Exclude<MusicTier, 'silent'>, readonly [number, number]> = {
  menu: [55, 82.41],
  early: [65.41, 98],
  middle: [58.27, 87.31],
  late: [49, 73.42],
  final: [41.2, 61.74]
};

export class AudioManager {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private music: GainNode | null = null;
  private effects: GainNode | null = null;
  private musicOscillators: OscillatorNode[] = [];
  private preferences: AudioPreferences = DEFAULT_AUDIO_PREFERENCES;
  private tier: MusicTier = 'silent';
  private ducked = false;
  private lastPlayed = new Map<SoundEvent, number>();

  async unlock(): Promise<boolean> {
    if (typeof window === 'undefined' || !('AudioContext' in window || 'webkitAudioContext' in window)) return false;
    try {
      if (!this.context) this.createGraph();
      if (this.context?.state === 'suspended') await this.context.resume();
      return this.context?.state === 'running';
    } catch {
      return false;
    }
  }

  configure(preferences: AudioPreferences): void {
    this.preferences = preferences;
    this.applyLevels();
    if (!preferences.musicEnabled || preferences.masterMuted) this.stopMusic();
    else if (this.tier !== 'silent' && this.musicOscillators.length === 0) this.startMusic(this.tier);
  }

  setMusicTier(tier: MusicTier): void {
    if (tier === this.tier && (tier === 'silent' || this.musicOscillators.length > 0)) return;
    this.tier = tier;
    this.stopMusic();
    if (tier !== 'silent' && this.preferences.musicEnabled && !this.preferences.masterMuted) this.startMusic(tier);
  }

  setDucked(ducked: boolean): void {
    this.ducked = ducked;
    this.applyLevels();
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
    void this.context?.suspend();
  }

  private createGraph(): void {
    const Context = window.AudioContext ?? window.webkitAudioContext;
    this.context = new Context();
    this.master = this.context.createGain();
    this.music = this.context.createGain();
    this.effects = this.context.createGain();
    this.music.connect(this.master);
    this.effects.connect(this.master);
    this.master.connect(this.context.destination);
    this.applyLevels();
  }

  private applyLevels(): void {
    if (!this.context || !this.master || !this.music || !this.effects) return;
    const at = this.context.currentTime;
    this.master.gain.setTargetAtTime(this.preferences.masterMuted ? 0 : 1, at, 0.025);
    this.effects.gain.setTargetAtTime(this.preferences.effectsEnabled ? this.preferences.effectsVolume : 0, at, 0.02);
    const musicLevel = this.preferences.musicEnabled ? this.preferences.musicVolume * (this.ducked ? 0.22 : 1) : 0;
    this.music.gain.setTargetAtTime(musicLevel, at, 0.08);
  }

  private startMusic(tier: MusicTier): void {
    if (tier === 'silent') return;
    void this.unlock().then((ready) => {
      if (!ready || !this.context || !this.music || this.musicOscillators.length > 0 || this.tier !== tier) return;
      const frequencies = TIER_FREQUENCIES[tier];
      this.musicOscillators = frequencies.map((frequency, index) => {
        const oscillator = this.context!.createOscillator();
        const gain = this.context!.createGain();
        oscillator.type = index === 0 ? 'sine' : 'triangle';
        oscillator.frequency.value = frequency;
        oscillator.detune.value = index === 0 ? -4 : 5;
        gain.gain.value = index === 0 ? 0.045 : 0.018;
        oscillator.connect(gain).connect(this.music!);
        oscillator.start();
        return oscillator;
      });
    });
  }

  private stopMusic(): void {
    for (const oscillator of this.musicOscillators) {
      try { oscillator.stop(); } catch { /* oscillator may already be stopped */ }
      oscillator.disconnect();
    }
    this.musicOscillators = [];
  }
}

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}

export const audioManager = new AudioManager();
