import { createRepository } from '../data';
import { AuthGate } from './AuthGate';
import { ConfigError } from './ConfigError';
import { readSupabaseConfig, type SupabaseConfig } from './config';
import { createSupabaseAuth } from './supabaseAuth';
import { createSupabaseClient } from './supabaseClient';

// Wiring for the real app. Loaded lazily from main.tsx, so demo visitors never download
// supabase-js and the demo makes no network calls. One client per page load.
function connect(config: SupabaseConfig) {
  const client = createSupabaseClient(config);
  return { auth: createSupabaseAuth(client), newRepository: () => createRepository(false, client) };
}

const config = readSupabaseConfig();
const backend = config ? connect(config) : null;

export default function RealApp() {
  if (!backend) return <ConfigError />;
  return <AuthGate auth={backend.auth} createRepository={backend.newRepository} />;
}
