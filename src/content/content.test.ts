import catalogReport from './generated/catalog-report.json';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  BUILT_IN_HINT_REPAIRS,
  EMPTY_CONTENT_IDENTITY,
  PRIMARY_CATEGORIES,
  clearBuiltInCatalogCacheForTests,
  loadBuiltInCatalog,
  parseJsonData,
  prepareCustomPackImport,
  type ExistingContentIdentity,
  type RawContentPack
} from './index';

function validCustomPack(): RawContentPack {
  const setId = 'set-one';
  const questions = Array.from({ length: 15 }, (_, index) => {
    const level = (index + 1) as RawContentPack['questions'][number]['level'];
    return {
      id: `question-${String(level).padStart(2, '0')}`,
      level,
      category: 'Science' as const,
      tags: ['testing'],
      prompt: `Custom question at level ${level}?`,
      choices: [
        { id: 'a', text: `Correct ${level}` },
        { id: 'b', text: `Distractor B ${level}` },
        { id: 'c', text: `Distractor C ${level}` },
        { id: 'd', text: `Distractor D ${level}` }
      ],
      correctChoiceId: 'a',
      hint: `A useful clue for level ${level}.`,
      explanation: `Correct ${level} is the intended answer.`,
      usage: { freshMix: true, setIds: [setId] }
    };
  });
  return {
    schemaVersion: '1.0.0',
    id: 'custom-science-pack',
    title: 'Custom Science Pack',
    description: 'A complete valid pack used by content unit tests.',
    version: '1.0.0',
    language: 'en-US',
    contentType: 'mixed',
    categories: ['Science'],
    questions,
    sets: [
      {
        id: setId,
        title: 'Custom Science Set',
        description: 'One question at every ladder level.',
        theme: 'Science',
        tags: ['testing', 'science'],
        questionIds: questions.map((question) => question.id)
      }
    ],
    metadata: {
      author: 'Test Author',
      questionCount: 15,
      setCount: 1,
      reviewStatus: 'human-reviewed',
      humanReviewRecommended: false,
      timeSensitiveQuestionCount: 0
    }
  };
}

describe('built-in content catalog', () => {
  beforeEach(() => clearBuiltInCatalogCacheForTests());

  it('loads all source content into indexed normalized records', () => {
    const catalog = loadBuiltInCatalog();
    expect(catalog.summary.questionCount).toBe(480);
    expect(catalog.summary.freshMixQuestionCount).toBe(300);
    expect(catalog.summary.curatedQuestionCount).toBe(180);
    expect(catalog.summary.curatedSetCount).toBe(12);
    expect(catalog.summary.sourceCount).toBe(11);
    expect(catalog.questionById.size).toBe(480);
    expect(catalog.setById.size).toBe(12);
    expect(catalog.sourceById.size).toBe(11);
    expect(catalog.summary.missingFreshMixLevels).toEqual([]);
    expect(catalog.summary.missingCategoryLevelCells).toEqual([]);
  });

  it('has exact full-release and Fresh Mix ladder coverage', () => {
    const catalog = loadBuiltInCatalog();
    for (let level = 1; level <= 15; level += 1) {
      expect(catalog.indexes.byLevel[String(level)]).toHaveLength(32);
      expect(
        catalog.questions.filter((question) => question.usage.freshMix && question.level === level)
      ).toHaveLength(20);
    }
    for (const category of PRIMARY_CATEGORIES) {
      const poolQuestions = catalog.questions.filter(
        (question) => question.usage.freshMix && question.category === category
      );
      expect(poolQuestions).toHaveLength(15);
      expect(new Set(poolQuestions.map((question) => question.level)).size).toBe(15);
    }
  });

  it('preserves set order and one exact level at every position', () => {
    const catalog = loadBuiltInCatalog();
    for (const set of catalog.sets) {
      expect(set.questionIds).toHaveLength(15);
      expect(new Set(set.questionIds).size).toBe(15);
      set.questionIds.forEach((questionId, index) => {
        expect(catalog.questionById.get(questionId)?.level).toBe(index + 1);
      });
    }
  });

  it('applies only the five documented hint repairs and inherits pack metadata', () => {
    const catalog = loadBuiltInCatalog();
    expect(catalogReport.totals.normalizationRepairs).toBe(5);
    expect(catalogReport.normalizationRepairs.map((repair) => repair.questionId).sort()).toEqual(
      Object.keys(BUILT_IN_HINT_REPAIRS).sort()
    );
    for (const [questionId, repair] of Object.entries(BUILT_IN_HINT_REPAIRS)) {
      const question = catalog.questionById.get(questionId);
      expect(question?.hint).toBe(repair.normalizedHint);
      expect(question?.normalizationRepairs).toEqual([
        expect.objectContaining({ sourceValue: repair.sourceHint, normalizedValue: repair.normalizedHint })
      ]);
    }
    expect(catalog.questions.every((question) => question.metadata.language === 'en-US')).toBe(true);
    expect(catalog.questions.every((question) => question.metadata.reviewStatus === 'assistant-reviewed-draft')).toBe(true);
    expect(catalogReport.sourceIntegrity.allHashesMatch).toBe(true);
    expect(catalogReport.errors).toEqual([]);
  });
});

describe('custom pack validation transaction', () => {
  it('accepts a BOM-prefixed valid pack and stages a complete namespaced payload', () => {
    const pack = validCustomPack();
    const staged = prepareCustomPackImport(`\uFEFF${JSON.stringify(pack)}`, EMPTY_CONTENT_IDENTITY);
    expect(staged.status).toBe('ready');
    expect(staged.preview.valid).toBe(true);
    expect(staged.preview.questionCount).toBe(15);
    expect(staged.preview.levelsRepresented).toEqual(Array.from({ length: 15 }, (_, index) => index + 1));
    expect(staged.payload?.pack.questions).toHaveLength(15);
    expect(staged.payload?.pack.questions[0].id).toBe('custom-science-pack:question-01');
    expect(staged.payload?.pack.questions[0].usage.setIds).toEqual(['custom-science-pack:set-one']);
    expect(staged.payload?.pack.sets[0].questionIds[0]).toBe('custom-science-pack:question-01');
    expect(staged.payload?.pack.questions[0].metadata.author).toBe('Test Author');
  });

  it('rejects an invalid pack without exposing a partial commit payload', () => {
    const pack = validCustomPack();
    pack.questions[4].choices.pop();
    const staged = prepareCustomPackImport(pack);
    expect(staged.status).toBe('rejected');
    expect(staged.payload).toBeNull();
    expect(staged.preview.errors.some((error) => error.code === 'invalid-choice-count')).toBe(true);
  });

  it('rejects executable markup, reserved namespaces, and enabled-content conflicts', () => {
    const markupPack = validCustomPack();
    markupPack.questions[0].prompt = '<img src=x onerror=alert(1)>';
    const unsafe = prepareCustomPackImport(markupPack);
    expect(unsafe.status).toBe('rejected');
    expect(unsafe.preview.errors.some((error) => error.code === 'unsupported-markup')).toBe(true);

    const reservedPack = validCustomPack();
    reservedPack.id = 'builtin-hostile-pack';
    const reserved = prepareCustomPackImport(reservedPack);
    expect(reserved.status).toBe('rejected');
    expect(reserved.preview.errors.some((error) => error.code === 'reserved-namespace')).toBe(true);

    const identity: ExistingContentIdentity = {
      packVersions: new Map([['custom-science-pack', '1.0.0']]),
      questionOwners: new Map(),
      setOwners: new Map()
    };
    const conflict = prepareCustomPackImport(validCustomPack(), identity);
    expect(conflict.status).toBe('rejected');
    expect(conflict.payload).toBeNull();
    expect(conflict.preview.conflicts).toHaveLength(1);
  });

  it('parses UTF-8 BOM JSON and reports malformed JSON without throwing', () => {
    expect(parseJsonData('\uFEFF{"ok":true}')).toMatchObject({ valid: true, value: { ok: true } });
    expect(parseJsonData('{broken')).toMatchObject({ valid: false });
  });
});
