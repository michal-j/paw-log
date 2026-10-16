import { useMemo } from 'react';
import type { PlainDate, ScheduleSlot } from '../data';
import { DoseMark } from '../components/DoseMark';
import { ChevronIcon, PlusIcon } from '../components/icons';
import { MealIcon } from '../components/MealIcon';
import { fill, useI18n } from '../i18n';
import { useFormat } from '../log/format';
import { useLog } from '../log/LogProvider';
import { courseDay, usualDay } from '../log/plan';
import { MEAL_PARTS, markSize } from '../timeline/model';
import '../day/day.css';

/**
 * The usual day (schedule slots) as of a date: each part with its time and items, amounts and
 * courses. + adds an item to a part; tapping an item changes it from a date.
 */
export function UsualDay({ date, onBack }: { date: PlainDate; onBack: () => void }) {
  const { t } = useI18n();
  const f = useFormat();
  const { records, open } = useLog();

  const parts = useMemo(() => {
    if (!records) return null;
    const order = new Map(records.items.map((i, idx) => [i.id, idx]));
    const food = new Set(records.items.filter((i) => markSize(i) === 'food').map((i) => i.id));
    const cmp = (a: ScheduleSlot, b: ScheduleSlot) =>
      Number(food.has(b.itemId)) - Number(food.has(a.itemId)) || (order.get(a.itemId) ?? 0) - (order.get(b.itemId) ?? 0);
    return usualDay(records.slots, date, cmp);
  }, [records, date]);

  const items = new Map(records?.items.map((i) => [i.id, i]) ?? []);

  return (
    <section className="day" aria-labelledby="usual-title">
      <div className="day__top">
        <button type="button" className="day-btn day-btn--back" onClick={onBack}>
          <ChevronIcon dir="left" size={18} />
          {t('back')}
        </button>
      </div>
      <div className="usual__head">
        <p className="usual__asof">{fill(t('asOf'), { d: f.dayMonth(date) })}</p>
        <h2 id="usual-title" className="usual__title">
          {t('usualDay')}
        </h2>
        <p className="usual__hint">{t('usualHint')}</p>
      </div>
      <div className="day__body">
        <ul className="day-card day-parts usual__parts">
          {parts?.map(({ part, rows }) => (
            <li key={part} className={`day-part${MEAL_PARTS.has(part) ? ' day-part--meal' : ''}`}>
              <div className="day-part__head">
                <span className="day-part__icon" aria-hidden="true">
                  {MEAL_PARTS.has(part) ? <MealIcon part={part} size={26} /> : <span className={`day-part__dot${rows.length ? ' day-part__dot--any' : ''}`} />}
                </span>
                <h3 className="day-part__name">
                  {f.part(part)} <span className="day-part__time">· {records?.times[part]}</span>
                </h3>
                <button
                  type="button"
                  className="part-add"
                  aria-label={`${t('addAria')}${f.part(part)}`}
                  onClick={() => open({ kind: 'slot', date, part })}
                >
                  <span>
                    <PlusIcon />
                  </span>
                </button>
              </div>
              {rows.length ? (
                <ul className="day-part__items">
                  {rows.map(({ slot, upcoming, next }) => {
                    const item = items.get(slot.itemId);
                    const amount = slot.amount !== null && slot.unit ? f.amount(slot.amount, slot.unit, item?.conversion) : '';
                    const course = courseDay(slot, date);
                    const sub = upcoming
                      ? fill(t('fromD'), { d: f.dayMonth(slot.activeFrom), x: '' }).replace(/:\s*$/, '')
                      : [
                          course && slot.activeTo
                            ? `${fill(t('dayNofM'), course)}, ${fill(t('untilD'), { d: f.dayMonth(slot.activeTo) })}`
                            : slot.activeTo
                              ? fill(t('untilD'), { d: f.dayMonth(slot.activeTo) })
                              : '',
                          next && next.amount !== null && next.unit
                            ? fill(t('fromD'), { d: f.dayMonth(next.activeFrom), x: f.amount(next.amount, next.unit, item?.conversion) })
                            : '',
                        ]
                          .filter(Boolean)
                          .join(' · ');
                    return (
                      <li key={slot.id} className="day-item">
                        <button type="button" className="day-item__open" onClick={() => open({ kind: 'slot', date, part, slot })}>
                          <span className="day-item__mark">
                            <DoseMark colour={item?.colour ?? 'mark-neutral'} size={item ? markSize(item) : 'small'} state={upcoming ? 'planned' : 'given'} />
                          </span>
                          <span className="day-item__text">
                            <span className="day-item__name">{f.name(item?.name ?? slot.itemId, slot.flavour)}</span>
                            {amount && <span className="day-item__dose"> · {amount}</span>}
                            {sub && <span className="day-item__sub">{sub}</span>}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="day-part__none">{t('nothingSched')}</p>
              )}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
