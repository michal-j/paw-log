import { describe, expect, it } from 'vitest';
import { DemoRepository } from '../src/data';
import type { Entry, HealthEvent, Item } from '../src/data';
import {
  activeTickOffset,
  badgesFor,
  buildColumns,
  buildTimeline,
  datesNewestFirst,
  markSize,
  markState,
  railScrollTop,
  rowIndexAt,
  shiftDate,
  topDayAt,
  type DayRow,
  type Timeline,
} from '../src/timeline/model';
import { DAY_ROW_H, LIST_TAIL_H, MONTH_BAND_H } from '../src/timeline/geometry';

const item = (id: string, kind: Item['kind'], extra: Partial<Item> = {}): Item => ({
  id, dogId: 'd', kind, name: id, colour: 'treat', defaultDayPart: 2, activeFrom: '2026-01-01', activeTo: null, ...extra,
});
const entry = (date: string, dayPart: Entry['dayPart'], itemId: string, state: Entry['state'] = 'given'): Entry => ({
  id: `${date}-${dayPart}-${itemId}`, dogId: 'd', date, dayPart, itemId, doseText: '', state, note: '', createdBy: 'm',
});
const ev = (date: string, type: HealthEvent['type']): HealthEvent => ({
  id: `${date}-${type}-${Math.random()}`, dogId: 'd', date, type, title: type, detail: '', issueId: null,
});

async function demoTimeline(): Promise<Timeline> {
  const repo = new DemoRepository(null);
  const today = repo.today();
  return buildTimeline({
    today,
    items: await repo.listItems(),
    entries: await repo.listEntries({ to: today }),
    events: await repo.listEvents({ to: today }),
  });
}
const day = (tl: Timeline, date: string) => tl.rows.find((r): r is DayRow => r.kind === 'day' && r.date === date)!;
const markOf = (tl: Timeline, date: string, itemId: string) =>
  day(tl, date).slots.flat().find((s) => s.mark?.itemId === itemId)?.mark;

describe('dates', () => {
  it('shifts across month and year ends', () => {
    expect(shiftDate('2026-10-01', -1)).toBe('2026-09-30');
    expect(shiftDate('2026-12-31', 1)).toBe('2027-01-01');
    expect(shiftDate('2028-02-28', 1)).toBe('2028-02-29');
  });
  it('lists dates newest first, inclusive', () => {
    expect(datesNewestFirst('2026-09-29', '2026-10-02')).toEqual(['2026-10-02', '2026-10-01', '2026-09-30', '2026-09-29']);
    expect(datesNewestFirst('2026-10-03', '2026-10-02')).toEqual([]);
  });
});

describe('row derivation (demo data)', () => {
  it('has one row per day from 15 Oct back to 1 Sep, newest first, with month bands', async () => {
    const tl = await demoTimeline();
    const days = tl.rows.filter((r) => r.kind === 'day').map((r) => (r as DayRow).date);
    expect(days[0]).toBe('2026-10-15');
    expect(days.at(-1)).toBe('2026-09-01');
    expect(days).toHaveLength(45);
    expect(new Set(days).size).toBe(45);
    expect(tl.rows.filter((r) => r.kind === 'band').map((r) => r.kind === 'band' && r.month)).toEqual(['2026-10', '2026-09']);
    expect(tl.rows[0]).toMatchObject({ kind: 'band', month: '2026-10', top: 0 });
    expect(day(tl, '2026-10-15').isToday).toBe(true);
  });

  it('stacks rows on the fixed geometry', async () => {
    const tl = await demoTimeline();
    let y = 0;
    for (const r of tl.rows) {
      expect(r.top).toBe(y);
      expect(r.height).toBe(r.kind === 'band' ? MONTH_BAND_H : DAY_ROW_H);
      y += r.height;
    }
    expect(tl.total).toBe(2 * MONTH_BAND_H + 45 * DAY_ROW_H + LIST_TAIL_H);
  });

  it('puts rail ticks on month bands, Sundays and today', async () => {
    const tl = await demoTimeline();
    expect(tl.ticks.filter((k) => k.kind === 'month')).toHaveLength(2);
    expect(tl.ticks.find((k) => k.offset === day(tl, '2026-10-11').top)?.kind).toBe('week'); // a Sunday
    expect(tl.ticks.find((k) => k.offset === day(tl, '2026-10-15').top)?.kind).toBe('week'); // today
    expect(tl.ticks.some((k) => k.offset === day(tl, '2026-10-14').top)).toBe(false);
  });

  it('spot-checks circles: 14 Oct breakfast hollow, dinner half, Gastrelle given', async () => {
    const tl = await demoTimeline();
    expect(markOf(tl, '2026-10-14', 'item-cooked')?.state).toBe('skipped');
    expect(markOf(tl, '2026-10-14', 'item-ocean')?.state).toBe('partial');
    expect(markOf(tl, '2026-10-14', 'item-gastrelle')).toMatchObject({ state: 'given', colour: 'med-gastrelle' });
    expect(markOf(tl, '2026-10-13', 'item-gastrelle')).toBeUndefined();
    expect(markOf(tl, '2026-10-11', 'item-farm')?.colour).toBe('food-farm');
  });

  it('spot-checks badges: 14 Oct symptoms and two vet visits, Frontline 8 Sep and 8 Oct', async () => {
    const tl = await demoTimeline();
    expect(day(tl, '2026-10-14').badges).toEqual([{ kind: 'vet', text: '2' }, { kind: 'sym', text: '!2' }]);
    expect(day(tl, '2026-09-08').badges).toEqual([{ kind: 'front', text: 'F' }]);
    expect(day(tl, '2026-10-08').badges).toEqual([{ kind: 'front', text: 'F' }]);
    expect(day(tl, '2026-09-12').badges).toEqual([{ kind: 'worm', text: 'D' }]);
    expect(day(tl, '2026-10-13').badges).toEqual([]);
  });

  it('ignores anything after today', () => {
    const tl = buildTimeline({
      today: '2026-10-02',
      items: [item('a', 'food')],
      entries: [entry('2026-10-01', 2, 'a'), entry('2026-10-03', 2, 'a')],
      events: [ev('2026-10-05', 'vet')],
    });
    expect(tl.rows.filter((r) => r.kind === 'day')).toHaveLength(2);
  });
});

describe('circles', () => {
  it('sizes by kind: food big, everything else small', () => {
    expect(markSize({ kind: 'food' })).toBe('food');
    for (const k of ['medication', 'treat', 'supplement', 'procedure'] as const) expect(markSize({ kind: k })).toBe('small');
  });
  it('maps entry state to shape', () => {
    expect(markState('given')).toBe('given');
    expect(markState('skipped')).toBe('skipped');
    expect(markState('partial')).toBe('partial');
  });
});

describe('lanes and columns', () => {
  const items = [item('food-a', 'food'), item('food-b', 'food'), item('med', 'medication'), item('t', 'treat', { hiddenByDefault: true })];
  const entries = [entry('2026-10-01', 4, 'med'), entry('2026-10-01', 4, 'food-a'), entry('2026-10-02', 4, 'food-b'), entry('2026-10-01', 3, 't')];
  const cols = buildColumns(items, entries);

  it('shares one lane for all foods in a part, food first', () => {
    const dinner = cols.find((c) => c.part === 4)!;
    expect(dinner.lanes.map((l) => l.key)).toEqual(['4:food', '4:med']);
    expect(dinner.lanes[0]!.itemIds).toEqual(['food-a', 'food-b']);
    expect(dinner.meal).toBe(true);
    expect(dinner.width).toBe(44);
  });
  it('hides default-off items and collapses an empty last part', () => {
    expect(cols.find((c) => c.part === 3)!.lanes).toEqual([]);
    expect(cols.find((c) => c.part === 3)!.width).toBe(24);
    expect(cols.find((c) => c.part === 7)!.width).toBe(0);
  });
  it('widens a column to fit its lanes', () => {
    const many = buildColumns(
      [item('f', 'food'), item('m1', 'medication'), item('m2', 'medication')],
      [entry('2026-10-01', 2, 'f'), entry('2026-10-01', 2, 'm1'), entry('2026-10-01', 2, 'm2')],
    );
    expect(many.find((c) => c.part === 2)!.width).toBe(20 + 15 + 15 + 8);
  });
});

describe('badges', () => {
  it('orders vet, symptoms, photo, Frontline, deworming and counts', () => {
    expect(badgesFor([ev('d', 'deworming'), ev('d', 'photo'), ev('d', 'symptom'), ev('d', 'vet'), ev('d', 'frontline')])).toEqual([
      { kind: 'vet', text: '1' },
      { kind: 'sym', text: '!' },
      { kind: 'photo', text: '' },
      { kind: 'front', text: 'F' },
      { kind: 'worm', text: 'D' },
    ]);
    expect(badgesFor([ev('d', 'symptom'), ev('d', 'symptom'), ev('d', 'symptom')])).toEqual([{ kind: 'sym', text: '!3' }]);
    expect(badgesFor([ev('d', 'nails'), ev('d', 'other')])).toEqual([]);
  });
});

describe('scroll maths', () => {
  it('finds the row and day at a scroll position', async () => {
    const tl = await demoTimeline();
    expect(rowIndexAt(tl.rows, 0)).toBe(0);
    expect(topDayAt(tl.rows, 0)?.date).toBe('2026-10-15');
    expect(topDayAt(tl.rows, MONTH_BAND_H + DAY_ROW_H)?.date).toBe('2026-10-14');
    expect(topDayAt(tl.rows, MONTH_BAND_H + DAY_ROW_H + 20)?.date).toBe('2026-10-14');
    const sepBand = tl.rows.find((r) => r.kind === 'band' && r.month === '2026-09')!;
    expect(topDayAt(tl.rows, sepBand.top)?.date).toBe('2026-09-30');
  });
  it('highlights the latest tick at or above the top row', () => {
    const ticks = [{ offset: 0, kind: 'month' as const }, { offset: 28, kind: 'week' as const }, { offset: 200, kind: 'week' as const }];
    expect(activeTickOffset(ticks, 0)).toBe(0);
    expect(activeTickOffset(ticks, 150)).toBe(28);
    expect(activeTickOffset(ticks, 200)).toBe(200);
  });
  it('maps the rail to a clamped scroll position', () => {
    expect(railScrollTop(0.5, 1000, 800)).toBe(500);
    expect(railScrollTop(1.2, 1000, 800)).toBe(800);
    expect(railScrollTop(-1, 1000, 800)).toBe(0);
  });
});
