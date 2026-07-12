import type { AudioPreferences } from '../audio/types';

interface SettingsPanelProps {
  settings: AudioPreferences;
  onChange: (settings: AudioPreferences) => void;
  voices: readonly SpeechSynthesisVoice[];
  compact?: boolean;
}

export function SettingsPanel({ settings, onChange, voices, compact = false }: SettingsPanelProps) {
  const patch = (next: Partial<AudioPreferences>) => onChange({ ...settings, ...next });
  return (
    <div className={`settings-grid ${compact ? 'settings-grid--compact' : ''}`}>
      <section className="settings-section">
        <div className="section-heading"><span>01</span><div><h3>Audio channels</h3><p>Device-wide presentation controls</p></div></div>
        <Toggle label="Master audio" checked={!settings.masterMuted} onChange={(checked) => patch({ masterMuted: !checked })} />
        <Toggle label="Ambient music" checked={settings.musicEnabled} onChange={(musicEnabled) => patch({ musicEnabled })} />
        <Range label="Music level" value={settings.musicVolume} onChange={(musicVolume) => patch({ musicVolume })} disabled={!settings.musicEnabled} />
        <Toggle label="Sound effects" checked={settings.effectsEnabled} onChange={(effectsEnabled) => patch({ effectsEnabled })} />
        <Range label="Effects level" value={settings.effectsVolume} onChange={(effectsVolume) => patch({ effectsVolume })} disabled={!settings.effectsEnabled} />
      </section>
      <section className="settings-section">
        <div className="section-heading"><span>02</span><div><h3>Voice narration</h3><p>Browser speech; all text stays visible</p></div></div>
        <Toggle label="Narration" checked={settings.narrationEnabled} onChange={(narrationEnabled) => patch({ narrationEnabled })} />
        <label className="field-row">
          <span>Voice</span>
          <select value={settings.voiceURI ?? ''} onChange={(event) => patch({ voiceURI: event.target.value || null })} disabled={!settings.narrationEnabled}>
            <option value="">System default</option>
            {voices.map((voice) => <option value={voice.voiceURI} key={voice.voiceURI}>{voice.name} · {voice.lang}{voice.localService ? ' · local' : ''}</option>)}
          </select>
        </label>
        <label className="range-row"><span>Speech rate <output>{settings.speechRate.toFixed(1)}×</output></span><input type="range" min="0.6" max="1.6" step="0.1" value={settings.speechRate} onChange={(event) => patch({ speechRate: Number(event.target.value) })} disabled={!settings.narrationEnabled} /></label>
        <Toggle label="Read answer choices" checked={settings.readAnswers} onChange={(readAnswers) => patch({ readAnswers })} />
        <Toggle label="Read revealed hints" checked={settings.readHints} onChange={(readHints) => patch({ readHints })} />
      </section>
      <section className="settings-section">
        <div className="section-heading"><span>03</span><div><h3>Presentation</h3><p>Comfort and accessibility</p></div></div>
        <Toggle label="Reduced motion" checked={settings.reducedMotion} onChange={(reducedMotion) => patch({ reducedMotion })} />
        <Toggle label="Reduced glow" checked={settings.reducedGlow} onChange={(reducedGlow) => patch({ reducedGlow })} />
        <Toggle label="Increased contrast" checked={settings.highContrast} onChange={(highContrast) => patch({ highContrast })} />
        <Toggle label="Prefer fullscreen" checked={settings.fullscreenPreferred} onChange={(fullscreenPreferred) => patch({ fullscreenPreferred })} />
        <Toggle label="Auto-advance correct answers" checked={settings.autoAdvance} onChange={(autoAdvance) => patch({ autoAdvance })} />
      </section>
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return <label className="toggle-row"><span>{label}</span><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} /><i aria-hidden="true" /></label>;
}

function Range({ label, value, onChange, disabled }: { label: string; value: number; onChange: (value: number) => void; disabled?: boolean }) {
  return <label className="range-row"><span>{label}<output>{Math.round(value * 100)}%</output></span><input type="range" min="0" max="1" step="0.05" value={value} onChange={(event) => onChange(Number(event.target.value))} disabled={disabled} /></label>;
}
