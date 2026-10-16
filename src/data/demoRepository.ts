import dogJson from '../../data/demo/dog.json';
import itemsJson from '../../data/demo/items.json';
import entriesJson from '../../data/demo/entries.json';
import eventsJson from '../../data/demo/events.json';
import type { Repository } from './repository';
import type { DateRange, Dog, Entry, HealthEvent, Item } from './types';

export const DEMO_STORAGE_KEY = 'pawlog.demo.v1';

interface Persisted {
  entries: Entry[];
  events: HealthEvent[];
}

const { today, ...dogFields } = dogJson;
const inRange = (date: string, range?: DateRange) =>
  (!range?.from || date >= range.from) && (!range?.to || date <= range.to);
const byDate = <T extends { date: string }>(a: T, b: T) => a.date.localeCompare(b.date);

/** Fictional frozen data; edits persist only in the visitor's localStorage. */
export class DemoRepository implements Repository {
  private entries: Entry[];
  private events: HealthEvent[];

  constructor(private readonly storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null = safeStorage()) {
    const saved = this.load();
    this.entries = saved?.entries ?? (entriesJson as Entry[]).map((e) => ({ ...e }));
    this.events = saved?.events ?? (eventsJson as HealthEvent[]).map((e) => ({ ...e }));
  }

  today() {
    return today;
  }
  async getDog(): Promise<Dog> {
    return dogFields;
  }
  async listItems(): Promise<Item[]> {
    return itemsJson as Item[];
  }
  async listEntries(range?: DateRange) {
    return this.entries.filter((e) => inRange(e.date, range)).sort(byDate);
  }
  async listEvents(range?: DateRange) {
    return this.events.filter((e) => inRange(e.date, range)).sort(byDate);
  }
  async saveEntry(entry: Entry) {
    this.entries = upsert(this.entries, entry);
    this.persist();
  }
  async deleteEntry(id: string) {
    this.entries = this.entries.filter((e) => e.id !== id);
    this.persist();
  }
  async saveEvent(event: HealthEvent) {
    this.events = upsert(this.events, event);
    this.persist();
  }
  async deleteEvent(id: string) {
    this.events = this.events.filter((e) => e.id !== id);
    this.persist();
  }

  /** Drop the visitor's changes and return to the frozen sample data. */
  reset() {
    try {
      this.storage?.removeItem(DEMO_STORAGE_KEY);
    } catch {
      /* storage unavailable */
    }
    this.entries = (entriesJson as Entry[]).map((e) => ({ ...e }));
    this.events = (eventsJson as HealthEvent[]).map((e) => ({ ...e }));
  }

  private load(): Persisted | null {
    try {
      const raw = this.storage?.getItem(DEMO_STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as Partial<Persisted>;
      return Array.isArray(parsed.entries) && Array.isArray(parsed.events)
        ? { entries: parsed.entries, events: parsed.events }
        : null;
    } catch {
      return null;
    }
  }

  private persist() {
    try {
      const data: Persisted = { entries: this.entries, events: this.events };
      this.storage?.setItem(DEMO_STORAGE_KEY, JSON.stringify(data));
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
