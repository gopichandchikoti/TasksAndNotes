import { useEffect, useState } from 'react';
import { db } from '../db/database';
import { deliverReminders } from '../platform/reminders';
import { useText, type ContentKey } from '../content';

export function usePlatform(theme: 'light' | 'dark' | 'system') {
  const [online, setOnline] = useState(navigator.onLine);
  const [error, setError] = useState<ContentKey>();
  const t = useText();
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      document.documentElement.dataset.theme = theme === 'system' ? (media.matches ? 'dark' : 'light') : theme;
    };
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [theme]);
  const reminderTitle = t('reminder.title');
  useEffect(() => {
    async function check() {
      if (!('Notification' in window) || Notification.permission !== 'granted') return;
      try {
        await deliverReminders(
          db,
          (task) =>
            new Notification(reminderTitle, {
              body: task.title,
              tag: task.id,
              icon: `${import.meta.env.BASE_URL}icon-192.png`,
            }),
        );
      } catch {
        setError('error.notifications');
      }
    }
    void check();
    const timer = setInterval(() => void check(), 15000);
    document.addEventListener('visibilitychange', check);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', check);
    };
  }, [reminderTitle]);
  return { online, error };
}
