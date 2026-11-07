import { useCallback, useEffect, useRef, useState } from 'react';
import type { Entry } from '../models/task';
import { nextTimestamp } from '../db/repository';
import { errorKey } from '../domain/errors';
import type { ContentKey } from '../content';

type Save = (value: Entry, expected?: string) => Promise<Entry>;
export function useDraft<T extends Entry>(initial: T, persist: Save, autosave: boolean, existing: boolean) {
  const [draft, setValue] = useState(initial);
  const [status, setStatus] = useState<ContentKey>(existing ? 'common.saved' : 'common.unsaved');
  const [error, setError] = useState<ContentKey>();
  const saved = useRef(initial);
  const latest = useRef(initial);
  const exists = useRef(existing);
  const queue = useRef(Promise.resolve(true));

  const change = useCallback((value: T) => {
    latest.current = value;
    setValue(value);
    setStatus('common.unsaved');
  }, []);

  const save = useCallback((): Promise<boolean> => {
    const operation = async () => {
      const snapshot = latest.current;
      if (snapshot === saved.current && exists.current) return true;
      setStatus('common.saving');
      try {
        const value = { ...snapshot, updatedAt: nextTimestamp(saved.current.updatedAt) };
        await persist(value, exists.current ? saved.current.updatedAt : undefined);
        saved.current = value;
        exists.current = true;
        if (latest.current === snapshot) {
          latest.current = value;
          setValue(value);
        }
        setStatus('common.saved');
        setError(undefined);
        return true;
      } catch (failure) {
        setError(errorKey(failure));
        setStatus('common.unsaved');
        return false;
      }
    };
    queue.current = queue.current.then(operation);
    return queue.current;
  }, [persist]);

  useEffect(() => {
    if (!autosave || !draft.title.trim() || draft === saved.current) return;
    const timer = setTimeout(() => {
      void save();
    }, 650);
    return () => clearTimeout(timer);
  }, [autosave, draft, save]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (latest.current === saved.current) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, []);
  return { draft, change, save, status, error, dirty: draft !== saved.current };
}
