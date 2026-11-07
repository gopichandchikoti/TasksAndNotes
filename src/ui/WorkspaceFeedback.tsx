import { X } from 'lucide-react';
import { useText } from '../content';
import type { WorkspaceController } from '../hooks/useWorkspaceController';

export function WorkspaceFeedback({ controller: c }: { controller: WorkspaceController }) {
  const t = useText();
  if (!c.message) return null;
  return (
    <div className="toast" role="status">
      <span className="local-dot" aria-hidden="true" />
      {t(c.message)}
      {c.undo && (
        <button disabled={c.busy} onClick={c.undoLast}>
          {t('common.undo')}
        </button>
      )}
      <button className="icon-button" aria-label={t('common.close')} onClick={() => c.setMessage(undefined)}>
        <X size={16} />
      </button>
    </div>
  );
}
