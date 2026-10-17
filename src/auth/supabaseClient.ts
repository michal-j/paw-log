import { createClient, type SupabaseClient, type SupabaseClientOptions } from '@supabase/supabase-js';
import type { SupabaseConfig } from './config';
import { REQUEST_TIMEOUT_MS, resilientFetch } from './resilientFetch';

export const AUTH_STORAGE_KEY = 'pawlog.auth';

interface ClientOptions {
  /** The transport under the client (tests and the dev harness pass a fake backend's). */
  fetch?: typeof fetch;
  /** Auth settings that differ from the app's (the harness signs in without a stored session). */
  auth?: SupabaseClientOptions<'public'>['auth'];
  requestTimeoutMs?: number;
}

/**
 * The one Supabase client of the app. Only this module and src/auth/supabaseAuth.ts, plus
 * src/data/supabaseRepository.ts, touch Supabase; components never do.
 * The session lives in localStorage, which the installed iPhone PWA keeps across restarts;
 * tokens refresh automatically while the app is open (supabase-js pauses that while the app is in
 * the background and catches up when it returns).
 * Every request goes through `resilientFetch`, so none can hang after the app was in the background (JCB-71).
 */
export function createSupabaseClient(config: SupabaseConfig, options: ClientOptions = {}): SupabaseClient {
  // Looked up per request, not when the client is made (the global fetch may be replaced later, in tests).
  const base: typeof fetch = options.fetch ?? ((input, init) => fetch(input, init));
  return createClient(config.url, config.anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false, // sign-in is by password, never by a link back to the app
      storageKey: AUTH_STORAGE_KEY,
      ...options.auth,
    },
    global: {
      fetch: resilientFetch(
        // Never answer a read from the HTTP cache: after a write the app reloads and must see it.
        (input, init) => base(input, { ...init, cache: 'no-store' }),
        { timeoutMs: options.requestTimeoutMs ?? REQUEST_TIMEOUT_MS },
      ),
    },
  });
}
