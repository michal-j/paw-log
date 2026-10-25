import { isDiagStarted, noteAction } from './requestLog';

/** How long a probe waits for any answer, and how long before the next probe may run. */
export const PROBE_TIMEOUT_MS = 5_000;
export const PROBE_EVERY_MS = 20_000;

let lastAt = 0;

type Fetch = typeof fetch;

async function ask(label: string, url: string, fetchImpl: Fetch, timeoutMs: number): Promise<void> {
  const started = performance.now();
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const silent = new Promise<'none'>((resolve) => {
    timer = setTimeout(() => {
      controller.abort();
      resolve('none');
    }, timeoutMs);
  });
  const result = await Promise.race([
    fetchImpl(url, { cache: 'no-store', signal: controller.signal }).then(
      (r) => r.status,
      () => 'error' as const,
    ),
    silent,
  ]);
  clearTimeout(timer);
  const ms = Math.round(performance.now() - started);
  // Any HTTP status, even a refusal, proves the connection to that host works.
  noteAction(
    typeof result === 'number' ? `probe ${label}: answered ${result} in ${ms} ms` : result === 'none' ? `probe ${label}: no answer in ${ms} ms` : `probe ${label}: network error in ${ms} ms`,
  );
}

/**
 * After a request got no answer, asks two hosts for anything at all and logs how each one answered
 * (JCB-71): the app's own host and the Supabase host the failed request went to. Tells "the phone has
 * no network" (both silent) from "only the Supabase connection is stuck" (app host answers). At most
 * one probe every 20 s; only while the activity log runs (real app). Nothing leaves the phone but
 * a plain GET to those two hosts, and only the status and time are written down.
 */
export function probeStall(requestUrl: string, fetchImpl: Fetch = (i, o) => fetch(i, o), timeoutMs = PROBE_TIMEOUT_MS): void {
  if (!isDiagStarted() || Date.now() - lastAt < PROBE_EVERY_MS) return;
  let origin: string;
  try {
    origin = new URL(requestUrl).origin;
  } catch {
    return;
  }
  lastAt = Date.now();
  noteAction(`probe after no answer (browser says online: ${typeof navigator !== 'undefined' && navigator.onLine ? 'yes' : 'no'})`);
  void ask('app host', `${globalThis.location?.origin ?? ''}/icon.svg?probe=${Date.now()}`, fetchImpl, timeoutMs);
  void ask('Supabase host', `${origin}/auth/v1/health`, fetchImpl, timeoutMs);
}

export function resetProbeForTests(): void {
  lastAt = 0;
}
