import type { Condition, DateRange, DayPart, DayPartTimes, Dog, DogSettings, Entry, HealthEvent, Item, Photo, PhotoFiles, PhotoSize, PinnedNote, PlainDate, RemovedSlot, ScheduleSlot } from './types';

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
  /** Events with their `conditionIds`. */
  listEvents(range?: DateRange): Promise<HealthEvent[]>;
  /** Insert or update by id; its condition links become exactly `event.conditionIds`. */
  saveEvent(event: HealthEvent): Promise<void>;
  /** Delete an event; its condition links and photo rows go with it, the conditions stay. */
  deleteEvent(id: string): Promise<void>;
  /** Every photo row (the files are read through `photoUrls`). */
  listPhotos(): Promise<Photo[]>;
  /**
   * Store a photo's files at its paths (they depend only on dog and id), replacing what is there, so a
   * retry after a failed or timed-out attempt writes the same files again, never a second copy.
   * Called before `savePhoto`, so a row never points at missing files.
   */
  uploadPhotoFiles(photo: Photo, files: PhotoFiles): Promise<void>;
  /** Insert or update a photo row by id (its event must exist). */
  savePhoto(photo: Photo): Promise<void>;
  /** Delete a photo row; its files stay until `purgePhotoFiles`, so Undo can bring it back. */
  deletePhoto(id: string): Promise<void>;
  /** Remove the files of these photos whose row is gone; files of a photo that still has its row are kept. */
  purgePhotoFiles(photos: Pick<Photo, 'id' | 'dogId'>[]): Promise<void>;
  /** URLs to show photos at, by id: short-lived, so ask again rather than keep them. Missing files are left out. */
  photoUrls(photos: Pick<Photo, 'id' | 'dogId'>[], size: PhotoSize): Promise<Record<string, string>>;
  /** Tracked conditions, open and resolved. */
  listConditions(): Promise<Condition[]>;
  /** Insert or update by id. */
  saveCondition(condition: Condition): Promise<void>;
  /** Delete a condition; its links go with it, the linked events stay. */
  deleteCondition(id: string): Promise<void>;
  /** Link events to a condition (links that exist already are kept); used to undo a delete. */
  linkEvents(conditionId: string, eventIds: string[]): Promise<void>;
  /** Pinned notes in list order (position, then creation). */
  listPinnedNotes(): Promise<PinnedNote[]>;
  /**
   * Insert or update by id. Changing the title or text counts as an edit ("Edited <day>");
   * changing only `position` does not.
   */
  savePinnedNote(note: PinnedNote): Promise<void>;
  /**
   * Undo of an edit or a delete: put the note back exactly as it was, keeping its `updatedOn` and
   * `updatedBy` (and `createdBy`) instead of stamping the restore as a new edit.
   */
  restorePinnedNote(note: PinnedNote): Promise<void>;
  deletePinnedNote(id: string): Promise<void>;
  /** Set the order: the note with ids[0] first. Only `position` changes; ids that are gone are ignored. */
  reorderPinnedNotes(ids: string[]): Promise<void>;
}
