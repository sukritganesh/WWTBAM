export function HelpContent() {
  return (
    <div className="help-sections">
      <section>
        <span className="help-index">01</span>
        <div><h3>Climb fifteen levels</h3><p>Choose one of four answers at every level. Select freely, then use <strong>Lock In Answer</strong> and confirm your final answer. A selection is never submitted automatically.</p></div>
      </section>
      <section>
        <span className="help-index">02</span>
        <div><h3>Protect your winnings</h3><p>Question 5 secures $1,000 and Question 10 secures $32,000. A wrong answer falls to the latest checkpoint. Walk away before locking to keep the full value of your last correct answer.</p></div>
      </section>
      <section>
        <span className="help-index">03</span>
        <div><h3>Use two lifelines</h3><p><strong>Hint</strong> reveals a handcrafted clue. <strong>Phone a Friend</strong> starts one real-world 60-second call window. Each is single-use. Pausing or opening Help during a call ends it immediately.</p></div>
      </section>
      <section>
        <span className="help-index">04</span>
        <div><h3>Your run is protected</h3><p>The current run autosaves locally after meaningful changes. There is one global save across all profiles and Guest; only its owner can resume it. A confirmed new run replaces that slot.</p></div>
      </section>
      <section>
        <span className="help-index">05</span>
        <div><h3>Keyboard controls</h3><p>Use <kbd>A</kbd>, <kbd>B</kbd>, <kbd>C</kbd>, or <kbd>D</kbd> to select an answer. <kbd>Enter</kbd> activates the focused control. <kbd>Escape</kbd> closes safe dialogs or pauses ordinary gameplay. Confirmations can never be bypassed by a shortcut.</p></div>
      </section>
      <section>
        <span className="help-index">06</span>
        <div><h3>Local and offline</h3><p>Profiles, history, content packs, and saves stay on this device in IndexedDB. Export backups from Settings. Once the PWA reports offline ready, the complete built-in game can launch without a connection.</p></div>
      </section>
    </div>
  );
}
