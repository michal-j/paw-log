/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_DEMO_MODE?: string;
  /** Public project URL, for example https://<project-ref>.supabase.co. Set in Vercel / local .env. */
  readonly VITE_SUPABASE_URL?: string;
  /** Public anon (publishable) key. Never the secret (server) key. */
  readonly VITE_SUPABASE_ANON_KEY?: string;
}
