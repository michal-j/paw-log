import { createRepository } from '../data';
import { AuthGate } from './AuthGate';
import { ConfigError } from './ConfigError';
import { readSupabaseConfig, type SupabaseConfig } from './config';
import { createSupabaseAuth } from './supabaseAuth';
import { proxyUrl } from './proxy';
import { createSupabaseClient } from './supabaseClient';
import { startDiag } from '../diag/requestLog';

// Wiring for the real app. Loaded lazily from main.tsx, so demo visitors never download
// supabase-js and the demo makes no network calls. One client per page load.
function connect(config: SupabaseConfig) {
  // Through the app's own address when deployed (JCB-145; see ./proxy.ts), straight to Supabase in local dev.
  const client = createSupabaseClient({ ...config, url: proxyUrl() ?? config.url });
  return { auth: createSupabaseAuth(client), newRepository: () => createRepository(false, client) };
}

// The on-device activity log (JCB-71, JCB-144): always on in the real app, shown in the Menu.
startDiag();

const config = readSupabaseConfig();
const backend = config ? connect(config) : null;

export default function RealApp() {
  if (!backend) return <ConfigError />;
  return <AuthGate auth={backend.auth} createRepository={backend.newRepository} />;
}
