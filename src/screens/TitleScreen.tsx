import type { ProfileRecord } from '../data/types';
import type { GameRunState } from '../game';
import { BrandMark } from '../components/BrandMark';
import { formatMoney, formatRelativeDate } from '../utils/format';

interface TitleScreenProps {
  profiles: readonly ProfileRecord[];
  savedRun: GameRunState | null;
  saveOwnerName: string | null;
  offlineReady: boolean;
  online: boolean;
  onSelectProfile: (profile: ProfileRecord) => void;
  onGuest: () => void;
  onCreateProfile: () => void;
  onDeleteProfile: (profile: ProfileRecord) => void;
  onSettings: () => void;
  onHelp: () => void;
  onContent: () => void;
  onFullscreen: () => void;
}

export function TitleScreen(props: TitleScreenProps) {
  const atLimit = props.profiles.length >= 20;
  return (
    <main className="screen title-screen" aria-labelledby="title-heading">
      <header className="utility-bar">
        <div className="utility-status"><i className={`status-dot ${props.online ? '' : 'status-dot--offline'}`} />{props.offlineReady ? 'Offline ready' : props.online ? 'Preparing offline cache' : 'Offline cache unavailable'}</div>
        <div className="utility-bar__spacer" />
        <button className="icon-button" type="button" aria-label="Content manager" title="Content manager" onClick={props.onContent}>◇</button>
        <button className="icon-button" type="button" aria-label="Enter fullscreen" title="Fullscreen" onClick={props.onFullscreen}>⛶</button>
        <button className="icon-button" type="button" aria-label="Settings" title="Settings" onClick={props.onSettings}>⚙</button>
        <button className="icon-button" type="button" aria-label="Help" title="Help" onClick={props.onHelp}>?</button>
      </header>
      <div className="title-screen__body">
        <section className="title-hero">
          <BrandMark />
          <h1 id="title-heading" className="sr-only">One Million — The Knowledge Ascent</h1>
          <p>Fifteen questions. Two lifelines. One summit.</p>
          {props.savedRun && (
            <div className="save-beacon">
              <span className="save-beacon__pulse" aria-hidden="true" />
              <div><strong>Saved ascent detected</strong><span>{props.saveOwnerName ?? 'Guest'} · Question {props.savedRun.currentQuestionIndex + 1} · {formatMoney(props.savedRun.currentWinnings)}</span></div>
            </div>
          )}
        </section>
        <section className="profile-rack" aria-labelledby="select-player-title">
          <div className="profile-rack__heading">
            <div><span className="kicker">Local profiles</span><h2 id="select-player-title">Who is playing?</h2></div>
            <span>{props.profiles.length} / 20</span>
          </div>
          <div className="profile-grid">
            {props.profiles.map((profile, index) => {
              const ownsSave = props.savedRun?.owner.kind === 'profile' && props.savedRun.owner.profileId === profile.id;
              return (
                <article className={`profile-card ${ownsSave ? 'profile-card--saved' : ''}`} key={profile.id}>
                  <button className="profile-card__select" type="button" onClick={() => props.onSelectProfile(profile)} aria-label={`Play as ${profile.displayName}`}>
                    <span className="profile-card__index">{String(index + 1).padStart(2, '0')}</span>
                    <span className="profile-card__avatar">{profile.displayName.trim().charAt(0).toUpperCase()}</span>
                    <span className="profile-card__name">{profile.displayName}</span>
                    <span className="profile-card__meta">Best {formatMoney(profile.statistics.highestPrize)} · {profile.statistics.gamesPlayed} run{profile.statistics.gamesPlayed === 1 ? '' : 's'}</span>
                    <span className="profile-card__date">{formatRelativeDate(profile.lastPlayedAt)}</span>
                    {ownsSave && <span className="profile-card__badge">Saved run</span>}
                  </button>
                  <button className="profile-card__delete" type="button" onClick={() => props.onDeleteProfile(profile)} aria-label={`Delete ${profile.displayName}`} title="Delete profile">×</button>
                </article>
              );
            })}
            {!atLimit && <button className="profile-add" type="button" onClick={props.onCreateProfile}><span>＋</span><strong>Create profile</strong><small>Career stats and history</small></button>}
            <button className="profile-add profile-add--guest" type="button" onClick={props.onGuest}><span>◎</span><strong>Continue as Guest</strong><small>Full game · no named career</small></button>
          </div>
          {atLimit && <p className="profile-limit">The 20-profile limit is reached. Guest play remains available; delete a profile to create another.</p>}
        </section>
      </div>
      <footer className="title-footer"><span>Local-first · no account required</span><span>Release 001 · 525 questions</span></footer>
    </main>
  );
}
