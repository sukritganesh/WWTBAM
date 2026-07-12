\# Design Specification: Desktop Screen Flow and Navigation

Status: Working desktop interaction, screen-flow, visual, motion, and audio specification. This document defines the app's screens, navigation, state behavior, 16:9 presentation system, futuristic visual identity, SVG direction, typography, narration, music, and sound-effect requirements. Exact asset choices and a small number of implementation values remain open.

\#\# 1\. Current Design Scope

The initial release is a fullscreen-oriented desktop browser application designed around a standard widescreen display. Mobile and tablet layouts are not required in the initial scope.

The experience should feel like a polished televised quiz game rather than a conventional form-based trivia website. The interface should prioritize dramatic focus, legibility at a distance, deliberate transitions, and clear game-state communication.

The application must use original branding and assets. It may evoke the structure and tension of a millionaire-style television quiz without copying protected logos, music, or other show-specific audiovisual material.

\#\# 2\. Top-Level Navigation Model

The primary player journey is:

1\. App launch and title screen.  
2\. Select an existing profile, create a profile, or continue as guest.  
3\. Enter the selected profile’s home dashboard.  
4\. Continue the single saved game, when the save belongs to that profile, or configure a new game.  
5\. Review the new-game summary and confirm that the run should begin.  
6\. View the game-opening transition.  
7\. Play Questions 1 through 15\.  
8\. End by answering incorrectly, walking away, or winning $1,000,000.  
9\. View the run-results screen and optional question review.  
10\. Return to the profile dashboard or begin another game.

Global destinations available outside a locked answer reveal are:

\- Home or profile dashboard.  
\- Help.  
\- Settings.  
\- Profile statistics.  
\- Profile selection.

The app should use its own predictable navigation rather than rely on the browser Back button. Browser refresh must preserve any active saved run.

\#\# 3\. App Launch and Title Screen

The title screen is the first interactive page displayed after local data has loaded.

\#\#\# 3.1 Required content

The title screen should include:

\- Original game logo or title treatment.  
\- A clear invitation to select a player.  
\- Existing profile cards.  
\- Create Profile control.  
\- Continue as Guest control.  
\- Help icon.  
\- Global Settings icon.  
\- A subtle indication when a saved game exists and who owns it.

The game may show a brief non-interactive boot or logo animation before the title screen, but it must be skippable and must not delay local-data recovery.

\#\#\# 3.2 Profile cards

Each existing profile card should display at minimum:

\- Display name.  
\- Personal-best prize.  
\- Number of games played or millionaire wins.  
\- Last-played date, when useful.  
\- Saved-game badge when that profile owns the global save.

Selecting a profile opens that profile’s home dashboard. The player should not need a password.

\#\#\# 3.3 Profile limit

The app supports a maximum of 20 named profiles.

\- When fewer than 20 profiles exist, Create Profile is enabled.  
\- At 20 profiles, Create Profile is disabled and accompanied by a clear explanation.  
\- Guest mode remains available regardless of the profile count.

\#\#\# 3.4 Creating a profile

Create Profile opens a compact modal or dedicated panel containing:

\- Display-name field.  
\- Character limit and validation feedback.  
\- Create button.  
\- Cancel button.

Names may be duplicated, because profiles use internal IDs. Duplicate names should be visually disambiguated in profile management when needed, for example by creation date or a small generated profile marker.

After creation, the new profile becomes the selected profile and opens its dashboard.

\#\#\# 3.5 Deleting a profile

Profile management must allow deletion.

Deletion requires a confirmation dialog that clearly states:

\- Career statistics and history for that profile will be deleted.  
\- The action cannot be undone unless a future export system is added.  
\- If the profile owns the global saved game, that saved game will also be deleted.

The destructive confirmation should require a deliberate action and should not use the same visual emphasis as Cancel.

Guest mode cannot be deleted because it is not a permanent named profile.

\#\# 4\. Global Saved-Game Rule

There is exactly one saved-game slot across the entire application, not one slot per profile.

The saved game stores its owner profile ID or identifies itself as a guest save.

\#\#\# 4.1 Save ownership

\- Only the owning profile may resume its save.  
\- When another profile is selected, the app may show that a save exists, but Continue is unavailable and the owner is identified by display name.  
\- A guest save may only be resumed from Guest mode.  
\- Switching profiles does not delete the save by itself.

\#\#\# 4.2 Starting any new game

Beginning a new run under any profile or as guest permanently replaces the existing global save.

Before replacement, the app must display a warning containing:

\- Name of the profile that owns the current save.  
\- Current question number and current winnings.  
\- The fact that the saved run will be permanently abandoned.  
\- Cancel and Replace Saved Game actions.

The save is not destroyed merely by opening the New Game screen. It is replaced only after the player confirms the new run and commits to beginning it.

\#\#\# 4.3 Save visibility

The title screen and profile dashboards should make the save state understandable without exposing the saved question or answer data. Example summary:

“Saved run: Alex — Question 8 — $4,000 banked.”

A player who does not own the save may still start a new game after accepting the replacement warning.

\#\# 5\. Profile Home Dashboard

After choosing a named profile, the player reaches a profile-specific home dashboard. Guest mode uses a simplified equivalent.

\#\#\# 5.1 Primary actions

The dashboard includes:

\- Start New Game.  
\- Continue Saved Game, only when this profile owns the global save.  
\- Statistics.  
\- Game History.  
\- Question-Set Progress.  
\- Settings.  
\- Help.  
\- Switch Profile.

The most important available action should be visually dominant.

If the selected profile owns an active save, Continue Saved Game should be the primary action and should show:

\- Game mode or set title.  
\- Current question.  
\- Current winnings.  
\- Last-saved time.  
\- Lifelines remaining, if space permits.

\#\#\# 5.2 Non-owner save message

When a save belongs to a different profile, the dashboard should show a quiet but clear notice such as:

“Jordan has a saved run on Question 6\. Starting a new game will replace it.”

It must not provide a Resume button to the wrong profile.

\#\#\# 5.3 Guest dashboard

Guest mode permits:

\- New game.  
\- Resume guest save, if the global save is a guest save.  
\- Help and settings.  
\- Session-level results when available.

Permanent career statistics and long-term history should be unavailable or clearly described as non-persistent for guest play.

\#\# 6\. New Game Configuration Screen

The New Game screen is a dedicated setup page rather than a small modal. It collects all options that affect the new run before any questions are reserved.

\#\#\# 6.1 Game-content section

The player selects one of the supported question modes:

\- Fresh Mix.  
\- Choose a Curated Set.  
\- Surprise Me.

Fresh Mix should show the estimated number of unseen questions available to the selected profile.

Choose a Curated Set opens the set browser or embeds it into the setup flow. The player can inspect set title, theme, description, difficulty, previous attempts, best result, and completion state before selecting it.

Question-content options that may be added later should have a reserved configuration area. Examples include category filters, content warnings, regional question preferences, and replay policy. The initial catalog and selection behavior are defined by QUESTION\_BANK\_SPEC.md and Question Content Release 001; future options should remain data-driven.

\#\#\# 6.2 Voice and audio section

The setup screen should expose run-relevant audio choices, including at minimum:

\- Master mute.  
\- Music enabled or disabled.  
\- Sound effects enabled or disabled.  
\- Narration or text-to-speech enabled or disabled.  
\- Whether answer choices are also read aloud.  
\- Whether revealed hints are read aloud.  
\- Narration voice and speed when supported by the browser.

Detailed channel behavior, text-to-speech fallback, mixing, music direction, sound effects, and licensed asset sourcing are defined in Sections 32–36 and the separate AUDIO\_CURATION.md source manifest.

\#\#\# 6.3 Presentation section

The setup screen may include:

\- Fullscreen preference.  
\- Animation intensity.  
\- Reduced-motion mode.  
\- Automatically advance after correct answers or require confirmation.  
\- Other visual-accessibility preferences finalized later.

These options affect presentation only and must not alter question difficulty or payouts unless explicitly labeled.

\#\#\# 6.4 Setup summary

A persistent summary panel should show:

\- Active profile or Guest.  
\- Selected question mode.  
\- Selected set, if applicable.  
\- New-question freshness estimate.  
\- Audio and narration status.  
\- Existing-save replacement warning, if applicable.

Primary actions:

\- Review and Continue.  
\- Back to Dashboard.

No questions are marked seen on this screen.

\#\# 7\. Pre-Game Review and Confirmation

After configuration, the player reaches a final review screen.

It displays:

\- Player name or Guest.  
\- Selected game mode and set.  
\- Fifteen-question prize ladder summary.  
\- Available lifelines: Phone a Friend and Hint.  
\- Guaranteed checkpoints at $1,000 and $32,000.  
\- Reminder that walking away keeps current winnings.  
\- Reminder that a wrong answer falls to the latest checkpoint.  
\- Audio or narration state.  
\- Existing saved game that will be replaced, if any.

Actions:

\- Begin Game.  
\- Back to Edit Options.

Begin Game requires a final confirmation when it will replace an existing save. Once confirmed:

1\. The prior global save is removed.  
2\. The new 15-question run is generated and saved.  
3\. Question order and answer order are fixed for that run.  
4\. The opening transition begins.

\#\# 8\. Game-Opening Transition

The first in-game screen is a short transition that creates separation between setup and live play.

It may display:

\- Player name.  
\- Selected mode or set title.  
\- “15 questions. Two lifelines. One million dollars.” or equivalent original copy.  
\- The prize ladder animating into view.  
\- A final “Begin Question 1” control.

The transition should be skippable. No question is marked seen until Question 1 is actually displayed.

\#\# 9\. Main Gameplay Screen

The gameplay screen should use a stable television-quiz composition designed for widescreen desktop viewing.

\#\#\# 9.1 Recommended spatial structure

The screen should contain four functional regions:

1\. Top utility bar.  
2\. Central stage and question area.  
3\. Answer grid and game actions.  
4\. Persistent prize ladder.

The main content should not shift unpredictably between questions. Longer question text should resize or wrap within controlled bounds rather than move the ladder or primary controls.

\#\#\# 9.2 Top utility bar

The utility bar should show:

\- Active profile name or Guest.  
\- Game mode or selected set.  
\- Current round, for example “Question 7 of 15.”  
\- Current winnings.  
\- Audio or mute control.  
\- Help icon.  
\- Pause/menu icon.

The utility bar must remain visually secondary to the active question.

\#\#\# 9.3 Prize ladder

The full 15-level ladder should remain visible during ordinary play, preferably in a dedicated right-side column.

It should show the values from $100 through $1,000,000 and visually distinguish:

\- Current question and its potential prize.  
\- Correctly completed questions.  
\- Current banked winnings.  
\- Guaranteed checkpoints at Questions 5 and 10\.  
\- Future unanswered questions.

The current row should be the strongest highlight. Completed rows should remain legible without competing with the current row. Checkpoints should have a persistent special marker.

The ladder must communicate both:

\- Current winnings, meaning the value of the last correctly answered question.  
\- Guaranteed winnings, meaning the checkpoint payout if the current answer is wrong.

These values may also appear as labeled amounts near the ladder to prevent ambiguity.

\#\#\# 9.4 Question panel

The question panel displays:

\- Current prize value.  
\- Question text.  
\- Optional category label, if later desired.  
\- Narration status or a subtle skip-narration control while speech is active.

Question text must always be visible even when narration is enabled.

\#\#\# 9.5 Answer area

Four answer choices are displayed in a polished two-by-two desktop grid, labeled A, B, C, and D.

Each answer has distinct states:

\- Available.  
\- Hovered or keyboard-focused.  
\- Selected but not locked.  
\- Locked.  
\- Correct.  
\- Incorrect.  
\- Disabled or eliminated only if a future feature requires it.

Selecting an answer does not submit it. A separate Lock In Answer button becomes available after a selection is made.

\#\#\# 9.6 Lifeline controls

Phone a Friend and Hint should be visible near the question controls.

Each lifeline clearly communicates:

\- Available.  
\- Active.  
\- Used and unavailable.

Both may be used on the same question. They disappear or become disabled after the final answer is confirmed.

\#\#\# 9.7 Walk-away control

Walk Away must remain accessible before final lock-in but should not compete visually with answering.

Activating it opens a confirmation dialog stating the exact amount the player will keep. Example:

“Walk away now with $16,000?”

Confirming immediately ends the run as a voluntary walk-away.

\#\# 10\. Narration and Text-to-Speech Flow

When narration is enabled, each new question follows this sequence:

1\. Question screen appears and all text remains visible.  
2\. The question is read aloud.  
3\. Answer choices are read aloud in A-to-D order when that option is enabled.  
4\. The player may skip narration at any time.  
5\. Once narration ends or is skipped, the screen remains unchanged and awaits input.

The player should not be forced to wait through narration before reading the question. Answer selection may be allowed during narration, but locking the answer should stop any active narration so voices do not overlap with confirmation or suspense audio.

When audio or narration is muted:

\- The full question and answers appear normally.  
\- No artificial narration delay is introduced.  
\- The player can interact immediately.

Narration should stop when:

\- The player opens Pause or Help.  
\- The player locks an answer.  
\- The player leaves the question screen.  
\- A lifeline requiring its own spoken content begins.

\#\# 11\. Hint Interaction

Activating Hint consumes it immediately and reveals the handcrafted hint in a dedicated panel that does not obscure the question or answers.

The hint panel should include:

\- Clear “Hint” heading.  
\- Hint text.  
\- Narration indicator when it is being read aloud.  
\- Skip Hint Narration control when speech is active.

When hint narration is enabled, the hint is read once after appearing. Revealing the hint must not select, eliminate, or lock any answer.

The hint remains visible for the rest of that question and must be preserved in the save state.

\#\# 12\. Phone a Friend Interaction

Phone a Friend is a trust-based real-world timer experience.

\#\#\# 12.1 Activation confirmation

Before consuming it, the game should ask the player to confirm that they are ready to begin the 60-second call. This prevents accidental activation.

\#\#\# 12.2 Active call state

During the active call:

\- A large 60-second countdown is visible.  
\- The question and all four answers remain visible.  
\- The Phone a Friend control shows an active/used state.  
\- Lock In Answer is disabled.  
\- Hint is disabled during the active Phone a Friend countdown and becomes available afterward if it has not already been consumed.  
\- End Call Early is available.  
\- The player may still read and discuss the question externally.

\#\#\# 12.3 Pause during a call

The call itself cannot be paused.

If the player presses Pause or opens Help during the countdown:

1\. The phone timer ends immediately.  
2\. Phone a Friend remains consumed.  
3\. The current remaining time is discarded.  
4\. The requested Pause or Help overlay then opens.

A confirmation is not required for this behavior, but the pause control should provide a tooltip or small warning such as “Pausing ends the call.”

\#\#\# 12.4 Call completion

When the timer reaches zero or End Call Early is selected:

\- A short call-ended state appears.  
\- Normal answer interaction resumes.  
\- The lifeline remains consumed.  
\- The player may use Hint afterward if it remains available.

\#\# 13\. Answer Lock-In and Reveal Sequence

\#\#\# 13.1 Selection

The player selects A, B, C, or D. The selected choice gains a strong highlight. The player may change the selection freely.

\#\#\# 13.2 Lock request

Pressing Lock In Answer opens a final-answer confirmation overlay or transforms the action area into a confirmation state.

It must state the selected letter and answer text and offer:

\- Yes, Final Answer.  
\- Go Back.

\#\#\# 13.3 Locked state

After Yes, Final Answer:

\- Answer changes are disabled.  
\- Lifelines are disabled.  
\- Pause, Help, and Walk Away are disabled until the result is resolved.  
\- The selected answer enters a locked visual state.  
\- A brief suspense sequence plays.

The reveal delay should be dramatic but not frustrating and will be timed later.

\#\#\# 13.4 Correct answer

On a correct answer:

\- The selected answer becomes the correct state.  
\- Positive audiovisual feedback plays when enabled.  
\- The prize ladder updates.  
\- Current winnings and checkpoint status update.  
\- A concise explanation may appear.

The post-correct state offers:

\- Continue to Next Question.  
\- Walk Away with the newly earned amount.

For Question 15, Continue is replaced by the millionaire victory transition.

\#\#\# 13.5 Incorrect answer

On an incorrect answer:

\- The selected choice becomes the incorrect state.  
\- The correct choice is highlighted separately.  
\- The explanation appears.  
\- The guaranteed payout is shown clearly.  
\- After acknowledgement, the app proceeds to the end-of-run results screen.

The player cannot reload or navigate backward to change the resolved answer.

\#\# 14\. Between-Question Transition

After a correct answer and selection of Continue:

\- The current result state closes.  
\- The ladder emphasizes the next prize level.  
\- A brief transition introduces the next question.  
\- The next question is marked seen only when displayed.  
\- Narration begins according to settings.

The transition should become more dramatic at checkpoints and for Questions 11 through 15 without changing the rules.

\#\# 15\. Pause Menu

Pause suspends ordinary game interaction and narration. Paused time should not count toward active play duration if active and paused durations are tracked separately.

The pause overlay includes:

\- Resume Game.  
\- Save and Exit to Dashboard.  
\- In-Game Settings.  
\- Help.  
\- Walk Away or End Run, with a separate confirmation.

Pause is unavailable during the locked-answer suspense and reveal sequence.

During Phone a Friend, pressing Pause ends the call first, as defined above.

\#\#\# 15.1 Save and exit

Save and Exit performs an immediate autosave, returns to the owning profile dashboard, and preserves the exact run state.

Because there is only one global save slot, this active run becomes or remains that slot.

\#\# 16\. Help System

Help is accessible from:

\- Title screen.  
\- Profile dashboard.  
\- New Game screen.  
\- Gameplay screen.  
\- Pause menu.

Outside gameplay, Help opens as a normal modal or page.

During gameplay, Help pauses the game. During Phone a Friend, opening Help ends the call and consumes the lifeline before opening Help.

Recommended Help sections:

\- How to Play.  
\- Prize Ladder and Checkpoints.  
\- Locking an Answer.  
\- Walking Away.  
\- Phone a Friend.  
\- Hint.  
\- Saving and Profiles.  
\- Keyboard and mouse controls.  
\- Audio and narration behavior.

Closing Help returns the player to the exact previous screen or paused state.

\#\# 17\. Settings Surfaces

There are two settings scopes.

\#\#\# 17.1 Global settings

Available from title and profile screens. These may include:

\- Master audio.  
\- Music volume.  
\- Sound-effects volume.  
\- Narration volume.  
\- Narration voice and speed.  
\- Default narration choices.  
\- Fullscreen preference.  
\- Animation intensity.  
\- Reduced motion.  
\- Other accessibility preferences finalized later.

\#\#\# 17.2 In-game settings

Available through Pause. These should be limited to safe presentation changes:

\- Audio volumes and mute.  
\- Narration on/off for future speech.  
\- Voice and speed.  
\- Animation intensity or reduced motion.  
\- Fullscreen toggle when technically safe.

In-game settings cannot change:

\- Profile.  
\- Game mode.  
\- Question set.  
\- Reserved questions.  
\- Answer order.  
\- Difficulty.  
\- Prize ladder.  
\- Lifeline usage.  
\- Current answer or result.

\#\# 18\. End-of-Run Screens

There are three themed variants of a shared results structure.

\#\#\# 18.1 Incorrect-answer result

Shows:

\- Respectful game-over message.  
\- Question reached.  
\- Last correct prize.  
\- Guaranteed payout awarded.  
\- Correct and incorrect answer details for the final question.  
\- Lifelines used.  
\- Run duration.

\#\#\# 18.2 Walk-away result

Shows:

\- Confirmation that the player walked away.  
\- Amount kept.  
\- Question reached.  
\- Next unanswered prize.  
\- Lifelines used.  
\- Run duration.

\#\#\# 18.3 Millionaire victory

Question 15 receives a dedicated celebration transition before the results summary.

The victory screen should show:

\- Strong congratulations message using the player name when available.  
\- $1,000,000 prize.  
\- All 15 ladder levels completed.  
\- Lifelines used or unused.  
\- Total run duration.  
\- Special first-attempt or no-lifeline recognition when applicable.

The celebration must remain usable with reduced motion and muted audio.

\#\#\# 18.4 Shared result actions

Every results screen should offer:

\- Review This Run.  
\- View Updated Statistics, for named profiles.  
\- Return to Dashboard.  
\- Play Again.  
\- Switch Profile.

The active global save is cleared when a run reaches a completed end state.

\#\# 19\. Run Review Screen

The run-review screen lists only questions that were actually displayed.

For each question it can show:

\- Ladder number and prize.  
\- Question text.  
\- Four choices.  
\- Player answer, if submitted.  
\- Correct answer.  
\- Hint.  
\- Explanation.  
\- Correct, incorrect, or unanswered status.

Questions should be collapsed by default in a long list, with the final or failed question expanded initially.

The review is read-only and cannot restart the run from an earlier question.

\#\# 20\. Statistics and History Screens

\#\#\# 20.1 Statistics dashboard

A named profile’s statistics screen should present:

\- Personal best.  
\- Millionaire wins.  
\- Games played.  
\- Total virtual winnings.  
\- Accuracy.  
\- Average question reached.  
\- Lifeline usage.  
\- Unique questions seen.  
\- Question-bank completion.  
\- Category and ladder-level performance when available.

\#\#\# 20.2 Game history

The history screen lists completed runs with:

\- Date.  
\- Mode or set.  
\- Outcome.  
\- Question reached.  
\- Amount won.  
\- Lifelines used.

Selecting an entry opens its run summary and review when retained.

\#\#\# 20.3 Question-set progress

The set-progress view may show:

\- New, attempted, or completed status.  
\- Best result.  
\- Number of attempts.  
\- Millionaire completion.  
\- First-attempt completion.  
\- No-lifeline completion.

\#\# 21\. Keyboard, Focus, and Input Behavior

Although detailed accessibility requirements will be finalized later, the desktop interface should be designed for both mouse and keyboard.

Recommended controls:

\- A, B, C, and D select answers when focus is not inside a text field.  
\- Enter activates the focused primary action.  
\- Escape backs out of non-destructive modals or opens Pause during ordinary gameplay.  
\- A dedicated shortcut may open Help.

Keyboard shortcuts must never bypass final-answer or destructive-save confirmations.

Visible keyboard focus is required. Audio narration must not remove or replace visible text.

\#\# 22\. Desktop and Fullscreen Assumptions

The initial layout targets a standard widescreen desktop and should be comfortable in fullscreen.

The visual reference canvas is 1920 × 1080, with 1280 × 720 as the minimum fully supported stage. Fullscreen and windowed modes preserve a centered 16:9 stage through uniform scaling and letterboxing or pillarboxing rather than stretching.

For now:

\- Design around a 16:9 composition.  
\- Keep all essential controls visible without vertical scrolling during gameplay.  
\- Permit non-game screens such as statistics and history to scroll.  
\- Do not require a mobile navigation pattern.  
\- Preserve usable spacing at smaller desktop-window sizes through proportional scaling or bounded reflow.

\#\# 23\. Critical Navigation and State Rules

\- No profile other than the save owner can resume the global save.  
\- Starting any confirmed new game replaces the global save, regardless of owner.  
\- Opening setup does not replace the save.  
\- Deleting the save-owning profile also deletes the save after explicit warning.  
\- No question becomes seen before it is displayed.  
\- Refresh restores the exact active state.  
\- A locked answer cannot be changed, paused, or escaped before reveal.  
\- Help pauses ordinary play.  
\- Pause or Help during Phone a Friend immediately ends and consumes the call.  
\- Walk Away is available before final lock-in and after a correct answer before the next question begins.  
\- Completed runs clear the global save and update profile history once.  
\- Repeated refreshes or result-screen revisits must not duplicate statistics.

\#\# 24\. Open Design Decisions

The following remain for later specification:

\- Final title and branding.  
\- Final edge-case behavior below 1280 × 720 and on unusual display aspect ratios.  
\- Exact visual layout proportions.  
\- Exact color tokens, final icon drawings, and original logo artwork.  
\- Exact animation durations and easing curves after implementation testing.  
\- Final continuous music sources, selected sound clips, and default channel volumes.  
\- Browser-specific voice ordering and compatibility testing.  
\- Exact question-set browser layout.  
\- Which optional new-game question filters ship in version one.  
\- Final list of statistics and charts.  
\- Profile rename and export/import controls.  
\- Exact keyboard shortcuts.  
\- Accessibility audit requirements.  
\- Whether an optional automatic fullscreen request is appropriate.

\#\# 25\. Visual Identity and Art Direction

The interface should feel like a premium futuristic broadcast environment or precision game-show control room. It should be stylish, sleek, cinematic, and technologically sophisticated without becoming loud, gaudy, casino-like, or visually exhausting.

The design language combines:

\- Deep black and near-black backgrounds.  
\- Dark navy structural surfaces.  
\- Brushed silver and restrained chrome detailing.  
\- Electric blue as the principal interactive accent.  
\- Pale cyan or icy blue for secondary illumination.  
\- Cool white for primary text.  
\- Muted silver-gray for secondary text.  
\- Refined teal-green for correct states.  
\- Deep crimson or red-orange for incorrect states.  
\- Soft gold used sparingly for checkpoints, major winnings, and millionaire victory.

Black should remain the dominant visual field. Blue should feel luminous rather than neon. Silver should feel structural. Chrome should appear mostly on edges, trim, and special framing rather than covering whole surfaces. Gold should be rare enough that it feels important whenever it appears.

\#\#\# 25.1 Visual mood

The product should feel:

\- Futuristic.  
\- Expensive.  
\- Focused.  
\- Calm between dramatic moments.  
\- Cinematic during answer reveals and major milestones.  
\- Detailed enough to reward fullscreen viewing.  
\- Readable enough that the question remains the central focus.

The product should not feel:

\- Cyberpunk.  
\- Like a slot machine or casino interface.  
\- Like a neon arcade cabinet.  
\- Like a combat HUD.  
\- Like a direct copy of the licensed television program.  
\- Overloaded with glass panels, flashing lights, lens flares, or decorative particles.

\#\#\# 25.2 Color roles

The implementation should define semantic color tokens rather than hard-code arbitrary colors throughout components. Required roles include:

\- Stage background.  
\- Raised background or secondary panel.  
\- Dark glass surface.  
\- Metallic border.  
\- Primary electric-blue accent.  
\- Secondary icy-blue accent.  
\- Primary and secondary text.  
\- Disabled and unavailable states.  
\- Hover and keyboard-focus states.  
\- Selected answer.  
\- Locked answer.  
\- Correct answer.  
\- Incorrect answer.  
\- Checkpoint gold.  
\- Millionaire gold and white.

Exact hexadecimal values may be refined during implementation, but every screen must draw from the same restrained token system.

\#\# 26\. Surface and Material System

Three principal surface types should create hierarchy without clutter.

\#\#\# 26.1 Dark glass

Use for large panels, menus, statistics, settings, help, and overlays.

Characteristics:

\- Nearly opaque dark blue-black fill.  
\- Very subtle translucency or backdrop blur where supported.  
\- Fine silver or blue edge.  
\- Restrained inner highlight.  
\- Soft shadow used only to establish depth.  
\- No excessive frosting or transparency that reduces readability.

\#\#\# 26.2 Brushed metal

Use sparingly for framing, separators, major controls, and premium details.

Characteristics:

\- Silver-gray gradient.  
\- Fine directional texture.  
\- Low reflectivity.  
\- Restrained chrome highlight along edges.  
\- No large mirror-like surfaces.

\#\#\# 26.3 Illuminated interactive panels

Use for answer choices, lifelines, primary menu tiles, and major actions.

Characteristics:

\- Dark idle interior.  
\- Thin metallic outer line.  
\- Controlled blue edge illumination on hover or focus.  
\- Stronger contained blue glow when selected.  
\- Blue-white locked state.  
\- Teal-green or crimson result states.  
\- Fast, precise visual response rather than bouncy or playful motion.

\#\# 27\. Background Architecture and SVG System

SVG artwork is encouraged throughout the experience, especially for the background, decorative framing, icons, and state transitions. SVG should add richness while remaining lightweight, crisp, scalable, and thematically consistent.

\#\#\# 27.1 Background layers

The 16:9 stage should use a custom layered SVG environment rather than a flat fill or large raster image. Appropriate elements include:

\- Large concentric precision rings behind the central question area.  
\- Slow orbital arcs.  
\- Fine circuit paths and connection nodes.  
\- Subtle geometric grids or hexagonal structures.  
\- Angular metallic framing near the stage perimeter.  
\- Faint star-like points or particles kept away from text.  
\- Blue radial gradients.  
\- Thin silver lines that react subtly during transitions.

Most decorative background artwork should remain at low visual intensity, generally around 5–15 percent perceived prominence. It may brighten temporarily during answer lock-in, checkpoints, major transitions, and millionaire victory.

A recommended recurring motif is a set of concentric precision rings intersected by four directional lines, subtly echoing the four answer choices. This motif may appear behind the logo, around question numbers, during lifeline activation, in answer lock-in, and in the victory sequence.

\#\#\# 27.2 SVG implementation requirements

\- Author decorative SVGs against a consistent \`viewBox\`, preferably \`0 0 1920 1080\` for full-stage artwork.  
\- Prefer inline React SVG components for stateful or animated graphics.  
\- Use reusable SVG symbols for icons where appropriate.  
\- Use CSS custom properties and \`currentColor\` so SVG elements inherit theme state.  
\- Use gradients, masks, patterns, and clipping paths with restraint.  
\- Avoid excessive blur, glow, or complex filters that damage performance.  
\- Mark purely decorative SVGs as hidden from assistive technology.  
\- Give interactive SVG icons accessible labels through their buttons or controls.  
\- Keep stroke weights and corner language consistent across the complete icon family.  
\- Do not mix unrelated third-party icon styles.

\#\#\# 27.3 SVG motion

Suitable subtle SVG animation includes:

\- Rings rotating by only a few degrees.  
\- Lines drawing into view.  
\- A controlled metallic light sweep.  
\- Nodes illuminating in sequence.  
\- A circular lock-in pulse.  
\- A checkpoint ring expanding outward.  
\- A restrained gold-white burst for the millionaire result.  
\- A countdown arc for Phone a Friend.

Ambient animation should be almost subliminal and should stop or simplify under Reduced Motion.

\#\# 28\. Typography and Font System

Use no more than two font families. Fonts must be high quality, legally redistributable or loaded through a suitable web-font source, and accompanied by sensible local fallbacks.

\#\#\# 28.1 Primary interface font

Recommended primary choice: Sora or Space Grotesk.

Use the primary font for:

\- Questions.  
\- Answers.  
\- Menus.  
\- Help content.  
\- Settings.  
\- Statistics descriptions.  
\- Dialog text.

The primary font must prioritize long-form readability and should not look overtly science-fictional.

\#\#\# 28.2 Display and numerical font

Recommended secondary choice: Rajdhani.

Use the display font selectively for:

\- Prize values.  
\- Question numbers.  
\- Money-ladder amounts.  
\- Compact technical labels.  
\- Status captions.  
\- Answer-letter badges.  
\- Major results values.

Oxanium, Chakra Petch, or another restrained geometric display face may be considered if Rajdhani proves unsuitable. Orbitron should not be used for general text and, if used at all, should be confined to a logo or very small number of display moments.

\#\#\# 28.3 Typography rules

\- Questions use large primary-font text with generous line height.  
\- Answers remain comfortably readable across a desktop screen.  
\- Long questions wrap within controlled bounds instead of shrinking to illegible sizes.  
\- Prize values use tabular numerals for clean ladder alignment.  
\- All-caps is limited to short labels, round identifiers, and technical captions.  
\- Questions, answers, explanatory copy, and help content use normal capitalization.  
\- Decorative fonts may never be used for active question or answer text.  
\- Font weights and letter spacing should create hierarchy without turning every label into a headline.

\#\# 29\. Fixed 16:9 Stage and Scaling

The application should render inside a conceptual 16:9 stage at all times. The layout should never stretch independently along one axis.

\#\#\# 29.1 Reference dimensions

\- Primary design canvas: 1920 × 1080\.  
\- Minimum fully supported stage size: 1280 × 720\.  
\- Common compatible sizes include 1600 × 900 and 1366 × 768\.

\#\#\# 29.2 Fullscreen behavior

\- On a 16:9 monitor, the stage fills the screen.  
\- On a wider display, dark side pillars surround the stage.  
\- On a taller display, dark top and bottom bars surround the stage.  
\- Decorative outer bars should blend with the near-black environment.  
\- The stage must not be distorted to fill an incompatible aspect ratio.

\#\#\# 29.3 Windowed behavior

\- The app calculates the largest centered 16:9 rectangle that fits in the browser viewport.  
\- The complete stage scales uniformly.  
\- Relative positions and proportions remain stable.  
\- The surrounding browser area uses a neutral near-black treatment.  
\- Gameplay must not introduce scrollbars inside the stage.  
\- If the available window falls below the minimum supported dimensions, show a polished notice asking the player to enlarge the window rather than allowing controls to overlap or become unreadable.

\#\#\# 29.4 Fullscreen controls

\- Provide Enter Fullscreen and Exit Fullscreen controls.  
\- Remember the preference where practical.  
\- Support standard browser Escape behavior.  
\- A keyboard shortcut such as \`F\` may toggle fullscreen when it does not conflict with text input or browser restrictions.  
\- Fullscreen failure should produce a quiet, useful message rather than an error dump.  
\- The game must remain fully functional in windowed mode.

\#\# 30\. Component Styling and Visual States

\#\#\# 30.1 Answer panels

The four answers remain in a two-row arrangement but should use original elongated polygonal or beveled panels rather than copying protected show artwork.

Each answer panel may include:

\- Dark interior.  
\- Thin metallic outline.  
\- Small illuminated letter badge.  
\- Slight geometric taper or angled corner.  
\- Fine blue linework connecting the answer region to the central stage motif.

Required states:

\- Idle: dark and controlled.  
\- Hover or focus: silver edge brightens and a subtle blue highlight appears.  
\- Selected: contained electric-blue interior illumination.  
\- Final confirmation: stronger blue-white pulse or border treatment.  
\- Locked: other controls visually recede while the answer holds a stable illuminated state.  
\- Correct: refined teal-green state.  
\- Incorrect selection: deep crimson state.  
\- Correct answer following failure: teal-green state displayed at the same time as the player's red selection.

Color alone must not communicate state. Border changes, icons, labels, and restrained motion should reinforce selection and result states.

\#\#\# 30.2 Menus

Menus should use large, confident choices and generous negative space rather than dense settings tables. Main actions such as New Game, Continue, Statistics, and Profile Options should appear as clear tiles or panels. Secondary actions such as Help, Settings, Switch Profile, and Fullscreen should occupy quieter utility areas.

Menus should feel precise and responsive:

\- Avoid excessive card grids.  
\- Avoid long walls of equal-weight buttons.  
\- Group related settings.  
\- Keep descriptions short unless a detail panel is opened.  
\- Use clear current-selection indicators.  
\- Reserve bright illumination for the active or primary choice.

\#\#\# 30.3 Prize ladder

\- Future levels use muted silver-blue text.  
\- Completed levels remain legible but secondary.  
\- The current level receives the strongest electric-blue highlight.  
\- Checkpoints use restrained gold markers.  
\- The $1,000,000 row uses a unique but tasteful gold-white treatment.  
\- Money values align using tabular numerals.  
\- Current and guaranteed winnings remain visually distinct.

\#\# 31\. Motion and Transition System

Motion has three intentional speed classes.

\#\#\# 31.1 Interface motion

Fast and responsive:

\- Hover response.  
\- Button press.  
\- Toggle movement.  
\- Small modal opening.  
\- Answer selection.

These interactions should feel nearly immediate.

\#\#\# 31.2 Navigation motion

Moderate and smooth:

\- Opening New Game.  
\- Entering Statistics.  
\- Switching profile views.  
\- Returning to the dashboard.  
\- Opening a full-screen settings or help panel.

Recommended techniques include controlled slide, shallow depth change, blue scanning line, restrained scale, and short metallic sweep. Navigation should not make the player wait unnecessarily.

\#\#\# 31.3 Dramatic game motion

Slower and theatrical only for meaningful states:

\- Beginning a run.  
\- Locking an answer.  
\- Revealing correctness.  
\- Reaching a checkpoint.  
\- Losing.  
\- Walking away.  
\- Winning $1,000,000.

Suspense intensity may increase with the ladder. Early questions should resolve more quickly than Questions 11–15.

\#\#\# 31.4 Motion constraints

\- No constant flashing.  
\- No decorative object should spin rapidly.  
\- No particles should cross question or answer text.  
\- No transition should prevent reading necessary information.  
\- Avoid animation without a state, hierarchy, or atmosphere purpose.  
\- Reduced Motion shortens or removes sweeping movement while preserving understandable state changes.

\#\# 32\. Audio Architecture

Audio is divided into three independent channels:

1\. Music.  
2\. Sound effects.  
3\. Voice narration or text-to-speech.

Each channel has its own enable toggle and volume control. A Master Audio toggle may silence all channels while preserving their individual settings for later restoration.

Global audio preferences should persist across profiles because they describe the current device and environment rather than competitive progress.

\#\#\# 32.1 Music controls

\- On or off.  
\- Independent volume.  
\- Music ducking beneath narration.  
\- Potential future low-intensity option.

\#\#\# 32.2 Sound-effect controls

\- On or off.  
\- Independent volume.  
\- Rate limiting so rapid hover or click events cannot stack into excessive volume.

\#\#\# 32.3 Voice controls

\- On or off.  
\- Independent volume where technically supported.  
\- Detected voice selector.  
\- Reading-speed control.  
\- Read Question Only or Read Question and Answers.  
\- Read Hints toggle.  
\- Replay narration control.

Muting voice has no effect on gameplay. Every spoken item remains available as visible text.

\#\# 33\. Text-to-Speech Behavior

Browser speech synthesis is the default implementation because it avoids a backend, API key, usage fees, and an enormous library of prerecorded question audio.

\#\#\# 33.1 Voice discovery and fallback

\- Detect available English voices after browser voice data becomes available.  
\- Prefer a high-quality local English voice when possible.  
\- Permit the player to select from compatible detected voices.  
\- Fall back gracefully to the browser or operating system default.  
\- Never block gameplay while waiting for voices to load.  
\- Display a clear but unobtrusive notice if no compatible voice is available.  
\- Store the preferred voice by stable identifying fields where available, with a fallback strategy when that exact voice is absent on a later device.

\#\#\# 33.2 Default narration sequence

1\. Animate the question panel into view.  
2\. Display all question text immediately.  
3\. Read the question.  
4\. When answer narration is enabled, read A, B, C, and D in order with brief pauses.  
5\. Permit selection while speech is active.  
6\. Offer Stop Reading or Skip Voice.  
7\. Offer Replay Question after narration completes.

Hint narration reads the hint once after its visual reveal when enabled.

\#\#\# 33.3 Speech interruption rules

Cancel active speech when:

\- The player locks an answer.  
\- Pause opens.  
\- Help opens.  
\- The player walks away.  
\- The question changes.  
\- A new narration request begins.  
\- A lifeline needs its own spoken content.  
\- The run ends.

Multiple utterances must never overlap. Speech queues should be explicitly cancelled before enqueuing a replacement.

\#\#\# 33.4 Music ducking

When narration begins, reduce the music channel smoothly. Restore it after speech ends or is cancelled. Ducking should not affect sound effects unless a specific dramatic cue would interfere with intelligibility.

\#\# 34\. Music Direction

Music should be original or clearly rights-cleared and should create tension without imitating the real program's signature score.

Recommended inventory:

\- Menu ambient loop.  
\- Questions 1–5 loop.  
\- Questions 6–10 loop.  
\- Questions 11–14 loop.  
\- Unique Question 15 loop.  
\- Checkpoint stinger.  
\- Walk-away stinger.  
\- Defeat stinger.  
\- Millionaire victory theme.

\#\#\# 34.1 Questions 1–5

\- Light futuristic pulse.  
\- Spacious and relatively relaxed.  
\- Minimal low-end tension.

\#\#\# 34.2 Questions 6–10

\- Additional rhythmic layer.  
\- Subtle ticking or low pulse.  
\- Increased forward movement.

\#\#\# 34.3 Questions 11–14

\- Darker and sparser.  
\- Sustained low-frequency tension.  
\- Less rhythmic comfort.  
\- More room around narration.

\#\#\# 34.4 Question 15

\- Unique restrained high-stakes bed.  
\- Large sense of scale.  
\- Minimal distracting percussion.  
\- Strong support for silence and narration.

Music loops must be seamless, should not restart unnecessarily between adjacent questions in the same tier, and should transition or crossfade cleanly when entering a new tier.

\#\# 35\. Sound-Effect Direction

Sound effects should resemble one coherent futuristic broadcast system: clean, precise, cool, and expensive.

Appropriate sound qualities:

\- Short electronic pulses.  
\- Restrained metallic sweeps.  
\- Glassy digital chimes.  
\- Soft low-frequency impacts.  
\- Controlled confirmation tones.  
\- Subtle data-unlock effects.

Reject sounds that are:

\- Cartoonish.  
\- Retro-arcade.  
\- Casino-like.  
\- Militaristic or weapon-like.  
\- Abrasive or distorted.  
\- Excessively reverberant.  
\- Loud comedy buzzers.

Required event families include:

\- Menu hover, press, back, confirm, and cancel.  
\- Toggle on and off.  
\- Panel and modal open or close.  
\- Save completion.  
\- Profile create and delete.  
\- Game intro and question entry.  
\- Answer select, deselect, final confirmation, and lock.  
\- Correct cues with increasing intensity by tier.  
\- Incorrect result.  
\- Checkpoint reached.  
\- Next question.  
\- Walk away.  
\- Results open.  
\- Millionaire victory.  
\- Hint activation and reveal.  
\- Phone start, final countdown, and end.  
\- Warning, help, pause, resume, and fullscreen cues.

Ordinary UI effects should remain significantly quieter than result, checkpoint, and victory effects. Hover sound may be omitted entirely if it becomes repetitive.

\#\#\# 35.1 Layered effects

Major events may layer two or three compatible clips:

\- Answer lock: digital pulse plus soft metallic closure.  
\- Correct answer: clean positive tone plus restrained low impact.  
\- Wrong answer: brief tonal drop plus soft low impact.  
\- Checkpoint: correct cue plus short musical shimmer.  
\- Millionaire victory: unique musical cue, wide digital sweep, and restrained celebratory impact.  
\- Hint: small data-unlock shimmer without fanfare.

The audio engine should intentionally manage layered effects rather than simply trigger unrelated files at full volume.

\#\#\# 35.2 Phone a Friend audio

\- Short activation cue.  
\- Optional subtle call ambience.  
\- No audible tick every second for the complete minute.  
\- Begin quiet ticks or pulses during the final ten seconds.  
\- Stronger alerts at five seconds and zero.  
\- Distinct end-call tone.  
\- If Pause or Help ends the call, play the end-call cue before or during the overlay transition.

\#\# 36\. Audio Asset Curation and Licensing

The implementation must use only audio with a clearly verified license permitting redistribution in the finished game.

A separate source manifest has been created at:

AUDIO\_CURATION.md  
https://docs.google.com/document/d/1u3htnncBn0lQB1LTZNuU6DEMacP7b\_B98rve\_jmpns4/edit

That manifest contains direct source and ZIP links for official Kenney CC0 packs, a target logical sound inventory, processing requirements, layering guidance, and source-ledger requirements.

Codex should:

\- Download and audition the listed packs.  
\- Select a compact coherent subset rather than bundling every file.  
\- Trim leading and trailing silence.  
\- Add short fades to prevent clicks.  
\- Normalize perceived loudness.  
\- Convert selected production clips to appropriate compressed web formats with fallbacks where necessary.  
\- Copy only final selected assets into the production bundle.  
\- Maintain an asset registry mapping logical sound events to filenames.  
\- Preserve a source ledger with original pack, original filename, source page, license, processing, duration, and intended volume.

Do not use audio from the real television program, close recreations of its signature themes, YouTube rips, unverified download sites, or personal-use-only assets.

\#\# 37\. Accessibility and Restraint Rules

The visual and audio system must remain usable when effects are reduced or disabled.

Required considerations:

\- Reduced Motion.  
\- Reduced Glow if needed.  
\- High-contrast or increased-contrast support where practical.  
\- Persistent visible focus indicators.  
\- Keyboard navigation.  
\- Visible state labels or iconography in addition to color.  
\- Complete text equivalents for all narration.  
\- Clear status text for meaningful audio-only events.  
\- Muted and no-voice modes with no gameplay penalty.  
\- Millionaire victory and other major states must remain understandable without motion or sound.

Tasteful constraints:

\- No more than one major glow source per panel.  
\- No rainbow gradients.  
\- No thick neon outlines.  
\- No large mirror-chrome regions.  
\- No more than two font families.  
\- No decorative font for questions or answers.  
\- No constant particle field over readable content.  
\- No oversized icons competing with primary controls.  
\- No animation or audio whose only purpose is spectacle.

\#\# 38\. Remaining Audiovisual Decisions

The following details remain open for implementation testing or later curation:

\- Final original game name and logo artwork.  
\- Exact hexadecimal color tokens and chrome-gradient recipes.  
\- Final selection between Sora and Space Grotesk as the primary font.  
\- Final display font if Rajdhani does not meet all legibility needs.  
\- Exact transition durations and easing curves.  
\- Final continuous music sources or original loops.  
\- Exact selected clips from the curated CC0 packs.  
\- Final default channel volumes.  
\- Browser-specific TTS voice ranking and compatibility behavior.  
\- Whether Reduced Glow is separate from Reduced Motion.  
\- Exact behavior below the minimum 1280 × 720 supported stage.

