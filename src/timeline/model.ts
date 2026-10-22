// Pure derivation of the timeline from repository data: lanes, rows, circles, badges, rail ticks.
// No React, no I/O: everything here is unit-tested (tests/timeline.test.ts).
import type { DayPart, Entry, EntryState, EventType, HealthEvent, Item, PlainDate } from '../data';
import {
  COLUMN_PAD,
  COLUMN_PAD_TIGHT,
  DATE_COL_W,
  DATE_COL_W_TIGHT,
  DAY_ROW_H,
  EVENTS_MIN_W,
  FOOD_MARK,
  LANE_PAD,
  LANE_PAD_TIGHT,
  LAST_PART_COL_MIN,
  MEAL_ICON_W,
  MEAL_COL_MIN,
  MONTH_BAND_H,
  OTHER_COL_MIN,
  ROW_INSET,
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

/** Total width of the day-part columns, px. */
export const columnsWidth = (columns: Column[]) => columns.reduce((sum, c) => sum + c.width, 0);

/**
 * Fit the day-part columns into `available` px (JCB-86), taking width back only as far as needed:
 * (a) a column's minimum gives way to its lanes + COLUMN_PAD; (b) the padding shrinks to
 * COLUMN_PAD_TIGHT; (c) lanes get 2 px narrower (food 18, small 14; circles keep their size).
 * A meal column keeps room for its icon. If even (c) does not fit, that result is returned anyway:
 * check it with `columnsWidth` (the Timeline then scrolls sideways, see `fitLayout`).
 */
export function fitColumns(columns: Column[], available: number): Column[] {
  if (columnsWidth(columns) <= available) return columns;
  const tighten = (pad: number, tightLanes: boolean) =>
    columns.map((c): Column => {
      if (!c.width) return c;
      const lanes = tightLanes ? c.lanes.map((l) => ({ ...l, width: markDiameter(l.size) + LANE_PAD_TIGHT[l.size] })) : c.lanes;
      const content = lanes.reduce((sum, l) => sum + l.width, 0);
      return { ...c, lanes, width: Math.min(c.width, Math.max(content + pad, c.meal ? MEAL_ICON_W : 0)) };
    });
  for (const [pad, tight] of [[COLUMN_PAD, false], [COLUMN_PAD_TIGHT, false]] as const) {
    const cols = tighten(pad, tight);
    if (columnsWidth(cols) <= available) return cols;
  }
  return tighten(COLUMN_PAD_TIGHT, true);
}

/** Width of the Timeline list left for the day-part columns: everything but the inset, date column and Events column. */
export const columnsAvailable = (listWidth: number, dateW: number = DATE_COL_W) => listWidth - ROW_INSET - dateW - EVENTS_MIN_W;

export interface Fit {
  columns: Column[];
  dateW: number;
  /** Width every row needs: inset + date + columns + Events minimum. Wider than the list means the list scrolls sideways. */
  rowW: number;
  scrolls: boolean;
}

/** The whole horizontal layout for a list `listWidth` px wide: `fitColumns`, then a narrower date column, then sideways scroll. */
export function fitLayout(columns: Column[], listWidth: number): Fit {
  const make = (cols: Column[], dateW: number): Fit => {
    const rowW = ROW_INSET + dateW + columnsWidth(cols) + EVENTS_MIN_W;
    return { columns: cols, dateW, rowW, scrolls: rowW > listWidth };
  };
  const roomy = make(fitColumns(columns, columnsAvailable(listWidth)), DATE_COL_W);
  if (!roomy.scrolls) return roomy;
  return make(fitColumns(columns, columnsAvailable(listWidth, DATE_COL_W_TIGHT)), DATE_COL_W_TIGHT);
}

// ---------- Event badges ----------

export type BadgeKind = 'vet' | 'sym' | 'note' | 'photo' | 'front' | 'worm' | 'more';
export interface Badge {
  kind: BadgeKind;
  /** Text after the glyph: vet count, "!" or "!N", "F", "D", "+N" for the hidden rest; empty for note and photo. */
  text: string;
}

/**
 * Badge order and text per docs/DESIGN.md "Event badges" (priority order: vet, symptoms, note, photo,
 * Frontline, deworming). Other event types have no badge yet.
 * The camera shows once for a day with any photo: a photo event, or another event with photos
 * (`withPhotos`: ids of events that have photos, JCB-7). Never one per photo, so the row keeps its geometry.
 * The note badge shows once for a day with any note: a note event, or a note on a food or medication entry
 * (`entryNote`). Never a count.
 */
export function badgesFor(
  events: Pick<HealthEvent, 'type' | 'id'>[],
  withPhotos: ReadonlySet<string> = new Set(),
  entryNote = false,
): Badge[] {
  const count = (t: EventType) => events.filter((e) => e.type === t).length;
  const out: Badge[] = [];
  const vet = count('vet');
  const sym = count('symptom');
  if (vet) out.push({ kind: 'vet', text: String(vet) });
  if (sym) out.push({ kind: 'sym', text: sym > 1 ? `!${sym}` : '!' });
  if (entryNote || count('note')) out.push({ kind: 'note', text: '' });
  if (hasPhoto(events, withPhotos)) out.push({ kind: 'photo', text: '' });
  if (count('frontline')) out.push({ kind: 'front', text: 'F' });
  if (count('deworming')) out.push({ kind: 'worm', text: 'D' });
  return out;
}

// Rendered widths of a badge (border 2 + padding 8 + glyph + 2 gap + text), px; a table so the fit needs no DOM measuring.
const BADGE_GLYPH_W: Record<BadgeKind, number> = { vet: 12, sym: 0, note: 12, photo: 12, front: 0, worm: 0, more: 0 };
const BADGE_MIN_W = 18;
const BADGE_GAP = 3;
const textWidth = (text: string) => [...text].reduce((w, ch) => w + (ch === '!' ? 4 : ch === '+' ? 7 : /\d/.test(ch) ? 7 : 8), 0);
export function badgeWidth(b: Badge): number {
  const glyph = BADGE_GLYPH_W[b.kind];
  const text = textWidth(b.text);
  return Math.max(BADGE_MIN_W, 10 + glyph + (glyph && text ? 2 : 0) + text);
}

/**
 * Busy days (JCB-26/69): one line of whole badges in priority order; those that do not fit fold into a
 * trailing "+N" chip (N = how many are hidden). `width` is the room inside the Events column.
 */
export function fitBadges(badges: Badge[], width: number): Badge[] {
  const rowWidth = (list: Badge[]) => list.reduce((w, b, i) => w + badgeWidth(b) + (i ? BADGE_GAP : 0), 0);
  if (rowWidth(badges) <= width) return badges;
  for (let shown = badges.length - 1; shown >= 0; shown--) {
    const withMore = [...badges.slice(0, shown), { kind: 'more' as const, text: `+${badges.length - shown}` }];
    if (rowWidth(withMore) <= width || shown === 0) return withMore;
  }
  return badges;
}

/** Room for the Events column in a list `listWidth` px wide, given the fitted layout (never below EVENTS_MIN_W). */
export const eventsWidth = (fit: Fit, listWidth: number) => Math.max(EVENTS_MIN_W, listWidth - (fit.rowW - EVENTS_MIN_W));

/** A day has a photo: a photo event, or an event carrying photos. */
export function hasPhoto(events: Pick<HealthEvent, 'type' | 'id'>[], withPhotos: ReadonlySet<string> = new Set()): boolean {
  return events.some((e) => e.type === 'photo' || withPhotos.has(e.id));
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
  /** Ids of events that have photos (the camera badge, JCB-7). */
  withPhotos?: ReadonlySet<string>;
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
      badges: badgesFor(dayEvents, input.withPhotos, dayEntries.some((e) => e.note.trim() !== '')),
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
 * The list keeps only LIST_TAIL_H of space after the oldest day, so it cannot scroll the oldest day to
 * the top. That is fine: while scrolling, the "focus" (the row the Key, the rail and the scrub label
 * describe) is always the top visible row, so the Key matches the row directly below it. The oldest
 * rows are reached by the rail instead (railTarget), which focuses the dragged day even where the
 * list cannot scroll that far.
 */
export function focusOffset(scrollTop: number): number {
  return Math.max(0, scrollTop);
}

/**
 * A rail drag at `fraction` (0 = top, 1 = bottom): the focus is the dragged row offset itself, so the
 * rail reaches every day even when the list cannot scroll (a log that fits on one screen); the list
 * scrolls as close to it as its range allows.
 */
export function railTarget(fraction: number, span: number, maxScroll: number = span): { focus: number; scrollTop: number } {
  const focus = Math.max(0, Math.min(1, fraction)) * span;
  return { focus, scrollTop: Math.max(0, Math.min(focus, maxScroll)) };
}

/** Map a pointer position on the rail (0 = top, 1 = bottom) to a list scroll position within the span. */
export function railScrollTop(fraction: number, span: number, maxScroll: number = span): number {
  return railTarget(fraction, span, maxScroll).scrollTop;
}

/** Where a row offset sits on the rail, 0 to 1 (inverse of railScrollTop). */
export function railFraction(offset: number, span: number): number {
  return span > 0 ? Math.max(0, Math.min(1, offset / span)) : 0;
}
