import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import Dexie from 'dexie';
import { ProductivityDatabase } from '../src/db/database';
import { Repository } from '../src/db/repository';
import { exportBackup, importBackup, parseBackup } from '../src/db/backup';
import { newNote, newTask } from '../src/domain/factory';

let database: ProductivityDatabase;
let repository: Repository;
beforeEach(() => {
  database = new ProductivityDatabase(crypto.randomUUID());
  repository = new Repository(database);
});
afterEach(async () => database.delete());
const task = () => ({ ...newTask(0), title: 'Write acceptance checks' });
const note = () => ({ ...newNote(), title: 'Research', body: '# A thought', tags: ['work'] });

describe('transactional persistence', () => {
  it('validates, saves, completes, undoes, trashes and restores records', async () => {
    const original = task();
    await repository.save('tasks', original);
    const completed = await repository.apply([original], 'complete');
    expect(await database.tasks.get(original.id)).toMatchObject({ status: 'completed' });
    await repository.undo(completed);
    const restored = await database.tasks.get(original.id);
    expect(restored?.status).toBe('todo');
    if (!restored) throw new Error('Missing task');
    const trashed = await repository.apply([restored], 'trash');
    expect(trashed.after[0].deletedAt).toBeTruthy();
    const recovered = await repository.apply(trashed.after, 'restore');
    expect(recovered.after[0].deletedAt).toBeUndefined();
    await expect(repository.save('tasks', { ...original, title: '' })).rejects.toThrow();
  });

  it('detects duplicate/stale actions and atomically rolls back a bulk action', async () => {
    const first = task();
    const second = { ...task(), order: 1 };
    await database.tasks.bulkAdd([first, second]);
    await repository.apply([second], 'complete');
    await expect(repository.apply([first, second], 'trash')).rejects.toThrow();
    expect((await database.tasks.get(first.id))?.deletedAt).toBeUndefined();
    await expect(repository.save('tasks', second, second.updatedAt)).rejects.toThrow();
  });

  it('preserves notes across archive and restore and rejects missing projects', async () => {
    const original = note();
    await repository.save('notes', original);
    const archived = await repository.apply([original], 'archive');
    expect(archived.after[0]).toMatchObject({ archived: true });
    expect((await repository.apply(archived.after, 'restore')).after[0]).toMatchObject({ archived: false });
    await expect(repository.save('tasks', { ...task(), projectId: crypto.randomUUID() })).rejects.toThrow();
  });
});

describe('backups and migration', () => {
  it('round-trips safely, deduplicates exact records and preserves conflicting content', async () => {
    const original = task();
    await repository.save('tasks', original);
    await repository.save('notes', note());
    const backup = await exportBackup(database);
    expect(await importBackup(database, backup)).toBe(0);
    const target = new ProductivityDatabase(crypto.randomUUID());
    try {
      expect(await importBackup(target, backup)).toBe(2);
      expect((await target.notes.toArray())[0].tags).toEqual(['work']);
      await database.tasks.update(original.id, { title: 'Local content' });
      expect(await importBackup(database, backup)).toBe(1);
      expect(await database.tasks.count()).toBe(2);
    } finally {
      await target.delete();
    }
  });

  it('rejects malformed backups before making changes', async () => {
    await expect(importBackup(database, '{"tasks":[]}')).rejects.toThrow();
    expect(await database.tasks.count()).toBe(0);
    expect(() => parseBackup('not json')).toThrow();
  });

  it('upgrades a real v1 Dexie schema without losing notes', async () => {
    const name = crypto.randomUUID();
    const legacy = new Dexie(name);
    legacy.version(1).stores({
      tasks: 'id, projectId, status, priority, dueAt, order, createdAt',
      notes: 'id, pinned, createdAt, *tags',
      projects: 'id, name',
    });
    const { format: ignoredFormat, archived: ignoredArchive, ...original } = note();
    expect(ignoredFormat).toBe('markdown');
    expect(ignoredArchive).toBe(false);
    await legacy.table('notes').add(original);
    legacy.close();
    const upgraded = new ProductivityDatabase(name);
    try {
      expect(await upgraded.notes.get(original.id)).toMatchObject({ ...original, format: 'markdown', archived: false });
    } finally {
      await upgraded.delete();
    }
  });
});
