import type { DateRange, DayPart, DayPartTimes, Dog, DogSettings, Entry, HealthEvent, Item, PinnedNote, PlainDate, RemovedSlot, ScheduleSlot } from './types';

/** Usual times of the day parts until the household changes them (design proposal JCB-25). */
export const DEFAULT_DAY_PART_TIMES: DayPartTimes = {
  1: '07:00', 2: '07:30', 3: '12:00', 4: '15:00', 5: '18:00', 6: '20:00', 7: '22:00',
};

/**
 * The only way features read or write data. No feature may call Supabase directly.
 * Implementations: DemoRepository (fictional, client-side) and SupabaseRepository (real).
 * New ids come from `crypto.randomUUID()`.
 */
export interface Repository {
  /** `today` in the household timezone; frozen in demo mode. */
  today(): PlainDate;
  /** The time of day now, `HH:MM`, in the household timezone. */
  nowTime(): string;
  getDog(): Promise<Dog>;
  listItems(): Promise<Item[]>;
  /** Insert or update an item by id (a new food or medication typed under "Other"). */
  saveItem(item: Item): Promise<void>;
  /** The usual day (item, day part, amount). Pass a range to get only slots active in it. */
  listScheduleSlots(range?: DateRange): Promise<ScheduleSlot[]>;
  /** Insert or update a slot by id. */
  saveScheduleSlot(slot: ScheduleSlot): Promise<void>;
  /** Delete a slot. Entries that filled it stay, as unplanned entries. */
  deleteScheduleSlot(id: string): Promise<void>;
  /** The usual time of each day part (defaults for parts never set). */
  getDayPartTimes(): Promise<DayPartTimes>;
  saveDayPartTime(part: DayPart, time: string): Promise<void>;
  /** Logged entries (removal markers are not entries; see listRemovedSlots). */
  listEntries(range?: DateRange): Promise<Entry[]>;
  /**
   * Insert or update by id: an edit keeps its id and changes the row in place (also when it was a
   * removal marker). Rejects when another entry already fills the same slot on that date.
   */
  saveEntry(entry: Entry): Promise<void>;
  /** Usual-day items removed for one day. */
  listRemovedSlots(range?: DateRange): Promise<RemovedSlot[]>;
  /**
   * Delete an entry that filled usual-day slot `slotId`, keeping a marker in its place (same id), so
   * the slot is not offered or filled again that day. Undo with saveEntry(entry). Rejects with
   * DuplicateSlotEntryError when another entry fills that slot already.
   */
  removeFromDay(entry: Entry, slotId: string): Promise<void>;
  /**
   * Insert planned entries (fill, Given) and skip any whose slot is already filled on that date,
   * so filling never overwrites and two people filling at once cannot double-log.
   * Returns the ids actually inserted.
   */
  addPlannedEntries(entries: Entry[]): Promise<string[]>;
  deleteEntry(id: string): Promise<void>;
  deleteEntries(ids: string[]): Promise<void>;
  getSettings(): Promise<DogSettings>;
  saveSettings(settings: DogSettings): Promise<void>;
  listEvents(range?: DateRange): Promise<HealthEvent[]>;
  saveEvent(event: HealthEvent): Promise<void>;
  deleteEvent(id: string): Promise<void>;
  /** Pinned notes in list order (position, then creation). */
  listPinnedNotes(): Promise<PinnedNote[]>;
  /**
   * Insert or update by id. Changing the title or text counts as an edit ("Edited <day>");
   * changing only `position` does not.
   */
  savePinnedNote(note: PinnedNote): Promise<void>;
  deletePinnedNote(id: string): Promise<void>;
  /** Set the order: the note with ids[0] first. Only `position` changes; ids that are gone are ignored. */
  reorderPinnedNotes(ids: string[]): Promise<void>;
}
