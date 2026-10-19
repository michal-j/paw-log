import type { SupabaseClient } from '@supabase/supabase-js';
import { DuplicateSlotEntryError, NoDogError, RepositoryError } from './errors';
import type { Repository } from './repository';
import { DEFAULT_DAY_PART_TIMES } from './repository';
import type {
  AlsoDone,
  Condition,
  DateRange,
  DayPart,
  DayPartTimes,
  Dog,
  DogSettings,
  Entry,
  EntryState,
  EventType,
  HealthEvent,
  Intensity,
  Item,
  ItemKind,
  Photo,
  PhotoFiles,
  PhotoSize,
  PinnedNote,
  PlainDate,
  RemovedSlot,
  ScheduleSlot,
  Unit,
} from './types';
import { photoPath } from './types';
import { UploadError, defaultUploader, type UploadResponse, type Uploader } from './upload';

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
  is_course: boolean | null;
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
  state: EntryState | 'removed';
  note: string;
  created_by: string | null;
  updated_by: string | null;
}
interface PinnedNoteRow {
  id: string;
  dog_id: string;
  title: string;
  body: string;
  position: number;
  created_by: string | null;
  updated_by: string | null;
  updated_at: string;
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
}
interface ConditionRow {
  id: string;
  dog_id: string;
  name: string;
  started_on: string;
  description: string;
  resolved_on: string | null;
  position: number;
}
interface LinkRow {
  event_id: string;
  condition_id: string;
}
interface AttachmentRow {
  id: string;
  dog_id: string;
  event_id: string;
  width: number;
  height: number;
  taken_at: string | null;
  caption: string;
  position: number;
}

const DOG_COLUMNS = 'id, household_id, name';
const ITEM_COLUMNS =
  'id, dog_id, kind, name, colour, default_day_part, active_from, active_to, hidden_by_default, position, default_unit, flavours, conversion_unit, conversion_size';
const SLOT_COLUMNS = 'id, dog_id, item_id, day_part, flavour, amount, unit, active_from, active_to, is_course';
const ENTRY_COLUMNS =
  'id, dog_id, date, day_part, item_id, schedule_slot_id, amount, unit, flavour, dose_text, state, note, created_by, updated_by';
const EVENT_COLUMNS = 'id, dog_id, date, type, title, detail, intensity, props, also_done';
const CONDITION_COLUMNS = 'id, dog_id, name, started_on, description, resolved_on, position';
const PINNED_COLUMNS = 'id, dog_id, title, body, position, created_by, updated_by, updated_at';
const ATTACHMENT_COLUMNS = 'id, dog_id, event_id, width, height, taken_at, caption, position';
/** The private storage bucket of photos (migration 20261020120000). */
export const PHOTO_BUCKET = 'photos';
/** Signed photo URLs last this long; one is reused until it has less than PHOTO_URL_MARGIN_S left. */
export const PHOTO_URL_TTL_S = 600;
const PHOTO_URL_MARGIN_S = 120;
/** entry.state of a usual-day item removed for a day (migration 20261017120000). */
const REMOVED = 'removed';
/** Postgres unique_violation: on entry, the one-entry-per-slot-per-day index. */
const UNIQUE_VIOLATION = '23505';

/** PostgREST returns at most 1000 rows per request by default; lists are read in pages of this size. */
export const PAGE_SIZE = 1000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface Result<T> {
  data: T | null;
  error: { message: string; code?: string } | null;
}

/** Storage errors carry an HTTP status rather than a Postgres code. */
function storageCode(error: { message: string; status?: number; statusCode?: string }): string | undefined {
  const status = 'status' in error ? error.status : undefined;
  return status ? String(status) : error.statusCode;
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
  course: !!r.is_course,
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
  is_course: !!s.course && s.activeTo !== null,
});

export const toRemovedSlot = (r: EntryRow): RemovedSlot => ({
  id: r.id,
  dogId: r.dog_id,
  date: r.date,
  dayPart: r.day_part as DayPart,
  itemId: r.item_id,
  scheduleSlotId: r.schedule_slot_id ?? '',
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
  state: r.state as EntryState,
  note: r.note,
  createdBy: r.created_by ?? '',
  updatedBy: r.updated_by ?? '',
});

export const toPinnedNote = (r: PinnedNoteRow): PinnedNote => ({
  id: r.id,
  dogId: r.dog_id,
  title: r.title ?? '',
  body: r.body,
  position: r.position ?? 0,
  updatedOn: localDate(new Date(r.updated_at)),
  updatedAt: r.updated_at,
  createdBy: r.created_by ?? '',
  updatedBy: r.updated_by ?? '',
});

/** created_by, updated_by and the timestamps are set by the database, never by the client. */
export const fromPinnedNote = (n: PinnedNote) => ({
  id: n.id,
  dog_id: n.dogId,
  title: n.title,
  body: n.body,
  position: n.position,
});

/** `conditionIds`: the event's links (event_condition), read separately. */
export const toEvent = (r: EventRow, conditionIds: string[] = []): HealthEvent => ({
  id: r.id,
  dogId: r.dog_id,
  date: r.date,
  type: r.type,
  title: r.title,
  detail: r.detail,
  intensity: r.intensity,
  props: r.props ?? {},
  alsoDone: r.also_done ?? [],
  conditionIds,
});

export const toCondition = (r: ConditionRow): Condition => ({
  id: r.id,
  dogId: r.dog_id,
  name: r.name,
  startedOn: r.started_on,
  description: r.description ?? '',
  resolvedOn: r.resolved_on,
  position: r.position ?? 0,
});

/** created_by, updated_by and the timestamps are set by the database. */
export const fromCondition = (c: Condition) => ({
  id: c.id,
  dog_id: c.dogId,
  name: c.name,
  started_on: c.startedOn,
  description: c.description,
  resolved_on: c.resolvedOn,
  position: c.position,
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
});

/** `taken_at` comes back as `YYYY-MM-DDTHH:MM:SS` or `YYYY-MM-DD HH:MM:SS`; the app uses the first. */
const wallClock = (v: string | null) => (v ? v.replace(' ', 'T').slice(0, 19) : null);

export const toPhoto = (r: AttachmentRow): Photo => ({
  id: r.id,
  dogId: r.dog_id,
  eventId: r.event_id,
  width: r.width,
  height: r.height,
  takenAt: wallClock(r.taken_at),
  caption: r.caption ?? '',
  position: r.position ?? 0,
});

/** created_by, updated_by and the timestamps are set by the database. */
export const fromPhoto = (p: Photo) => ({
  id: p.id,
  dog_id: p.dogId,
  event_id: p.eventId,
  kind: 'photo',
  storage_path: photoPath(p),
  width: p.width,
  height: p.height,
  taken_at: p.takenAt,
  caption: p.caption,
  position: p.position,
});

export interface SupabaseRepositoryOptions {
  /**
   * Turns a signed URL into the URL an <img> gets. The app uses it as it is; the dev harness, whose
   * fake backend has no network address, loads it through the client and hands out a blob: URL.
   */
  displayUrl?: (signedUrl: string) => Promise<string>;
  /** How file bytes are sent (default: XMLHttpRequest with progress-based limits; tests use the fake's fetch). */
  upload?: Uploader;
}

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
  /** Signed photo URLs by storage path, reused while they have time left (the browser then caches the image). */
  private readonly signed = new Map<string, { url: string; until: number }>();

  constructor(
    private readonly client: SupabaseClient,
    private readonly now: () => Date = () => new Date(),
    private readonly options: SupabaseRepositoryOptions = {},
  ) {
    this.upload = options.upload ?? defaultUploader();
  }
  private readonly upload: Uploader;

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
        .order('created_at')
        // Same order as the item-colour migration, ties included (JCB-59).
        .order('id'),
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
    return (await this.entryRows('listEntries', range, false)).map(toEntry);
  }

  async listRemovedSlots(range?: DateRange): Promise<RemovedSlot[]> {
    return (await this.entryRows('listRemovedSlots', range, true)).filter((r) => r.schedule_slot_id).map(toRemovedSlot);
  }

  /** Updates the row in place (same id): the slot stays taken for the day, so Fill skips it. */
  async removeFromDay(entry: Entry, slotId: string): Promise<void> {
    requireUuid('removeFromDay', entry.id);
    const row = { ...fromEntry(entry), schedule_slot_id: slotId, state: REMOVED };
    const result = await this.client.from('entry').upsert(row, { onConflict: 'id' });
    if (result.error?.code === UNIQUE_VIOLATION) throw new DuplicateSlotEntryError(entry.date, slotId);
    unwrap('removeFromDay', result);
  }

  async getSettings(): Promise<DogSettings> {
    const dog = await this.getDog();
    const rows = unwrap<{ log_start: string | null }[]>(
      'getSettings',
      await this.client.from('dog_settings').select('log_start').eq('dog_id', dog.id),
    );
    return { logStart: rows[0]?.log_start ?? null };
  }

  async saveSettings(settings: DogSettings): Promise<void> {
    const dog = await this.getDog();
    unwrap(
      'saveSettings',
      await this.client.from('dog_settings').upsert({ dog_id: dog.id, log_start: settings.logStart }, { onConflict: 'dog_id' }),
    );
  }

  private async entryRows(operation: string, range: DateRange | undefined, removed: boolean): Promise<EntryRow[]> {
    const dog = await this.getDog();
    return this.pages<EntryRow>(operation, (from, to) => {
      let q = this.client.from('entry').select(ENTRY_COLUMNS).eq('dog_id', dog.id);
      q = removed ? q.eq('state', REMOVED) : q.neq('state', REMOVED);
      if (range?.from) q = q.gte('date', range.from);
      if (range?.to) q = q.lte('date', range.to);
      return q.order('date').order('day_part').order('id').range(from, to);
    });
  }

  async listEvents(range?: DateRange): Promise<HealthEvent[]> {
    const dog = await this.getDog();
    const rows = await this.pages<EventRow>('listEvents', (from, to) => {
      let q = this.client.from('event').select(EVENT_COLUMNS).eq('dog_id', dog.id);
      if (range?.from) q = q.gte('date', range.from);
      if (range?.to) q = q.lte('date', range.to);
      return q.order('date').order('id').range(from, to);
    });
    const links = new Map<string, string[]>();
    for (const l of await this.links('listEvents', dog.id)) links.set(l.event_id, [...(links.get(l.event_id) ?? []), l.condition_id]);
    return rows.map((r) => toEvent(r, links.get(r.id)));
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

  /**
   * Upsert the event, then make its links exactly `conditionIds`: add the missing ones first, then
   * drop the others. A linked condition that starts after the event's date moves its start back to
   * that date (never forward). Each step can be repeated safely, so a retry after a failure converges.
   */
  async saveEvent(event: HealthEvent): Promise<void> {
    requireUuid('saveEvent', event.id);
    event.conditionIds.forEach((id) => requireUuid('saveEvent', id));
    unwrap('saveEvent', await this.client.from('event').upsert(fromEvent(event), { onConflict: 'id' }));
    const ids = [...new Set(event.conditionIds)];
    if (ids.length) {
      const rows = ids.map((condition_id) => ({ event_id: event.id, condition_id, dog_id: event.dogId }));
      unwrap(
        'saveEvent',
        await this.client.from('event_condition').upsert(rows, { onConflict: 'event_id,condition_id', ignoreDuplicates: true }),
      );
    }
    if (ids.length) {
      unwrap('saveEvent', await this.client.from('condition').update({ started_on: event.date }).in('id', ids).gt('started_on', event.date));
    }
    let stale = this.client.from('event_condition').delete().eq('event_id', event.id);
    if (ids.length) stale = stale.not('condition_id', 'in', `(${ids.join(',')})`);
    unwrap('saveEvent', await stale);
  }

  /** Its links go with it (on delete cascade). */
  async deleteEvent(id: string): Promise<void> {
    unwrap('deleteEvent', await this.client.from('event').delete().eq('id', id));
  }

  async listConditions(): Promise<Condition[]> {
    const dog = await this.getDog();
    const rows = await this.pages<ConditionRow>('listConditions', (from, to) =>
      this.client
        .from('condition')
        .select(CONDITION_COLUMNS)
        .eq('dog_id', dog.id)
        .order('started_on', { ascending: false })
        .order('position')
        .order('id')
        .range(from, to),
    );
    return rows.map(toCondition);
  }

  async saveCondition(condition: Condition): Promise<void> {
    requireUuid('saveCondition', condition.id);
    unwrap('saveCondition', await this.client.from('condition').upsert(fromCondition(condition), { onConflict: 'id' }));
  }

  /** Its links go with it (on delete cascade); the events stay. */
  async deleteCondition(id: string): Promise<void> {
    unwrap('deleteCondition', await this.client.from('condition').delete().eq('id', id));
  }

  async linkEvents(conditionId: string, eventIds: string[]): Promise<void> {
    if (!eventIds.length) return;
    const dog = await this.getDog();
    const rows = eventIds.map((event_id) => ({ event_id, condition_id: conditionId, dog_id: dog.id }));
    unwrap(
      'linkEvents',
      await this.client.from('event_condition').upsert(rows, { onConflict: 'event_id,condition_id', ignoreDuplicates: true }),
    );
  }

  private links(operation: string, dogId: string): Promise<LinkRow[]> {
    return this.pages<LinkRow>(operation, (from, to) =>
      this.client
        .from('event_condition')
        .select('event_id, condition_id')
        .eq('dog_id', dogId)
        .order('event_id')
        .order('condition_id')
        .range(from, to),
    );
  }

  async listPhotos(): Promise<Photo[]> {
    const dog = await this.getDog();
    const rows = await this.pages<AttachmentRow>('listPhotos', (from, to) =>
      this.client
        .from('attachment')
        .select(ATTACHMENT_COLUMNS)
        .eq('dog_id', dog.id)
        .eq('kind', 'photo')
        .order('event_id')
        .order('position')
        .order('id')
        .range(from, to),
    );
    return rows.map(toPhoto);
  }

  /**
   * Upsert both files (same paths every time), so a retry replaces what an earlier attempt left.
   * Each file: a signed upload URL for its path (a short request, checked against the storage
   * policies), then the bytes through `options.upload`, which has upload limits of its own
   * (src/data/upload.ts) instead of the 10 s / 15 s of other calls: slow mobile data still works.
   */
  async uploadPhotoFiles(photo: Photo, files: PhotoFiles): Promise<void> {
    requireUuid('uploadPhotoFiles', photo.id);
    const bucket = this.client.storage.from(PHOTO_BUCKET);
    for (const size of ['thumb', 'full'] as const) {
      const { data, error } = await bucket.createSignedUploadUrl(photoPath(photo, size), { upsert: true });
      if (error || !data) throw new RepositoryError('uploadPhotoFiles', error ? storageCode(error) : undefined, error?.message ?? 'no upload URL');
      let res: UploadResponse;
      try {
        res = await this.upload({
          url: data.signedUrl,
          headers: {
            'content-type': 'image/jpeg',
            'x-upsert': 'true',
            // A path never gets other content (a changed photo is a new attachment), so it may be cached for long.
            'cache-control': 'max-age=31536000',
          },
          body: files[size],
        });
      } catch (err) {
        throw new RepositoryError('uploadPhotoFiles', err instanceof UploadError ? err.kind : undefined, String((err as Error).message));
      }
      if (res.status < 200 || res.status >= 300) {
        let message = res.text;
        try {
          message = (JSON.parse(res.text) as { message?: string }).message ?? message;
        } catch {
          /* not JSON */
        }
        throw new RepositoryError('uploadPhotoFiles', String(res.status), message);
      }
    }
  }

  async savePhoto(photo: Photo): Promise<void> {
    requireUuid('savePhoto', photo.id);
    unwrap('savePhoto', await this.client.from('attachment').upsert(fromPhoto(photo), { onConflict: 'id' }));
  }

  async deletePhoto(id: string): Promise<void> {
    unwrap('deletePhoto', await this.client.from('attachment').delete().eq('id', id));
  }

  /** The storage policy refuses files whose row still exists, so this never removes a photo that is shown. */
  async purgePhotoFiles(photos: Pick<Photo, 'id' | 'dogId'>[]): Promise<void> {
    if (!photos.length) return;
    const paths = photos.flatMap((p) => [photoPath(p), photoPath(p, 'thumb')]);
    const { error } = await this.client.storage.from(PHOTO_BUCKET).remove(paths);
    if (error) throw new RepositoryError('purgePhotoFiles', storageCode(error), error.message);
    for (const path of paths) this.signed.delete(path);
  }

  /** One signing request for every path without a fresh URL; the others come from memory. */
  async photoUrls(photos: Pick<Photo, 'id' | 'dogId'>[], size: PhotoSize): Promise<Record<string, string>> {
    const now = this.now().getTime();
    const pathOf = new Map(photos.map((p) => [p.id, photoPath(p, size)]));
    const stale = [...new Set(pathOf.values())].filter((path) => (this.signed.get(path)?.until ?? 0) <= now);
    if (stale.length) {
      const { data, error } = await this.client.storage.from(PHOTO_BUCKET).createSignedUrls(stale, PHOTO_URL_TTL_S);
      if (error) throw new RepositoryError('photoUrls', storageCode(error), error.message);
      const until = now + (PHOTO_URL_TTL_S - PHOTO_URL_MARGIN_S) * 1000;
      for (const item of data ?? []) {
        if (!item.signedUrl || !item.path || item.error) continue;
        const url = this.options.displayUrl ? await this.options.displayUrl(item.signedUrl) : item.signedUrl;
        this.signed.set(item.path, { url, until });
      }
    }
    const out: Record<string, string> = {};
    for (const [id, path] of pathOf) {
      const hit = this.signed.get(path);
      if (hit) out[id] = hit.url;
    }
    return out;
  }

  async listPinnedNotes(): Promise<PinnedNote[]> {
    const dog = await this.getDog();
    const rows = unwrap<PinnedNoteRow[]>(
      'listPinnedNotes',
      await this.client.from('pinned_note').select(PINNED_COLUMNS).eq('dog_id', dog.id).order('position').order('created_at').order('id'),
    );
    return rows.map(toPinnedNote);
  }

  async savePinnedNote(note: PinnedNote): Promise<void> {
    requireUuid('savePinnedNote', note.id);
    unwrap('savePinnedNote', await this.client.from('pinned_note').upsert(fromPinnedNote(note), { onConflict: 'id' }));
  }

  async restorePinnedNote(note: PinnedNote): Promise<void> {
    requireUuid('restorePinnedNote', note.id);
    // The exact time when known; else noon of the day it showed (a date shows the same day).
    const at = note.updatedAt ?? (note.updatedOn ? new Date(`${note.updatedOn}T12:00:00`).toISOString() : new Date().toISOString());
    unwrap(
      'restorePinnedNote',
      await this.client.rpc('restore_pinned_note', {
        p_id: note.id,
        p_dog_id: note.dogId,
        p_title: note.title,
        p_body: note.body,
        p_position: note.position,
        p_created_by: note.createdBy || null,
        p_updated_by: note.updatedBy || null,
        p_updated_at: at,
      }),
    );
  }

  async deletePinnedNote(id: string): Promise<void> {
    unwrap('deletePinnedNote', await this.client.from('pinned_note').delete().eq('id', id));
  }

  /** One update per note, in order; the database does not count a move as an edit. */
  async reorderPinnedNotes(ids: string[]): Promise<void> {
    for (const [position, id] of ids.entries()) {
      unwrap('reorderPinnedNotes', await this.client.from('pinned_note').update({ position }).eq('id', id));
    }
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
