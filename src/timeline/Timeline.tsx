import { useLayoutEffect, useMemo, useRef, useState, type MouseEvent, type PointerEvent, type ReactNode } from 'react';
import type { HealthEvent, Item, PlainDate } from '../data';
import { useLog } from '../log/LogProvider';
import { eventsWithPhotos } from '../photos/model';
import { useI18n, type Lang, type MessageKey } from '../i18n';
import { symptomLabel } from './labels';
import { DoseMark, colourVar } from '../components/DoseMark';
import { EventBadge } from '../components/EventBadge';
import { MealIcon } from '../components/MealIcon';
import { EVENTS_MIN_W, LIST_TAIL_H, PART_TICK_INSET, PART_TICK_MAX, RAIL_W, ROW_INSET, SCRUB_GAP, SCRUB_LIFT, TICK, TICK_H } from './geometry';
import {
  activeTickOffset,
  buildTimeline,
  fitLayout,
  parseDate,
  railFraction,
  railTarget,
  focusOffset,
  rowIndexAt,
  topDayAt,
  type BadgeKind,
  type Column,
  type DayRow,
  type MarkState,
  type Row,
  type Timeline as TimelineModel,
} from './model';
import './timeline.css';

const LOCALE: Record<Lang, string> = { en: 'en-GB', pl: 'pl-PL' };
const LIST_ID = 'timeline-list';

const LEGEND_MARKS: { key: MessageKey; state: MarkState; size: 'food' | 'small'; colour: string }[] = [
  { key: 'name.96', state: 'given', size: 'food', colour: 'food-cooked' },
  { key: 'name.97', state: 'skipped', size: 'food', colour: 'food-cooked' },
  { key: 'name.98', state: 'partial', size: 'food', colour: 'food-cooked' },
  { key: 'name.99', state: 'given', size: 'food', colour: 'mark-neutral' },
  { key: 'name.100', state: 'given', size: 'small', colour: 'mark-neutral' },
];
const LEGEND_BADGES: { key: MessageKey; kind: BadgeKind; text: string }[] = [
  { key: 'kVet', kind: 'vet', text: '2' },
  { key: 'kSym', kind: 'sym', text: '!' },
  { key: 'kPhoto', kind: 'photo', text: '' },
  { key: 'kFront', kind: 'front', text: 'F' },
  { key: 'kWorm', kind: 'worm', text: 'D' },
];

interface Loaded {
  timeline: TimelineModel;
  items: Map<string, Item>;
}

/** Long logs render only the rows near the viewport (plus this many px above and below). */
const WINDOW_FROM_ROWS = 120;
const OVERSCAN_PX = 900;

interface Props {
  /** List scroll position to restore once the rows are laid out (coming back from a day). */
  initialScrollTop?: number;
  /** A day to keep in view on return (the day the visitor ended on): wins over the saved position if that is off screen. */
  focusDate?: PlainDate;
  /** Path of a day, so each row is a real link (open in new tab, long-press preview). */
  dayHref?: (date: PlainDate) => string;
  /** A row was tapped; `scrollTop` is the list position to come back to. */
  onOpenDay?: (date: PlainDate, scrollTop: number) => void;
}

/**
 * Timeline: one row per day from the log start to today, newest first (empty days too, so any past
 * day can be opened and filled), Key bar, tick rail. Rows open the Day view. It renders from the
 * records LogProvider already holds, so coming back to it shows at once, without a new load.
 */
export function Timeline({ initialScrollTop = 0, focusDate, dayHref, onOpenDay }: Props) {
  const { lang, t } = useI18n();
  const { records, loadFailed, reload } = useLog();
  const data = useMemo<Loaded | null>(
    () =>
      records && {
        timeline: buildTimeline({
          today: records.today,
          items: records.items,
          entries: records.entries,
          events: records.events,
          start: records.logStart,
          withPhotos: eventsWithPhotos(records.photos),
        }),
        items: new Map(records.items.map((i) => [i.id, i])),
      },
    [records],
  );
  const [scrollTop, setScrollTop] = useState(0);
  const [focusIndex, setFocusIndex] = useState(0);
  const [keyOpen, setKeyOpen] = useState(false);
  const [scrubY, setScrubY] = useState<number | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  // The scroll position the rail last set while it holds the focus (null: the focus follows the scroll).
  const railHold = useRef<number | null>(null);
  const [viewport, setViewport] = useState(0);
  // The list width (0 until measured) decides how tightly the day-part columns are packed (fitColumns).
  const [listWidth, setListWidth] = useState(0);
  // Rows wider than the list scroll sideways; the Key and parts bars follow (scrolled: the date column floats over the rows).
  const keyScroll = useRef<HTMLSpanElement>(null);
  const partsScroll = useRef<HTMLSpanElement>(null);
  const [hScrolled, setHScrolled] = useState(false);

  // The list height drives windowing; the scroll range (and so the focus) is read from the element.
  // The width fits the columns; measured before paint so the first frame is already fitted.
  useLayoutEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const measure = () => {
      setViewport(el.clientHeight);
      setListWidth(el.clientWidth);
      // A new height changes the scroll range, and with it which row the focus is on near the end.
      if (data && railHold.current === null) setFocusIndex(rowIndexAt(data.timeline.rows, focusAt(el)));
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [data]);

  // Restore the scroll position once, after the rows exist and the list has its height.
  const restored = useRef(false);
  useLayoutEffect(() => {
    const el = listRef.current;
    if (restored.current || !data || !el || !viewport) return;
    restored.current = true;
    let target = initialScrollTop;
    const row = focusDate ? data.timeline.rows.find((r) => r.kind === 'day' && r.date === focusDate) : undefined;
    if (row && (row.top < target || row.top + row.height > target + viewport)) {
      target = Math.max(0, row.top + row.height / 2 - viewport / 2);
    }
    if (target > 0) {
      el.scrollTop = target;
      setFocusIndex(rowIndexAt(data.timeline.rows, focusAt(el)));
      setScrollTop(el.scrollTop);
    }
  }, [data, viewport, initialScrollTop, focusDate]);

  const fmt = useMemo(() => {
    const make = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(LOCALE[lang], { timeZone: 'UTC', ...o });
    const weekday = make({ weekday: 'short' });
    const dayMonth = make({ day: 'numeric', month: 'short' });
    const full = make({ day: 'numeric', month: 'short', year: 'numeric' });
    const long = make({ weekday: 'long', day: 'numeric', month: 'long' });
    const month = make({ month: 'long', year: 'numeric' });
    return {
      weekday: (s: string) => weekday.format(parseDate(s)),
      dayMonth: (s: string) => dayMonth.format(parseDate(s)),
      full: (s: string) => full.format(parseDate(s)),
      long: (s: string) => long.format(parseDate(s)),
      month: (m: string) => month.format(parseDate(`${m}-01`)),
    };
  }, [lang]);

  if (!data) {
    return (
      <div className="timeline">
        {loadFailed && (
          <div className="app-status" role="alert">
            <p className="app-status__text">{t('loadFailed')}</p>
            <button type="button" className="btn btn--ghost btn--md" onClick={reload}>
              {t('retry')}
            </button>
          </div>
        )}
      </div>
    );
  }
  const { timeline, items } = data;
  const { rows, ticks, span } = timeline;
  const { columns, dateW, rowW } = fitLayout(timeline.columns, listWidth);
  // Windowing for long logs: rows have fixed heights and tops, so the hidden ones become two spacers.
  const windowed = rows.length > WINDOW_FROM_ROWS;
  const lo = windowed ? rowIndexAt(rows, Math.max(0, scrollTop - OVERSCAN_PX)) : 0;
  const hi = windowed ? rowIndexAt(rows, scrollTop + (viewport || OVERSCAN_PX) + OVERSCAN_PX) + 1 : rows.length;
  const shownRows = rows.slice(lo, hi);
  const lastShown = shownRows.at(-1);
  const padTop = shownRows[0]?.top ?? 0;
  const padBottom = lastShown ? timeline.contentHeight - lastShown.top - lastShown.height : 0;
  const focusRow: Row | undefined = rows[focusIndex];
  const keyDay = topDayAt(rows, focusRow?.top ?? 0);
  const activeTick = activeTickOffset(ticks, focusRow?.top ?? 0);

  // Re-window once the list has moved a good part of the overscan.
  const rewindow = (el: HTMLElement) => {
    if (windowed && Math.abs(el.scrollTop - scrollTop) > OVERSCAN_PX / 3) setScrollTop(el.scrollTop);
  };

  const onScroll = () => {
    const el = listRef.current;
    if (!el) return;
    if (keyScroll.current) keyScroll.current.scrollLeft = el.scrollLeft;
    if (partsScroll.current) partsScroll.current.scrollLeft = el.scrollLeft;
    if ((el.scrollLeft > 0) !== hScrolled) setHScrolled(el.scrollLeft > 0);
    // The rail's own scrolling keeps the focus it set; any other scrolling hands it back to the list.
    const held = railHold.current !== null && Math.abs(el.scrollTop - railHold.current) <= 1;
    if (!held) {
      railHold.current = null;
      const i = rowIndexAt(rows, focusAt(el));
      if (i !== focusIndex) setFocusIndex(i);
    }
    rewindow(el);
  };

  const scrubTo = (e: PointerEvent<HTMLDivElement>) => {
    const list = listRef.current;
    if (!list) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    // Ticks sit at f * (height - TICK_H) (see the tick style below), so invert the same mapping.
    const target = railTarget(y / (rect.height - TICK_H), span, list.scrollHeight - list.clientHeight);
    list.scrollTop = target.scrollTop;
    railHold.current = list.scrollTop;
    setFocusIndex(rowIndexAt(rows, target.focus));
    setScrubY(Math.max(0, Math.min(rect.height, y)));
    rewindow(list);
  };

  // Letting go: a list that can scroll hands the focus back to its top row (the Key sits on the row
  // below it); one that cannot (a short log) keeps the dragged day.
  const endScrub = () => {
    dragging.current = false;
    setScrubY(null);
    const el = listRef.current;
    if (el && el.scrollHeight - el.clientHeight > 1) {
      railHold.current = null;
      setFocusIndex(rowIndexAt(rows, focusAt(el)));
    }
  };

  const scrubLabel = !focusRow ? '' : focusRow.kind === 'day' ? fmt.full(focusRow.date) : fmt.month(focusRow.month);

  const summary = (row: DayRow) => {
    const flags = flagsFor(row.events, row.badges.some((b) => b.kind === 'photo'), row.anySkipped, t);
    return `${fmt.long(row.date)}: ${flags.length ? flags.join(', ') : row.logged ? t('copy.95') : t('nothingLogged')}`;
  };

  const openDay = (date: PlainDate) => (e: MouseEvent<HTMLAnchorElement>) => {
    // Let the browser handle new-tab and new-window clicks.
    if (!onOpenDay || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    onOpenDay(date, listRef.current?.scrollTop ?? 0);
  };

  return (
    <div className={`timeline${hScrolled ? ' timeline--hscrolled' : ''}`}>
      <div className="tl-key">
        <button
          type="button"
          className="tl-key__toggle"
          aria-expanded={keyOpen}
          aria-label={t('keyAria')}
          onClick={() => setKeyOpen((v) => !v)}
        >
          <span ref={keyScroll} className="tl-hs">
            <span className="tl-hs__in" style={{ minWidth: rowW, paddingLeft: ROW_INSET }}>
              <span className="tl-key__date" style={{ width: dateW, left: ROW_INSET }}>
                <span className="tl-key__word">
                  {t('key')}
                  <svg className={`tl-key__chev${keyOpen ? ' tl-key__chev--open' : ''}`} viewBox="0 0 6 4" aria-hidden="true">
                    <path d="M0 0h6L3 4z" fill="currentColor" />
                  </svg>
                </span>
                <span className="tl-key__day">{keyDay ? fmt.dayMonth(keyDay.date) : ''}</span>
              </span>
              {columns.map((col, ci) => (
                <ColumnBox key={col.part} col={col}>
                  {col.lanes.map((lane, li) => {
                    const mark = keyDay?.slots[ci]?.[li]?.mark;
                    const item = mark && items.get(mark.itemId);
                    const label = item ? item.name : '';
                    return (
                      <span key={lane.key} className="tl-key__lane" style={{ width: lane.width }}>
                        <span className="tl-key__label">{label}</span>
                        <span className="tl-key__bar" style={{ background: mark ? colourVar(mark.colour) : 'transparent' }} />
                      </span>
                    );
                  })}
                </ColumnBox>
              ))}
              <span className="tl-key__lane tl-key__lane--events" style={{ minWidth: EVENTS_MIN_W }}>
                <span className="tl-key__label">{t('events')}</span>
                <span className="tl-key__bar tl-key__bar--ink" />
              </span>
            </span>
          </span>
          <span style={{ width: RAIL_W, flex: 'none' }} />
        </button>
        {keyOpen && (
          <div className="tl-legend">
            <h2 className="tl-legend__title">{t('marks')}</h2>
            <ul className="tl-legend__grid">
              {LEGEND_MARKS.map((m) => (
                <li key={m.key}>
                  <span className="tl-legend__sample">
                    <DoseMark colour={m.colour} size={m.size} state={m.state} />
                  </span>
                  {t(m.key)}
                </li>
              ))}
            </ul>
            <hr className="tl-legend__rule" />
            <ul className="tl-legend__grid">
              {LEGEND_BADGES.map((b) => (
                <li key={b.key}>
                  <span className="tl-legend__sample">
                    <EventBadge kind={b.kind} text={b.text} />
                  </span>
                  {t(b.key)}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="tl-body">
        <div id={LIST_ID} ref={listRef} className="tl-list" onScroll={onScroll} tabIndex={0}>
          <ul className="tl-rows">
            {padTop > 0 && <li className="tl-pad" style={{ height: padTop }} aria-hidden="true" />}
            {shownRows.map((row) =>
              row.kind === 'band' ? (
                <li key={row.month} className="tl-band" style={{ height: row.height, minWidth: rowW }}>
                  <h2 className="tl-band__title">{fmt.month(row.month)}</h2>
                </li>
              ) : (
                <li
                  key={row.date}
                  className={`tl-row${row.isToday ? ' tl-row--today' : ''}`}
                  style={{ height: row.height, paddingLeft: ROW_INSET, minWidth: rowW }}
                  data-date={row.date}
                >
                  {dayHref ? (
                    <a className="tl-row__link" href={dayHref(row.date)} onClick={openDay(row.date)}>
                      <span className="sr-only">{summary(row)}</span>
                    </a>
                  ) : (
                    <span className="sr-only">{summary(row)}</span>
                  )}
                  <span className="tl-row__date" style={{ width: dateW, left: ROW_INSET }} aria-hidden="true">
                    <span className="tl-row__num">{Number(row.date.slice(8))}</span>
                    <span className="tl-row__wd">{row.isToday ? t('wd') : fmt.weekday(row.date)}</span>
                  </span>
                  {columns.map((col, ci) => (
                    <ColumnBox key={col.part} col={col} hidden>
                      {row.slots[ci]?.map((slot, si) => (
                        <span key={slot.laneKey} className="tl-slot" style={{ width: col.lanes[si]?.width ?? slot.width }}>
                          {slot.mark && <DoseMark colour={slot.mark.colour} size={slot.size} state={slot.mark.state} />}
                        </span>
                      ))}
                    </ColumnBox>
                  ))}
                  <span className="tl-row__events" style={{ minWidth: EVENTS_MIN_W }} aria-hidden="true">
                    {row.badges.map((b) => (
                      <EventBadge key={b.kind} kind={b.kind} text={b.text} />
                    ))}
                  </span>
                </li>
              ),
            )}
            {padBottom > 0 && <li className="tl-pad" style={{ height: padBottom }} aria-hidden="true" />}
          </ul>
          <div className="tl-tail" style={{ height: LIST_TAIL_H }} />
        </div>

        <div
          className="tl-rail"
          style={{ width: RAIL_W }}
          role="scrollbar"
          aria-controls={LIST_ID}
          aria-orientation="vertical"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(railFraction(focusRow?.top ?? 0, span) * 100)}
          aria-label={t('railAria')}
          onPointerDown={(e) => {
            try {
              e.currentTarget.setPointerCapture(e.pointerId);
            } catch {
              /* capture unsupported */
            }
            dragging.current = true;
            scrubTo(e);
          }}
          onPointerMove={(e) => dragging.current && scrubTo(e)}
          onPointerUp={endScrub}
          onPointerCancel={endScrub}
        >
          {ticks.map((k) => {
            const active = k.offset === activeTick;
            const g = active ? TICK.active : TICK[k.kind];
            const f = railFraction(k.offset, span);
            return (
              <span
                key={`${k.kind}-${k.offset}`}
                className={`tl-tick tl-tick--${active ? 'active' : k.kind}`}
                style={{ top: `calc(${f * 100}% - ${f * TICK_H}px)`, width: g.w, right: g.right, height: TICK_H }}
              />
            );
          })}
        </div>

        {scrubY !== null && (
          <div className="tl-scrub" style={{ top: Math.max(0, scrubY - SCRUB_LIFT), right: RAIL_W + SCRUB_GAP }} aria-hidden="true">
            {scrubLabel}
          </div>
        )}
      </div>

      <div className="tl-parts" aria-hidden="true">
        <span ref={partsScroll} className="tl-hs">
          <span className="tl-hs__in" style={{ minWidth: rowW, paddingLeft: ROW_INSET }}>
            <span className="tl-parts__date" style={{ width: dateW, left: ROW_INSET }} />
            {columns.map((col) => (
              <ColumnBox key={col.part} col={col}>
                <span className="tl-parts__icon">{col.meal && <MealIcon part={col.part} />}</span>
                <span className="tl-parts__tick" style={{ width: col.meal ? Math.max(0, Math.min(PART_TICK_MAX, col.width - PART_TICK_INSET)) : 0 }} />
              </ColumnBox>
            ))}
            <span style={{ flex: 1, minWidth: EVENTS_MIN_W }} />
          </span>
        </span>
        <span style={{ width: RAIL_W, flex: 'none' }} />
      </div>
    </div>
  );
}

/** The row offset the Key and the rail describe for the list's current scroll position. */
function focusAt(el: HTMLElement): number {
  return focusOffset(el.scrollTop);
}

function ColumnBox({ col, hidden, children }: { col: Column; hidden?: boolean; children: ReactNode }) {
  if (!col.width) return null;
  return (
    <span className={`tl-col${col.meal ? ' tl-col--meal' : ''}`} style={{ width: col.width }} aria-hidden={hidden || undefined}>
      {children}
    </span>
  );
}

/** Words for the screen-reader summary of a day row. */
function flagsFor(events: HealthEvent[], photo: boolean, anySkipped: boolean, t: (k: MessageKey) => string): string[] {
  const out: string[] = [];
  const vet = events.filter((e) => e.type === 'vet').length;
  if (vet) out.push(vet > 1 ? `${t('copy.101')} ×${vet}` : t('copy.101'));
  const syms = events.filter((e) => e.type === 'symptom').map((e) => symptomLabel(e.title, t));
  if (syms.length) out.push(syms.join(', '));
  if (photo) out.push(t('copy.103'));
  if (events.some((e) => e.type === 'frontline')) out.push(t('kFront'));
  if (events.some((e) => e.type === 'deworming')) out.push(t('copy.102'));
  if (anySkipped) out.push(t('copy.93'));
  return out;
}
