export type ItemKind = 'food' | 'medication' | 'treat' | 'supplement' | 'procedure';
export type EntryState = 'given' | 'skipped' | 'partial';
export type EventType =
  | 'vet'
  | 'symptom'
  | 'photo'
  | 'frontline'
  | 'deworming'
  | 'anal_glands'
  | 'nails'
  | 'note'
  | 'other';
/** How strong a symptom (or similar event) was; stored as a key, shown through the i18n layer. */
export type Intensity = 'small' | 'medium' | 'large';
/** How an amount is counted. Stored as a key; shown through the i18n layer (`u_*`). */
export type Unit = 'pill' | 'capsule' | 'sachet' | 'ml' | 'drop' | 'can' | 'tray' | 'g' | 'piece';
export const UNITS: readonly Unit[] = ['pill', 'capsule', 'sachet', 'ml', 'drop', 'can', 'tray', 'g', 'piece'];
/** Done at a vet visit besides the visit itself. */
export type AlsoDone = 'anal_glands' | 'nails';

/** ISO date `YYYY-MM-DD` in the household timezone. */
export type PlainDate = string;
/** 1 (before breakfast) to 7 (after supper). */
export type DayPart = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface Dog {
  id: string;
  householdId: string;
  name: string;
}

export interface Item {
  id: string;
  dogId: string;
  kind: ItemKind;
  name: string;
  /** Name of a colour token in tokens.json, for example `food-farm`. */
  colour: string;
  defaultDayPart: DayPart;
  activeFrom: PlainDate;
  activeTo: PlainDate | null;
  /** Off in the default filter set (the prototype hides treats and Calmora until the filters sheet turns them on). */
  hiddenByDefault?: boolean;
  /** The unit it is usually given in; null or absent when not set. */
  defaultUnit?: Unit | null;
  /** Flavours to pick from (food), in the household's words. */
  flavours?: string[];
  /** A second unit shown after the amount: 1 `unit` = `size` of the default unit (Bellavet: 1 bar = 0.1 ml). */
  conversion?: { unit: 'bars'; size: number } | null;
  /** List and lane order, smallest first. */
  position?: number;
}

/**
 * The usual day: an item in one day part with its usual amount, for a period (a course is just
 * `activeTo`). One item can have several slots. A change from a date ends the old slot the day
 * before and starts a new one, so days already logged keep theirs.
 */
export interface ScheduleSlot {
  id: string;
  dogId: string;
  itemId: string;
  dayPart: DayPart;
  flavour: string;
  amount: number | null;
  unit: Unit | null;
  activeFrom: PlainDate;
  activeTo: PlainDate | null;
  /** A course set with "How long" (7 days, 14 days, an end date): the Day view shows "day n of m". Absent = not a course. */
  course?: boolean;
}

/** Usual time `HH:MM` of each part of the day. */
export type DayPartTimes = Record<DayPart, string>;

export interface Entry {
  id: string;
  dogId: string;
  date: PlainDate;
  dayPart: DayPart;
  itemId: string;
  /** The slot this entry fills, or null/absent for an unplanned entry. At most one entry per slot per day. */
  scheduleSlotId?: string | null;
  /** Structured amount; null on rows logged before amounts existed (those show `doseText`). */
  amount: number | null;
  unit: Unit | null;
  /** Empty when the item has no flavours. */
  flavour: string;
  /** Free-text dose of rows written before JCB-39; new entries leave it empty. */
  doseText?: string;
  state: EntryState;
  note: string;
  /** Set by the database; ignored on save. */
  createdBy: string;
  /** Last editor, set by the database; ignored on save. Absent in demo data. */
  updatedBy?: string;
}

/**
 * A usual-day item deliberately removed for one day (its entry was deleted in the Day view). The
 * slot counts as done for that date, so it is neither offered as "not logged" nor filled again.
 * Stored as an entry row with state `removed` (one row per slot per day, like any entry).
 */
export interface RemovedSlot {
  id: string;
  dogId: string;
  date: PlainDate;
  dayPart: DayPart;
  itemId: string;
  scheduleSlotId: string;
}

/** Household settings for one dog. */
export interface DogSettings {
  /** The first day the Timeline and Day view offer; null = derived (see `logStartOf`). */
  logStart: PlainDate | null;
}

export interface HealthEvent {
  id: string;
  dogId: string;
  date: PlainDate;
  type: EventType;
  title: string;
  detail: string;
  /** Optional strength, for symptoms; null/absent when it does not apply. */
  intensity?: Intensity | null;
  /** Symptom properties by name (consistency, colour, quantity, times, when); values are keys. */
  props?: Record<string, string>;
  /** Vet visit: what else was done. */
  alsoDone?: AlsoDone[];
  /** Tracked conditions this event belongs to (several allowed); saving the event saves its links. */
  conditionIds: string[];
}

/**
 * A tracked condition (a lump, stomach trouble): followed over time through the events linked to it.
 * Open while `resolvedOn` is null; reopening clears it.
 */
export interface Condition {
  id: string;
  dogId: string;
  name: string;
  startedOn: PlainDate;
  description: string;
  resolvedOn: PlainDate | null;
  /** Tie-breaker in lists (the Tracked list orders by dates); 0 by default. */
  position: number;
}

/**
 * A standing fact both household members should always know (allergy, how to give a medication).
 * Not tied to a day. `title` is empty when the note has none.
 */
export interface PinnedNote {
  id: string;
  dogId: string;
  title: string;
  body: string;
  /** List order, smallest first. A new note takes (smallest - 1), so it goes on top. */
  position: number;
  /** The day of the last edit of the title or text (not of a move), set by the database; ignored on save. */
  updatedOn?: PlainDate;
  /** Exact time of that edit (ISO), set by the database; ignored on save, used by restore. */
  updatedAt?: string;
  /** Set by the database; ignored on save. */
  createdBy?: string;
  updatedBy?: string;
}

export interface DateRange {
  from?: PlainDate;
  to?: PlainDate;
}

/**
 * A photo on an event (an `attachment` row of kind photo). A standalone photo is an event of type
 * `photo` with one Photo; vet visits, symptoms and notes can carry photos too. The files live in
 * private storage at `photoPath(photo)` (and a small copy at `photoPath(photo, 'thumb')`).
 */
export interface Photo {
  id: string;
  dogId: string;
  eventId: string;
  /** Size of the stored (resized) picture, px. */
  width: number;
  height: number;
  /** When it was taken, from the photo itself: local wall-clock `YYYY-MM-DDTHH:MM:SS`; null when unknown. */
  takenAt: string | null;
  /** Description of a photo on another event; a standalone photo's description is its event's `detail`. */
  caption: string;
  /** Order within the event. */
  position: number;
}

/** The two JPEG files of a photo, made on the device (src/photos/resize.ts). */
export interface PhotoFiles {
  full: Blob;
  thumb: Blob;
}

export type PhotoSize = 'full' | 'thumb';

/** Storage path of a photo's file: `<dog>/<id>.jpg` or `<dog>/<id>.thumb.jpg` (the storage policies check it). */
export const photoPath = (p: Pick<Photo, 'id' | 'dogId'>, size: PhotoSize = 'full') =>
  `${p.dogId}/${p.id}${size === 'thumb' ? '.thumb' : ''}.jpg`;
