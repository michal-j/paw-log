// JCB-71: the on-device request log keeps method, table, timing and outcome, never ids or content.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { App } from '../src/App';
import { I18nProvider } from '../src/i18n';
import { SEED } from './harness/fakeBackend';
import { createFakeSupabase, type FakeSupabase } from './harness/fakeSupabase';
import {
  DIAG_FLAG_KEY,
  DIAG_ROWS,
  applyDiagFlag,
  clearDiag,
  describeRequest,
  diagEnabled,
  diagRows,
  noteApp,
  noteRequest,
  resetDiagForTests,
  startDiag,
} from '../src/diag/requestLog';

const ID = '50000000-0000-4000-8000-000000000001';

beforeEach(() => {
  localStorage.clear();
  resetDiagForTests();
});
afterEach(() => {
  localStorage.clear();
  resetDiagForTests();
});

describe('request log', () => {
  it('describes a request by table, function or service only', () => {
    expect(describeRequest(`https://p.test/rest/v1/event?id=eq.${ID}`)).toBe('event');
    expect(describeRequest('https://p.test/rest/v1/event_condition?on_conflict=event_id,condition_id')).toBe('event_condition');
    expect(describeRequest('https://p.test/rest/v1/rpc/restore_pinned_note')).toBe('rpc restore_pinned_note');
    expect(describeRequest('https://p.test/auth/v1/token?grant_type=refresh_token')).toBe('auth token');
    expect(describeRequest(`https://p.test/storage/v1/object/sign/photos/${ID}/${ID}.jpg?token=abc`)).toBe('storage');
    expect(describeRequest(`https://p.test/rest/v1/${ID}`)).toBe('?');
  });

  it('keeps the last 30 rows with outcome and duration, and nothing that identifies a record', () => {
    for (let i = 0; i < DIAG_ROWS + 5; i++) noteRequest('get', `https://p.test/rest/v1/entry?id=eq.${ID}`)(200);
    const end = noteRequest('POST', `https://p.test/rest/v1/event?id=eq.${ID}`, 2);
    end('timeout');
    end(200); // only the first outcome counts
    const rows = diagRows();
    expect(rows).toHaveLength(DIAG_ROWS);
    expect(rows.at(-1)).toMatchObject({ kind: 'request', method: 'POST', what: 'event', attempt: 2, outcome: 'timeout' });
    expect(typeof (rows.at(-1) as { ms: number }).ms).toBe('number');
    expect(JSON.stringify(rows)).not.toContain(ID);
  });

  it('is switched by ?diag=1 and ?diag=0, and keeps its rows across a restart only while on', () => {
    expect(diagEnabled()).toBe(false);
    applyDiagFlag('?diag=1');
    expect(localStorage.getItem(DIAG_FLAG_KEY)).toBe('1');
    noteRequest('POST', 'https://p.test/rest/v1/pinned_note')(201);
    resetDiagForTests(); // the app restarts
    startDiag(window);
    expect(diagRows().map((r) => (r.kind === 'app' ? r.event : r.what))).toEqual(['pinned_note', 'start']);
    noteApp('hidden');
    applyDiagFlag('?diag=0');
    expect(diagEnabled()).toBe(false);
    expect(localStorage.length).toBe(0);
    clearDiag();
    expect(diagRows()).toEqual([]);
  });
});

describe('request log in the Menu, real data path', () => {
  let fake: FakeSupabase | null = null;
  afterEach(async () => {
    cleanup();
    window.history.replaceState(null, '', '/');
    await fake?.backend.close();
    fake = null;
  });

  it('is hidden until five quick taps on the Menu heading; then lists the requests, newest first', async () => {
    fake = await createFakeSupabase({ start: '2026-10-01' });
    window.history.replaceState(null, '', '/pinned');
    render(
      <I18nProvider initial="en">
        <App repository={fake.repository(() => new Date(2026, 9, 15, 16, 30))} />
      </I18nProvider>,
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Menu' }));
    const menu = screen.getByRole('dialog');
    expect(within(menu).queryByText('Request log')).toBeNull();
    const heading = within(menu).getByRole('heading', { name: 'Menu' });
    for (let i = 0; i < 5; i++) fireEvent.click(heading);
    expect(await screen.findByText('Request log on: scroll to the bottom of the Menu')).toBeTruthy();
    const log = await within(menu).findByRole('list', { name: 'Request log' });
    expect(within(log).getAllByRole('listitem')[0]!.textContent).toMatch(/^\d\d:\d\d:\d\d\.\d{3} {2}GET \w+ {2}\d+ ms {2}200/);
    expect(log.textContent).not.toContain(SEED.dog);
    expect(within(menu).getByRole('button', { name: 'Copy' })).toBeTruthy();
    for (let i = 0; i < 5; i++) fireEvent.click(heading);
    await waitFor(() => expect(within(menu).queryByText('Request log')).toBeNull());
    expect(await screen.findByText('Request log off')).toBeTruthy();
  });
});
