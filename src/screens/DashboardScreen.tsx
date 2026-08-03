import type { ActiveIdentity } from '../app/types';
import type { GameRunState } from '../game';
import { BrandMark } from '../components/BrandMark';
import { formatMoney, formatRelativeDate } from '../utils/format';

interface DashboardScreenProps {
  identity: ActiveIdentity;
  savedRun: GameRunState | null;
  saveOwnerName: string | null;
  ownsSave: boolean;
  runCount: number;
  setWins: number;
  uniqueSeen: number;
  onContinue: () => void;
  onNewGame: () => void;
  onStatistics: () => void;
  onHistory: () => void;
  onSets: () => void;
  onContent: () => void;
  onSettings: () => void;
  onHelp: () => void;
  onSwitchProfile: () => void;
  onFullscreen: () => void;
}

export function DashboardScreen(props: DashboardScreenProps) {
  const name = props.identity.kind === 'profile' ? props.identity.profile.displayName : 'Guest';
  const stats = props.identity.kind === 'profile' ? props.identity.profile.statistics : null;
  return (
    <main className="screen dashboard-screen" aria-labelledby="dashboard-heading">
      <header className="utility-bar">
        <BrandMark compact />
        <div className="utility-divider" />
        <div><div className="utility-label">Active player</div><div className="utility-value">{name}</div></div>
        <div className="utility-bar__spacer" />
        <button className="icon-button" onClick={props.onFullscreen} type="button" aria-label="Toggle fullscreen">⛶</button>
        <button className="icon-button" onClick={props.onSettings} type="button" aria-label="Settings">⚙</button>
        <button className="icon-button" onClick={props.onHelp} type="button" aria-label="Help">?</button>
      </header>
      <div className="dashboard-body">
        <section className="dashboard-welcome">
          <span className="kicker">Command deck</span>
          <h1 id="dashboard-heading">Welcome back, {name}.</h1>
          <p>{props.identity.kind === 'guest' ? 'Guest progress is available for this browser session. Create a profile whenever you want a permanent local career.' : 'Your ascent data is local, private, and ready whenever you are.'}</p>
          {props.ownsSave && props.savedRun ? (
            <button className="continue-panel" type="button" onClick={props.onContinue}>
              <span className="continue-panel__signal" aria-hidden="true" />
              <span className="continue-panel__copy"><small>Resume saved ascent</small><strong>Question {props.savedRun.currentQuestionIndex + 1} of 15</strong><span>{props.savedRun.mode.kind === 'fresh-mix' ? 'Fresh Mix' : props.savedRun.mode.setTitle} · {formatMoney(props.savedRun.currentWinnings)} banked · saved {formatRelativeDate(props.savedRun.createdAtMs)}</span></span>
              <span className="continue-panel__action">Continue →</span>
            </button>
          ) : (
            <button className="new-run-panel" type="button" onClick={props.onNewGame}>
              <span><small>Begin a new ascent</small><strong>Start New Game</strong><em>Fresh Mix · Curated Sets · Surprise Me</em></span><b>→</b>
            </button>
          )}
          {!props.ownsSave && props.savedRun && <div className="notice"><span>◇</span><div><strong>{props.saveOwnerName ?? 'Another player'} has the global save.</strong><br />Starting a confirmed new game will replace their Question {props.savedRun.currentQuestionIndex + 1} run.</div></div>}
          {props.ownsSave && <button type="button" className="secondary-button dashboard-new-button" onClick={props.onNewGame}>Start a different game</button>}
        </section>
        <aside className="dashboard-stats panel">
          <div className="dashboard-stats__heading"><span className="kicker">Career telemetry</span><strong>{props.identity.kind === 'guest' ? 'Session' : 'All time'}</strong></div>
          <div className="dashboard-stat"><span>Personal best</span><strong>{formatMoney(stats?.highestPrize ?? 0)}</strong></div>
          <div className="dashboard-stat"><span>Runs completed</span><strong>{props.runCount}</strong></div>
          <div className="dashboard-stat"><span>Millionaire wins</span><strong>{stats?.millionaireWins ?? props.setWins}</strong></div>
          <div className="dashboard-stat"><span>Questions discovered</span><strong>{props.uniqueSeen}<small> / 525</small></strong></div>
        </aside>
        <nav className="dashboard-nav" aria-label="Dashboard destinations">
          <button type="button" onClick={props.onStatistics}><span>⌁</span><strong>Statistics</strong><small>Career accuracy and milestones</small></button>
          <button type="button" onClick={props.onHistory}><span>◷</span><strong>Run History</strong><small>Results and question review</small></button>
          <button type="button" onClick={props.onSets}><span>◆</span><strong>Set Progress</strong><small>Track all 12 authored sets</small></button>
          <button type="button" onClick={props.onContent}><span>▧</span><strong>Content Manager</strong><small>Import, author, and organize packs</small></button>
          <button type="button" onClick={props.onSettings}><span>⚙</span><strong>Settings & Data</strong><small>Audio, accessibility, backup</small></button>
          <button type="button" onClick={props.onSwitchProfile}><span>⇄</span><strong>Switch Player</strong><small>Return to profile selection</small></button>
        </nav>
      </div>
    </main>
  );
}
