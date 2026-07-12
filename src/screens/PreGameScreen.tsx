import type { NewGameConfig } from '../app/types';
import type { GameRunState } from '../game';
import { PRIZE_LADDER } from '../game';
import { BrandMark } from '../components/BrandMark';
import { formatMoney } from '../utils/format';

interface PreGameScreenProps {
  playerName: string;
  config: NewGameConfig;
  modeTitle: string;
  freshness: number;
  audioLabel: string;
  existingSave: GameRunState | null;
  existingSaveOwner: string | null;
  busy: boolean;
  error: string | null;
  onBegin: () => void;
  onBack: () => void;
}

export function PreGameScreen(props: PreGameScreenProps) {
  return (
    <main className="screen pregame-screen" aria-labelledby="pregame-heading">
      <header className="utility-bar"><BrandMark compact /><div className="utility-divider" /><div><div className="utility-label">Final review</div><div className="utility-value">Ascent protocol</div></div><div className="utility-bar__spacer" /><button type="button" className="quiet-button" onClick={props.onBack} disabled={props.busy}>← Edit options</button></header>
      <div className="pregame-layout">
        <section className="pregame-brief">
          <span className="kicker">Ready check</span>
          <h1 id="pregame-heading">Your path to one million.</h1>
          <p>Questions and answer positions are generated only after you begin. Once created, that exact path is fixed inside the global save.</p>
          <div className="pregame-facts">
            <div><span>Player</span><strong>{props.playerName}</strong></div>
            <div><span>Mode</span><strong>{props.modeTitle}</strong></div>
            <div><span>Freshness</span><strong>{props.config.mode === 'fresh-mix' ? `${props.freshness} new questions` : 'Fixed authored order'}</strong></div>
            <div><span>Presentation</span><strong>{props.audioLabel}</strong></div>
          </div>
          <div className="rules-strip">
            <article><span>◇</span><div><strong>Hint</strong><p>One handcrafted clue, consumed on reveal.</p></div></article>
            <article><span>◷</span><div><strong>Phone a Friend</strong><p>One real-world 60-second call window.</p></div></article>
            <article><span>↗</span><div><strong>Walk Away</strong><p>Keep the full value of your last correct answer.</p></div></article>
          </div>
          {props.existingSave && <div className="notice notice--error"><span>⚠</span><div><strong>This will replace {props.existingSaveOwner ?? 'Guest'}’s saved run.</strong><br />Their Question {props.existingSave.currentQuestionIndex + 1} ascent with {formatMoney(props.existingSave.currentWinnings)} banked will be permanently abandoned only after a valid new run is generated.</div></div>}
          {props.error && <div className="notice notice--error" role="alert"><span>!</span><div><strong>Run generation stopped</strong><br />{props.error} The previous save remains intact.</div></div>}
          <div className="button-row"><button type="button" className="primary-button begin-button" onClick={props.onBegin} disabled={props.busy}>{props.busy ? 'Generating secure run…' : props.existingSave ? 'Replace Save & Begin' : 'Begin Game'}</button><button type="button" className="secondary-button" onClick={props.onBack} disabled={props.busy}>Edit options</button></div>
        </section>
        <aside className="pregame-ladder panel">
          <span className="kicker">Prize architecture</span>
          <ol>{[...PRIZE_LADDER].reverse().map((prize, reverseIndex) => { const level = 15 - reverseIndex; const checkpoint = level === 5 || level === 10; return <li key={level} className={`${checkpoint ? 'checkpoint' : ''} ${level === 15 ? 'million' : ''}`}><span>{String(level).padStart(2, '0')}</span><strong>{formatMoney(prize)}</strong>{checkpoint && <em>Guaranteed</em>}</li>; })}</ol>
          <p>Wrong before Level 5: $0 · after Level 5: $1,000 · after Level 10: $32,000</p>
        </aside>
      </div>
    </main>
  );
}
