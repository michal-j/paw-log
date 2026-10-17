import { useEffect, useLayoutEffect, useRef } from 'react';
import type { HealthEvent, Photo, PlainDate } from '../data';
import { CameraIcon, ChevronIcon, PlusIcon, TrackedIcon } from '../components/icons';
import { EventCard } from '../day/EventCard';
import { eventKindOf } from '../log/EventSheet';
import { fill, useI18n } from '../i18n';
import * as act from '../log/actions';
import { useFormat } from '../log/format';
import { useLog } from '../log/LogProvider';
import { useBusy } from '../log/useBusy';
import { shiftDate } from '../timeline/model';
import { conditionsOf, historyGroups } from './model';
import { conditionPhotos, photosOf } from '../photos/model';
import { PhotoThumb } from '../photos/PhotoParts';
import '../day/day.css';
import '../components/list.css';
import './tracked.css';

/**
 * A tracked condition: status, name and description, then its linked events newest first under date
 * captions, with + Add (an event already linked), and Mark as resolved / Reopen at the end.
 */
export function ConditionPage({
  id,
  onBack,
  onMissing,
  onOpenCondition,
}: {
  id: string;
  onBack: () => void;
  /** The condition does not exist (deleted, or a stale link). */
  onMissing: () => void;
  onOpenCondition: (id: string) => void;
}) {
  const { t } = useI18n();
  const f = useFormat();
  const { records, version, open, run, repository, setOverlay } = useLog();
  const { busy, guard } = useBusy();
  const condition = records?.conditions.find((c) => c.id === id) ?? null;
  // Judge only on records loaded after the last write (a new condition is not in the older ones yet).
  const missing = !!records && records.version === version && !condition;
  useEffect(() => {
    if (missing) onMissing();
  }, [missing, onMissing]);
  if (!records || !condition) return <section className="day list" />;

  const today = records.today;
  const relDate = (d: PlainDate) => (d === today ? t('sub') : d === shiftDate(today, -1) ? t('copy.114') : f.shortDate(d));
  const status = condition.resolvedOn
    ? fill(t('condStatusResolved'), { a: f.dayMonth(condition.startedOn), b: f.dayMonth(condition.resolvedOn) })
    : fill(t('condStatusOpen'), { d: f.dayMonth(condition.startedOn) });
  const groups = historyGroups(id, records.events);
  const editEvent = (e: HealthEvent) => {
    if (e.type === 'photo') {
      const first = photosOf(e.id, records.photos)[0];
      return first ? () => open({ kind: 'photo', date: e.date, photo: first }) : null;
    }
    const kind = eventKindOf(e.type);
    return kind ? () => open({ kind: 'event', type: kind, date: e.date, event: e }) : null;
  };
  // Photos: oldest on the left, so time runs to the right; the viewer pages through them in that order.
  const photos = conditionPhotos(id, records.events, records.photos);
  const ids = photos.map((x) => x.photo.id);
  const view = (photoId: string) => setOverlay({ kind: 'viewer', ids, index: Math.max(0, ids.indexOf(photoId)) });
  const addPhoto = () => open({ kind: 'photo', date: today, linkTo: id });
  const reopen = guard(async () => {
    await run(() => act.saveCondition(repository, { ...condition, resolvedOn: null }, condition), t('condToastReopened'));
  });

  return (
    <section className="day list" aria-labelledby="cond-title">
      <div className="day__top cond__top">
        <button type="button" className="day-btn day-btn--back" onClick={onBack}>
          <ChevronIcon dir="left" size={18} />
          {t('copy.173')}
        </button>
        <button type="button" className="link-btn cond__edit" onClick={() => open({ kind: 'condition', condition })}>
          {t('condEdit')}
        </button>
      </div>
      <div className="usual__head">
        <p className={`usual__asof${condition.resolvedOn ? ' usual__asof--resolved' : ''}`}>{status}</p>
        <h2 id="cond-title" className="usual__title">
          {condition.name}
        </h2>
        {condition.description && <p className="cond__desc">{condition.description}</p>}
      </div>
      <div className="day__body">
        {(photos.length > 0 || !condition.resolvedOn) && (
          <div className="day__section">
            <h3 className="day__caption">{photos.length ? `${t('chips.109')} · ${photos.length}` : t('chips.109')}</h3>
            {photos.length > 1 && (
              <button type="button" className="day__link" onClick={() => setOverlay({ kind: 'compare', condition: id })}>
                {t('photoCompare')}
                <ChevronIcon />
              </button>
            )}
          </div>
        )}
        {photos.length > 0 ? (
          <PhotoStrip items={photos.map((x) => ({ photo: x.photo, date: x.event.date }))} onView={view} onAdd={addPhoto} />
        ) : (
          !condition.resolvedOn && (
            <div className="strip-empty">
              <PhotoPickTile onAdd={addPhoto} />
              <p className="strip-empty__text">{t('photoNone')}</p>
            </div>
          )
        )}
        <div className="day__section">
          <h3 className="day__caption">{t('condHistory')}</h3>
          <button
            type="button"
            className="day__link"
            aria-label={fill(t('condAddTo'), { x: condition.name })}
            onClick={() => open({ kind: 'add', date: today, condition: id })}
          >
            <PlusIcon size={12} />
            {t('label.172')}
          </button>
        </div>
        {groups.length ? (
          groups.map((g) => (
            <div key={g.date}>
              <p className="cond__group">{relDate(g.date)}</p>
              {g.events.map((e) => (
                <EventCard
                  key={e.id}
                  event={e}
                  tags={conditionsOf(e, records.conditions).filter((c) => c.id !== id)}
                  photos={photosOf(e.id, records.photos)}
                  smallPhotos
                  onEdit={editEvent(e)}
                  onOpenCondition={onOpenCondition}
                  onViewPhoto={view}
                />
              ))}
            </div>
          ))
        ) : (
          <article className="day-card day-empty">
            <span className="day-empty__icon" aria-hidden="true">
              <TrackedIcon active size={16} />
            </span>
            <p className="day-empty__text">{t('condNoEvents')}</p>
          </article>
        )}
        <div className="cond__end">
          {condition.resolvedOn ? (
            <button type="button" className="btn btn--ghost btn--lg" disabled={busy} onClick={() => void reopen()}>
              {t('condReopen')}
            </button>
          ) : (
            <button type="button" className="btn btn--ghost btn--lg" onClick={() => open({ kind: 'resolve', condition })}>
              {t('condMarkResolved')}
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

/** The Add photo tile of the strip: opens the photo form (already linked), whose tile opens the photo menu. */
function PhotoPickTile({ onAdd }: { onAdd: () => void }) {
  const { t } = useI18n();
  return (
    <button type="button" className="photo-pick photo-pick--tile" onClick={onAdd}>
      <span className="photo-pick__icon" aria-hidden="true">
        <CameraIcon size={16} />
      </span>
      {t('addPhoto')}
    </button>
  );
}

/** PhotoStrip: 104px thumbnails with their dates, oldest first, then Add photo; opens scrolled to the newest. */
function PhotoStrip({ items, onView, onAdd }: { items: { photo: Photo; date: PlainDate }[]; onView: (id: string) => void; onAdd: () => void }) {
  const { t } = useI18n();
  const f = useFormat();
  const ref = useRef<HTMLDivElement>(null);
  const count = items.length;
  useLayoutEffect(() => {
    const el = ref.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [count]);
  return (
    <div className="strip" ref={ref}>
      {items.map(({ photo, date }) => (
        <div key={photo.id} className="strip__item">
          <PhotoThumb photo={photo} size="lg" label={fill(t('photoAlt'), { d: f.shortDate(date) })} onOpen={() => onView(photo.id)} />
          <span className="strip__date">{f.dayMonth(date)}</span>
        </div>
      ))}
      <div className="strip__item">
        <PhotoPickTile onAdd={onAdd} />
        <span className="strip__date" aria-hidden="true">{'\u00a0'}</span>
      </div>
    </div>
  );
}
