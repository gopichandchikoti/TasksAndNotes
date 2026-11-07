import type { ProductivityDatabase } from '../db/database';
import type { Task } from '../models/task';

export async function deliverReminders(
  database: ProductivityDatabase,
  notify: (task: Task) => void,
  now = new Date().toISOString(),
): Promise<number> {
  return database.transaction('rw', database.tasks, async () => {
    const tasks = await database.tasks.toArray();
    const due = tasks.filter(
      (task) =>
        !task.deletedAt &&
        task.status !== 'archived' &&
        task.status !== 'completed' &&
        task.reminderAt &&
        task.reminderAt <= now &&
        (!task.notifiedAt || task.notifiedAt < task.reminderAt),
    );
    for (const task of due) {
      notify(task);
      // Delivery bookkeeping does not invalidate the user's editor revision.
      await database.tasks.update(task.id, { notifiedAt: now });
    }
    return due.length;
  });
}
