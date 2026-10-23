// Dev-only harness (JCB-43): the real app (AuthGate → SupabaseRepository → supabase-js) against the
// fake backend in this browser tab, so flows can be clicked through on the real data path without
// any Supabase project. Open http://localhost:<port>/harness.html. Never part of the build.
//
// ?start=YYYY-MM-DD seeds the usual day from that date (default: 10 days ago).
// ?long=1 also logs a year and a half of fictional meals, medication, symptoms, vet visits and notes (JCB-138: Search over a long log).
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
import { startDiag } from '../../src/diag/requestLog';
import { SEED, createFakeBackend } from './fakeBackend';
import { fakeClient, fakeUploader, harnessDisplayUrl, timedRepository } from './fakeSupabase';

const params = new URLSearchParams(location.search);
const HARNESS_COOKIE = 'pawlog_harness';
if (params.has('off')) {
  document.cookie = `${HARNESS_COOKIE}=; path=/; max-age=0`;
  location.replace('/');
  throw new Error('leaving the harness');
}
document.cookie = `${HARNESS_COOKIE}=1; path=/; SameSite=Strict`;
const start = params.get('start') ?? shiftDate(localDate(new Date()), -10);

/** A year and a half of fictional life, up to today, for trying Search and the Timeline with a long log. */
async function seedLongLog(b: Awaited<ReturnType<typeof createFakeBackend>>) {
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const to = localDate(new Date());
  const from = iso(new Date(new Date(`${to}T12:00:00Z`).getTime() - 540 * 864e5));
  const [dog, cooked, farm, arvelin, bellavet] = [SEED.dog, SEED.items.cooked, SEED.items.farm, SEED.items.arvelin, SEED.items.bellavet];
  const days = `generate_series('${from}'::date, '${to}'::date, interval '1 day') d`;
  const every = (n: number) => `generate_series('${from}'::date, '${to}'::date, interval '${n} day') d`;
  await b.db.exec(`
    insert into entry (dog_id, date, day_part, item_id, amount, unit, state, note)
      select '${dog}', d::date, v.p, v.item::uuid, 1, 'can',
        case when extract(doy from d)::int % 13 = 0 and v.p = 4 then 'partial' else 'given' end,
        case when extract(doy from d)::int % 17 = 0 and v.p = 2 then 'Ate slowly today.' else '' end
      from ${days}, (values (2, '${cooked}'), (4, '${farm}'), (6, '${cooked}')) v(p, item) on conflict do nothing;
    insert into entry (dog_id, date, day_part, item_id, amount, unit, state, note)
      select '${dog}', d::date, 1, '${arvelin}'::uuid, 0.5, 'pill', 'given', '' from ${days} on conflict do nothing;
    insert into entry (dog_id, date, day_part, item_id, amount, unit, state, note)
      select '${dog}', d::date, 3, '${bellavet}'::uuid, 0.15, 'ml', case when extract(doy from d)::int % 29 = 0 then 'skipped' else 'given' end, '' from ${days} on conflict do nothing;
    insert into event (dog_id, date, type, title, detail)
      select '${dog}', d::date, 'symptom', 'Heartburn', 'After dinner, licked her lips.' from ${every(9)};
    insert into event (dog_id, date, type, title, detail)
      select '${dog}', d::date, 'vet', 'Maple Vet', 'Check-up and weight, stomach ultrasound.' from ${every(45)};
    insert into event (dog_id, date, type, title, detail)
      select '${dog}', d::date, 'note', '', 'Dziś żołądkiem gorzej, nie chciała jeść.' from ${every(61)};
    insert into condition (dog_id, name, started_on, description) values ('${dog}', 'Problemy z żołądkiem', '${to}', 'Burczenie i miękka kupa.');`);
}

const user: AuthUser = { id: SEED.user, email: 'one@example.test' };
const auth: AuthService = {
  subscribe: (listener) => {
    listener(user);
    return () => {};
  },
  signIn: async () => {},
  signOut: async () => {},
};

startDiag(); // ?diag=1 shows the request log in the Menu (JCB-71)
const backend = await createFakeBackend({ start });
if (params.has('long')) await seedLongLog(backend);
const client = fakeClient(backend);
// For poking at from the console: window.harness.backend.sql('select * from entry').
// A lost request (JCB-71): window.harness.backend.hangNext(1), tap Save, then backend.release().
(window as unknown as { harness: unknown }).harness = { backend, client };

// The app routes on the pathname: /harness.html becomes the Timeline, any app path (after a reload) stays.

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nProvider>
      <AuthGate
        auth={auth}
        createRepository={() => timedRepository(client, undefined, undefined, { displayUrl: harnessDisplayUrl(backend), upload: fakeUploader(backend) })}
        confirm={() => true}
      />
    </I18nProvider>
  </StrictMode>,
);
