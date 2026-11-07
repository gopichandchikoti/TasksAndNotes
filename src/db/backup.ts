import { z } from 'zod';
import { ProductivityDatabase } from './database';
import { taskSchema, noteSchema, projectSchema, settingsSchema } from '../models/task';
import { t } from '../content';

export const MAX_BACKUP_BYTES = 20 * 1024 * 1024;
export const backupSchema = z
  .object({
    schemaVersion: z.literal(2),
    exportedAt: z.iso.datetime(),
    tasks: z.array(taskSchema).max(50000),
    notes: z.array(noteSchema).max(50000),
    projects: z.array(projectSchema).max(1000),
    settings: z.array(settingsSchema).max(1),
  })
  .strict();
export type Backup = z.infer<typeof backupSchema>;

export function parseBackup(text: string): Backup {
  if (new TextEncoder().encode(text).byteLength > MAX_BACKUP_BYTES) throw new Error(t('error.size'));
  try {
    const backup = backupSchema.parse(JSON.parse(text));
    const ids = [...backup.tasks, ...backup.notes, ...backup.projects].map((record) => record.id);
    if (new Set(ids).size !== ids.length) throw new Error('Duplicate IDs');
    const projects = new Set(backup.projects.map((project) => project.id));
    if (backup.tasks.some((task) => task.projectId && !projects.has(task.projectId))) {
      throw new Error('Invalid project reference');
    }
    return backup;
  } catch {
    throw new Error(t('error.backup'));
  }
}

export async function exportBackup(database: ProductivityDatabase): Promise<string> {
  return database.transaction('r', database.tables, async () =>
    JSON.stringify(
      backupSchema.parse({
        schemaVersion: 2,
        exportedAt: new Date().toISOString(),
        tasks: await database.tasks.toArray(),
        notes: await database.notes.toArray(),
        projects: await database.projects.toArray(),
        settings: await database.settings.toArray(),
      }),
      null,
      2,
    ),
  );
}

export async function importBackup(database: ProductivityDatabase, text: string): Promise<number> {
  const backup = parseBackup(text);
  return database.transaction('rw', database.tables, async () => {
    let added = 0;
    const mapping = new Map<string, string>();
    for (const project of backup.projects) {
      const existing = await database.projects.get(project.id);
      const conflict = existing && JSON.stringify(projectSchema.parse(existing)) !== JSON.stringify(project);
      const id = conflict || (await collides(database, project.id, 'projects')) ? crypto.randomUUID() : project.id;
      mapping.set(project.id, id);
      if (!existing || id !== project.id) {
        await database.projects.add({ ...project, id });
        added++;
      }
    }
    added += await mergeTasks(database, backup, mapping);
    added += await mergeNotes(database, backup);
    // Preferences belong to this device. Import them only into a fresh workspace.
    if (!(await database.settings.count())) await database.settings.bulkAdd(backup.settings);
    return added;
  });
}

async function mergeTasks(database: ProductivityDatabase, backup: Backup, mapping: Map<string, string>) {
  let added = 0;
  for (const task of backup.tasks) {
    const normalized = { ...task, projectId: task.projectId ? mapping.get(task.projectId) : undefined };
    const existing = await database.tasks.get(task.id);
    if (existing && JSON.stringify(taskSchema.parse(existing)) === JSON.stringify(taskSchema.parse(normalized)))
      continue;
    const conflict = existing || (await collides(database, task.id, 'tasks'));
    await database.tasks.add({ ...normalized, id: conflict ? crypto.randomUUID() : task.id });
    added++;
  }
  return added;
}

async function mergeNotes(database: ProductivityDatabase, backup: Backup) {
  let added = 0;
  for (const note of backup.notes) {
    const existing = await database.notes.get(note.id);
    if (existing && JSON.stringify(noteSchema.parse(existing)) === JSON.stringify(note)) continue;
    const conflict = existing || (await collides(database, note.id, 'notes'));
    await database.notes.add({ ...note, id: conflict ? crypto.randomUUID() : note.id });
    added++;
  }
  return added;
}

async function collides(database: ProductivityDatabase, id: string, owner: 'tasks' | 'notes' | 'projects') {
  const others = (['tasks', 'notes', 'projects'] as const).filter((name) => name !== owner);
  return (await Promise.all(others.map((name) => database[name].get(id)))).some(Boolean);
}
