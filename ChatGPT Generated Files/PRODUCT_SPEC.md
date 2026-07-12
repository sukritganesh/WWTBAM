\# Product Specification: Millionaire-Style Trivia Game

Status: Working product definition. This document records the settled product requirements available at handoff. Codex may fill non-blocking gaps and refine implementation details while preserving the core product invariants.

\#\# 1\. Product Summary

The product is a polished, single-player browser trivia game based on the familiar fifteen-question millionaire quiz format. A player answers increasingly difficult multiple-choice questions, climbs a prize ladder, decides whether to risk their current winnings, and wins the game by answering Question 15 correctly for a top prize of $1,000,000.

The initial version is solo only. It does not require online multiplayer, a live host, user accounts, a backend server, or real-money transactions. Player profiles, saved games, and history are stored locally on the device.

The game should feel like a finished small game rather than a bare quiz form. Presentation, suspense, progression, replayability, and persistent player history are core parts of the product.

\#\# 2\. Core Game Loop

1\. The player chooses or creates a local profile, or continues as a guest.  
2\. The player chooses a game mode and starts a fifteen-question run.  
3\. Each round presents one question and four possible answers labeled A, B, C, and D.  
4\. The player selects an answer. The selection can be changed until it is locked.  
5\. The player presses “Lock In Answer.”  
6\. The game asks for final confirmation, such as “Is that your final answer?”  
7\. After confirmation, the answer is permanently locked and a short suspense sequence plays.  
8\. A correct answer advances the player to the next round and increases current winnings.  
9\. An incorrect answer ends the run and awards the appropriate guaranteed checkpoint amount.  
10\. Before locking an answer, the player may use an available lifeline or walk away.  
11\. Correctly answering Question 15 wins $1,000,000 and completes the run.

Completed questions cannot be revisited. There is no backtracking, changing a locked answer, or replaying an earlier round within the same run.

\#\# 3\. Prize Ladder

| Question | Prize |  
| \--- | \---: |  
| 1 | $100 |  
| 2 | $200 |  
| 3 | $300 |  
| 4 | $500 |  
| 5 | $1,000 |  
| 6 | $2,000 |  
| 7 | $4,000 |  
| 8 | $8,000 |  
| 9 | $16,000 |  
| 10 | $32,000 |  
| 11 | $64,000 |  
| 12 | $125,000 |  
| 13 | $250,000 |  
| 14 | $500,000 |  
| 15 | $1,000,000 |

\#\#\# Guaranteed checkpoints

\- Correctly answering Question 5 guarantees $1,000.  
\- Correctly answering Question 10 guarantees $32,000.  
\- Losing before the first checkpoint awards $0.  
\- Losing after reaching $1,000 but before reaching $32,000 awards $1,000.  
\- Losing after reaching $32,000 awards $32,000.  
\- Walking away awards the full value of the last correctly answered question, not merely the checkpoint amount.

Example: a player who has correctly answered Question 11 may walk away with $64,000. If that player attempts Question 12 and answers incorrectly, the run ends with the guaranteed $32,000 checkpoint prize.

\#\# 4\. Difficulty Progression

Every round has its own ladder level from 1 through 15\. The difficulty curve should rise progressively rather than rely only on broad easy, medium, and hard categories.

\- Questions 1–5: easy and broadly familiar general knowledge.  
\- Questions 6–10: moderate general knowledge requiring more specific recall or reasoning.  
\- Questions 11–14: genuinely difficult but fair.  
\- Question 15: exceptional millionaire-level difficulty, while still being clear, verifiable, and answerable.

A Question 6 item should normally be easier than a Question 10 item, and a Question 12 item should normally be easier than a Question 15 item.

\#\# 5\. Answer Selection and Lock-In

\- Every question has exactly four answer choices.  
\- The player may select, deselect, or change an answer before locking it.  
\- Selecting an answer should create a strong visual selected state without resolving the question.  
\- The player must use a dedicated lock-in control.  
\- Locking requires a final confirmation step to prevent accidental submissions.  
\- Once the final confirmation is accepted, all lifelines, pausing, walking away, and answer changes are disabled until the result is revealed.  
\- After a wrong answer, the game reveals both the player’s answer and the correct answer.  
\- After any resolved answer, the game may display a concise educational explanation.

There is no timer on ordinary questions. Players may think for as long as they need.

\#\# 6\. Walking Away

The player may walk away at any time before finally locking the current answer.

\- Walking away ends the run voluntarily.  
\- The player keeps the value of the last correctly answered question.  
\- Using one or both lifelines does not remove the right to walk away.  
\- Walking away is unavailable after final answer confirmation.  
\- The game should require confirmation before ending the run.

\#\# 7\. Lifelines

Every new run begins with two single-use lifelines. Both lifelines may be used on the same question. A used lifeline remains consumed for the rest of that run.

\#\#\# 7.1 Phone a Friend

This is a real-world, trust-based lifeline rather than a simulated character response.

\- Activating it starts a 60-second countdown.  
\- The question and all four answers remain visible during the countdown.  
\- The player is expected to contact a real friend using their own phone or another method.  
\- The game does not place the call, validate the call, prevent external research, or implement anti-cheat controls.  
\- The player may press “End Call Early.”  
\- The player cannot lock an answer until the countdown finishes or is ended early.  
\- The phone timer cannot be paused. If the player opens Pause or Help during the countdown, the call ends immediately, all remaining time is discarded, and Phone a Friend remains consumed.  
\- Once activated, Phone a Friend is permanently consumed for the run.

\#\#\# 7.2 Hint

Every question includes one handcrafted hint in the question bank.

\- Activating Hint reveals that question’s stored hint.  
\- The hint should help the player reason toward the answer without directly stating it.  
\- Useful hint styles include identifying the relevant period or subject area, correcting a common misconception, giving a related fact, or narrowing the conceptual possibilities.  
\- The hint should not simply restate the question or reveal the correct option verbatim.  
\- Once activated, Hint is permanently consumed for the run.

\#\# 8\. Run End States

A run ends in exactly one of the following primary ways:

1\. Incorrect answer.  
2\. Voluntary walk-away.  
3\. Correctly answering Question 15 and becoming a millionaire.

An abandoned active save that is deliberately replaced by a new game should also be recorded or handled consistently, but it is not a normal completed-game outcome.

\#\# 9\. Player Profiles and Guest Play

\#\#\# 9.1 Local profiles

Players may create a local profile by entering a display name. Profiles do not require an email address, password, or online account.

\- Profile names do not need to be unique.  
\- Each profile receives a generated internal ID.  
\- The application supports a maximum of 20 named profiles; Guest remains available at the limit.  
\- A player can select an existing profile from the main menu.  
\- Profile data is stored locally in the browser or installed app environment.

A profile should support at least the following persistent information:

\- Display name and internal ID.  
\- Profile creation date and last-played date.  
\- Games started and games completed.  
\- Millionaire wins.  
\- Highest question reached.  
\- Highest prize won.  
\- Total virtual winnings.  
\- Total correct and incorrect answers.  
\- Walk-away count.  
\- Lifeline usage statistics.  
\- Recent game history.  
\- Question encounter history.  
\- Curated-set progress and results.  
\- Ownership of the application’s single global saved run, when that save belongs to the profile.

\#\#\# 9.2 Guest mode

Players may alternatively play as a guest.

\- Guest mode supports a complete game.  
\- Guest progress is not added to a permanent named career profile.  
\- The current guest run should survive an accidental refresh on the same device when practical.  
\- The game should avoid repeats within the current guest session.  
\- Importing guest history into a new profile is not required for the initial version and may be considered later.

\#\# 10\. Saving, Loading, and Pausing

\#\#\# 10.1 Autosave

The active run should autosave after every meaningful state change, including:

\- Starting a run.  
\- Displaying a new question.  
\- Selecting or clearing an answer.  
\- Revealing a hint.  
\- Activating or completing Phone a Friend.  
\- Correctly resolving a question and advancing.  
\- Pausing.  
\- Saving and exiting.  
\- Walking away.  
\- Ending the run.

Refreshing or closing the tab should not ordinarily destroy an active profile run.

\#\#\# 10.2 Manual save and exit

The pause menu includes “Save and Exit to Main Menu.” When the profile is selected later, the game offers “Continue Saved Game.”

The application has exactly one global saved-game slot across all profiles and Guest mode. The save records its owning profile ID or Guest ownership and may be resumed only by that owner. Starting any confirmed new run, under any profile or as Guest, permanently replaces the existing global save after a clear warning. Merely opening New Game setup does not replace it.

\#\#\# 10.3 Exact restoration

A loaded game must resume the exact same run. The saved state must preserve at least:

\- Game mode and selected set, if applicable.  
\- All fifteen reserved question IDs.  
\- The answer ordering for every reserved question.  
\- Current question number.  
\- Current and guaranteed winnings.  
\- Lifeline availability and usage.  
\- Whether the current hint has been revealed.  
\- Current unconfirmed answer selection.  
\- Phone timer state if saving is ever permitted around that flow.  
\- Elapsed play time.  
\- Overall game state and any pending transition.

Loading may not reroll questions, reorder choices, restore consumed lifelines, or otherwise alter the challenge.

\#\#\# 10.4 Pause behavior

\- Pausing opens an overlay and suspends ordinary presentation and game interaction.  
\- Because normal questions are untimed, pause is primarily for taking a break, privacy, settings, or saving and exiting.  
\- Phone a Friend cannot be paused. Pressing Pause or opening Help during the countdown immediately ends the call, discards the remaining time, leaves the lifeline consumed, and then opens the requested overlay.

\#\# 11\. Game History and Player Statistics

Each completed run should record:

\- Date and time.  
\- Game mode and question set, when relevant.  
\- Final outcome: incorrect answer, walked away, or millionaire win.  
\- Highest question reached.  
\- Amount won.  
\- Highest guaranteed checkpoint reached.  
\- Number of correct answers.  
\- Lifelines used.  
\- Duration of the run.  
\- The question on which the player lost or walked away.

The profile dashboard should be capable of showing:

\- Career overview.  
\- Personal best.  
\- Recent runs.  
\- Number of millionaire wins.  
\- Total virtual winnings.  
\- Average question reached.  
\- Overall correct-answer rate.  
\- Progress distribution across the prize ladder.  
\- Total time played.  
\- Most frequently used lifeline.  
\- Unique questions seen and question-bank completion.  
\- Accuracy by category and ladder level.  
\- Curated sets attempted, completed, and won.

Not every possible statistic must be visually prominent in the first release, but the data model should avoid blocking useful future analytics.

\#\# 12\. Post-Game Review

After a run ends, the player should be able to review the questions actually displayed during that run. The review may show:

\- Question text.  
\- Four answer choices.  
\- The player’s selected answer, when one was submitted.  
\- Correct answer.  
\- Hint.  
\- Explanation.  
\- Whether the question was answered correctly, answered incorrectly, or left unanswered by walking away.

Explanations should be educational and appear only after the answer is resolved or the run is over. They must not leak answers during active play.

\#\# 13\. Question Selection Modes

The game uses a hybrid model: dynamically assembled personalized runs and authored fifteen-question sets.

\#\#\# 13.1 Fresh Mix

Fresh Mix builds a new run by selecting exactly one question for each ladder level from 1 through 15\.

For a named profile, the selection algorithm should prioritize:

1\. Questions the player has never seen.  
2\. Questions seen the fewest times.  
3\. Questions not seen for the longest time.  
4\. Random choice among equally suitable candidates.

As long as an unseen question is available at every ladder level, the player receives fifteen entirely new questions.

If one or more levels have no unseen questions remaining, the game should continue rather than block play. It should transparently warn that repeats may occur and select the least-repeated, least-recently-seen eligible questions.

Before a Fresh Mix begins, the interface may show a freshness estimate such as:

\- “15 new questions.”  
\- “Mostly new: 12 of 15.”  
\- “Replay mix.”  
\- “All available questions discovered.”

\#\#\# 13.2 Choose a Set

A curated question set is a deliberately authored sequence of exactly fifteen questions, with one question assigned to each prize-ladder level.

Each set should contain metadata such as:

\- Stable set ID.  
\- Title.  
\- Short description.  
\- Theme or category.  
\- Overall difficulty or intended audience, when relevant.  
\- Fifteen ordered question IDs.

The initial launch catalog is supplied in Question Content Release 001: six single-category sets and six mixed-category sets. The set browser must remain data-driven so future valid sets appear without redesigning the interface.

The set browser may show profile-specific status such as:

\- New.  
\- In progress.  
\- Attempted.  
\- Completed by walking away.  
\- Millionaire won.  
\- Number of previously seen questions.  
\- Best result and attempts.

A curated set preserves its intended question order. A new attempt may reshuffle answer positions, but a saved attempt must preserve the answer ordering generated for that attempt.

\#\#\# 13.3 Surprise Me

Surprise Me is included as a secondary option. It prioritizes never-attempted sets, then incomplete or least-recently-played sets, with random selection among equivalent candidates.

\#\#\# 13.4 Pool separation

The current recommendation is to keep the Fresh Mix pool and curated-set content separate in the initial release. This prevents random play from spoiling a large portion of a curated set before the player deliberately chooses it.

The data model may permit reuse later, but content-authoring policy should initially treat a question as either:

\- A Fresh Mix pool question, or  
\- A question belonging to a specific curated set.

This recommendation can be revisited when the question-bank scale is decided.

\#\# 14\. What Counts as a Seen Question

A question becomes “seen” when it is actually displayed to the player, not merely when it is reserved as part of a fifteen-question run.

\- All fifteen questions may be selected and stored when the run starts.  
\- Only the current question is marked as seen when its screen first appears.  
\- Reloading the same saved question does not increment the view count again.  
\- Undisplayed questions from an abandoned or replaced run remain eligible as unseen questions.  
\- Seeing, answering, answering correctly, answering incorrectly, walking away, and using a hint should be tracked as distinct events.

Per-question profile history may include:

\- First-seen date.  
\- Most-recently-seen date.  
\- Number of times seen.  
\- Number of times answered.  
\- Correct and incorrect counts.  
\- Walk-away count for that question.  
\- Hint usage.  
\- Category and ladder-level performance.

\#\# 15\. Curated-Set Replay and Completion

Curated sets remain replayable after completion.

Set-level records should support distinctions such as:

\- Attempted.  
\- Ended on an incorrect answer.  
\- Walked away.  
\- Reached Question 15\.  
\- Won $1,000,000.  
\- Won on the first attempt.  
\- Won without using lifelines.

The exact achievement system, badges, or reward presentation remains a later design decision.

\#\# 16\. Minimum Question Content Requirements

Every playable question must eventually include:

\- Stable unique question ID.  
\- Pool or set membership.  
\- Ladder level from 1 through 15\.  
\- Category.  
\- Question text.  
\- Exactly four answer choices.  
\- Exactly one correct answer.  
\- Handcrafted hint.  
\- Concise post-answer explanation.

Additional authoring, sourcing, validation, difficulty calibration, and schema details will be defined in the question-bank planning phase and \`QUESTION\_BANK\_SPEC.md\`.

\#\# 17\. Persistence Scope

The initial product uses local persistence rather than an online account system.

\- No backend is required for the first version.  
\- No email address or password is required.  
\- Profiles, saves, statistics, and history live on the current device/browser.  
\- The technical specification will choose the exact storage mechanism and migration/versioning strategy.  
\- The UI should make it clear that clearing browser data may remove local profiles unless a future export or cloud feature is added.

\#\# 18\. Current Scope Boundaries

Included in the initial product direction:

\- Single-player play.  
\- Fifteen-question prize ladder.  
\- Four-choice questions.  
\- Increasing difficulty.  
\- Lock-in confirmation.  
\- Walk-away choice.  
\- $1,000 and $32,000 checkpoints.  
\- Phone a Friend and Hint lifelines.  
\- Local profiles and guest play.  
\- Autosave, manual save and exit, pause, and exact resume.  
\- Persistent history and statistics.  
\- Fresh Mix, curated question sets, and the Surprise Me option.  
\- Post-game question review.

Not currently required:

\- Multiplayer.  
\- Online accounts.  
\- Backend services.  
\- Real-money prizes.  
\- Anti-cheat systems.  
\- Simulated audience percentages.  
\- Simulated phone contacts.  
\- A normal per-question timer.

\#\# 19\. Remaining Product Decisions

The major gameplay, content, design, architecture, persistence, and testing decisions are defined in the project specifications. Remaining non-blocking product decisions include:

\- Final original product name and logo treatment.  
\- Remaining profile conveniences such as rename behavior and optional guest-to-profile conversion.  
\- Exact achievements, badges, and optional set-completion rewards.  
\- Long-term editorial review and future content-expansion priorities beyond Question Content Release 001\.

Codex may make polished, internally consistent choices for these areas and document meaningful judgment calls in IMPLEMENTATION\_NOTES.md.

