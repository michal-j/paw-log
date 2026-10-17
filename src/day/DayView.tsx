import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { DayPart, Entry, HealthEvent, PlainDate } from '../data';
import { fill, useI18n, type MessageKey } from '../i18n';
import { DoseMark } from '../components/DoseMark';
import { EventBadge } from '../components/EventBadge';
import { CheckIcon, ChevronIcon, PlusIcon, RoutineIcon } from '../components/icons';
import { MealIcon } from '../components/MealIcon';
import { symptomLabel } from '../timeline/labels';
import { parseDate, shiftDate } from '../timeline/model';
import * as act from '../log/actions';
import { groupOf } from '../log/amount';
import { eventKindOf } from '../log/EventSheet';
import { LOCALE, useFormat } from '../log/format';
import { useLog } from '../log/LogProvider';
import { plannedEntry } from '../log/plan';
import { symptomDetail } from '../log/symptoms';
import { useBusy } from '../log/useBusy';
import { ConditionTags } from '../tracked/ConditionTag';
import { conditionsOf } from '../tracked/model';
import { EventCard } from './EventCard';
import { buildDay, dayBounds, inBounds, type DayEntry, type PlannedRow } from './model';
import './day.css';

/** Tag after an item that was not simply given: "Refused" and "Half eaten". */
const STATE_TAG: Partial<Record<DayEntry['state'], MessageKey>> = { skipped: 'tagR', partial: 'name.98' };

interface Props {
  date: PlainDate;
  onBack: () => void;
  onStep: (date: PlainDate) => void;
  /** The date is outside the records (before the first one or after today). */
  onInvalid: () => void;
  onUsualDay: (date: PlainDate) => void;
  /** A condition tag on an event was tapped. */
  onOpenCondition: (id: string) => void;
}

/**
 * Day view: what was logged on one date and what the usual day still has open, by day part, plus the
 * day's events. Tap a row to edit it, Given to log a planned item, Fill to log every due one.
 */
export function DayView({ date, onBack, onStep, onInvalid, onUsualDay, onOpenCondition }: Props) {
  const { lang, t } = useI18n();
  const f = useFormat();
  const { records, repository, open, run, version } = useLog();

  // Re-render every minute so "up to now" and Later today follow the clock while the app stays open.
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  const bounds = useMemo(
    () => (records ? dayBounds(records.today, records.entries, records.events, records.logStart) : null),
    [records],
  );
  // Judge the date only on records loaded after the last write: right after saving on a day before
  // the first record, the records still being loaded do not have that day yet.
  const fresh = !!records && records.version === version;
  const valid = records && bounds && fresh ? inBounds(date, bounds) : true;
  useEffect(() => {
    if (!valid) onInvalid();
  }, [valid, onInvalid]);

  const title = useMemo(
    () =>
      new Intl.DateTimeFormat(LOCALE[lang], { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' }).format(
        parseDate(date),
      ),
    [lang, date],
  );

  const today = repository.today();
  const now = repository.nowTime();
  const day =
    records && bounds && valid
      ? buildDay({ date, bounds, ...records, plan: { slots: records.slots, removed: records.removed, today, now, times: records.times } })
      : null;
  const sub = date === today ? t('sub') : date === shiftDate(today, -1) ? t('copy.114') : '';
  const due = day ? day.parts.flatMap((p) => p.due) : [];
  const anyPlanned = day ? day.parts.some((p) => p.rows.length > 0) : false;
  // The prominent Fill banner is for a day with nothing logged; otherwise Fill is a quiet action below the parts.
  // A removed item counts: the day was worked on. The choice is made when the day opens and kept
  // while it stays open, so Given, a delete or Undo never make the banner jump in or out.
  const removed = day ? day.parts.flatMap((p) => p.removed) : [];
  const anyLogged = day ? day.parts.some((p) => p.entries.length > 0) || removed.length > 0 : false;
  const [quietFor, setQuietFor] = useState<{ date: PlainDate; quiet: boolean } | null>(null);
  if (day && quietFor?.date !== date) setQuietFor({ date, quiet: anyLogged });
  const quietFill = quietFor?.date === date ? quietFor.quiet : anyLogged;
  const itemGroup = (itemId: string) => groupOf(records?.items.find((i) => i.id === itemId)?.kind ?? 'medication');

  // Screen readers and keyboard users land on the day heading when the view opens and on Previous/Next.
  const titleRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    titleRef.current?.focus({ preventScroll: true });
  }, [date]);

  const { busy, guard } = useBusy();
  // Keep the day parts where they are on screen while a fill turns planned rows into logged ones.
  const bodyRef = useRef<HTMLDivElement>(null);
  const partsRef = useRef<HTMLUListElement>(null);
  const anchor = useRef<number | null>(null);
  useLayoutEffect(() => {
    const body = bodyRef.current;
    const parts = partsRef.current;
    if (anchor.current === null || !body || !parts) return;
    body.scrollTop += parts.getBoundingClientRect().top - anchor.current;
    anchor.current = null;
  }, [records]);
  const giveGuarded = guard(async (rows: PlannedRow[]) => {
    let added = 0;
    await run(
      async () => {
        const res = await act.addPlanned(repository, rows.map((r) => plannedEntry(r.slot, date, act.newId())));
        added = res.added;
        return res.undo;
      },
      // Nothing new (someone already logged them): keep the toast that is showing, and its Undo.
      () => (added ? fill(t('toastFilled'), { n: added }) : null),
    );
  });
  const give = (rows: PlannedRow[]) => {
    anchor.current = partsRef.current?.getBoundingClientRect().top ?? null;
    void giveGuarded(rows);
  };
  const restore = guard(async () => {
    const markers = removed.map((r) => r.marker);
    await run(() => act.restoreRemoved(repository, markers), fill(t('toastRestored'), { n: markers.length }));
  });
  const fillHead = date === today ? `${fill(t('fillTodayH'), { n: due.length })} (${now})` : fill(t('fillPastH'), { n: due.length });

  const editEntry = (e: Entry) => open({ kind: 'entry', group: itemGroup(e.itemId), date: e.date, part: e.dayPart, entry: e });
  const editEvent = (e: HealthEvent) => {
    const kind = eventKindOf(e.type);
    if (kind) open({ kind: 'event', type: kind, date: e.date, event: e });
  };
  const addToPart = (part: DayPart) => open({ kind: 'add', date, part });
  const tagsOf = (e: HealthEvent) => (records ? conditionsOf(e, records.conditions) : []);

  return (
    <section className="day" aria-labelledby="day-title">
      <div className="day__top">
        <button type="button" className="day-btn day-btn--back" onClick={onBack}>
          <ChevronIcon dir="left" size={18} />
          {t('timeline')}
        </button>
      </div>

      <div className="day__head">
        <StepButton dir="prev" target={day ? day.prev : null} label={t('prevDay')} onStep={onStep} />
        <div className="day__titles" aria-live="polite">
          <h2 id="day-title" className="day__title" ref={titleRef} tabIndex={-1}>
            {title}
          </h2>
          {sub && <p className="day__sub">{sub}</p>}
        </div>
        <StepButton dir="next" target={day ? day.next : null} label={t('nextDay')} onStep={onStep} />
      </div>

      <div className="day__body" ref={bodyRef}>
        {due.length > 0 && !quietFill && (
          <div className="day-card day-fill">
            <span className="day-fill__icon" aria-hidden="true">
              <RoutineIcon />
            </span>
            <div className="day-fill__text">
              <p className="day-fill__head">{fillHead}</p>
              <p className="day-fill__hint">{t('fillHint')}</p>
              <button type="button" className="btn btn--primary btn--md day-fill__btn" disabled={busy} onClick={() => give(due)}>
                {fill(t('fillBtn'), { n: due.length })}
              </button>
            </div>
          </div>
        )}

        {day && day.events.count > 0 && (
          <>
            <h3 className="day__caption">{t('happened')}</h3>
            {day.events.visits.map((e) => (
              <EventCard key={e.id} event={e} tags={tagsOf(e)} onEdit={() => editEvent(e)} onOpenCondition={onOpenCondition} />
            ))}
            {day.events.symptoms.length > 0 && (
              <article className="day-card">
                <h4 className="day-card__head">
                  <EventBadge kind="sym" text="!" />
                  {t('kSym')}
                </h4>
                <ul className="day-card__rows">
                  {day.events.symptoms.map((e) => (
                    <li key={e.id}>
                      <button type="button" className="day-card__row" onClick={() => editEvent(e)}>
                        <span className="day-card__row-label">{symptomLabel(e.title, t)}</span>
                        <span className="day-card__row-value">{symptomDetail(e, t)}</span>
                      </button>
                      <ConditionTags conditions={tagsOf(e)} onOpen={onOpenCondition} row />
                    </li>
                  ))}
                </ul>
              </article>
            )}
            {day.events.others.map((e) => (
              <EventCard
                key={e.id}
                event={e}
                tags={tagsOf(e)}
                onEdit={eventKindOf(e.type) ? () => editEvent(e) : null}
                onOpenCondition={onOpenCondition}
              />
            ))}
          </>
        )}

        <div className="day__section">
          <h3 className="day__caption">{t('dayPartsTitle')}</h3>
          <button type="button" className="day__link" onClick={() => onUsualDay(date)}>
            <RoutineIcon size={15} />
            {t('usualLink')}
            <ChevronIcon />
          </button>
        </div>
        {day?.empty && !anyPlanned && (
          <div className="day-card day-empty">
            <span className="day-empty__icon" aria-hidden="true">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M12 6v6l3.5 2" />
                <circle cx="12" cy="12" r="9" />
              </svg>
            </span>
            <p className="day-empty__text">{t('noData')}</p>
          </div>
        )}
        {day && (
          <ul className="day-card day-parts" ref={partsRef}>
            {day.parts.map((p) => (
              <li key={p.part} className={`day-part${p.meal ? ' day-part--meal' : ''}`}>
                <div className="day-part__head">
                  <span className="day-part__icon" aria-hidden="true">
                    {p.meal ? <MealIcon part={p.part} size={26} /> : <span className={`day-part__dot${p.rows.length ? ' day-part__dot--any' : ''}`} />}
                  </span>
                  <h4 className="day-part__name">{f.part(p.part)}</h4>
                  <button type="button" className="part-add" aria-label={`${t('addAria')}${f.part(p.part)}`} onClick={() => addToPart(p.part)}>
                    <span>
                      <PlusIcon />
                    </span>
                  </button>
                </div>
                {p.rows.length ? (
                  <ul className="day-part__items">
                    {p.rows.map((r) => {
                      const name = f.name(r.name, r.flavour);
                      const amount = f.amount(r.amount, r.unit, r.conversion, r.kind === 'logged' ? r.doseText : '');
                      const course = r.course ? fill(t('dayNofM'), r.course) : '';
                      if (r.kind === 'planned') {
                        const subText = [r.due ? t('planned') : t('laterToday'), course].filter(Boolean).join(' · ');
                        return (
                          <li key={r.id} className="day-item day-item--planned">
                            <button
                              type="button"
                              className="day-item__open"
                              onClick={() => open({ kind: 'entry', group: itemGroup(r.itemId), date, part: p.part, slot: r.slot })}
                            >
                              <span className="day-item__mark">
                                <DoseMark colour={r.colour} size={r.size} state="planned" />
                              </span>
                              <span className="day-item__text">
                                <span className="day-item__name">{name}</span>
                                {amount && <span className="day-item__dose"> · {amount}</span>}
                                <span className="day-item__sub">{subText}</span>
                              </span>
                            </button>
                            <button
                              type="button"
                              className="btn btn--ghost day-give"
                              aria-label={fill(t('markGiven'), { name })}
                              disabled={busy}
                              onClick={() => give([r])}
                            >
                              <span className="btn__icon">
                                <CheckIcon />
                              </span>
                              {t('name.96')}
                            </button>
                          </li>
                        );
                      }
                      const tag = STATE_TAG[r.state];
                      const subText = [course, r.note].filter(Boolean).join(' · ');
                      return (
                        <li key={r.id} className={`day-item day-item--${r.state}`}>
                          <button type="button" className="day-item__open" onClick={() => editEntry(r.entry)}>
                            <span className="day-item__mark">
                              <DoseMark colour={r.colour} size={r.size} state={r.state} />
                            </span>
                            <span className="day-item__text">
                              <span className="day-item__name">{name}</span>
                              {amount && <span className="day-item__dose"> · {amount}</span>}
                              {subText && <span className="day-item__sub">{subText}</span>}
                            </span>
                            {tag && <span className={`day-tag day-tag--${r.state}`}>{t(tag)}</span>}
                          </button>
                        </li>
                      );
                    })}
                    {p.due.length > 1 && (
                      <li className="day-item day-item--all">
                        <button type="button" className="btn btn--ghost day-give" disabled={busy} onClick={() => give(p.due)}>
                          <span className="btn__icon">
                            <CheckIcon />
                          </span>
                          {t('allGiven')}
                        </button>
                      </li>
                    )}
                  </ul>
                ) : (
                  <p className="day-part__none">{t('nothingSched')}</p>
                )}
              </li>
            ))}
          </ul>
        )}
        {due.length > 0 && quietFill && (
          <div className="day-fill-quiet">
            <p className="day-fill-quiet__text">{fillHead}</p>
            <button type="button" className="btn btn--ghost btn--md day-fill-quiet__btn" disabled={busy} onClick={() => give(due)}>
              <span className="btn__icon">
                <RoutineIcon size={15} />
              </span>
              {fill(t('fillBtn'), { n: due.length })}
            </button>
          </div>
        )}
        {removed.length > 0 && (
          <p className="day-removed">
            <span className="day-removed__text">{fill(t('removedUsual'), { n: removed.length })}</span>
            <span aria-hidden="true"> · </span>
            <button type="button" className="day-removed__btn" disabled={busy} onClick={() => void restore()}>
              {t('restore')}
            </button>
          </p>
        )}
      </div>
    </section>
  );
}

/** Previous / next day. At a bound it stays focusable and is announced as unavailable (aria-disabled). */
function StepButton({
  dir,
  target,
  label,
  onStep,
}: {
  dir: 'prev' | 'next';
  target: PlainDate | null;
  label: string;
  onStep: (date: PlainDate) => void;
}) {
  return (
    <button
      type="button"
      className="day-btn day-btn--step"
      aria-label={label}
      aria-disabled={target ? undefined : true}
      onClick={() => target && onStep(target)}
    >
      <ChevronIcon dir={dir === 'prev' ? 'left' : 'right'} size={18} />
    </button>
  );
}
