import type { Condition } from '../data';
import { ChevronIcon, PlusIcon, TrackedIcon } from '../components/icons';
import { fill, useI18n, type MessageKey } from '../i18n';
import { useFormat } from '../log/format';
import { useLog } from '../log/LogProvider';
import { pluralForm } from '../i18n/plural';
import { eventCount, openConditions, resolvedConditions } from './model';
import { conditionPhotos } from '../photos/model';
import { PhotoThumb } from '../photos/PhotoParts';
import '../day/day.css';
import '../components/list.css';
import './tracked.css';

const EVENTS: Record<'one' | 'few' | 'many', MessageKey> = { one: 'condEvents_one', few: 'condEvents_few', many: 'condEvents_many' };
const PHOTOS: Record<'one' | 'few' | 'many', MessageKey> = { one: 'photoCount_one', few: 'photoCount_few', many: 'photoCount_many' };

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
    const p = records ? conditionPhotos(c.id, records.events, records.photos).length : 0;
    return [when, p ? fill(t(PHOTOS[pluralForm(lang, p)]), { n: p }) : '', n ? fill(t(EVENTS[pluralForm(lang, n)]), { n }) : '']
      .filter(Boolean)
      .join(' · ');
  };
  const latest = (c: Condition) => (records ? conditionPhotos(c.id, records.events, records.photos).at(-1)?.photo : undefined);
  const card = (c: Condition, last = latest(c)) => (
    <button key={c.id} type="button" className={`day-card day-card--tap cond-card${c.resolvedOn ? ' cond-card--resolved' : ''}`} onClick={() => onOpen(c.id)}>
      <span className="cond-card__text">
        <span className="day-card__head">{c.name}</span>
        <span className="cond-card__meta">{meta(c)}</span>
      </span>
      {last && <PhotoThumb photo={last} size="sm" />}
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
            {opened.map((c) => card(c))}
          </>
        )}
        {resolved.length > 0 && (
          <>
            <h3 className="day__caption">{t('condResolvedSection')}</h3>
            {resolved.map((c) => card(c))}
          </>
        )}
      </div>
    </section>
  );
}
