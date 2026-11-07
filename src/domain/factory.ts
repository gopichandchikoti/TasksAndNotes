import type { Note, Task } from '../models/task';

function base() {
  const now = new Date().toISOString();
  return { id: crypto.randomUUID(), title: '', createdAt: now, updatedAt: now, tags: [] };
}

export function newTask(order: number, projectId?: string): Task {
  return { ...base(), status: 'todo', priority: 'medium', subtasks: [], order, projectId };
}

export function newNote(): Note {
  return { ...base(), body: '', format: 'markdown', pinned: false, archived: false };
}
