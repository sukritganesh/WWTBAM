import type { SoundEvent } from './types';

export interface SynthRecipe {
  frequencies: readonly number[];
  duration: number;
  waveform: OscillatorType;
  gain: number;
  sweep?: number;
}

// These original procedural recipes avoid licensed binary assets while keeping every
// sound replaceable through one registry. They deliberately use restrained intervals.
export const SOUND_REGISTRY: Record<SoundEvent, SynthRecipe> = {
  press: { frequencies: [420], duration: 0.045, waveform: 'sine', gain: 0.045 },
  back: { frequencies: [360, 260], duration: 0.08, waveform: 'sine', gain: 0.04 },
  confirm: { frequencies: [440, 660], duration: 0.11, waveform: 'sine', gain: 0.055 },
  cancel: { frequencies: [300, 230], duration: 0.1, waveform: 'triangle', gain: 0.04 },
  'panel-open': { frequencies: [240, 420], duration: 0.13, waveform: 'sine', gain: 0.035, sweep: 90 },
  save: { frequencies: [520, 780], duration: 0.16, waveform: 'sine', gain: 0.045 },
  'profile-create': { frequencies: [392, 523, 659], duration: 0.2, waveform: 'sine', gain: 0.05 },
  'profile-delete': { frequencies: [330, 247], duration: 0.18, waveform: 'triangle', gain: 0.045 },
  'game-intro': { frequencies: [110, 220, 440], duration: 0.38, waveform: 'sine', gain: 0.065, sweep: 55 },
  'question-enter': { frequencies: [280, 420], duration: 0.14, waveform: 'sine', gain: 0.04 },
  'answer-select': { frequencies: [500, 750], duration: 0.09, waveform: 'sine', gain: 0.05 },
  'answer-lock': { frequencies: [180, 360, 720], duration: 0.3, waveform: 'triangle', gain: 0.07, sweep: -40 },
  correct: { frequencies: [392, 523, 659], duration: 0.34, waveform: 'sine', gain: 0.075 },
  incorrect: { frequencies: [240, 180, 120], duration: 0.38, waveform: 'triangle', gain: 0.07, sweep: -55 },
  checkpoint: { frequencies: [392, 523, 659, 784], duration: 0.55, waveform: 'sine', gain: 0.075 },
  'walk-away': { frequencies: [440, 370, 294], duration: 0.42, waveform: 'sine', gain: 0.06 },
  victory: { frequencies: [262, 392, 523, 659, 784], duration: 0.9, waveform: 'sine', gain: 0.085, sweep: 30 },
  hint: { frequencies: [620, 930], duration: 0.2, waveform: 'sine', gain: 0.05, sweep: 80 },
  'phone-start': { frequencies: [440, 520], duration: 0.16, waveform: 'sine', gain: 0.045 },
  'phone-tick': { frequencies: [880], duration: 0.035, waveform: 'sine', gain: 0.035 },
  'phone-end': { frequencies: [520, 350], duration: 0.16, waveform: 'sine', gain: 0.045 },
  warning: { frequencies: [220, 220], duration: 0.24, waveform: 'triangle', gain: 0.055 }
};
