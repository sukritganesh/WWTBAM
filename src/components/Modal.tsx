import { useEffect, useId, useRef, type ReactNode } from 'react';

interface ModalProps {
  title: string;
  children: ReactNode;
  actions?: ReactNode;
  onClose?: () => void;
  destructive?: boolean;
  wide?: boolean;
}

export function Modal({ title, children, actions, onClose, destructive = false, wide = false }: ModalProps) {
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    panel.current?.querySelector<HTMLElement>('button, input, select, textarea, [tabindex="0"]')?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && onClose) {
        event.stopPropagation();
        onClose();
      }
      if (event.key !== 'Tab' || !panel.current) return;
      const focusable = [...panel.current.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]')];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      previouslyFocused?.focus();
    };
  }, [onClose]);

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose?.()}>
      <div ref={panel} className={`modal ${wide ? 'modal--wide' : ''} ${destructive ? 'modal--danger' : ''}`} role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div className="modal__scan" aria-hidden="true" />
        <header className="modal__header">
          <span className="kicker">System confirmation</span>
          <h2 id={titleId}>{title}</h2>
          {onClose && <button type="button" className="icon-button" aria-label="Close dialog" onClick={onClose}>×</button>}
        </header>
        <div className="modal__body">{children}</div>
        {actions && <footer className="modal__actions">{actions}</footer>}
      </div>
    </div>
  );
}
