import type { RawContentPack, RawQuestion, RawCuratedSet } from '../content';
import type { ImportedPackRecord, ImportedQuestionRecord, ImportedSetRecord } from '../data';

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

export function rawPackFromStored(
  pack: ImportedPackRecord,
  questions: readonly ImportedQuestionRecord[],
  sets: readonly ImportedSetRecord[]
): RawContentPack {
  const rawQuestions = questions.map((entry) => {
    const value = record(entry.payload);
    if (!value) throw new TypeError(`Stored question ${entry.id} is corrupt.`);
    const usage = record(value.usage);
    return {
      id: entry.localId,
      level: value.level,
      category: value.category,
      tags: value.tags,
      prompt: value.prompt,
      choices: value.choices,
      correctChoiceId: value.correctChoiceId,
      hint: value.hint,
      explanation: value.explanation,
      usage: {
        freshMix: usage?.freshMix,
        setIds: Array.isArray(usage?.setIds) ? usage.setIds.map((id) => String(id).replace(`${pack.id}:`, '')) : []
      },
      metadata: value.metadata
    } as RawQuestion;
  });
  const rawSets = sets.map((entry) => {
    const value = record(entry.payload);
    if (!value) throw new TypeError(`Stored set ${entry.id} is corrupt.`);
    return {
      id: entry.localId,
      title: value.title,
      description: value.description,
      theme: value.theme,
      tags: value.tags,
      questionIds: entry.questionIds.map((id) => id.replace(`${pack.id}:`, '')),
      audience: value.audience ?? undefined,
      difficultyNote: value.difficultyNote ?? undefined
    } as RawCuratedSet;
  });
  return {
    schemaVersion: pack.schemaVersion,
    id: pack.id,
    title: pack.title,
    description: pack.description,
    version: pack.version,
    language: pack.language,
    contentType: pack.contentType === 'combined' ? 'mixed' : pack.contentType,
    categories: pack.categories as RawContentPack['categories'],
    questions: rawQuestions,
    sets: rawSets,
    metadata: { ...pack.metadata, questionCount: rawQuestions.length, setCount: rawSets.length }
  };
}

export const BLANK_PACK_TEMPLATE = {
  schemaVersion: '1.0.0',
  id: 'my-question-pack',
  title: 'My Question Pack',
  description: 'Describe the purpose and scope of this pack.',
  version: '1.0.0',
  language: 'en-US',
  contentType: 'pool',
  categories: ['Science'],
  questions: [],
  sets: [],
  metadata: {
    author: 'Your name',
    reviewStatus: 'unreviewed',
    humanReviewRecommended: true
  }
} as const;

export const SAMPLE_PACK = {
  ...BLANK_PACK_TEMPLATE,
  id: 'sample-local-pack',
  title: 'Sample Local Pack',
  description: 'A one-question structural example. Add coverage at all 15 levels for Fresh Mix use.',
  questions: [{
    id: 'sample-q01',
    level: 1,
    category: 'Science',
    tags: ['example'],
    prompt: 'Which state of matter has a fixed volume but takes the shape of its container?',
    choices: [{ id: 'a', text: 'Solid' }, { id: 'b', text: 'Liquid' }, { id: 'c', text: 'Gas' }, { id: 'd', text: 'Plasma' }],
    correctChoiceId: 'b',
    hint: 'Think of water in a glass.',
    explanation: 'A liquid keeps a fixed volume while conforming to the shape of its container.',
    usage: { freshMix: true, setIds: [] },
    metadata: { reviewStatus: 'sample-only', timeSensitive: false }
  }]
} as const;

export const AI_AUTHORING_PROMPT = `Create a version 1.0.0 One Million question-pack JSON file.

Requirements:
- Root fields: schemaVersion, id, title, description, version, language, contentType, categories, questions, sets, metadata.
- Each question: stable id, integer level 1-15, one allowed primary category, optional tags, concise prompt, exactly four distinct {id,text} choices, correctChoiceId, a non-leaking hint, a concise explanation, and usage {freshMix,setIds}.
- Curated sets reference exactly 15 unique questions in fixed Level 1 through Level 15 order.
- Use stable, non-time-sensitive facts. Avoid ambiguity, joke distractors, HTML, links, executable content, "all of the above", and answer leakage.
- Difficulty must rise meaningfully at every exact level.
- Return only valid JSON. Do not wrap it in Markdown.

Human factual review and difficulty play-testing are required before publication.`;
