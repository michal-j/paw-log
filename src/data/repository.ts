import type { DateRange, Dog, Entry, HealthEvent, Item, PlainDate, ScheduleSlot } from './types';

/**
 * The only way features read or write data. No feature may call Supabase directly.
 * Implementations: DemoRepository (fictional, client-side) and SupabaseRepository (real).
 */
export interface Repository {
  /** `today` in the household timezone; frozen in demo mode. */
  today(): PlainDate;
  getDog(): Promise<Dog>;
  listItems(): Promise<Item[]>;
  /** Planned slots (item, day part, dose). Pass a range to get only slots active in it. */
  listScheduleSlots(range?: DateRange): Promise<ScheduleSlot[]>;
  listEntries(range?: DateRange): Promise<Entry[]>;
  listEvents(range?: DateRange): Promise<HealthEvent[]>;
  /** Insert or update by id. Rejects when another entry already fills the same slot on that date. */
  saveEntry(entry: Entry): Promise<void>;
  deleteEntry(id: string): Promise<void>;
  saveEvent(event: HealthEvent): Promise<void>;
  deleteEvent(id: string): Promise<void>;
}
