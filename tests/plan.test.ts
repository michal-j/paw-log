import { describe, expect, it } from 'vitest';
import type { DayPartTimes, Entry, ScheduleSlot } from '../src/data';
import { DEFAULT_DAY_PART_TIMES } from '../src/data/repository';
import { changeFrom, courseDay, dueOpenSlots, matchDay, partDue, plannedEntry, removeFrom, usualDay } from '../src/log/plan';
import { buildDay } from '../src/day/model';
import { symptomDetail, symptomKey } from '../src/log/symptoms';
import { translate, type MessageKey } from '../src/i18n';

const slot = (id: string, dayPart: ScheduleSlot['dayPart'], itemId: string, from = '2026-10-01', to: string | null = null, extra: Partial<ScheduleSlot> = {}): ScheduleSlot => ({
  id, dogId: 'd', itemId, dayPart, flavour: '', amount: 1, unit: 'pill', activeFrom: from, activeTo: to, ...extra,
});
const entry = (id: string, date: string, dayPart: Entry['dayPart'], itemId: string, scheduleSlotId: string | null = null): Entry => ({
  id, dogId: 'd', date, dayPart, itemId, scheduleSlotId, amount: 1, unit: 'pill', flavour: '', state: 'given', note: '', createdBy: '',
});
const times: DayPartTimes = DEFAULT_DAY_PART_TIMES;
let n = 0;
const ids = () => `new-${++n}`;

describe('matching entries to the usual day', () => {
  const slots = [slot('a', 1, 'arvelin'), slot('c', 2, 'cooked'), slot('b', 2, 'bellavet')];

  it('pairs by slot id, then by item and part for entries without an active slot', () => {
    const m = matchDay('2026-10-10', slots, [
      entry('e1', '2026-10-10', 1, 'arvelin', 'a'),
      entry('e2', '2026-10-10', 2, 'cooked', 'old-slot'), // logged before the slot was changed
      entry('e3', '2026-10-10', 2, 'cooked'), // a second cooked meal: unplanned
      entry('e4', '2026-10-11', 2, 'bellavet', 'b'), // another day
    ]);
    expect(m.slotOf.get('e1')?.id).toBe('a');
    expect(m.slotOf.get('e2')?.id).toBe('c');
    expect(m.slotOf.has('e3')).toBe(false);
    expect([...m.filled].sort()).toEqual(['a', 'c']);
  });

  it('due: every open slot of a past day, only parts whose time has passed today', () => {
    const clock = { today: '2026-10-15', now: '10:00', times };
    expect(dueOpenSlots('2026-10-14', slots, [], clock).map((s) => s.id)).toEqual(['a', 'c', 'b']);
    const today = dueOpenSlots('2026-10-15', [...slots, slot('s', 6, 'supper')], [entry('x', '2026-10-15', 1, 'arvelin', 'a')], clock);
    expect(today.map((s) => s.id)).toEqual(['c', 'b']); // a is logged, supper (20:00) is later today
    expect(dueOpenSlots('2026-10-16', slots, [], clock)).toEqual([]);
    expect(partDue('2026-10-15', 2, '2026-10-15', '07:30', times)).toBe(true); // at the minute
    expect(partDue('2026-10-15', 2, '2026-10-15', '07:29', times)).toBe(false);
  });

  it('fill writes the usual values as given, linked to the slot, and never overwrites', () => {
    const s = slot('b', 2, 'bellavet', '2026-10-01', null, { amount: 0.15, unit: 'ml' });
    expect(plannedEntry(s, '2026-10-12', 'id1')).toMatchObject({
      id: 'id1', date: '2026-10-12', dayPart: 2, itemId: 'bellavet', scheduleSlotId: 'b', amount: 0.15, unit: 'ml', state: 'given',
    });
    // A slot already filled (even by a skipped entry) is not due again.
    const skipped = { ...entry('k', '2026-10-12', 2, 'bellavet', 'b'), state: 'skipped' as const };
    expect(dueOpenSlots('2026-10-12', [s], [skipped], { today: '2026-10-15', now: '10:00', times })).toEqual([]);
  });

  it('day view: planned rows only for open slots, Given only once due', () => {
    const day = buildDay({
      date: '2026-10-15',
      bounds: { first: '2026-10-01', last: '2026-10-15' },
      items: (['cooked', 'arvelin', 'bellavet', 'supper'] as const).map((id) => ({
        id, dogId: 'd', kind: id === 'cooked' ? ('food' as const) : ('medication' as const), name: id, colour: 'mark-neutral', defaultDayPart: 2 as const, activeFrom: '2026-01-01', activeTo: null,
      })),
      entries: [entry('e1', '2026-10-15', 2, 'cooked', 'c')],
      events: [],
      plan: { slots: [...slots, slot('s', 6, 'supper')], today: '2026-10-15', now: '12:00', times },
    });
    expect(day.parts[1]?.rows.map((r) => `${r.kind}:${r.itemId}`)).toEqual(['logged:cooked', 'planned:bellavet']);
    expect(day.parts[5]?.rows[0]).toMatchObject({ kind: 'planned', due: false });
    expect(day.parts.flatMap((p) => p.due).map((r) => r.id)).toEqual(['a', 'b']);
    expect(day.empty).toBe(false);
  });
});

describe('courses', () => {
  it('counts day n of m from the slot dates, for courses only', () => {
    const g = slot('g', 3, 'gastrelle', '2026-10-14', '2026-10-20', { course: true });
    expect(courseDay(g, '2026-10-15')).toEqual({ n: 2, m: 7 });
    expect(courseDay(slot('x', 1, 'x'), '2026-10-15')).toBeNull();
    // An end date alone (the slot was changed or removed from a date) is not a course.
    expect(courseDay(slot('f', 4, 'farm', '2026-09-01', '2026-10-11'), '2026-09-01')).toBeNull();
  });

  it('changes and removals do not invent courses', () => {
    const old = slot('o', 4, 'ocean', '2026-10-01');
    const c = changeFrom([old], old, { itemId: 'ocean', dayPart: 4, flavour: '', amount: 2, unit: 'pill' }, '2026-10-15', undefined, ids, 'd');
    expect(c.save.map((s) => !!s.course)).toEqual([false, false]);
    expect(courseDay(c.save[0] as ScheduleSlot, '2026-10-10')).toBeNull();
    const removed = removeFrom(slot('g', 3, 'g', '2026-10-14', '2026-10-20', { course: true }), '2026-10-16');
    expect(removed.save[0]).toMatchObject({ activeTo: '2026-10-15', course: false });
    const course = changeFrom([], null, { itemId: 'g', dayPart: 3, flavour: '', amount: 1, unit: 'sachet', course: true }, '2026-10-15', '2026-10-21', ids, 'd');
    expect(courseDay(course.slot, '2026-10-16')).toEqual({ n: 2, m: 7 });
  });
});

describe('changing the usual day from a date', () => {
  const values = { itemId: 'ocean', dayPart: 4 as const, flavour: 'salmon', amount: 0.75, unit: 'can' as const };

  it('ends the old slot the day before and starts a new one, keeping the old end', () => {
    const old = slot('o', 4, 'ocean', '2026-10-01', '2026-12-31', { amount: 0.5, unit: 'can', flavour: 'salmon' });
    const c = changeFrom([old], old, values, '2026-10-15', undefined, ids, 'd');
    expect(c.save[0]).toMatchObject({ id: 'o', activeFrom: '2026-10-01', activeTo: '2026-10-14', amount: 0.5 });
    expect(c.save[1]).toMatchObject({ id: c.slot.id, activeFrom: '2026-10-15', activeTo: '2026-12-31', amount: 0.75 });
    expect(c.remove).toEqual([]);
  });

  it('updates in place when the slot starts on or after the date', () => {
    const old = slot('o', 4, 'ocean', '2026-10-15');
    const c = changeFrom([old], old, values, '2026-10-15', '2026-10-21', ids, 'd');
    expect(c.save).toHaveLength(1);
    expect(c.slot).toMatchObject({ id: 'o', amount: 0.75, activeTo: '2026-10-21' });
  });

  it('without a target: changes the active slot of that item and part, or adds a new one', () => {
    const old = slot('o', 4, 'ocean', '2026-10-01');
    expect(changeFrom([old], null, values, '2026-10-15', undefined, ids, 'd').save).toHaveLength(2);
    const added = changeFrom([old], null, { ...values, dayPart: 6 }, '2026-10-15', undefined, ids, 'd');
    expect(added.save).toEqual([added.slot]);
    expect(added.slot).toMatchObject({ dayPart: 6, activeFrom: '2026-10-15', activeTo: null });
  });

  it('removes from a date: ends a running slot, deletes one that has not started', () => {
    expect(removeFrom(slot('o', 4, 'x', '2026-10-01'), '2026-10-15')).toEqual({ save: [expect.objectContaining({ activeTo: '2026-10-14' })], remove: [] });
    expect(removeFrom(slot('o', 4, 'x', '2026-10-15'), '2026-10-15')).toEqual({ save: [], remove: ['o'] });
    expect(removeFrom(slot('o', 4, 'x', '2026-10-01', '2026-10-05'), '2026-10-15')).toEqual({ save: [], remove: [] });
  });

  it('lists the usual day with the next change and upcoming items', () => {
    const slots = [
      slot('farm', 4, 'farm', '2026-09-01', '2026-10-11'),
      slot('farm2', 4, 'farm', '2026-10-12', null, { amount: 0.5 }),
      slot('new', 4, 'new', '2026-10-20'),
    ];
    const parts = usualDay(slots, '2026-10-10', () => 0);
    expect(parts[3]?.rows.map((r) => [r.slot.id, r.upcoming, r.next?.id ?? null])).toEqual([
      ['farm', false, 'farm2'],
      ['new', true, null],
    ]);
  });
});

describe('symptoms', () => {
  const en = (k: MessageKey) => translate('en', k);
  it('recognises stored titles and shows their properties', () => {
    expect(symptomKey('poo')).toBe('sx_poo');
    expect(symptomKey('Itching')).toBeUndefined();
    const base = { id: 'x', dogId: 'd', date: '2026-10-01', issueId: null, type: 'symptom' as const };
    expect(symptomDetail({ ...base, title: 'Poo', detail: '', props: { consistency: 'diarrhea', colour: 'dark', quantity: 'medium' } }, en)).toBe(
      'diarrhea · dark · medium amount',
    );
    expect(symptomDetail({ ...base, title: 'Vomit', detail: '', props: { times: '1', when: 'morning' } }, en)).toBe('1× in the morning');
    expect(symptomDetail({ ...base, title: 'Fear', detail: 'thunder', intensity: 'large' }, en)).toBe('a lot · thunder');
  });
});
