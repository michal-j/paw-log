// Pure derivation of the Day view from repository data: day parts, entries, events, prev/next bounds.
// No React, no I/O: unit-tested in tests/day.test.ts.
import type { DayPart, DayPartTimes, Entry, EntryState, EventType, HealthEvent, Item, PlainDate, RemovedSlot, ScheduleSlot, Unit } from '../data';
import { courseDay, matchDay, partDue, slotsOn } from '../log/plan';
import { DAY_PARTS, MEAL_PARTS, markSize, parseDate, recordsStart, shiftDate, toIso, type BadgeKind, type MarkSize } from '../timeline/model';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** A real calendar date written as `YYYY-MM-DD` (rejects 2026-02-30 and the like). */
export function isPlainDate(s: string): s is PlainDate {
  return ISO_DATE.test(s) && toIso(parseDate(s)) === s;
}

// ---------- Bounds and stepping ----------

export interface DayBounds {
  /** The log start: the first date anything was recorded, or the "Log starts on" day when earlier. */
  first: PlainDate;
  /** Today in the household timezone: the Day view never goes past it. */
  last: PlainDate;
}

/** From the first record (or `start`, the log start, when earlier) to today. */
export function dayBounds(today: PlainDate, entries: Entry[], events: HealthEvent[], start?: PlainDate): DayBounds {
  const past = (x: { date: PlainDate }) => x.date <= today;
  const first = recordsStart(today, entries.filter(past), events.filter(past));
  return { first: start && start < first ? start : first, last: today };
}

export const inBounds = (date: PlainDate, b: DayBounds) => date >= b.first && date <= b.last;

/** The day `delta` days away, or null when that would leave the bounds (prev on the first record, next on today). */
export function stepDay(date: PlainDate, delta: -1 | 1, b: DayBounds): PlainDate | null {
  const next = shiftDate(date, delta);
  return inBounds(next, b) ? next : null;
}

// ---------- Day parts ----------

/** One row of a day part: a logged entry, or a usual-day item not logged yet (planned). */
export interface DayEntry {
  id: string;
  itemId: string;
  name: string;
  colour: string;
  size: MarkSize;
  state: EntryState;
  amount: number | null;
  unit: Unit | null;
  flavour: string;
  /** Free-text dose of an entry logged before amounts existed. */
  doseText: string;
  conversion: Item['conversion'];
  note: string;
  /** "Day n of m" of the usual-day course this row belongs to. */
  course: { n: number; m: number } | null;
  entry: Entry;
  slot: ScheduleSlot | null;
}

export interface PlannedRow {
  id: string;
  itemId: string;
  name: string;
  colour: string;
  size: MarkSize;
  amount: number | null;
  unit: Unit | null;
  flavour: string;
  conversion: Item['conversion'];
  course: { n: number; m: number } | null;
  slot: ScheduleSlot;
  /** Its part's time has passed (always on a past day): Given and Fill apply. */
  due: boolean;
}

/**
 * A usual-day item removed for this day (its entry was deleted): never filled again and never drawn as
 * an item row; the Day view only counts these in one quiet line with Restore (JCB-60).
 */
export interface RemovedRow extends Omit<PlannedRow, 'due'> {
  marker: RemovedSlot;
}

export type DayRow = ({ kind: 'logged' } & DayEntry) | ({ kind: 'planned' } & PlannedRow);

export interface DayPartGroup {
  part: DayPart;
  meal: boolean;
  /** Logged entries only. */
  entries: DayEntry[];
  /** Logged and planned rows, food first, then item order. */
  rows: DayRow[];
  /** Planned rows whose time has passed. */
  due: PlannedRow[];
  /** Usual-day items removed for this day in this part: not rows, so a delete looks the same for every entry. */
  removed: RemovedRow[];
}

/** What decides "planned" and "due": the usual day and the clock. Without it, a day shows only what was logged. */
export interface PlanInput {
  slots: ScheduleSlot[];
  /** Usual-day items removed for a day. */
  removed?: RemovedSlot[];
  today: PlainDate;
  now: string;
  times: DayPartTimes;
}

/**
 * Every entry of the day in its day part, including items hidden by default on the Timeline:
 * the Day view always shows everything. Within a part: food first, then item order.
 */
export function groupDayParts(date: PlainDate, items: Item[], entries: Entry[], plan?: PlanInput): DayPartGroup[] {
  const order = new Map(items.map((i, idx) => [i.id, idx]));
  const byId = new Map(items.map((i) => [i.id, i]));
  const look = (itemId: string) => {
    const item = byId.get(itemId);
    // An entry whose item is gone still shows, with its id and the neutral colour.
    return {
      name: item?.name ?? itemId,
      colour: item?.colour ?? 'mark-neutral',
      size: item ? markSize(item) : ('small' as MarkSize),
      conversion: item?.conversion ?? null,
    };
  };
  const slots = plan?.slots ?? [];
  const { slotOf, filled, removed } = matchDay(date, slots, entries, plan?.removed ?? []);
  const toDayEntry = (e: Entry): DayEntry => {
    const slot = slotOf.get(e.id) ?? null;
    return {
      id: e.id,
      itemId: e.itemId,
      ...look(e.itemId),
      state: e.state,
      amount: e.amount,
      unit: e.unit,
      flavour: e.flavour,
      doseText: e.doseText ?? '',
      note: e.note,
      course: slot ? courseDay(slot, date) : null,
      entry: e,
      slot,
    };
  };
  const toSlotRow = (s: ScheduleSlot): Omit<PlannedRow, 'due'> => ({
    id: s.id,
    itemId: s.itemId,
    ...look(s.itemId),
    amount: s.amount,
    unit: s.unit,
    flavour: s.flavour,
    course: courseDay(s, date),
    slot: s,
  });
  const toPlanned = (s: ScheduleSlot): PlannedRow => ({
    ...toSlotRow(s),
    due: plan ? partDue(date, s.dayPart, plan.today, plan.now, plan.times) : false,
  });
  const compare = (a: { size: MarkSize; itemId: string; id: string }, b: { size: MarkSize; itemId: string; id: string }) =>
    Number(b.size === 'food') - Number(a.size === 'food') ||
    (order.get(a.itemId) ?? items.length) - (order.get(b.itemId) ?? items.length) ||
    a.id.localeCompare(b.id);
  const day = entries.filter((e) => e.date === date);
  // Planned rows only up to today: the Day view never shows the future.
  const shown = plan && date <= plan.today ? slotsOn(slots, date) : [];
  const open = shown.filter((s) => !filled.has(s.id));
  const gone = shown.filter((s) => removed.has(s.id));
  return DAY_PARTS.map((part) => {
    const logged = day.filter((e) => e.dayPart === part).map(toDayEntry).sort(compare);
    const planned = open.filter((s) => s.dayPart === part).map(toPlanned);
    const removedRows = gone
      .filter((s) => s.dayPart === part)
      .map((s): RemovedRow => ({ ...toSlotRow(s), marker: removed.get(s.id) as RemovedSlot }));
    const rows: DayRow[] = [
      ...logged.map((e) => ({ kind: 'logged' as const, ...e })),
      ...planned.map((p) => ({ kind: 'planned' as const, ...p })),
    ].sort(compare);
    return { part, meal: MEAL_PARTS.has(part), entries: logged, rows, due: planned.filter((p) => p.due), removed: removedRows.sort(compare) };
  });
}

// ---------- Events ----------

/** Order of the "What happened" cards, as in the prototype: visits, symptoms, Frontline, deworming, photo, the rest. */
const EVENT_ORDER: readonly EventType[] = ['vet', 'symptom', 'frontline', 'deworming', 'photo', 'anal_glands', 'nails', 'note', 'other'];

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
  plan?: PlanInput;
}): Day {
  const { date, bounds } = input;
  const parts = groupDayParts(date, input.items, input.entries, input.plan);
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
