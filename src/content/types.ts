export const PRIMARY_CATEGORIES = [
  'Ancient History',
  'Medieval and Early Modern History',
  'Modern History',
  'Geography',
  'Astronomy and Space',
  'Science',
  'Nature and Earth',
  'Technology',
  'Computation',
  'Vocabulary',
  'Literature and Language',
  'Art and Culture',
  'Film and Television',
  'Music',
  'Sports and Games',
  'Society and Everyday Life',
  'Food and Drink',
  'Politics and World Affairs',
  'Mythology and Religion',
  'Business and Economics'
] as const;

export type PrimaryCategory = (typeof PRIMARY_CATEGORIES)[number];

export type LadderLevel =
  | 1
  | 2
  | 3
  | 4
  | 5
  | 6
  | 7
  | 8
  | 9
  | 10
  | 11
  | 12
  | 13
  | 14
  | 15;

export type DisplayDifficulty = 'Easy' | 'Moderate' | 'Difficult' | 'Millionaire';

export type InternalTier =
  | 'Foundation'
  | 'Accessible'
  | 'Intermediate'
  | 'Advanced'
  | 'Expert'
  | 'Elite'
  | 'Millionaire';

export type ContentOrigin = 'built-in' | 'imported';
export type PackContentType = 'pool' | 'curated-sets' | 'mixed' | 'both';

export interface RawChoice {
  id: string;
  text: string;
}

export interface RawQuestionUsage {
  freshMix: boolean;
  setIds: string[];
}

export interface RawQuestionMetadata {
  language?: string;
  author?: string;
  reviewStatus?: string;
  verificationNotes?: string;
  sourceNotes?: string;
  generatedBy?: string;
  timeSensitive?: boolean;
  validThrough?: string | null;
  createdAt?: string;
  modifiedAt?: string;
}

export interface RawQuestion {
  id: string;
  level: LadderLevel;
  category: PrimaryCategory;
  tags: string[];
  prompt: string;
  choices: RawChoice[];
  correctChoiceId: string;
  hint: string;
  explanation: string;
  usage: RawQuestionUsage;
  metadata?: RawQuestionMetadata;
}

export interface RawCuratedSet {
  id: string;
  title: string;
  description: string;
  theme: string;
  tags: string[];
  questionIds: string[];
  audience?: string;
  difficultyNote?: string;
}

export interface RawPackMetadata extends Record<string, unknown> {
  author?: string;
  creator?: string;
  questionCount?: number;
  questionsPerCategory?: number;
  setCount?: number;
  reviewStatus?: string;
  humanReviewRecommended?: boolean;
  timeSensitiveQuestionCount?: number;
  sourceNotes?: string;
  verificationNotes?: string;
  generatedBy?: string;
  createdAt?: string;
  modifiedAt?: string;
}

export interface RawContentPack {
  schemaVersion: string;
  id: string;
  title: string;
  description: string;
  version: string;
  language: string;
  contentType: PackContentType;
  categories: PrimaryCategory[];
  questions: RawQuestion[];
  sets: RawCuratedSet[];
  metadata: RawPackMetadata;
}

export interface ReleaseManifestTotals {
  poolFiles: number;
  curatedSetFiles: number;
  poolQuestions: number;
  curatedSetQuestions: number;
  totalUniqueQuestions: number;
  curatedSets: number;
  primaryCategories: number;
}

export interface ReleaseManifestFile {
  kind: 'pool' | 'set';
  path: string;
  packId: string;
  questionCount: number;
  categories: PrimaryCategory[];
  sha256: string;
  defaultEnabled: boolean;
}

export interface ReleaseManifest {
  schemaVersion: string;
  id: string;
  title: string;
  version: string;
  description: string;
  totals: ReleaseManifestTotals;
  files: ReleaseManifestFile[];
  integrity: {
    hashAlgorithm: 'SHA-256';
    hashScope: string;
    validatedAt: string;
  };
}

export interface NormalizedChoice {
  id: string;
  text: string;
}

export interface NormalizedQuestionMetadata {
  language: string;
  author: string;
  reviewStatus: string;
  humanReviewRecommended: boolean;
  verificationNotes: string | null;
  sourceNotes: string | null;
  generatedBy: string | null;
  timeSensitive: boolean;
  validThrough: string | null;
}

export interface NormalizationRepair {
  code: 'hint-answer-leakage';
  field: 'hint';
  sourceValue: string;
  normalizedValue: string;
}

export interface NormalizedQuestion {
  id: string;
  localId: string;
  level: LadderLevel;
  displayDifficulty: DisplayDifficulty;
  internalTier: InternalTier;
  category: PrimaryCategory;
  tags: string[];
  prompt: string;
  choices: NormalizedChoice[];
  correctChoiceId: string;
  hint: string;
  explanation: string;
  usage: RawQuestionUsage;
  metadata: NormalizedQuestionMetadata;
  origin: ContentOrigin;
  sourcePackId: string;
  sourceFile: string;
  sourceVersion: string;
  enabled: boolean;
  normalizationRepairs: NormalizationRepair[];
}

export interface NormalizedCuratedSet {
  id: string;
  localId: string;
  title: string;
  description: string;
  theme: string;
  tags: string[];
  questionIds: string[];
  audience: string | null;
  difficultyNote: string | null;
  origin: ContentOrigin;
  sourcePackId: string;
  sourceFile: string;
  sourceVersion: string;
  enabled: boolean;
}

export interface NormalizedContentSource {
  id: string;
  title: string;
  description: string;
  version: string;
  schemaVersion: string;
  language: string;
  contentType: PackContentType;
  categories: PrimaryCategory[];
  origin: ContentOrigin;
  sourceFile: string;
  enabled: boolean;
  metadata: RawPackMetadata;
  sourceSha256: string | null;
}

export interface NormalizedPack {
  source: NormalizedContentSource;
  questions: NormalizedQuestion[];
  sets: NormalizedCuratedSet[];
}

export type ValidationSeverity = 'error' | 'warning';

export interface ValidationIssue {
  severity: ValidationSeverity;
  code: string;
  path: string;
  message: string;
}

export interface ValidationResult<T> {
  valid: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  value?: T;
}

export interface CatalogIndexes {
  byLevel: Record<string, string[]>;
  byCategory: Record<string, string[]>;
  byTag: Record<string, string[]>;
  bySourcePack: Record<string, string[]>;
  bySet: Record<string, string[]>;
  freshMixQuestionIds: string[];
  eligibleFreshMixQuestionIds: string[];
}

export interface CatalogSummary {
  questionCount: number;
  freshMixQuestionCount: number;
  curatedQuestionCount: number;
  curatedSetCount: number;
  sourceCount: number;
  categoryCount: number;
  byLevel: Record<string, number>;
  byDisplayDifficulty: Record<DisplayDifficulty, number>;
  byInternalTier: Record<InternalTier, number>;
  byCategory: Record<string, number>;
  bySourcePack: Record<string, number>;
  byReviewStatus: Record<string, number>;
  missingFreshMixLevels: number[];
  missingCategoryLevelCells: string[];
}

export interface SerializedContentCatalog {
  schemaVersion: string;
  releaseId: string;
  releaseVersion: string;
  questions: NormalizedQuestion[];
  sets: NormalizedCuratedSet[];
  sources: NormalizedContentSource[];
  indexes: CatalogIndexes;
  summary: CatalogSummary;
}

export interface RuntimeContentCatalog extends SerializedContentCatalog {
  questionById: ReadonlyMap<string, NormalizedQuestion>;
  setById: ReadonlyMap<string, NormalizedCuratedSet>;
  sourceById: ReadonlyMap<string, NormalizedContentSource>;
}

export interface ImportConflict {
  kind: 'pack' | 'question' | 'set';
  id: string;
  existingPackId: string | null;
  message: string;
}

export interface ImportPreview {
  valid: boolean;
  packId: string | null;
  packVersion: string | null;
  questionCount: number;
  freshMixQuestionCount: number;
  setCount: number;
  levelsRepresented: number[];
  categoriesRepresented: string[];
  conflicts: ImportConflict[];
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
}

export interface PreparedImportPayload {
  pack: NormalizedPack;
  operation: 'install' | 'update';
}

export interface PreparedImportTransaction {
  status: 'ready' | 'rejected';
  preview: ImportPreview;
  payload: PreparedImportPayload | null;
}

export interface ExistingContentIdentity {
  packVersions: ReadonlyMap<string, string>;
  questionOwners: ReadonlyMap<string, string>;
  setOwners: ReadonlyMap<string, string>;
}
