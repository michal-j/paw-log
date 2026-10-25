/**
 * JCB-145, temporary workaround: on the iPhone, the web app's connection to the Supabase host stalls after
 * idle pauses (JCB-71) while its connection to its own host keeps working. So a deployed app (https, not
 * localhost) sends every Supabase request to `<its own address>/sb`; a Vercel routing rule in the project
 * (kept out of the public repo, since it names the Supabase project) forwards `/sb/*` to Supabase.
 * Remove together with that rule when the native app is built (JCB-146).
 */
export const PROXY_PATH = '/sb';

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

/** The address the client should use instead of the Supabase URL, or null to talk to Supabase directly (local dev, tests). */
export function proxyUrl(location: Pick<Location, 'origin' | 'protocol' | 'hostname'> | undefined = globalThis.location): string | null {
  if (!location || location.protocol !== 'https:' || LOCAL_HOSTS.has(location.hostname)) return null;
  return `${location.origin}${PROXY_PATH}`;
}
