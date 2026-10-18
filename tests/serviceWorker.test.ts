// JCB-71 (reopened): in the installed iPhone PWA, writes stopped reaching the server about a minute
// after each app start, while the app's own code had sent them (tests/saveSequence.test.tsx). Every
// request of a page that a service worker controls is first handed to that worker, Supabase calls
// included, even though ours only cached the app shell. On iOS that hand-off can stall once the
// worker has been stopped, until the app is restarted. So the app no longer runs a service worker:
// the build ships one that removes itself (for phones that still have the old one), and the page
// unregisters any it finds.
import { describe, expect, it, vi } from 'vitest';
import { removeServiceWorkers } from '../src/serviceWorker';
import mainSource from '../src/main.tsx?raw';
import viteConfigSource from '../vite.config.ts?raw';

describe('no service worker between the app and Supabase (JCB-71)', () => {
  it('unregisters every service worker the browser still has for the app', async () => {
    const unregister = vi.fn(async () => true);
    const container = { getRegistrations: vi.fn(async () => [{ unregister }, { unregister }]) };
    await removeServiceWorkers(container);
    expect(unregister).toHaveBeenCalledTimes(2);
  });

  it('does nothing where service workers are not supported, and never throws', async () => {
    await expect(removeServiceWorkers(undefined)).resolves.toBeUndefined();
    await expect(removeServiceWorkers({ getRegistrations: async () => Promise.reject(new Error('blocked')) })).resolves.toBeUndefined();
    const failing = { unregister: async () => Promise.reject(new Error('busy')) };
    await expect(removeServiceWorkers({ getRegistrations: async () => [failing] })).resolves.toBeUndefined();
  });

  it('the app registers no service worker, and the build ships one that removes itself', () => {
    expect(mainSource).not.toMatch(/virtual:pwa-register/);
    expect(viteConfigSource).toMatch(/selfDestroying:\s*true/);
    expect(viteConfigSource).toMatch(/injectRegister:\s*false/);
  });
});
