import { isTask, type Entry, type Project, type Task } from '../models/task';
import { dayKey } from './dates';

export const views = [
  'inbox',
  'today',
  'upcoming',
  'all',
  'notes',
  'projects',
  'archive',
  'trash',
  'settings',
] as const;
export type View = (typeof views)[number];
export interface Query {
  view: View;
  search: string;
  project: string;
  tag: string;
  priority: string;
  showCompleted: boolean;
}

export function matchesView(entry: Entry, view: View, now: string): boolean {
  if (view === 'trash') return Boolean(entry.deletedAt);
  if (entry.deletedAt) return false;
  const archived = isTask(entry) ? entry.status === 'archived' : entry.archived;
  if (view === 'archive') return archived;
  if (archived) return false;
  if (!isTask(entry)) return view === 'notes';
  return matchesTaskView(entry, view, now);
}

function matchesTaskView(entry: Task, view: View, now: string): boolean {
  if (view === 'notes') return false;
  if (view === 'inbox') return !entry.projectId;
  if (view === 'today') return Boolean(entry.dueAt && dayKey(entry.dueAt) <= dayKey(now));
  if (view === 'upcoming') return Boolean(entry.dueAt && dayKey(entry.dueAt) > dayKey(now));
  return true;
}

export function matchesSearch(entry: Entry, search: string, projects: Project[]): boolean {
  const project = isTask(entry) ? projects.find((item) => item.id === entry.projectId)?.name : '';
  const body = isTask(entry) ? [entry.description, ...entry.subtasks.map((item) => item.title)].join(' ') : entry.body;
  const text = [entry.title, body, project, ...entry.tags].join(' ').toLocaleLowerCase();
  return search
    .toLocaleLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => text.includes(word));
}

export function selectEntries(entries: Entry[], query: Query, projects: Project[], now: string): Entry[] {
  return entries
    .filter((entry) => {
      if (query.search) {
        if (entry.deletedAt) return false;
      } else if (!matchesView(entry, query.view, now)) return false;
      if (query.tag && !entry.tags.includes(query.tag)) return false;
      if (isTask(entry) && !matchesTask(entry, query)) return false;
      return matchesSearch(entry, query.search, projects);
    })
    .sort(compareEntries);
}

function matchesTask(task: Task, query: Query): boolean {
  if (query.project && task.projectId !== query.project) return false;
  if (query.priority && task.priority !== query.priority) return false;
  return query.showCompleted || task.status !== 'completed';
}

export function compareEntries(left: Entry, right: Entry): number {
  if (isTask(left) && isTask(right)) return left.order - right.order || left.id.localeCompare(right.id);
  if (!isTask(left) && !isTask(right)) {
    return Number(right.pinned) - Number(left.pinned) || right.updatedAt.localeCompare(left.updatedAt);
  }
  return isTask(left) ? -1 : 1;
}
