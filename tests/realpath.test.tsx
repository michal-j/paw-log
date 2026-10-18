// The real app on the real data path (JCB-43): App → LogProvider → SupabaseRepository → supabase-js
// → a PostgREST-like fake on Postgres with every migration (tests/harness). Regression tests for the
// blockers the CEO hit on his first real use; the previous tests only ran against the demo.
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { App } from '../src/App';
import { I18nProvider } from '../src/i18n';
import { SEED } from './harness/fakeBackend';
import { createFakeSupabase, type FakeSupabase } from './harness/fakeSupabase';

const NOW = () => new Date(2026, 9, 15, 16, 30); // Thu 15 Oct 2026, 16:30
let fake: FakeSupabase | null = null;

async function at(path: string, start = '2026-10-01', prep?: string) {
  fake = await createFakeSupabase({ start });
  if (prep) await fake.backend.sql(prep);
  const repository = fake.repository(NOW);
  window.history.replaceState(null, '', path);
  render(
    <I18nProvider initial="en">
      <App repository={repository} />
    </I18nProvider>,
  );
  return { fake, repository };
}

const click = (name: string | RegExp) => fireEvent.click(screen.getByRole('button', { name }));
const dialog = () => screen.getByRole('dialog');
const rows = (sql: string) => fake!.backend.sql<Record<string, unknown>>(sql);

afterEach(async () => {
  cleanup();
  window.history.replaceState(null, '', '/');
  await fake?.backend.close();
  fake = null;
});

describe('real data path', () => {
  it('(3) saves a food from + on a part and shows it at once', async () => {
    await at('/day/2026-10-15');
    await screen.findAllByText('Cooked meal');
    click('Add to Breakfast');
    fireEvent.click(within(dialog()).getByText('Food'));
    fireEvent.click(within(dialog()).getByRole('radio', { name: 'Farm Fresh' }));
    click('Save');
    expect(await screen.findByText('Saved')).toBeTruthy();
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(await screen.findByText('Farm Fresh, turkey')).toBeTruthy();
    const saved = await rows(`select item_id, day_part, date::text from entry where state <> 'removed'`);
    expect(saved).toEqual([{ item_id: SEED.items.farm, day_part: 2, date: '2026-10-15' }]);
  });

  it('(3) after saving on a day before the log start, the app shows that day', async () => {
    await at('/day/2026-10-15', '2026-10-10');
    await screen.findAllByText('Cooked meal');
    click('Add to Breakfast');
    fireEvent.click(within(dialog()).getByText('Medication'));
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Change' }));
    fireEvent.change(within(dialog()).getByLabelText('Date'), { target: { value: '2026-10-03' } });
    fireEvent.click(within(dialog()).getByRole('radio', { name: 'Arvelin' }));
    click('Save');
    expect(await screen.findByText('Saved')).toBeTruthy();
    await waitFor(() => expect(window.location.pathname).toBe('/day/2026-10-03'));
    expect(await screen.findByRole('heading', { name: /3 October 2026/ })).toBeTruthy();
    expect(window.location.pathname).toBe('/day/2026-10-03');
  });

  it('(JCB-88) saves times and when on a non-vomit symptom and shows them in the day', async () => {
    await at('/day/2026-10-15');
    await screen.findAllByText('Cooked meal');
    click(/^Add$/);
    fireEvent.click(within(dialog()).getByText('Symptom'));
    fireEvent.click(within(dialog()).getByRole('radio', { name: 'Poo' }));
    fireEvent.click(within(dialog()).getByRole('button', { name: 'soft' }));
    fireEvent.click(within(dialog()).getByRole('button', { name: '3×+' }));
    fireEvent.click(within(dialog()).getByRole('button', { name: 'at night' }));
    click('Save');
    expect(await screen.findByText('Saved')).toBeTruthy();
    expect(await screen.findByText('soft · 3×+ at night')).toBeTruthy();
    expect(await rows(`select title, props from event`)).toEqual([{ title: 'Poo', props: { consistency: 'soft', times: '3+', when: 'night' } }]);
  });

  it('(15) editing a filled entry changes it in place; its slot does not come back as not logged', async () => {
    await at('/day/2026-10-15');
    fireEvent.click(await screen.findByRole('button', { name: 'Fill with your usual day: 4' }));
    expect(await screen.findByText('4 logged as given')).toBeTruthy();
    await waitFor(() => expect(screen.queryByText(/not logged/)).toBeNull());
    const [before] = await rows(`select id from entry where item_id = '${SEED.items.cooked}'`);
    // Edit Cooked meal: she had Farm Fresh instead.
    fireEvent.click(await screen.findByText('Cooked meal'));
    fireEvent.click(within(dialog()).getByRole('radio', { name: 'Farm Fresh' }));
    click('Save');
    expect(await screen.findByText('Saved')).toBeTruthy();
    await waitFor(() => expect(screen.queryByText('Cooked meal')).toBeNull());
    expect(screen.queryByText(/not logged/)).toBeNull();
    expect(screen.queryByRole('button', { name: /Fill with your usual day/ })).toBeNull();
    const after = await rows(`select id, item_id from entry where date = '2026-10-15' and day_part = 2 and state <> 'removed' order by item_id`);
    expect(after).toHaveLength(2); // Farm Fresh (was Cooked meal) and Arvelin; no new row
    expect(after.find((r) => r.item_id === SEED.items.farm)?.id).toBe(before?.id);
  });

  it('(15) logging a planned row as something else fills that row, it does not stay not logged', async () => {
    await at('/day/2026-10-15');
    fireEvent.click(await screen.findByText('Cooked meal'));
    fireEvent.click(within(dialog()).getByRole('radio', { name: 'Farm Fresh' }));
    click('Save');
    expect(await screen.findByText('Saved')).toBeTruthy();
    await waitFor(() => expect(screen.queryByText('Cooked meal')).toBeNull());
    expect(await rows(`select count(*)::int as n from entry`)).toEqual([{ n: 1 }]);
  });

  it('(13, JCB-60) deleting a filled usual-day item: gone from the day, no Fill for it, Undo restores', async () => {
    await at('/day/2026-10-15');
    fireEvent.click(await screen.findByRole('button', { name: 'Fill with your usual day: 4' }));
    expect(await screen.findByText('4 logged as given')).toBeTruthy();
    await waitFor(() => expect(screen.queryByText(/not logged/)).toBeNull());
    fireEvent.click(await screen.findByText('Arvelin'));
    click('Delete');
    expect(await screen.findByText('Entry deleted')).toBeTruthy();
    await waitFor(() => expect(screen.queryByText('Arvelin')).toBeNull());
    expect(screen.getByText('Removed from the usual day: 1')).toBeTruthy();
    expect(screen.queryByText(/not logged/)).toBeNull();
    expect(screen.queryByRole('button', { name: /Fill with your usual day/ })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Mark Arvelin as given' })).toBeNull();
    expect(await rows(`select state from entry where item_id = '${SEED.items.arvelin}'`)).toEqual([{ state: 'removed' }]);
    click('Undo');
    expect(await screen.findByText('Arvelin')).toBeTruthy();
    expect(screen.queryByText(/Removed from the usual day/)).toBeNull();
    expect(await rows(`select state from entry where item_id = '${SEED.items.arvelin}'`)).toEqual([{ state: 'given' }]);
  });

  it('(JCB-60) deleting an ad-hoc entry and a filled one looks the same: both rows go, Undo toast each time', async () => {
    await at('/day/2026-10-15');
    await screen.findAllByText('Cooked meal');
    // Ad-hoc: Farm Fresh is not on the usual day.
    click('Add to Breakfast');
    fireEvent.click(within(dialog()).getByText('Food'));
    fireEvent.click(within(dialog()).getByRole('radio', { name: 'Farm Fresh' }));
    click('Save');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    fireEvent.click(await screen.findByRole('button', { name: 'Mark Arvelin as given' }));
    expect(await screen.findByText('1 logged as given')).toBeTruthy();
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Mark Arvelin as given' })).toBeNull());
    fireEvent.click(await screen.findByText('Farm Fresh, turkey'));
    click('Delete');
    expect(await screen.findByText('Entry deleted')).toBeTruthy();
    await waitFor(() => expect(screen.queryByText('Farm Fresh, turkey')).toBeNull());
    fireEvent.click(await screen.findByText('Arvelin'));
    click('Delete');
    await waitFor(() => expect(screen.queryByText('Arvelin')).toBeNull());
    expect(screen.getByRole('button', { name: 'Undo' })).toBeTruthy();
    expect(document.querySelectorAll('.day-item--removed')).toHaveLength(0);
    expect(await rows(`select item_id, state from entry order by state`)).toEqual([{ item_id: SEED.items.arvelin, state: 'removed' }]);
    // The Timeline draws neither.
    fireEvent.click(document.querySelector('.day-btn--back') as HTMLElement);
    await screen.findByText('October 2026');
    const today = document.querySelector('[href="/day/2026-10-15"]')?.closest('.tl-row');
    expect(today).toBeTruthy();
    expect(today!.querySelectorAll('.dose-mark')).toHaveLength(0);
  });

  it('(JCB-60) Restore puts a removed item back as not logged, Fill then logs it, Undo removes it again', async () => {
    await at('/day/2026-10-15');
    fireEvent.click(await screen.findByRole('button', { name: 'Mark Arvelin as given' }));
    await screen.findByText('1 logged as given');
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Mark Arvelin as given' })).toBeNull());
    fireEvent.click(await screen.findByText('Arvelin'));
    click('Delete');
    expect(await screen.findByText('Removed from the usual day: 1')).toBeTruthy();
    click('Restore');
    expect(await screen.findByText('Back on the usual day: 1')).toBeTruthy();
    expect(await screen.findByRole('button', { name: 'Mark Arvelin as given' })).toBeTruthy();
    expect(screen.queryByText(/Removed from the usual day/)).toBeNull();
    expect(await rows(`select count(*)::int as n from entry`)).toEqual([{ n: 0 }]);
    click('Undo');
    expect(await screen.findByText('Removed from the usual day: 1')).toBeTruthy();
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Mark Arvelin as given' })).toBeNull());
    expect(await rows(`select state from entry`)).toEqual([{ state: 'removed' }]);
    click('Restore');
    await screen.findByText('Back on the usual day: 1');
    fireEvent.click(await screen.findByRole('button', { name: 'Fill with your usual day: 4' }));
    expect(await screen.findByText('4 logged as given')).toBeTruthy();
    expect(await rows(`select count(*)::int as n from entry where state = 'given'`)).toEqual([{ n: 4 }]);
  });

  it('(1, 5) day-part times save on commit, once, and the last value wins even when answers are slow', async () => {
    const { fake: f } = await at('/');
    await screen.findByText('October 2026');
    f.backend.setLatency((method) => (method === 'POST' ? 30 : 0));
    click('Menu');
    const breakfast = within(dialog()).getByLabelText('Breakfast') as HTMLInputElement;
    for (const v of ['00:30', '08:30', '08:01', '08:15']) fireEvent.change(breakfast, { target: { value: v } });
    expect(f.backend.log.filter((l) => l.table === 'day_part' && l.method === 'POST')).toHaveLength(0);
    fireEvent.blur(breakfast);
    fireEvent.change(breakfast, { target: { value: '08:20' } });
    fireEvent.keyDown(breakfast, { key: 'Enter' });
    await waitFor(async () => expect(await rows(`select usual_time::text as t from day_part where part = 2`)).toEqual([{ t: '08:20:00' }]));
    await waitFor(() => expect(breakfast.value).toBe('08:20'));
    expect(f.backend.log.filter((l) => l.table === 'day_part' && l.method === 'POST')).toHaveLength(2);
  });

  it('(4) back from the Usual day shows the Timeline at once, without loading again', async () => {
    const { fake: f } = await at('/');
    await screen.findByText('October 2026');
    click('Menu');
    fireEvent.click(within(dialog()).getByRole('button', { name: /Usual day/ }));
    expect(await screen.findByRole('heading', { name: 'Usual day' })).toBeTruthy();
    const reads = f.backend.log.length;
    click('Back');
    await waitFor(() => expect(window.location.pathname).toBe('/'));
    expect(screen.getByText('October 2026')).toBeTruthy();
    expect(f.backend.log.length).toBe(reads);
  });

  it('(4) a failed load says so with Try again instead of a blank screen, and recovers', async () => {
    fake = await createFakeSupabase({ start: '2026-10-01' });
    fake.backend.failNext(100);
    window.history.replaceState(null, '', '/');
    render(
      <I18nProvider initial="en">
        <App repository={fake.repository(NOW)} />
      </I18nProvider>,
    );
    expect(await screen.findByText('Could not load. Check the connection.', {}, { timeout: 15000 })).toBeTruthy();
    fake.backend.failNext(0);
    click('Try again');
    expect(await screen.findByText('October 2026')).toBeTruthy();
  }, 20000);

  it('(12) the Timeline reaches back to the usual-day start with empty days, and they open', async () => {
    await at('/', '2026-10-01');
    await screen.findByText('October 2026');
    expect(screen.getByText('Thursday 1 October: nothing logged')).toBeTruthy();
    fireEvent.click(screen.getByText(/Thursday 1 October/));
    expect(await screen.findByRole('heading', { name: /1 October 2026/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Fill with your usual day: 4' })).toBeTruthy();
  });

  it('(6) a new medication gets the first unused colour, which can be changed', async () => {
    await at('/day/2026-10-15');
    await screen.findAllByText('Cooked meal');
    click('Add to Breakfast');
    fireEvent.click(within(dialog()).getByText('Medication'));
    fireEvent.click(within(dialog()).getByRole('radio', { name: 'Other' }));
    fireEvent.change(within(dialog()).getByLabelText('Name of the medication'), { target: { value: 'Testamol' } });
    const colours = within(dialog()).getByRole('radiogroup', { name: 'Colour' });
    // Seed uses food-cooked, food-farm, med-arvelin, med-bellavet and treat: med-gastrelle is the first free medication one.
    expect(within(colours).getByRole('radio', { name: 'Colour 6' }).getAttribute('aria-checked')).toBe('true');
    fireEvent.click(within(colours).getByRole('radio', { name: 'Colour 7' }));
    fireEvent.click(within(dialog()).getByRole('radio', { name: '1' }));
    click('Save');
    expect(await screen.findByText('Saved')).toBeTruthy();
    expect(await rows(`select colour, kind from item where name = 'Testamol'`)).toEqual([{ colour: 'med-biomend', kind: 'medication' }]);
  });

  it('(7) a food takes a new flavour, which joins its list', async () => {
    await at('/day/2026-10-15');
    await screen.findAllByText('Cooked meal');
    click('Add to Dinner');
    fireEvent.click(within(dialog()).getByText('Food'));
    fireEvent.click(within(dialog()).getByRole('radio', { name: 'Farm Fresh' }));
    fireEvent.click(within(dialog()).getByRole('radio', { name: 'Add flavour' }));
    fireEvent.change(within(dialog()).getByLabelText('New flavour'), { target: { value: 'duck' } });
    click('Save');
    expect(await screen.findByText('Farm Fresh, duck')).toBeTruthy();
    expect(await rows(`select flavours from item where id = '${SEED.items.farm}'`)).toEqual([{ flavours: ['turkey', 'salmon', 'duck'] }]);
  });

  it('(9) a new form starts from the last one of its kind; with none, it asks', async () => {
    await at('/day/2026-10-15');
    await screen.findAllByText('Cooked meal');
    click('Add to Dinner');
    fireEvent.click(within(dialog()).getByText('Food'));
    click('Save');
    expect(await within(dialog()).findByText('Pick a food.')).toBeTruthy();
    fireEvent.click(within(dialog()).getByRole('radio', { name: 'Farm Fresh' }));
    fireEvent.click(within(dialog()).getByRole('radio', { name: 'salmon' }));
    fireEvent.click(within(dialog()).getByRole('radio', { name: '½' }));
    click('Save');
    expect(await screen.findByText('Saved')).toBeTruthy();
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    click('Add to Supper');
    fireEvent.click(within(dialog()).getByText('Food'));
    expect(within(dialog()).getByRole('radio', { name: 'Farm Fresh' }).getAttribute('aria-checked')).toBe('true');
    expect(within(dialog()).getByRole('radio', { name: 'salmon' }).getAttribute('aria-checked')).toBe('true');
    expect(within(dialog()).getByRole('radio', { name: '½' }).getAttribute('aria-checked')).toBe('true');
  });

  it('(8) + on a Usual day part asks Food or Medication, then lists only that kind', async () => {
    await at('/usual/2026-10-15');
    await screen.findByRole('heading', { name: 'Usual day' });
    await screen.findAllByText('Cooked meal');
    click('Add to Supper');
    expect(within(dialog()).queryByText('Symptom')).toBeNull();
    fireEvent.click(within(dialog()).getByText('Medication'));
    expect(await screen.findByRole('heading', { name: 'Add medication to the usual day' })).toBeTruthy();
    expect(within(dialog()).getByRole('radio', { name: 'Arvelin' })).toBeTruthy();
    expect(within(dialog()).queryByRole('radio', { name: 'Farm Fresh' })).toBeNull();
    fireEvent.click(within(dialog()).getByRole('radio', { name: 'Arvelin' }));
    click('Save');
    expect(await screen.findByText(/usual day/i, { selector: '.toast__text' })).toBeTruthy();
    expect(await rows(`select day_part from schedule_slot where item_id = '${SEED.items.arvelin}' order by day_part`)).toEqual([
      { day_part: 2 },
      { day_part: 6 },
    ]);
  });

  it('(10) a usual-day item added from a past date offers once to log the past days; Yes fills, skipping logged days', async () => {
    const { fake: f } = await at('/usual/2026-10-15');
    await screen.findAllByText('Cooked meal');
    // Logged by hand on 13 Oct already.
    await f.backend.sql(
      `insert into entry (dog_id, date, day_part, item_id, amount, unit, state) values ('${SEED.dog}', '2026-10-13', 6, '${SEED.items.arvelin}', 1, 'pill', 'given')`,
    );
    click('Add to Supper');
    fireEvent.click(within(dialog()).getByText('Medication'));
    fireEvent.click(await within(dialog()).findByRole('radio', { name: 'Arvelin' }));
    fireEvent.change(within(dialog()).getByLabelText('Starts on'), { target: { value: '2026-10-12' } });
    click('Save');
    expect(await screen.findByRole('heading', { name: 'Log past days?' })).toBeTruthy();
    expect(await screen.findByText('Log Arvelin as given on 2 past days (12 Oct – yesterday)? Days already logged for it stay as they are.')).toBeTruthy();
    click('Yes, log them');
    expect(await screen.findByText('Logged on 2 of 3 days, 1 already logged')).toBeTruthy();
    expect(
      await rows(`select date::text as d from entry where item_id = '${SEED.items.arvelin}' and day_part = 6 and schedule_slot_id is not null order by date`),
    ).toEqual([{ d: '2026-10-12' }, { d: '2026-10-14' }]);
    click('Undo');
    await waitFor(async () =>
      expect(await rows(`select count(*)::int as n from entry where item_id = '${SEED.items.arvelin}' and day_part = 6`)).toEqual([{ n: 1 }]),
    );
  });

  it('(10) No leaves the past days alone', async () => {
    await at('/usual/2026-10-15');
    await screen.findAllByText('Cooked meal');
    click('Add to Supper');
    fireEvent.click(within(dialog()).getByText('Medication'));
    fireEvent.click(await within(dialog()).findByRole('radio', { name: 'Arvelin' }));
    fireEvent.change(within(dialog()).getByLabelText('Starts on'), { target: { value: '2026-10-14' } });
    click('Save');
    expect(await screen.findByText('Log Arvelin as given yesterday (14 Oct)? A day already logged for it stays as it is.')).toBeTruthy();
    click('No, leave it');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(await rows(`select count(*)::int as n from entry`)).toEqual([{ n: 0 }]);
  });

  it('(12) Log starts on in the Menu reaches further back, and is saved', async () => {
    await at('/', '2026-10-10');
    await screen.findByText('October 2026');
    expect(screen.queryByText('September 2026')).toBeNull();
    click('Menu');
    const start = within(dialog()).getByLabelText('Log starts on') as HTMLInputElement;
    expect(start.value).toBe('2026-10-10');
    fireEvent.change(start, { target: { value: '2026-09-20' } });
    fireEvent.blur(start);
    expect(await screen.findByText('September 2026')).toBeTruthy();
    expect(await rows(`select log_start::text as d from dog_settings`)).toEqual([{ d: '2026-09-20' }]);
  });

  it('(12) a year-long log renders only the rows near the screen, with spacers keeping the geometry', async () => {
    const { fake: f } = await at('/', '2026-10-10');
    await f.backend.sql(`insert into dog_settings (dog_id, log_start) values ('${SEED.dog}', '2025-10-15')`);
    click('Menu');
    click('Close');
    await screen.findByText('October 2026');
    // Any reload picks the setting up; a write is the simplest one.
    click('Menu');
    const breakfast = within(dialog()).getByLabelText('Breakfast');
    fireEvent.change(breakfast, { target: { value: '07:40' } });
    fireEvent.blur(breakfast);
    await waitFor(() => expect(document.querySelectorAll('.tl-pad').length).toBeGreaterThan(0));
    const rendered = document.querySelectorAll('.tl-row').length;
    expect(rendered).toBeGreaterThan(10);
    expect(rendered).toBeLessThan(120);
    const list = document.querySelector('.tl-rows') as HTMLElement;
    const heights = [...list.children].reduce((sum, li) => sum + parseFloat((li as HTMLElement).style.height || '0'), 0);
    // 366 days of 44px plus 13 month bands of 28px.
    expect(heights).toBe(366 * 44 + 13 * 28);
  });

  it('(QA 1) moving only "Starts on" of a usual-day item back saves it and offers the past days', async () => {
    await at('/usual/2026-10-15', '2026-10-06');
    fireEvent.click(await screen.findByText('Arvelin'));
    fireEvent.change(within(dialog()).getByLabelText('Starts on'), { target: { value: '2026-10-01' } });
    click('Save');
    expect(await screen.findByRole('heading', { name: 'Log past days?' })).toBeTruthy();
    expect(await rows(`select active_from::text as d from schedule_slot where item_id = '${SEED.items.arvelin}'`)).toEqual([{ d: '2026-10-01' }]);
    expect(await screen.findByText(/on 14 past days \(1 Oct – yesterday\)/)).toBeTruthy();
  });

  // JCB-72: "Starts on" always moves the item's start; "New amount from" (a running item whose amount
  // changes) is the day the new amount begins.
  const arvelinSlots = () => rows(`select amount::float as a, active_from::text as f, active_to::text as t from schedule_slot where item_id = '${SEED.items.arvelin}' order by active_from`);
  const NOT_STARTED = `update schedule_slot set active_from = '2026-10-20' where item_id = '${SEED.items.arvelin}'`;
  const edit = async (o: { from?: string; dose?: boolean; doseFrom?: string }) => {
    fireEvent.click(await screen.findByText('Arvelin'));
    if (o.dose) fireEvent.click(within(dialog()).getByRole('radio', { name: '2' }));
    if (o.doseFrom) fireEvent.change(within(dialog()).getByLabelText('New amount from'), { target: { value: o.doseFrom } });
    if (o.from) fireEvent.change(within(dialog()).getByLabelText('Starts on'), { target: { value: o.from } });
    click('Save');
  };
  const offered = async () => expect(await screen.findByRole('heading', { name: 'Log past days?' })).toBeTruthy();

  it('(JCB-72) "New amount from" shows only when a running item\'s amount changes, defaulting to the opened day', async () => {
    await at('/usual/2026-10-15', '2026-10-06');
    fireEvent.click(await screen.findByText('Arvelin'));
    expect((within(dialog()).getByLabelText('Starts on') as HTMLInputElement).value).toBe('2026-10-06');
    expect(within(dialog()).queryByLabelText('New amount from')).toBeNull();
    fireEvent.click(within(dialog()).getByRole('radio', { name: '2' }));
    expect((within(dialog()).getByLabelText('New amount from') as HTMLInputElement).value).toBe('2026-10-15');
  });

  it('(JCB-72) running item, start earlier only: the start is saved and the past days are offered', async () => {
    await at('/usual/2026-10-15', '2026-10-06');
    await edit({ from: '2026-10-01' });
    await offered();
    expect(await arvelinSlots()).toEqual([{ a: 1, f: '2026-10-01', t: null }]);
  });

  it('(JCB-72) running item, start earlier and a new amount: the start moves, the new amount begins today', async () => {
    await at('/usual/2026-10-15', '2026-10-06');
    await edit({ from: '2026-10-01', dose: true });
    await offered();
    expect(await arvelinSlots()).toEqual([
      { a: 1, f: '2026-10-01', t: '2026-10-14' },
      { a: 2, f: '2026-10-15', t: null },
    ]);
  });

  it('(JCB-72) running item, start earlier and a new amount from another day', async () => {
    await at('/usual/2026-10-15', '2026-10-06');
    await edit({ from: '2026-10-01', dose: true, doseFrom: '2026-10-10' });
    await offered();
    expect(await arvelinSlots()).toEqual([
      { a: 1, f: '2026-10-01', t: '2026-10-09' },
      { a: 2, f: '2026-10-10', t: null },
    ]);
  });

  it('(JCB-72) running item, start later and a new amount: one slot from the later start', async () => {
    await at('/usual/2026-10-15', '2026-10-06');
    await edit({ from: '2026-10-20', dose: true });
    await screen.findByText('Usual day updated');
    expect(await arvelinSlots()).toEqual([{ a: 2, f: '2026-10-20', t: null }]);
  });

  it('(JCB-72) running item, a new amount only: the start stays, the new amount begins on the chosen day', async () => {
    await at('/usual/2026-10-15', '2026-10-06');
    await edit({ dose: true, doseFrom: '2026-10-12' });
    await screen.findByText('Usual day updated');
    expect(await arvelinSlots()).toEqual([
      { a: 1, f: '2026-10-06', t: '2026-10-11' },
      { a: 2, f: '2026-10-12', t: null },
    ]);
  });

  it('(JCB-72) an item that has not started: a later start with a new amount replaces it, no second slot', async () => {
    await at('/usual/2026-10-15', '2026-10-06', NOT_STARTED);
    fireEvent.click(await screen.findByText('Arvelin'));
    fireEvent.click(within(dialog()).getByRole('radio', { name: '2' }));
    expect(within(dialog()).queryByLabelText('New amount from')).toBeNull(); // nothing to keep: it has not started
    fireEvent.change(within(dialog()).getByLabelText('Starts on'), { target: { value: '2026-10-25' } });
    click('Save');
    await screen.findByText('Usual day updated');
    expect(await arvelinSlots()).toEqual([{ a: 2, f: '2026-10-25', t: null }]);
  });

  it('(JCB-72) an item that has not started: an earlier start with a new amount, and the past days are offered', async () => {
    await at('/usual/2026-10-15', '2026-10-06', NOT_STARTED);
    await edit({ from: '2026-10-10', dose: true });
    await offered();
    expect(await arvelinSlots()).toEqual([{ a: 2, f: '2026-10-10', t: null }]);
  });

  // An earlier slot of the same item and part (1 pill, 1 to 9 Oct), the running one starts on 10 Oct.
  const WITH_EARLIER = `with earlier as (
      insert into schedule_slot (dog_id, item_id, day_part, flavour, amount, unit, active_from, active_to, position)
      select dog_id, item_id, day_part, flavour, 1, unit, '2026-10-01', '2026-10-09', position from schedule_slot where item_id = '${SEED.items.arvelin}'
    ) update schedule_slot set active_from = '2026-10-10', amount = 2 where item_id = '${SEED.items.arvelin}'`;

  it('(JCB-72) a start that reaches into an earlier slot of the item ends that slot the day before', async () => {
    await at('/usual/2026-10-15', '2026-10-01', WITH_EARLIER);
    await edit({ from: '2026-10-06' });
    await offered();
    expect(await arvelinSlots()).toEqual([
      { a: 1, f: '2026-10-01', t: '2026-10-05' },
      { a: 2, f: '2026-10-06', t: null },
    ]);
  });

  it('(JCB-72) a start that would swallow the earlier slot is refused with a message, and nothing is saved', async () => {
    await at('/usual/2026-10-15', '2026-10-01', WITH_EARLIER);
    await edit({ from: '2026-10-01' });
    expect(await screen.findByText(/Pick a later start/)).toBeTruthy();
    expect(await arvelinSlots()).toEqual([
      { a: 1, f: '2026-10-01', t: '2026-10-09' },
      { a: 2, f: '2026-10-10', t: null },
    ]);
  });

  // A later slot of the item and part: 1 pill 1 to 11 Oct, then 2 pills from 12 Oct.
  const WITH_LATER = `with later as (
      insert into schedule_slot (dog_id, item_id, day_part, flavour, amount, unit, active_from, position)
      select dog_id, item_id, day_part, flavour, 2, unit, '2026-10-12', position from schedule_slot where item_id = '${SEED.items.arvelin}'
    ) update schedule_slot set active_to = '2026-10-11' where item_id = '${SEED.items.arvelin}'`;

  it('(JCB-72 QA) a start on or after the next slot of the item is refused, nothing is saved', async () => {
    await at('/usual/2026-10-05', '2026-10-01', WITH_LATER);
    await edit({ from: '2026-10-13' });
    expect(await screen.findByText(/Pick a later start/)).toBeTruthy();
    expect(await arvelinSlots()).toEqual([
      { a: 1, f: '2026-10-01', t: '2026-10-11' },
      { a: 2, f: '2026-10-12', t: null },
    ]);
  });

  it('(JCB-72 QA) a start inside the gap keeps the end before the next slot; the offer shows the real last day', async () => {
    await at('/usual/2026-10-05', '2026-10-06', WITH_LATER);
    await edit({ from: '2026-10-03' });
    await offered();
    expect(await arvelinSlots()).toEqual([
      { a: 1, f: '2026-10-03', t: '2026-10-11' },
      { a: 2, f: '2026-10-12', t: null },
    ]);
    expect(await screen.findByText(/on 9 past days \(3 Oct – 11 Oct\)/)).toBeTruthy();
  });

  it('(JCB-72 QA) a "No end" or a longer course cannot run into the next slot either', async () => {
    await at('/usual/2026-10-05', '2026-10-01', WITH_LATER);
    fireEvent.click(await screen.findByText('Arvelin'));
    fireEvent.click(within(dialog()).getByRole('radio', { name: '14 days' }));
    click('Save');
    await screen.findByText('Usual day updated');
    expect(await arvelinSlots()).toEqual([
      { a: 1, f: '2026-10-01', t: '2026-10-11' },
      { a: 2, f: '2026-10-12', t: null },
    ]);
  });

  it('(JCB-72 QA) trimming an earlier course keeps it a course, shorter', async () => {
    await at('/usual/2026-10-15', '2026-10-01', WITH_EARLIER);
    await fake!.backend.sql(`update schedule_slot set is_course = true where active_to = '2026-10-09'`);
    await edit({ from: '2026-10-06' });
    await offered();
    expect(await rows(`select amount::float as a, active_to::text as t, is_course as course from schedule_slot where item_id = '${SEED.items.arvelin}' order by active_from`)).toEqual([
      { a: 1, t: '2026-10-05', course: true },
      { a: 2, t: null, course: false },
    ]);
  });

  it('(QA 3) Undo on the toast closes the past-days question', async () => {
    await at('/usual/2026-10-15', '2026-10-06');
    fireEvent.click(await screen.findByText('Arvelin'));
    fireEvent.change(within(dialog()).getByLabelText('Starts on'), { target: { value: '2026-10-01' } });
    click('Save');
    expect(await screen.findByRole('heading', { name: 'Log past days?' })).toBeTruthy();
    click('Undo');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(async () =>
      expect(await rows(`select active_from::text as d from schedule_slot where item_id = '${SEED.items.arvelin}'`)).toEqual([{ d: '2026-10-06' }]),
    );
  });

  it('(QA 2) the Fill banner does not come and go: Given on an empty day keeps it, deleting the only item keeps it quiet', async () => {
    await at('/day/2026-10-15');
    fireEvent.click(await screen.findByRole('button', { name: 'Mark Arvelin as given' }));
    expect(await screen.findByText('1 logged as given')).toBeTruthy();
    expect(document.querySelector('.day-fill')).not.toBeNull(); // still the banner, now for 3
    expect((await screen.findByText('Fill with your usual day: 3')).closest('.day-fill')).not.toBeNull();
    cleanup();
    await fake!.backend.close();
    // A day opened with one entry: delete it; the removed item keeps the day "worked on", no banner.
    await at('/day/2026-10-15');
    fireEvent.click(await screen.findByRole('button', { name: 'Mark Arvelin as given' }));
    await screen.findByText('1 logged as given');
    cleanup();
    window.history.replaceState(null, '', '/day/2026-10-15');
    render(
      <I18nProvider initial="en">
        <App repository={fake!.repository(NOW)} />
      </I18nProvider>,
    );
    fireEvent.click(await screen.findByText('Arvelin'));
    click('Delete');
    expect(await screen.findByText('Removed from the usual day: 1')).toBeTruthy();
    expect(document.querySelector('.day-fill')).toBeNull();
    expect((await screen.findByRole('button', { name: 'Fill with your usual day: 3' })).closest('.day-fill-quiet')).not.toBeNull();
  });
});

describe('item colours and the item editor (JCB-59)', () => {
  // Items from before JCB-43 were grey (mark-neutral); one has a colour that is not an item token.
  const GREY = `update item set colour = case when id = '${SEED.items.treat}' then 'mint' else 'mark-neutral' end
    where id in ('${SEED.items.cooked}', '${SEED.items.arvelin}', '${SEED.items.treat}')`;
  const markOf = (el: Element | null) => (el?.querySelector('.dose-mark') as HTMLElement | null)?.style.getPropertyValue('--mark');

  it('grey items show an unused item colour at once, the same the data migration gives them', async () => {
    await at('/day/2026-10-15', '2026-10-01', GREY);
    await screen.findAllByText('Cooked meal');
    click('Add to Breakfast');
    fireEvent.click(within(dialog()).getByText('Food'));
    // In lane order, own kind first: Cooked meal (10) → food-cooked, Arvelin (30) → med-arvelin,
    // Treat (90) → treat (Farm Fresh and Bellavet keep food-farm and med-bellavet).
    expect(markOf(within(dialog()).getByRole('radio', { name: 'Cooked meal' }))).toBe('var(--color-food-cooked)');
    expect(markOf(within(dialog()).getByRole('radio', { name: 'Treat' }))).toBe('var(--color-treat)');
    expect(document.querySelector('.dose-mark[style*="mark-neutral"]')).toBeNull();
  });

  it('Edit item from the entry form changes name, colour, unit and flavours, returns to the form; Undo restores', async () => {
    await at('/day/2026-10-15');
    await screen.findAllByText('Cooked meal');
    click('Add to Dinner');
    fireEvent.click(within(dialog()).getByText('Food'));
    fireEvent.click(within(dialog()).getByRole('radio', { name: 'Farm Fresh' }));
    click('Edit item');
    expect(await screen.findByRole('heading', { name: 'Edit item' })).toBeTruthy();
    const colours = within(dialog()).getByRole('radiogroup', { name: 'Colour' });
    expect(within(colours).getByRole('radio', { name: 'Colour 2' }).getAttribute('aria-checked')).toBe('true');
    fireEvent.click(within(colours).getByRole('radio', { name: 'Colour 9' }));
    fireEvent.change(within(dialog()).getByLabelText('Name'), { target: { value: 'Farm Fresh Plus' } });
    fireEvent.click(within(dialog()).getByRole('radio', { name: 'tray' }));
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Remove salmon' }));
    fireEvent.change(within(dialog()).getByLabelText('New flavour'), { target: { value: 'duck' } });
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Add' }));
    click('Save');
    expect(await screen.findByText('Item saved')).toBeTruthy();
    // Back in the entry form, with the item still picked.
    expect(await screen.findByRole('heading', { name: 'Add food' })).toBeTruthy();
    await waitFor(() => expect(within(dialog()).getByRole('radio', { name: 'Farm Fresh Plus' }).getAttribute('aria-checked')).toBe('true'));
    expect(await rows(`select name, colour, default_unit, flavours from item where id = '${SEED.items.farm}'`)).toEqual([
      { name: 'Farm Fresh Plus', colour: 'treat', default_unit: 'tray', flavours: ['turkey', 'duck'] },
    ]);
    click('Undo');
    await waitFor(async () =>
      expect(await rows(`select name, colour, default_unit, flavours from item where id = '${SEED.items.farm}'`)).toEqual([
        { name: 'Farm Fresh', colour: 'food-farm', default_unit: 'can', flavours: ['turkey', 'salmon'] },
      ]),
    );
  });

  it('a grey item can be given a colour from the Usual day (Edit item), and a name is required', async () => {
    await at('/usual/2026-10-15', '2026-10-01', GREY);
    await screen.findByRole('heading', { name: 'Usual day' });
    fireEvent.click((await screen.findAllByText(/Arvelin/))[0]!);
    expect(await screen.findByRole('heading', { name: 'Usual day item' })).toBeTruthy();
    click('Edit item');
    const colours = within(dialog()).getByRole('radiogroup', { name: 'Colour' });
    expect(within(colours).getByRole('radio', { name: 'Colour 4' }).getAttribute('aria-checked')).toBe('true');
    fireEvent.click(within(colours).getByRole('radio', { name: 'Colour 5' }));
    fireEvent.change(within(dialog()).getByLabelText('Name'), { target: { value: '  ' } });
    click('Save');
    expect(await within(dialog()).findByText('Type a name')).toBeTruthy();
    fireEvent.change(within(dialog()).getByLabelText('Name'), { target: { value: 'Arvelin' } });
    click('Save');
    expect(await screen.findByText('Item saved')).toBeTruthy();
    expect(await screen.findByRole('heading', { name: 'Usual day item' })).toBeTruthy();
    expect(await rows(`select colour from item where id = '${SEED.items.arvelin}'`)).toEqual([{ colour: 'med-bellavet' }]);
  });

  it('Other while editing an entry makes a new item with an unused colour, not grey', async () => {
    await at('/day/2026-10-15');
    fireEvent.click(await screen.findByRole('button', { name: 'Fill with your usual day: 4' }));
    expect(await screen.findByText('4 logged as given')).toBeTruthy();
    await waitFor(() => expect(screen.queryByText(/not logged/)).toBeNull());
    fireEvent.click(await screen.findByText('Cooked meal'));
    // The item picker's Other (the amount has one too).
    fireEvent.click(within(dialog()).getAllByRole('radio', { name: 'Other' })[0]!);
    fireEvent.change(within(dialog()).getByLabelText('Name of the food'), { target: { value: 'Test stew' } });
    const colours = within(dialog()).getByRole('radiogroup', { name: 'Colour' });
    expect(within(colours).getByRole('radio', { name: 'Colour 3' }).getAttribute('aria-checked')).toBe('true');
    click('Save');
    expect(await screen.findByText('Saved')).toBeTruthy();
    expect(await rows(`select colour from item where name = 'Test stew'`)).toEqual([{ colour: 'food-ocean' }]);
  });

  it('saving one grey item never changes the colour shown for another', async () => {
    await at('/usual/2026-10-15', '2026-10-01', GREY);
    await screen.findByRole('heading', { name: 'Usual day' });
    const cooked = () => markOf(screen.getAllByText('Cooked meal')[0]!.closest('.day-item'));
    await waitFor(() => expect(cooked()).toBe('var(--color-food-cooked)'));
    // Arvelin (grey, shown med-arvelin) is saved with food-cooked, the colour Cooked meal shows.
    fireEvent.click((await screen.findAllByText(/Arvelin/))[0]!);
    click('Edit item');
    fireEvent.click(within(within(dialog()).getByRole('radiogroup', { name: 'Colour' })).getByRole('radio', { name: 'Colour 1' }));
    click('Save');
    expect(await screen.findByText('Item saved')).toBeTruthy();
    expect(await rows(`select colour from item where id = '${SEED.items.arvelin}'`)).toEqual([{ colour: 'food-cooked' }]);
    click('Close');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(cooked()).toBe('var(--color-food-cooked)');
  });

  it('a second new item never gets the colour the first one just took', async () => {
    await at('/day/2026-10-15');
    await screen.findAllByText('Cooked meal');
    for (const [name, swatch] of [
      ['Testamol', 'Colour 6'],
      ['Testex', 'Colour 7'],
    ] as const) {
      click('Add to Breakfast');
      fireEvent.click(within(dialog()).getByText('Medication'));
      fireEvent.click(within(dialog()).getAllByRole('radio', { name: 'Other' })[0]!);
      fireEvent.change(within(dialog()).getByLabelText('Name of the medication'), { target: { value: name } });
      const colours = within(dialog()).getByRole('radiogroup', { name: 'Colour' });
      expect(within(colours).getByRole('radio', { name: swatch }).getAttribute('aria-checked')).toBe('true');
      fireEvent.click(within(dialog()).getByRole('radio', { name: '1' }));
      click('Save');
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
      await screen.findByText(name);
    }
    expect(await rows(`select name, colour from item where name like 'Test%' order by name`)).toEqual([
      { name: 'Testamol', colour: 'med-gastrelle' },
      { name: 'Testex', colour: 'med-biomend' },
    ]);
  });
});

