import { useEffect, useMemo, useState } from 'react';
import type { Entry, HealthEvent, Item, PlainDate, Repository } from '../data';
import { useI18n, type Lang, type MessageKey } from '../i18n';
import { DoseMark } from '../components/DoseMark';
import { EventBadge } from '../components/EventBadge';
import { MealIcon } from '../components/MealIcon';
import { symptomLabel } from '../timeline/labels';
import { parseDate, shiftDate } from '../timeline/model';
import { BADGE_FOR, buildDay, dayBounds, inBounds, type DayBounds, type DayEntry } from './model';
import './day.css';

const LOCALE: Record<Lang, string> = { en: 'en-GB', pl: 'pl-PL' };

/** Day-part names, copy CSV rows 48 to 54. */
const PART_NAME: Record<number, MessageKey> = {
  1: 'copy.48', 2: 'copy.49', 3: 'copy.50', 4: 'copy.51', 5: 'copy.52', 6: 'copy.53', 7: 'copy.54',
};
/** Tag after an item that was not simply given: "Refused" and "Half eaten". */
const STATE_TAG: Partial<Record<DayEntry['state'], MessageKey>> = { skipped: 'tagR', partial: 'copy.72' };

interface Loaded {
  items: Item[];
  entries: Entry[];
  events: HealthEvent[];
  bounds: DayBounds;
}

async function load(repository: Repository): Promise<Loaded> {
  const today = repository.today();
  const [items, entries, events] = await Promise.all([
    repository.listItems(),
    repository.listEntries({ to: today }),
    repository.listEvents({ to: today }),
  ]);
  return { items, entries, events, bounds: dayBounds(today, entries, events) };
}

interface Props {
  repository: Repository;
  date: PlainDate;
  onBack: () => void;
  onStep: (date: PlainDate) => void;
  /** The date is outside the records (before the first one or after today). */
  onInvalid: () => void;
}

/** Read-only Day view (slice 3a): everything logged on one date, by day part, plus the day's events. */
export function DayView({ repository, date, onBack, onStep, onInvalid }: Props) {
  const { lang, t } = useI18n();
  const [data, setData] = useState<Loaded | null>(null);

  useEffect(() => {
    let live = true;
    load(repository).then(
      (next) => live && setData(next),
      () => live && setData(null), // error state not designed yet
    );
    return () => {
      live = false;
    };
  }, [repository]);

  const valid = data ? inBounds(date, data.bounds) : true;
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

  const day = data && valid ? buildDay({ date, ...data }) : null;
  const today = repository.today();
  const sub = date === today ? t('sub') : date === shiftDate(today, -1) ? t('copy.114') : '';

  return (
    <section className="day" aria-labelledby="day-title">
      <div className="day__top">
        <button type="button" className="day-btn day-btn--back" onClick={onBack}>
          <Chevron dir="left" />
          {t('timeline')}
        </button>
      </div>

      <div className="day__head">
        <StepButton dir="prev" target={day ? day.prev : null} label={t('prevDay')} onStep={onStep} />
        <div className="day__titles" aria-live="polite">
          <h2 id="day-title" className="day__title">
            {title}
          </h2>
          {sub && <p className="day__sub">{sub}</p>}
        </div>
        <StepButton dir="next" target={day ? day.next : null} label={t('nextDay')} onStep={onStep} />
      </div>

      <div className="day__body">
        {day && day.events.count > 0 && (
          <>
            <h3 className="day__caption">{t('happened')}</h3>
            {day.events.visits.map((e) => (
              <article key={e.id} className="day-card">
                <h4 className="day-card__head">
                  <EventBadge kind="vet" text="" />
                  {`${t('visitWord')} · ${e.title}`}
                </h4>
                {e.detail && <p className="day-card__text">{e.detail}</p>}
              </article>
            ))}
            {day.events.symptoms.length > 0 && (
              <article className="day-card">
                <h4 className="day-card__head">
                  <EventBadge kind="sym" text="!" />
                  {t('kSym')}
                </h4>
                <dl className="day-card__rows">
                  {day.events.symptoms.map((e) => (
                    <div key={e.id} className="day-card__row">
                      <dt>{symptomLabel(e.title, t)}</dt>
                      <dd>{e.detail}</dd>
                    </div>
                  ))}
                </dl>
              </article>
            )}
            {day.events.others.map((e) => {
              const kind = BADGE_FOR[e.type];
              return (
                <article key={e.id} className="day-card">
                  <h4 className="day-card__head">
                    {kind && <EventBadge kind={kind} text={kind === 'front' ? 'F' : kind === 'worm' ? 'D' : ''} />}
                    {e.title}
                  </h4>
                  {e.detail && <p className="day-card__text">{e.detail}</p>}
                </article>
              );
            })}
          </>
        )}

        <h3 className="day__caption">{t('dayPartsTitle')}</h3>
        {day?.empty && (
          <div className="day-card day-empty">
            <span className="day-empty__icon" aria-hidden="true">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M12 6v6l3.5 2" />
                <circle cx="12" cy="12" r="9" />
              </svg>
            </span>
            {/* TODO(copy): `noData` mentions add buttons that the read-only slice does not have yet. */}
            <p className="day-empty__text">{t('noData')}</p>
          </div>
        )}
        {day && (
          <ul className="day-card day-parts">
            {day.parts.map((p) => (
              <li key={p.part} className={`day-part${p.meal ? ' day-part--meal' : ''}`}>
                <span className="day-part__icon" aria-hidden="true">
                  {p.meal ? <MealIcon part={p.part} size={26} /> : <span className={`day-part__dot${p.entries.length ? ' day-part__dot--any' : ''}`} />}
                </span>
                <div className="day-part__main">
                  <h4 className="day-part__name">{t(PART_NAME[p.part] ?? 'copy.48')}</h4>
                  {p.entries.length ? (
                    <ul className="day-part__items">
                      {p.entries.map((e) => {
                        const tag = STATE_TAG[e.state];
                        return (
                          <li key={e.id} className={`day-item day-item--${e.state}`}>
                            <span className="day-item__mark">
                              <DoseMark colour={e.colour} size={e.size} state={e.state} />
                            </span>
                            <span className="day-item__text">
                              <span className="day-item__name">{e.name}</span>
                              {e.doseText && <span className="day-item__dose"> · {e.doseText}</span>}
                            </span>
                            {tag && <span className={`day-tag day-tag--${e.state}`}>{t(tag)}</span>}
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <p className="day-part__none">{t('nothingSched')}</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
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
      <Chevron dir={dir === 'prev' ? 'left' : 'right'} />
    </button>
  );
}

function Chevron({ dir }: { dir: 'left' | 'right' }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={dir === 'left' ? 'M15 5l-7 7 7 7' : 'M9 5l7 7-7 7'} />
    </svg>
  );
}
