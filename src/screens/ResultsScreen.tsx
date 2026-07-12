import type { GameRunState, ResolvedQuestionSnapshot } from '../game';
import { formatDuration, formatMoney } from '../utils/format';

interface ResultsScreenProps {
  run: GameRunState;
  playerName: string;
  commitPending: boolean;
  commitError: string | null;
  onRetryCommit: () => void;
  onReview: () => void;
  onStatistics: () => void;
  onDashboard: () => void;
  onPlayAgain: () => void;
  onSwitchProfile: () => void;
}

export function ResultsScreen(props: ResultsScreenProps) {
  const outcome = props.run.terminalOutcome;
  if (!outcome) return null;
  const correct = props.run.results.filter((result) => result.isCorrect).length;
  const lifelines = [props.run.lifelines.hint.status === 'used' && 'Hint', props.run.lifelines.phone.status === 'used' && 'Phone'].filter(Boolean);
  const kind = outcome.kind;
  return (
    <main className={`screen results-screen results-screen--${kind}`} aria-labelledby="results-title">
      <div className="results-radiance" aria-hidden="true"><i /><i /><i /></div>
      <section className="results-card">
        <span className="kicker">Ascent complete</span>
        <p className="results-overline">{kind === 'millionaire' ? `${props.playerName}, you reached the summit` : kind === 'walk-away' ? 'A calculated exit' : 'The ascent ends here'}</p>
        <h1 id="results-title">{kind === 'millionaire' ? 'ONE MILLION' : formatMoney(outcome.amountWon)}</h1>
        <p className="results-message">{kind === 'millionaire' ? 'Fifteen correct answers. An extraordinary command of knowledge.' : kind === 'walk-away' ? `You walked away with ${formatMoney(outcome.amountWon)} secured.` : `A wrong answer returns the payout to ${formatMoney(outcome.amountWon)}.`}</p>
        <div className="results-metrics">
          <div><span>Question reached</span><strong>{kind === 'walk-away' ? outcome.nextPrizeLevel : kind === 'incorrect' ? outcome.failedLevel : 15}<small> / 15</small></strong></div>
          <div><span>Correct answers</span><strong>{correct}<small> / 15</small></strong></div>
          <div><span>Lifelines used</span><strong>{lifelines.length}<small> / 2</small></strong></div>
          <div><span>Run duration</span><strong>{formatDuration(Math.max(0, outcome.endedAtMs - props.run.createdAtMs))}</strong></div>
        </div>
        {props.commitPending && <div className="notice notice--info" role="status"><span>◇</span><div><strong>Securing this result…</strong><br />History and statistics are being committed locally.</div></div>}
        {props.commitError && <div className="notice notice--error" role="alert"><span>!</span><div><strong>This result is still in memory.</strong><br />{props.commitError}<br /><button className="quiet-button" type="button" onClick={props.onRetryCommit}>Retry save</button></div></div>}
        <div className="button-row button-row--center results-actions">
          <button className="primary-button" type="button" onClick={props.onReview}>Review This Run</button>
          <button className="secondary-button" type="button" onClick={props.onStatistics}>View Statistics</button>
          <button className="secondary-button" type="button" onClick={props.onPlayAgain}>Play Again</button>
          <button className="quiet-button" type="button" onClick={props.onDashboard}>Dashboard</button>
          <button className="quiet-button" type="button" onClick={props.onSwitchProfile}>Switch Player</button>
        </div>
      </section>
    </main>
  );
}

interface RunReviewScreenProps {
  questions: readonly ResolvedQuestionSnapshot[];
  results: GameRunState['results'];
  displayedQuestionIds: readonly string[];
  title: string;
  onBack: () => void;
}

export function RunReviewScreen({ questions, results, displayedQuestionIds, title, onBack }: RunReviewScreenProps) {
  const displayed = questions.filter((question) => displayedQuestionIds.includes(question.id));
  const initiallyOpen = displayed.at(-1)?.id;
  return (
    <main className="screen review-screen" aria-labelledby="review-title">
      <header className="utility-bar"><div><div className="utility-label">Post-game analysis</div><div className="utility-value">Run Review</div></div><div className="utility-bar__spacer" /><button className="quiet-button" type="button" onClick={onBack}>← Results</button></header>
      <div className="review-body screen-scroll">
        <span className="kicker">Read-only record</span>
        <h1 id="review-title">{title}</h1>
        <p>Only questions actually displayed during this run appear here. Reviewing never changes encounter history.</p>
        <div className="review-list">
          {displayed.map((question) => {
            const result = results.find((entry) => entry.questionId === question.id);
            const selected = question.choices.find((choice) => choice.id === result?.selectedChoiceId);
            const correct = question.choices.find((choice) => choice.id === question.correctChoiceId);
            const status = result ? result.isCorrect ? 'correct' : 'incorrect' : 'unanswered';
            return (
              <details className={`review-item review-item--${status}`} key={question.id} open={question.id === initiallyOpen}>
                <summary><span className="review-item__level">Q{question.level}</span><strong>{question.prompt}</strong><span className="review-item__status">{status === 'correct' ? '✓ Correct' : status === 'incorrect' ? '✕ Incorrect' : '— Unanswered'}</span></summary>
                <div className="review-item__body">
                  <div className="review-choices">{question.choices.map((choice) => <div key={choice.id} className={`${choice.id === question.correctChoiceId ? 'is-correct' : ''} ${choice.id === result?.selectedChoiceId && !result.isCorrect ? 'is-wrong' : ''}`}><span>{choice.label}</span><p>{choice.text}</p>{choice.id === question.correctChoiceId && <em>Correct answer</em>}{choice.id === result?.selectedChoiceId && <em>Your answer</em>}</div>)}</div>
                  <dl><div><dt>Your answer</dt><dd>{selected ? `${selected.label}. ${selected.text}` : 'No answer submitted'}</dd></div><div><dt>Correct answer</dt><dd>{correct ? `${correct.label}. ${correct.text}` : 'Unavailable'}</dd></div><div><dt>Hint</dt><dd>{question.hint}</dd></div><div><dt>Explanation</dt><dd>{question.explanation}</dd></div></dl>
                </div>
              </details>
            );
          })}
        </div>
      </div>
    </main>
  );
}
