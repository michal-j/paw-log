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
}

/** The plan: an item in one day part with its usual dose, for a period. One item can have several slots. */
export interface ScheduleSlot {
  id: string;
  dogId: string;
  itemId: string;
  dayPart: DayPart;
  doseText: string;
  activeFrom: PlainDate;
  activeTo: PlainDate | null;
}

export interface Entry {
  id: string;
  dogId: string;
  date: PlainDate;
  dayPart: DayPart;
  itemId: string;
  /** The slot this entry fills, or null/absent for an unplanned entry. At most one entry per slot per day. */
  scheduleSlotId?: string | null;
  doseText: string;
  state: EntryState;
  note: string;
  /** Set by the database; ignored on save. */
  createdBy: string;
  /** Last editor, set by the database; ignored on save. Absent in demo data. */
  updatedBy?: string;
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
  issueId: string | null;
}

export interface DateRange {
  from?: PlainDate;
  to?: PlainDate;
}
