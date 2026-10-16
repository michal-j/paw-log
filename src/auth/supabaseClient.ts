import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { SupabaseConfig } from './config';

export const AUTH_STORAGE_KEY = 'pawlog.auth';

/**
 * The one Supabase client of the app. Only this module and src/auth/supabaseAuth.ts, plus
 * src/data/supabaseRepository.ts, touch Supabase; components never do.
 * The session lives in localStorage, which the installed iPhone PWA keeps across restarts;
 * tokens refresh automatically while the app is open.
 */
export function createSupabaseClient(config: SupabaseConfig): SupabaseClient {
  return createClient(config.url, config.anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false, // sign-in is by typed code, never by a link back to the app
      storageKey: AUTH_STORAGE_KEY,
    },
  });
}
