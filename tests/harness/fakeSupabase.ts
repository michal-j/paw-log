// The real supabase-js client and SupabaseRepository wired to the fake backend (tests/harness/fakeBackend.ts).
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { SupabaseRepository } from '../../src/data/supabaseRepository';
import { FAKE_ANON_KEY, FAKE_URL, createFakeBackend, type FakeBackend } from './fakeBackend';

export interface FakeSupabase {
  backend: FakeBackend;
  client: SupabaseClient;
  /** A fresh repository (as AuthGate creates one per signed-in user), with an optional fixed clock. */
  repository: (now?: () => Date) => SupabaseRepository;
}

export function fakeClient(backend: FakeBackend): SupabaseClient {
  return createClient(FAKE_URL, FAKE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: backend.fetch },
  });
}

export async function createFakeSupabase(options: Parameters<typeof createFakeBackend>[0] = {}): Promise<FakeSupabase> {
  const backend = await createFakeBackend(options);
  const client = fakeClient(backend);
  return { backend, client, repository: (now) => new SupabaseRepository(client, now) };
}
