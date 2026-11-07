import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('long content, dark theme, reduced motion, 200% text resize and RTL layout remain usable', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
  await page.goto('/');
  const title = 'A thoughtful task with a long title that needs to wrap safely on a small screen. '
    .repeat(3)
    .slice(0, 240);
  await page.getByRole('textbox', { name: 'What needs to get done?' }).fill(title);
  await page.getByRole('button', { name: 'Add task', exact: true }).click();
  await expect(page.getByRole('button', { name: title, exact: true })).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  const now = new Date().toISOString();
  const backup = {
    schemaVersion: 2,
    exportedAt: now,
    tasks: [],
    projects: [],
    settings: [],
    notes: [
      {
        id: crypto.randomUUID(),
        title: 'A longer piece of writing',
        body: 'A paragraph to keep.\n\n'.repeat(10000),
        format: 'markdown',
        tags: [],
        pinned: false,
        archived: false,
        createdAt: now,
        updatedAt: now,
      },
    ],
  };
  await page.getByRole('navigation').getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByLabel('Import backup', { exact: true }).setInputFiles({
    name: 'large-note.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(backup)),
  });
  await expect(page.getByText(/Backup imported/)).toBeVisible();
  await page.getByRole('navigation').getByRole('button', { name: 'Notes', exact: true }).click();
  await page.setViewportSize({ width: 320, height: 1000 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'A longer piece of writing', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await page.evaluate(() => {
    const elements = [...document.querySelectorAll<HTMLElement>('body, body *')].filter(
      (element) => element instanceof HTMLElement,
    );
    const sizes = elements.map((element) => Number.parseFloat(getComputedStyle(element).fontSize));
    elements.forEach((element, index) => {
      element.style.fontSize = `${sizes[index] * 2}px`;
    });
  });
  const body = dialog.getByRole('textbox', { name: 'Markdown body' });
  await body.focus();
  expect(await body.inputValue()).toHaveLength(220000);
  await page.keyboard.press('Control+End');
  await page.keyboard.insertText('An ending.');
  expect(await body.inputValue()).toHaveLength(220010);
  await dialog.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect(dialog.getByRole('status')).toHaveText('Saved on this device');
  await dialog.getByLabel('Note title', { exact: true }).focus();
  await page.keyboard.press('Tab');
  expect(await page.evaluate(() => Boolean(document.activeElement?.closest('dialog')))).toBe(true);
  await dialog.getByRole('button', { name: 'Close', exact: true }).last().click();
  await page.evaluate(() => {
    document.documentElement.dir = 'rtl';
  });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
