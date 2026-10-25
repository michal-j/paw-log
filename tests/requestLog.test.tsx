// JCB-71: the on-device activity log keeps requests (method, table, timing, outcome), taps and toasts by
// interface string only, never ids or content; it is always on in the real app and shown in the Menu.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { App } from '../src/App';
import { I18nProvider } from '../src/i18n';
import { SEED } from './harness/fakeBackend';
import { createFakeSupabase, type FakeSupabase } from './harness/fakeSupabase';
import {
  DIAG_MAX_ROWS,
  clearDiag,
  describeRequest,
  diagRows,
  noteAction,
  noteApp,
  noteRequest,
  resetDiagForTests,
  startDiag,
} from '../src/diag/requestLog';
import { describeTap, describeToast, routeOf } from '../src/diag/taps';

const ID = '50000000-0000-4000-8000-000000000001';
const text = (r: { kind: string; what?: string; text?: string; event?: string }) => r.text ?? r.what ?? r.event;

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

  it('keeps outcome and duration, nothing that identifies a record, and far more than 30 rows', () => {
    for (let i = 0; i < 300; i++) noteRequest('get', `https://p.test/rest/v1/entry?id=eq.${ID}`)(200);
    const end = noteRequest('POST', `https://p.test/rest/v1/event?id=eq.${ID}`, 2);
    end('timeout');
    end(200); // only the first outcome counts
    const rows = diagRows();
    expect(rows).toHaveLength(301);
    expect(rows.at(-1)).toMatchObject({ kind: 'request', method: 'POST', what: 'event', attempt: 2, outcome: 'timeout' });
    expect(typeof (rows.at(-1) as { ms: number }).ms).toBe('number');
    expect(JSON.stringify(rows)).not.toContain(ID);
  });

  it('stops at the row limit, newest kept', () => {
    for (let i = 0; i < DIAG_MAX_ROWS + 5; i++) noteApp('online');
    expect(diagRows()).toHaveLength(DIAG_MAX_ROWS);
  });

  it('is always on: restores rows from before a restart, drops those older than a week, and clears on request', () => {
    startDiag(window);
    noteRequest('POST', 'https://p.test/rest/v1/pinned_note')(201);
    window.dispatchEvent(new Event('pagehide')); // written at once when the page goes away
    const kept = JSON.parse(localStorage.getItem('pawlog.diag.log') ?? '[]') as { at: number }[];
    kept.unshift({ kind: 'app', n: 0, at: Date.now() - 8 * 24 * 3600 * 1000, event: 'start' } as never);
    localStorage.setItem('pawlog.diag.log', JSON.stringify(kept));
    resetDiagForTests(); // the app restarts
    startDiag(window);
    expect(diagRows().map(text)).toEqual(['start', 'pinned_note', 'start']);
    clearDiag();
    expect(diagRows()).toEqual([]);
    expect(JSON.parse(localStorage.getItem('pawlog.diag.log') ?? 'null')).toEqual([]);
  });

  it('records nothing until the real app starts it (demo mode keeps no log)', () => {
    noteAction('tap "Save" on /day');
    expect(diagRows()).toEqual([]);
  });
});

describe('taps and toasts: interface strings only', () => {
  const button = (label: string, inside = '') => {
    document.body.innerHTML = `${inside}<button id="b">${label}</button>${inside ? '</div>' : ''}`;
    return document.getElementById('b');
  };

  it('names a control by its label when that is one of the app\'s own strings, in either language', () => {
    expect(describeTap(button('Save'), '/day/2026-10-15')).toBe('tap "Save" on /day');
    expect(describeTap(button('Zapisz'), '/demo/tracked/condition-001')).toBe('tap "Zapisz" on /tracked');
  });

  it('never writes down text that is not an interface string (items, clinics, notes, conditions)', () => {
    expect(describeTap(button('Maple Vet, Ultrasound for Pip'), '/day/2026-10-15')).toBe('tap (other) on /day');
    expect(describeToast('Saved')).toBe('toast "Saved"');
    expect(describeToast('Maple Vet visit removed')).toBe('toast');
  });

  it('says which sheet a tap was in, and leaves typed fields unnamed', () => {
    const b = button('Save', '<div role="dialog"><h2>Menu</h2>');
    expect(describeTap(b, '/pinned')).toBe('tap "Save" in "Menu"');
    document.body.innerHTML = '<input id="i" value="secret note text">';
    expect(describeTap(document.getElementById('i'), '/')).toBe('tap field on /');
    expect(describeTap(document.body, '/search')).toBe('tap (no control) on /search');
    expect(routeOf('/demo/day/2026-10-15')).toBe('/day');
    expect(routeOf('/')).toBe('/');
  });

  it('startDiag records real clicks', () => {
    startDiag(window);
    fireEvent.click(button('Close')!);
    // (earlier tests in this file also started listeners on the same document, so a click may appear more than once)
    expect(diagRows().map(text)).toContain('tap "Close" on /');
  });
});

describe('activity log in the Menu, real data path', () => {
  let fake: FakeSupabase | null = null;
  afterEach(async () => {
    cleanup();
    window.history.replaceState(null, '', '/');
    await fake?.backend.close();
    fake = null;
  });

  it('is in the Menu with no trigger; lists requests, taps and toasts, newest first, with the date', async () => {
    fake = await createFakeSupabase({ start: '2026-10-01' });
    window.history.replaceState(null, '', '/pinned');
    startDiag(window);
    render(
      <I18nProvider initial="en">
        <App repository={fake.repository(() => new Date(2026, 9, 15, 16, 30))} onSignOut={() => undefined} />
      </I18nProvider>,
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Menu' }));
    const menu = screen.getByRole('dialog');
    const log = await within(menu).findByRole('list', { name: 'Request log' });
    const lines = within(log).getAllByRole('listitem').map((li) => li.textContent ?? '');
    expect(lines[0]).toMatch(/^\d\d\.\d\d \d\d:\d\d:\d\d\.\d{3} {2}tap "Menu" on \/pinned$/);
    expect(lines.some((l) => / {2}GET \w+ {2}\d+ ms {2}200/.test(l))).toBe(true);
    expect(log.textContent).not.toContain(SEED.dog);
    expect(within(menu).getByRole('button', { name: 'Copy' })).toBeTruthy();
    expect(within(menu).getByRole('button', { name: 'Clear' })).toBeTruthy();
  });
});
