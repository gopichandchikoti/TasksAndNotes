import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import content from './public/tasksandnotes.model.json' with { type: 'json' };

export default defineConfig({
  server: { host: '127.0.0.1', port: 5173, strictPort: true },
  preview: {
    host: '127.0.0.1',
    port: 4173,
    strictPort: true,
    headers: {
      'Content-Security-Policy':
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; " +
        "img-src 'self' data: blob:; connect-src 'self'; font-src 'self'; object-src 'none'; " +
        "base-uri 'self'; frame-ancestors 'none'; form-action 'self'; worker-src 'self'",
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    },
  },
  plugins: [
    {
      name: 'application-content-metadata',
      transformIndexHtml: (html) =>
        html.replace('__APP_TITLE__', content.locales.en['app.name'].replaceAll('&', '&amp;')),
    },
    react(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['icon.svg', 'icon-192.png', 'icon-512.png'],
      manifest: {
        id: './',
        name: content.locales.en['app.name'],
        short_name: content.locales.en['app.shortName'],
        description: content.locales.en['app.description'],
        start_url: './',
        scope: './',
        display: 'standalone',
        background_color: '#f7f6f2',
        theme_color: '#1d5945',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,json,webmanifest}'],
        cleanupOutdatedCaches: true,
        navigateFallback: 'index.html',
        maximumFileSizeToCacheInBytes: 2000000,
      },
    }),
  ],
  test: {
    environment: 'happy-dom',
    env: { TZ: 'America/Chicago' },
    setupFiles: ['tests/setup.ts'],
    include: ['tests/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      thresholds: {
        lines: 90,
        functions: 90,
        branches: 90,
        statements: 90,
        'src/db/**': { lines: 95, functions: 95, branches: 95, statements: 95 },
        'src/platform/reminders.ts': { lines: 95, functions: 95, branches: 95, statements: 95 },
      },
      reporter: ['text', 'json-summary', 'html'],
    },
  },
});
