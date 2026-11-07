import { z } from 'zod';

const id = z.string().uuid();
const timestamp = z.iso.datetime();
const title = z.string().trim().min(1).max(240);
const tags = z.array(z.string().trim().min(1).max(40)).max(30);
const base = { id, title, createdAt: timestamp, updatedAt: timestamp, deletedAt: timestamp.optional() };
export const priorities = ['urgent', 'high', 'medium', 'low'] as const;
export const statuses = ['todo', 'in_progress', 'completed', 'archived'] as const;
export const subtaskSchema = z.object({ id, title, completed: z.boolean() }).strict();
export const taskSchema = z
  .object({
    ...base,
    projectId: id.optional(),
    description: z.string().max(100000).optional(),
    status: z.enum(statuses),
    priority: z.enum(priorities),
    dueAt: timestamp.optional(),
    reminderAt: timestamp.optional(),
    notifiedAt: timestamp.optional(),
    subtasks: z.array(subtaskSchema).max(100),
    tags,
    order: z.number().finite().nonnegative(),
  })
  .strict();
export const noteSchema = z
  .object({
    ...base,
    body: z.string().max(1000000),
    format: z.literal('markdown').default('markdown'),
    tags,
    pinned: z.boolean(),
    archived: z.boolean().default(false),
  })
  .strict();
export const projectSchema = z
  .object({
    id,
    name: z.string().trim().min(1).max(80),
    color: z.string().regex(/^#[\da-f]{6}$/i),
  })
  .strict();
export const settingsSchema = z
  .object({
    id: z.literal('preferences'),
    locale: z.enum(['en', 'es']),
    theme: z.enum(['light', 'dark', 'system']),
    showCompleted: z.boolean(),
  })
  .strict();
export type Task = z.infer<typeof taskSchema>;
export type Note = z.infer<typeof noteSchema>;
export type Project = z.infer<typeof projectSchema>;
export type Settings = z.infer<typeof settingsSchema>;
export type Priority = Task['priority'];
export type TaskStatus = Task['status'];
export type Subtask = z.infer<typeof subtaskSchema>;
export type Entry = Task | Note;
export type EntryKind = 'tasks' | 'notes';
export const defaultSettings: Settings = {
  id: 'preferences',
  locale: 'en',
  theme: 'system',
  showCompleted: true,
};

export function parseTags(value: string): string[] {
  return [
    ...new Set(
      value
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean),
    ),
  ];
}

export function isTask(entry: Entry): entry is Task {
  return 'status' in entry;
}
