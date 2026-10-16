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

async function at(path: string, start = '2026-10-01') {
  fake = await createFakeSupabase({ start });
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

  it('(13) deleting a filled usual-day item shows it as removed for the day, no Fill for it, Undo restores', async () => {
    await at('/day/2026-10-15');
    fireEvent.click(await screen.findByRole('button', { name: 'Fill with your usual day: 4' }));
    expect(await screen.findByText('4 logged as given')).toBeTruthy();
    await waitFor(() => expect(screen.queryByText(/not logged/)).toBeNull());
    fireEvent.click(await screen.findByText('Arvelin'));
    click('Delete');
    expect(await screen.findByText('Removed for this day')).toBeTruthy();
    expect(screen.queryByText(/not logged/)).toBeNull();
    expect(screen.queryByRole('button', { name: /Fill with your usual day/ })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Mark Arvelin as given' })).toBeNull();
    expect(await rows(`select state from entry where item_id = '${SEED.items.arvelin}'`)).toEqual([{ state: 'removed' }]);
    click('Undo');
    await waitFor(() => expect(screen.queryByText('Removed for this day')).toBeNull());
    expect(await rows(`select state from entry where item_id = '${SEED.items.arvelin}'`)).toEqual([{ state: 'given' }]);
  });

  it('(13) a removed item can still be logged that day, in its own row', async () => {
    await at('/day/2026-10-15');
    fireEvent.click(await screen.findByRole('button', { name: 'Fill with your usual day: 4' }));
    await waitFor(() => expect(screen.queryByText(/not logged/)).toBeNull());
    fireEvent.click(await screen.findByText('Arvelin'));
    click('Delete');
    fireEvent.click(await screen.findByText('Removed for this day'));
    click('Save');
    await waitFor(() => expect(screen.queryByText('Removed for this day')).toBeNull());
    expect(await rows(`select state from entry where item_id = '${SEED.items.arvelin}'`)).toEqual([{ state: 'given' }]);
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
    expect(screen.getByText(/Thursday 1 October/)).toBeTruthy();
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
    // Seed uses food-cooked, food-farm, med-arvelin, med-bellavet and treat: food-ocean is the first free one.
    expect(within(colours).getByRole('radio', { name: 'Colour 3' }).getAttribute('aria-checked')).toBe('true');
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
    expect(await screen.findByText('Logged on 2 days, 1 already logged')).toBeTruthy();
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
    click('No, leave them');
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
});

