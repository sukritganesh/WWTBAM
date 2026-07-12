import { useEffect } from 'react';

import { BrandMark } from '../components/BrandMark';
import { Modal } from '../components/Modal';
import {
  canLockAnswer,
  canSelectAnswer,
  canUseHint,
  canUsePhone,
  canWalkAway,
  currentQuestion,
  phoneRemainingMs,
  PRIZE_LADDER,
  type GameAction,
  type GameRunState,
  type ResolvedChoice,
} from '../game';
import { formatMoney } from '../utils/format';
import '../styles/gameplay.css';

export type GameplayControllerStatus =
  | 'active'
  | 'read-only'
  | 'taking-control'
  | 'save-error';

export type NarrationStatus = 'disabled' | 'idle' | 'speaking' | 'unavailable';

export interface GameplayScreenProps {
  state: GameRunState;
  nowMs: number;
  playerName?: string;
  controllerStatus?: GameplayControllerStatus;
  controllerMessage?: string;
  narrationStatus?: NarrationStatus;
  muted?: boolean;
  onAction: (action: GameAction) => void;
  onReplayNarration?: () => void;
  onSkipNarration?: () => void;
  onToggleMute?: () => void;
  onSaveAndExit?: () => void;
  onOpenSettings?: () => void;
  onTakeControl?: () => void;
  /** Invoked after the reducer has already reached its completed phase. */
  onCompleted?: () => void;
}

type AnswerVisualState =
  | 'available'
  | 'selected'
  | 'locked'
  | 'correct'
  | 'incorrect'
  | 'disabled';

const ANSWER_STATE_LABELS: Record<AnswerVisualState, string> = {
  available: 'Available',
  selected: 'Selected',
  locked: 'Final answer locked',
  correct: 'Correct answer',
  incorrect: 'Your answer — incorrect',
  disabled: 'Unavailable',
};

function modeLabel(state: GameRunState): string {
  if (state.mode.kind === 'fresh-mix') return 'Fresh Mix';
  return state.mode.setTitle;
}

function displayPlayerName(state: GameRunState, playerName?: string): string {
  if (playerName) return playerName;
  if (state.owner.kind === 'guest') return 'Guest';
  return state.owner.displayName || 'Player';
}

function currentResult(state: GameRunState) {
  const questionId = currentQuestion(state).id;
  return state.results.find((result) => result.questionId === questionId) ?? null;
}

function visualStateForChoice(
  state: GameRunState,
  choice: ResolvedChoice,
): AnswerVisualState {
  const question = currentQuestion(state);
  const result = currentResult(state);

  if (result && state.revealedAtMs !== null) {
    if (choice.id === question.correctChoiceId) return 'correct';
    if (!result.isCorrect && choice.id === result.selectedChoiceId) return 'incorrect';
    return 'disabled';
  }

  if (state.lockedChoiceId === choice.id) return 'locked';
  if (state.selectedChoiceId === choice.id) return 'selected';
  return canSelectAnswer(state) ? 'available' : 'disabled';
}

function phaseAnnouncement(state: GameRunState): string {
  const question = currentQuestion(state);
  switch (state.phase) {
    case 'game-intro':
      return 'Run ready. Question 1 has not yet been displayed.';
    case 'question-ready':
      return `Question ${question.level} is ready.`;
    case 'answer-selected':
      return 'Answer selected. It has not been locked.';
    case 'final-confirmation':
      return 'Confirm your final answer.';
    case 'phone-confirmation':
      return 'Confirm Phone a Friend activation.';
    case 'phone-active':
      return 'Phone a Friend is active. Locking is unavailable.';
    case 'answer-locked':
      return 'Final answer locked. Awaiting result.';
    case 'correct-reveal':
      return 'Correct answer.';
    case 'incorrect-reveal':
      return 'Incorrect answer. The correct answer is displayed.';
    case 'millionaire-reveal':
      return 'Question 15 is correct. One million dollars won.';
    case 'between-questions':
      return `Ready to display Question ${question.level}.`;
    case 'completed':
      return 'Run complete.';
  }
}

export function GameplayScreen({
  state,
  nowMs,
  playerName,
  controllerStatus = 'active',
  controllerMessage,
  narrationStatus = 'disabled',
  muted = false,
  onAction,
  onReplayNarration,
  onSkipNarration,
  onToggleMute,
  onSaveAndExit,
  onOpenSettings,
  onTakeControl,
  onCompleted,
}: GameplayScreenProps) {
  const question = currentQuestion(state);
  const controlsRun = controllerStatus === 'active';
  const player = displayPlayerName(state, playerName);
  const utilityLocked =
    state.overlay !== null ||
    state.phase === 'answer-locked' ||
    state.phase === 'incorrect-reveal' ||
    state.phase === 'millionaire-reveal' ||
    state.phase === 'completed';

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        !controlsRun ||
        !canSelectAnswer(state) ||
        event.defaultPrevented ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey
      ) {
        return;
      }

      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          target.matches('input, textarea, select, [role="textbox"]'))
      ) {
        return;
      }

      const letter = event.key.toUpperCase();
      const choice = question.choices.find((item) => item.label === letter);
      if (!choice) return;

      event.preventDefault();
      onAction({ type: 'SELECT_ANSWER', choiceId: choice.id });
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [controlsRun, onAction, question.choices, state]);

  const send = (action: GameAction) => {
    if (controlsRun) onAction(action);
  };

  return (
    <main className="screen gameplay-screen" aria-label="One Million gameplay">
      <header className="utility-bar gameplay-utility">
        <BrandMark compact />
        <div className="utility-divider" />
        <div>
          <div className="utility-label">Contestant</div>
          <div className="utility-value">{player}</div>
        </div>
        <div className="gameplay-utility__round">
          <span>{modeLabel(state)}</span>
          <strong>Question {question.level} of 15</strong>
        </div>
        <div className="utility-bar__spacer" />
        <NarrationControl
          status={narrationStatus}
          onReplay={onReplayNarration}
          onSkip={onSkipNarration}
        />
        {onToggleMute && (
          <button
            type="button"
            className="icon-button"
            aria-label={muted ? 'Unmute audio' : 'Mute audio'}
            aria-pressed={muted}
            onClick={onToggleMute}
          >
            <span aria-hidden="true">{muted ? '×' : '♪'}</span>
          </button>
        )}
        <button
          type="button"
          className="icon-button"
          aria-label="Open gameplay help"
          title={state.phase === 'phone-active' ? 'Opening Help ends the call' : 'Help'}
          disabled={!controlsRun || utilityLocked}
          onClick={() => send({ type: 'OPEN_HELP' })}
        >
          ?
        </button>
        <button
          type="button"
          className="icon-button"
          aria-label="Pause game"
          title={state.phase === 'phone-active' ? 'Pausing ends the call' : 'Pause'}
          disabled={!controlsRun || utilityLocked}
          onClick={() => send({ type: 'OPEN_PAUSE' })}
        >
          <span aria-hidden="true">Ⅱ</span>
        </button>
      </header>

      {controllerStatus !== 'active' && (
        <ControllerNotice
          status={controllerStatus}
          message={controllerMessage}
          onTakeControl={onTakeControl}
        />
      )}

      <div className="gameplay-layout">
        <section className="gameplay-stage" aria-live="off">
          {state.phase === 'game-intro' ? (
            <GameIntro
              playerName={player}
              mode={modeLabel(state)}
              disabled={!controlsRun}
              onBegin={() => send({ type: 'SHOW_CURRENT_QUESTION' })}
            />
          ) : state.phase === 'between-questions' ? (
            <BetweenQuestions
              level={question.level}
              prize={PRIZE_LADDER[question.level - 1]}
              disabled={!controlsRun}
              onPresent={() => send({ type: 'SHOW_CURRENT_QUESTION' })}
            />
          ) : state.phase === 'completed' ? (
            <CompletedPanel state={state} onCompleted={onCompleted} />
          ) : (
            <QuestionPlay
              state={state}
              nowMs={nowMs}
              controlsRun={controlsRun}
              send={send}
            />
          )}
        </section>

        <PrizeLadder state={state} />
      </div>

      <GameplayDialogs
        state={state}
        nowMs={nowMs}
        controlsRun={controlsRun}
        send={send}
        onSaveAndExit={onSaveAndExit}
        onOpenSettings={onOpenSettings}
      />

      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {phaseAnnouncement(state)}
      </div>
    </main>
  );
}

function NarrationControl({
  status,
  onReplay,
  onSkip,
}: {
  status: NarrationStatus;
  onReplay?: () => void;
  onSkip?: () => void;
}) {
  if (status === 'speaking' && onSkip) {
    return (
      <button type="button" className="quiet-button narration-button" onClick={onSkip}>
        <span className="narration-pulse" aria-hidden="true" /> Skip voice
      </button>
    );
  }
  if (status === 'idle' && onReplay) {
    return (
      <button type="button" className="quiet-button narration-button" onClick={onReplay}>
        <span aria-hidden="true">↻</span> Replay question
      </button>
    );
  }
  if (status === 'unavailable') {
    return <span className="narration-status">Voice unavailable</span>;
  }
  return null;
}

function ControllerNotice({
  status,
  message,
  onTakeControl,
}: {
  status: Exclude<GameplayControllerStatus, 'active'>;
  message?: string;
  onTakeControl?: () => void;
}) {
  const copy =
    status === 'read-only'
      ? 'This saved run is active in another tab. This view is read-only.'
      : status === 'taking-control'
        ? 'Requesting control of this saved run…'
        : 'The latest game state could not be saved. Gameplay controls are paused.';

  return (
    <div className="controller-notice" role={status === 'save-error' ? 'alert' : 'status'}>
      <span aria-hidden="true">{status === 'save-error' ? '!' : '◇'}</span>
      <p>{message || copy}</p>
      {status === 'read-only' && onTakeControl && (
        <button type="button" className="secondary-button" onClick={onTakeControl}>
          Take control
        </button>
      )}
    </div>
  );
}

function GameIntro({
  playerName,
  mode,
  disabled,
  onBegin,
}: {
  playerName: string;
  mode: string;
  disabled: boolean;
  onBegin: () => void;
}) {
  return (
    <div className="game-intro-card">
      <div className="game-intro-rings" aria-hidden="true"><i /><i /><i /></div>
      <span className="kicker">Ascent initialized</span>
      <h1>{playerName}, your path is secured.</h1>
      <p>{mode} · 15 questions · two lifelines · one million dollars</p>
      <div className="game-intro-checkpoints" aria-label="Guaranteed checkpoints">
        <span><small>Checkpoint 01</small><strong>$1,000</strong></span>
        <i aria-hidden="true" />
        <span><small>Checkpoint 02</small><strong>$32,000</strong></span>
      </div>
      <button type="button" className="primary-button" disabled={disabled} onClick={onBegin}>
        Begin Question 1
      </button>
    </div>
  );
}

function BetweenQuestions({
  level,
  prize,
  disabled,
  onPresent,
}: {
  level: number;
  prize: number;
  disabled: boolean;
  onPresent: () => void;
}) {
  return (
    <div className="between-card">
      <span className="kicker">Next threshold</span>
      <strong className="between-card__number">{String(level).padStart(2, '0')}</strong>
      <h1>Question {level}</h1>
      <p>Now playing for <strong>{formatMoney(prize)}</strong></p>
      <button type="button" className="primary-button" disabled={disabled} onClick={onPresent}>
        Present Question {level}
      </button>
    </div>
  );
}

function QuestionPlay({
  state,
  nowMs,
  controlsRun,
  send,
}: {
  state: GameRunState;
  nowMs: number;
  controlsRun: boolean;
  send: (action: GameAction) => void;
}) {
  const question = currentQuestion(state);
  const phoneActive = state.lifelines.phone.status === 'active';
  const secondsRemaining = Math.ceil(phoneRemainingMs(state, nowMs) / 1_000);
  const result = currentResult(state);

  return (
    <>
      <div className="question-meta">
        <div><span>Level {String(question.level).padStart(2, '0')}</span><strong>{formatMoney(PRIZE_LADDER[question.level - 1])}</strong></div>
        <span className="question-category">{question.category}</span>
      </div>

      <section className="question-panel panel" aria-labelledby="active-question">
        <span className="kicker">Question {question.level}</span>
        <h1 id="active-question">{question.prompt}</h1>
      </section>

      {state.hintRevealedForQuestionId === question.id && (
        <aside className="hint-panel" aria-label="Revealed hint">
          <span aria-hidden="true">◇</span>
          <div><strong>Hint</strong><p>{question.hint}</p></div>
        </aside>
      )}

      {phoneActive && (
        <div className="phone-active" aria-label="Phone a Friend active">
          <div className="phone-active__timer" role="timer" aria-label={`${secondsRemaining} seconds remaining`}>
            <span>{String(Math.floor(secondsRemaining / 60)).padStart(2, '0')}</span>
            <i>:</i>
            <span>{String(secondsRemaining % 60).padStart(2, '0')}</span>
          </div>
          <div><strong>Phone a Friend</strong><p>Discuss the visible question. Lock In resumes when the call ends.</p></div>
          <button type="button" className="secondary-button" disabled={!controlsRun} onClick={() => send({ type: 'END_PHONE_EARLY' })}>End call early</button>
        </div>
      )}

      <div className="answer-grid" role="group" aria-label={`Answers for Question ${question.level}`}>
        {question.choices.map((choice) => {
          const domainVisualState = visualStateForChoice(state, choice);
          const visualState =
            !controlsRun && domainVisualState === 'available'
              ? 'disabled'
              : domainVisualState;
          const selectable = controlsRun && canSelectAnswer(state);
          return (
            <button
              key={choice.id}
              type="button"
              className={`answer-choice answer-choice--${visualState}`}
              data-choice-id={choice.id}
              data-state={visualState}
              aria-keyshortcuts={choice.label}
              aria-pressed={choice.id === state.selectedChoiceId}
              aria-label={`${choice.label}: ${choice.text}. ${ANSWER_STATE_LABELS[visualState]}`}
              disabled={!selectable}
              onClick={() => send({ type: 'SELECT_ANSWER', choiceId: choice.id })}
            >
              <span className="answer-choice__letter" aria-hidden="true">{choice.label}</span>
              <span className="answer-choice__text">{choice.text}</span>
              <span className={`answer-choice__state ${visualState === 'available' ? 'sr-only' : ''}`}>
                {visualState === 'correct' && <b aria-hidden="true">✓</b>}
                {visualState === 'incorrect' && <b aria-hidden="true">×</b>}
                {ANSWER_STATE_LABELS[visualState]}
              </span>
            </button>
          );
        })}
      </div>

      <div className="gameplay-actions">
        <div className="lifeline-row" aria-label="Lifelines">
          <button
            type="button"
            className={`lifeline-button lifeline-button--${state.lifelines.hint.status}`}
            data-lifeline-state={state.lifelines.hint.status}
            disabled={!controlsRun || !canUseHint(state)}
            onClick={() => send({ type: 'USE_HINT' })}
          >
            <span aria-hidden="true">◇</span>
            <span><strong>Hint</strong><small>{state.lifelines.hint.status === 'used' ? 'Used' : phoneActive ? 'Call active' : 'Available'}</small></span>
          </button>
          <button
            type="button"
            className={`lifeline-button lifeline-button--${state.lifelines.phone.status}`}
            data-lifeline-state={state.lifelines.phone.status}
            disabled={!controlsRun || !canUsePhone(state)}
            onClick={() => send({ type: 'REQUEST_PHONE' })}
          >
            <span aria-hidden="true">◁</span>
            <span><strong>Phone a Friend</strong><small>{state.lifelines.phone.status === 'available' ? '60 seconds' : state.lifelines.phone.status === 'active' ? 'Call active' : 'Used'}</small></span>
          </button>
        </div>

        {state.phase === 'answer-locked' ? (
          <div className="lock-status" role="status"><span aria-hidden="true" /> Final answer locked</div>
        ) : state.phase === 'correct-reveal' ? (
          <div className="result-actions">
            <button type="button" className="primary-button" disabled={!controlsRun} onClick={() => send({ type: 'ADVANCE_QUESTION' })}>Continue to Question {question.level + 1}</button>
            <button type="button" className="quiet-button" disabled={!controlsRun} onClick={() => send({ type: 'REQUEST_WALK_AWAY' })}>Walk away with {formatMoney(state.currentWinnings)}</button>
          </div>
        ) : state.phase === 'incorrect-reveal' || state.phase === 'millionaire-reveal' ? (
          <button type="button" className="primary-button" disabled={!controlsRun} onClick={() => send({ type: 'ACKNOWLEDGE_TERMINAL' })}>Continue to results</button>
        ) : (
          <div className="answer-action-row">
            <button type="button" className="quiet-button walk-button" disabled={!controlsRun || !canWalkAway(state)} onClick={() => send({ type: 'REQUEST_WALK_AWAY' })}>Walk Away</button>
            <button type="button" className="primary-button lock-button" disabled={!controlsRun || !canLockAnswer(state)} onClick={() => send({ type: 'REQUEST_LOCK' })}>Lock In Answer</button>
          </div>
        )}
      </div>

      {result && state.revealedAtMs !== null && (
        <section className={`explanation-panel explanation-panel--${result.isCorrect ? 'correct' : 'incorrect'}`} aria-labelledby="answer-explanation">
          <span aria-hidden="true">{result.isCorrect ? '✓' : '!'}</span>
          <div>
            <h2 id="answer-explanation">{result.isCorrect ? 'Correct' : 'Answer revealed'}</h2>
            <p>{question.explanation}</p>
            {!result.isCorrect && <small>Guaranteed payout: {formatMoney(state.guaranteedWinnings)}</small>}
          </div>
        </section>
      )}
    </>
  );
}

function PrizeLadder({ state }: { state: GameRunState }) {
  const currentLevel = currentQuestion(state).level;
  const correctLevels = new Set<number>(
    state.results.filter((result) => result.isCorrect).map((result) => result.level),
  );

  return (
    <aside className="game-prize-ladder panel" aria-label="Prize ladder">
      <header>
        <span className="kicker">Prize architecture</span>
        <div className="ladder-money">
          <div><small>Current</small><strong>{formatMoney(state.currentWinnings)}</strong></div>
          <div><small>Guaranteed</small><strong>{formatMoney(state.guaranteedWinnings)}</strong></div>
        </div>
      </header>
      <ol reversed start={15}>
        {[...PRIZE_LADDER].reverse().map((prize, reverseIndex) => {
          const level = 15 - reverseIndex;
          const checkpoint = level === 5 || level === 10;
          const completed = correctLevels.has(level);
          const current = level === currentLevel;
          return (
            <li
              key={level}
              className={`${current ? 'ladder-row--current' : ''} ${completed ? 'ladder-row--completed' : ''} ${checkpoint ? 'ladder-row--checkpoint' : ''} ${level === 15 ? 'ladder-row--million' : ''}`}
              data-level={level}
              aria-current={current ? 'step' : undefined}
            >
              <span>{String(level).padStart(2, '0')}</span>
              <strong>{formatMoney(prize)}</strong>
              <em>{current ? 'Current' : completed ? 'Complete' : checkpoint ? 'Safe' : ''}</em>
            </li>
          );
        })}
      </ol>
      <footer><span className="ladder-key ladder-key--current" /> Current <span className="ladder-key ladder-key--safe" /> Checkpoint</footer>
    </aside>
  );
}

function CompletedPanel({
  state,
  onCompleted,
}: {
  state: GameRunState;
  onCompleted?: () => void;
}) {
  const outcome = state.terminalOutcome;
  if (!outcome) return null;

  const heading =
    outcome.kind === 'millionaire'
      ? 'One million secured.'
      : outcome.kind === 'walk-away'
        ? 'You chose certainty.'
        : 'The ascent ends here.';

  return (
    <div className={`completed-card completed-card--${outcome.kind}`}>
      <span className="kicker">Run complete</span>
      <h1>{heading}</h1>
      <strong>{formatMoney(outcome.amountWon)}</strong>
      <p>{outcome.kind === 'millionaire' ? 'All fifteen levels complete.' : 'Your final award is secured in local history.'}</p>
      {onCompleted && <button type="button" className="primary-button" onClick={onCompleted}>View full results</button>}
    </div>
  );
}

function GameplayDialogs({
  state,
  nowMs,
  controlsRun,
  send,
  onSaveAndExit,
  onOpenSettings,
}: {
  state: GameRunState;
  nowMs: number;
  controlsRun: boolean;
  send: (action: GameAction) => void;
  onSaveAndExit?: () => void;
  onOpenSettings?: () => void;
}) {
  const question = currentQuestion(state);
  const selected = question.choices.find((choice) => choice.id === state.selectedChoiceId);

  // A stale/read-only tab must leave takeover reachable rather than trapping
  // focus inside a dialog whose actions it is not authorized to commit.
  if (!controlsRun) return null;

  if (state.overlay?.kind === 'pause') {
    return (
      <Modal
        title="Game paused"
        onClose={controlsRun ? () => send({ type: 'RESUME' }) : undefined}
        actions={<button type="button" className="primary-button" disabled={!controlsRun} onClick={() => send({ type: 'RESUME' })}>Resume Game</button>}
      >
        <div className="pause-menu">
          <p>Your exact question, answer selection, lifelines, and winnings remain preserved.</p>
          <button type="button" className="secondary-button" disabled={!controlsRun || !onSaveAndExit} onClick={onSaveAndExit}>Save and Exit to Dashboard</button>
          <button type="button" className="secondary-button" disabled={!controlsRun || !onOpenSettings} onClick={onOpenSettings}>In-Game Settings</button>
          <button type="button" className="secondary-button" disabled={!controlsRun} onClick={() => send({ type: 'OPEN_HELP' })}>How to Play</button>
          <button type="button" className="danger-button" disabled={!controlsRun || !canWalkAway(state)} onClick={() => send({ type: 'REQUEST_WALK_AWAY' })}>Walk Away with {formatMoney(state.currentWinnings)}</button>
        </div>
      </Modal>
    );
  }

  if (state.overlay?.kind === 'help') {
    return (
      <Modal title="How to play" wide onClose={controlsRun ? () => send({ type: 'CLOSE_HELP' }) : undefined} actions={<button type="button" className="primary-button" disabled={!controlsRun} onClick={() => send({ type: 'CLOSE_HELP' })}>Return to Game</button>}>
        <div className="game-help-grid">
          <article><strong>Select, then lock</strong><p>A–D select answers. You may change your choice until Final Answer is confirmed.</p></article>
          <article><strong>Checkpoints</strong><p>Questions 5 and 10 guarantee $1,000 and $32,000 respectively.</p></article>
          <article><strong>Walk Away</strong><p>Leave before final lock-in and keep the value of your last correct answer.</p></article>
          <article><strong>Lifelines</strong><p>Hint reveals one clue. Phone a Friend opens a real-world 60-second call window.</p></article>
        </div>
      </Modal>
    );
  }

  if (state.overlay?.kind === 'walk-away-confirmation') {
    return (
      <Modal
        title={`Walk away with ${formatMoney(state.currentWinnings)}?`}
        destructive
        onClose={controlsRun ? () => send({ type: 'CANCEL_WALK_AWAY' }) : undefined}
        actions={<><button type="button" className="secondary-button" disabled={!controlsRun} onClick={() => send({ type: 'CANCEL_WALK_AWAY' })}>Return to Question</button><button type="button" className="danger-button" disabled={!controlsRun} onClick={() => send({ type: 'CONFIRM_WALK_AWAY', nowMs })}>Confirm Walk Away</button></>}
      >
        <p>This immediately ends the run. A later wrong answer could fall to {formatMoney(state.guaranteedWinnings)}, while walking away secures the full current amount.</p>
      </Modal>
    );
  }

  if (state.overlay === null && state.phase === 'final-confirmation' && selected) {
    return (
      <Modal
        title="Is that your final answer?"
        onClose={controlsRun ? () => send({ type: 'CANCEL_LOCK' }) : undefined}
        actions={<><button type="button" className="secondary-button" disabled={!controlsRun} onClick={() => send({ type: 'CANCEL_LOCK' })}>Go Back</button><button type="button" className="primary-button" disabled={!controlsRun} onClick={() => send({ type: 'CONFIRM_LOCK', nowMs })}>Yes, Final Answer</button></>}
      >
        <div className="final-answer-summary"><span>{selected.label}</span><strong>{selected.text}</strong></div>
        <p>After confirmation, the answer cannot be changed and lifelines, Help, Pause, and Walk Away remain unavailable until the reveal.</p>
      </Modal>
    );
  }

  if (state.overlay === null && state.phase === 'phone-confirmation') {
    return (
      <Modal
        title="Start Phone a Friend?"
        onClose={controlsRun ? () => send({ type: 'CANCEL_PHONE' }) : undefined}
        actions={<><button type="button" className="secondary-button" disabled={!controlsRun} onClick={() => send({ type: 'CANCEL_PHONE' })}>Not Yet</button><button type="button" className="primary-button" disabled={!controlsRun} onClick={() => send({ type: 'CONFIRM_PHONE', nowMs })}>Start 60-Second Call</button></>}
      >
        <p>Be ready to contact your friend before starting. Once activated, the lifeline is consumed. Pause or Help will immediately end the call.</p>
      </Modal>
    );
  }

  return null;
}
