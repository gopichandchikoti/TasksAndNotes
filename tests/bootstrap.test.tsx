import { expect, it, vi } from 'vitest';

const mount = vi.hoisted(() => vi.fn());
vi.mock('react-dom/client', () => ({ default: { createRoot: () => ({ render: mount }) } }));
vi.mock('virtual:pwa-register/react', () => ({ useRegisterSW: vi.fn() }));

it('mounts the application at its standalone entry point', async () => {
  document.body.innerHTML = '<div id="root"></div>';
  await import('../src/main');
  expect(mount).toHaveBeenCalledOnce();
});

it('fails explicitly if the HTML mount element is missing', async () => {
  vi.resetModules();
  document.body.innerHTML = '';
  await expect(import('../src/main')).rejects.toThrow('Missing application mount element');
});
