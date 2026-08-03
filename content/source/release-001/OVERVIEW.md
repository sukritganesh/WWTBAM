# Question Content Release 001

## Initial built-in trivia content for the millionaire-style game

Overview

Release 001 v1.1.0 contains 525 unique multiple-choice questions in modular JSON files. Every question includes a stable ID, exact level from 1 through 15, primary category, optional tags, four stable answer choices, one correct-choice reference, a hint, an explanation, usage membership, and review metadata.

Fresh Mix pool

The pool\_json folder contains 5 medium-sized source files and 300 questions. Each file groups four related primary categories and contains 60 questions. All 20 primary categories have exactly 15 questions: one question at each exact level from 1 through 15\. This creates perfectly even category and level coverage for the initial Fresh Mix catalog.

Curated sets

The curated\_sets\_json folder contains 7 modular JSON files holding 15 separate 15-question sets and 225 additional questions. The original six files contain two related sets each; the v1.1.0 geography supplement contains three. Pool and curated-set questions are separate, so Fresh Mix does not spoil these sets.

Nine single-category sets:
\- Astronomy and Space: First Light
\- Computation Challenge: Mental Gymnastics
\- Vocabulary: Words Worth Knowing
\- Ancient History: Empires and Ideas
\- Geography: Around the World
\- Science: Principles and Discoveries
\- Physical Geography: Forces and Features
\- Borders and Human Geography
\- Islands, Seas, and Archipelagos

Six mixed-category sets:  
\- General Knowledge I: The Opening Round  
\- General Knowledge II: Wider Horizons  
\- World and Civilizations  
\- STEM Challenge  
\- Arts and Culture  
\- Everyday Expert

Manifests and coverage

The manifests folder contains manifest.json and coverage-index.json. The manifest identifies every source file, pack ID, category scope, question count, and SHA-256 integrity hash. The coverage index summarizes category, level, display-band, internal-tier, set, and validation coverage.

Validation performed

Automated structural checks confirmed:  
\- 525 unique question IDs
\- 525 unique prompts
\- Exactly four distinct answer choices per question  
\- Exactly one valid correct answer reference per question  
\- Complete level 1–15 coverage for every pool category and every curated set  
\- No broken curated-set references  
\- No time-sensitive questions  
\- No malformed pack files

Editorial status

The files are marked assistant-reviewed-draft. They were generated using stable, non-current facts and passed structural validation. Because this is a large AI-assisted content batch, a human editorial and factual spot-check is still recommended before treating the collection as a final published question bank. Difficulty calibration should also be play-tested and adjusted from real player results.

Known normalization repairs  
The source JSON files remain immutable and their manifest hashes remain valid. During repository ingestion, Codex should apply the following wording-only repairs to normalized copies while preserving the stable question IDs:

\- builtin-pool-technology-07: use the hint “The acronym describes an array designed to tolerate drive failures.”  
\- builtin-pool-music-03: use the hint “This family also includes the viola, cello, and double bass.”  
\- builtin-pool-music-13: use the hint “The interval spans six semitones.”  
\- builtin-pool-sports-and-games-05: use the hint “A batter can accumulate two strikes and remain at the plate.”  
\- builtin-pool-mythology-and-religion-12: use the hint “Its language gives this collection its conventional name.”

These repairs remove accidental answer leakage from hints. They do not change prompts, choices, correct answers, categories, levels, set membership, or IDs.

Intended integration  
Codex should ingest these files through the manifest-driven validation and normalization pipeline described in the technical specification. Gameplay should query the normalized local catalog and database indexes rather than opening raw JSON files at question-selection time. More pool files and curated sets can be added later by preserving stable IDs and adding valid manifest entries.

Source verification
The original Drive release was re-read from storage and validated after upload. Release 001 v1.1.0 retains those 11 original payloads byte-for-byte and adds one locally authored geography pack. The current manifest hashes match the exact repository bytes of all five pool files and all seven curated-set files.
