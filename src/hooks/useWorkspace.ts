import { useEffect, useState } from 'react';
import { liveQuery } from 'dexie';
import { db } from '../db/database';
import { defaultSettings, type Note, type Project, type Settings, type Task } from '../models/task';
import { resolveLocale } from '../content';

export interface Workspace {
  tasks: Task[];
  notes: Note[];
  projects: Project[];
  settings: Settings;
}
export function useWorkspace() {
  const [data, setData] = useState<Workspace>();
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const subscription = liveQuery(async () => {
      const [tasks, notes, projects, saved] = await Promise.all([
        db.tasks.toArray(),
        db.notes.toArray(),
        db.projects.toArray(),
        db.settings.get('preferences'),
      ]);
      return { tasks, notes, projects, settings: saved ?? { ...defaultSettings, locale: resolveLocale() } };
    }).subscribe({
      next: (value) => {
        setData(value);
        setFailed(false);
      },
      error: () => setFailed(true),
    });
    return () => subscription.unsubscribe();
  }, [attempt]);
  return {
    data,
    failed,
    retry: () => {
      setFailed(false);
      setAttempt((value) => value + 1);
    },
  };
}
