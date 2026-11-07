import { useRef, useState } from 'react';
import { Download, Upload, Bell, Monitor } from 'lucide-react';
import { useText, type ContentKey } from '../../content';
import { db } from '../../db/database';
import { exportBackup, importBackup, MAX_BACKUP_BYTES } from '../../db/backup';
import { settingsSchema, type Settings } from '../../models/task';
import { download } from '../../platform/download';
import { errorKey } from '../../domain/errors';
import { Field } from '../../ui/Field';

export function SettingsView({ settings }: { settings: Settings }) {
  const t = useText();
  const [message, setMessage] = useState('');
  const [error, setError] = useState<ContentKey>();
  const [busy, setBusy] = useState(false);
  const [permission, setPermission] = useState('Notification' in window ? Notification.permission : 'unsupported');
  const input = useRef<HTMLInputElement>(null);
  async function run(operation: () => Promise<void>) {
    setBusy(true);
    setError(undefined);
    try {
      await operation();
    } catch (failure) {
      setError(errorKey(failure));
    } finally {
      setBusy(false);
    }
  }
  function update(patch: Partial<Settings>) {
    void run(async () => {
      await db.settings.put(settingsSchema.parse({ ...settings, ...patch }));
    });
  }
  async function backup() {
    download(await exportBackup(db), t('backup.filename'));
    setMessage(t('settings.exported'));
  }
  async function restore(file: File) {
    if (file.size > MAX_BACKUP_BYTES) {
      setError('error.size');
      return;
    }
    await run(async () => {
      const count = await importBackup(db, await file.text());
      setMessage(t('settings.imported', { count: new Intl.NumberFormat(settings.locale).format(count) }));
    });
  }
  return (
    <div className="settings-view">
      <section>
        <h2>
          <Monitor size={20} />
          {t('settings.appearance')}
        </h2>
        <div className="field-grid">
          <Field label={t('settings.theme')}>
            {(id) => (
              <select
                id={id}
                value={settings.theme}
                disabled={busy}
                onChange={(event) => {
                  const value = settingsSchema.shape.theme.safeParse(event.target.value);
                  if (value.success) update({ theme: value.data });
                }}
              >
                {(['light', 'dark', 'system'] as const).map((key) => (
                  <option value={key} key={key}>
                    {t(`settings.${key}`)}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label={t('settings.language')}>
            {(id) => (
              <select
                id={id}
                value={settings.locale}
                disabled={busy}
                onChange={(event) => {
                  const value = settingsSchema.shape.locale.safeParse(event.target.value);
                  if (value.success) update({ locale: value.data });
                }}
              >
                <option value="en">{t('settings.english')}</option>
                <option value="es">{t('settings.spanish')}</option>
              </select>
            )}
          </Field>
        </div>
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={settings.showCompleted}
            disabled={busy}
            onChange={(event) => update({ showCompleted: event.target.checked })}
          />
          {t('settings.completed')}
        </label>
      </section>
      <section>
        <h2>
          <Download size={20} />
          {t('settings.backup')}
        </h2>
        <p>{t('settings.privacy')}</p>
        <p className="small muted">{t('settings.importHelp')}</p>
        <div className="button-row">
          <button disabled={busy} onClick={() => void run(backup)}>
            <Download size={17} />
            {t('settings.export')}
          </button>
          <button disabled={busy} onClick={() => input.current?.click()}>
            <Upload size={17} />
            {t('settings.import')}
          </button>
        </div>
        <input
          ref={input}
          type="file"
          accept=".json,application/json"
          hidden
          aria-label={t('settings.import')}
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (file) void restore(file);
          }}
        />
      </section>
      <section>
        <h2>
          <Bell size={20} />
          {t('settings.notifications')}
        </h2>
        <p>{t('settings.notifyHelp')}</p>
        <p className="small muted">{t('settings.permission', { state: t(permissionKey(permission)) })}</p>
        <button
          disabled={permission !== 'default'}
          onClick={() =>
            void run(async () => {
              setPermission(await Notification.requestPermission());
            })
          }
        >
          {t('settings.enable')}
        </button>
      </section>
      <section>
        <h2>{t('settings.install')}</h2>
        <p>{t('settings.installHelp')}</p>
      </section>
      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}
      {error && (
        <p className="error" role="alert">
          {t(error)}
        </p>
      )}
    </div>
  );
}

function permissionKey(permission: string): ContentKey {
  if (permission === 'granted') return 'permission.granted';
  if (permission === 'denied') return 'permission.denied';
  return permission === 'default' ? 'permission.default' : 'permission.unsupported';
}
