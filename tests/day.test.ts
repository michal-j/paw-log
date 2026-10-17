import { describe, expect, it } from 'vitest';
import type { Entry, HealthEvent, Item } from '../src/data';
import { DemoRepository } from '../src/data';
import { buildDay, dayBounds, groupDayEvents, groupDayParts, inBounds, isPlainDate, stepDay } from '../src/day/model';
import { dayPath, parseRoute, routePath, timelinePath, usualPath } from '../src/routes';

const repo = new DemoRepository(null);
const load = async () => {
  const today = repo.today();
  const [items, entries, events] = await Promise.all([repo.listItems(), repo.listEntries({ to: today }), repo.listEvents({ to: today })]);
  return { items, entries, events, bounds: dayBounds(today, entries, events) };
};

const item = (id: string, kind: Item['kind'], extra: Partial<Item> = {}): Item => ({
  id, dogId: 'd', kind, name: id, colour: 'mark-neutral', defaultDayPart: 2, activeFrom: '2026-01-01', activeTo: null, ...extra,
});
const entry = (id: string, date: string, dayPart: Entry['dayPart'], itemId: string, state: Entry['state'] = 'given'): Entry => ({
  id, dogId: 'd', date, dayPart, itemId, amount: 1, unit: 'pill', flavour: '', state, note: '', createdBy: 'm',
});
const event = (id: string, date: string, type: HealthEvent['type']): HealthEvent => ({
  id, dogId: 'd', date, type, title: id, detail: '', conditionIds: [],
});

describe('day dates and bounds', () => {
  it('accepts only real ISO dates', () => {
    expect(isPlainDate('2026-10-14')).toBe(true);
    expect(isPlainDate('2026-02-30')).toBe(false);
    expect(isPlainDate('2026-13-01')).toBe(false);
    expect(isPlainDate('2026-1-01')).toBe(false);
    expect(isPlainDate('yesterday')).toBe(false);
  });

  it('bounds run from the first record (1 Sep) to today (15 Oct)', async () => {
    const { bounds } = await load();
    expect(bounds).toEqual({ first: '2026-09-01', last: '2026-10-15' });
    expect(inBounds('2026-08-31', bounds)).toBe(false);
    expect(inBounds('2026-10-16', bounds)).toBe(false);
  });

  it('previous stops at the first record, next stops at today', async () => {
    const { bounds } = await load();
    expect(stepDay('2026-09-01', -1, bounds)).toBeNull();
    expect(stepDay('2026-09-01', 1, bounds)).toBe('2026-09-02');
    expect(stepDay('2026-10-15', 1, bounds)).toBeNull();
    expect(stepDay('2026-10-15', -1, bounds)).toBe('2026-10-14');
    expect(stepDay('2026-10-01', -1, bounds)).toBe('2026-09-30'); // across a month
  });

  it('ignores records after today when finding the first record', () => {
    const b = dayBounds('2026-10-15', [entry('a', '2026-11-01', 1, 'x')], []);
    expect(b).toEqual({ first: '2026-10-15', last: '2026-10-15' });
  });
});

describe('day grouping', () => {
  it('puts 14 Oct entries in their seven day parts, hidden-by-default items included', async () => {
    const data = await load();
    const day = buildDay({ date: '2026-10-14', ...data });
    expect(day.parts.map((p) => p.part)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(day.parts.map((p) => p.meal)).toEqual([false, true, false, true, false, true, false]);
    const names = day.parts.map((p) => p.entries.map((e) => e.name));
    expect(names).toEqual([
      ['Arvelin'],
      ['Cooked meal', 'Bellavet', 'Biomend'],
      ['Gastrelle', 'Treat'],
      ['Ocean Blend', 'Bellavet'],
      ['Arvelin'],
      ['Ocean Blend', 'Bellavet'],
      [],
    ]);
    expect(day.parts[1]?.entries[0]).toMatchObject({ state: 'skipped', size: 'food', colour: 'food-cooked', amount: 1 / 3, unit: 'tray' });
    expect(day.parts[3]?.entries[0]).toMatchObject({ flavour: 'salmon', unit: 'can', amount: 0.5 });
    expect(day.parts[3]?.entries[0]).toMatchObject({ state: 'partial', size: 'food' });
    expect(day.parts[2]?.entries[1]).toMatchObject({ size: 'small', colour: 'treat' });
    expect(day.empty).toBe(false);
    expect(day.prev).toBe('2026-10-13');
    expect(day.next).toBe('2026-10-15');
  });

  it('shows Calmora (hidden on the Timeline) in After supper', async () => {
    const data = await load();
    const day = buildDay({ date: '2026-09-10', ...data });
    expect(day.parts[6]?.entries.map((e) => e.name)).toEqual(['Calmora']);
  });

  it('sorts food first, then by item order, and keeps entries of unknown items', () => {
    const items = [item('med', 'medication'), item('food', 'food', { colour: 'food-farm' })];
    const parts = groupDayParts('2026-10-01', items, [
      entry('e1', '2026-10-01', 2, 'med'),
      entry('e2', '2026-10-01', 2, 'gone'),
      entry('e3', '2026-10-01', 2, 'food'),
      entry('e4', '2026-10-02', 2, 'food'),
    ]);
    expect(parts[1]?.entries.map((e) => e.itemId)).toEqual(['food', 'med', 'gone']);
    expect(parts[1]?.entries[2]).toMatchObject({ name: 'gone', colour: 'mark-neutral', size: 'small' });
  });

  it('groups events: visits, one symptoms card, then Frontline, deworming, photo, the rest', () => {
    const d = '2026-10-01';
    const ev = groupDayEvents(d, [
      event('p', d, 'photo'),
      event('n', d, 'nails'),
      event('s2', d, 'symptom'),
      event('w', d, 'deworming'),
      event('v', d, 'vet'),
      event('f', d, 'frontline'),
      event('s1', d, 'symptom'),
      event('x', '2026-10-02', 'vet'),
    ]);
    expect(ev.visits.map((e) => e.id)).toEqual(['v']);
    expect(ev.symptoms.map((e) => e.id)).toEqual(['s1', 's2']);
    expect(ev.others.map((e) => e.id)).toEqual(['f', 'w', 'p', 'n']);
    expect(ev.count).toBe(7);
  });

  it('marks a day with no entries and no events as empty', () => {
    const bounds = { first: '2026-10-01', last: '2026-10-03' };
    const day = buildDay({ date: '2026-10-02', bounds, items: [], entries: [], events: [] });
    expect(day.empty).toBe(true);
    expect(day.parts.every((p) => p.entries.length === 0)).toBe(true);
  });
});

describe('routes', () => {
  it('parses the Timeline and day paths under /demo and at the root', () => {
    expect(parseRoute('/demo')).toEqual({ base: '/demo', view: 'timeline' });
    expect(parseRoute('/demo/day/2026-10-14')).toEqual({ base: '/demo', view: 'day', date: '2026-10-14' });
    expect(parseRoute('/demo/day/2026-10-14/')).toEqual({ base: '/demo', view: 'day', date: '2026-10-14' });
    expect(parseRoute('/day/2026-10-14')).toEqual({ base: '', view: 'day', date: '2026-10-14' });
    expect(parseRoute('/')).toEqual({ base: '', view: 'timeline' });
  });

  it('falls back to the Timeline for malformed or impossible dates', () => {
    expect(parseRoute('/demo/day/2026-02-30')).toEqual({ base: '/demo', view: 'timeline' });
    expect(parseRoute('/demo/day/today')).toEqual({ base: '/demo', view: 'timeline' });
    expect(parseRoute('/demo/day/2026-10-14/x')).toEqual({ base: '/demo', view: 'timeline' });
    expect(parseRoute('/demonstration')).toEqual({ base: '', view: 'timeline' });
  });

  it('parses and builds the usual-day paths', () => {
    expect(parseRoute('/demo/usual')).toEqual({ base: '/demo', view: 'usual' });
    expect(parseRoute('/usual/2026-10-14')).toEqual({ base: '', view: 'usual', date: '2026-10-14' });
    expect(parseRoute('/usual/2026-02-30')).toEqual({ base: '', view: 'timeline' });
    expect(usualPath('/demo')).toBe('/demo/usual');
    expect(usualPath('', '2026-10-14')).toBe('/usual/2026-10-14');
  });

  it('builds paths', () => {
    expect(dayPath('/demo', '2026-10-14')).toBe('/demo/day/2026-10-14');
    expect(timelinePath('/demo')).toBe('/demo');
    expect(timelinePath('')).toBe('/');
    expect(routePath(parseRoute('/demo/day/2026-10-14'))).toBe('/demo/day/2026-10-14');
  });
});
