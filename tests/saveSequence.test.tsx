// JCB-71 (reopened 18 Oct): on the iPhone, in the foreground, one save worked and the next never
// reached the server. On the real data path with the app's own auth settings (stored session,
// auto-refresh on), several saves of different kinds in a row each reach the backend, and a save
// that timed out does not block the next one. The app's own code does not hold writes back; what
// stood between it and the network was the service worker (tests/serviceWorker.test.ts).
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { App } from '../src/App';
import { AUTH_STORAGE_KEY } from '../src/auth/supabaseClient';
import { I18nProvider } from '../src/i18n';
import { SEED, fakeSession } from './harness/fakeBackend';
import { createFakeSupabase, type FakeSupabase } from './harness/fakeSupabase';

const NOW = () => new Date(2026, 9, 15, 16, 30); // Thu 15 Oct 2026, 16:30
let fake: FakeSupabase | null = null;

const click = (name: string | RegExp) => fireEvent.click(screen.getByRole('button', { name }));
const dialog = () => screen.getByRole('dialog');
const posts = (table: string) => fake!.backend.log.filter((r) => r.method === 'POST' && r.table === table);
const closed = () => waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

/** The app as on the phone: signed in with a stored session, tokens refreshing automatically. */
async function signedIn(path: string, timeoutMs?: number) {
  const store = new Map<string, string>([[AUTH_STORAGE_KEY, JSON.stringify(fakeSession(SEED.user, 3600))]]);
  const storage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  };
  fake = await createFakeSupabase({
    start: '2026-10-01',
    client: { requestTimeoutMs: 60_000, auth: { persistSession: true, autoRefreshToken: true, storageKey: AUTH_STORAGE_KEY, storage } },
  });
  window.history.replaceState(null, '', path);
  render(
    <I18nProvider initial="en">
      <App repository={fake.repository(NOW, timeoutMs)} />
    </I18nProvider>,
  );
}

afterEach(async () => {
  cleanup();
  window.history.replaceState(null, '', '/');
  fake?.backend.release();
  await fake?.backend.close();
  fake = null;
});

describe('saves in a row all reach the backend (JCB-71)', () => {
  it('entry, Given, entry, note, pinned note and usual-day item, one after another', async () => {
    await signedIn('/day/2026-10-15');
    await screen.findAllByText('Cooked meal');

    click('Add to Breakfast');
    fireEvent.click(within(dialog()).getByText('Food'));
    fireEvent.click(within(dialog()).getByRole('radio', { name: 'Farm Fresh' }));
    click('Save');
    await closed();
    await waitFor(() => expect(posts('entry')).toHaveLength(1));

    fireEvent.click(await screen.findByRole('button', { name: 'Mark Arvelin as given' }));
    await waitFor(() => expect(posts('entry')).toHaveLength(2));

    click('Add to Dinner');
    fireEvent.click(within(dialog()).getByText('Food'));
    fireEvent.click(within(dialog()).getByRole('radio', { name: 'Farm Fresh' }));
    click('Save');
    await closed();
    await waitFor(() => expect(posts('entry')).toHaveLength(3));

    click(/^Add$/);
    fireEvent.click(within(dialog()).getByText('Note'));
    fireEvent.change(within(dialog()).getByRole('textbox', { name: 'Note' }), { target: { value: 'Fictional note' } });
    click('Save');
    await closed();
    await waitFor(() => expect(posts('event')).toHaveLength(1));

    const nav = within(screen.getByRole('navigation'));
    fireEvent.click(nav.getByRole('button', { name: 'Pinned' }));
    click('Add pinned note');
    fireEvent.change(within(dialog()).getByLabelText('Note'), { target: { value: 'Fictional pin' } });
    click('Save');
    await closed();
    await waitFor(() => expect(posts('pinned_note')).toHaveLength(1));

    fireEvent.click(nav.getByRole('button', { name: 'Timeline' }));
    await screen.findByText('October 2026');
    click('Menu');
    fireEvent.click(within(dialog()).getByRole('button', { name: /Usual day/ }));
    await screen.findByRole('heading', { name: 'Usual day' });
    click('Add to Supper');
    fireEvent.click(within(dialog()).getByText('Medication'));
    fireEvent.click(await within(dialog()).findByRole('radio', { name: 'Arvelin' }));
    click('Save');
    await waitFor(() => expect(posts('schedule_slot').length).toBeGreaterThan(0));
    expect(await fake!.backend.sql(`select count(*)::int as n from entry where state <> 'removed'`)).toEqual([{ n: 3 }]);
  });

  it('after a save that got no answer, a different save goes through without a restart', async () => {
    await signedIn('/day/2026-10-15', 300);
    await screen.findAllByText('Cooked meal');
    click('Add to Breakfast');
    fireEvent.click(within(dialog()).getByText('Food'));
    fireEvent.click(within(dialog()).getByRole('radio', { name: 'Farm Fresh' }));
    fake!.backend.hangNext(1, (method, table) => method === 'POST' && table === 'entry');
    click('Save');
    expect(await screen.findByText("Couldn't save · Try again")).toBeTruthy();
    click('Close');
    await closed();

    // Something else entirely: a pinned note.
    fireEvent.click(within(screen.getByRole('navigation')).getByRole('button', { name: 'Pinned' }));
    click('Add pinned note');
    fireEvent.change(within(dialog()).getByLabelText('Note'), { target: { value: 'Fictional pin' } });
    click('Save');
    await closed();
    expect(await fake!.backend.sql(`select body from pinned_note`)).toEqual([{ body: 'Fictional pin' }]);
  });
});
