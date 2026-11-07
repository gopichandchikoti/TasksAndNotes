import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { chromium, expect, test, type BrowserContext } from '@playwright/test';

test('saved tasks, notes and offline shell survive a complete browser restart', async ({ baseURL }) => {
  if (!baseURL) throw new Error('The local test server URL is required');
  const profile = await mkdtemp(path.join(tmpdir(), 'tasks-notes-restart-'));
  let context: BrowserContext | undefined;
  try {
    context = await chromium.launchPersistentContext(profile, { headless: true });
    const page = await context.newPage();
    await page.goto(baseURL);
    await page.getByRole('textbox', { name: 'What needs to get done?' }).fill('Ready after a restart');
    await page.getByRole('button', { name: 'Add task', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Ready after a restart', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'New note', exact: true }).click();
    const editor = page.getByRole('dialog');
    await editor.getByLabel('Note title', { exact: true }).fill('A durable thought');
    await editor.getByRole('textbox', { name: 'Markdown body' }).fill('Keep this writing when the browser closes.');
    await editor.getByLabel('Tags, separated by commas').fill('durability');
    await editor.getByRole('button', { name: 'Save changes', exact: true }).click();
    await expect(editor.getByRole('status')).toHaveText('Saved on this device');
    await editor.getByRole('button', { name: 'Close', exact: true }).last().click();
    await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
    await context.close();
    context = undefined;

    context = await chromium.launchPersistentContext(profile, { headless: true });
    await context.setOffline(true);
    const reopened = await context.newPage();
    await reopened.goto(baseURL);
    await expect(reopened.getByRole('button', { name: 'Ready after a restart', exact: true })).toBeVisible();
    await reopened.getByRole('navigation').getByRole('button', { name: 'Notes', exact: true }).click();
    await reopened.getByRole('button', { name: 'A durable thought', exact: true }).click();
    const restored = reopened.getByRole('dialog');
    await expect(restored.getByRole('textbox', { name: 'Markdown body' })).toHaveValue(
      'Keep this writing when the browser closes.',
    );
    await expect(restored.getByLabel('Tags, separated by commas')).toHaveValue('durability');
  } finally {
    await context?.close();
    await removeProfile(profile);
  }
});

async function removeProfile(profile: string): Promise<void> {
  const resolved = path.resolve(profile);
  const parent = `${path.resolve(tmpdir())}${path.sep}`;
  if (!resolved.startsWith(parent) || !path.basename(resolved).startsWith('tasks-notes-restart-')) {
    throw new Error('Refusing to remove an unexpected browser profile path');
  }
  await rm(resolved, { recursive: true, force: true });
}
