import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import model from '../public/tasksandnotes.model.json';
import { App } from '../src/App';
import { db } from '../src/db/database';
import { newNote, newTask } from '../src/domain/factory';
import { defaultSettings } from '../src/models/task';

vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: () => ({ needRefresh: [false], updateServiceWorker: vi.fn() }),
}));

beforeEach(async () => {
  await Promise.all(db.tables.map((table) => table.clear()));
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify(model))),
  );
  vi.stubGlobal(
    'confirm',
    vi.fn(() => true),
  );
});

async function start() {
  const user = userEvent.setup();
  render(<App />);
  await screen.findByRole('heading', { name: 'Inbox' });
  return user;
}
async function navigate(name: string) {
  await userEvent.click(within(screen.getByRole('navigation')).getByRole('button', { name }));
}

describe('workspace task workflow', () => {
  it('quick adds, completes, undoes, selects, archives, restores and trashes', async () => {
    const user = await start();
    await user.type(screen.getByRole('textbox', { name: 'What needs to get done?' }), 'Read a chapter');
    await user.click(screen.getByRole('button', { name: 'Add task' }));
    await screen.findByRole('button', { name: 'Read a chapter' });
    await user.click(screen.getByRole('button', { name: 'Toggle completion for Read a chapter' }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Toggle completion for Read a chapter' })).toHaveAttribute(
        'aria-pressed',
        'true',
      ),
    );
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Toggle completion for Read a chapter' })).toHaveAttribute(
        'aria-pressed',
        'false',
      ),
    );
    await user.click(screen.getByRole('checkbox', { name: 'Select Read a chapter' }));
    await user.click(screen.getByRole('button', { name: 'Complete selected tasks' }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Toggle completion for Read a chapter' })).toHaveAttribute(
        'aria-pressed',
        'true',
      ),
    );
    const group = screen.getByRole('group', { name: 'Actions for Read a chapter' });
    await user.click(within(group).getByRole('button', { name: 'Archive' }));
    await navigate('Archive');
    await user.click(await screen.findByRole('button', { name: 'Restore' }));
    await navigate('Inbox');
    await user.click(await screen.findByRole('button', { name: 'Read a chapter' }));
    const dialog = screen.getByRole('dialog');
    await user.clear(within(dialog).getByLabelText('Task title', { exact: true }));
    await user.type(within(dialog).getByLabelText('Task title', { exact: true }), 'Read two chapters');
    await user.click(within(dialog).getByRole('button', { name: 'Save changes' }));
    const changed = await screen.findByRole('group', { name: 'Actions for Read two chapters' });
    await user.click(within(changed).getByRole('button', { name: 'Move to trash' }));
    await navigate('Trash');
    await user.click(await screen.findByRole('button', { name: 'Restore' }));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Restore' })).not.toBeInTheDocument());
  });

  it('edits task metadata, checklist, local dates and preserves failed validation', async () => {
    const user = await start();
    await user.click(screen.getAllByRole('button', { name: 'New task' })[0]);
    const dialog = screen.getByRole('dialog');
    await user.type(within(dialog).getByLabelText('Task title', { exact: true }), 'Make a plan');
    await user.type(within(dialog).getByLabelText('Description', { exact: true }), 'A real description');
    await user.selectOptions(within(dialog).getByLabelText('Priority', { exact: true }), 'urgent');
    await user.selectOptions(within(dialog).getByLabelText('Status', { exact: true }), 'in_progress');
    fireEvent.change(within(dialog).getByLabelText('Due date & time'), { target: { value: '2026-11-07T14:30' } });
    fireEvent.change(within(dialog).getByLabelText('Reminder date & time'), { target: { value: '2026-11-07T14:00' } });
    await user.type(within(dialog).getByLabelText('Tags, separated by commas'), 'planning, personal');
    await user.click(within(dialog).getByRole('button', { name: 'Add checklist item' }));
    await user.type(within(dialog).getByRole('textbox', { name: 'Checklist item' }), 'First step');
    await user.click(within(dialog).getByRole('checkbox', { name: 'Toggle completion for First step' }));
    await user.click(within(dialog).getByRole('button', { name: 'Save changes' }));
    await waitFor(async () => expect(await db.tasks.count()).toBe(1));
    expect((await db.tasks.toArray())[0]).toMatchObject({
      status: 'in_progress',
      priority: 'urgent',
      tags: ['planning', 'personal'],
      subtasks: [{ title: 'First step', completed: true }],
    });
  });
});

describe('notes and workspace controls', () => {
  it('autosaves notes, previews Markdown, pins and searches content', async () => {
    const user = await start();
    await user.click(screen.getByRole('button', { name: 'New note' }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText('Note title', { exact: true }), 'A lasting thought');
    await user.type(within(dialog).getByRole('textbox', { name: 'Markdown body' }), '# Ideas\n\nGarden birds');
    await user.type(within(dialog).getByLabelText('Tags, separated by commas'), 'garden');
    await user.click(within(dialog).getByRole('button', { name: 'Bold' }));
    await user.click(within(dialog).getByRole('button', { name: 'Heading' }));
    await user.click(within(dialog).getByRole('button', { name: 'Checklist' }));
    await user.click(within(dialog).getByRole('button', { name: 'Link' }));
    await user.click(within(dialog).getByRole('button', { name: 'Preview' }));
    expect(within(dialog).getByRole('heading', { name: 'Ideas' })).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Pin note' }));
    await waitFor(async () => expect((await db.notes.toArray())[0]?.pinned).toBe(true), { timeout: 4000 });
    await user.click(within(dialog).getAllByRole('button', { name: 'Close' }).at(-1)!);
    await screen.findByRole('button', { name: 'A lasting thought' });
    await user.type(screen.getByRole('searchbox'), 'birds');
    await screen.findByRole('heading', { name: 'Search results' });
    expect(screen.getByRole('button', { name: 'A lasting thought' })).toBeVisible();
    await user.clear(screen.getByRole('searchbox'));
    await user.type(screen.getByRole('searchbox'), 'missing content');
    expect(await screen.findByText('No matches. Try another search or clear your filters.')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Clear filters' }));
  });

  it('creates and renames projects, assigns tasks, filters and reorders', async () => {
    const first = { ...newTask(0), title: 'First', tags: ['work'] };
    const second = { ...newTask(1), title: 'Second', priority: 'high' as const };
    await db.tasks.bulkAdd([first, second]);
    const user = await start();
    await user.click(screen.getByRole('button', { name: 'Move Second up' }));
    await waitFor(async () => expect((await db.tasks.get(second.id))?.order).toBe(0));
    await navigate('Projects');
    await user.type(screen.getByLabelText('Project name'), 'Household');
    fireEvent.change(screen.getByLabelText('Project color'), { target: { value: '#cc8822' } });
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    await screen.findByRole('button', { name: 'Open project Household' });
    await user.click(screen.getByRole('button', { name: 'Edit' }));
    await user.clear(screen.getByLabelText('Project name'));
    await user.type(screen.getByLabelText('Project name'), 'Home');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    await user.click(await screen.findByRole('button', { name: 'Open project Home' }));
    await user.click(screen.getByRole('button', { name: 'New task' }));
    const dialog = screen.getByRole('dialog');
    await user.type(within(dialog).getByLabelText('Task title', { exact: true }), 'Fix shelf');
    await user.click(within(dialog).getByRole('button', { name: 'Save changes' }));
    await screen.findByRole('button', { name: 'Fix shelf' });
    await navigate('All tasks');
    await user.selectOptions(screen.getByLabelText('Priority', { exact: true }), 'high');
    expect(screen.getByRole('button', { name: 'Second' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'First' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Clear filters' }));
    await user.selectOptions(screen.getByLabelText('Tags, separated by commas'), 'work');
    expect(screen.getByRole('button', { name: 'First' })).toBeVisible();
  });

  it('changes settings, language and completed visibility', async () => {
    await db.notes.add({ ...newNote(), title: 'Saved note' });
    const user = await start();
    await navigate('Settings');
    await user.selectOptions(screen.getByLabelText('Theme', { exact: true }), 'dark');
    await waitFor(() => expect(document.documentElement.dataset.theme).toBe('dark'));
    await user.click(screen.getByLabelText('Show completed tasks'));
    await waitFor(async () => expect((await db.settings.get('preferences'))?.showCompleted).toBe(false));
    await user.selectOptions(screen.getByLabelText('Language', { exact: true }), 'es');
    await screen.findByRole('heading', { name: 'Ajustes' });
    expect(document.documentElement.lang).toBe('es');
    await user.selectOptions(screen.getByLabelText('Idioma', { exact: true }), 'en');
    await screen.findByRole('heading', { name: 'Settings' });
    expect(await db.settings.get('preferences')).toMatchObject({
      ...defaultSettings,
      theme: 'dark',
      showCompleted: false,
    });
  });
});
