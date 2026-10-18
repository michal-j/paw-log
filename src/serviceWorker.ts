/** The part of `navigator.serviceWorker` used here. */
interface Registrations {
  getRegistrations(): Promise<readonly { unregister(): Promise<boolean> }[]>;
}

/**
 * Unregister every service worker the browser still has for the app (JCB-71).
 *
 * A page that a service worker controls hands every request to that worker first, Supabase calls
 * included, even when the worker only caches the app shell and lets them through. In the installed
 * iPhone PWA that hand-off stalled once iOS had stopped the worker: writes never left the phone
 * until the app was restarted. The app therefore runs without one. Phones that installed the old
 * worker get the self-removing `sw.js` from the build (vite.config.ts) and this call as well.
 * Best effort: never throws.
 */
export async function removeServiceWorkers(
  container: Registrations | undefined = globalThis.navigator?.serviceWorker,
): Promise<void> {
  if (!container) return;
  try {
    const registrations = await container.getRegistrations();
    await Promise.all(registrations.map((r) => r.unregister().catch(() => false)));
  } catch {
    /* storage blocked or not allowed here: nothing to remove */
  }
}
