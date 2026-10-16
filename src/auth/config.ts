/** Connection settings for the real backend. Only the public URL and anon (publishable) key reach the client. */
export interface SupabaseConfig {
  url: string;
  anonKey: string;
}

interface Env {
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_ANON_KEY?: string;
}

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

/**
 * Read and check `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. Returns null when either is
 * missing, still a placeholder from .env.example, or the URL is not https (plain http only for a local stack).
 */
export function readSupabaseConfig(env: Env = import.meta.env): SupabaseConfig | null {
  const url = env.VITE_SUPABASE_URL?.trim() ?? '';
  const anonKey = env.VITE_SUPABASE_ANON_KEY?.trim() ?? '';
  if (!url || !anonKey || isPlaceholder(url) || isPlaceholder(anonKey)) return null;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  const secure = parsed.protocol === 'https:' || (parsed.protocol === 'http:' && LOCAL_HOSTS.has(parsed.hostname));
  return secure ? { url: parsed.origin, anonKey } : null;
}

const isPlaceholder = (value: string) => /your-|<|>/i.test(value);
