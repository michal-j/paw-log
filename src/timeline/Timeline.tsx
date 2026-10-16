import { useEffect, useLayoutEffect, useMemo, useRef, useState, type MouseEvent, type PointerEvent, type ReactNode } from 'react';
import type { HealthEvent, Item, PlainDate, Repository } from '../data';
import { useI18n, type Lang, type MessageKey } from '../i18n';
import { symptomLabel } from './labels';
import { DoseMark, colourVar } from '../components/DoseMark';
import { EventBadge } from '../components/EventBadge';
import { MealIcon } from '../components/MealIcon';
import { DATE_COL_W, EVENTS_MIN_W, PART_TICK_INSET, PART_TICK_MAX, RAIL_W, ROW_INSET, SCRUB_GAP, SCRUB_LIFT, TICK, TICK_H } from './geometry';
import {
  activeTickOffset,
  buildTimeline,
  parseDate,
  railFraction,
  railScrollTop,
  tailHeight,
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

/** Key labels for the shared food lane in each meal part. */
const MEAL_LABEL: Partial<Record<number, MessageKey>> = { 2: 'copy.49', 4: 'copy.51', 6: 'copy.53' };

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

async function load(repository: Repository): Promise<Loaded> {
  const today = repository.today();
  const [items, entries, events] = await Promise.all([
    repository.listItems(),
    repository.listEntries({ to: today }),
    repository.listEvents({ to: today }),
  ]);
  return { timeline: buildTimeline({ today, items, entries, events }), items: new Map(items.map((i) => [i.id, i])) };
}

interface Props {
  repository: Repository;
  /** Bumped after every write; the timeline reloads. */
  version?: number;
  /** List scroll position to restore once the rows are laid out (coming back from a day). */
  initialScrollTop?: number;
  /** Path of a day, so each row is a real link (open in new tab, long-press preview). */
  dayHref?: (date: PlainDate) => string;
  /** A row was tapped; `scrollTop` is the list position to come back to. */
  onOpenDay?: (date: PlainDate, scrollTop: number) => void;
}

/** Read-only timeline (slice 2a): one row per day, newest first, Key bar, tick rail. Rows open the Day view (3a). */
export function Timeline({ repository, version = 0, initialScrollTop = 0, dayHref, onOpenDay }: Props) {
  const { lang, t } = useI18n();
  const [data, setData] = useState<Loaded | null>(null);
  const [topIndex, setTopIndex] = useState(0);
  const [keyOpen, setKeyOpen] = useState(false);
  const [scrubY, setScrubY] = useState<number | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const [viewport, setViewport] = useState(0);

  // The tail must let the oldest day reach the top, so it depends on the list's visible height.
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const measure = () => setViewport(el.clientHeight);
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [data]);

  useEffect(() => {
    let live = true;
    load(repository).then(
      (next) => live && setData(next),
      () => live && setData(null), // error state not designed yet; the timeline stays empty
    );
    return () => {
      live = false;
    };
  }, [repository, version]);

  // Restore the scroll position once, after the rows and the tail (which needs the list height) exist.
  const restored = useRef(false);
  useLayoutEffect(() => {
    const el = listRef.current;
    if (restored.current || !data || !el || !viewport) return;
    restored.current = true;
    if (initialScrollTop > 0) {
      el.scrollTop = initialScrollTop;
      setTopIndex(rowIndexAt(data.timeline.rows, el.scrollTop));
    }
  }, [data, viewport, initialScrollTop]);

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

  if (!data) return <div className="timeline" />;
  const { timeline, items } = data;
  const { rows, columns, ticks, span } = timeline;
  const topRow: Row | undefined = rows[topIndex];
  const keyDay = topDayAt(rows, topRow?.top ?? 0);
  const activeTick = activeTickOffset(ticks, topRow?.top ?? 0);

  const onScroll = () => {
    const el = listRef.current;
    if (!el) return;
    const i = rowIndexAt(rows, el.scrollTop);
    if (i !== topIndex) setTopIndex(i);
  };

  const scrubTo = (e: PointerEvent<HTMLDivElement>) => {
    const list = listRef.current;
    if (!list) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    // Ticks sit at f * (height - TICK_H) (see the tick style below), so invert the same mapping.
    list.scrollTop = railScrollTop(y / (rect.height - TICK_H), span, list.scrollHeight - list.clientHeight);
    setScrubY(Math.max(0, Math.min(rect.height, y)));
    onScroll();
  };

  const scrubLabel = !topRow ? '' : topRow.kind === 'day' ? fmt.full(topRow.date) : fmt.month(topRow.month);

  const summary = (row: DayRow) => {
    const flags = flagsFor(row.events, row.anySkipped, t);
    return `${fmt.long(row.date)}: ${flags.length ? flags.join(', ') : t('copy.95')}`;
  };

  const openDay = (date: PlainDate) => (e: MouseEvent<HTMLAnchorElement>) => {
    // Let the browser handle new-tab and new-window clicks.
    if (!onOpenDay || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    onOpenDay(date, listRef.current?.scrollTop ?? 0);
  };

  return (
    <div className="timeline">
      <div className="tl-key">
        <button
          type="button"
          className="tl-key__toggle"
          aria-expanded={keyOpen}
          aria-label={t('keyAria')}
          onClick={() => setKeyOpen((v) => !v)}
          style={{ paddingLeft: ROW_INSET }}
        >
          <span className="tl-key__date" style={{ width: DATE_COL_W }}>
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
                const mealKey = lane.size === 'food' ? MEAL_LABEL[col.part] : undefined;
                const label = item ? (mealKey ? t(mealKey) : item.name) : '';
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
            {rows.map((row) =>
              row.kind === 'band' ? (
                <li key={row.month} className="tl-band" style={{ height: row.height }}>
                  <h2 className="tl-band__title">{fmt.month(row.month)}</h2>
                </li>
              ) : (
                <li
                  key={row.date}
                  className={`tl-row${row.isToday ? ' tl-row--today' : ''}`}
                  style={{ height: row.height, paddingLeft: ROW_INSET }}
                  data-date={row.date}
                >
                  {dayHref ? (
                    <a className="tl-row__link" href={dayHref(row.date)} onClick={openDay(row.date)}>
                      <span className="sr-only">{summary(row)}</span>
                    </a>
                  ) : (
                    <span className="sr-only">{summary(row)}</span>
                  )}
                  <span className="tl-row__date" style={{ width: DATE_COL_W }} aria-hidden="true">
                    <span className="tl-row__num">{Number(row.date.slice(8))}</span>
                    <span className="tl-row__wd">{row.isToday ? t('wd') : fmt.weekday(row.date)}</span>
                  </span>
                  {columns.map((col, ci) => (
                    <ColumnBox key={col.part} col={col} hidden>
                      {row.slots[ci]?.map((slot) => (
                        <span key={slot.laneKey} className="tl-slot" style={{ width: slot.width }}>
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
          </ul>
          <div className="tl-tail" style={{ height: tailHeight(viewport) }} />
        </div>

        <div
          className="tl-rail"
          style={{ width: RAIL_W }}
          role="scrollbar"
          aria-controls={LIST_ID}
          aria-orientation="vertical"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(railFraction(topRow?.top ?? 0, span) * 100)}
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
          onPointerUp={() => {
            dragging.current = false;
            setScrubY(null);
          }}
          onPointerCancel={() => {
            dragging.current = false;
            setScrubY(null);
          }}
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

      <div className="tl-parts" style={{ paddingLeft: ROW_INSET }} aria-hidden="true">
        <span style={{ width: DATE_COL_W, flex: 'none' }} />
        {columns.map((col) => (
          <ColumnBox key={col.part} col={col}>
            <span className="tl-parts__icon">{col.meal && <MealIcon part={col.part} />}</span>
            <span className="tl-parts__tick" style={{ width: col.meal ? Math.min(PART_TICK_MAX, col.width - PART_TICK_INSET) : 0 }} />
          </ColumnBox>
        ))}
        <span style={{ flex: 1, minWidth: EVENTS_MIN_W + RAIL_W }} />
      </div>
    </div>
  );
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
function flagsFor(events: HealthEvent[], anySkipped: boolean, t: (k: MessageKey) => string): string[] {
  const out: string[] = [];
  const vet = events.filter((e) => e.type === 'vet').length;
  if (vet) out.push(vet > 1 ? `${t('copy.101')} ×${vet}` : t('copy.101'));
  const syms = events.filter((e) => e.type === 'symptom').map((e) => symptomLabel(e.title, t));
  if (syms.length) out.push(syms.join(', '));
  if (events.some((e) => e.type === 'photo')) out.push(t('copy.103'));
  if (events.some((e) => e.type === 'frontline')) out.push(t('kFront'));
  if (events.some((e) => e.type === 'deworming')) out.push(t('copy.102'));
  if (anySkipped) out.push(t('copy.93'));
  return out;
}
