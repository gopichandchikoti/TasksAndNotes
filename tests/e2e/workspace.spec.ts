import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('task, note, backup, archive, trash and offline workflows', async ({ page, context, browser }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Inbox', exact: true })).toBeVisible();
  await page.getByRole('textbox', { name: 'What needs to get done?' }).fill('Plan a quiet afternoon');
  await page.getByRole('button', { name: 'Add task', exact: true }).click();
  await page.getByRole('button', { name: 'Plan a quiet afternoon', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Description', { exact: true }).fill('Walk through the garden');
  await dialog.getByLabel('Priority', { exact: true }).selectOption('high');
  await dialog.getByLabel('Tags, separated by commas').fill('personal, outdoors');
  await dialog.getByRole('button', { name: 'Add checklist item', exact: true }).click();
  await dialog.getByRole('textbox', { name: 'Checklist item', exact: true }).fill('Bring a notebook');
  await dialog.getByRole('button', { name: 'Save changes' }).click();
  await expect(dialog).toHaveCount(0);
  await page.reload();
  await expect(page.getByText('#outdoors', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Toggle completion for Plan a quiet afternoon' }).click();
  await expect(page.getByRole('button', { name: 'Toggle completion for Plan a quiet afternoon' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Toggle completion for Plan a quiet afternoon' })).toHaveAttribute(
    'aria-pressed',
    'false',
  );
  await page.getByRole('button', { name: 'New note', exact: true }).click();
  await dialog.getByLabel('Note title', { exact: true }).fill('Garden journal');
  await dialog
    .getByRole('textbox', { name: 'Markdown body' })
    .fill('# Ideas\n\n- [ ] Watch the birds\n\n<script>alert(1)</script>\n\n[unsafe](javascript:alert(1))');
  await dialog.getByRole('button', { name: 'Preview', exact: true }).click();
  await expect(dialog.getByRole('heading', { name: 'Ideas', exact: true })).toBeVisible();
  await expect(dialog.locator('script')).toHaveCount(0);
  await expect(dialog.locator('a[href^="javascript:"]')).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Pin note', exact: true }).click();
  await dialog.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect(dialog.getByRole('status')).toHaveText('Saved on this device');
  await dialog.getByRole('button', { name: 'Close', exact: true }).last().click();
  await page.getByRole('searchbox').fill('birds');
  await expect(page.getByRole('button', { name: 'Garden journal', exact: true })).toBeVisible();
  await page.getByRole('searchbox').fill('');
  await page.getByRole('button', { name: 'Archive', exact: true }).last().click();
  await page.getByRole('navigation').getByRole('button', { name: 'Archive', exact: true }).click();
  await page.getByRole('button', { name: 'Restore', exact: true }).click();
  await page.getByRole('navigation').getByRole('button', { name: 'Notes', exact: true }).click();
  await page.getByRole('button', { name: 'Move to trash', exact: true }).click();
  await page.getByRole('navigation').getByRole('button', { name: 'Trash', exact: true }).click();
  await page.getByRole('button', { name: 'Restore', exact: true }).click();
  await page.getByRole('navigation').getByRole('button', { name: 'Settings', exact: true }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export backup', exact: true }).click();
  const backup = await download;
  expect(backup.suggestedFilename()).toBe('tasks-and-notes-backup.json');
  const backupPath = await backup.path();
  if (!backupPath) throw new Error('Backup download missing');
  const cleanContext = await browser.newContext();
  try {
    const restored = await cleanContext.newPage();
    await restored.goto('/');
    await restored.getByRole('navigation').getByRole('button', { name: 'Settings', exact: true }).click();
    await restored.getByLabel('Import backup', { exact: true }).setInputFiles(backupPath);
    await expect(restored.getByText(/Backup imported/)).toBeVisible();
    await restored.reload();
    await expect(restored.getByRole('button', { name: 'Plan a quiet afternoon', exact: true })).toBeVisible();
    await restored.getByRole('navigation').getByRole('button', { name: 'Notes', exact: true }).click();
    await expect(restored.getByRole('button', { name: 'Garden journal', exact: true })).toBeVisible();
  } finally {
    await cleanContext.close();
  }
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
  await page.getByRole('navigation').getByRole('button', { name: 'Notes', exact: true }).click();
  await context.setOffline(true);
  await page.reload();
  await page.getByRole('navigation').getByRole('button', { name: 'Notes', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Garden journal', exact: true })).toBeVisible();
  await page.screenshot({ path: 'docs/screenshots/desktop.png', fullPage: true });
  expect(errors).toEqual([]);
});

test('320px reflow, keyboard capture and focus', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto('/');
  await page.getByRole('heading', { name: 'Inbox', exact: true }).waitFor();
  await page.keyboard.press('n');
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByLabel('Task title', { exact: true })).toBeFocused();
  await dialog.getByLabel('Task title', { exact: true }).fill('A small step');
  await dialog.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.screenshot({ path: 'docs/screenshots/mobile.png', fullPage: true });
});
