import { describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  DuplicateSlotEntryError,
  NoDogError,
  PAGE_SIZE,
  RepositoryError,
  SupabaseRepository,
  localDate,
} from '../src/data/supabaseRepository';
import type { Entry, HealthEvent } from '../src/data';

interface Result {
  data: unknown;
  error: { message: string; code?: string } | null;
}
type Call = [string, ...unknown[]];

/** Stands in for supabase-js's query builder: records the chained calls, resolves to `respond`. */
class FakeQuery implements PromiseLike<Result> {
  calls: Call[] = [];
  constructor(
    readonly table: string,
    private readonly respond: (q: FakeQuery) => Result,
  ) {}
  private add(name: string, args: unknown[]) {
    this.calls.push([name, ...args]);
    return this;
  }
  select = (...a: unknown[]) => this.add('select', a);
  eq = (...a: unknown[]) => this.add('eq', a);
  gte = (...a: unknown[]) => this.add('gte', a);
  lte = (...a: unknown[]) => this.add('lte', a);
  or = (...a: unknown[]) => this.add('or', a);
  order = (...a: unknown[]) => this.add('order', a);
  range = (...a: unknown[]) => this.add('range', a);
  limit = (...a: unknown[]) => this.add('limit', a);
  upsert = (...a: unknown[]) => this.add('upsert', a);
  delete = (...a: unknown[]) => this.add('delete', a);
  in = (...a: unknown[]) => this.add('in', a);
  has(name: string) {
    return this.calls.find((c) => c[0] === name);
  }
  then<A = Result, B = never>(ok?: ((v: Result) => A | PromiseLike<A>) | null, bad?: ((e: unknown) => B | PromiseLike<B>) | null) {
    return Promise.resolve(this.respond(this)).then(ok, bad);
  }
}

const DOG = { id: 'd0000000-0000-4000-8000-000000000001', household_id: 'h1', name: 'Pip' };
const ENTRY_ROW = {
  id: 'e0000000-0000-4000-8000-000000000001',
  dog_id: DOG.id,
  date: '2026-10-10',
  day_part: 4,
  item_id: 'i1',
  schedule_slot_id: 's1',
  amount: '0.5',
  unit: 'pill',
  flavour: '',
  dose_text: '',
  state: 'partial',
  note: 'slow',
  created_by: 'u1',
  updated_by: 'u2',
};

function fake(tables: Record<string, (q: FakeQuery) => Result>) {
  const queries: FakeQuery[] = [];
  const client = {
    from(table: string) {
      const respond = tables[table] ?? (() => ({ data: [], error: null }));
      const q = new FakeQuery(table, respond);
      queries.push(q);
      return q;
    },
  } as unknown as SupabaseClient;
  return { client, queries, of: (t: string) => queries.filter((q) => q.table === t) };
}

const withDog = (rest: Record<string, (q: FakeQuery) => Result> = {}) =>
  fake({ dog: () => ({ data: [DOG], error: null }), ...rest });

describe('SupabaseRepository reads', () => {
  it('maps the dog and caches it', async () => {
    const f = withDog();
    const repo = new SupabaseRepository(f.client);
    expect(await repo.getDog()).toEqual({ id: DOG.id, householdId: 'h1', name: 'Pip' });
    await repo.getDog();
    expect(f.of('dog')).toHaveLength(1);
  });

  it('throws NoDogError when the account sees no dog, and retries next time', async () => {
    let rows: unknown[] = [];
    const f = fake({ dog: () => ({ data: rows, error: null }) });
    const repo = new SupabaseRepository(f.client);
    await expect(repo.getDog()).rejects.toBeInstanceOf(NoDogError);
    rows = [DOG];
    expect((await repo.getDog()).name).toBe('Pip');
  });

  it('maps items in lane order, snake_case to camelCase', async () => {
    const f = withDog({
      item: () => ({
        data: [
          { id: 'i1', dog_id: DOG.id, kind: 'medication', name: 'Med', colour: 'med-arvelin', default_day_part: 2, active_from: '2026-09-01', active_to: null, hidden_by_default: false, position: 10, default_unit: 'ml', flavours: [], conversion_unit: 'bars', conversion_size: '0.1' },
          { id: 'i2', dog_id: DOG.id, kind: 'treat', name: 'Treat', colour: 'treat', default_day_part: 6, active_from: '2026-09-01', active_to: '2026-10-01', hidden_by_default: true, position: 20, default_unit: null, flavours: null, conversion_unit: null, conversion_size: null },
        ],
        error: null,
      }),
    });
    const items = await new SupabaseRepository(f.client).listItems();
    expect(items[0]).toEqual({
      id: 'i1', dogId: DOG.id, kind: 'medication', name: 'Med', colour: 'med-arvelin', defaultDayPart: 2, activeFrom: '2026-09-01', activeTo: null,
      defaultUnit: 'ml', flavours: [], conversion: { unit: 'bars', size: 0.1 }, position: 10,
    });
    expect(items[1]).toMatchObject({ hiddenByDefault: true, defaultUnit: null, flavours: [], conversion: null });
    const [q] = f.of('item');
    expect(q?.calls).toContainEqual(['eq', 'dog_id', DOG.id]);
    expect(q?.calls).toContainEqual(['order', 'position']);
  });

  it('maps entries and applies the date range', async () => {
    const f = withDog({ entry: () => ({ data: [ENTRY_ROW], error: null }) });
    const entries = await new SupabaseRepository(f.client).listEntries({ from: '2026-10-01', to: '2026-10-15' });
    expect(entries).toEqual([
      { id: ENTRY_ROW.id, dogId: DOG.id, date: '2026-10-10', dayPart: 4, itemId: 'i1', scheduleSlotId: 's1', amount: 0.5, unit: 'pill', flavour: '', doseText: '', state: 'partial', note: 'slow', createdBy: 'u1', updatedBy: 'u2' },
    ]);
    const [q] = f.of('entry');
    expect(q?.calls).toContainEqual(['eq', 'dog_id', DOG.id]);
    expect(q?.calls).toContainEqual(['gte', 'date', '2026-10-01']);
    expect(q?.calls).toContainEqual(['lte', 'date', '2026-10-15']);
  });

  it('omits range filters that are not given and maps a missing creator to an empty string', async () => {
    const f = withDog({ entry: () => ({ data: [{ ...ENTRY_ROW, created_by: null, schedule_slot_id: null }], error: null }) });
    const [entry] = await new SupabaseRepository(f.client).listEntries({ to: '2026-10-15' });
    expect(entry?.createdBy).toBe('');
    expect(entry?.scheduleSlotId).toBeNull();
    const [q] = f.of('entry');
    expect(q?.has('gte')).toBeUndefined();
  });

  it('reads every page when there are more rows than one request returns', async () => {
    const row = (i: number) => ({ ...ENTRY_ROW, id: `e-${i}` });
    const f = withDog({
      entry: (q) => {
        const [, from] = q.has('range') as [string, number, number];
        const count = from === 0 ? PAGE_SIZE : 3;
        return { data: Array.from({ length: count }, (_, i) => row(from + i)), error: null };
      },
    });
    const entries = await new SupabaseRepository(f.client).listEntries();
    expect(entries).toHaveLength(PAGE_SIZE + 3);
    expect(f.of('entry').map((q) => q.has('range'))).toEqual([
      ['range', 0, PAGE_SIZE - 1],
      ['range', PAGE_SIZE, 2 * PAGE_SIZE - 1],
    ]);
  });

  it('maps events', async () => {
    const f = withDog({
      event: () => ({
        data: [{ id: 'v1', dog_id: DOG.id, date: '2026-10-14', type: 'symptom', title: 'Poo', detail: '', intensity: null, props: { consistency: 'soft' }, also_done: null, issue_id: null }],
        error: null,
      }),
    });
    expect(await new SupabaseRepository(f.client).listEvents()).toEqual([
      { id: 'v1', dogId: DOG.id, date: '2026-10-14', type: 'symptom', title: 'Poo', detail: '', intensity: null, props: { consistency: 'soft' }, alsoDone: [], issueId: null },
    ]);
  });

  it('maps schedule slots and keeps only those active in the range', async () => {
    const f = withDog({
      schedule_slot: () => ({
        data: [{ id: 's1', dog_id: DOG.id, item_id: 'i1', day_part: 6, flavour: '', amount: 0.15, unit: 'ml', active_from: '2026-09-01', active_to: null }],
        error: null,
      }),
    });
    const slots = await new SupabaseRepository(f.client).listScheduleSlots({ from: '2026-10-01', to: '2026-10-31' });
    expect(slots).toEqual([
      { id: 's1', dogId: DOG.id, itemId: 'i1', dayPart: 6, flavour: '', amount: 0.15, unit: 'ml', activeFrom: '2026-09-01', activeTo: null },
    ]);
    const [q] = f.of('schedule_slot');
    expect(q?.calls).toContainEqual(['lte', 'active_from', '2026-10-31']);
    expect(q?.calls).toContainEqual(['or', 'active_to.is.null,active_to.gte.2026-10-01']);
  });

  it('turns a database error into a RepositoryError with the code', async () => {
    const f = withDog({ entry: () => ({ data: null, error: { message: 'permission denied', code: '42501' } }) });
    const err = await new SupabaseRepository(f.client).listEntries().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(RepositoryError);
    expect((err as RepositoryError).code).toBe('42501');
  });
});

describe('SupabaseRepository writes', () => {
  const entry: Entry = {
    id: 'e0000000-0000-4000-8000-000000000002',
    dogId: DOG.id,
    date: '2026-10-15',
    dayPart: 2,
    itemId: 'i1',
    amount: 1,
    unit: 'pill',
    flavour: '',
    state: 'given',
    note: '',
    createdBy: 'someone-else',
  };
  const event: HealthEvent = {
    id: 'a0000000-0000-4000-8000-000000000002',
    dogId: DOG.id,
    date: '2026-10-15',
    type: 'symptom',
    title: 'Vomiting',
    detail: 'After dinner',
    issueId: null,
  };

  it('upserts an entry in snake_case without created_by (the database sets it)', async () => {
    const f = fake({});
    await new SupabaseRepository(f.client).saveEntry(entry);
    const [q] = f.of('entry');
    expect(q?.has('upsert')).toEqual([
      'upsert',
      { id: entry.id, dog_id: DOG.id, date: '2026-10-15', day_part: 2, item_id: 'i1', schedule_slot_id: null, amount: 1, unit: 'pill', flavour: '', dose_text: '', state: 'given', note: '' },
      { onConflict: 'id' },
    ]);
  });

  it('upserts an event', async () => {
    const f = fake({});
    await new SupabaseRepository(f.client).saveEvent(event);
    expect(f.of('event')[0]?.has('upsert')?.[1]).toEqual({
      id: event.id, dog_id: DOG.id, date: '2026-10-15', type: 'symptom', title: 'Vomiting', detail: 'After dinner', intensity: null, props: {}, also_done: [], issue_id: null,
    });
  });

  it('refuses ids that are not UUIDs before calling the server', async () => {
    const f = fake({});
    await expect(new SupabaseRepository(f.client).saveEntry({ ...entry, id: 'entry-001' })).rejects.toThrow(/crypto\.randomUUID/);
    expect(f.queries).toHaveLength(0);
  });

  it('deletes by id', async () => {
    const f = fake({});
    const repo = new SupabaseRepository(f.client);
    await repo.deleteEntry('x');
    await repo.deleteEvent('y');
    expect(f.of('entry')[0]?.calls).toEqual([['delete'], ['eq', 'id', 'x']]);
    expect(f.of('event')[0]?.calls).toEqual([['delete'], ['eq', 'id', 'y']]);
  });

  it('turns a second entry for the same slot and date into DuplicateSlotEntryError', async () => {
    const f = fake({ entry: () => ({ data: null, error: { message: 'duplicate key value', code: '23505' } }) });
    const err = await new SupabaseRepository(f.client).saveEntry({ ...entry, scheduleSlotId: 's1' }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(DuplicateSlotEntryError);
    expect(f.of('entry')[0]?.has('upsert')?.[1]).toMatchObject({ schedule_slot_id: 's1' });
  });

  it('adds planned entries with ON CONFLICT DO NOTHING on the slot-per-day index and returns the inserted ids', async () => {
    const f = fake({ entry: () => ({ data: [{ id: entry.id }], error: null }) });
    const other = { ...entry, id: 'e0000000-0000-4000-8000-000000000003', scheduleSlotId: 's2' };
    const ids = await new SupabaseRepository(f.client).addPlannedEntries([{ ...entry, scheduleSlotId: 's1' }, other]);
    expect(ids).toEqual([entry.id]);
    const [q] = f.of('entry');
    const up = q?.has('upsert');
    expect(up?.[2]).toEqual({ onConflict: 'dog_id,date,schedule_slot_id', ignoreDuplicates: true });
    expect((up?.[1] as unknown[]).length).toBe(2);
    expect(q?.calls).toContainEqual(['select', 'id']);
    expect(await new SupabaseRepository(fake({}).client).addPlannedEntries([])).toEqual([]);
  });

  it('deletes several entries at once (undo of a fill)', async () => {
    const f = fake({});
    await new SupabaseRepository(f.client).deleteEntries(['a', 'b']);
    expect(f.of('entry')[0]?.calls).toEqual([['delete'], ['in', 'id', ['a', 'b']]]);
  });

  it('upserts items and schedule slots in snake_case', async () => {
    const f = fake({});
    const repo = new SupabaseRepository(f.client);
    const id = 'c0000000-0000-4000-8000-000000000001';
    await repo.saveItem({ id, dogId: DOG.id, kind: 'medication', name: 'New', colour: 'mark-neutral', defaultDayPart: 1, activeFrom: '2026-10-15', activeTo: null, defaultUnit: 'pill' });
    expect(f.of('item')[0]?.has('upsert')?.[1]).toMatchObject({ id, kind: 'medication', default_unit: 'pill', flavours: [], conversion_unit: null, conversion_size: null, position: 0, hidden_by_default: false });
    await repo.saveScheduleSlot({ id, dogId: DOG.id, itemId: 'i1', dayPart: 3, flavour: '', amount: 1, unit: 'sachet', activeFrom: '2026-10-14', activeTo: '2026-10-20' });
    expect(f.of('schedule_slot')[0]?.has('upsert')?.[1]).toEqual({ id, dog_id: DOG.id, item_id: 'i1', day_part: 3, flavour: '', amount: 1, unit: 'sachet', active_from: '2026-10-14', active_to: '2026-10-20' });
    await repo.deleteScheduleSlot(id);
    expect(f.of('schedule_slot')[1]?.calls).toEqual([['delete'], ['eq', 'id', id]]);
    await expect(repo.saveScheduleSlot({ id: 'slot-1', dogId: DOG.id, itemId: 'i1', dayPart: 3, flavour: '', amount: 1, unit: 'sachet', activeFrom: '2026-10-14', activeTo: null })).rejects.toThrow(/UUID/);
  });

  it('reads day-part times over the defaults and saves one by (dog, part)', async () => {
    const f = withDog({ day_part: () => ({ data: [{ part: 2, usual_time: '08:15:00' }], error: null }) });
    const repo = new SupabaseRepository(f.client);
    const times = await repo.getDayPartTimes();
    expect(times[2]).toBe('08:15');
    expect(times[1]).toBe('07:00');
    await repo.saveDayPartTime(4, '15:30');
    const upsert = f.of('day_part')[1]?.has('upsert');
    expect(upsert?.[1]).toEqual({ dog_id: DOG.id, part: 4, usual_time: '15:30' });
    expect(upsert?.[2]).toEqual({ onConflict: 'dog_id,part' });
    await expect(repo.saveDayPartTime(4, '25:00')).rejects.toBeInstanceOf(RepositoryError);
  });

  it('reports a rejected write', async () => {
    const f = fake({ entry: () => ({ data: null, error: { message: 'new row violates row-level security policy', code: '42501' } }) });
    await expect(new SupabaseRepository(f.client).saveEntry(entry)).rejects.toThrow(/saveEntry: new row violates/);
  });
});

describe('today', () => {
  it('gives the local time of day as HH:MM', () => {
    expect(new SupabaseRepository(fake({}).client, () => new Date(2026, 9, 16, 7, 5)).nowTime()).toBe('07:05');
  });
  it('is the local calendar date', () => {
    expect(localDate(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
    const repo = new SupabaseRepository(fake({}).client, () => new Date(2026, 9, 16, 0, 1));
    expect(repo.today()).toBe('2026-10-16');
  });
});
