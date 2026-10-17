// Pure derivation of the timeline from repository data: lanes, rows, circles, badges, rail ticks.
// No React, no I/O: everything here is unit-tested (tests/timeline.test.ts).
import type { DayPart, Entry, EntryState, EventType, HealthEvent, Item, PlainDate } from '../data';
import {
  COLUMN_PAD,
  DAY_ROW_H,
  FOOD_MARK,
  LANE_PAD,
  LAST_PART_COL_MIN,
  MEAL_COL_MIN,
  MONTH_BAND_H,
  OTHER_COL_MIN,
  SMALL_MARK,
} from './geometry';

export const DAY_PARTS: readonly DayPart[] = [1, 2, 3, 4, 5, 6, 7];
/** Breakfast, dinner and supper: the tinted meal columns. */
export const MEAL_PARTS: ReadonlySet<DayPart> = new Set<DayPart>([2, 4, 6]);

// ---------- Dates (plain ISO dates, computed in UTC so no timezone can shift a day) ----------

const pad = (n: number) => String(n).padStart(2, '0');
export const parseDate = (s: PlainDate) => {
  const [y = 0, m = 1, d = 1] = s.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};
export const toIso = (d: Date): PlainDate =>
  `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
export const shiftDate = (s: PlainDate, days: number): PlainDate => {
  const d = parseDate(s);
  d.setUTCDate(d.getUTCDate() + days);
  return toIso(d);
};
export const isSunday = (s: PlainDate) => parseDate(s).getUTCDay() === 0;

/** Every date from `to` back to `from`, newest first. */
export function datesNewestFirst(from: PlainDate, to: PlainDate): PlainDate[] {
  const out: PlainDate[] = [];
  for (let s = to; s >= from; s = shiftDate(s, -1)) out.push(s);
  return out;
}

// ---------- Circles ----------

export type MarkSize = 'food' | 'small';
export type MarkState = 'given' | 'skipped' | 'partial';

/** Big circle = food; small circle = medication, supplement or treat. */
export const markSize = (item: Pick<Item, 'kind'>): MarkSize => (item.kind === 'food' ? 'food' : 'small');
export const markDiameter = (size: MarkSize) => (size === 'food' ? FOOD_MARK : SMALL_MARK);
/** Filled = given, hollow = skipped or refused, half-filled from the bottom = partly eaten. */
export const markState = (state: EntryState): MarkState => state;

// ---------- Lanes and columns ----------

export interface Lane {
  /** `<dayPart>:<food | itemId>`; every food item in one day part shares one lane. */
  key: string;
  part: DayPart;
  size: MarkSize;
  width: number;
  itemIds: string[];
}

export interface Column {
  part: DayPart;
  meal: boolean;
  width: number;
  lanes: Lane[];
}

export const laneKey = (part: DayPart, item: Pick<Item, 'id' | 'kind'>) =>
  `${part}:${item.kind === 'food' ? 'food' : item.id}`;

/**
 * Lanes come from the entries actually logged, in item order, food first within a part.
 * Items flagged `hiddenByDefault` (treats, Calmora) are left out, matching the default filters.
 */
export function buildColumns(items: Item[], entries: Entry[]): Column[] {
  const visible = items.filter((i) => !i.hiddenByDefault);
  const order = new Map(visible.map((i, idx) => [i.id, idx]));
  const byId = new Map(visible.map((i) => [i.id, i]));
  const lanes = new Map<string, Lane>();
  const rank = (l: Lane) => (l.size === 'food' ? -1 : (order.get(l.itemIds[0] ?? '') ?? 0));
  for (const e of entries) {
    const item = byId.get(e.itemId);
    if (!item) continue;
    const key = laneKey(e.dayPart, item);
    const size = markSize(item);
    const lane = lanes.get(key);
    if (lane) {
      if (!lane.itemIds.includes(item.id)) lane.itemIds.push(item.id);
    } else {
      lanes.set(key, { key, part: e.dayPart, size, width: markDiameter(size) + LANE_PAD, itemIds: [item.id] });
    }
  }
  return DAY_PARTS.map((part) => {
    const partLanes = [...lanes.values()].filter((l) => l.part === part).sort((a, b) => rank(a) - rank(b));
    const meal = MEAL_PARTS.has(part);
    const min = meal ? MEAL_COL_MIN : part === 7 ? LAST_PART_COL_MIN : OTHER_COL_MIN;
    const content = partLanes.reduce((sum, l) => sum + l.width, 0) + COLUMN_PAD;
    // The last part of the day collapses when nothing in it is shown (prototype behaviour).
    const width = part === 7 && partLanes.length === 0 ? 0 : Math.max(min, content);
    return { part, meal, width, lanes: partLanes };
  });
}

// ---------- Event badges ----------

export type BadgeKind = 'vet' | 'sym' | 'photo' | 'front' | 'worm';
export interface Badge {
  kind: BadgeKind;
  /** Text after the glyph: vet count, "!" or "!N", "F", "D"; empty for photo. */
  text: string;
}

/** Badge order and text per docs/DESIGN.md "Event badges". Other event types have no badge yet. */
export function badgesFor(events: Pick<HealthEvent, 'type'>[]): Badge[] {
  const count = (t: EventType) => events.filter((e) => e.type === t).length;
  const out: Badge[] = [];
  const vet = count('vet');
  const sym = count('symptom');
  if (vet) out.push({ kind: 'vet', text: String(vet) });
  if (sym) out.push({ kind: 'sym', text: sym > 1 ? `!${sym}` : '!' });
  if (count('photo')) out.push({ kind: 'photo', text: '' });
  if (count('frontline')) out.push({ kind: 'front', text: 'F' });
  if (count('deworming')) out.push({ kind: 'worm', text: 'D' });
  return out;
}

// ---------- Rows ----------

export interface MarkSlot {
  laneKey: string;
  width: number;
  size: MarkSize;
  /** Absent when nothing was logged in this lane on this day. */
  mark?: { itemId: string; colour: string; state: MarkState };
}

export interface DayRow {
  kind: 'day';
  date: PlainDate;
  top: number;
  height: number;
  isToday: boolean;
  slots: MarkSlot[][];
  badges: Badge[];
  events: HealthEvent[];
  anySkipped: boolean;
  /** Anything logged (entries or events) on the day; empty past days are on the Timeline too. */
  logged: boolean;
}

export interface MonthBand {
  kind: 'band';
  /** `YYYY-MM`. */
  month: string;
  top: number;
  height: number;
}

export type Row = DayRow | MonthBand;

export interface Tick {
  offset: number;
  kind: 'year' | 'month' | 'week';
}

export interface Timeline {
  columns: Column[];
  rows: Row[];
  ticks: Tick[];
  /** Height of all rows (bands and days), without the tail. */
  contentHeight: number;
  /**
   * The rail's scroll range: the scroll position at which the oldest day is the top row.
   * Rail top = 0 (today), rail bottom = span (first record); ticks and dragging both use it.
   */
  span: number;
  start: PlainDate;
  today: PlainDate;
}

/** The first date anything was recorded, or today when nothing was. */
export function recordsStart(today: PlainDate, entries: Entry[], events: HealthEvent[]): PlainDate {
  let start = today;
  for (const x of [...entries, ...events]) if (x.date < start) start = x.date;
  return start;
}

/** How far back the log reaches when nothing says otherwise (no setting, no records, no usual day). */
export const DEFAULT_LOG_DAYS = 365;

/**
 * The first day the Timeline and Day view offer ("Log starts on"). The setting when there is one;
 * otherwise the earliest of the first record and the usual day's first start; with neither, a year
 * back. Never later than the first record (nothing logged is hidden) or than today.
 */
export function logStartOf(input: {
  today: PlainDate;
  setting: PlainDate | null;
  entries: Pick<Entry, 'date'>[];
  events: Pick<HealthEvent, 'date'>[];
  slotStarts: PlainDate[];
}): PlainDate {
  const { today } = input;
  const records = [...input.entries, ...input.events].map((x) => x.date).filter((d) => d <= today);
  const earliest = (list: PlainDate[]) => list.reduce<PlainDate | null>((a, d) => (a === null || d < a ? d : a), null);
  const firstRecord = earliest(records);
  const derived = input.setting ?? earliest([...records, ...input.slotStarts]) ?? shiftDate(today, -DEFAULT_LOG_DAYS);
  const start = firstRecord && firstRecord < derived ? firstRecord : derived;
  return start > today ? today : start;
}

export function buildTimeline(input: {
  today: PlainDate;
  items: Item[];
  entries: Entry[];
  events: HealthEvent[];
  /** First day shown ("Log starts on"); defaults to the first record. Empty days in between are shown too. */
  start?: PlainDate;
}): Timeline {
  const { today, items } = input;
  const entries = input.entries.filter((e) => e.date <= today);
  const events = input.events.filter((e) => e.date <= today);
  const first = recordsStart(today, entries, events);
  const start = input.start && input.start < first ? input.start : first;
  const columns = buildColumns(items, entries);
  const itemById = new Map(items.map((i) => [i.id, i]));

  const entriesByDate = groupByDate(entries);
  const eventsByDate = groupByDate(events);

  const rows: Row[] = [];
  const ticks: Tick[] = [];
  let y = 0;
  let month = '';
  for (const date of datesNewestFirst(start, today)) {
    const m = date.slice(0, 7);
    if (m !== month) {
      month = m;
      rows.push({ kind: 'band', month: m, top: y, height: MONTH_BAND_H });
      ticks.push({ offset: y, kind: m.endsWith('-01') ? 'year' : 'month' });
      y += MONTH_BAND_H;
    }
    const isToday = date === today;
    if (isToday || isSunday(date)) ticks.push({ offset: y, kind: 'week' });
    const dayEntries = entriesByDate.get(date) ?? [];
    const dayEvents = eventsByDate.get(date) ?? [];
    const slots = columns.map((col) =>
      col.lanes.map<MarkSlot>((lane) => {
        const entry = dayEntries.find(
          (e) => e.dayPart === col.part && lane.itemIds.includes(e.itemId),
        );
        const item = entry && itemById.get(entry.itemId);
        return {
          laneKey: lane.key,
          width: lane.width,
          size: lane.size,
          mark: entry && item ? { itemId: item.id, colour: item.colour, state: markState(entry.state) } : undefined,
        };
      }),
    );
    rows.push({
      kind: 'day',
      date,
      top: y,
      height: DAY_ROW_H,
      isToday,
      slots,
      badges: badgesFor(dayEvents),
      events: dayEvents,
      anySkipped: dayEntries.some((e) => e.state === 'skipped'),
      logged: dayEntries.length > 0 || dayEvents.length > 0,
    });
    y += DAY_ROW_H;
  }
  const oldest = rows.at(-1);
  return { columns, rows, ticks, contentHeight: y, span: oldest ? oldest.top : 0, start, today };
}

function groupByDate<T extends { date: PlainDate }>(list: T[]): Map<PlainDate, T[]> {
  const map = new Map<PlainDate, T[]>();
  for (const x of list) {
    const arr = map.get(x.date);
    if (arr) arr.push(x);
    else map.set(x.date, [x]);
  }
  return map;
}

// ---------- Scroll maths ----------

/** Index of the last row whose top is at or above the scroll position (binary search). */
export function rowIndexAt(rows: Row[], scrollTop: number): number {
  let lo = 0;
  let hi = rows.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if ((rows[mid]?.top ?? Infinity) <= scrollTop + 1) lo = mid;
    else hi = mid - 1;
  }
  return Math.max(0, lo);
}

/** The first day at or below the row at the scroll position: the day the Key describes. */
export function topDayAt(rows: Row[], scrollTop: number): DayRow | null {
  for (let i = rowIndexAt(rows, scrollTop); i < rows.length; i++) {
    const r = rows[i];
    if (r?.kind === 'day') return r;
  }
  return null;
}

/** The tick the rail highlights: the latest tick at or above the top row. */
export function activeTickOffset(ticks: Tick[], topRowOffset: number): number {
  let act = -1;
  for (const k of ticks) if (k.offset <= topRowOffset && k.offset > act) act = k.offset;
  return act;
}

/**
 * The list keeps only LIST_TAIL_H of space after the oldest day, so it cannot scroll the oldest day
 * to the top. Instead the "focus" (the row the Key, the rail and the scrub label describe) is the top
 * row for most of the list and, over the last stretch of scrolling, slides down to the oldest row:
 * at the end of the list it is the oldest day, at the bottom of the screen.
 *
 * `focusOffset` maps a scroll position (0..maxScroll) to a row offset (0..span); `scrollForFocus`
 * is its inverse. Both are linear: identity up to `start`, then stretched so maxScroll meets span.
 * `span` is the oldest row's top; `maxScroll` the list's scrollHeight minus its clientHeight.
 */
function focusStart(span: number, maxScroll: number): number {
  return Math.max(0, maxScroll - (span - maxScroll));
}

export function focusOffset(scrollTop: number, span: number, maxScroll: number): number {
  const s = Math.max(0, scrollTop);
  if (maxScroll >= span) return s; // the oldest day can reach the top on its own
  if (maxScroll <= 0) return 0;
  const start = focusStart(span, maxScroll);
  if (s <= start) return s;
  return Math.min(span, start + ((s - start) * (span - start)) / (maxScroll - start));
}

export function scrollForFocus(offset: number, span: number, maxScroll: number): number {
  const p = Math.max(0, Math.min(offset, span));
  if (maxScroll >= span) return p;
  if (maxScroll <= 0) return 0;
  const start = focusStart(span, maxScroll);
  if (p <= start) return p;
  return start + ((p - start) * (maxScroll - start)) / (span - start);
}

/** Map a pointer position on the rail (0 = top, 1 = bottom) to a list scroll position within the span. */
export function railScrollTop(fraction: number, span: number, maxScroll: number = span): number {
  const f = Math.max(0, Math.min(1, fraction));
  return scrollForFocus(f * span, span, maxScroll);
}

/** Where a row offset sits on the rail, 0 to 1 (inverse of railScrollTop). */
export function railFraction(offset: number, span: number): number {
  return span > 0 ? Math.max(0, Math.min(1, offset / span)) : 0;
}
