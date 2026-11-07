import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { useText } from '../content';

export function Modal({
  title,
  close,
  children,
  wide = false,
}: {
  title: string;
  close: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const t = useText();
  useEffect(() => {
    const previous = document.activeElement;
    const dialog = ref.current;
    dialog?.showModal();
    dialog?.querySelector<HTMLElement>('input, textarea, select')?.focus();
    return () => {
      dialog?.close();
      if (previous instanceof HTMLElement) previous.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={wide ? 'modal wide' : 'modal'}
      aria-label={title}
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
    >
      <header className="modal-header">
        <h2>{title}</h2>
        <button type="button" className="icon-button" aria-label={t('common.close')} onClick={close}>
          <X />
        </button>
      </header>
      {children}
    </dialog>
  );
}
