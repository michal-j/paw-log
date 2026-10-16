// Pure derivation of the Day view from repository data: day parts, entries, events, prev/next bounds.
// No React, no I/O: unit-tested in tests/day.test.ts.
import type { DayPart, Entry, EntryState, EventType, HealthEvent, Item, PlainDate } from '../data';
import { DAY_PARTS, MEAL_PARTS, markSize, parseDate, recordsStart, shiftDate, toIso, type BadgeKind, type MarkSize } from '../timeline/model';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** A real calendar date written as `YYYY-MM-DD` (rejects 2026-02-30 and the like). */
export function isPlainDate(s: string): s is PlainDate {
  return ISO_DATE.test(s) && toIso(parseDate(s)) === s;
}

// ---------- Bounds and stepping ----------

export interface DayBounds {
  /** The first date anything was recorded. */
  first: PlainDate;
  /** Today in the household timezone: the Day view never goes past it. */
  last: PlainDate;
}

export function dayBounds(today: PlainDate, entries: Entry[], events: HealthEvent[]): DayBounds {
  const past = (x: { date: PlainDate }) => x.date <= today;
  return { first: recordsStart(today, entries.filter(past), events.filter(past)), last: today };
}

export const inBounds = (date: PlainDate, b: DayBounds) => date >= b.first && date <= b.last;

/** The day `delta` days away, or null when that would leave the bounds (prev on the first record, next on today). */
export function stepDay(date: PlainDate, delta: -1 | 1, b: DayBounds): PlainDate | null {
  const next = shiftDate(date, delta);
  return inBounds(next, b) ? next : null;
}

// ---------- Day parts ----------

export interface DayEntry {
  id: string;
  itemId: string;
  name: string;
  colour: string;
  size: MarkSize;
  state: EntryState;
  doseText: string;
}

export interface DayPartGroup {
  part: DayPart;
  meal: boolean;
  entries: DayEntry[];
}

/**
 * Every entry of the day in its day part, including items hidden by default on the Timeline:
 * the Day view always shows everything. Within a part: food first, then item order.
 */
export function groupDayParts(date: PlainDate, items: Item[], entries: Entry[]): DayPartGroup[] {
  const order = new Map(items.map((i, idx) => [i.id, idx]));
  const byId = new Map(items.map((i) => [i.id, i]));
  const toDayEntry = (e: Entry): DayEntry => {
    const item = byId.get(e.itemId);
    return {
      id: e.id,
      itemId: e.itemId,
      // An entry whose item is gone still shows, with its id and the neutral colour.
      name: item?.name ?? e.itemId,
      colour: item?.colour ?? 'mark-neutral',
      size: item ? markSize(item) : 'small',
      state: e.state,
      doseText: e.doseText,
    };
  };
  const compare = (a: DayEntry, b: DayEntry) =>
    Number(b.size === 'food') - Number(a.size === 'food') ||
    (order.get(a.itemId) ?? items.length) - (order.get(b.itemId) ?? items.length) ||
    a.id.localeCompare(b.id);
  const day = entries.filter((e) => e.date === date);
  return DAY_PARTS.map((part) => ({
    part,
    meal: MEAL_PARTS.has(part),
    entries: day.filter((e) => e.dayPart === part).map(toDayEntry).sort(compare),
  }));
}

// ---------- Events ----------

/** Order of the "What happened" cards, as in the prototype: visits, symptoms, Frontline, deworming, photo, the rest. */
const EVENT_ORDER: readonly EventType[] = ['vet', 'symptom', 'frontline', 'deworming', 'photo', 'anal_glands', 'nails', 'other'];

/** The badge for an event type; types without a designed badge get none. */
export const BADGE_FOR: Partial<Record<EventType, BadgeKind>> = {
  vet: 'vet',
  symptom: 'sym',
  photo: 'photo',
  frontline: 'front',
  deworming: 'worm',
};

export interface DayEvents {
  /** One card per vet visit. */
  visits: HealthEvent[];
  /** All symptoms of the day share one card. */
  symptoms: HealthEvent[];
  /** One card each: Frontline, deworming, photo, then types without a badge. */
  others: HealthEvent[];
  count: number;
}

export function groupDayEvents(date: PlainDate, events: HealthEvent[]): DayEvents {
  const day = events
    .filter((e) => e.date === date)
    .sort((a, b) => EVENT_ORDER.indexOf(a.type) - EVENT_ORDER.indexOf(b.type) || a.id.localeCompare(b.id));
  return {
    visits: day.filter((e) => e.type === 'vet'),
    symptoms: day.filter((e) => e.type === 'symptom'),
    others: day.filter((e) => e.type !== 'vet' && e.type !== 'symptom'),
    count: day.length,
  };
}

export interface Day {
  date: PlainDate;
  parts: DayPartGroup[];
  events: DayEvents;
  /** Nothing logged at all: no entries and no events. */
  empty: boolean;
  prev: PlainDate | null;
  next: PlainDate | null;
}

export function buildDay(input: {
  date: PlainDate;
  bounds: DayBounds;
  items: Item[];
  entries: Entry[];
  events: HealthEvent[];
}): Day {
  const { date, bounds } = input;
  const parts = groupDayParts(date, input.items, input.entries);
  const events = groupDayEvents(date, input.events);
  return {
    date,
    parts,
    events,
    empty: events.count === 0 && parts.every((p) => p.entries.length === 0),
    prev: stepDay(date, -1, bounds),
    next: stepDay(date, 1, bounds),
  };
}
