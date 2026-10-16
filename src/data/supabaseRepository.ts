import type { SupabaseClient } from '@supabase/supabase-js';
import { DuplicateSlotEntryError, NoDogError, RepositoryError } from './errors';
import type { Repository } from './repository';
import type {
  DateRange,
  DayPart,
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
}
interface ScheduleSlotRow {
  id: string;
  dog_id: string;
  item_id: string;
  day_part: number;
  dose_text: string;
  active_from: string;
  active_to: string | null;
}
interface EntryRow {
  id: string;
  dog_id: string;
  date: string;
  day_part: number;
  item_id: string;
  schedule_slot_id: string | null;
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
  issue_id: string | null;
}

const DOG_COLUMNS = 'id, household_id, name';
const ITEM_COLUMNS = 'id, dog_id, kind, name, colour, default_day_part, active_from, active_to, hidden_by_default';
const SLOT_COLUMNS = 'id, dog_id, item_id, day_part, dose_text, active_from, active_to';
const ENTRY_COLUMNS =
  'id, dog_id, date, day_part, item_id, schedule_slot_id, dose_text, state, note, created_by, updated_by';
const EVENT_COLUMNS = 'id, dog_id, date, type, title, detail, intensity, issue_id';
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
});

export const toScheduleSlot = (r: ScheduleSlotRow): ScheduleSlot => ({
  id: r.id,
  dogId: r.dog_id,
  itemId: r.item_id,
  dayPart: r.day_part as DayPart,
  doseText: r.dose_text,
  activeFrom: r.active_from,
  activeTo: r.active_to,
});

export const toEntry = (r: EntryRow): Entry => ({
  id: r.id,
  dogId: r.dog_id,
  date: r.date,
  dayPart: r.day_part as DayPart,
  itemId: r.item_id,
  scheduleSlotId: r.schedule_slot_id,
  doseText: r.dose_text,
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
  dose_text: e.doseText,
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

  async deleteEntry(id: string): Promise<void> {
    unwrap('deleteEntry', await this.client.from('entry').delete().eq('id', id));
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
