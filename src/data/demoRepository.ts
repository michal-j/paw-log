import dogJson from '../../data/demo/dog.json';
import itemsJson from '../../data/demo/items.json';
import scheduleJson from '../../data/demo/schedule.json';
import entriesJson from '../../data/demo/entries.json';
import eventsJson from '../../data/demo/events.json';
import conditionsJson from '../../data/demo/conditions.json';
import pinnedJson from '../../data/demo/pinned.json';
import { DuplicateSlotEntryError } from './errors';
import { DEFAULT_DAY_PART_TIMES, type Repository } from './repository';
import type { Condition, DateRange, DayPart, DayPartTimes, Dog, DogSettings, Entry, EntryState, HealthEvent, Item, PinnedNote, RemovedSlot, ScheduleSlot } from './types';

/** v2: JCB-39 changed the shape (amounts, usual day). Changes saved under v1 are dropped. */
export const DEMO_STORAGE_KEY = 'pawlog.demo.v2';

/** Entries as stored: a usual-day item removed for a day is a row with state `removed` (as in the database). */
type StoredEntry = Omit<Entry, 'state'> & { state: EntryState | 'removed' };
/** Events as stored: their condition links are kept in `links`, as in the database. */
type StoredEvent = Omit<HealthEvent, 'conditionIds'>;
interface Link {
  eventId: string;
  conditionId: string;
}

interface Persisted {
  items: Item[];
  slots: ScheduleSlot[];
  entries: StoredEntry[];
  events: StoredEvent[];
  /** Absent in changes saved before JCB-5: seeded then. */
  pinned?: PinnedNote[];
  times: DayPartTimes;
  /** Absent in changes saved before JCB-43. */
  settings?: DogSettings;
  /** Absent in changes saved before JCB-6: the sample conditions are added then. */
  conditions?: Condition[];
  links?: Link[];
}

const isEntry = (e: StoredEntry): e is Entry => e.state !== 'removed';

const { today, ...dogFields } = dogJson;
const inRange = (date: string, range?: DateRange) =>
  (!range?.from || date >= range.from) && (!range?.to || date <= range.to);
const byDate = <T extends { date: string }>(a: T, b: T) => a.date.localeCompare(b.date);
const activeIn = (slot: ScheduleSlot, range?: DateRange) =>
  (!range?.to || slot.activeFrom <= range.to) && (!range?.from || slot.activeTo === null || slot.activeTo >= range.from);
const copy = <T>(x: T): T => structuredClone(x);

function seed(): Persisted {
  return {
    items: copy(itemsJson as Item[]),
    slots: copy(scheduleJson as ScheduleSlot[]),
    entries: copy(entriesJson as Entry[]),
    events: copy(eventsJson as StoredEvent[]),
    pinned: copy(pinnedJson as PinnedNote[]),
    times: { ...DEFAULT_DAY_PART_TIMES },
    settings: { logStart: null },
    conditions: copy(conditionsJson.conditions as Condition[]),
    links: copy(conditionsJson.links),
  };
}

const stored = (event: HealthEvent): StoredEvent => {
  const rest: Partial<HealthEvent> = copy(event);
  delete rest.conditionIds;
  return rest as StoredEvent;
};

const hhmm = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

/** Fictional frozen data; edits persist only in the visitor's localStorage. The date is frozen, the clock is the device's. */
export class DemoRepository implements Repository {
  private data: Persisted;

  constructor(
    private readonly storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null = safeStorage(),
    private readonly now: () => Date = () => new Date(),
  ) {
    this.data = this.load() ?? seed();
  }

  today() {
    return today;
  }
  nowTime() {
    return hhmm(this.now());
  }
  async getDog(): Promise<Dog> {
    return dogFields;
  }
  async listItems(): Promise<Item[]> {
    return copy(this.data.items);
  }
  async saveItem(item: Item) {
    this.data.items = upsert(this.data.items, copy(item));
    this.persist();
  }
  async listScheduleSlots(range?: DateRange) {
    return copy(this.data.slots.filter((slot) => activeIn(slot, range)));
  }
  async saveScheduleSlot(slot: ScheduleSlot) {
    this.data.slots = upsert(this.data.slots, copy(slot));
    this.persist();
  }
  async deleteScheduleSlot(id: string) {
    // Same as the database: entries that filled the slot stay, unplanned.
    this.data.slots = this.data.slots.filter((s) => s.id !== id);
    this.data.entries = this.data.entries.map((e) => (e.scheduleSlotId === id ? { ...e, scheduleSlotId: null } : e));
    this.persist();
  }
  async getDayPartTimes() {
    return { ...this.data.times };
  }
  async saveDayPartTime(part: DayPart, time: string) {
    this.data.times = { ...this.data.times, [part]: time };
    this.persist();
  }
  async listEntries(range?: DateRange): Promise<Entry[]> {
    return copy(this.data.entries.filter(isEntry).filter((e) => inRange(e.date, range)).sort(byDate));
  }
  async saveEntry(entry: Entry) {
    if (this.slotTaken(entry)) throw new DuplicateSlotEntryError(entry.date, entry.scheduleSlotId ?? '');
    this.data.entries = upsert<StoredEntry>(this.data.entries, copy(entry));
    this.persist();
  }
  async listRemovedSlots(range?: DateRange): Promise<RemovedSlot[]> {
    return this.data.entries
      .filter((e) => e.state === 'removed' && !!e.scheduleSlotId && inRange(e.date, range))
      .sort(byDate)
      .map((e) => ({ id: e.id, dogId: e.dogId, date: e.date, dayPart: e.dayPart, itemId: e.itemId, scheduleSlotId: e.scheduleSlotId as string }));
  }
  async removeFromDay(entry: Entry, slotId: string) {
    const marker: StoredEntry = { ...copy(entry), scheduleSlotId: slotId, state: 'removed' };
    if (this.slotTaken(marker)) throw new DuplicateSlotEntryError(entry.date, slotId);
    this.data.entries = upsert(this.data.entries, marker);
    this.persist();
  }
  async getSettings(): Promise<DogSettings> {
    return { logStart: null, ...this.data.settings };
  }
  async saveSettings(settings: DogSettings) {
    this.data.settings = { ...settings };
    this.persist();
  }
  async addPlannedEntries(entries: Entry[]) {
    const added: string[] = [];
    for (const entry of entries) {
      if (this.slotTaken(entry) || this.data.entries.some((e) => e.id === entry.id)) continue;
      this.data.entries = [...this.data.entries, copy(entry)];
      added.push(entry.id);
    }
    this.persist();
    return added;
  }
  async deleteEntry(id: string) {
    await this.deleteEntries([id]);
  }
  async deleteEntries(ids: string[]) {
    const drop = new Set(ids);
    this.data.entries = this.data.entries.filter((e) => !drop.has(e.id));
    this.persist();
  }
  async listEvents(range?: DateRange): Promise<HealthEvent[]> {
    const links = this.links();
    // Changes saved before JCB-6 may still carry the old `issueId`; it is dropped here.
    return copy(this.data.events.filter((e) => inRange(e.date, range)).sort(byDate)).map((stored: StoredEvent & { issueId?: unknown }) => {
      const e = { ...stored };
      delete e.issueId;
      return { ...e, conditionIds: links.filter((l) => l.eventId === e.id).map((l) => l.conditionId) };
    });
  }
  async saveEvent(event: HealthEvent) {
    // Same rule as the foreign keys: a link needs an existing condition.
    const known = new Set(this.conditions().map((c) => c.id));
    const missing = event.conditionIds.find((id) => !known.has(id));
    if (missing) throw new Error(`saveEvent: no condition ${missing}`);
    this.data.events = upsert(this.data.events, stored(event));
    this.data.links = [
      ...this.links().filter((l) => l.eventId !== event.id),
      ...[...new Set(event.conditionIds)].map((conditionId) => ({ eventId: event.id, conditionId })),
    ];
    this.persist();
  }
  async deleteEvent(id: string) {
    this.data.events = this.data.events.filter((e) => e.id !== id);
    this.data.links = this.links().filter((l) => l.eventId !== id);
    this.persist();
  }
  async listConditions(): Promise<Condition[]> {
    return copy(this.conditions()).sort((a, b) => b.startedOn.localeCompare(a.startedOn) || a.position - b.position || a.id.localeCompare(b.id));
  }
  async saveCondition(condition: Condition) {
    if (condition.resolvedOn && condition.resolvedOn < condition.startedOn) throw new Error('saveCondition: resolved before it started');
    if (!condition.name.trim()) throw new Error('saveCondition: no name');
    this.data.conditions = upsert(this.conditions(), copy(condition));
    this.persist();
  }
  async deleteCondition(id: string) {
    this.data.conditions = this.conditions().filter((c) => c.id !== id);
    this.data.links = this.links().filter((l) => l.conditionId !== id);
    this.persist();
  }
  async linkEvents(conditionId: string, eventIds: string[]) {
    if (!this.conditions().some((c) => c.id === conditionId)) throw new Error(`linkEvents: no condition ${conditionId}`);
    const events = new Set(this.data.events.map((e) => e.id));
    const links = this.links();
    for (const eventId of eventIds) {
      if (!events.has(eventId)) throw new Error(`linkEvents: no event ${eventId}`);
      if (!links.some((l) => l.eventId === eventId && l.conditionId === conditionId)) links.push({ eventId, conditionId });
    }
    this.data.links = links;
    this.persist();
  }

  async listPinnedNotes() {
    return copy(this.pinned().sort((a, b) => a.position - b.position));
  }
  async savePinnedNote(note: PinnedNote) {
    const prev = this.pinned().find((n) => n.id === note.id);
    const edited = !prev || prev.title !== note.title || prev.body !== note.body;
    const next: PinnedNote = { ...copy(note), updatedOn: edited ? today : prev.updatedOn ?? today };
    this.data.pinned = upsert(this.pinned(), next);
    this.persist();
  }
  async deletePinnedNote(id: string) {
    this.data.pinned = this.pinned().filter((n) => n.id !== id);
    this.persist();
  }
  async reorderPinnedNotes(ids: string[]) {
    this.data.pinned = this.pinned().map((n) => (ids.includes(n.id) ? { ...n, position: ids.indexOf(n.id) } : n));
    this.persist();
  }

  private pinned(): PinnedNote[] {
    return (this.data.pinned ??= copy(pinnedJson as PinnedNote[]));
  }

  /** Drop the visitor's changes and return to the frozen sample data. */
  reset() {
    try {
      this.storage?.removeItem(DEMO_STORAGE_KEY);
    } catch {
      /* storage unavailable */
    }
    this.data = seed();
  }

  /** Changes saved before JCB-6 have no conditions: they get the sample ones, linked to the events still there. */
  private conditions(): Condition[] {
    if (!this.data.conditions) this.adoptSampleConditions();
    return this.data.conditions as Condition[];
  }
  private links(): Link[] {
    if (!this.data.links) this.adoptSampleConditions();
    return [...(this.data.links as Link[])];
  }
  private adoptSampleConditions() {
    const events = new Set(this.data.events.map((e) => e.id));
    this.data.conditions ??= copy(conditionsJson.conditions as Condition[]);
    const conditions = new Set(this.data.conditions.map((c) => c.id));
    this.data.links ??= copy(conditionsJson.links).filter((l) => events.has(l.eventId) && conditions.has(l.conditionId));
  }

  /** Same rule as the database: one entry (or removal marker) per schedule slot per date. */
  private slotTaken(entry: Pick<StoredEntry, 'id' | 'date' | 'scheduleSlotId'>) {
    const slot = entry.scheduleSlotId;
    return !!slot && this.data.entries.some((e) => e.id !== entry.id && e.date === entry.date && e.scheduleSlotId === slot);
  }

  private load(): Persisted | null {
    try {
      const raw = this.storage?.getItem(DEMO_STORAGE_KEY);
      if (!raw) return null;
      const p = JSON.parse(raw) as Partial<Persisted>;
      const lists = [p.items, p.slots, p.entries, p.events];
      return lists.every(Array.isArray) && p.times && typeof p.times === 'object' ? (p as Persisted) : null;
    } catch {
      return null;
    }
  }

  private persist() {
    try {
      this.storage?.setItem(DEMO_STORAGE_KEY, JSON.stringify(this.data));
    } catch {
      /* quota or private mode: keep working in memory */
    }
  }
}

function upsert<T extends { id: string }>(list: T[], next: T): T[] {
  return list.some((x) => x.id === next.id) ? list.map((x) => (x.id === next.id ? next : x)) : [...list, next];
}

function safeStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}
