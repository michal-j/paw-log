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
  | 'other';

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
}

export interface Entry {
  id: string;
  dogId: string;
  date: PlainDate;
  dayPart: DayPart;
  itemId: string;
  doseText: string;
  state: EntryState;
  note: string;
  createdBy: string;
}

export interface HealthEvent {
  id: string;
  dogId: string;
  date: PlainDate;
  type: EventType;
  title: string;
  detail: string;
  issueId: string | null;
}

export interface DateRange {
  from?: PlainDate;
  to?: PlainDate;
}
