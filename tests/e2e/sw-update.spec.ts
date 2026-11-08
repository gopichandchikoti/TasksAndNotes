import { createServer, type Server } from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { test, expect } from '@playwright/test';

let server: Server;
let origin: string;
let revision = 1;
const root = path.resolve('dist');
const types: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
};

test.beforeAll(async () => {
  server = createServer((request, response) => {
    async function serve() {
      const url = new URL(request.url ?? '/', 'http://127.0.0.1');
      const relative = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
      const filename = path.resolve(root, relative);
      if (!filename.startsWith(`${root}${path.sep}`)) {
        response.writeHead(403).end();
        return;
      }
      try {
        const bytes = await fs.readFile(filename);
        response.writeHead(200, {
          'Content-Type': types[path.extname(filename)] ?? 'application/octet-stream',
          'Cache-Control': 'no-cache',
        });
        // A byte-distinct service worker exercises an actual waiting/activation lifecycle.
        response.end(relative === 'sw.js' ? `${bytes.toString()}\n// isolated test revision ${revision}` : bytes);
      } catch {
        response.writeHead(404).end();
      }
    }
    void serve().catch(() => {
      if (!response.headersSent) response.writeHead(500);
      response.end();
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Test server unavailable');
  origin = `http://127.0.0.1:${address.port}`;
});
test.afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

test('service worker activation preserves caches outside the app namespace', async ({ page }) => {
  await page.goto(`${origin}/icon.svg`);
  const name = `another-app-precache-v1-${origin}/`;
  await page.evaluate(async (cacheName) => {
    const cache = await caches.open(cacheName);
    await cache.put('/unrelated-record', new Response('keep this record'));
  }, name);
  await page.goto(origin);
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
  await page.reload();
  const result = await page.evaluate(async (cacheName) => {
    const names = await caches.keys();
    const record = await (await caches.open(cacheName)).match('/unrelated-record');
    return { names, text: await record?.text() };
  }, name);
  expect(result.text).toBe('keep this record');
  expect(result.names.some((cacheName) => cacheName.startsWith('tasksandnotes-precache-'))).toBe(true);
});

test('a real service worker update waits for the user and preserves an open task draft', async ({ page }) => {
  await page.goto(origin);
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
  await page.reload();
  await page.getByRole('button', { name: 'New task', exact: true }).first().click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Task title', { exact: true }).fill('Survives an app update');
  revision = 2;
  await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.getRegistration();
    await registration?.update();
  });
  await expect(page.getByRole('button', { name: 'Reload app', exact: true })).toBeDisabled();
  await dialog.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await page.getByRole('button', { name: 'Reload app', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Survives an app update', exact: true })).toBeVisible();
});
