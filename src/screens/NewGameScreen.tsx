import type { AudioPreferences } from '../audio/types';
import type { NewGameConfig } from '../app/types';
import type { CuratedSetDefinition, GameRunState } from '../game';
import { BrandMark } from '../components/BrandMark';
import { formatMoney } from '../utils/format';

export interface SetDisplayInfo extends CuratedSetDefinition {
  sourceLabel: string;
  attempts: number;
  bestPrize: number;
  millionaireWon: boolean;
  seenCount: number;
}

interface NewGameScreenProps {
  playerName: string;
  config: NewGameConfig;
  sets: readonly SetDisplayInfo[];
  freshness: number;
  existingSave: GameRunState | null;
  existingSaveOwner: string | null;
  settings: AudioPreferences;
  onConfig: (config: NewGameConfig) => void;
  onSettings: (settings: AudioPreferences) => void;
  onContinue: () => void;
  onBack: () => void;
  onHelp: () => void;
}

export function NewGameScreen(props: NewGameScreenProps) {
  const selectedSet = props.sets.find((set) => set.id === props.config.selectedSetId) ?? null;
  const canContinue = props.config.mode !== 'curated-set' || selectedSet !== null;
  const modeLabel = props.config.mode === 'fresh-mix' ? 'Fresh Mix' : props.config.mode === 'surprise' ? 'Surprise Me' : selectedSet?.title ?? 'Choose a set';
  return (
    <main className="screen setup-screen" aria-labelledby="setup-heading">
      <header className="utility-bar">
        <BrandMark compact />
        <div className="utility-divider" />
        <div><div className="utility-label">New ascent</div><div className="utility-value">Configuration</div></div>
        <div className="utility-bar__spacer" />
        <button type="button" className="quiet-button" onClick={props.onBack}>← Dashboard</button>
        <button type="button" className="icon-button" aria-label="Help" onClick={props.onHelp}>?</button>
      </header>
      <div className="setup-layout screen-scroll">
        <section className="setup-main">
          <span className="kicker">Run architecture</span>
          <h1 id="setup-heading" className="hero-title">Build your next ascent.</h1>
          <p className="hero-subtitle">Every path reserves one question at each exact level. Your choices here never mark a question as seen or disturb the current save.</p>
          <div className="setup-section-heading"><span>01</span><div><h2>Choose a mode</h2><p>Personalized discovery or an authored sequence</p></div></div>
          <div className="mode-grid">
            <ModeCard active={props.config.mode === 'fresh-mix'} title="Fresh Mix" eyebrow={`${props.freshness} new of 15`} icon="⌁" description="A profile-aware run that favors unseen questions and category diversity." onClick={() => props.onConfig({ ...props.config, mode: 'fresh-mix' })} />
            <ModeCard active={props.config.mode === 'curated-set'} title="Choose a Set" eyebrow={`${props.sets.length} sets available`} icon="◆" description="A fixed, intentionally paced sequence with fresh answer positions each attempt." onClick={() => props.onConfig({ ...props.config, mode: 'curated-set' })} />
            <ModeCard active={props.config.mode === 'surprise'} title="Surprise Me" eyebrow="Discovery priority" icon="✦" description="Selects an unattempted or least-recently-played curated set for you." onClick={() => props.onConfig({ ...props.config, mode: 'surprise' })} />
          </div>
          {props.config.mode === 'curated-set' && (
            <div className="set-browser">
              <div className="set-browser__heading"><h2>Select a curated set</h2><span>{props.sets.length} installed</span></div>
              <div className="set-browser__grid">
                {props.sets.map((set) => (
                  <button type="button" className={`set-card ${set.id === props.config.selectedSetId ? 'set-card--active' : ''}`} key={set.id} onClick={() => props.onConfig({ ...props.config, selectedSetId: set.id })}>
                    <span className="set-card__theme">{set.theme || 'Mixed knowledge'}</span>
                    <strong>{set.title}</strong>
                    <p>{set.description}</p>
                    <span className="set-card__status">{set.millionaireWon ? 'Millionaire won' : set.attempts ? `${set.attempts} attempt${set.attempts === 1 ? '' : 's'} · best ${formatMoney(set.bestPrize)}` : 'New'} · {set.sourceLabel}</span>
                    {set.id === props.config.selectedSetId && <i>Selected ✓</i>}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="setup-section-heading"><span>02</span><div><h2>Content scope</h2><p>Custom packs remain local to this browser</p></div></div>
          <div className="segmented-control" role="radiogroup" aria-label="Content scope">
            <button role="radio" aria-checked={props.config.contentScope === 'built-in'} className={props.config.contentScope === 'built-in' ? 'active' : ''} type="button" onClick={() => props.onConfig({ ...props.config, contentScope: 'built-in' })}>Built-in Release 001</button>
            <button role="radio" aria-checked={props.config.contentScope === 'all-enabled'} className={props.config.contentScope === 'all-enabled' ? 'active' : ''} type="button" onClick={() => props.onConfig({ ...props.config, contentScope: 'all-enabled' })}>All enabled packs</button>
          </div>
          <div className="setup-section-heading"><span>03</span><div><h2>Run presentation</h2><p>Quick choices; full controls remain in Settings</p></div></div>
          <div className="quick-settings panel panel--soft">
            <QuickToggle label="Ambient music" checked={props.settings.musicEnabled} onChange={(musicEnabled) => props.onSettings({ ...props.settings, musicEnabled })} />
            <QuickToggle label="Sound effects" checked={props.settings.effectsEnabled} onChange={(effectsEnabled) => props.onSettings({ ...props.settings, effectsEnabled })} />
            <QuickToggle label="Voice narration" checked={props.settings.narrationEnabled} onChange={(narrationEnabled) => props.onSettings({ ...props.settings, narrationEnabled })} />
            <QuickToggle label="Read choices aloud" checked={props.settings.readAnswers} onChange={(readAnswers) => props.onSettings({ ...props.settings, readAnswers })} />
            <QuickToggle label="Reduced motion" checked={props.settings.reducedMotion} onChange={(reducedMotion) => props.onSettings({ ...props.settings, reducedMotion })} />
          </div>
        </section>
        <aside className="setup-summary panel">
          <span className="kicker">Run summary</span>
          <h2>{modeLabel}</h2>
          <dl>
            <div><dt>Player</dt><dd>{props.playerName}</dd></div>
            <div><dt>Question path</dt><dd>Levels 1–15</dd></div>
            <div><dt>Fresh estimate</dt><dd>{props.config.mode === 'fresh-mix' ? `${props.freshness} new` : selectedSet ? `${Math.max(0, 15 - selectedSet.seenCount)} unseen` : 'Set on begin'}</dd></div>
            <div><dt>Content</dt><dd>{props.config.contentScope === 'built-in' ? 'Built-in only' : 'All enabled'}</dd></div>
            <div><dt>Lifelines</dt><dd>Hint + Phone</dd></div>
            <div><dt>Audio</dt><dd>{props.settings.masterMuted ? 'Muted' : [props.settings.musicEnabled && 'Music', props.settings.effectsEnabled && 'Effects', props.settings.narrationEnabled && 'Voice'].filter(Boolean).join(' · ') || 'Silent'}</dd></div>
          </dl>
          {props.existingSave && <div className="notice"><span>⚠</span><div><strong>Global save occupied</strong><br />{props.existingSaveOwner ?? 'Guest'} · Question {props.existingSave.currentQuestionIndex + 1} · {formatMoney(props.existingSave.currentWinnings)}. It is untouched until Begin Game is confirmed.</div></div>}
          <button type="button" className="primary-button setup-summary__continue" disabled={!canContinue} onClick={props.onContinue}>Review ascent →</button>
          {!canContinue && <small className="field-help">Select one curated set to continue.</small>}
        </aside>
      </div>
    </main>
  );
}

function ModeCard({ active, title, eyebrow, icon, description, onClick }: { active: boolean; title: string; eyebrow: string; icon: string; description: string; onClick: () => void }) {
  return <button type="button" className={`mode-card ${active ? 'mode-card--active' : ''}`} aria-pressed={active} onClick={onClick}><span className="mode-card__icon">{icon}</span><span className="mode-card__eyebrow">{eyebrow}</span><strong>{title}</strong><p>{description}</p>{active && <i>Active</i>}</button>;
}

function QuickToggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return <label className="quick-toggle"><span>{label}</span><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} /><i aria-hidden="true" /></label>;
}
