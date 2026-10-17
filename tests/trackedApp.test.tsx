// Tracked conditions (JCB-6) on the real data path: App → SupabaseRepository → the PostgREST-like fake
// with every migration and RLS. Fictional data only.
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { App } from '../src/App';
import { I18nProvider } from '../src/i18n';
import { SEED } from './harness/fakeBackend';
import { createFakeSupabase, type FakeSupabase } from './harness/fakeSupabase';

const NOW = () => new Date(2026, 9, 15, 16, 30);
let fake: FakeSupabase | null = null;

async function at(path: string, prep?: string) {
  fake = await createFakeSupabase({ start: '2026-10-01' });
  if (prep) await fake.backend.db.exec(prep);
  window.history.replaceState(null, '', path);
  render(
    <I18nProvider initial="en">
      <App repository={fake.repository(NOW)} />
    </I18nProvider>,
  );
}
const dialog = () => screen.getByRole('dialog');
const rows = (sql: string) => fake!.backend.sql<Record<string, unknown>>(sql);

afterEach(async () => {
  cleanup();
  window.history.replaceState(null, '', '/');
  await fake?.backend.close();
  fake = null;
});

const LUMP = '70000000-0000-4000-8000-000000000001';
const EVENT = '50000000-0000-4000-8000-000000000001';
const withLump = `insert into public.condition (id, dog_id, name, started_on) values ('${LUMP}', '${SEED.dog}', 'Lump A', '2026-10-03');`;
const linkedEvent = (type: string, title: string) => `${withLump}
  insert into public.event (id, dog_id, date, type, title) values ('${EVENT}', '${SEED.dog}', '2026-10-14', '${type}', '${title}');
  insert into public.event_condition (event_id, condition_id, dog_id) values ('${EVENT}', '${LUMP}', '${SEED.dog}');`;

describe('tracked conditions, real data path', () => {
  it('creates a condition from the empty Tracked tab and lands on its page', async () => {
    await at('/tracked');
    fireEvent.click(await screen.findByRole('button', { name: 'Track something new' }));
    fireEvent.change(within(dialog()).getByLabelText('Name'), { target: { value: 'Lump B' } });
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Save' }));
    expect(await screen.findByRole('heading', { name: 'Lump B' })).toBeTruthy();
    expect(window.location.pathname).toMatch(/^\/tracked\/[0-9a-f-]{36}$/);
    expect(await rows(`select name, started_on::text, resolved_on from condition`)).toEqual([
      { name: 'Lump B', started_on: '2026-10-15', resolved_on: null },
    ]);
  });

  it('adds a note from the condition page, linked to it and to a condition named in the form; the page stays', async () => {
    await at(`/tracked/${LUMP}`, withLump);
    fireEvent.click(await screen.findByRole('button', { name: 'Add to Lump A' }));
    fireEvent.click(within(dialog()).getByText('Note'));
    fireEvent.change(within(dialog()).getByRole('textbox'), { target: { value: 'Looks smaller' } });
    expect(within(dialog()).getByRole('button', { name: 'Lump A', pressed: true })).toBeTruthy();
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Track something new' }));
    fireEvent.change(within(dialog()).getByLabelText('Name'), { target: { value: 'Skin' } });
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Add' }));
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Looks smaller')).toBeTruthy();
    expect(window.location.pathname).toBe(`/tracked/${LUMP}`);
    expect(await screen.findByRole('button', { name: 'Open Skin' })).toBeTruthy();
    const links = await rows(
      `select c.name, c.started_on::text from event_condition l join condition c on c.id = l.condition_id order by c.name`,
    );
    expect(links).toEqual([
      { name: 'Lump A', started_on: '2026-10-03' },
      { name: 'Skin', started_on: '2026-10-15' },
    ]);
  });

  it('a Day view tag opens the condition; resolve with a date, Undo reopens', async () => {
    await at('/day/2026-10-14', linkedEvent('symptom', 'Vomit'));
    fireEvent.click(await screen.findByRole('button', { name: 'Open Lump A' }));
    expect(await screen.findByRole('heading', { name: 'Lump A' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Mark as resolved' }));
    fireEvent.change(within(dialog()).getByLabelText('Resolved on'), { target: { value: '2026-10-14' } });
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Moved to Resolved')).toBeTruthy();
    expect(await screen.findByRole('button', { name: 'Reopen' })).toBeTruthy();
    expect(await rows(`select resolved_on::text from condition`)).toEqual([{ resolved_on: '2026-10-14' }]);
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(await screen.findByRole('button', { name: 'Mark as resolved' })).toBeTruthy();
    await waitFor(async () => expect(await rows(`select resolved_on from condition`)).toEqual([{ resolved_on: null }]));
  });

  it('deleting a condition keeps its events and returns to the list', async () => {
    await at('/tracked', linkedEvent('note', ''));
    fireEvent.click(await screen.findByText('Lump A'));
    fireEvent.click(await screen.findByRole('button', { name: 'Edit' }));
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Delete' }));
    expect(await screen.findByText('Tracked condition deleted')).toBeTruthy();
    await waitFor(() => expect(window.location.pathname).toBe('/tracked'));
    expect(await rows(`select count(*)::int as n from event`)).toEqual([{ n: 1 }]);
    expect(await rows(`select count(*)::int as n from condition`)).toEqual([{ n: 0 }]);
  });
});
