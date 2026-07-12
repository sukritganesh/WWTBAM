import { describe, expect, it } from 'vitest';
import { SOUND_REGISTRY } from './soundRegistry';
import { DEFAULT_AUDIO_PREFERENCES } from './types';

describe('procedural audio registry', () => {
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
