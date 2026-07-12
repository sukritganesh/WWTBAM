export type RandomSeed = number | string;

export interface RandomStep {
  readonly value: number;
  readonly nextSeed: number;
}

export interface SeededResult<T> {
  readonly value: T;
  readonly nextSeed: number;
}

const NON_ZERO_FALLBACK_SEED = 0x6d2b79f5;

/** FNV-1a gives stable string seeds without relying on platform hashing. */
export function normalizeSeed(seed: RandomSeed): number {
  if (typeof seed === 'number') {
    if (!Number.isFinite(seed)) {
      throw new TypeError('A numeric random seed must be finite.');
    }

    const normalized = seed >>> 0;
    return normalized === 0 ? NON_ZERO_FALLBACK_SEED : normalized;
  }

  let hash = 0x811c9dc5;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  const normalized = hash >>> 0;
  return normalized === 0 ? NON_ZERO_FALLBACK_SEED : normalized;
}

/** One xorshift32 step. The returned seed fully captures future randomness. */
export function nextRandom(seed: number): RandomStep {
  let value = normalizeSeed(seed);
  value ^= value << 13;
  value ^= value >>> 17;
  value ^= value << 5;
  const nextSeed = value >>> 0;

  return {
    value: nextSeed / 0x1_0000_0000,
    nextSeed,
  };
}

export function randomIndex(length: number, seed: number): SeededResult<number> {
  if (!Number.isInteger(length) || length <= 0) {
    throw new RangeError('A random index requires a positive integer length.');
  }

  const step = nextRandom(seed);
  return {
    value: Math.floor(step.value * length),
    nextSeed: step.nextSeed,
  };
}

export function shuffleWithSeed<T>(
  values: readonly T[],
  seed: RandomSeed,
): SeededResult<readonly T[]> {
  const shuffled = [...values];
  let nextSeed = normalizeSeed(seed);

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const selected = randomIndex(index + 1, nextSeed);
    nextSeed = selected.nextSeed;
    [shuffled[index], shuffled[selected.value]] = [
      shuffled[selected.value],
      shuffled[index],
    ];
  }

  return { value: shuffled, nextSeed };
}
