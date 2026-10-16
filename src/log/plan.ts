// The usual day (schedule slots) against what was logged: which slots are filled, which are due,
// what Fill adds, and how a change "from a date" splits a slot. Pure; tests in tests/plan.test.ts.
import type { DayPart, DayPartTimes, Entry, PlainDate, RemovedSlot, ScheduleSlot, Unit } from '../data';
import { DAY_PARTS, shiftDate } from '../timeline/model';
import { sameAmount } from './amount';

export const activeOn = (slot: ScheduleSlot, date: PlainDate) =>
  slot.activeFrom <= date && (slot.activeTo === null || slot.activeTo >= date);

export const slotsOn = (slots: ScheduleSlot[], date: PlainDate, part?: DayPart) =>
  slots.filter((s) => activeOn(s, date) && (part === undefined || s.dayPart === part));

export interface DayMatch {
  /** Entry id to the usual-day slot it fills. */
  slotOf: Map<string, ScheduleSlot>;
  /** Ids of slots filled on the date (by an entry, or removed for the day). */
  filled: Set<string>;
  /** Slots removed for the date, by slot id, with their marker. */
  removed: Map<string, RemovedSlot>;
}

/**
 * Pair the date's entries with its active slots. An entry fills the slot it names; a slot removed
 * for the day counts as filled; an entry that names no active slot (logged before the usual day
 * existed, or before the slot was changed from a date) fills a still-open slot of the same item in
 * the same part.
 */
export function matchDay(date: PlainDate, slots: ScheduleSlot[], entries: Entry[], removed: RemovedSlot[] = []): DayMatch {
  const active = slotsOn(slots, date);
  const byId = new Map(active.map((s) => [s.id, s]));
  const slotOf = new Map<string, ScheduleSlot>();
  const filled = new Set<string>();
  const removedOn = new Map<string, RemovedSlot>();
  const day = entries.filter((e) => e.date === date);
  for (const e of day) {
    const s = e.scheduleSlotId ? byId.get(e.scheduleSlotId) : undefined;
    if (s && !filled.has(s.id)) {
      slotOf.set(e.id, s);
      filled.add(s.id);
    }
  }
  for (const r of removed) {
    if (r.date !== date || !byId.has(r.scheduleSlotId) || filled.has(r.scheduleSlotId)) continue;
    removedOn.set(r.scheduleSlotId, r);
    filled.add(r.scheduleSlotId);
  }
  for (const e of day) {
    if (slotOf.has(e.id)) continue;
    const s = active.find((x) => !filled.has(x.id) && x.dayPart === e.dayPart && x.itemId === e.itemId);
    if (s) {
      slotOf.set(e.id, s);
      filled.add(s.id);
    }
  }
  return { slotOf, filled, removed: removedOn };
}

/** A part is due once its usual time has passed: every part of a past day, today's only up to now. */
export const partDue = (date: PlainDate, part: DayPart, today: PlainDate, now: string, times: DayPartTimes) =>
  date < today || (date === today && times[part] <= now);

/** Slots of the date that nobody logged yet and whose time has passed: what Fill would log. */
export function dueOpenSlots(
  date: PlainDate,
  slots: ScheduleSlot[],
  entries: Entry[],
  clock: { today: PlainDate; now: string; times: DayPartTimes },
  removed: RemovedSlot[] = [],
): ScheduleSlot[] {
  if (date > clock.today) return [];
  const { filled } = matchDay(date, slots, entries, removed);
  return slotsOn(slots, date).filter((s) => !filled.has(s.id) && partDue(date, s.dayPart, clock.today, clock.now, clock.times));
}

/** The entry Given or Fill writes for a slot: as the usual day has it, state given. */
export function plannedEntry(slot: ScheduleSlot, date: PlainDate, id: string): Entry {
  return {
    id,
    dogId: slot.dogId,
    date,
    dayPart: slot.dayPart,
    itemId: slot.itemId,
    scheduleSlotId: slot.id,
    amount: slot.amount,
    unit: slot.unit,
    flavour: slot.flavour,
    state: 'given',
    note: '',
    createdBy: '',
  };
}

const daysBetween = (a: PlainDate, b: PlainDate) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 864e5);

/**
 * "Day n of m" for a course (a slot marked as one, with an end date); null otherwise. A slot that only
 * ended because the usual day changed from a date, or was removed, is not a course.
 */
export function courseDay(slot: ScheduleSlot, date: PlainDate): { n: number; m: number } | null {
  if (!slot.course || !slot.activeTo) return null;
  return { n: daysBetween(slot.activeFrom, date) + 1, m: daysBetween(slot.activeFrom, slot.activeTo) + 1 };
}

// ---------- Changing the usual day ----------

export interface SlotValues {
  itemId: string;
  dayPart: DayPart;
  flavour: string;
  amount: number | null;
  unit: Unit | null;
  /** Set when "How long" was chosen; absent keeps the current slot's flag. */
  course?: boolean;
}

/** What to write: slots to save (insert or update) and slot ids to delete. `slot` is the one that now holds the values. */
export interface SlotChange {
  save: ScheduleSlot[];
  remove: string[];
  slot: ScheduleSlot;
}

/** The values match: same item, part, flavour, amount and unit. */
export const sameValues = (s: SlotValues, v: SlotValues) =>
  s.itemId === v.itemId && s.dayPart === v.dayPart && s.flavour === v.flavour && s.unit === v.unit && sameAmount(s.amount, v.amount);

/**
 * Set `values` from `from` on. `target` is the slot being changed; null adds an item, or changes
 * the active slot of the same item and part if there is one ("Make this the usual amount").
 * A slot that started before `from` is ended the day before and a new one starts on `from`,
 * so days already logged keep their usual day. `to` is the new end (null = no end);
 * undefined keeps the current end.
 */
export function changeFrom(
  slots: ScheduleSlot[],
  target: ScheduleSlot | null,
  values: SlotValues,
  from: PlainDate,
  to: PlainDate | null | undefined,
  newId: () => string,
  dogId: string,
): SlotChange {
  const cur = target ?? slots.find((s) => activeOn(s, from) && s.dayPart === values.dayPart && s.itemId === values.itemId) ?? null;
  const { course: courseValue, ...rest } = values;
  if (!cur) {
    const activeTo = to ?? null;
    const slot: ScheduleSlot = { id: newId(), dogId, ...rest, activeFrom: from, activeTo, course: !!courseValue && activeTo !== null };
    return { save: [slot], remove: [], slot };
  }
  const end = to === undefined ? cur.activeTo : to;
  const course = (courseValue ?? !!cur.course) && end !== null;
  if (cur.activeFrom >= from) {
    const slot: ScheduleSlot = { ...cur, ...rest, activeFrom: from, activeTo: end, course };
    return { save: [slot], remove: [], slot };
  }
  // The old slot ends because of the change, not because a course ran out: not a course any more.
  const closed: ScheduleSlot = { ...cur, activeTo: shiftDate(from, -1), course: false };
  const slot: ScheduleSlot = { id: newId(), dogId: cur.dogId, ...rest, activeFrom: from, activeTo: end, course };
  return { save: [closed, slot], remove: [], slot };
}

/** Remove a slot from `from` on: end it the day before, or delete it if it starts on or after `from`. */
export function removeFrom(slot: ScheduleSlot, from: PlainDate): Omit<SlotChange, 'slot'> {
  if (slot.activeFrom >= from) return { save: [], remove: [slot.id] };
  if (slot.activeTo !== null && slot.activeTo < from) return { save: [], remove: [] };
  // Ended by a removal, not by a course running out.
  return { save: [{ ...slot, activeTo: shiftDate(from, -1), course: false }], remove: [] };
}

// ---------- The Usual day screen ----------

export interface UsualRow {
  slot: ScheduleSlot;
  /** Starts after the date (shown as "From …" with a planned mark). */
  upcoming: boolean;
  /** The slot that takes over the day after this one ends (same item and part). */
  next: ScheduleSlot | null;
}

/** Per part: slots active on the date, then upcoming slots of items not already in that part. */
export function usualDay(slots: ScheduleSlot[], date: PlainDate, order: (a: ScheduleSlot, b: ScheduleSlot) => number) {
  return DAY_PARTS.map((part) => {
    const active = slotsOn(slots, date, part).sort(order);
    const later = slots.filter((s) => s.dayPart === part && s.activeFrom > date).sort((a, b) => a.activeFrom.localeCompare(b.activeFrom) || order(a, b));
    const rows: UsualRow[] = active.map((slot) => ({
      slot,
      upcoming: false,
      next: (slot.activeTo && later.find((u) => u.itemId === slot.itemId && u.activeFrom === shiftDate(slot.activeTo as string, 1))) || null,
    }));
    for (const u of later) {
      if (!rows.some((r) => r.slot.itemId === u.itemId)) rows.push({ slot: u, upcoming: true, next: null });
    }
    return { part, rows };
  });
}
