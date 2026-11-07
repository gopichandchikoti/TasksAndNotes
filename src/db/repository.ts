import { ProductivityDatabase } from './database';
import { isTask, noteSchema, projectSchema, taskSchema, type Entry, type EntryKind } from '../models/task';
import { t } from '../content';

export interface Undo {
  before: Entry[];
  after: Entry[];
}
export type Action = 'complete' | 'finish' | 'archive' | 'trash' | 'restore';

export class Repository {
  constructor(readonly database: ProductivityDatabase) {}

  async save(kind: EntryKind, value: unknown, expectedUpdatedAt?: string): Promise<Entry> {
    const entry = kind === 'tasks' ? taskSchema.parse(value) : noteSchema.parse(value);
    return this.database.transaction('rw', this.database[kind], this.database.projects, async () => {
      const previous = await this.database[kind].get(entry.id);
      if (expectedUpdatedAt && previous?.updatedAt !== expectedUpdatedAt) throw new Error(t('error.conflict'));
      if (isTask(entry) && entry.projectId && !(await this.database.projects.get(entry.projectId))) {
        throw new Error(t('error.project'));
      }
      const saved = preserveDelivery(entry, previous);
      await this.put(saved);
      return saved;
    });
  }

  async apply(entries: Entry[], action: Action): Promise<Undo> {
    const before: Entry[] = [];
    const after: Entry[] = [];
    await this.database.transaction('rw', this.database.tasks, this.database.notes, async () => {
      for (const entry of entries) {
        const table = isTask(entry) ? this.database.tasks : this.database.notes;
        const current = await table.get(entry.id);
        if (!current || current.updatedAt !== entry.updatedAt) throw new Error(t('error.conflict'));
        const changed = transition(current, action);
        before.push(current);
        after.push(changed);
        await this.put(changed);
      }
    });
    return { before, after };
  }

  async undo(change: Undo): Promise<void> {
    await this.database.transaction('rw', this.database.tasks, this.database.notes, async () => {
      for (const [index, after] of change.after.entries()) {
        const table = isTask(after) ? this.database.tasks : this.database.notes;
        const current = await table.get(after.id);
        if (current?.updatedAt !== after.updatedAt) throw new Error(t('error.conflict'));
        await this.put(
          preserveDelivery({ ...change.before[index], updatedAt: nextTimestamp(current.updatedAt) }, current),
        );
      }
    });
  }

  async reorder(first: string, second: string): Promise<void> {
    await this.database.transaction('rw', this.database.tasks, async () => {
      const tasks = (await this.database.tasks.toArray()).sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
      const left = tasks.findIndex((task) => task.id === first);
      const right = tasks.findIndex((task) => task.id === second);
      if (left < 0 || right < 0 || left === right) return;
      [tasks[left], tasks[right]] = [tasks[right], tasks[left]];
      await this.database.tasks.bulkPut(
        tasks.map((task, index) => ({
          ...task,
          order: index,
          updatedAt: nextTimestamp(task.updatedAt),
        })),
      );
    });
  }

  async saveProject(value: unknown): Promise<void> {
    await this.database.projects.put(projectSchema.parse(value));
  }

  private async put(entry: Entry): Promise<void> {
    if (isTask(entry)) await this.database.tasks.put(entry);
    else await this.database.notes.put(entry);
  }
}

export function nextTimestamp(previous: string): string {
  return new Date(Math.max(Date.now(), new Date(previous).getTime() + 1)).toISOString();
}

export function transition(entry: Entry, action: Action): Entry {
  const changed = { ...entry, updatedAt: nextTimestamp(entry.updatedAt) };
  if (action === 'trash') return { ...changed, deletedAt: changed.updatedAt };
  if (action === 'restore') return restore(changed);
  if (action === 'archive') {
    return isTask(changed) ? { ...changed, status: 'archived' } : { ...changed, archived: true };
  }
  if (!isTask(changed) || changed.deletedAt || changed.status === 'archived') throw new Error(t('error.transition'));
  if (action === 'finish') return { ...changed, status: 'completed' };
  return { ...changed, status: changed.status === 'completed' ? 'todo' : 'completed' };
}

function restore(entry: Entry): Entry {
  if (entry.deletedAt) {
    delete entry.deletedAt;
    return entry;
  }
  return isTask(entry) ? { ...entry, status: 'todo' } : { ...entry, archived: false };
}

function preserveDelivery(entry: Entry, previous?: Entry): Entry {
  if (!isTask(entry) || !previous || !isTask(previous)) return entry;
  return entry.reminderAt === previous.reminderAt ? { ...entry, notifiedAt: previous.notifiedAt } : entry;
}
