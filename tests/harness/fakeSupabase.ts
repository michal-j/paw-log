// The real supabase-js client and SupabaseRepository wired to the fake backend (tests/harness/fakeBackend.ts).
import type { SupabaseClient, SupabaseClientOptions } from '@supabase/supabase-js';
import { createSupabaseClient } from '../../src/auth/supabaseClient';
import { SupabaseRepository } from '../../src/data/supabaseRepository';
import { withTimeout } from '../../src/data/timeout';
import { FAKE_ANON_KEY, FAKE_URL, createFakeBackend, type FakeBackend } from './fakeBackend';

export interface FakeSupabase {
  backend: FakeBackend;
  client: SupabaseClient;
  /**
   * A fresh repository (as AuthGate creates one per signed-in user), with an optional fixed clock,
   * limited in time like the app's (withTimeout; `timeoutMs` to shorten it in tests).
   */
  repository: (now?: () => Date, timeoutMs?: number) => SupabaseRepository;
}

interface ClientOptions {
  /** Auth settings over the harness defaults (no stored session, no auto-refresh). */
  auth?: SupabaseClientOptions<'public'>['auth'];
  requestTimeoutMs?: number;
}

let clientCount = 0;

/** The app's own client (createSupabaseClient, with its resilient fetch) on the fake backend. */
export function fakeClient(backend: FakeBackend, options: ClientOptions = {}): SupabaseClient {
  return createSupabaseClient(
    { url: FAKE_URL, anonKey: FAKE_ANON_KEY },
    {
      fetch: backend.fetch,
      // A distinct storageKey per client: tests make many clients in one file, and supabase-js warns
      // ("Multiple GoTrueClient instances") when two share a key.
      auth: { persistSession: false, autoRefreshToken: false, storageKey: `pawlog-test-auth-${clientCount++}`, ...options.auth },
      requestTimeoutMs: options.requestTimeoutMs,
    },
  );
}

/** The real-path repository the app uses: SupabaseRepository, limited in time. */
export function timedRepository(client: SupabaseClient, now?: () => Date, timeoutMs?: number) {
  return withTimeout(new SupabaseRepository(client, now), timeoutMs);
}

export async function createFakeSupabase(
  options: Parameters<typeof createFakeBackend>[0] & { client?: ClientOptions } = {},
): Promise<FakeSupabase> {
  const backend = await createFakeBackend(options);
  const client = fakeClient(backend, options.client);
  return { backend, client, repository: (now, timeoutMs) => timedRepository(client, now, timeoutMs) };
}
