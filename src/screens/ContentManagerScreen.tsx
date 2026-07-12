import { useCallback, useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import { BrandMark } from '../components/BrandMark';
import { Modal } from '../components/Modal';
import {
  EMPTY_CONTENT_IDENTITY,
  IMPORT_LIMITS,
  PRIMARY_CATEGORIES,
  loadBuiltInCatalog,
  prepareCustomPackImport,
  type CatalogSummary,
  type ExistingContentIdentity,
  type ImportPreview,
  type PreparedImportPayload,
  type PreparedImportTransaction,
  type PrimaryCategory,
  type RawContentPack,
  type RawQuestion
} from '../content';
import '../styles/content-manager.css';

type MaybePromise<T = void> = T | Promise<T>;
type ManagerTab = 'library' | 'import' | 'author';

export interface ManagedContentPack {
  id: string;
  title: string;
  description: string;
  version: string;
  author: string;
  enabled: boolean;
  questionCount: number;
  setCount: number;
  categories: string[];
  reviewStatus?: string;
  warningCount?: number;
  updatedLabel?: string;
}

export interface ContentManagerScreenProps {
  installedPacks: ManagedContentPack[];
  existingIdentity?: ExistingContentIdentity;
  builtInSummary?: CatalogSummary;
  onBack: () => void;
  onTogglePack: (packId: string, enabled: boolean) => MaybePromise;
  onExportPack: (packId: string) => MaybePromise;
  onDuplicatePack: (packId: string) => MaybePromise;
  onRemovePack: (packId: string) => MaybePromise;
  onCommitPack: (payload: PreparedImportPayload, preview: ImportPreview) => MaybePromise;
  onDownloadText: (filename: string, contents: string, mimeType: string) => MaybePromise;
}

interface QuestionDraft {
  id: string;
  level: number;
  category: PrimaryCategory;
  tags: string;
  prompt: string;
  choices: [string, string, string, string];
  correctChoiceId: 'a' | 'b' | 'c' | 'd';
  hint: string;
  explanation: string;
}

const CHOICE_IDS = ['a', 'b', 'c', 'd'] as const;

function initialQuestionDraft(level = 1): QuestionDraft {
  return {
    id: `question-${String(level).padStart(2, '0')}`,
    level,
    category: 'Science',
    tags: '',
    prompt: '',
    choices: ['', '', '', ''],
    correctChoiceId: 'a',
    hint: '',
    explanation: ''
  };
}

function slug(value: string): string {
  return value
    .toLocaleLowerCase('en-US')
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'my-trivia-pack';
}

function blankPackTemplate(): object {
  return {
    schemaVersion: '1.0.0',
    id: 'my-trivia-pack',
    title: 'My Trivia Pack',
    description: 'Describe the subjects and intended audience.',
    version: '1.0.0',
    language: 'en-US',
    contentType: 'pool',
    categories: [],
    questions: [],
    sets: [],
    metadata: {
      author: 'Your name',
      questionCount: 0,
      reviewStatus: 'unreviewed',
      humanReviewRecommended: true,
      timeSensitiveQuestionCount: 0
    }
  };
}

function samplePack(): RawContentPack {
  return {
    schemaVersion: '1.0.0',
    id: 'sample-science-pack',
    title: 'Sample Science Pack',
    description: 'A minimal valid Fresh Mix pack that demonstrates the full question shape.',
    version: '1.0.0',
    language: 'en-US',
    contentType: 'pool',
    categories: ['Science'],
    questions: [
      {
        id: 'water-formula',
        level: 1,
        category: 'Science',
        tags: ['chemistry'],
        prompt: 'What is the chemical formula for water?',
        choices: [
          { id: 'a', text: 'CO2' },
          { id: 'b', text: 'H2O' },
          { id: 'c', text: 'O2' },
          { id: 'd', text: 'NaCl' }
        ],
        correctChoiceId: 'b',
        hint: 'Each molecule contains two hydrogen atoms and one oxygen atom.',
        explanation: 'Water is H2O: two hydrogen atoms bonded to one oxygen atom.',
        usage: { freshMix: true, setIds: [] }
      }
    ],
    sets: [],
    metadata: {
      author: 'Sample Author',
      questionCount: 1,
      reviewStatus: 'sample',
      humanReviewRecommended: true,
      timeSensitiveQuestionCount: 0
    }
  };
}

function aiAuthoringPrompt(): string {
  return `Create a JSON question pack for an offline millionaire-style trivia game.

Return JSON only. Use schemaVersion "1.0.0" and a lowercase kebab-case pack ID. The root fields are: id, title, description, version, language, contentType, categories, questions, sets, metadata.

Every question requires: a stable lowercase kebab-case id; integer level 1-15; exactly one of these primary categories: ${PRIMARY_CATEGORIES.join(', ')}; 1-${IMPORT_LIMITS.maxTagsPerQuestion} concise tags; a clear prompt; exactly four distinct choices with stable IDs a, b, c, d; one correctChoiceId; a useful non-leaking hint; a concise explanation; and usage {"freshMix": boolean, "setIds": []}.

For a curated set, provide exactly 15 unique question IDs ordered so position 1 is Level 1 through position 15 at Level 15. Set membership must be reciprocal in each question's usage.setIds. A pack may be "pool", "curated-sets", or "mixed".

Avoid trick wording, ambiguous facts, answer leakage, HTML, current officeholders, rapidly changing facts, and implausible distractors. Keep prompts under ${IMPORT_LIMITS.maxPromptLength} characters, choices under ${IMPORT_LIMITS.maxChoiceLength}, hints under ${IMPORT_LIMITS.maxHintLength}, and explanations under ${IMPORT_LIMITS.maxExplanationLength}. Include metadata.author, metadata.reviewStatus "unreviewed", metadata.humanReviewRecommended true, and accurate questionCount/setCount values. Human factual review is required before publication.`;
}

function issueSummary(prepared: PreparedImportTransaction | null): string {
  if (prepared === null) return '';
  if (prepared.status === 'ready') {
    return `${prepared.preview.questionCount} questions and ${prepared.preview.setCount} sets are ready.`;
  }
  const count = prepared.preview.errors.length;
  return `${count} validation ${count === 1 ? 'error' : 'errors'} must be resolved.`;
}

export function ContentManagerScreen(props: ContentManagerScreenProps) {
  const [tab, setTab] = useState<ManagerTab>('library');
  const [search, setSearch] = useState('');
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [liveMessage, setLiveMessage] = useState('');
  const [removeTarget, setRemoveTarget] = useState<ManagedContentPack | null>(null);
  const [importText, setImportText] = useState('');
  const [importName, setImportName] = useState('Pasted JSON');
  const [allowUpdate, setAllowUpdate] = useState(false);
  const [preparedImport, setPreparedImport] = useState<PreparedImportTransaction | null>(null);

  const existingIdentity = props.existingIdentity ?? EMPTY_CONTENT_IDENTITY;
  const builtInSummary = props.builtInSummary ?? loadBuiltInCatalog().summary;
  const filteredPacks = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('en-US');
    if (!query) return props.installedPacks;
    return props.installedPacks.filter((pack) =>
      [pack.title, pack.id, pack.author, pack.description, ...pack.categories]
        .join(' ')
        .toLocaleLowerCase('en-US')
        .includes(query)
    );
  }, [props.installedPacks, search]);

  async function runAction(key: string, action: () => MaybePromise, successMessage: string): Promise<boolean> {
    setBusyKey(key);
    setLiveMessage('');
    try {
      await action();
      setLiveMessage(successMessage);
      return true;
    } catch (error) {
      setLiveMessage(error instanceof Error ? error.message : 'The action could not be completed.');
      return false;
    } finally {
      setBusyKey(null);
    }
  }

  function previewImport(text = importText, update = allowUpdate): void {
    if (!text.trim()) {
      setPreparedImport({
        status: 'rejected',
        preview: {
          valid: false,
          packId: null,
          packVersion: null,
          questionCount: 0,
          freshMixQuestionCount: 0,
          setCount: 0,
          levelsRepresented: [],
          categoriesRepresented: [],
          conflicts: [],
          errors: [{ severity: 'error', code: 'empty-import', path: '$', message: 'Paste JSON or choose a file first.' }],
          warnings: []
        },
        payload: null
      });
      return;
    }
    setPreparedImport(
      prepareCustomPackImport(text, existingIdentity, { allowPackUpdate: update, enabled: true })
    );
  }

  async function onFileSelected(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      const text = await file.text();
      setImportText(text);
      setImportName(file.name);
      setPreparedImport(prepareCustomPackImport(text, existingIdentity, { allowPackUpdate: allowUpdate }));
    } catch {
      setLiveMessage('The selected file could not be read.');
    }
  }

  async function commitPreparedImport(): Promise<void> {
    if (preparedImport?.status !== 'ready' || preparedImport.payload === null) return;
    await runAction(
      `commit:${preparedImport.preview.packId ?? 'pack'}`,
      () => props.onCommitPack(preparedImport.payload!, preparedImport.preview),
      `${preparedImport.preview.packId ?? 'Pack'} was committed.`
    );
  }

  function download(filename: string, value: unknown, mimeType = 'application/json'): void {
    const contents = typeof value === 'string' ? value : `${JSON.stringify(value, null, 2)}\n`;
    void runAction(`download:${filename}`, () => props.onDownloadText(filename, contents, mimeType), `${filename} is ready.`);
  }

  return (
    <main className="screen content-manager" aria-labelledby="content-manager-heading">
      <header className="utility-bar">
        <BrandMark compact />
        <div className="utility-divider" />
        <div>
          <div className="utility-label">Local content system</div>
          <div className="utility-value">Content Manager</div>
        </div>
        <div className="utility-bar__spacer" />
        <span className="utility-status"><i className="status-dot" /> Offline catalog</span>
        <button className="secondary-button content-manager__back" type="button" onClick={props.onBack}>Back</button>
      </header>

      <div className="content-manager__layout">
        <aside className="content-manager__rail" aria-label="Content Manager sections">
          <span className="kicker">Catalog control</span>
          <h1 id="content-manager-heading">Question content</h1>
          <p>Validate, organize, and author local packs without sending content anywhere.</p>
          <nav className="content-manager__tabs">
            <button type="button" className={tab === 'library' ? 'active' : ''} aria-current={tab === 'library' ? 'page' : undefined} onClick={() => setTab('library')}><b>01</b><span><strong>Library</strong><small>Coverage and installed packs</small></span></button>
            <button type="button" className={tab === 'import' ? 'active' : ''} aria-current={tab === 'import' ? 'page' : undefined} onClick={() => setTab('import')}><b>02</b><span><strong>Import & templates</strong><small>Preview before commit</small></span></button>
            <button type="button" className={tab === 'author' ? 'active' : ''} aria-current={tab === 'author' ? 'page' : undefined} onClick={() => setTab('author')}><b>03</b><span><strong>Manual editor</strong><small>Build a pool pack</small></span></button>
          </nav>
          <div className="content-manager__guardrail">
            <strong>Atomic imports</strong>
            <span>Every question and set validates before a repository callback receives the pack.</span>
          </div>
        </aside>

        <section className="content-manager__workspace screen-scroll">
          {tab === 'library' && (
            <LibraryPanel
              summary={builtInSummary}
              packs={filteredPacks}
              packTotal={props.installedPacks.length}
              search={search}
              busyKey={busyKey}
              onSearch={setSearch}
              onToggle={(pack, enabled) => void runAction(`toggle:${pack.id}`, () => props.onTogglePack(pack.id, enabled), `${pack.title} ${enabled ? 'enabled' : 'disabled'}.`)}
              onExport={(pack) => void runAction(`export:${pack.id}`, () => props.onExportPack(pack.id), `${pack.title} export is ready.`)}
              onDuplicate={(pack) => void runAction(`duplicate:${pack.id}`, () => props.onDuplicatePack(pack.id), `${pack.title} was duplicated.`)}
              onRemove={setRemoveTarget}
            />
          )}
          {tab === 'import' && (
            <ImportPanel
              importName={importName}
              text={importText}
              allowUpdate={allowUpdate}
              prepared={preparedImport}
              busy={busyKey?.startsWith('commit:') === true}
              onFileSelected={onFileSelected}
              onTextChange={(value) => { setImportText(value); setImportName('Pasted JSON'); setPreparedImport(null); }}
              onAllowUpdate={(value) => { setAllowUpdate(value); if (importText.trim()) previewImport(importText, value); }}
              onPreview={() => previewImport()}
              onCommit={() => void commitPreparedImport()}
              onBlank={() => download('blank-question-pack.json', blankPackTemplate())}
              onSample={() => download('sample-question-pack.json', samplePack())}
              onPrompt={() => download('ai-question-pack-prompt.txt', aiAuthoringPrompt(), 'text/plain')}
            />
          )}
          {tab === 'author' && (
            <ManualPackEditor
              existingIdentity={existingIdentity}
              busy={busyKey === 'manual-save'}
              onSave={async (payload, preview) => {
                await runAction('manual-save', () => props.onCommitPack(payload, preview), `${preview.packId ?? 'Pack'} was saved.`);
              }}
            />
          )}
        </section>
      </div>

      <div className="content-manager__live" aria-live="polite">{liveMessage}</div>
      {removeTarget && (
        <Modal
          title={`Remove ${removeTarget.title}?`}
          destructive
          onClose={() => setRemoveTarget(null)}
          actions={
            <>
              <button type="button" className="quiet-button" onClick={() => setRemoveTarget(null)}>Cancel</button>
              <button
                type="button"
                className="danger-button"
                disabled={busyKey === `remove:${removeTarget.id}`}
                onClick={() => void runAction(`remove:${removeTarget.id}`, () => props.onRemovePack(removeTarget.id), `${removeTarget.title} was removed.`).then((removed) => removed && setRemoveTarget(null))}
              >Remove pack</button>
            </>
          }
        >
          <p>Future games will no longer use this pack. Saved and completed runs should retain their resolved question snapshots.</p>
        </Modal>
      )}
    </main>
  );
}

function LibraryPanel(props: {
  summary: CatalogSummary;
  packs: ManagedContentPack[];
  packTotal: number;
  search: string;
  busyKey: string | null;
  onSearch: (value: string) => void;
  onToggle: (pack: ManagedContentPack, enabled: boolean) => void;
  onExport: (pack: ManagedContentPack) => void;
  onDuplicate: (pack: ManagedContentPack) => void;
  onRemove: (pack: ManagedContentPack) => void;
}) {
  return (
    <div className="content-manager__section">
      <header className="content-manager__section-heading">
        <div><span className="kicker">Built-in release 001</span><h2>Coverage at a glance</h2></div>
        <span className="content-manager__verified">Validated catalog</span>
      </header>
      <div className="content-manager__metrics" aria-label="Built-in coverage summary">
        <article><span>Questions</span><strong>{props.summary.questionCount}</strong><small>{props.summary.freshMixQuestionCount} Fresh Mix + {props.summary.curatedQuestionCount} curated</small></article>
        <article><span>Curated sets</span><strong>{props.summary.curatedSetCount}</strong><small>Every set spans Levels 1-15</small></article>
        <article><span>Categories</span><strong>{props.summary.categoryCount}</strong><small>Complete pool category coverage</small></article>
        <article><span>Source packs</span><strong>{props.summary.sourceCount}</strong><small>{props.summary.missingFreshMixLevels.length === 0 ? 'No missing Fresh Mix levels' : `${props.summary.missingFreshMixLevels.length} levels missing`}</small></article>
      </div>
      <div className="content-manager__level-strip" aria-label="Questions per ladder level">
        {Array.from({ length: 15 }, (_, index) => index + 1).map((level) => (
          <span key={level} title={`${props.summary.byLevel[String(level)] ?? 0} total questions`}><b>{level}</b><i style={{ '--coverage': Math.min(1, (props.summary.byLevel[String(level)] ?? 0) / 32) } as React.CSSProperties} /></span>
        ))}
      </div>

      <header className="content-manager__subheading">
        <div><h2>Installed custom packs</h2><p>{props.packTotal} local {props.packTotal === 1 ? 'pack' : 'packs'} · disabled packs stay installed</p></div>
        <label className="content-manager__search"><span className="sr-only">Search installed packs</span><input type="search" value={props.search} onChange={(event) => props.onSearch(event.target.value)} placeholder="Search title, ID, author, category..." /></label>
      </header>
      {props.packs.length === 0 ? (
        <div className="content-manager__empty"><span>◇</span><strong>{props.packTotal === 0 ? 'No custom packs installed' : 'No packs match this search'}</strong><p>{props.packTotal === 0 ? 'Import JSON or use the manual editor to create your first local pack.' : 'Try a broader title, ID, author, or category.'}</p></div>
      ) : (
        <div className="content-manager__pack-list">
          {props.packs.map((pack) => (
            <article className={`content-pack-card ${pack.enabled ? '' : 'content-pack-card--disabled'}`} key={pack.id}>
              <div className="content-pack-card__status"><i className={pack.enabled ? 'status-dot' : 'status-dot status-dot--offline'} /><span>{pack.enabled ? 'Enabled' : 'Disabled'}</span></div>
              <div className="content-pack-card__copy"><h3>{pack.title}</h3><code>{pack.id}</code><p>{pack.description}</p><div>{pack.categories.slice(0, 4).map((category) => <span key={category}>{category}</span>)}{pack.categories.length > 4 && <span>+{pack.categories.length - 4}</span>}</div></div>
              <dl><div><dt>Version</dt><dd>{pack.version}</dd></div><div><dt>Author</dt><dd>{pack.author}</dd></div><div><dt>Questions</dt><dd>{pack.questionCount}</dd></div><div><dt>Sets</dt><dd>{pack.setCount}</dd></div></dl>
              <label className="content-pack-card__toggle"><input type="checkbox" checked={pack.enabled} disabled={props.busyKey === `toggle:${pack.id}`} onChange={(event) => props.onToggle(pack, event.target.checked)} /><i /><span>Use in new games</span></label>
              <div className="content-pack-card__actions"><button type="button" onClick={() => props.onExport(pack)} disabled={props.busyKey === `export:${pack.id}`}>Export</button><button type="button" onClick={() => props.onDuplicate(pack)} disabled={props.busyKey === `duplicate:${pack.id}`}>Duplicate</button><button type="button" className="danger" onClick={() => props.onRemove(pack)}>Remove</button></div>
              {(pack.warningCount ?? 0) > 0 && <div className="content-pack-card__warning">{pack.warningCount} validation {pack.warningCount === 1 ? 'warning' : 'warnings'}</div>}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function ImportPanel(props: {
  importName: string;
  text: string;
  allowUpdate: boolean;
  prepared: PreparedImportTransaction | null;
  busy: boolean;
  onFileSelected: (event: ChangeEvent<HTMLInputElement>) => Promise<void>;
  onTextChange: (value: string) => void;
  onAllowUpdate: (value: boolean) => void;
  onPreview: () => void;
  onCommit: () => void;
  onBlank: () => void;
  onSample: () => void;
  onPrompt: () => void;
}) {
  return (
    <div className="content-manager__section">
      <header className="content-manager__section-heading"><div><span className="kicker">Transactional intake</span><h2>Import a question pack</h2><p>Nothing is committed until the complete preview passes structural and conflict validation.</p></div></header>
      <div className="content-import-grid">
        <section className="content-import-source panel panel--soft">
          <div className="section-heading"><span>01</span><div><h3>Choose a source</h3><p>JSON file or pasted JSON</p></div></div>
          <label className="content-file-drop"><input type="file" accept="application/json,.json" onChange={(event) => void props.onFileSelected(event)} /><span>Choose JSON file</span><small>Maximum {Math.round(IMPORT_LIMITS.maxBytes / 1024 / 1024)} MB · UTF-8 and BOM supported</small></label>
          <div className="content-import-or"><span>or paste JSON</span></div>
          <label className="field-stack"><span>Question-pack JSON</span><textarea aria-label="Question-pack JSON" value={props.text} onChange={(event) => props.onTextChange(event.target.value)} spellCheck={false} placeholder='{"schemaVersion":"1.0.0", ...}' /></label>
          <label className="content-import-update"><input type="checkbox" checked={props.allowUpdate} onChange={(event) => props.onAllowUpdate(event.target.checked)} /><span>Treat a matching pack ID as an update</span></label>
          <button type="button" className="primary-button" onClick={props.onPreview}>Validate & preview</button>
        </section>
        <section className="content-import-preview panel panel--soft" aria-live="polite">
          <div className="section-heading"><span>02</span><div><h3>Review the transaction</h3><p>{props.importName}</p></div></div>
          {props.prepared === null ? (
            <div className="content-import-preview__idle"><span>⌁</span><strong>No preview yet</strong><p>Select or paste a pack, then run validation.</p></div>
          ) : (
            <ValidationPreview prepared={props.prepared} />
          )}
          <button type="button" className="primary-button content-import-preview__commit" disabled={props.prepared?.status !== 'ready' || props.busy} onClick={props.onCommit}>{props.prepared?.payload?.operation === 'update' ? 'Commit update' : 'Import entire pack'}</button>
        </section>
      </div>
      <header className="content-manager__subheading"><div><h2>Authoring resources</h2><p>Use the same schema and validation path for hand-authored or externally AI-assisted content.</p></div></header>
      <div className="content-template-grid">
        <button type="button" onClick={props.onBlank}><b>{'{ }'}</b><span><strong>Blank schema template</strong><small>Start a new pack in your editor</small></span></button>
        <button type="button" onClick={props.onSample}><b>✓</b><span><strong>Sample valid pack</strong><small>One complete Fresh Mix question</small></span></button>
        <button type="button" onClick={props.onPrompt}><b>AI</b><span><strong>External AI prompt</strong><small>Generate elsewhere, fact-check, import here</small></span></button>
      </div>
    </div>
  );
}

function ValidationPreview({ prepared }: { prepared: PreparedImportTransaction }) {
  const preview = prepared.preview;
  return (
    <div className={`validation-preview ${prepared.status === 'ready' ? 'validation-preview--ready' : 'validation-preview--rejected'}`}>
      <div className="validation-preview__status"><span>{prepared.status === 'ready' ? '✓' : '!'}</span><div><strong>{prepared.status === 'ready' ? 'Ready for atomic commit' : 'Pack rejected'}</strong><small>{issueSummary(prepared)}</small></div></div>
      <dl><div><dt>Pack</dt><dd>{preview.packId ?? 'Unknown'}</dd></div><div><dt>Version</dt><dd>{preview.packVersion ?? 'Unknown'}</dd></div><div><dt>Questions</dt><dd>{preview.questionCount}</dd></div><div><dt>Fresh Mix</dt><dd>{preview.freshMixQuestionCount}</dd></div><div><dt>Sets</dt><dd>{preview.setCount}</dd></div><div><dt>Levels</dt><dd>{preview.levelsRepresented.length ? preview.levelsRepresented.join(', ') : 'None'}</dd></div></dl>
      {preview.categoriesRepresented.length > 0 && <div className="validation-preview__categories">{preview.categoriesRepresented.map((category) => <span key={category}>{category}</span>)}</div>}
      {[...preview.errors, ...preview.warnings].length > 0 && <ul className="validation-preview__issues">{preview.errors.map((item, index) => <li className="error" key={`e-${item.code}-${index}`}><b>Error · {item.path}</b><span>{item.message}</span></li>)}{preview.warnings.map((item, index) => <li key={`w-${item.code}-${index}`}><b>Warning · {item.path}</b><span>{item.message}</span></li>)}</ul>}
      {preview.conflicts.length > 0 && <div className="validation-preview__conflicts"><strong>Detected conflicts</strong>{preview.conflicts.map((conflict) => <span key={`${conflict.kind}:${conflict.id}`}>{conflict.message}</span>)}</div>}
    </div>
  );
}

function ManualPackEditor(props: {
  existingIdentity: ExistingContentIdentity;
  busy: boolean;
  onSave: (payload: PreparedImportPayload, preview: ImportPreview) => Promise<void>;
}) {
  const [packId, setPackId] = useState('my-trivia-pack');
  const [title, setTitle] = useState('My Trivia Pack');
  const [description, setDescription] = useState('A locally authored Fresh Mix question pack.');
  const [version, setVersion] = useState('1.0.0');
  const [author, setAuthor] = useState('Local author');
  const [questions, setQuestions] = useState<RawQuestion[]>([]);
  const [autoSet, setAutoSet] = useState(false);
  const [allowUpdate, setAllowUpdate] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [draft, setDraft] = useState<QuestionDraft | null>(null);
  const [draftError, setDraftError] = useState('');
  const [prepared, setPrepared] = useState<PreparedImportTransaction | null>(null);
  const closeDraft = useCallback(() => setDraft(null), []);

  const levelCounts = Array.from({ length: 15 }, (_, index) =>
    questions.filter((question) => question.level === index + 1).length
  );
  const completeLadder = levelCounts.every((count) => count > 0);

  function openNewQuestion(): void {
    const missingLevel = levelCounts.findIndex((count) => count === 0) + 1;
    setEditingIndex(null);
    setDraft(initialQuestionDraft(missingLevel > 0 ? missingLevel : 1));
    setDraftError('');
  }

  function openQuestion(question: RawQuestion, index: number): void {
    setEditingIndex(index);
    setDraft({
      id: question.id,
      level: question.level,
      category: question.category,
      tags: question.tags.join(', '),
      prompt: question.prompt,
      choices: question.choices.map((choice) => choice.text) as QuestionDraft['choices'],
      correctChoiceId: question.correctChoiceId as QuestionDraft['correctChoiceId'],
      hint: question.hint,
      explanation: question.explanation
    });
    setDraftError('');
  }

  function saveQuestion(event: FormEvent): void {
    event.preventDefault();
    if (draft === null) return;
    const visibleChoices = draft.choices.map((choice) => choice.trim());
    if (!draft.id.trim() || !draft.prompt.trim() || !draft.hint.trim() || !draft.explanation.trim() || visibleChoices.some((choice) => !choice)) {
      setDraftError('ID, prompt, four choices, hint, and explanation are required.');
      return;
    }
    if (new Set(visibleChoices.map((choice) => choice.toLocaleLowerCase('en-US'))).size !== 4) {
      setDraftError('All four visible answer choices must be distinct.');
      return;
    }
    if (questions.some((question, index) => question.id === draft.id.trim() && index !== editingIndex)) {
      setDraftError('Question IDs must be unique inside the pack.');
      return;
    }
    const question: RawQuestion = {
      id: draft.id.trim(),
      level: draft.level as RawQuestion['level'],
      category: draft.category,
      tags: draft.tags.split(',').map((tag) => tag.trim()).filter(Boolean),
      prompt: draft.prompt.trim(),
      choices: CHOICE_IDS.map((id, index) => ({ id, text: visibleChoices[index] })),
      correctChoiceId: draft.correctChoiceId,
      hint: draft.hint.trim(),
      explanation: draft.explanation.trim(),
      usage: { freshMix: true, setIds: [] }
    };
    setQuestions((current) => editingIndex === null
      ? [...current, question]
      : current.map((item, index) => index === editingIndex ? question : item));
    setDraft(null);
    setEditingIndex(null);
    setDraftError('');
    setPrepared(null);
  }

  function createManualPack(): RawContentPack {
    const setId = 'complete-ladder';
    const selectedSetIds = completeLadder && autoSet
      ? Array.from({ length: 15 }, (_, index) => questions.find((question) => question.level === index + 1)!.id)
      : [];
    const selected = new Set(selectedSetIds);
    const normalizedQuestions = questions.map((question) => ({
      ...question,
      choices: question.choices.map((choice) => ({ ...choice })),
      tags: [...question.tags],
      usage: { freshMix: true, setIds: selected.has(question.id) ? [setId] : [] }
    }));
    const sets = selectedSetIds.length === 15
      ? [{
          id: setId,
          title: `${title.trim() || 'My Trivia Pack'}: Complete Ladder`,
          description: 'An automatically assembled Level 1-15 path using the first available question at each level.',
          theme: title.trim() || 'Mixed',
          tags: ['manual', 'complete-ladder'],
          questionIds: selectedSetIds
        }]
      : [];
    return {
      schemaVersion: '1.0.0',
      id: packId.trim(),
      title: title.trim(),
      description: description.trim(),
      version: version.trim(),
      language: 'en-US',
      contentType: sets.length > 0 ? 'mixed' : 'pool',
      categories: [...new Set(normalizedQuestions.map((question) => question.category))],
      questions: normalizedQuestions,
      sets,
      metadata: {
        author: author.trim(),
        questionCount: normalizedQuestions.length,
        ...(sets.length > 0 ? { setCount: sets.length } : {}),
        reviewStatus: 'unreviewed',
        humanReviewRecommended: true,
        timeSensitiveQuestionCount: 0
      }
    };
  }

  async function validateAndSave(): Promise<void> {
    const transaction = prepareCustomPackImport(createManualPack(), props.existingIdentity, {
      allowPackUpdate: allowUpdate,
      enabled: true
    });
    setPrepared(transaction);
    if (transaction.status === 'ready' && transaction.payload !== null) {
      await props.onSave(transaction.payload, transaction.preview);
    }
  }

  return (
    <div className="content-manager__section manual-pack-editor">
      <header className="content-manager__section-heading"><div><span className="kicker">Form-based authoring</span><h2>Build a Fresh Mix pack</h2><p>Add, edit, and remove questions locally. The same import validator checks the completed pack.</p></div></header>
      <div className="manual-pack-editor__meta panel panel--soft">
        <label className="field-stack"><span>Pack title</span><input type="text" value={title} onChange={(event) => setTitle(event.target.value)} onBlur={() => packId === 'my-trivia-pack' && setPackId(slug(title))} /></label>
        <label className="field-stack"><span>Pack ID</span><input type="text" value={packId} onChange={(event) => setPackId(event.target.value)} /><small className="field-help">Lowercase kebab-case; identity remains stable across updates.</small></label>
        <label className="field-stack"><span>Version</span><input type="text" value={version} onChange={(event) => setVersion(event.target.value)} /></label>
        <label className="field-stack"><span>Author</span><input type="text" value={author} onChange={(event) => setAuthor(event.target.value)} /></label>
        <label className="field-stack manual-pack-editor__description"><span>Description</span><textarea value={description} onChange={(event) => setDescription(event.target.value)} /></label>
      </div>

      <div className="manual-pack-editor__coverage">
        <div><span className="kicker">Ladder coverage</span><strong>{levelCounts.filter((count) => count > 0).length}<small> / 15 levels</small></strong></div>
        <div className="manual-pack-editor__level-grid">{levelCounts.map((count, index) => <span className={count > 0 ? 'filled' : ''} key={index}><b>{index + 1}</b><small>{count}</small></span>)}</div>
        <label className={`manual-pack-editor__auto-set ${completeLadder ? '' : 'disabled'}`}><input type="checkbox" checked={autoSet && completeLadder} disabled={!completeLadder} onChange={(event) => setAutoSet(event.target.checked)} /><i /><span><strong>Also create a curated set</strong><small>{completeLadder ? 'Uses the first question at every level' : 'Unlocks when Levels 1-15 are covered'}</small></span></label>
      </div>

      <header className="content-manager__subheading"><div><h2>Questions</h2><p>{questions.length} authored · choices may reshuffle at run creation</p></div><button type="button" className="secondary-button" onClick={openNewQuestion}>Add question</button></header>
      {questions.length === 0 ? <div className="content-manager__empty"><span>+</span><strong>No questions yet</strong><p>Add a question at any level. Partial pool packs can supplement the built-in catalog.</p></div> : <div className="manual-question-list">{[...questions].sort((left, right) => left.level - right.level).map((question) => { const sourceIndex = questions.indexOf(question); return <article key={question.id}><b>{question.level}</b><div><span>{question.category}</span><strong>{question.prompt}</strong><small>{question.id} · Correct: {question.choices.find((choice) => choice.id === question.correctChoiceId)?.text}</small></div><button type="button" onClick={() => openQuestion(question, sourceIndex)}>Edit</button><button type="button" className="danger" aria-label={`Delete ${question.id}`} onClick={() => { setQuestions((current) => current.filter((_, index) => index !== sourceIndex)); setPrepared(null); }}>Delete</button></article>; })}</div>}

      <div className="manual-pack-editor__savebar"><label className="content-import-update"><input type="checkbox" checked={allowUpdate} onChange={(event) => setAllowUpdate(event.target.checked)} /><span>Update an installed pack with this ID</span></label><button type="button" className="primary-button" disabled={props.busy} onClick={() => void validateAndSave()}>Validate & save pack</button></div>
      {prepared && <ValidationPreview prepared={prepared} />}

      {draft && (
        <Modal title={editingIndex === null ? 'Add question' : 'Edit question'} wide onClose={closeDraft} actions={<><button type="button" className="quiet-button" onClick={closeDraft}>Cancel</button><button type="submit" form="manual-question-form" className="primary-button">Save question</button></>}>
          <form id="manual-question-form" className="manual-question-form" onSubmit={saveQuestion}>
            <label className="field-stack"><span>Question ID</span><input type="text" value={draft.id} onChange={(event) => setDraft({ ...draft, id: event.target.value })} /></label>
            <label className="field-stack"><span>Level</span><select value={draft.level} onChange={(event) => setDraft({ ...draft, level: Number(event.target.value) })}>{Array.from({ length: 15 }, (_, index) => <option key={index + 1} value={index + 1}>Level {index + 1}</option>)}</select></label>
            <label className="field-stack manual-question-form__category"><span>Primary category</span><select value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value as PrimaryCategory })}>{PRIMARY_CATEGORIES.map((category) => <option key={category}>{category}</option>)}</select></label>
            <label className="field-stack manual-question-form__tags"><span>Tags</span><input type="text" value={draft.tags} onChange={(event) => setDraft({ ...draft, tags: event.target.value })} placeholder="chemistry, discoveries" /></label>
            <label className="field-stack manual-question-form__wide"><span>Prompt</span><textarea value={draft.prompt} onChange={(event) => setDraft({ ...draft, prompt: event.target.value })} /></label>
            <fieldset className="manual-question-form__choices"><legend>Answer choices</legend>{CHOICE_IDS.map((choiceId, index) => <div key={choiceId}><input type="radio" name="correct-choice" aria-label={`Mark choice ${choiceId.toUpperCase()} correct`} checked={draft.correctChoiceId === choiceId} onChange={() => setDraft({ ...draft, correctChoiceId: choiceId })} /><span>{choiceId.toUpperCase()}</span><input type="text" aria-label={`Choice ${choiceId.toUpperCase()}`} value={draft.choices[index]} onChange={(event) => { const choices = [...draft.choices] as QuestionDraft['choices']; choices[index] = event.target.value; setDraft({ ...draft, choices }); }} /></div>)}</fieldset>
            <label className="field-stack manual-question-form__wide"><span>Handcrafted hint</span><textarea value={draft.hint} onChange={(event) => setDraft({ ...draft, hint: event.target.value })} /></label>
            <label className="field-stack manual-question-form__wide"><span>Explanation</span><textarea value={draft.explanation} onChange={(event) => setDraft({ ...draft, explanation: event.target.value })} /></label>
            {draftError && <p className="field-error manual-question-form__wide" role="alert">{draftError}</p>}
          </form>
        </Modal>
      )}
    </div>
  );
}
