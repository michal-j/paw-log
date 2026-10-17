import type { Condition } from '../data';
import { ChevronIcon, PlusIcon, TrackedIcon } from '../components/icons';
import { fill, useI18n, type MessageKey } from '../i18n';
import { useFormat } from '../log/format';
import { useLog } from '../log/LogProvider';
import { eventCount, openConditions, pluralForm, resolvedConditions } from './model';
import '../day/day.css';
import './tracked.css';

const EVENTS: Record<'one' | 'few' | 'many', MessageKey> = { one: 'condEvents_one', few: 'condEvents_few', many: 'condEvents_many' };

/** Tracked tab: open conditions (newest start first), then resolved ones. A card opens the condition. */
export function TrackedList({ onOpen }: { onOpen: (id: string) => void }) {
  const { t, lang } = useI18n();
  const f = useFormat();
  const { records, open } = useLog();
  const all = records?.conditions ?? [];
  const opened = openConditions(all);
  const resolved = resolvedConditions(all);
  const any = all.length > 0;
  const create = () => open({ kind: 'condition' });

  const meta = (c: Condition) => {
    const when = c.resolvedOn ? `${f.dayMonth(c.startedOn)} – ${f.dayMonth(c.resolvedOn)}` : fill(t('condSince'), { d: f.dayMonth(c.startedOn) });
    const n = records ? eventCount(c.id, records.events) : 0;
    return [when, n ? fill(t(EVENTS[pluralForm(n, lang)]), { n }) : ''].filter(Boolean).join(' · ');
  };
  const card = (c: Condition) => (
    <button key={c.id} type="button" className={`day-card day-card--tap cond-card${c.resolvedOn ? ' cond-card--resolved' : ''}`} onClick={() => onOpen(c.id)}>
      <span className="cond-card__text">
        <span className="day-card__head">{c.name}</span>
        <span className="cond-card__meta">{meta(c)}</span>
      </span>
      {/* JCB-7: the latest photo (52px PhotoThumb) goes here. */}
      <span className="cond-card__chev" aria-hidden="true">
        <ChevronIcon size={16} />
      </span>
    </button>
  );

  return (
    <section className="list" aria-labelledby="tracked-title">
      <div className="usual__head">
        {opened.length > 0 && <p className="usual__asof">{fill(t('condOpenCount'), { n: opened.length })}</p>}
        <div className="list__titlerow">
          <h2 id="tracked-title" className="usual__title">
            {t('condTitle')}
          </h2>
          {/* While the list is empty the empty card's button is the only "add" on screen. */}
          {any && (
            <button type="button" className="btn btn--ghost btn--md list__new" aria-label={t('trackNew')} onClick={create}>
              <span className="btn__icon">
                <PlusIcon />
              </span>
              {t('condNew')}
            </button>
          )}
        </div>
        <p className="usual__hint">{t('trackedHint')}</p>
      </div>
      <div className="day__body">
        {records && !any && (
          <article className="day-card day-empty">
            <span className="day-empty__icon" aria-hidden="true">
              <TrackedIcon active size={16} />
            </span>
            <div>
              <p className="day-empty__text">{t('condEmpty')}</p>
              <button type="button" className="btn btn--primary btn--md list-empty__btn" onClick={create}>
                <PlusIcon />
                {t('trackNew')}
              </button>
            </div>
          </article>
        )}
        {opened.length > 0 && (
          <>
            <h3 className="day__caption">{t('condOpenSection')}</h3>
            {opened.map(card)}
          </>
        )}
        {resolved.length > 0 && (
          <>
            <h3 className="day__caption">{t('condResolvedSection')}</h3>
            {resolved.map(card)}
          </>
        )}
      </div>
    </section>
  );
}
