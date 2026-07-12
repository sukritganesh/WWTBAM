\# Question Bank and Content Specification

Status: Working specification. This document defines the question model, content organization, difficulty ladder, category taxonomy, Fresh Mix selection behavior, curated-set behavior, authoring standards, and validation rules. Finished draft content is stored separately in Question Content Release 001\.

\#\# 1\. Terminology

Use the following terms consistently.

\#\#\# 1.1 General pool

A large collection of independent questions used by Fresh Mix.

\- Questions are organized by exact ladder level from 1 through 15\.  
\- A Fresh Mix run selects one eligible question at each level.  
\- Selection uses the profile-aware unseen, least-seen, and least-recently-seen methodology.  
\- Selection should also favor category and subject diversity without violating level requirements.  
\- The pool may combine built-in content with enabled imported pool content according to the player's selected source scope.

\#\#\# 1.2 Curated set

A deliberately assembled sequence of exactly 15 questions.

\- Exactly one question belongs at each level from 1 through 15\.  
\- Question order is fixed and intentional.  
\- The player may choose a set directly.  
\- Surprise Me may choose a set automatically.  
\- Answer positions may reshuffle for a new attempt, but the question order never changes.  
\- A curated set may be broad general knowledge or focused on a theme.

\#\#\# 1.3 Question pack

A technical import/export container.

A pack may contain:

\- General-pool questions.  
\- One or more curated sets.  
\- Both pool questions and curated sets.

A pack is not the same thing as a 15-question curated set.

\#\# 2\. Required Question Data

Every question must contain:

\- Stable question ID.  
\- Exact ladder level from 1 through 15\.  
\- Primary category.  
\- Prompt.  
\- Exactly four answer choices.  
\- Stable internal ID for every answer choice.  
\- Exactly one correct-choice reference.  
\- Handcrafted hint.  
\- Concise explanation.  
\- Usage membership indicating whether the question is eligible for Fresh Mix, one or more curated sets, or both.

Recommended conceptual shape:

{  
  "id": "stable-question-id",  
  "level": 1,  
  "category": "Science",  
  "tags": \["optional-subject-tag"\],  
  "prompt": "Question text goes here?",  
  "choices": \[  
    { "id": "a", "text": "First answer" },  
    { "id": "b", "text": "Second answer" },  
    { "id": "c", "text": "Third answer" },  
    { "id": "d", "text": "Fourth answer" }  
  \],  
  "correctChoiceId": "b",  
  "hint": "A useful clue that does not reveal the answer.",  
  "explanation": "A concise explanation of why the answer is correct.",  
  "usage": {  
    "freshMix": true,  
    "setIds": \[\]  
  },  
  "metadata": {  
    "language": "en-US",  
    "reviewStatus": "verified",  
    "timeSensitive": false,  
    "validThrough": null  
  }  
}

This example is structural only and is not a finished trivia question.

\#\# 3\. Difficulty Model

\#\#\# 3.1 Level is the authoritative difficulty value

The stored level from 1 through 15 is the canonical difficulty field.

The game derives the following broad user-facing display difficulty bands:

\- Levels 1–5: Easy.  
\- Levels 6–10: Moderate.  
\- Levels 11–14: Difficult.  
\- Level 15: Millionaire.

Do not store a second required difficulty label that can contradict the level. For example, a Level 13 question must never independently claim to be easy.

\#\#\# 3.2 Difficulty progression

Difficulty should rise meaningfully from Level 1 through Level 15\.

Difficulty may increase through:

\- Less common knowledge.  
\- More specific subject matter.  
\- More plausible distractors.  
\- Finer distinctions among options.  
\- Greater reasoning or elimination demands.  
\- More specialized but still fair terminology.

Difficulty must not come from:

\- Deliberately confusing wording.  
\- Trick questions.  
\- Ambiguous facts.  
\- Tiny meaningless technicalities.  
\- Multiple arguably correct answers.  
\- Misleading grammar.  
\- Absurdly implausible distractors.  
\- Purely lucky guessing among obscure names with no reasonable basis for elimination.

\#\#\# 3.3 Named internal level calibration

The exact numeric level remains authoritative. These tier names provide convenient internal language for authoring, review, testing, and analytics.

Foundation — Levels 1–3  
\- Very accessible and broadly familiar.  
\- A broadly educated adult should usually recognize the answer quickly.  
\- Distractors may be clearly wrong, but should never be silly.

Accessible — Levels 4–5  
\- Approachable but requires genuine knowledge rather than automatic recognition.  
\- Level 5 should feel like the first meaningful milestone.

Intermediate — Levels 6–8  
\- Moderate general knowledge.  
\- May require thought, elimination, mental computation, or familiarity with the subject.

Advanced — Levels 9–10  
\- Challenging general knowledge.  
\- Distractors should be increasingly plausible and fine distinctions should matter.

Expert — Levels 11–12  
\- Difficult and increasingly specialized.  
\- May rely on specific historical, scientific, literary, geographic, technological, cultural, linguistic, or numerical knowledge.

Elite — Levels 13–14  
\- Very difficult but fair.  
\- Most casual players will not know the answer immediately.  
\- Questions must remain clearly written, verifiable, and potentially approachable through informed elimination.

Millionaire — Level 15  
\- Exceptional difficulty worthy of the final prize.  
\- Clearly worded, verifiable, and free from ambiguity.  
\- Not dependent on a trivial microscopic fact.  
\- Potentially answerable through deep knowledge, sophisticated reasoning, or intelligent elimination.  
\- A strong conceptual question may be better than the most obscure fact available.

These internal names may be used in planning phrases such as “an Elite Geography question” or “an Intermediate Computation question.” They are derived from level and must not be stored as an independently editable value that could contradict it.

\#\# 4\. Category Taxonomy

Every question must have exactly one primary category for clean statistics and diversity logic.

The settled controlled top-level taxonomy contains 20 categories:

1\. Ancient History — early civilizations and societies through approximately 500 CE, including the ancient Mediterranean, Asia, Africa, the Americas, and the Near East.  
2\. Medieval and Early Modern History — approximately 500–1789, including medieval societies, exploration, empires, the Renaissance, the Reformation, and the early modern world.  
3\. Modern History — approximately 1789 to the present, including revolutions, industrialization, world wars, decolonization, social change, and recent history.  
4\. Geography — countries, cities, regions, borders, maps, landmarks, populations, physical geography, and human geography.  
5\. Astronomy and Space — planets, stars, galaxies, cosmology, constellations, observatories, spaceflight, missions, and astronomical discoveries.  
6\. Science — physics, chemistry, biology, medicine, scientific principles, experiments, discoveries, and laboratory knowledge.  
7\. Nature and Earth — animals, plants, ecosystems, geology, weather, climate, oceans, environmental systems, and the natural world.  
8\. Technology — computing, engineering, inventions, communications, machines, consumer technology, and the history and operation of technological systems.  
9\. Computation — mental arithmetic and numerical reasoning designed to be solved without a calculator, including percentages, fractions, ratios, rates, sequences, probability, estimation, and elegant multi-step calculations.  
10\. Vocabulary — word meanings, synonyms, antonyms, roots, prefixes, suffixes, idioms, etymology, proper usage, and commonly confused words.  
11\. Literature and Language — authors, books, poetry, drama, grammar, linguistics, writing systems, language families, and literary history.  
12\. Art and Culture — visual art, architecture, design, theater, dance, museums, cultural movements, customs, and major works or creators.  
13\. Film and Television — films, television programs, performers, directors, characters, production history, awards, and screen culture.  
14\. Music — composers, performers, instruments, genres, theory, songs, albums, and musical history.  
15\. Sports and Games — sports, athletes, competitions, rules, records, board games, card games, puzzles, and competitive gaming where appropriate.  
16\. Society and Everyday Life — customs, education, transportation, household knowledge, communication, clothing, institutions, and familiar features of daily life.  
17\. Food and Drink — ingredients, dishes, cuisines, cooking methods, beverages, culinary history, and food culture.  
18\. Politics and World Affairs — governments, constitutions, elections, diplomacy, international organizations, political institutions, and stable world-affairs knowledge.  
19\. Mythology and Religion — mythological traditions, religious texts, beliefs, festivals, symbols, sacred places, historical figures, and comparative traditions presented factually and respectfully.  
20\. Business and Economics — companies, industries, trade, banking, finance, currencies, economic principles, business terminology, entrepreneurship, and economic history.

\#\#\# 4.1 Category-boundary rules

\- Science covers formal scientific disciplines; Nature and Earth covers organisms, ecosystems, geology, weather, oceans, climate, and the natural environment.  
\- Astronomy and Space remains separate from Science because it is a large, distinctive trivia domain with its own subject balance.  
\- Vocabulary focuses on individual words and usage; Literature and Language covers broader linguistic and literary knowledge.  
\- General Knowledge is a set theme, pack title, or mode description rather than a primary question category.  
\- A question that crosses categories should use the category most central to what the player must know to answer it.  
\- Optional tags may record secondary subjects without weakening primary-category statistics.

\#\#\# 4.2 Computation standards

Computation questions should feel like enjoyable mental challenges rather than tests of tedious written arithmetic.

\- They must be realistically solvable in the player’s head.  
\- Difficulty should rise through additional steps, abstraction, ratios, percentages, probability, sequences, or insight—not enormous numbers or ugly decimals.  
\- Higher levels may reward shortcuts and mathematical reasoning.  
\- The player should not need a calculator, external tool, or substantial scratch work.  
\- Distractors should reflect plausible calculation errors.

\#\#\# 4.3 Vocabulary standards

Vocabulary questions should test meaningful language knowledge rather than arbitrary dictionary obscurity.

\- Difficulty may rise through rarer but useful words, fine distinctions, roots, etymology, idioms, and nuanced usage.  
\- Answer choices should be grammatically parallel and plausibly confusable.  
\- Avoid regional ambiguity unless the dialect or usage context is stated.  
\- Do not use spelling or phrasing that accidentally reveals the answer.

A question should normally have one primary category and zero or more optional tags. Tags may identify an era, country, discipline, genre, person, invention, work, event, or other narrow subject.

\#\# 5\. Fresh Mix Selection

Fresh Mix selects one question at each exact ladder level.

For each level, the selector should:

1\. Apply the selected content-source scope.  
2\. Exclude disabled packs and invalid questions.  
3\. Exclude questions already chosen for the current run.  
4\. Prefer questions the current profile has never seen.  
5\. If necessary, prefer questions seen the fewest times.  
6\. If still tied, prefer questions seen least recently.  
7\. Among otherwise comparable candidates, favor category and subject diversity.  
8\. Randomly choose among the strongest remaining candidates.

\#\#\# 5.1 Diversity behavior

Pure randomness is not sufficient because it can create repetitive runs.

Use soft diversity preferences rather than rigid quotas.

Recommended goals:

\- Aim for at least five or six distinct primary categories in a run when the eligible bank permits it.  
\- Prefer no primary category appearing more than three times.  
\- Avoid the same narrow tag appearing more than once when alternatives exist.  
\- Avoid multiple questions centered on the same named person, place, event, work, or object when alternatives exist.  
\- Relax diversity preferences when the eligible bank is too small.

Exact ladder level always takes priority over diversity. The system must never use an inappropriate level merely to satisfy a category target.

\#\#\# 5.2 Failure behavior

If any level has no eligible valid question, run creation must fail before the previous global save is replaced.

The setup screen should explain which level or source scope lacks enough content and allow the player to change the selection.

\#\# 6\. Curated Sets

Every curated set must include:

\- Stable set ID.  
\- Title.  
\- Description.  
\- Theme or primary subject.  
\- Optional audience or difficulty note.  
\- Optional tags.  
\- Exactly 15 ordered question IDs.

Validator requirements:

\- Exactly 15 unique questions.  
\- The first question is Level 1, the second is Level 2, and so forth through Level 15\.  
\- No missing references.  
\- No duplicate questions.  
\- Every question is valid.

Conceptual shape:

{  
  "id": "stable-set-id",  
  "title": "Set Title",  
  "description": "Description of the set.",  
  "theme": "History",  
  "tags": \["optional-tag"\],  
  "questionIds": \[  
    "level-01-question-id",  
    "level-02-question-id",  
    "level-03-question-id",  
    "level-04-question-id",  
    "level-05-question-id",  
    "level-06-question-id",  
    "level-07-question-id",  
    "level-08-question-id",  
    "level-09-question-id",  
    "level-10-question-id",  
    "level-11-question-id",  
    "level-12-question-id",  
    "level-13-question-id",  
    "level-14-question-id",  
    "level-15-question-id"  
  \]  
}

This example is structural only and does not identify finished questions.

\#\# 7\. Curated-Set Selection

\#\#\# 7.1 Choose a Set

The player may browse and select a curated set directly.

The set browser may show:

\- Title.  
\- Theme.  
\- Description.  
\- Built-in or imported source.  
\- New, attempted, in progress, walked away, lost, or millionaire-won status.  
\- Best result.  
\- Attempt count.  
\- Previously seen question count.

\#\#\# 7.2 Surprise Me

Surprise Me chooses a curated set automatically.

Recommended priority:

1\. Never attempted sets.  
2\. Incomplete sets.  
3\. Least recently played sets.  
4\. Random among ties.

If every set has been attempted, Surprise Me should still work and favor incomplete or least-recently-played content.

\#\# 8\. General-Pool and Curated-Set Separation

Launch content should generally keep Fresh Mix questions and curated-set questions separate.

Reasons:

\- Prevent Fresh Mix from spoiling a curated set.  
\- Preserve the identity and replay value of curated sets.  
\- Make set progress easier to understand.

The schema may still permit intentional reuse later through usage membership.

Recommended launch policy:

\- A built-in question is normally Fresh Mix eligible or assigned to one curated set, not both.  
\- Imported pack authors may intentionally permit broader reuse if the schema and UI support it.  
\- Historical run snapshots remain valid even if pack membership changes later.

\#\# 9\. Answer-Choice Standards

Every question must contain exactly four distinct visible answers.

All four answers should:

\- Use the same general grammatical form.  
\- Have similar specificity.  
\- Be plausible within the subject.  
\- Avoid obvious length clues.  
\- Avoid overlapping meanings.  
\- Use consistent formatting for names, dates, titles, measurements, and quantities.  
\- Remain independently understandable.

Do not use:

\- All of the above.  
\- None of the above.  
\- Duplicate visible answer text.  
\- Joke answers that destroy difficulty.  
\- Wording that uniquely echoes the prompt and reveals the correct answer.  
\- Distractors from unrelated domains.

The correct answer must be referenced by stable internal choice ID, not by displayed array position. Display letters A through D are assigned only after answer shuffling for the run.

\#\# 10\. Hint Standards

Every question requires a handcrafted hint.

A good hint may:

\- Identify the relevant era or field.  
\- Point toward a scientific or logical principle.  
\- Correct a likely misconception.  
\- Suggest a relationship.  
\- Narrow the conceptual domain.  
\- Provide a related fact that supports reasoning.

A hint must not:

\- Repeat the question.  
\- State the answer in different words.  
\- Eliminate three choices directly.  
\- Refer to a displayed answer letter.  
\- Depend on answer order.  
\- Use wording that appears only in the correct choice and thereby reveals it.

Higher-level hints may still be genuinely useful. They should not become intentionally useless merely because the question is difficult.

\#\# 11\. Explanation Standards

Every question requires a concise explanation shown after resolution and in post-game review.

A good explanation should:

\- State the correct answer clearly.  
\- Explain why it is correct.  
\- Resolve the main likely misconception.  
\- Remain understandable without external context.  
\- Avoid unsupported or unverifiable claims.  
\- Usually remain within two or three concise sentences.

The explanation does not need to discuss every distractor unless the distractors are commonly confused with the correct answer.

\#\# 12\. Stable IDs and Versioning

Question IDs must be stable and must not depend on array position.

Possible built-in naming pattern:

\- builtin-pool-geography-0042  
\- builtin-set-science-01-q07

Imported logical identity should be namespaced by pack ID:

\- pack-id:question-id

Rules:

\- Built-in namespaces are reserved.  
\- Imported content cannot overwrite built-in content.  
\- Minor typo or punctuation corrections may retain the same question ID.  
\- A substantially different question should receive a new ID.  
\- Pack updates should preserve IDs when the underlying question remains conceptually the same.  
\- Changing an existing question while retaining its ID must be surfaced during update review because it affects future interpretation of statistics.

\#\# 13\. Time-Sensitive Content

Prefer stable facts for the launch bank.

Avoid questions whose answers change frequently unless the metadata clearly marks them as time-sensitive.

Recommended optional fields:

\- timeSensitive: true or false.  
\- validThrough: date or null.  
\- sourceNotes.  
\- verificationNotes.  
\- reviewStatus.

Expired or unverified time-sensitive questions should be excluded from future selection until reviewed.

The game itself remains offline and does not verify current facts online during play.

\#\# 14\. Optional Authoring Metadata

The schema should reserve optional metadata such as:

\- language.  
\- author or creator label.  
\- tags.  
\- source notes.  
\- review status.  
\- verification notes.  
\- time-sensitive flag.  
\- valid-through date.  
\- created date.  
\- modified date.  
\- generatedBy label for externally AI-assisted content.

Some authoring metadata may be retained only in source files and stripped from an optimized production payload, provided import/export and review requirements remain satisfied.

\#\# 15\. Validation Requirements

No question may reach gameplay unless it passes validation.

Validate at minimum:

\- Supported schema version.  
\- Stable, correctly formatted ID.  
\- Valid level from 1 through 15\.  
\- Allowed primary category.  
\- Nonempty prompt.  
\- Exactly four answer objects.  
\- Unique answer IDs.  
\- Unique visible answer text.  
\- Exactly one valid correct-choice reference.  
\- Nonempty hint.  
\- Nonempty explanation.  
\- Valid usage membership.  
\- Valid set references.  
\- String length and pack-size limits.  
\- No executable code or unsupported markup.  
\- No reserved built-in namespace collision.

Curated-set validation must additionally confirm:

\- Exactly 15 unique question references.  
\- One correct ladder level in each ordered position.  
\- No broken references.

Invalid built-in content should fail development validation and automated tests.

Invalid imported content should produce a clear preview of errors and warnings and must not be partially committed.

\#\# 16\. Pack-Level Data

A question pack should include:

\- Schema version.  
\- Stable pack ID.  
\- Pack title.  
\- Description.  
\- Author or creator label.  
\- Pack version.  
\- Language.  
\- Tags or categories.  
\- Content type.  
\- Questions.  
\- Curated-set manifests.  
\- Optional provenance and review metadata.

A pack may be imported from a file, pasted JSON, the in-app editor, or an externally AI-generated result. All methods must use the same validation pipeline.

\#\# 17\. Authoring and Review Principles

Questions should be:

\- Factually correct.  
\- Clearly worded.  
\- Fair at the assigned level.  
\- Free of accidental clues.  
\- Supported by plausible distractors.  
\- Suitable for text-to-speech.  
\- Concise enough for the fixed 16:9 interface.  
\- Verifiable by a human reviewer.

Externally AI-generated questions must be human-reviewed for:

\- Factual accuracy.  
\- Ambiguity.  
\- Difficulty calibration.  
\- Distractor quality.  
\- Hint leakage.  
\- Explanation quality.  
\- Time sensitivity.

Structural validation does not prove factual correctness.

\#\# 18\. Modular Question Files and Runtime Catalog

\#\#\# 18.1 Source-file strategy

The built-in question bank must be modular and expandable. It must not be authored as one enormous JSON file, and it should not require one file per individual question.

Recommended source organization:

src/content/built-in/  
  manifest.json  
  pool/  
    general-pool-001.json  
    general-pool-002.json  
    astronomy-pool-001.json  
    modern-history-pool-001.json  
    computation-pool-001.json  
  sets/  
    mixed-general-01.json  
    astronomy-01.json  
    computation-challenge-01.json  
    mythology-across-cultures-01.json

Pool files should normally contain a manageable batch of approximately 50–200 independent questions. The exact size may vary when a coherent batch is smaller or larger. A pool file may be broadly mixed or category-focused; every individual question still carries its own authoritative level, category, tags, usage, and metadata.

Curated-set files should normally contain one complete 15-question set, including its set manifest and the 15 referenced or bundled questions. A small group of closely related sets may share one technical pack when that is clearer, but individual set files are preferred for reviewability.

This structure must support adding new source files later without rewriting existing question files, changing stable question IDs, or redesigning the database. Newly generated batches, manually authored batches, and externally AI-assisted batches should all use the same schemas and validation pipeline.

\#\#\# 18.2 Built-in content manifest

The built-in manifest is the authoritative list of source files included with the application. It should record enough information to load and validate each file, including:

\- Stable source or pack ID.  
\- Relative file path.  
\- Schema version.  
\- Content type: pool questions, curated sets, or both.  
\- Pack or source version.  
\- Default enabled state where applicable.  
\- Optional category or theme labels for authoring convenience.  
\- Optional file hash or integrity metadata for accidental-corruption detection.

The application must not depend on directory scanning at runtime. Codex should generate or maintain the manifest explicitly so builds are deterministic and missing files are detected during validation.

\#\#\# 18.3 Source data versus runtime catalog

Raw JSON files are authoring, review, import, and distribution sources. Fresh Mix must not randomly open source files when a game begins.

At build time or application initialization, the content pipeline should:

1\. Read every file listed in the built-in manifest.  
2\. Parse and structurally validate every pack, question, and set.  
3\. Resolve namespaced stable identities.  
4\. Reject duplicates, broken set references, invalid categories, invalid levels, and malformed metadata.  
5\. Normalize valid content into one consistent internal question and set representation.  
6\. Build a unified catalog combining built-in content and enabled imported content.  
7\. Make that normalized catalog available to the local database, Content Manager, statistics, and question-selection services.

Question selection operates only on the normalized catalog. It selects eligible questions by exact level, profile history, enabled source scope, and diversity rules regardless of which source JSON file originally contained them.

\#\#\# 18.4 Runtime database organization

The local content database and repository layer should index or efficiently query questions by at least:

\- Globally stable question identity.  
\- Exact level from 1 through 15\.  
\- Derived internal calibration tier.  
\- Derived display difficulty band.  
\- Primary category.  
\- Optional tags and narrow subjects.  
\- Built-in or imported origin.  
\- Source pack and source-file identity.  
\- Fresh Mix eligibility.  
\- Curated-set membership.  
\- Enabled or disabled status.  
\- Review and verification status.  
\- Time-sensitive and valid-through status.  
\- Profile encounter history through the separate history relationship.

The database should store normalized records rather than treating each JSON file as a runtime silo. Questions from multiple valid files form one searchable catalog, while source and pack metadata remain attached for management, filtering, updates, and provenance.

\#\#\# 18.5 Content Manager and coverage summaries

For authoring convenience, validation, and future expansion, the Content Manager should be able to summarize the normalized catalog by:

\- Total questions and curated sets.  
\- Questions per exact level.  
\- Questions per display band and internal tier.  
\- Questions per primary category.  
\- Category-by-level coverage.  
\- Tags or subjects that are overrepresented or underrepresented.  
\- Pool questions versus curated-set questions.  
\- Built-in versus imported content.  
\- Enabled versus disabled packs.  
\- Verified, unreviewed, expired, or otherwise ineligible content.  
\- Duplicate-ID, close-overlap, missing-level, and broken-reference warnings.

These summaries are for organization and quality control. They do not replace per-profile freshness and diversity logic during Fresh Mix selection.

\#\#\# 18.6 Modularity rules

\- Do not place the complete launch bank in one monolithic JSON file.  
\- Do not create one production source file for every single question.  
\- Prefer medium-sized, coherent, independently valid files.  
\- Every file must be independently identifiable and versioned through its manifest or pack metadata.  
\- Adding a valid file and manifest entry should expand the catalog without modifying older files.  
\- Removing or updating a source file must not corrupt saved games or history because those records retain resolved question snapshots.  
\- A malformed new file must not partially enter the catalog.  
\- The content architecture must remain suitable for creating and importing very large numbers of questions over time.

\#\# 19\. Settled Decisions

Settled so far:

\- The game has a large general pool for Fresh Mix.  
\- The game has multiple curated 15-question sets.  
\- Curated sets can be selected directly or chosen through Surprise Me.  
\- Every run contains one question at each exact level from 1 through 15\.  
\- Every question has exactly one primary category from the settled 20-category taxonomy.  
\- Level 1 through 15 is the authoritative difficulty value.  
\- The broad display band and named internal calibration tier are both derived from level.  
\- Every question has four stable answer objects, one stable correct-choice reference, one hint, one explanation, and one stable ID.  
\- Fresh Mix uses profile-aware freshness plus soft category and subject diversity.  
\- Curated-set question order is fixed.  
\- Answer display order may reshuffle between new attempts but is frozen within a saved run.  
\- Built-in launch content should generally separate general-pool and curated-set questions.  
\- Imported content passes the same structural validation as built-in content.  
\- Question Content Release 001 provides 300 Fresh Mix questions and 12 curated sets containing 180 separate questions.

\#\# 20\. Remaining Content Decisions

Question Content Release 001 settles the initial built-in volume: 300 Fresh Mix questions, 12 curated sets containing 180 separate questions, and 480 unique questions overall. All 20 primary categories have one pool question at every exact level from 1 through 15\.

Future refinements still include:

\- Exact optional tag vocabulary and alias policy.  
\- Exact maximum prompt, answer, hint, explanation, and pack-size limits.  
\- Detailed policy for future time-sensitive content.  
\- The long-term human fact-checking and source-recording workflow.  
\- Whether imported questions may belong to multiple curated sets.  
\- Whether CSV import should later supplement JSON.  
\- Final production JSON Schema files, compatibility rules, and migration behavior.  
\- Ongoing editorial review and play-test-driven difficulty adjustments.

These remaining decisions do not block Codex from ingesting, normalizing, validating, and using the supplied initial release.

