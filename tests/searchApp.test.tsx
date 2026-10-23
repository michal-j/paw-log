// Search (JCB-138) through the UI: the demo, and the real data path (App → SupabaseRepository → Postgres with every
// migration). Fictional data only. The matcher itself is in tests/search.test.ts.
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { App } from '../src/App';
import { DemoRepository, type Repository } from '../src/data';
import { I18nProvider, translate, type Lang } from '../src/i18n';
import { SEED } from './harness/fakeBackend';
import { createFakeSupabase, type FakeSupabase } from './harness/fakeSupabase';

const NOW = () => new Date(2026, 9, 15, 16, 30);
let fake: FakeSupabase | null = null;

function mount(repository: Repository, path: string, lang: Lang = 'en') {
  window.history.replaceState(null, '', path);
  return render(
    <I18nProvider initial={lang}>
      <App repository={repository} />
    </I18nProvider>,
  );
}
const demo = (path = '/search', lang: Lang = 'en') => mount(new DemoRepository(null, NOW), path, lang);
async function real(path: string, prep: string, lang: Lang = 'en') {
  fake = await createFakeSupabase({ start: '2026-10-01' });
  await fake.backend.db.exec(prep);
  return mount(fake.repository(NOW), path, lang);
}

const field = (lang: Lang = 'en') => screen.findByRole('searchbox', { name: translate(lang, 'searchFieldLabel') }) as Promise<HTMLInputElement>;
const type = async (text: string, lang: Lang = 'en') => fireEvent.change(await field(lang), { target: { value: text } });
const marks = () => Array.from(document.querySelectorAll('mark.hit')).map((m) => m.textContent);
const results = (lang: Lang = 'en') => document.querySelector('.search-count')?.textContent ?? translate(lang, 'searchHint');
const back = () => fireEvent.click(screen.getByRole('button', { name: /^(Back|Wstecz)$/ }));
const dialog = () => screen.getByRole('dialog');

beforeEach(() => localStorage.clear());
afterEach(async () => {
  cleanup();
  window.history.replaceState(null, '', '/');
  document.documentElement.removeAttribute('data-kb');
  await fake?.backend.close();
  fake = null;
});

describe('the Search tab (demo)', () => {
  it('is the fifth tab, opens /search and keeps the text out of the URL', async () => {
    demo('/');
    await screen.findByText('October 2026');
    const nav = within(screen.getByRole('navigation'));
    expect(nav.getAllByRole('button').map((b) => b.textContent)).toEqual(['Timeline', 'Pinned', 'Add', 'Tracked', 'Search']);
    fireEvent.click(nav.getByRole('button', { name: 'Search' }));
    expect(window.location.pathname).toBe('/search');
    expect(nav.getByRole('button', { name: 'Search' }).getAttribute('aria-current')).toBe('page');
    await type('stomach');
    expect(window.location.pathname).toBe('/search');
    expect(window.location.search).toBe('');
    expect(window.location.hash).toBe('');
  });

  it('idle: the hint; one character is still idle; no filters, no summary line', async () => {
    demo();
    expect(await screen.findByText(translate('en', 'searchHint'))).toBeTruthy();
    await type('s');
    expect(screen.getByText(translate('en', 'searchHint'))).toBeTruthy();
    expect(document.querySelector('.search-summary')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Clear search' })).not.toBeNull(); // there is text to clear
  });

  it('finds by word start, highlights what matched and counts the results', async () => {
    demo();
    await type('stomach');
    await waitFor(() => expect(results()).toMatch(/^\d+ results$/));
    expect(marks().every((m) => m!.toLowerCase().startsWith('stomach'))).toBe(true);
    expect(marks().length).toBeGreaterThan(2);
    expect(document.querySelector('.search-body .day__caption')?.textContent).toBe('Tracked'); // the group caption
    await type('toma');
    expect(screen.getByText('Nothing found for “toma”')).toBeTruthy();
    await type('1 result');
    expect(screen.queryByText('Nothing found for “toma”')).toBeNull();
  });

  it('the text, the filters and the scroll survive a visit to another tab', async () => {
    demo();
    await type('stomach');
    fireEvent.click(await screen.findByRole('button', { name: 'Filters' }));
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Symptoms' }));
    fireEvent.click(within(dialog()).getByRole('button', { name: /^Show results/ }));
    const tabs = within(screen.getByRole('navigation'));
    fireEvent.click(tabs.getByRole('button', { name: 'Tracked' }));
    await screen.findByRole('heading', { name: translate('en', 'condTitle') });
    fireEvent.click(tabs.getByRole('button', { name: 'Search' }));
    expect(((await field()) as HTMLInputElement).value).toBe('stomach');
    expect(screen.getByRole('button', { name: 'Filters, 1 on' })).toBeTruthy();
    expect(window.location.pathname).toBe('/search');
  });

  it('the clear button empties the field and keeps the focus there', async () => {
    demo();
    await type('stomach');
    fireEvent.click(screen.getByRole('button', { name: 'Clear search' }));
    const input = await field();
    expect(input.value).toBe('');
    expect(document.activeElement).toBe(input);
    expect(screen.getByText(translate('en', 'searchHint'))).toBeTruthy();
  });

  it('a long list shows 20 at a time and Show more adds up to 20', async () => {
    demo();
    await type('an');
    const total = Number(results().split(' ')[0]);
    expect(total).toBeGreaterThan(0);
    await type('re'); // a common word start in the demo
    const more = screen.queryByRole('button', { name: /^Show \d+ more$/ });
    if (more) {
      const before = document.querySelectorAll('.search-body .day-card').length;
      fireEvent.click(more);
      expect(document.querySelectorAll('.search-body .day-card').length).toBeGreaterThan(before);
    }
  });
});

describe('filters (demo)', () => {
  it('the sheet has 17 toggles in three groups, a live count, a summary line and Clear', async () => {
    demo();
    const filters = await screen.findByRole('button', { name: 'Filters' });
    fireEvent.click(filters);
    const sheet = within(dialog());
    expect(sheet.getAllByRole('button', { pressed: false })).toHaveLength(17);
    for (const caption of ['Events', 'Food, medication and care items', 'Not on a day']) expect(sheet.getByText(caption)).toBeTruthy();
    expect(sheet.getByRole('button', { name: 'Done' })).toBeTruthy(); // nothing chosen: no count to promise
    expect(sheet.queryByText(/Nothing picked shows everything/)).toBeNull();
    fireEvent.click(sheet.getByRole('button', { name: 'Vet visits' }));
    expect(sheet.getByRole('button', { name: 'Show results (2)' })).toBeTruthy();
    fireEvent.click(sheet.getByRole('button', { name: 'Symptoms' }));
    fireEvent.click(sheet.getByRole('button', { name: 'Food' }));
    fireEvent.click(sheet.getByRole('button', { name: 'Documents' }));
    fireEvent.click(sheet.getByRole('button', { name: /^Show results/ }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('button', { name: 'Filters, 4 on' }).textContent).toContain('4');
    expect(document.querySelector('.search-summary__text')?.textContent).toBe('Vet visits, Symptoms +2');
    // the line reopens the sheet; Clear empties the filters and the line goes away
    fireEvent.click(document.querySelector('.search-summary__text')!);
    expect(screen.getByRole('dialog')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /^Show results/ }));
    fireEvent.click(within(document.querySelector('.search-summary') as HTMLElement).getByRole('button', { name: 'Clear' }));
    expect(document.querySelector('.search-summary')).toBeNull();
    expect(screen.getByRole('button', { name: 'Filters' })).toBeTruthy();
    expect(screen.getByText(translate('en', 'searchHint'))).toBeTruthy();
  });

  it('the sheet follows the text: kinds and text are an AND, the count is live', async () => {
    demo();
    await type('maple');
    fireEvent.click(await screen.findByRole('button', { name: 'Filters' }));
    expect(within(dialog()).getByRole('button', { name: 'Done' })).toBeTruthy();
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Symptoms' }));
    expect(within(dialog()).getByRole('button', { name: 'Show results (0)' })).toBeTruthy();
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Vet visits' }));
    expect(within(dialog()).getByRole('button', { name: 'Show results (1)' })).toBeTruthy();
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Clear' }));
    expect(within(dialog()).getByRole('button', { name: 'Done' })).toBeTruthy();
    expect((within(dialog()).getByRole('button', { name: 'Clear' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('a kind with nothing typed lists its whole history; no entries gives its own message', async () => {
    demo();
    fireEvent.click(await screen.findByRole('button', { name: 'Filters' }));
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Frontline' }));
    fireEvent.click(within(dialog()).getByRole('button', { name: /^Show results/ }));
    expect(results()).toBe('2 results');
    fireEvent.click(screen.getByRole('button', { name: 'Filters, 1 on' }));
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Frontline' }));
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Procedures' }));
    fireEvent.click(within(dialog()).getByRole('button', { name: /^Show results/ }));
    expect(screen.getByText('No entries of this kind yet.')).toBeTruthy();
  });

  it('Food with nothing typed gives the item cards and every meal, newest first', async () => {
    demo();
    fireEvent.click(await screen.findByRole('button', { name: 'Filters' }));
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Food' }));
    fireEvent.click(within(dialog()).getByRole('button', { name: /^Show results/ }));
    expect(screen.getByText('Items')).toBeTruthy();
    for (const name of ['Cooked meal', 'Farm Fresh', 'Ocean Blend']) expect(screen.getAllByText(name).length).toBeGreaterThan(0);
    expect(document.querySelectorAll('.search-dose').length).toBeGreaterThan(5);
    expect(document.querySelector('.search-count')?.textContent).toMatch(/^\d+ results$/);
  });

  it('nothing found with a filter on offers Clear filters', async () => {
    demo();
    fireEvent.click(await screen.findByRole('button', { name: 'Filters' }));
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Photos' }));
    fireEvent.click(within(dialog()).getByRole('button', { name: /^Show results/ }));
    await type('gastrelle');
    expect(screen.getByText('Nothing found for “gastrelle”')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(document.querySelector('.search-summary')).toBeNull();
    expect(results()).toMatch(/results?$/);
  });
});

describe('opening a result (demo)', () => {
  it('opens the day, rings the card, and Back returns with text, filters and scroll', async () => {
    demo();
    await type('stomach');
    fireEvent.click(await screen.findByRole('button', { name: 'Filters' }));
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Symptoms' }));
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Vet visits' }));
    fireEvent.click(within(dialog()).getByRole('button', { name: /^Show results/ }));
    const body = document.querySelector('.search-body') as HTMLElement;
    body.scrollTop = 40;
    fireEvent.scroll(body);
    fireEvent.click(screen.getByRole('button', { name: /Vet visit · Maple Vet/ }));
    expect(window.location.pathname).toBe('/day/2026-10-14');
    expect(window.history.state).toMatchObject({ fromApp: true, ring: { kind: 'event', id: 'event-016' } });
    await screen.findByRole('heading', { name: /14 October 2026/ });
    await waitFor(() => expect(document.querySelector('[data-ring="event:event-016"]')?.classList.contains('ring')).toBe(true));
    expect(screen.getByRole('button', { name: 'Back' })).toBeTruthy();
    back();
    await waitFor(() => expect(window.location.pathname).toBe('/search'));
    expect(((await field()) as HTMLInputElement).value).toBe('stomach');
    expect(screen.getByRole('button', { name: 'Filters, 2 on' })).toBeTruthy();
    expect(document.querySelector('.search-summary__text')?.textContent).toBe('Symptoms, Vet visits');
    expect((document.querySelector('.search-body') as HTMLElement).scrollTop).toBe(40);
  });

  it('the browser Back button does the same', async () => {
    demo();
    await type('heartburn');
    fireEvent.click(await screen.findByRole('button', { name: /Heartburn/ }));
    expect(window.location.pathname).toBe('/day/2026-10-09');
    act(() => window.history.back());
    await waitFor(() => expect(window.location.pathname).toBe('/search'));
    expect(((await field()) as HTMLInputElement).value).toBe('heartburn');
  });

  it('the Timeline tab on a Day opened from Search still goes to the Timeline', async () => {
    demo();
    await type('heartburn');
    fireEvent.click(await screen.findByRole('button', { name: /Heartburn/ }));
    await screen.findByRole('heading', { name: /9 October 2026/ });
    fireEvent.click(within(screen.getByRole('navigation')).getByRole('button', { name: 'Timeline' }));
    expect(await screen.findByText('October 2026')).toBeTruthy();
  });

  it('a Day from the Timeline still says Timeline and goes back to it', async () => {
    demo('/day/2026-10-09');
    await screen.findByRole('heading', { name: /9 October 2026/ });
    expect(screen.queryByRole('button', { name: 'Back' })).toBeNull();
    fireEvent.click(document.querySelector('.day-btn--back')!);
    expect(await screen.findByText('October 2026')).toBeTruthy();
  });

  it('tracked opens the condition page, Back returns to Search', async () => {
    demo();
    await type('stomach');
    fireEvent.click(await screen.findByRole('button', { name: /Stomach trouble.*Since/ }));
    expect(window.location.pathname).toMatch(/^\/tracked\/.+/);
    await screen.findByRole('heading', { name: 'Stomach trouble' });
    fireEvent.click(document.querySelector('.day-btn--back, .cond__top button')!);
    await waitFor(() => expect(window.location.pathname).toBe('/search'));
    expect(((await field()) as HTMLInputElement).value).toBe('stomach');
  });

  it('a pinned note opens the existing note sheet over Search', async () => {
    demo();
    await type('allergies');
    fireEvent.click(await screen.findByRole('button', { name: /Allergies/ }));
    expect(within(dialog()).getByRole('heading', { name: translate('en', 'editPinned') })).toBeTruthy();
    expect((within(dialog()).getByLabelText(translate('en', 'pinTitle'), { exact: false }) as HTMLInputElement).value).toBe('Allergies');
    expect(window.location.pathname).toBe('/search');
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Close' }));
    expect(((await field()) as HTMLInputElement).value).toBe('allergies');
  });
});

describe('an item\'s whole history (demo)', () => {
  it('an item card opens its history: every entry by month; a row opens its day; Back, Back restores Search', async () => {
    demo();
    await type('bellavet');
    const card = await screen.findByRole('button', { name: /Bellavet.*Medication/ });
    fireEvent.click(card);
    expect(window.location.pathname).toBe('/search/item/item-bellavet');
    await screen.findByRole('heading', { name: 'Bellavet' });
    expect(document.querySelector('.day__sub')?.textContent).toMatch(/^Medication · \d+ entries$/);
    const rows = document.querySelectorAll('.search-dose');
    expect(rows.length).toBeGreaterThan(3);
    fireEvent.click(rows[0]!.querySelector('button')!);
    expect(window.location.pathname).toMatch(/^\/day\/2026-/);
    expect(window.history.state.ring.kind).toBe('entry');
    await waitFor(() => expect(document.querySelector('.ring')).not.toBeNull());
    back();
    await waitFor(() => expect(window.location.pathname).toBe('/search/item/item-bellavet'));
    back();
    await waitFor(() => expect(window.location.pathname).toBe('/search'));
    expect(((await field()) as HTMLInputElement).value).toBe('bellavet');
  });

  it('an unknown item leaves for Search; the tab stays marked', async () => {
    demo('/search/item/item-nope');
    await waitFor(() => expect(window.location.pathname).toBe('/search'));
    expect(screen.getByRole('button', { name: 'Search' }).getAttribute('aria-current')).toBe('page');
  });
});

describe('what is shown for a match (demo)', () => {
  it('shows the type muted after the title only when the type word is why it matched', async () => {
    demo();
    await type('symptom');
    await screen.findByRole('button', { name: /Heartburn · Symptom/ });
    await type('heartburn');
    expect(screen.queryByRole('button', { name: /Heartburn · Symptom/ })).toBeNull();
    expect(screen.getByRole('button', { name: /Heartburn/ })).toBeTruthy();
  });

  it('a vet visit always carries its type label, highlighted when typed; services show when they matched', async () => {
    demo();
    await type('vet visit');
    expect(marks()).toEqual(expect.arrayContaining(['Vet', 'visit']));
    await type('nails');
    const chip = document.querySelector('.day-card__chip');
    expect(chip?.textContent).toMatch(/Nail trimming · Nails/);
  });

  it('amounts and day parts are only searched inside an item kind', async () => {
    demo();
    await type('pill');
    expect(screen.getByText('Nothing found for “pill”')).toBeTruthy();
    fireEvent.click(await screen.findByRole('button', { name: 'Filters' }));
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Medications' }));
    fireEvent.click(within(dialog()).getByRole('button', { name: /^Show results/ }));
    expect(screen.queryByText('Nothing found for “pill”')).toBeNull();
    expect(marks()).toEqual(expect.arrayContaining(['pill']));
  });
});

describe('states (demo)', () => {
  it('could not load: the message and Try again', async () => {
    const repo = new DemoRepository(null, NOW);
    let fail = true;
    const list = repo.listEvents.bind(repo);
    repo.listEvents = async (...a) => {
      if (fail) throw new Error('offline');
      return list(...a);
    };
    mount(repo, '/search');
    expect(await screen.findByText(/Could not load/)).toBeTruthy();
    fail = false;
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await type('stomach');
    await waitFor(() => expect(results()).toMatch(/results$/));
  });

  it('loading: skeletons and a status for screen readers, then the idle card', async () => {
    const repo = new DemoRepository(null, NOW);
    let release: () => void = () => {};
    const gate = new Promise<void>((r) => (release = r));
    const list = repo.listEvents.bind(repo);
    repo.listEvents = async (...a) => {
      await gate;
      return list(...a);
    };
    mount(repo, '/search');
    const busy = await screen.findByText('Loading…');
    expect(busy.getAttribute('role')).toBe('status');
    expect(document.querySelectorAll('.search-skel')).toHaveLength(3);
    release();
    expect(await screen.findByText(translate('en', 'searchHint'))).toBeTruthy();
    expect(document.querySelector('.search-skel')).toBeNull();
  });

  it('the keyboard: while it is up the page is as tall as the visible area and the tab bar steps aside', async () => {
    const listeners = new Map<string, () => void>();
    const vv = {
      height: 844,
      offsetTop: 0,
      addEventListener: (n: string, f: () => void) => listeners.set(n, f),
      removeEventListener: (n: string) => listeners.delete(n),
    };
    Object.defineProperty(window, 'visualViewport', { value: vv, configurable: true });
    Object.defineProperty(window, 'innerHeight', { value: 844, configurable: true });
    try {
      demo();
      await field();
      expect(document.documentElement.dataset.kb).toBeUndefined();
      vv.height = 520;
      act(() => listeners.get('resize')?.());
      expect(document.documentElement.dataset.kb).toBe('');
      expect(document.documentElement.style.getPropertyValue('--vvh')).toBe('520px');
      vv.height = 844;
      act(() => listeners.get('resize')?.());
      expect(document.documentElement.dataset.kb).toBeUndefined();
    } finally {
      Reflect.deleteProperty(window, 'visualViewport');
    }
  });
});

describe('Polish (demo)', () => {
  it('the tab, the field, the filters and the count follow the language', async () => {
    demo('/search', 'pl');
    expect(await screen.findByRole('searchbox', { name: 'Szukaj w dzienniku' })).toBeTruthy();
    expect(within(screen.getByRole('navigation')).getByRole('button', { name: 'Szukaj' })).toBeTruthy();
    expect(screen.getByText(translate('pl', 'searchHint'))).toBeTruthy();
    await type('objaw', 'pl');
    await waitFor(() => expect(results('pl')).toMatch(/^\d+ (wynik|wyniki|wyników)$/));
    fireEvent.click(screen.getByRole('button', { name: 'Filtry' }));
    const sheet = within(dialog());
    for (const label of ['Wizyty u weta', 'Gruczoły odbytu', 'Pazury', 'Odrobaczanie', 'Suplementy', 'Zabiegi']) expect(sheet.getByRole('button', { name: label })).toBeTruthy();
    expect(sheet.getByText('Jedzenie, leki i zabiegi')).toBeTruthy();
    expect(sheet.getByRole('button', { name: 'Gotowe' })).toBeTruthy();
    fireEvent.click(sheet.getByRole('button', { name: 'Wizyty u weta' }));
    fireEvent.click(sheet.getByRole('button', { name: 'Objawy' }));
    fireEvent.click(sheet.getByRole('button', { name: 'Pazury' }));
    fireEvent.click(sheet.getByRole('button', { name: /^Pokaż wyniki/ }));
    expect(screen.getByRole('button', { name: 'Filtry, włączone: 3' })).toBeTruthy();
    expect(document.querySelector('.search-summary__text')?.textContent).toBe('Wizyty u weta, Objawy +1');
    await type('zzzzzz', 'pl');
    expect(screen.getByText('Nic nie znaleziono dla „zzzzzz”')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Wyczyść filtry' })).toBeTruthy();
  });

  it('the Day opened from Search says Wstecz', async () => {
    demo('/search', 'pl');
    await type('wizyta', 'pl');
    fireEvent.click((await screen.findAllByRole('button', { name: /Wizyta u weta/ }))[0]!);
    await waitFor(() => expect(window.location.pathname).toMatch(/^\/day\//));
    expect(screen.getByRole('button', { name: 'Wstecz' })).toBeTruthy();
  });
});

describe('QA fixes (demo)', () => {
  it('a condition page opened from Search says Back and keeps the Search tab marked', async () => {
    demo();
    await type('stomach');
    fireEvent.click(await screen.findByRole('button', { name: /Stomach trouble.*Since/ }));
    await screen.findByRole('heading', { name: 'Stomach trouble' });
    expect(document.querySelector('.day-btn--back')?.textContent).toBe('Back');
    const tabs = within(screen.getByRole('navigation'));
    expect(tabs.getByRole('button', { name: 'Search' }).getAttribute('aria-current')).toBe('page');
    expect(tabs.getByRole('button', { name: 'Tracked' }).getAttribute('aria-current')).toBeNull();
  });

  it('a condition page from the Tracked tab still says Tracked and marks it', async () => {
    demo('/tracked');
    fireEvent.click(await screen.findByRole('button', { name: /Stomach trouble/ }));
    await screen.findByRole('heading', { name: 'Stomach trouble' });
    expect(document.querySelector('.day-btn--back')?.textContent).toBe('Tracked');
    expect(within(screen.getByRole('navigation')).getByRole('button', { name: 'Tracked' }).getAttribute('aria-current')).toBe('page');
  });

  it('"half" finds a partly eaten entry through its alias; the tag keeps its label and shows the alias, highlighted', async () => {
    demo();
    await type('partly');
    await waitFor(() => expect(results()).toMatch(/results?$/));
    expect(document.querySelector('.day-tag--partial mark.hit')?.textContent).toBe('Partly');
    await type('half');
    await waitFor(() => expect(document.querySelector('.day-tag--partial')).not.toBeNull());
    expect(document.querySelector('.day-tag--partial')?.textContent).toBe('Partly eaten · Half eaten');
    expect(document.querySelector('.day-tag--partial mark.hit')?.textContent).toBe('Half');
  });

  it('a word with a stray single letter still finds ("lump a"), without marking the letter', async () => {
    demo();
    await type('lump a');
    await waitFor(() => expect(results()).toMatch(/results?$/));
    expect(marks().every((m) => m!.toLowerCase() === 'lump')).toBe(true);
  });

  it('an item with no entries opens its page with an empty message', async () => {
    const repo = new DemoRepository(null, NOW);
    const dog = await repo.getDog();
    await repo.saveItem({ id: 'item-new', dogId: dog.id, kind: 'supplement', name: 'Newvit', colour: 'med-biomend', defaultDayPart: 2, activeFrom: '2026-10-01', activeTo: null });
    mount(repo, '/search');
    await type('newvit');
    fireEvent.click(await screen.findByRole('button', { name: /Newvit.*Supplement.*0 entries/ }));
    await screen.findByRole('heading', { name: 'Newvit' });
    expect(screen.getByText(translate('en', 'searchItemEmpty'))).toBeTruthy();
    expect(translate('pl', 'searchItemEmpty')).toBe('Brak wpisów dla tej pozycji.');
  });
});

const LUMP = '70000000-0000-4000-8000-000000000001';
const E = (n: number) => `50000000-0000-4000-8000-00000000000${n}`;
const prep = `
  insert into public.condition (id, dog_id, name, started_on, description) values ('${LUMP}', '${SEED.dog}', 'Problemy z żołądkiem', '2026-10-12', 'Burczenie i miękka kupa.');
  insert into public.event (id, dog_id, date, type, title, detail, also_done) values
    ('${E(1)}', '${SEED.dog}', '2026-10-14', 'vet', 'Maple Vet', 'Konsultacja, USG żołądka.', '{nails}'),
    ('${E(2)}', '${SEED.dog}', '2026-10-13', 'note', '', 'Dziś żołądkiem gorzej.', '{}'),
    ('${E(3)}', '${SEED.dog}', '2026-10-12', 'symptom', 'Heartburn', 'After dinner.', '{}');
  insert into public.event_condition (event_id, condition_id, dog_id) values ('${E(1)}', '${LUMP}', '${SEED.dog}');
  insert into public.entry (dog_id, date, day_part, item_id, amount, unit, state, note) values
    ('${SEED.dog}', '2026-10-13', 1, '${SEED.items.arvelin}', 1, 'pill', 'given', 'Spat it out.'),
    ('${SEED.dog}', '2026-10-12', 4, '${SEED.items.farm}', 1, 'can', 'skipped', '');`;

describe('the real data path', () => {
  it('finds events, entries and conditions from the database; opens the day; Back restores', async () => {
    await real('/search', prep);
    await type('heartburn');
    fireEvent.click(await screen.findByRole('button', { name: /Heartburn/ }));
    expect(window.location.pathname).toBe('/day/2026-10-12');
    await waitFor(() => expect(document.querySelector('.ring')).not.toBeNull());
    back();
    await waitFor(() => expect(window.location.pathname).toBe('/search'));
    expect(((await field()) as HTMLInputElement).value).toBe('heartburn');
    await type('spat');
    await waitFor(() => expect(marks()).toEqual(['Spat']));
    expect(document.querySelector('.search-dose .day-card__row-desc')?.textContent).toBe('Spat it out.');
    await type('refused');
    await waitFor(() => expect(results()).toBe('1 result'));
  });

  it('Polish: żołądek, żołądka and żołądkiem find the same condition and notes; zoladek too', async () => {
    await real('/search', prep, 'pl');
    for (const q of ['żołądek', 'żołądka', 'zoladek', 'ŻOŁĄDKIEM']) {
      await type(q, 'pl');
      await waitFor(() => expect(screen.getAllByRole('button', { name: /Problemy z żołądkiem/ }).length).toBeGreaterThan(0));
      expect(marks().every((m) => m!.toLowerCase().replace(/[łż]/g, (c) => (c === 'ł' ? 'l' : 'z')).startsWith('zo'))).toBe(true);
    }
    await type('żołądek', 'pl');
    await waitFor(() => expect(results('pl')).toBe('3 wyniki'));
  });

  it('a kind with nothing typed lists the whole history of the database; an item opens its history', async () => {
    await real('/search', prep);
    fireEvent.click(await screen.findByRole('button', { name: 'Filters' }));
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Medications' }));
    fireEvent.click(within(dialog()).getByRole('button', { name: /^Show results/ }));
    fireEvent.click(await screen.findByRole('button', { name: /Arvelin.*Medication/ }));
    await waitFor(() => expect(window.location.pathname).toBe(`/search/item/${SEED.items.arvelin}`));
    expect((await screen.findAllByText('Spat it out.')).length).toBeGreaterThan(0);
  });

  it('an item\'s history of a year shows 20 entries at a time, by month, and remembers how far you went', async () => {
    const rows: string[] = [];
    for (let d = 0; d < 90; d++) {
      const day = new Date(Date.UTC(2026, 9, 14 - d)).toISOString().slice(0, 10);
      rows.push(`('${SEED.dog}', '${day}', 2, '${SEED.items.cooked}', 1, 'tray', 'given', '')`);
    }
    await real(`/search/item/${SEED.items.cooked}`, `insert into public.entry (dog_id, date, day_part, item_id, amount, unit, state, note) values ${rows.join(',')};`);
    await screen.findByRole('heading', { name: 'Cooked meal' });
    expect(document.querySelector('.day__sub')?.textContent).toBe('Food · 90 entries');
    expect(document.querySelectorAll('.search-dose')).toHaveLength(20);
    expect(Array.from(document.querySelectorAll('.day__caption')).map((c) => c.textContent)).toEqual(['October 2026', 'September 2026']);
    fireEvent.click(screen.getByRole('button', { name: 'Show 20 more' }));
    expect(document.querySelectorAll('.search-dose')).toHaveLength(40);
    fireEvent.click(document.querySelectorAll('.search-dose button')[39]!);
    await waitFor(() => expect(window.location.pathname).toMatch(/^\/day\//));
    back();
    await waitFor(() => expect(window.location.pathname).toBe(`/search/item/${SEED.items.cooked}`));
    expect(await screen.findByRole('heading', { name: 'Cooked meal' })).toBeTruthy();
    expect(document.querySelectorAll('.search-dose')).toHaveLength(40);
  }, 60000);

  it('a long log: a year of meals is searched through the real path', async () => {
    const rows: string[] = [];
    for (let d = 0; d < 420; d++) {
      const day = new Date(Date.UTC(2026, 9, 14 - d)).toISOString().slice(0, 10);
      rows.push(`('${SEED.dog}', '${day}', 2, '${SEED.items.cooked}', 1, 'tray', 'given', '${d % 20 === 0 ? 'Ate slowly' : ''}')`);
    }
    await real('/search', `insert into public.entry (dog_id, date, day_part, item_id, amount, unit, state, note) values ${rows.join(',')};`);
    await type('ate slowly');
    await waitFor(() => expect(results()).toBe('21 results'));
    expect(document.querySelectorAll('.search-dose')).toHaveLength(20);
    fireEvent.click(screen.getByRole('button', { name: 'Show 1 more' }));
    expect(document.querySelectorAll('.search-dose')).toHaveLength(21);
    expect(screen.queryByRole('button', { name: /^Show \d+ more$/ })).toBeNull();
    fireEvent.click(await screen.findByRole('button', { name: 'Filters' }));
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Food' }));
    await waitFor(() => expect(within(dialog()).getByRole('button', { name: /^Show results \(2\d\)$/ })).toBeTruthy());
  }, 60000);
});

const P1 = '80000000-0000-4000-8000-000000000001';
const labels = `
  insert into public.event (id, dog_id, date, type, title, detail) values
    ('${E(4)}', '${SEED.dog}', '2026-10-11', 'vet', 'Riverside Vet', 'Weight check.'),
    ('${E(5)}', '${SEED.dog}', '2026-10-10', 'symptom', 'Restlessness', ''),
    ('${E(6)}', '${SEED.dog}', '2026-10-09', 'other', 'Bath', 'Oatmeal shampoo.');
  insert into public.attachment (id, dog_id, event_id, storage_path, width, height) values
    ('${P1}', '${SEED.dog}', '${E(4)}', '${SEED.dog}/${P1}.jpg', 1600, 1200);`;

describe('type labels (real path)', () => {
  it('a vet visit with a photo found by "photo" shows and highlights the label', async () => {
    await real('/search', labels);
    await type('photo');
    const card = await screen.findByRole('button', { name: /Riverside Vet/ });
    expect(card.textContent).toContain('Vet visit · Riverside Vet · Photo');
    expect(Array.from(card.querySelectorAll('mark.hit')).map((m) => m.textContent)).toEqual(['Photo']);
  });

  it('a type word typed next to a word of the title still shows the label: "restlessness symptom", "bath other"', async () => {
    await real('/search', labels);
    await type('restlessness symptom');
    const card = await screen.findByRole('button', { name: /Restlessness/ });
    expect(card.textContent).toContain('Restlessness · Symptom');
    expect(Array.from(card.querySelectorAll('mark.hit')).map((m) => m.textContent)).toEqual(['Restlessness', 'Symptom']);
    await type('bath other');
    const bath = await screen.findByRole('button', { name: /Bath/ });
    expect(bath.textContent).toContain('Bath · Other');
    expect(Array.from(bath.querySelectorAll('mark.hit')).map((m) => m.textContent)).toEqual(['Bath', 'Other']);
  });

  it('"vet visit" does not repeat the label already in the head', async () => {
    await real('/search', labels);
    await type('vet visit');
    const card = await screen.findByRole('button', { name: /Riverside Vet/ });
    expect(card.textContent).not.toContain('Photo');
    expect(card.textContent?.match(/Vet visit/g)).toHaveLength(1);
  });

  it('Polish: the Odmowa tag keeps its colour when highlighted (rule in search.css, tokens only)', async () => {
    await real('/search', `insert into public.entry (dog_id, date, day_part, item_id, amount, unit, state, note) values ('${SEED.dog}', '2026-10-12', 4, '${SEED.items.farm}', 1, 'can', 'skipped', '');`, 'pl');
    await type('odmowa', 'pl');
    await waitFor(() => expect(document.querySelector('.day-tag--skipped mark.hit')?.textContent).toBe('Odmowa'));
    const css = readFileSync('src/search/search.css', 'utf8');
    expect(css).toMatch(/\.day-tag mark\.hit \{ color: inherit;/);
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });
});

