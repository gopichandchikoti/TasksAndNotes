import { useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { useText } from '../content';

export function PwaNotice({ editing }: { editing: boolean }) {
  const t = useText();
  const [failed, setFailed] = useState(false);
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisterError: () => setFailed(true),
  });
  if (failed)
    return (
      <p className="banner" role="status">
        {t('pwa.error')}
      </p>
    );
  if (!needRefresh) return null;
  return (
    <div className="banner" role="status">
      {t('pwa.ready')}
      <button disabled={editing} onClick={() => void updateServiceWorker(true).catch(() => setFailed(true))}>
        {t('pwa.reload')}
      </button>
    </div>
  );
}
