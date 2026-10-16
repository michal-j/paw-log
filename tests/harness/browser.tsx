// Dev-only harness (JCB-43): the real app (AuthGate → SupabaseRepository → supabase-js) against the
// fake backend in this browser tab, so flows can be clicked through on the real data path without
// any Supabase project. Open http://localhost:<port>/harness.html. Never part of the build.
//
// ?today-start=YYYY-MM-DD seeds the usual day from that date (default: 10 days ago).
// Data lives only in this tab: a reload starts again from the seed.
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../../src/styles/tokens.css';
import '../../src/styles/global.css';
import { AuthGate } from '../../src/auth/AuthGate';
import type { AuthService, AuthUser } from '../../src/auth/authService';
import { SupabaseRepository } from '../../src/data';
import { I18nProvider } from '../../src/i18n';
import { shiftDate } from '../../src/timeline/model';
import { localDate } from '../../src/data/supabaseRepository';
import { SEED, createFakeBackend } from './fakeBackend';
import { fakeClient } from './fakeSupabase';

const params = new URLSearchParams(location.search);
const start = params.get('start') ?? shiftDate(localDate(new Date()), -10);

const user: AuthUser = { id: SEED.user, email: 'one@example.test' };
const auth: AuthService = {
  subscribe: (listener) => {
    listener(user);
    return () => {};
  },
  signIn: async () => {},
  signOut: async () => {},
};

const backend = await createFakeBackend({ start });
const client = fakeClient(backend);
// For poking at from the console: window.harness.backend.sql('select * from entry')
(window as unknown as { harness: unknown }).harness = { backend, client };

// The app routes on the pathname; start on the Timeline.
history.replaceState(null, '', '/');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nProvider>
      <AuthGate auth={auth} createRepository={() => new SupabaseRepository(client)} confirm={() => true} />
    </I18nProvider>
  </StrictMode>,
);
