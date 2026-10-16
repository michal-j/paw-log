import type { DateRange, Dog, Entry, HealthEvent, Item, PlainDate } from './types';

/**
 * The only way features read or write data. No feature may call Supabase directly.
 * Implementations: DemoRepository (fictional, client-side) and SupabaseRepository (real).
 */
export interface Repository {
  /** `today` in the household timezone; frozen in demo mode. */
  today(): PlainDate;
  getDog(): Promise<Dog>;
  listItems(): Promise<Item[]>;
  listEntries(range?: DateRange): Promise<Entry[]>;
  listEvents(range?: DateRange): Promise<HealthEvent[]>;
  saveEntry(entry: Entry): Promise<void>;
  deleteEntry(id: string): Promise<void>;
  saveEvent(event: HealthEvent): Promise<void>;
  deleteEvent(id: string): Promise<void>;
}
