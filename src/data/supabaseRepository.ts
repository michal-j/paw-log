import type { SupabaseClient } from '@supabase/supabase-js';
import { DuplicateSlotEntryError, NoDogError, RepositoryError } from './errors';
import type { Repository } from './repository';
import { DEFAULT_DAY_PART_TIMES } from './repository';
import type {
  AlsoDone,
  DateRange,
  DayPart,
  DayPartTimes,
  Dog,
  Entry,
  EntryState,
  EventType,
  HealthEvent,
  Intensity,
  Item,
  ItemKind,
  PlainDate,
  ScheduleSlot,
  Unit,
} from './types';

export { DuplicateSlotEntryError, NoDogError, RepositoryError };

/** Rows as stored in Postgres (supabase/migrations). Only the columns the app reads. */
interface DogRow {
  id: string;
  household_id: string;
  name: string;
}
interface ItemRow {
  id: string;
  dog_id: string;
  kind: ItemKind;
  name: string;
  colour: string;
  default_day_part: number;
  active_from: string;
  active_to: string | null;
  hidden_by_default: boolean;
  position: number;
  default_unit: Unit | null;
  flavours: string[] | null;
  conversion_unit: 'bars' | null;
  conversion_size: number | string | null;
}
interface ScheduleSlotRow {
  id: string;
  dog_id: string;
  item_id: string;
  day_part: number;
  flavour: string;
  amount: number | string | null;
  unit: Unit | null;
  active_from: string;
  active_to: string | null;
}
interface DayPartRow {
  part: number;
  usual_time: string;
}
interface EntryRow {
  id: string;
  dog_id: string;
  date: string;
  day_part: number;
  item_id: string;
  schedule_slot_id: string | null;
  amount: number | string | null;
  unit: Unit | null;
  flavour: string;
  dose_text: string;
  state: EntryState;
  note: string;
  created_by: string | null;
  updated_by: string | null;
}
interface EventRow {
  id: string;
  dog_id: string;
  date: string;
  type: EventType;
  title: string;
  detail: string;
  intensity: Intensity | null;
  props: Record<string, string> | null;
  also_done: AlsoDone[] | null;
  issue_id: string | null;
}

const DOG_COLUMNS = 'id, household_id, name';
const ITEM_COLUMNS =
  'id, dog_id, kind, name, colour, default_day_part, active_from, active_to, hidden_by_default, position, default_unit, flavours, conversion_unit, conversion_size';
const SLOT_COLUMNS = 'id, dog_id, item_id, day_part, flavour, amount, unit, active_from, active_to';
const ENTRY_COLUMNS =
  'id, dog_id, date, day_part, item_id, schedule_slot_id, amount, unit, flavour, dose_text, state, note, created_by, updated_by';
const EVENT_COLUMNS = 'id, dog_id, date, type, title, detail, intensity, props, also_done, issue_id';
/** Postgres unique_violation: on entry, the one-entry-per-slot-per-day index. */
const UNIQUE_VIOLATION = '23505';

/** PostgREST returns at most 1000 rows per request by default; lists are read in pages of this size. */
export const PAGE_SIZE = 1000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface Result<T> {
  data: T | null;
  error: { message: string; code?: string } | null;
}

function unwrap<T>(operation: string, { data, error }: Result<T>): T {
  if (error) throw new RepositoryError(operation, error.code, error.message);
  return data as T;
}

/** Local calendar date `YYYY-MM-DD`. The household and its devices share one timezone. */
export function localDate(now: Date): PlainDate {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** numeric columns may arrive as strings; null stays null. */
const num = (v: number | string | null): number | null => (v === null || v === undefined ? null : Number(v));

export const toDog = (r: DogRow): Dog => ({ id: r.id, householdId: r.household_id, name: r.name });

export const toItem = (r: ItemRow): Item => ({
  id: r.id,
  dogId: r.dog_id,
  kind: r.kind,
  name: r.name,
  colour: r.colour,
  defaultDayPart: r.default_day_part as DayPart,
  activeFrom: r.active_from,
  activeTo: r.active_to,
  ...(r.hidden_by_default ? { hiddenByDefault: true } : {}),
  defaultUnit: r.default_unit ?? null,
  flavours: r.flavours ?? [],
  conversion: r.conversion_unit && r.conversion_size !== null ? { unit: r.conversion_unit, size: Number(r.conversion_size) } : null,
  position: r.position ?? 0,
});

export const fromItem = (i: Item) => ({
  id: i.id,
  dog_id: i.dogId,
  kind: i.kind,
  name: i.name,
  colour: i.colour,
  default_day_part: i.defaultDayPart,
  active_from: i.activeFrom,
  active_to: i.activeTo,
  hidden_by_default: !!i.hiddenByDefault,
  position: i.position ?? 0,
  default_unit: i.defaultUnit ?? null,
  flavours: i.flavours ?? [],
  conversion_unit: i.conversion?.unit ?? null,
  conversion_size: i.conversion?.size ?? null,
});

export const toScheduleSlot = (r: ScheduleSlotRow): ScheduleSlot => ({
  id: r.id,
  dogId: r.dog_id,
  itemId: r.item_id,
  dayPart: r.day_part as DayPart,
  flavour: r.flavour ?? '',
  amount: num(r.amount),
  unit: r.unit ?? null,
  activeFrom: r.active_from,
  activeTo: r.active_to,
});

export const fromScheduleSlot = (s: ScheduleSlot) => ({
  id: s.id,
  dog_id: s.dogId,
  item_id: s.itemId,
  day_part: s.dayPart,
  flavour: s.flavour,
  amount: s.amount,
  unit: s.unit,
  active_from: s.activeFrom,
  active_to: s.activeTo,
});

export const toEntry = (r: EntryRow): Entry => ({
  id: r.id,
  dogId: r.dog_id,
  date: r.date,
  dayPart: r.day_part as DayPart,
  itemId: r.item_id,
  scheduleSlotId: r.schedule_slot_id,
  amount: num(r.amount),
  unit: r.unit ?? null,
  flavour: r.flavour ?? '',
  doseText: r.dose_text ?? '',
  state: r.state,
  note: r.note,
  createdBy: r.created_by ?? '',
  updatedBy: r.updated_by ?? '',
});

export const toEvent = (r: EventRow): HealthEvent => ({
  id: r.id,
  dogId: r.dog_id,
  date: r.date,
  type: r.type,
  title: r.title,
  detail: r.detail,
  intensity: r.intensity,
  props: r.props ?? {},
  alsoDone: r.also_done ?? [],
  issueId: r.issue_id,
});

/** created_by, updated_by and the timestamps are set by the database, never by the client. */
export const fromEntry = (e: Entry) => ({
  id: e.id,
  dog_id: e.dogId,
  date: e.date,
  day_part: e.dayPart,
  item_id: e.itemId,
  schedule_slot_id: e.scheduleSlotId ?? null,
  amount: e.amount,
  unit: e.unit,
  flavour: e.flavour,
  dose_text: e.doseText ?? '',
  state: e.state,
  note: e.note,
});

export const fromEvent = (e: HealthEvent) => ({
  id: e.id,
  dog_id: e.dogId,
  date: e.date,
  type: e.type,
  title: e.title,
  detail: e.detail,
  intensity: e.intensity ?? null,
  props: e.props ?? {},
  also_done: e.alsoDone ?? [],
  issue_id: e.issueId,
});

function requireUuid(operation: string, id: string) {
  if (!UUID.test(id)) {
    throw new RepositoryError(operation, undefined, `id "${id}" is not a UUID; create new ids with crypto.randomUUID()`);
  }
}

/**
 * Real data in Supabase. Row-level security limits every query to the signed-in user's household,
 * so the repository only adds the dog filter. Create one instance per signed-in session.
 */
export class SupabaseRepository implements Repository {
  private dog: Promise<Dog> | null = null;

  constructor(
    private readonly client: SupabaseClient,
    private readonly now: () => Date = () => new Date(),
  ) {}

  today(): PlainDate {
    return localDate(this.now());
  }

  nowTime(): string {
    const d = this.now();
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }

  /** The household's dog (the first one, while the app shows a single dog). Cached after the first success. */
  getDog(): Promise<Dog> {
    this.dog ??= this.loadDog().catch((err: unknown) => {
      this.dog = null;
      throw err;
    });
    return this.dog;
  }

  async listItems(): Promise<Item[]> {
    const dog = await this.getDog();
    const rows = unwrap<ItemRow[]>(
      'listItems',
      await this.client
        .from('item')
        .select(ITEM_COLUMNS)
        .eq('dog_id', dog.id)
        .order('position')
        .order('created_at'),
    );
    return rows.map(toItem);
  }

  async saveItem(item: Item): Promise<void> {
    requireUuid('saveItem', item.id);
    unwrap('saveItem', await this.client.from('item').upsert(fromItem(item), { onConflict: 'id' }));
  }

  async listScheduleSlots(range?: DateRange): Promise<ScheduleSlot[]> {
    const dog = await this.getDog();
    const rows = await this.pages<ScheduleSlotRow>('listScheduleSlots', (from, to) => {
      let q = this.client.from('schedule_slot').select(SLOT_COLUMNS).eq('dog_id', dog.id);
      // Active in the range: starts before it ends, and has not ended before it starts.
      if (range?.to) q = q.lte('active_from', range.to);
      if (range?.from) q = q.or(`active_to.is.null,active_to.gte.${range.from}`);
      return q.order('day_part').order('active_from').order('id').range(from, to);
    });
    return rows.map(toScheduleSlot);
  }

  async saveScheduleSlot(slot: ScheduleSlot): Promise<void> {
    requireUuid('saveScheduleSlot', slot.id);
    unwrap('saveScheduleSlot', await this.client.from('schedule_slot').upsert(fromScheduleSlot(slot), { onConflict: 'id' }));
  }

  /** Entries that filled the slot keep their row; the foreign key clears their schedule_slot_id. */
  async deleteScheduleSlot(id: string): Promise<void> {
    unwrap('deleteScheduleSlot', await this.client.from('schedule_slot').delete().eq('id', id));
  }

  async getDayPartTimes(): Promise<DayPartTimes> {
    const dog = await this.getDog();
    const rows = unwrap<DayPartRow[]>(
      'getDayPartTimes',
      await this.client.from('day_part').select('part, usual_time').eq('dog_id', dog.id),
    );
    const times: DayPartTimes = { ...DEFAULT_DAY_PART_TIMES };
    for (const r of rows) times[r.part as DayPart] = r.usual_time.slice(0, 5);
    return times;
  }

  async saveDayPartTime(part: DayPart, time: string): Promise<void> {
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new RepositoryError('saveDayPartTime', undefined, `"${time}" is not HH:MM`);
    const dog = await this.getDog();
    unwrap(
      'saveDayPartTime',
      await this.client.from('day_part').upsert({ dog_id: dog.id, part, usual_time: time }, { onConflict: 'dog_id,part' }),
    );
  }

  async listEntries(range?: DateRange): Promise<Entry[]> {
    const dog = await this.getDog();
    const rows = await this.pages<EntryRow>('listEntries', (from, to) => {
      let q = this.client.from('entry').select(ENTRY_COLUMNS).eq('dog_id', dog.id);
      if (range?.from) q = q.gte('date', range.from);
      if (range?.to) q = q.lte('date', range.to);
      return q.order('date').order('day_part').order('id').range(from, to);
    });
    return rows.map(toEntry);
  }

  async listEvents(range?: DateRange): Promise<HealthEvent[]> {
    const dog = await this.getDog();
    const rows = await this.pages<EventRow>('listEvents', (from, to) => {
      let q = this.client.from('event').select(EVENT_COLUMNS).eq('dog_id', dog.id);
      if (range?.from) q = q.gte('date', range.from);
      if (range?.to) q = q.lte('date', range.to);
      return q.order('date').order('id').range(from, to);
    });
    return rows.map(toEvent);
  }

  async saveEntry(entry: Entry): Promise<void> {
    requireUuid('saveEntry', entry.id);
    const result = await this.client.from('entry').upsert(fromEntry(entry), { onConflict: 'id' });
    if (result.error?.code === UNIQUE_VIOLATION && entry.scheduleSlotId) {
      throw new DuplicateSlotEntryError(entry.date, entry.scheduleSlotId);
    }
    unwrap('saveEntry', result);
  }

  async addPlannedEntries(entries: Entry[]): Promise<string[]> {
    if (!entries.length) return [];
    entries.forEach((e) => requireUuid('addPlannedEntries', e.id));
    // ON CONFLICT DO NOTHING on the one-entry-per-slot-per-day index: a slot someone else filled is skipped.
    const rows = unwrap<{ id: string }[]>(
      'addPlannedEntries',
      await this.client
        .from('entry')
        .upsert(entries.map(fromEntry), { onConflict: 'dog_id,date,schedule_slot_id', ignoreDuplicates: true })
        .select('id'),
    );
    return (rows ?? []).map((r) => r.id);
  }

  async deleteEntry(id: string): Promise<void> {
    unwrap('deleteEntry', await this.client.from('entry').delete().eq('id', id));
  }

  async deleteEntries(ids: string[]): Promise<void> {
    if (!ids.length) return;
    unwrap('deleteEntries', await this.client.from('entry').delete().in('id', ids));
  }

  async saveEvent(event: HealthEvent): Promise<void> {
    requireUuid('saveEvent', event.id);
    unwrap('saveEvent', await this.client.from('event').upsert(fromEvent(event), { onConflict: 'id' }));
  }

  async deleteEvent(id: string): Promise<void> {
    unwrap('deleteEvent', await this.client.from('event').delete().eq('id', id));
  }

  private async loadDog(): Promise<Dog> {
    const rows = unwrap<DogRow[]>(
      'getDog',
      await this.client.from('dog').select(DOG_COLUMNS).order('created_at').limit(1),
    );
    const [row] = rows;
    if (!row) throw new NoDogError();
    return toDog(row);
  }

  /** Read every page of a list query; `build` must create a fresh query for each page. */
  private async pages<T>(operation: string, build: (from: number, to: number) => PromiseLike<Result<T[]>>) {
    const all: T[] = [];
    for (let from = 0; ; from += PAGE_SIZE) {
      const page = unwrap<T[]>(operation, await build(from, from + PAGE_SIZE - 1));
      all.push(...page);
      if (page.length < PAGE_SIZE) return all;
    }
  }
}
