import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import { App } from '../src/App';
import { DemoRepository } from '../src/data';
import { I18nProvider, detectLang, translate } from '../src/i18n';

const mount = () =>
  render(
    <I18nProvider initial="en">
      <App repository={new DemoRepository(null)} />
    </I18nProvider>,
  );

beforeEach(() => localStorage.clear());
afterEach(cleanup);

describe('timeline home', () => {
  it('renders the timeline from the demo repository without sign-in', async () => {
    mount();
    expect(await screen.findByText('October 2026')).toBeTruthy();
    expect(screen.getByText('September 2026')).toBeTruthy();
    expect(screen.getByText(/Wednesday 14 October: Vet visit ×2/)).toBeTruthy();
    expect(screen.getByText('Demo with sample data. Changes stay in this browser.')).toBeTruthy();
  });

  it('switches language EN to PL and remembers it', async () => {
    mount();
    await screen.findByText('October 2026');
    fireEvent.click(screen.getByRole('button', { name: 'Menu' }));
    fireEvent.click(await screen.findByRole('button', { name: 'PL' }));
    fireEvent.click(screen.getByRole('button', { name: 'Zamknij' }));
    expect(screen.getByText(/Demo z przykładowymi danymi/)).toBeTruthy();
    expect(screen.getByText('październik 2026')).toBeTruthy();
    expect(screen.getByText(/14 października: .*Niepokój, Wymioty/)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Klucz dla dnia poniżej/ })).toBeTruthy();
    expect(localStorage.getItem('pawlog.lang')).toBe('pl');
  });

  it('sets <html lang> from the stored language on a fresh load', async () => {
    document.documentElement.lang = 'en';
    render(
      <I18nProvider initial="pl">
        <App repository={new DemoRepository(null)} />
      </I18nProvider>,
    );
    expect(document.documentElement.lang).toBe('pl');
    await screen.findByText('październik 2026');
  });

  it('scrubs the rail to the first day when the list cannot scroll (log fits on one screen)', async () => {
    mount();
    await screen.findByText('October 2026');
    // jsdom has no layout: the list's scroll range is 0, as for a short log on a tall screen.
    const rail = screen.getByRole('scrollbar');
    rail.getBoundingClientRect = () => ({ top: 0, left: 0, right: 20, bottom: 502, width: 20, height: 502, x: 0, y: 0, toJSON: () => ({}) });
    const keyDay = () => document.querySelector('.tl-key__day')?.textContent;
    expect(keyDay()).toBe('15 Oct');
    fireEvent.pointerDown(rail, { clientY: 500, pointerId: 1 });
    expect(keyDay()).toBe('1 Sept');
    expect(rail.getAttribute('aria-valuenow')).toBe('100');
    fireEvent.pointerMove(rail, { clientY: 250, pointerId: 1 });
    expect(keyDay()).not.toBe('1 Sept');
    expect(keyDay()).not.toBe('15 Oct');
    fireEvent.pointerUp(rail, { pointerId: 1 });
    // The focus stays where the rail left it, and the rows still open.
    expect(keyDay()).not.toBe('15 Oct');
    expect(screen.getByText(/Wednesday 14 October: Vet visit ×2/).closest('a')?.getAttribute('href')).toContain('2026-10-14');
  });

  it('opens the Key legend', async () => {
    mount();
    const key = await screen.findByRole('button', { name: /Key for the day below/ });
    expect(key.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(key);
    expect(key.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByText('Skipped / refused')).toBeTruthy();
    expect(screen.getByText('Frontline (monthly)')).toBeTruthy();
  });
});

describe('day view', () => {
  const at = (path: string, repository = new DemoRepository(null), initial: 'en' | 'pl' = 'en') => {
    window.history.replaceState(null, '', path);
    return render(
      <I18nProvider initial={initial}>
        <App repository={repository} />
      </I18nProvider>,
    );
  };
  afterEach(() => window.history.replaceState(null, '', '/'));

  it('opens from a Timeline row and goes back to the Timeline', async () => {
    at('/demo');
    const row = await screen.findByRole('link', { name: /Wednesday 14 October/ });
    expect(row.getAttribute('href')).toBe('/demo/day/2026-10-14');
    fireEvent.click(row);
    expect(window.location.pathname).toBe('/demo/day/2026-10-14');
    expect(await screen.findByRole('heading', { name: /Wed,? 14 October 2026/ })).toBeTruthy();
    // The Day view's Timeline button (the navbar has one too).
    fireEvent.click(screen.getAllByRole('button', { name: 'Timeline' })[0] as HTMLElement);
    expect(await screen.findByText('October 2026')).toBeTruthy();
    expect(window.location.pathname).toBe('/demo');
  });

  it('shows every entry by day part, with states, and the events', async () => {
    at('/demo/day/2026-10-14');
    expect(await screen.findByText('Treat, chicken')).toBeTruthy(); // hidden by default on the Timeline
    expect(screen.getByText('Before breakfast')).toBeTruthy();
    expect(screen.getByText('After supper')).toBeTruthy();
    expect(screen.getByText('Nothing scheduled')).toBeTruthy();
    expect(screen.getByText('Refused')).toBeTruthy();
    expect(screen.getByText('Partly eaten')).toBeTruthy(); // one term for partial food
    expect(screen.getByText('What happened')).toBeTruthy();
    expect(screen.getByRole('button', { name: /^Vet visit · Maple Vet/ })).toBeTruthy(); // tap to edit
    expect(screen.getByText('Restlessness')).toBeTruthy();
    expect(screen.getByText('Yesterday')).toBeTruthy();
  });

  it('stops previous at the first record and next at today', async () => {
    at('/demo/day/2026-10-15');
    await screen.findByText('Today');
    const next = screen.getByRole('button', { name: 'Next day' });
    expect(next.getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(next);
    expect(window.location.pathname).toBe('/demo/day/2026-10-15');
    fireEvent.click(screen.getByRole('button', { name: 'Previous day' }));
    expect(window.location.pathname).toBe('/demo/day/2026-10-14');
    expect(await screen.findByRole('heading', { name: /Wed,? 14 October 2026/ })).toBeTruthy();
    cleanup();

    at('/demo/day/2026-09-01');
    await screen.findByText('Cooked meal');
    expect(screen.getByRole('heading', { name: /Tue,? 1 September 2026/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Previous day' }).getAttribute('aria-disabled')).toBe('true');
    expect(screen.getByRole('button', { name: 'Next day' }).getAttribute('aria-disabled')).toBeNull();
  });

  it('falls back to the Timeline for invalid or out-of-range dates', async () => {
    at('/demo/day/2026-02-30');
    expect(window.location.pathname).toBe('/demo');
    expect(await screen.findByText('October 2026')).toBeTruthy();
    cleanup();
    at('/demo/day/2026-10-16');
    expect(await screen.findByText('October 2026')).toBeTruthy();
    expect(window.location.pathname).toBe('/demo');
  });

  it('shows the empty-day state when nothing is logged or planned', async () => {
    const repository = new DemoRepository(null);
    for (const e of await repository.listEntries({ from: '2026-10-01', to: '2026-10-01' })) await repository.deleteEntry(e.id);
    for (const s of await repository.listScheduleSlots()) await repository.deleteScheduleSlot(s.id);
    at('/demo/day/2026-10-01', repository);
    expect(await screen.findByText(/Nothing logged for this date yet/)).toBeTruthy();
    expect(screen.getAllByText('Nothing scheduled')).toHaveLength(7);
  });

  it('reads in Polish', async () => {
    at('/demo/day/2026-10-14', new DemoRepository(null), 'pl');
    expect(await screen.findByRole('heading', { name: /14 października 2026/ })).toBeTruthy();
    expect(screen.getByText('Co się wydarzyło')).toBeTruthy();
    expect(screen.getByText('Niepokój')).toBeTruthy();
    expect(screen.getByText('Odmowa')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Poprzedni dzień' })).toBeTruthy();
    expect(screen.getAllByRole('button', { name: 'Oś czasu' })).toHaveLength(2);
  });
});

describe('i18n helpers', () => {
  it('detects the language', () => {
    expect(detectLang(null, 'pl-PL')).toBe('pl');
    expect(detectLang(null, 'en-GB')).toBe('en');
    expect(detectLang('en', 'pl-PL')).toBe('en');
  });
  it('falls back to the key for unknown strings', () => {
    expect(translate('pl', 'does.not.exist')).toBe('does.not.exist');
  });
});
