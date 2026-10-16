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

export function createRepository(demo: boolean = isDemoMode()): Repository {
  return demo ? new DemoRepository() : new SupabaseRepository();
}

export { DemoRepository } from './demoRepository';
export type { Repository } from './repository';
export * from './types';
