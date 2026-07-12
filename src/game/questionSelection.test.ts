import { describe, expect, it } from 'vitest';

import {
  QuestionSelectionError,
  resolveQuestionWithSeed,
  selectCuratedSet,
  selectFreshMix,
  selectSurpriseSet,
} from './questionSelection';
import type {
  CuratedSetDefinition,
  FourChoices,
  LadderLevel,
  QuestionDefinition,
} from './types';
import { LADDER_LEVELS } from './types';

const choices: FourChoices = [
  { id: 'a', text: 'Alpha' },
  { id: 'b', text: 'Bravo' },
  { id: 'c', text: 'Charlie' },
  { id: 'd', text: 'Delta' },
];

function question(
  level: LadderLevel,
  suffix = 'only',
  options: {
    readonly category?: string;
    readonly freshMix?: boolean;
    readonly setId?: string;
  } = {},
): QuestionDefinition {
  return {
    id: `q-${level}-${suffix}`,
    level,
    category: options.category ?? `Category ${level}`,
    prompt: `Question ${level} (${suffix})?`,
    choices,
    correctChoiceId: 'c',
    hint: 'A useful hint.',
    explanation: 'A useful explanation.',
    usage: {
      freshMix: options.freshMix ?? true,
      setIds: options.setId ? [options.setId] : [],
    },
  };
}

function basicFreshCatalog(): QuestionDefinition[] {
  return LADDER_LEVELS.map((level) => question(level));
}

describe('seeded question resolution', () => {
  it('is deterministic and preserves every answer exactly once', () => {
    const first = resolveQuestionWithSeed(question(1), 'repeatable-seed');
    const second = resolveQuestionWithSeed(question(1), 'repeatable-seed');

    expect(first).toEqual(second);
    expect(first.question.choices.map((choice) => choice.label)).toEqual([
      'A',
      'B',
      'C',
      'D',
    ]);
    expect(first.question.choices.map((choice) => choice.id).sort()).toEqual([
      'a',
      'b',
      'c',
      'd',
    ]);
    expect(first.question.correctChoiceId).toBe('c');
  });
});

describe('Fresh Mix selection', () => {
  it('applies unseen, least-seen, then least-recently-seen priority by level', () => {
    const catalog = basicFreshCatalog().filter((item) => item.level > 3);
    catalog.push(
      question(1, 'unseen'),
      question(1, 'seen'),
      question(2, 'seen-once'),
      question(2, 'seen-twice'),
      question(3, 'older'),
      question(3, 'newer'),
    );

    const result = selectFreshMix(catalog, {
      seed: 42,
      history: {
        'q-1-seen': { seenCount: 1, lastSeenAtMs: 100 },
        'q-2-seen-once': { seenCount: 1, lastSeenAtMs: 500 },
        'q-2-seen-twice': { seenCount: 2, lastSeenAtMs: 100 },
        'q-3-older': { seenCount: 1, lastSeenAtMs: 100 },
        'q-3-newer': { seenCount: 1, lastSeenAtMs: 200 },
      },
    });

    expect(result.questions.slice(0, 3).map((item) => item.id)).toEqual([
      'q-1-unseen',
      'q-2-seen-once',
      'q-3-older',
    ]);
    expect(result.unseenQuestionCount).toBe(13);
    expect(result.repeatedQuestionCount).toBe(2);
  });

  it('excludes curated-only and explicitly ineligible questions', () => {
    const catalog = basicFreshCatalog();
    catalog.push(
      question(1, 'curated', { freshMix: false, setId: 'set-one' }),
      question(2, 'disabled-source'),
    );

    const result = selectFreshMix(catalog, {
      seed: 12,
      isEligible: (item) => item.id !== 'q-2-disabled-source',
    });

    expect(result.questions[0].id).toBe('q-1-only');
    expect(result.questions[1].id).toBe('q-2-only');
  });

  it('uses category diversity only after freshness ties', () => {
    const catalog = basicFreshCatalog();
    catalog[0] = question(1, 'first', { category: 'History' });
    catalog.splice(
      1,
      1,
      question(2, 'same-category', { category: 'History' }),
      question(2, 'new-category', { category: 'Science' }),
    );

    const result = selectFreshMix(catalog, { seed: 77 });
    expect(result.questions[1].id).toBe('q-2-new-category');
  });

  it('fails transactionally when any ladder level has no eligible question', () => {
    const missingLevelSeven = basicFreshCatalog().filter((item) => item.level !== 7);
    expect(() => selectFreshMix(missingLevelSeven, { seed: 1 })).toThrowError(
      expect.objectContaining<Partial<QuestionSelectionError>>({
        code: 'missing-level',
        level: 7,
      }),
    );
  });
});

describe('curated and Surprise Me selection', () => {
  const setId = 'set-one';
  const set: CuratedSetDefinition = {
    id: setId,
    title: 'Set One',
    questionIds: LADDER_LEVELS.map((level) => `q-${level}-set`),
  };
  const catalog = LADDER_LEVELS.map((level) =>
    question(level, 'set', { freshMix: false, setId }),
  );

  it('preserves authored level order while fixing a seeded answer shuffle', () => {
    const first = selectCuratedSet(set, catalog, 99);
    const restored = selectCuratedSet(set, catalog, 99);

    expect(first.questions.map((item) => item.id)).toEqual(set.questionIds);
    expect(first.questions).toEqual(restored.questions);
    expect(first.questions.map((item) => item.level)).toEqual(LADDER_LEVELS);
  });

  it('rejects a set whose membership declarations are inconsistent', () => {
    const broken = [...catalog];
    broken[4] = question(5, 'set', { freshMix: false, setId: 'another-set' });
    expect(() => selectCuratedSet(set, broken, 1)).toThrowError(
      expect.objectContaining<Partial<QuestionSelectionError>>({
        code: 'invalid-curated-set',
      }),
    );
  });

  it('prioritizes unattempted, then unwon, then least-recently-played sets', () => {
    const sets: CuratedSetDefinition[] = [
      { id: 'new', title: 'New', questionIds: [] },
      { id: 'unwon', title: 'Unwon', questionIds: [] },
      { id: 'won', title: 'Won', questionIds: [] },
    ];
    const progress = {
      unwon: {
        setId: 'unwon',
        attemptCount: 2,
        millionaireWon: false,
        lastAttemptedAtMs: 10,
      },
      won: {
        setId: 'won',
        attemptCount: 1,
        millionaireWon: true,
        lastAttemptedAtMs: 1,
      },
    } as const;

    expect(selectSurpriseSet(sets, progress, { seed: 5 }).set.id).toBe('new');

    const withoutNew = sets.slice(1);
    expect(selectSurpriseSet(withoutNew, progress, { seed: 5 }).set.id).toBe(
      'unwon',
    );
  });
});
