import type { ToastMessage } from '../app/types';

export function ToastRegion({ messages, onDismiss }: { messages: readonly ToastMessage[]; onDismiss: (id: string) => void }) {
  return <div className="toast-region" aria-live="polite" aria-atomic="false">{messages.map((message) => <div className={`toast toast--${message.kind}`} key={message.id}><span>{message.kind === 'success' ? '✓' : message.kind === 'error' ? '!' : message.kind === 'warning' ? '⚠' : '◇'}</span><p>{message.message}</p><button type="button" onClick={() => onDismiss(message.id)} aria-label="Dismiss notification">×</button></div>)}</div>;
}
