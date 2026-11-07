import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import { App } from '../src/App';
import { db } from '../src/db/database';
import { Repository } from '../src/db/repository';
import { exportBackup } from '../src/db/backup';
import { newNote, newTask } from '../src/domain/factory';
import model from '../public/tasksandnotes.model.json';

const pwa = vi.hoisted(() => ({ needed: false, update: vi.fn(), onError: () => {} }));
vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: (options: { onRegisterError: () => void }) => {
    pwa.onError = options.onRegisterError;
    return { needRefresh: [pwa.needed], updateServiceWorker: pwa.update };
  },
}));

beforeEach(async () => {
  vi.restoreAllMocks();
  pwa.needed = false;
  pwa.update.mockReset().mockResolvedValue(undefined);
  await Promise.all(db.tables.map((table) => table.clear()));
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify(model))),
  );
  vi.stubGlobal(
    'confirm',
    vi.fn(() => true),
  );
  vi.stubGlobal(
    'Notification',
    Object.assign(vi.fn(), { permission: 'default', requestPermission: vi.fn(async () => 'denied') }),
  );
  vi.stubGlobal(
    'URL',
    Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:synthetic-backup'), revokeObjectURL: vi.fn() }),
  );
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
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

it('recovers from unavailable content and a failed storage query without resetting records', async () => {
  vi.mocked(fetch).mockResolvedValueOnce(new Response('{}'));
  const failure = vi.spyOn(db.tasks, 'toArray').mockRejectedValueOnce(new Error('Storage denied'));
  const user = userEvent.setup();
  render(<App />);
  await screen.findByText(
    'Storage could not be opened. Check browser storage permissions, then retry. Existing data has not been reset.',
  );
  failure.mockRestore();
  const buttons = screen.getAllByRole('button', { name: 'Retry' });
  for (const button of buttons) await user.click(button);
  await screen.findByRole('heading', { name: 'Inbox' });
  await waitFor(() => expect(screen.queryByText(model.locales.en['content.fallback'])).not.toBeInTheDocument());
});

it('retains a task editor on save failure and supports deliberate cancellation and checklist removal', async () => {
  const user = await start();
  await user.click(screen.getAllByRole('button', { name: 'New task' })[0]);
  const dialog = screen.getByRole('dialog');
  await user.type(within(dialog).getByLabelText('Task title', { exact: true }), 'Keep my draft');
  await user.click(within(dialog).getByRole('button', { name: 'Add checklist item' }));
  await user.click(within(dialog).getByRole('button', { name: 'Remove checklist item' }));
  const save = vi.spyOn(Repository.prototype, 'save').mockRejectedValueOnce(new DOMException('', 'QuotaExceededError'));
  await user.click(within(dialog).getByRole('button', { name: 'Save changes' }));
  expect(await within(dialog).findByRole('alert')).toHaveTextContent('Device storage is full');
  expect(within(dialog).getByLabelText('Task title', { exact: true })).toHaveValue('Keep my draft');
  save.mockRestore();
  vi.mocked(confirm).mockReturnValueOnce(false);
  await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
  expect(dialog).toBeInTheDocument();
  fireEvent(dialog, new Event('cancel', { bubbles: true, cancelable: true }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

it('keeps a failed note draft, retries, previews empty content and exports Markdown', async () => {
  const user = await start();
  await user.click(screen.getByRole('button', { name: 'New note' }));
  const dialog = await screen.findByRole('dialog');
  await user.click(within(dialog).getByRole('button', { name: 'Preview' }));
  expect(within(dialog).getByText('Your Markdown preview will appear here.')).toBeVisible();
  await user.click(within(dialog).getByRole('button', { name: 'Write' }));
  await user.type(within(dialog).getByLabelText('Note title', { exact: true }), 'Backup thought');
  const save = vi.spyOn(Repository.prototype, 'save').mockRejectedValueOnce(new DOMException('', 'QuotaExceededError'));
  await user.click(within(dialog).getByRole('button', { name: 'Save changes' }));
  expect(await within(dialog).findByRole('alert')).toHaveTextContent('Device storage is full');
  save.mockRestore();
  await user.click(within(dialog).getByRole('button', { name: 'Retry' }));
  await waitFor(() => expect(within(dialog).queryByRole('alert')).not.toBeInTheDocument());
  await user.click(within(dialog).getByRole('button', { name: 'Export Markdown' }));
  expect(URL.createObjectURL).toHaveBeenCalled();
  await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
  await user.click(await screen.findByRole('button', { name: 'Backup thought' }));
  await user.click(within(screen.getByRole('dialog')).getAllByRole('button', { name: 'Close' })[0]);
});

it('downloads and validates imports, retaining existing data on malformed or oversized backups', async () => {
  await db.notes.add({ ...newNote(), title: 'Portable note', body: 'A real thought' });
  const text = await exportBackup(db);
  const user = await start();
  await navigate('Settings');
  await user.click(screen.getByRole('button', { name: 'Export backup' }));
  expect(await screen.findByText('Backup downloaded.')).toBeVisible();
  await user.click(screen.getByRole('button', { name: 'Import backup' }));
  const input = screen.getByLabelText('Import backup', { exact: true });
  await user.upload(input, new File([text], 'backup.json', { type: 'application/json' }));
  await screen.findByText('Backup imported. 0 records added; conflicts were preserved as copies.');
  await user.upload(input, new File(['{}'], 'broken.json', { type: 'application/json' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('not a valid Tasks & Notes backup');
  const oversized = new File(['x'], 'large.json', { type: 'application/json' });
  Object.defineProperty(oversized, 'size', { value: 21 * 1024 * 1024 });
  await user.upload(input, oversized);
  expect(await screen.findByRole('alert')).toHaveTextContent('20 MB');
  fireEvent.change(input, { target: { files: [] } });
  expect(await db.notes.count()).toBe(1);
  await waitFor(() => expect(URL.revokeObjectURL).toHaveBeenCalled(), { timeout: 2500 });
});

it('explains notification denial, tracks offline/online state and safely handles PWA update failures', async () => {
  pwa.needed = true;
  pwa.update.mockRejectedValueOnce(new Error('Update unavailable'));
  const user = await start();
  await user.click(screen.getAllByRole('button', { name: 'New task' })[0]);
  expect(screen.getByRole('button', { name: 'Reload app' })).toBeDisabled();
  await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel' }));
  await user.click(screen.getByRole('button', { name: 'Reload app' }));
  await screen.findByText('Offline setup failed. You can continue online; reload to retry.');
  await navigate('Settings');
  await user.click(screen.getByRole('button', { name: 'Enable notifications' }));
  await screen.findByText('Notification permission: blocked in browser settings');
  const online = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
  fireEvent(window, new Event('offline'));
  expect(screen.getAllByText('Offline · changes stay on this device').length).toBeGreaterThan(0);
  online.mockReturnValue(true);
  fireEvent(window, new Event('online'));
  online.mockRestore();
});

it('registers reminders, reports notification failure, and uses keyboard/mobile navigation', async () => {
  const notify = Object.assign(
    vi.fn(() => {
      throw new Error('Notification unavailable');
    }),
    {
      permission: 'granted',
      requestPermission: vi.fn(async () => 'granted'),
    },
  );
  vi.stubGlobal('Notification', notify);
  await db.tasks.add({ ...newTask(0), title: 'Due reminder', reminderAt: '2020-01-01T00:00:00.000Z' });
  const user = await start();
  await screen.findByText('Notifications could not be shown. Check browser permissions. Your due dates are saved.');
  fireEvent(document, new Event('visibilitychange'));
  await user.keyboard('{Control>}k{/Control}');
  expect(screen.getByRole('searchbox')).toHaveFocus();
  await user.type(screen.getByRole('searchbox'), 'n');
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  await user.clear(screen.getByRole('searchbox'));
  screen.getByRole('searchbox').blur();
  await user.keyboard('N');
  const dialog = await screen.findByRole('dialog');
  fireEvent(dialog, new Event('cancel', { cancelable: true }));
  await user.click(screen.getByRole('button', { name: 'Toggle navigation' }));
  expect(screen.getByRole('button', { name: 'Toggle navigation' })).toHaveAttribute('aria-expanded', 'true');
  await navigate('Today');
  await user.type(screen.getByRole('textbox', { name: 'What needs to get done?' }), 'Today task');
  await user.click(screen.getByRole('button', { name: 'Add task' }));
  await screen.findByRole('button', { name: 'Today task' });
  await navigate('Upcoming');
  await user.type(screen.getByRole('textbox', { name: 'What needs to get done?' }), 'Future task');
  await user.click(screen.getByRole('button', { name: 'Add task' }));
  await screen.findByRole('button', { name: 'Future task' });
  act(() => pwa.onError());
  expect(screen.getByText('Offline setup failed. You can continue online; reload to retry.')).toBeVisible();
});
