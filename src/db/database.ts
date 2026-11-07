import Dexie, { type EntityTable } from 'dexie';
import type { Task, Note, Project, Settings } from '../models/task';

export class ProductivityDatabase extends Dexie {
  tasks!: EntityTable<Task, 'id'>;
  notes!: EntityTable<Note, 'id'>;
  projects!: EntityTable<Project, 'id'>;
  settings!: EntityTable<Settings, 'id'>;

  constructor(name = 'ProductivityDB') {
    super(name);
    this.version(1).stores({
      tasks: 'id, projectId, status, priority, dueAt, order, createdAt',
      notes: 'id, pinned, createdAt, *tags',
      projects: 'id, name',
    });
    this.version(2)
      .stores({
        tasks: 'id, projectId, status, priority, dueAt, order, createdAt, *tags',
        notes: 'id, createdAt, *tags',
        projects: 'id, name',
        settings: 'id',
      })
      .upgrade((transaction) =>
        transaction
          .table('notes')
          .toCollection()
          .modify((note) => {
            note.format = 'markdown';
            note.archived = false;
          }),
      );
  }
}

export const db = new ProductivityDatabase();
