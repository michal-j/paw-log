// Dev-only harness (JCB-43): the real app (AuthGate → SupabaseRepository → supabase-js) against the
// fake backend in this browser tab, so flows can be clicked through on the real data path without
// any Supabase project. Open http://localhost:<port>/harness.html. Never part of the build.
//
// ?start=YYYY-MM-DD seeds the usual day from that date (default: 10 days ago).
// Data lives only in this tab: a reload starts again from the seed, on the same screen (a session
// cookie makes the dev server answer every page with harness.html). /harness.html?off leaves it.

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../../src/styles/tokens.css';
import '../../src/styles/global.css';
import { AuthGate } from '../../src/auth/AuthGate';
import type { AuthService, AuthUser } from '../../src/auth/authService';
import { I18nProvider } from '../../src/i18n';
import { shiftDate } from '../../src/timeline/model';
import { localDate } from '../../src/data/supabaseRepository';
import { SEED, createFakeBackend } from './fakeBackend';
import { fakeClient, timedRepository } from './fakeSupabase';

const params = new URLSearchParams(location.search);
const HARNESS_COOKIE = 'pawlog_harness';
if (params.has('off')) {
  document.cookie = `${HARNESS_COOKIE}=; path=/; max-age=0`;
  location.replace('/');
  throw new Error('leaving the harness');
}
document.cookie = `${HARNESS_COOKIE}=1; path=/; SameSite=Strict`;
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
// For poking at from the console: window.harness.backend.sql('select * from entry').
// A lost request (JCB-71): window.harness.backend.hangNext(1), tap Save, then backend.release().
(window as unknown as { harness: unknown }).harness = { backend, client };

// The app routes on the pathname: /harness.html becomes the Timeline, any app path (after a reload) stays.

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nProvider>
      <AuthGate auth={auth} createRepository={() => timedRepository(client)} confirm={() => true} />
    </I18nProvider>
  </StrictMode>,
);
