// JCB-71 on the real data path (App → LogProvider → time-limited SupabaseRepository → the app's
// Supabase client with its resilient fetch → fake backend): Save never stays stuck. A request that
// gets no answer releases the button with "Couldn't save · Try again"; trying again writes once;
// and a token refresh lost while the PWA was in the background no longer blocks every later save.
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { App } from '../src/App';
import { AUTH_STORAGE_KEY } from '../src/auth/supabaseClient';
import type { Repository } from '../src/data';
import { I18nProvider } from '../src/i18n';
import { SEED, fakeSession } from './harness/fakeBackend';
import { createFakeSupabase, type FakeSupabase } from './harness/fakeSupabase';

const NOW = () => new Date(2026, 9, 15, 16, 30); // Thu 15 Oct 2026, 16:30
let fake: FakeSupabase | null = null;
let visibility: DocumentVisibilityState = 'visible';
Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => visibility });
const setVisibility = (state: DocumentVisibilityState) => {
  visibility = state;
  document.dispatchEvent(new Event('visibilitychange'));
};

function mount(repository: Repository, path: string) {
  window.history.replaceState(null, '', path);
  render(
    <I18nProvider initial="en">
      <App repository={repository} />
    </I18nProvider>,
  );
}

const click = (name: string | RegExp) => fireEvent.click(screen.getByRole('button', { name }));
const dialog = () => screen.getByRole('dialog');
const rows = (sql: string) => fake!.backend.sql<Record<string, unknown>>(sql);
const saveButton = () => within(dialog()).getByRole('button', { name: 'Save' }) as HTMLButtonElement;
const posts = (table: string) => fake!.backend.log.filter((r) => r.method === 'POST' && r.table === table);

afterEach(async () => {
  cleanup();
  window.history.replaceState(null, '', '/');
  fake?.backend.release();
  await fake?.backend.close();
  fake = null;
  visibility = 'visible';
});

describe('Save never hangs (JCB-71)', () => {
  it('a write that gets no answer releases Save with a toast; trying again writes the entry once', async () => {
    // The request limit is long here, so the repository's own time limit is what releases the button.
    fake = await createFakeSupabase({ start: '2026-10-01', client: { requestTimeoutMs: 60_000 } });
    mount(fake.repository(NOW, 300), '/day/2026-10-15');
    await screen.findAllByText('Cooked meal');
    click('Add to Breakfast');
    fireEvent.click(within(dialog()).getByText('Food'));
    fireEvent.click(within(dialog()).getByRole('radio', { name: 'Farm Fresh' }));

    fake.backend.hangNext(1, (method, table) => method === 'POST' && table === 'entry');
    click('Save');
    await waitFor(() => expect(saveButton().disabled).toBe(true));
    expect(await screen.findByText("Couldn't save · Try again")).toBeTruthy();
    // The guard let go: the sheet is still open with what was picked, and Save works again.
    await waitFor(() => expect(saveButton().disabled).toBe(false));
    expect(within(dialog()).getByRole('radio', { name: 'Farm Fresh' }).getAttribute('aria-checked')).toBe('true');

    click('Save');
    expect(await screen.findByText('Saved')).toBeTruthy();
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    // The lost request reaches the server after all (as on the phone): same id, so still one entry.
    fake.backend.release();
    await waitFor(() => expect(posts('entry').length).toBe(2));
    const saved = await rows(`select id, item_id from entry where state <> 'removed'`);
    expect(saved).toHaveLength(1);
    expect(saved[0]?.item_id).toBe(SEED.items.farm);
  });

  it('a pinned note retried after a failed save is written once', async () => {
    fake = await createFakeSupabase({ start: '2026-10-01', client: { requestTimeoutMs: 60_000 } });
    mount(fake.repository(NOW, 300), '/pinned');
    expect(await screen.findByText(/Nothing pinned yet/)).toBeTruthy();
    click('Add pinned note');
    fireEvent.change(within(dialog()).getByLabelText('Note'), { target: { value: 'Fictional note' } });
    fake.backend.hangNext(1, (method, table) => method === 'POST' && table === 'pinned_note');
    click('Save');
    expect(await screen.findByText("Couldn't save · Try again")).toBeTruthy();
    fake.backend.release();
    await waitFor(() => expect(posts('pinned_note').length).toBe(1));
    await waitFor(() => expect(saveButton().disabled).toBe(false));
    click('Save');
    expect(await screen.findByText('1 note')).toBeTruthy();
    expect(await rows(`select body from pinned_note`)).toEqual([{ body: 'Fictional note' }]);
  });

  it('a tracked condition retried after a lost save is written once', async () => {
    fake = await createFakeSupabase({ start: '2026-10-01', client: { requestTimeoutMs: 60_000 } });
    mount(fake.repository(NOW, 300), '/tracked');
    fireEvent.click(await screen.findByRole('button', { name: 'Track something new' }));
    fireEvent.change(within(dialog()).getByLabelText('Name'), { target: { value: 'Fictional lump' } });
    fake.backend.hangNext(1, (method, table) => method === 'POST' && table === 'condition');
    click('Save');
    expect(await screen.findByText("Couldn't save · Try again")).toBeTruthy();
    fake.backend.release();
    await waitFor(() => expect(posts('condition').length).toBe(1));
    await waitFor(() => expect(saveButton().disabled).toBe(false));
    click('Save');
    expect(await screen.findByRole('heading', { name: 'Fictional lump' })).toBeTruthy();
    expect(await rows(`select name from condition`)).toEqual([{ name: 'Fictional lump' }]);
  });

  it('a token refresh lost in the background no longer blocks saving once the app is back', async () => {
    // Signed in with a stored session, as on the phone.
    const store = new Map<string, string>([[AUTH_STORAGE_KEY, JSON.stringify(fakeSession(SEED.user, 3600))]]);
    const storage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) };
    fake = await createFakeSupabase({
      start: '2026-10-01',
      client: { requestTimeoutMs: 60_000, auth: { persistSession: true, storageKey: AUTH_STORAGE_KEY, storage } },
    });
    mount(fake.repository(NOW, 10_000), '/day/2026-10-15');
    await screen.findAllByText('Cooked meal');
    click('Add to Breakfast');
    fireEvent.click(within(dialog()).getByText('Food'));
    fireEvent.click(within(dialog()).getByRole('radio', { name: 'Farm Fresh' }));

    // Time passed: the access token is about to expire, so the next call refreshes it first, and
    // that refresh is lost (the app went to the background while it ran).
    store.set(AUTH_STORAGE_KEY, JSON.stringify(fakeSession(SEED.user, 10)));
    fake.backend.hangNext(1, (method, path) => method === 'POST' && path === '/auth/v1/token');
    click('Save');
    setVisibility('hidden');
    await new Promise((r) => setTimeout(r, 400));
    // Stuck before reaching the server: this is what the CEO saw (no write in the logs).
    expect(posts('entry')).toHaveLength(0);
    expect(saveButton().disabled).toBe(true);

    // Back in the foreground: the lost refresh is dropped and retried, and the save goes through.
    setVisibility('visible');
    expect(await screen.findByText('Saved', {}, { timeout: 3000 })).toBeTruthy();
    expect(await rows(`select item_id from entry where state <> 'removed'`)).toEqual([{ item_id: SEED.items.farm }]);
  });
});
