import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ProductivityDatabase } from '../src/db/database';
import { Repository } from '../src/db/repository';
import { exportBackup, importBackup, MAX_BACKUP_BYTES, parseBackup } from '../src/db/backup';
import { newNote, newTask } from '../src/domain/factory';
import { defaultSettings } from '../src/models/task';
import { deliverReminders } from '../src/platform/reminders';

let database: ProductivityDatabase;
let repository: Repository;
beforeEach(() => {
  database = new ProductivityDatabase(crypto.randomUUID());
  repository = new Repository(database);
});
afterEach(async () => database.delete());
const task = () => ({ ...newTask(0), title: 'A task' });
const note = () => ({ ...newNote(), title: 'A note' });

it('handles stale/missing undo, missing reorder targets and colliding order values', async () => {
  const first = task();
  const second = task();
  await database.tasks.bulkAdd([first, second]);
  await repository.reorder(first.id, second.id);
  expect((await database.tasks.get(first.id))?.order).not.toBe((await database.tasks.get(second.id))?.order);
  await repository.reorder(first.id, first.id);
  await repository.reorder('missing', second.id);
  await repository.reorder(first.id, 'missing');
  const current = await database.tasks.get(first.id);
  if (!current) throw new Error('Missing fixture');
  const change = await repository.apply([current], 'finish');
  const again = await repository.apply(change.after, 'finish');
  expect(again.after[0]).toMatchObject({ status: 'completed' });
  await expect(repository.undo(change)).rejects.toThrow();
  await database.tasks.delete(first.id);
  await expect(repository.undo(again)).rejects.toThrow();
  await expect(repository.apply([first], 'trash')).rejects.toThrow();
});

it('round-trips projects and settings, copying conflicting tasks, notes and project references', async () => {
  const project = { id: crypto.randomUUID(), name: 'Original', color: '#112233' };
  const original = { ...task(), projectId: project.id };
  const thought = note();
  await repository.saveProject(project);
  await repository.save('tasks', original);
  await repository.save('notes', thought);
  await database.settings.put(defaultSettings);
  const backup = await exportBackup(database);
  expect(await importBackup(database, backup)).toBe(0);
  await database.projects.update(project.id, { name: 'Local project' });
  await database.notes.update(thought.id, { body: 'Keep local content' });
  expect(await importBackup(database, backup)).toBe(3);
  expect(await database.notes.count()).toBe(2);
  expect(await database.projects.count()).toBe(2);
  const imported = (await database.tasks.toArray()).find((entry) => entry.id !== original.id);
  expect(imported?.projectId).not.toBe(project.id);
  expect(await database.projects.get(imported?.projectId ?? '')).toMatchObject({ name: 'Original' });
});

it('rejects duplicate identifiers, invalid references and oversized content atomically', async () => {
  await repository.save('tasks', task());
  const backup = JSON.parse(await exportBackup(database));
  expect(() => parseBackup(JSON.stringify({ ...backup, tasks: [...backup.tasks, backup.tasks[0]] }))).toThrow();
  expect(() =>
    parseBackup(JSON.stringify({ ...backup, tasks: [{ ...backup.tasks[0], projectId: crypto.randomUUID() }] })),
  ).toThrow();
  expect(() => parseBackup(' '.repeat(MAX_BACKUP_BYTES + 1))).toThrow();
  const invalid = JSON.stringify({ ...backup, tasks: [{ ...backup.tasks[0], dueAt: '2026-02-30' }] });
  await expect(importBackup(database, invalid)).rejects.toThrow();
  expect(await database.tasks.count()).toBe(1);
});

it('keeps identifiers unique when an import collides with a different record kind', async () => {
  const original = note();
  await repository.save('notes', original);
  const backup = {
    schemaVersion: 2,
    exportedAt: new Date().toISOString(),
    tasks: [{ ...task(), id: original.id }],
    notes: [],
    projects: [],
    settings: [],
  };
  expect(await importBackup(database, JSON.stringify(backup))).toBe(1);
  expect((await database.tasks.toArray())[0].id).not.toBe(original.id);
  expect(await database.notes.count()).toBe(1);
});

it('delivers reminders once, suppresses inactive tasks and rolls back delivery bookkeeping on failure', async () => {
  const past = '2026-01-01T00:00:00.000Z';
  const now = '2026-11-06T14:00:00.000Z';
  const ready = { ...task(), reminderAt: past };
  await database.tasks.bulkAdd([
    ready,
    { ...task(), reminderAt: '2099-01-01T00:00:00.000Z' },
    { ...task(), reminderAt: past, deletedAt: past },
    { ...task(), reminderAt: past, status: 'completed' },
    { ...task(), reminderAt: past, status: 'archived' },
    task(),
  ]);
  const notify = vi.fn();
  expect(await deliverReminders(database, notify, now)).toBe(1);
  expect(await deliverReminders(database, notify, now)).toBe(0);
  expect(notify).toHaveBeenCalledTimes(1);
  const saved = await database.tasks.get(ready.id);
  if (!saved) throw new Error('Missing fixture');
  await repository.save('tasks', { ...saved, title: 'Edited', notifiedAt: undefined }, saved.updatedAt);
  expect((await database.tasks.get(ready.id))?.notifiedAt).toBe(now);
  await repository.save(
    'tasks',
    { ...saved, reminderAt: '2026-02-01T00:00:00.000Z', notifiedAt: undefined },
    saved.updatedAt,
  );
  await expect(
    deliverReminders(
      database,
      () => {
        throw new Error('Platform unavailable');
      },
      now,
    ),
  ).rejects.toThrow();
  expect((await database.tasks.get(ready.id))?.notifiedAt).toBeUndefined();
  expect(await deliverReminders(database, notify)).toBe(1);
});
