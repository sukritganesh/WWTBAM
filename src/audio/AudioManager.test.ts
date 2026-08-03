import { describe, expect, it, vi } from 'vitest';
import { AudioManager, type MusicElement } from './AudioManager';
import { RUN_MUSIC_CATALOG, selectRunMusic } from './musicCatalog';
import { SOUND_REGISTRY } from './soundRegistry';
import { DEFAULT_AUDIO_PREFERENCES } from './types';

class FakeMusicElement implements MusicElement {
  loop = false;
  preload = '';
  volume = 1;
  currentTime = 0;
  private playing = false;

  get paused() {
    return !this.playing;
  }

  readonly play = vi.fn(async () => {
    this.playing = true;
  });

  readonly pause = vi.fn(() => {
    this.playing = false;
  });
}

describe('audio registry', () => {
  it('has a valid finite recipe for every logical event', () => {
    for (const recipe of Object.values(SOUND_REGISTRY)) {
      expect(recipe.frequencies.length).toBeGreaterThan(0);
      expect(recipe.frequencies.every((value) => Number.isFinite(value) && value > 0)).toBe(true);
      expect(recipe.duration).toBeGreaterThan(0);
      expect(recipe.gain).toBeLessThan(0.1);
    }
  });

  it('keeps channel volumes in range', () => {
    expect(DEFAULT_AUDIO_PREFERENCES.musicVolume).toBeGreaterThanOrEqual(0);
    expect(DEFAULT_AUDIO_PREFERENCES.effectsVolume).toBeLessThanOrEqual(1);
  });
});

describe('recorded music playlists', () => {
  it('selects one valid track per scene deterministically from the run ID', () => {
    const first = selectRunMusic('run-alpha');
    const restored = selectRunMusic('run-alpha');

    expect(restored).toEqual(first);
    expect(RUN_MUSIC_CATALOG.level1).toContain(first.level1);
    expect(RUN_MUSIC_CATALOG.level2).toContain(first.level2);
    expect(RUN_MUSIC_CATALOG.level3).toContain(first.level3);
    expect(RUN_MUSIC_CATALOG.pause).toContain(first.pause);
    expect(RUN_MUSIC_CATALOG.outro).toContain(first.outro);
    expect(new Set(Array.from({ length: 20 }, (_, index) => selectRunMusic(`run-${index}`).level2)).size).toBeGreaterThan(1);
  });

  it('pauses and resumes game and pause tracks at their retained positions', () => {
    const elements = new Map<string, FakeMusicElement>();
    const manager = new AudioManager((source) => {
      const element = new FakeMusicElement();
      elements.set(source, element);
      return element;
    });
    const playlist = selectRunMusic('run-resume');

    manager.configure({ ...DEFAULT_AUDIO_PREFERENCES, musicVolume: 0.5 });
    manager.setMusicScene('level-1', playlist.runId);
    const gameplay = elements.get(playlist.level1);
    expect(gameplay).toBeDefined();
    gameplay!.currentTime = 42;

    manager.setMusicScene('pause', playlist.runId);
    const pause = elements.get(playlist.pause);
    expect(gameplay!.pause).toHaveBeenCalledOnce();
    expect(pause).toBeDefined();
    pause!.currentTime = 17;

    manager.setMusicScene('level-1', playlist.runId);
    expect(gameplay!.currentTime).toBe(42);
    expect(gameplay!.play).toHaveBeenCalledTimes(2);

    manager.setMusicScene('pause', playlist.runId);
    expect(pause!.currentTime).toBe(17);
    expect(pause!.play).toHaveBeenCalledTimes(2);
  });

  it('preserves the active position through mute and applies narration ducking', () => {
    const elements = new Map<string, FakeMusicElement>();
    const manager = new AudioManager((source) => {
      const element = new FakeMusicElement();
      elements.set(source, element);
      return element;
    });
    const playlist = selectRunMusic('run-settings');

    manager.configure({ ...DEFAULT_AUDIO_PREFERENCES, musicVolume: 0.5 });
    manager.setMusicScene('level-2', playlist.runId);
    const music = elements.get(playlist.level2)!;
    music.currentTime = 28;

    manager.setDucked(true);
    expect(music.volume).toBeCloseTo(0.11);
    manager.configure({ ...DEFAULT_AUDIO_PREFERENCES, musicVolume: 0.5, masterMuted: true });
    expect(music.pause).toHaveBeenCalledOnce();
    expect(music.currentTime).toBe(28);

    manager.configure({ ...DEFAULT_AUDIO_PREFERENCES, musicVolume: 0.5 });
    expect(music.play).toHaveBeenCalledTimes(2);
    expect(music.currentTime).toBe(28);
  });
});
