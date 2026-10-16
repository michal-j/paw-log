import type { SupabaseClient } from '@supabase/supabase-js';
import { DemoRepository } from './demoRepository';
import { SupabaseRepository } from './supabaseRepository';
import type { Repository } from './repository';

/** Demo mode: the build flag, or the visitor is on the /demo path. No sign-in, no backend calls. */
export function isDemoMode(
  pathname: string = globalThis.location?.pathname ?? '/',
  flag: string | undefined = import.meta.env.VITE_DEMO_MODE,
): boolean {
  return flag === 'true' || pathname === '/demo' || pathname.startsWith('/demo/');
}

/** Demo mode gets the fictional data; otherwise the signed-in session's Supabase client is required. */
export function createRepository(demo: boolean, client?: SupabaseClient): Repository {
  if (demo) return new DemoRepository();
  if (!client) throw new Error('createRepository: a Supabase client is required outside demo mode.');
  return new SupabaseRepository(client);
}

export { DemoRepository } from './demoRepository';
export { SupabaseRepository } from './supabaseRepository';
export { DuplicateSlotEntryError, NoDogError, RepositoryError } from './errors';
export type { Repository } from './repository';
export * from './types';
