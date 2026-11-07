import { useRef, useState } from 'react';
import { db } from '../db/database';
import { Repository, type Action, type Undo } from '../db/repository';
import { selectEntries, type Query, type View } from '../domain/query';
import { errorKey } from '../domain/errors';
import { newNote, newTask } from '../domain/factory';
import type { Entry, Task } from '../models/task';
import type { ContentKey } from '../content';
import type { Workspace } from './useWorkspace';
import { useShortcuts } from './useShortcuts';

export const repository = new Repository(db);
export const initialQuery: Query = {
  view: 'inbox',
  search: '',
  project: '',
  tag: '',
  priority: '',
  showCompleted: true,
};

export function useWorkspaceController(data: Workspace) {
  const [query, setQuery] = useState(initialQuery);
  const [navOpen, setNavOpen] = useState(false);
  const [editor, setEditor] = useState<{ entry: Entry; existing: boolean }>();
  const [quick, setQuick] = useState('');
  const [selected, setSelected] = useState(new Set<string>());
  const [undo, setUndo] = useState<Undo>();
  const [message, setMessage] = useState<ContentKey>();
  const [error, setError] = useState<ContentKey>();
  const [busy, setBusy] = useState(false);
  const locked = useRef(false);
  const search = useRef<HTMLInputElement>(null);
  const entries = selectEntries(
    [...data.tasks, ...data.notes],
    { ...query, showCompleted: data.settings.showCompleted },
    data.projects,
    new Date().toISOString(),
  );
  const tags = [...new Set([...data.tasks, ...data.notes].flatMap((entry) => entry.tags))].sort();

  function changeQuery(value: Query) {
    setQuery(value);
    setSelected(new Set());
  }
  function navigate(view: View) {
    changeQuery({ ...initialQuery, view });
    setNavOpen(false);
  }
  function chooseProject(id: string) {
    changeQuery({ ...initialQuery, view: 'all', project: id });
    setNavOpen(false);
  }
  function newTaskEditor() {
    setEditor({ entry: capture(data.tasks, query), existing: false });
  }
  function newNoteEditor() {
    navigate('notes');
    setEditor({ entry: newNote(), existing: false });
  }
  useShortcuts({ search, newTask: newTaskEditor, newNote: newNoteEditor, editing: Boolean(editor) });

  async function run(operation: () => Promise<void>) {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setError(undefined);
    try {
      await operation();
    } catch (failure) {
      setError(errorKey(failure));
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  function act(values: Entry[], action: Action) {
    void run(async () => {
      setUndo(await repository.apply(values, action));
      setSelected(new Set());
      setMessage('common.changed');
    });
  }
  function addQuick() {
    void run(async () => {
      await repository.save('tasks', { ...capture(data.tasks, query), title: quick });
      setQuick('');
    });
  }
  function undoLast() {
    if (!undo) return;
    void run(async () => {
      await repository.undo(undo);
      setUndo(undefined);
      setMessage(undefined);
    });
  }
  function select(id: string) {
    setSelected((value) => {
      const next = new Set(value);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  return {
    query,
    changeQuery,
    navigate,
    chooseProject,
    navOpen,
    setNavOpen,
    editor,
    setEditor,
    quick,
    setQuick,
    selected,
    select,
    message,
    setMessage,
    error,
    setError,
    busy,
    search,
    entries,
    tags,
    newTaskEditor,
    newNoteEditor,
    act,
    addQuick,
    undoLast,
    undo,
    move: (first: string, second: string) => void run(() => repository.reorder(first, second)),
  };
}

function capture(tasks: Task[], query: Query): Task {
  const maximumOrder = tasks.reduce((maximum, task) => Math.max(maximum, task.order), 0);
  const task = newTask(maximumOrder + 1, query.project || undefined);
  if (query.view === 'today') task.dueAt = new Date().toISOString();
  if (query.view === 'upcoming') {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    task.dueAt = tomorrow.toISOString();
  }
  return task;
}

export type WorkspaceController = ReturnType<typeof useWorkspaceController>;
