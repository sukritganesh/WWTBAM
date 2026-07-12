import { useRef } from 'react';
import type { AudioPreferences } from '../audio/types';
import { SettingsPanel } from '../components/SettingsPanel';

interface SettingsScreenProps {
  settings: AudioPreferences;
  voices: readonly SpeechSynthesisVoice[];
  playerIsProfile: boolean;
  offlineReady: boolean;
  online: boolean;
  updateAvailable: boolean;
  storageMessage: string | null;
  onChange: (settings: AudioPreferences) => void;
  onBack: () => void;
  onFullscreen: () => void;
  onApplyUpdate: () => void;
  onExportBackup: () => void;
  onRestoreBackup: (file: File) => void;
  onExportProfile: () => void;
  onImportProfile: (file: File) => void;
  onResetAll: () => void;
}

export function SettingsScreen(props: SettingsScreenProps) {
  const restoreRef = useRef<HTMLInputElement>(null);
  const profileRef = useRef<HTMLInputElement>(null);
  return (
    <main className="screen settings-screen" aria-labelledby="settings-title">
      <header className="utility-bar"><div><div className="utility-label">Device preferences</div><div className="utility-value">Settings & Data</div></div><div className="utility-bar__spacer" /><button type="button" className="quiet-button" onClick={props.onBack}>← Back</button></header>
      <div className="settings-body screen-scroll">
        <span className="kicker">Presentation matrix</span>
        <h1 id="settings-title">Make the stage yours.</h1>
        <p className="hero-subtitle">These preferences are global to this device. Master mute preserves the individual channel levels beneath it.</p>
        <SettingsPanel settings={props.settings} voices={props.voices} onChange={props.onChange} />
        <section className="settings-data panel">
          <div className="settings-data__intro"><span className="kicker">Local data protection</span><h2>Backup, restore, and recovery</h2><p>Browser storage can be cleared outside the app. A versioned JSON backup preserves profiles, history, settings, the global save, and custom packs.</p></div>
          <div className="data-actions">
            <button type="button" onClick={props.onExportBackup}><span>⇩</span><strong>Export full backup</strong><small>All local application data</small></button>
            <button type="button" onClick={() => restoreRef.current?.click()}><span>⇧</span><strong>Restore full backup</strong><small>Validated before replacement</small></button>
            <button type="button" onClick={props.onExportProfile} disabled={!props.playerIsProfile}><span>◉</span><strong>Export profile</strong><small>Named career and related history</small></button>
            <button type="button" onClick={() => profileRef.current?.click()}><span>⊕</span><strong>Import profile</strong><small>Creates a new internal identity</small></button>
            <button type="button" onClick={props.onFullscreen}><span>⛶</span><strong>Toggle fullscreen</strong><small>Windowed play always remains available</small></button>
            <button type="button" className="data-action--danger" onClick={props.onResetAll}><span>×</span><strong>Reset local data</strong><small>Requires explicit confirmation</small></button>
          </div>
          <input ref={restoreRef} className="sr-only" type="file" accept="application/json,.json" onChange={(event) => { const file = event.target.files?.[0]; if (file) props.onRestoreBackup(file); event.currentTarget.value = ''; }} />
          <input ref={profileRef} className="sr-only" type="file" accept="application/json,.json" onChange={(event) => { const file = event.target.files?.[0]; if (file) props.onImportProfile(file); event.currentTarget.value = ''; }} />
        </section>
        <section className="system-status panel">
          <div><span className={`status-dot ${props.online ? '' : 'status-dot--offline'}`} /><p><strong>{props.online ? 'Network available' : 'Working offline'}</strong><small>Gameplay never requires a connection.</small></p></div>
          <div><span className={`status-dot ${props.offlineReady ? '' : 'status-dot--offline'}`} /><p><strong>{props.offlineReady ? 'Offline package ready' : 'Offline package pending'}</strong><small>{props.offlineReady ? 'The installed shell and built-in content are cached.' : 'Keep this page open while the initial cache completes.'}</small></p></div>
          <div><span className={`status-dot ${props.updateAvailable ? 'status-dot--offline' : ''}`} /><p><strong>{props.updateAvailable ? 'Update waiting safely' : 'Application current'}</strong><small>{props.updateAvailable ? 'Apply only from this safe non-game screen.' : 'No pending service-worker update.'}</small></p>{props.updateAvailable && <button className="secondary-button" type="button" onClick={props.onApplyUpdate}>Apply Update</button>}</div>
        </section>
        {props.storageMessage && <div className="notice notice--info" role="status"><span>◇</span><div>{props.storageMessage}</div></div>}
        <p className="privacy-note">Everything stays on this device. One Million contains no analytics, advertising, accounts, telemetry, or gameplay-time network service.</p>
      </div>
    </main>
  );
}
