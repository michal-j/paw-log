// Logging, editing and the usual day in the app (JCB-39), against the demo repository.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { App } from '../src/App';
import { DemoRepository } from '../src/data';
import { I18nProvider } from '../src/i18n';
import { TOAST_MS, TOAST_UNDO_MS, toastMs } from '../src/log/LogProvider';

/** The demo date is frozen at 15 Oct; the clock is set per test. */
const repoAt = (hh: number, mm = 0) => new DemoRepository(null, () => new Date(2026, 9, 15, hh, mm));

const at = (path: string, repository = repoAt(16, 30), lang: 'en' | 'pl' = 'en') => {
  window.history.replaceState(null, '', path);
  render(
    <I18nProvider initial={lang}>
      <App repository={repository} />
    </I18nProvider>,
  );
  return repository;
};
const click = (name: string | RegExp) => fireEvent.click(screen.getByRole('button', { name }));
const dialog = () => screen.getByRole('dialog');

beforeEach(() => localStorage.clear());
afterEach(() => {
  cleanup();
  window.history.replaceState(null, '', '/');
});

describe('toast duration', () => {
  it('keeps a toast with Undo longer than a plain one', () => {
    expect(toastMs(false)).toBe(TOAST_MS);
    expect(toastMs(true)).toBe(TOAST_UNDO_MS);
    expect(TOAST_UNDO_MS).toBe(8000);
    expect(TOAST_MS).toBe(5000);
  });

  it('a toast with Undo is timed with the Undo duration, which also ends the deferred work', async () => {
    const spy = vi.spyOn(globalThis, 'setTimeout');
    try {
      const repo = repoAt(16, 30);
      for (const e of await repo.listEntries({ from: '2026-10-15', to: '2026-10-15' })) if (e.dayPart === 2) await repo.deleteEntry(e.id);
      at('/demo/day/2026-10-15', repo);
      fireEvent.click(await screen.findByRole('button', { name: 'Mark Bellavet as given' }));
      await screen.findByText('1 logged as given');
      expect(spy.mock.calls.some((c) => c[1] === TOAST_UNDO_MS)).toBe(true);
      expect(spy.mock.calls.some((c) => c[1] === TOAST_MS)).toBe(false);
    } finally {
      spy.mockRestore();
    }
  });
});

describe('fill and Given', () => {
  it('fills a past day with the usual day, then Undo takes it back', async () => {
    const repo = repoAt(16, 30);
    for (const e of await repo.listEntries({ from: '2026-10-01', to: '2026-10-01' })) await repo.deleteEntry(e.id);
    at('/demo/day/2026-10-01', repo);
    expect(await screen.findByText('9 not logged')).toBeTruthy();
    click('Fill with your usual day: 9');
    expect(await screen.findByText('9 logged as given')).toBeTruthy();
    await waitFor(() => expect(screen.queryByText('9 not logged')).toBeNull());
    expect((await repo.listEntries({ from: '2026-10-01', to: '2026-10-01' })).every((e) => e.state === 'given' && e.scheduleSlotId)).toBe(true);
    click('Undo');
    expect(await screen.findByText('9 not logged')).toBeTruthy();
    expect(await repo.listEntries({ from: '2026-10-01', to: '2026-10-01' })).toHaveLength(0);
  });

  it('today fills only the parts whose time has passed, and leaves what is logged alone', async () => {
    const repo = repoAt(16, 30);
    for (const e of await repo.listEntries({ from: '2026-10-15', to: '2026-10-15' })) {
      if (e.dayPart >= 4) await repo.deleteEntry(e.id); // dinner onwards not logged yet
    }
    const before = (await repo.listEntries({ from: '2026-10-15', to: '2026-10-15' })).map((e) => ({ ...e }));
    at('/demo/day/2026-10-15', repo);
    // Open and due: Bellavet at breakfast, Ocean Blend and Bellavet at dinner (15:00), Arvelin (18:00) is later.
    expect(await screen.findByText('Up to now: 3 not logged (16:30)')).toBeTruthy();
    expect(screen.getAllByText('Later today').length).toBeGreaterThan(0);
    click('Fill with your usual day: 3');
    expect(await screen.findByText('3 logged as given')).toBeTruthy();
    const after = await repo.listEntries({ from: '2026-10-15', to: '2026-10-15' });
    expect(after).toHaveLength(before.length + 3);
    for (const e of before) expect(after.find((x) => x.id === e.id)).toEqual(e); // nothing overwritten
    expect(after.filter((e) => e.dayPart >= 5)).toHaveLength(0);
  });

  it('logs one planned item with Given; "All given" logs a whole part', async () => {
    const repo = repoAt(16, 30);
    for (const e of await repo.listEntries({ from: '2026-10-15', to: '2026-10-15' })) if (e.dayPart === 2) await repo.deleteEntry(e.id);
    at('/demo/day/2026-10-15', repo);
    click(await screen.findByRole('button', { name: 'Mark Bellavet as given' }).then((b) => b.getAttribute('aria-label') as string));
    expect(await screen.findByText('1 logged as given')).toBeTruthy();
    click('All given');
    expect(await screen.findByText('2 logged as given')).toBeTruthy();
    expect((await repo.listEntries({ from: '2026-10-15', to: '2026-10-15' })).filter((e) => e.dayPart === 2)).toHaveLength(3);
  });

  it('before a part is due: "Later today", Given still offered, no Fill', async () => {
    at('/demo/day/2026-10-15', repoAt(7, 0));
    await screen.findAllByText('Bellavet');
    expect(screen.getByText('Later today')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Mark Bellavet as given' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Fill with your usual day/ })).toBeNull();
  });

  it('a double tap on Given writes once and keeps the first toast and its Undo', async () => {
    const repo = repoAt(16, 30);
    for (const e of await repo.listEntries({ from: '2026-10-15', to: '2026-10-15' })) if (e.dayPart === 2) await repo.deleteEntry(e.id);
    at('/demo/day/2026-10-15', repo);
    const given = await screen.findByRole('button', { name: 'Mark Bellavet as given' });
    fireEvent.click(given);
    fireEvent.click(given);
    expect(await screen.findByText('1 logged as given')).toBeTruthy();
    // A later tap on Fill for slots someone already filled adds nothing and keeps the toast.
    const fillBtn = screen.getByRole('button', { name: /Fill with your usual day/ });
    await repo.addPlannedEntries((await repo.listScheduleSlots({ from: '2026-10-15', to: '2026-10-15' })).filter((s) => s.dayPart === 2).map((s, i) => ({
      id: `other-${i}`, dogId: s.dogId, date: '2026-10-15', dayPart: s.dayPart, itemId: s.itemId, scheduleSlotId: s.id, amount: s.amount, unit: s.unit, flavour: s.flavour, state: 'given' as const, note: '', createdBy: '',
    })));
    fireEvent.click(fillBtn);
    await waitFor(() => expect(screen.queryByText(/0 logged/)).toBeNull());
    expect(screen.getByText('1 logged as given')).toBeTruthy();
    expect((await repo.listEntries({ from: '2026-10-15', to: '2026-10-15' })).filter((e) => e.itemId === 'item-bellavet' && e.dayPart === 2)).toHaveLength(1);
    click('Undo');
    await waitFor(async () =>
      expect((await repo.listEntries({ from: '2026-10-15', to: '2026-10-15' })).some((e) => e.itemId === 'item-bellavet' && e.dayPart === 2)).toBe(false),
    );
  });
});

describe('add and edit', () => {
  it('adds food from + Add with a structured amount, flavour and state', async () => {
    const repo = at('/demo/day/2026-10-15');
    await screen.findAllByText('Bellavet');
    click(/^Add$/);
    fireEvent.click(within(dialog()).getByText('Food'));
    expect(within(dialog()).getByText('For Thu 15 Oct · Dinner')).toBeTruthy();
    // A new form starts from the last food logged (JCB-43, 9).
    const foods = within(dialog()).getByRole('radiogroup', { name: 'Food' });
    expect(within(foods).getAllByRole('radio').filter((r) => r.getAttribute('aria-checked') === 'true')).toHaveLength(1);
    fireEvent.click(within(dialog()).getByRole('radio', { name: 'Farm Fresh' }));
    fireEvent.click(within(dialog()).getByRole('radio', { name: 'chicken' }));
    fireEvent.click(within(dialog()).getByRole('radio', { name: '½' }));
    fireEvent.click(within(dialog()).getByRole('radio', { name: 'Partly eaten' }));
    click('Save');
    expect(await screen.findByText('Saved')).toBeTruthy();
    expect(await screen.findByText('Farm Fresh, chicken')).toBeTruthy();
    const added = (await repo.listEntries({ from: '2026-10-15' })).find((e) => e.itemId === 'item-farm');
    expect(added).toMatchObject({ dayPart: 4, amount: 0.5, unit: 'can', flavour: 'chicken', state: 'partial', scheduleSlotId: null });
  });

  it('a double tap on Save writes one entry', async () => {
    const repo = at('/demo/day/2026-10-15');
    await screen.findAllByText('Bellavet');
    const before = (await repo.listEntries({ from: '2026-10-15' })).length;
    click(/^Add$/);
    fireEvent.click(within(dialog()).getByText('Food'));
    fireEvent.click(within(dialog()).getByRole('radio', { name: 'Farm Fresh' }));
    const save = screen.getByRole('button', { name: 'Save' });
    fireEvent.click(save);
    fireEvent.click(save);
    expect(await screen.findByText('Saved')).toBeTruthy();
    expect((await repo.listEntries({ from: '2026-10-15' })).length).toBe(before + 1);
  });

  it('edits an entry, including changing the item, and deletes it with Undo', async () => {
    const repo = at('/demo/day/2026-10-14');
    fireEvent.click(await screen.findByText('Cooked meal'));
    expect(within(dialog()).getByRole('heading', { name: 'Edit entry' })).toBeTruthy();
    fireEvent.click(within(dialog()).getByRole('radio', { name: 'Farm Fresh' }));
    fireEvent.click(within(dialog()).getByRole('radio', { name: 'Given' }));
    click('Save');
    expect(await screen.findByText('Farm Fresh, turkey')).toBeTruthy();
    const changed = (await repo.listEntries({ from: '2026-10-14', to: '2026-10-14' })).find((e) => e.itemId === 'item-farm');
    expect(changed).toMatchObject({ dayPart: 2, state: 'given', unit: 'can' });

    fireEvent.click(screen.getByText('Farm Fresh, turkey'));
    click('Delete');
    expect(await screen.findByText('Entry deleted')).toBeTruthy();
    await waitFor(() => expect(screen.queryByText('Farm Fresh, turkey')).toBeNull());
    click('Undo');
    expect(await screen.findByText('Farm Fresh, turkey')).toBeTruthy();
  });

  it('a different amount offers "Make this the usual amount", which changes the usual day from that date', async () => {
    const repo = at('/demo/day/2026-10-15');
    fireEvent.click(await screen.findByText('Bellavet', { selector: '.day-item--planned .day-item__name' }));
    expect(within(dialog()).getByText('Usual: 0,15 ml (1,5 bars)')).toBeTruthy();
    fireEvent.change(within(dialog()).getByRole('textbox', { name: 'Amount' }), { target: { value: '0,2' } });
    fireEvent.click(within(dialog()).getByRole('checkbox', { name: 'Make this the usual amount from this day on' }));
    click('Save');
    expect(await screen.findByText('Usual day updated')).toBeTruthy();
    const slots = (await repo.listScheduleSlots()).filter((s) => s.itemId === 'item-bellavet' && s.dayPart === 2);
    expect(slots.map((s) => [s.activeFrom, s.activeTo, s.amount])).toEqual([
      ['2026-09-25', '2026-10-14', 0.15],
      ['2026-10-15', null, 0.2],
    ]);
  });

  it('logs a symptom with its properties and shows them in the day', async () => {
    const repo = at('/demo/day/2026-10-15');
    await screen.findAllByText('Bellavet');
    click(/^Add$/);
    fireEvent.click(within(dialog()).getByText('Symptom'));
    fireEvent.click(within(dialog()).getByRole('radio', { name: 'Poo' }));
    fireEvent.click(within(dialog()).getByRole('button', { name: 'soft' }));
    fireEvent.click(within(dialog()).getByRole('button', { name: 'with blood' }));
    click('Save');
    expect(await screen.findByText('soft · with blood')).toBeTruthy();
    const ev = (await repo.listEvents({ from: '2026-10-15' })).find((e) => e.type === 'symptom');
    expect(ev).toMatchObject({ title: 'Poo', props: { consistency: 'soft', colour: 'blood' } });
  });

  it('logs a non-vomit symptom with times and when, and shows them in the day (JCB-88)', async () => {
    const repo = at('/demo/day/2026-10-15');
    await screen.findAllByText('Bellavet');
    click(/^Add$/);
    fireEvent.click(within(dialog()).getByText('Symptom'));
    fireEvent.click(within(dialog()).getByRole('radio', { name: 'Fear' }));
    fireEvent.click(within(dialog()).getByRole('button', { name: 'a lot' }));
    fireEvent.click(within(dialog()).getByRole('button', { name: '2×' }));
    fireEvent.click(within(dialog()).getByRole('button', { name: 'in the evening' }));
    click('Save');
    expect(await screen.findByText('a lot · 2× in the evening')).toBeTruthy();
    const ev = (await repo.listEvents({ from: '2026-10-15' })).find((e) => e.type === 'symptom');
    expect(ev).toMatchObject({ title: 'Fear', intensity: 'large', props: { times: '2', when: 'evening' } });
  });

  it('logs a note and an "other" event, which need text', async () => {
    at('/demo/day/2026-10-15');
    await screen.findAllByText('Bellavet');
    click(/^Add$/);
    fireEvent.click(within(dialog()).getByText('Note'));
    click('Save');
    expect(within(dialog()).getByText('Write the note first.')).toBeTruthy();
    fireEvent.change(within(dialog()).getByRole('textbox', { name: 'Note' }), { target: { value: 'Slept all afternoon.' } });
    click('Save');
    expect(await screen.findByText('Slept all afternoon.')).toBeTruthy();

    click(/^Add$/);
    fireEvent.click(within(dialog()).getByText('Other'));
    expect((screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(true); // no type picked yet
    expect(within(dialog()).queryAllByRole('radio', { checked: true })).toHaveLength(0);
    fireEvent.click(within(dialog()).getByRole('radio', { name: 'Nail trimming' }));
    click('Save');
    expect(await screen.findByRole('button', { name: /^Nail trimming/ })).toBeTruthy();
  });
});

describe('usual day and menu', () => {
  it('opens the usual day from a day and shows courses', async () => {
    at('/demo/day/2026-10-15');
    click(await screen.findByRole('button', { name: 'Usual day' }).then(() => 'Usual day'));
    expect(window.location.pathname).toBe('/demo/usual/2026-10-15');
    expect(await screen.findByText('As of 15 Oct')).toBeTruthy();
    expect(screen.getByText('day 2 of 7, until 20 Oct')).toBeTruthy();
    click('Back');
    await waitFor(() => expect(window.location.pathname).toBe('/demo/day/2026-10-15'));
  });

  it('changes a course length from the usual day', async () => {
    const repo = at('/demo/usual/2026-10-15');
    fireEvent.click(await screen.findByText('Gastrelle'));
    fireEvent.click(within(dialog()).getByRole('radio', { name: '14 days' }));
    click('Save');
    expect(await screen.findByText('Usual day updated')).toBeTruthy();
    const g = (await repo.listScheduleSlots()).find((s) => s.itemId === 'item-gastrelle');
    expect(g).toMatchObject({ activeFrom: '2026-10-14', activeTo: '2026-10-27' }); // same amount: the course just gets longer
    expect(await screen.findByText('day 2 of 14, until 27 Oct')).toBeTruthy();
  });

  it('an item that has not started: a new dose and a new start are both saved, in one slot (JCB-72)', async () => {
    const repo = repoAt(16, 30);
    await repo.deleteScheduleSlot('slot-arvelin-5');
    const slot = (await repo.listScheduleSlots()).find((s) => s.id === 'slot-arvelin-1')!;
    await repo.saveScheduleSlot({ ...slot, activeFrom: '2026-10-20' });
    at('/demo/usual/2026-10-15', repo);
    fireEvent.click(await screen.findByText('Arvelin'));
    fireEvent.click(within(dialog()).getByRole('radio', { name: '2' }));
    fireEvent.change(within(dialog()).getByLabelText('Starts on'), { target: { value: '2026-10-25' } });
    click('Save');
    expect(await screen.findByText('Usual day updated')).toBeTruthy();
    const mine = (await repo.listScheduleSlots()).filter((s) => s.itemId === 'item-arvelin');
    expect(mine).toHaveLength(1);
    expect(mine[0]).toMatchObject({ amount: 2, activeFrom: '2026-10-25', activeTo: null });
  });

  it('a running item: Starts on moves its start, New amount from splits the amount (JCB-72)', async () => {
    const repo = repoAt(16, 30);
    await repo.deleteScheduleSlot('slot-arvelin-5');
    at('/demo/usual/2026-10-15', repo);
    fireEvent.click(await screen.findByText('Arvelin'));
    expect(within(dialog()).queryByLabelText('New amount from')).toBeNull();
    fireEvent.click(within(dialog()).getByRole('radio', { name: '1' }));
    fireEvent.change(within(dialog()).getByLabelText('New amount from'), { target: { value: '2026-10-12' } });
    fireEvent.change(within(dialog()).getByLabelText('Starts on'), { target: { value: '2026-09-18' } });
    click('Save');
    await waitFor(async () => expect((await repo.listScheduleSlots()).filter((x) => x.itemId === 'item-arvelin')).toHaveLength(2));
    const mine = (await repo.listScheduleSlots()).filter((x) => x.itemId === 'item-arvelin').sort((a, b) => a.activeFrom.localeCompare(b.activeFrom));
    expect(mine[0]).toMatchObject({ amount: 0.5, activeFrom: '2026-09-18', activeTo: '2026-10-11' });
    expect(mine[1]).toMatchObject({ amount: 1, activeFrom: '2026-10-12', activeTo: null });
  });

  it('day-part times are editable in the menu and decide what is due today', async () => {
    const repo = at('/demo/day/2026-10-15', repoAt(7, 45));
    expect(await screen.findByText('Up to now: 1 not logged (07:45)')).toBeTruthy();
    click('Menu');
    const breakfast = within(dialog()).getByLabelText('Breakfast') as HTMLInputElement;
    // Saved on commit (blur, Enter, picker closed), not per keystroke (JCB-43, 1 and 5).
    fireEvent.change(breakfast, { target: { value: '00:00' } });
    fireEvent.change(breakfast, { target: { value: '08:00' } });
    expect(breakfast.value).toBe('08:00');
    expect((await repo.getDayPartTimes())[2]).toBe('07:30');
    fireEvent.blur(breakfast);
    expect(await screen.findByText('Saved')).toBeTruthy();
    expect((await repo.getDayPartTimes())[2]).toBe('08:00');
    click('Undo');
    await waitFor(() => expect(breakfast.value).toBe('07:30')); // the field follows the Undo
    fireEvent.change(breakfast, { target: { value: '08:00' } });
    fireEvent.keyDown(breakfast, { key: 'Enter' });
    expect(await screen.findByText('Saved')).toBeTruthy();
    click('Close');
    await waitFor(() => expect(screen.queryByText(/Up to now/)).toBeNull());
    expect(screen.getByText('Later today')).toBeTruthy();
  });

  it('resets demo data from the menu', async () => {
    const repo = at('/demo/day/2026-10-15');
    await repo.deleteEvent('event-001');
    click(await screen.findByRole('button', { name: 'Menu' }).then(() => 'Menu'));
    click('Reset demo data');
    expect((await repo.listEvents()).some((e) => e.id === 'event-001')).toBe(true);
  });

  it('reads in Polish', async () => {
    at('/demo/day/2026-10-15', repoAt(16, 30), 'pl');
    expect(await screen.findByText('Do teraz: niezapisane 1 (16:30)')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Uzupełnij zwykłym dniem: 1' })).toBeTruthy();
    expect(screen.getAllByText('0,15 ml (1,5 bars)', { exact: false }).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/½ tabl\./).length).toBeGreaterThan(0);
  });
});
