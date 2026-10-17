import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import type { Photo, PlainDate } from '../data';
import { ChevronIcon } from '../components/icons';
import { fill, useI18n } from '../i18n';
import { LOCALE, useFormat } from '../log/format';
import { useLog } from '../log/LogProvider';
import { parseDate } from '../timeline/model';
import { ConditionTags } from '../tracked/ConditionTag';
import { conditionsOf } from '../tracked/model';
import { conditionPhotos, photoCaption, type PhotoItem } from './model';
import { usePhotoUrl } from './usePhotoUrl';
import '../day/day.css';
import './photos.css';

/** A swipe this far (px) moves to the next or previous photo. */
const SWIPE_PX = 50;

/** "Sat, 10 October 2026" */
function useLongDate() {
  const { lang } = useI18n();
  return (d: PlainDate) =>
    new Intl.DateTimeFormat(LOCALE[lang], { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' }).format(
      parseDate(d),
    );
}

/** Close on Escape; the arrows step (viewer). Focus moves into the overlay and back when it closes. */
function useOverlayKeys(onClose: () => void, onStep?: (d: -1 | 1) => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    ref.current?.focus({ preventScroll: true });
    return () => before?.focus?.({ preventScroll: true });
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (onStep && e.key === 'ArrowLeft') onStep(-1);
      else if (onStep && e.key === 'ArrowRight') onStep(1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, onStep]);
  return ref;
}

/** The full picture; the small copy stands in while it loads. */
function FullImage({ photo, alt, className }: { photo: Photo; alt: string; className?: string }) {
  const full = usePhotoUrl(photo, 'full');
  const thumb = usePhotoUrl(photo, 'thumb');
  const src = full ?? thumb;
  return src ? <img className={className} src={src} alt={alt} draggable={false} /> : <span className={className} role="img" aria-label={alt} />;
}

/**
 * PhotoViewer (design 14/15): full screen and light. "2 of 3" and Close on top; swipe, the arrow
 * buttons or the keyboard arrows page through `ids` (a condition's photos, or a day's); below the
 * photo its full date, description, condition tags, Open day and Edit.
 */
export function PhotoViewer({
  ids,
  index,
  onShowDay,
  onOpenCondition,
}: {
  ids: string[];
  index: number;
  onShowDay: (date: PlainDate) => void;
  onOpenCondition: (id: string) => void;
}) {
  const { t } = useI18n();
  const longDate = useLongDate();
  const { records, setOverlay, open } = useLog();
  const close = () => setOverlay(null);
  const items: PhotoItem[] = [];
  for (const id of ids) {
    const photo = records?.photos.find((p) => p.id === id);
    const event = photo && records?.events.find((e) => e.id === photo.eventId);
    if (photo && event) items.push({ photo, event });
  }
  const i = Math.min(index, items.length - 1);
  const step = (d: -1 | 1) => {
    const next = i + d;
    if (next >= 0 && next < items.length) setOverlay({ kind: 'viewer', ids, index: next });
  };
  const ref = useOverlayKeys(close, step);
  const [drag, setDrag] = useState<{ x: number; dx: number; id: number } | null>(null);
  // A photo deleted while shown (from another phone, say): close when nothing is left.
  useEffect(() => {
    if (records && !items.length) setOverlay(null);
  });
  const item = items[i];
  if (!records || !item) return null;

  const onDown = (e: ReactPointerEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    setDrag({ x: e.clientX, dx: 0, id: e.pointerId });
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  };
  const onMove = (e: ReactPointerEvent) => drag && drag.id === e.pointerId && setDrag({ ...drag, dx: e.clientX - drag.x });
  const onUp = () => {
    if (!drag) return;
    if (drag.dx < -SWIPE_PX) step(1);
    else if (drag.dx > SWIPE_PX) step(-1);
    setDrag(null);
  };
  const caption = photoCaption(item);
  const altOf = (x: PhotoItem) => photoCaption(x) || fill(t('photoAlt'), { d: longDate(x.event.date) });
  const tags = conditionsOf(item.event, records.conditions);

  return (
    <div ref={ref} className="viewer" role="dialog" aria-modal="true" aria-label={fill(t('photoAlt'), { d: longDate(item.event.date) })} tabIndex={-1}>
      <div className="viewer__bar">
        <p className="viewer__pos" aria-live="polite">
          {fill(t('photoIofN'), { i: i + 1, n: items.length })}
        </p>
        <button type="button" className="sheet__close" onClick={close}>
          {t('close')}
        </button>
      </div>
      <div className="viewer__stage" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={() => setDrag(null)}>
        <div
          className={`viewer__track${drag ? ' viewer__track--drag' : ''}`}
          style={{ transform: `translateX(calc(${-i * 100}% + ${drag?.dx ?? 0}px))` }}
        >
          {items.map((x, n) => (
            <div key={x.photo.id} className="viewer__slide" aria-hidden={n === i ? undefined : true}>
              {/* Only the photo shown and its neighbours are loaded. */}
              {Math.abs(n - i) <= 1 && <FullImage photo={x.photo} alt={altOf(x)} />}
            </div>
          ))}
        </div>
        {items.length > 1 && (
          <>
            <button
              type="button"
              className="day-btn day-btn--step viewer__step viewer__step--prev"
              aria-label={t('photoPrev')}
              aria-disabled={i === 0 || undefined}
              onClick={() => step(-1)}
            >
              <ChevronIcon dir="left" size={18} />
            </button>
            <button
              type="button"
              className="day-btn day-btn--step viewer__step viewer__step--next"
              aria-label={t('photoNext')}
              aria-disabled={i === items.length - 1 || undefined}
              onClick={() => step(1)}
            >
              <ChevronIcon dir="right" size={18} />
            </button>
          </>
        )}
      </div>
      <div className="viewer__info">
        <p className="viewer__date">{longDate(item.event.date)}</p>
        {caption && <p className="viewer__caption">{caption}</p>}
        <ConditionTags
          conditions={tags}
          onOpen={(id) => {
            close();
            onOpenCondition(id);
          }}
        />
        <div className="viewer__links">
          <button
            type="button"
            className="link-btn"
            onClick={() => {
              close();
              onShowDay(item.event.date);
            }}
          >
            {t('photoOpenDay')}
          </button>
          <button
            type="button"
            className="link-btn"
            onClick={() => {
              close();
              open({ kind: 'photo', date: item.event.date, photo: item.photo });
            }}
          >
            {t('condEdit')}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Compare (design 16): a condition's first and latest photo, one above the other at the same size;
 * each has steppers to pick another of its photos.
 */
export function PhotoCompare({ condition }: { condition: string }) {
  const { t } = useI18n();
  const f = useFormat();
  const longDate = useLongDate();
  const { records, setOverlay } = useLog();
  const close = () => setOverlay(null);
  const ref = useOverlayKeys(close);
  const items = records ? conditionPhotos(condition, records.events, records.photos) : [];
  const [picks, setPicks] = useState<{ a: number; b: number } | null>(null);
  const c = records?.conditions.find((x) => x.id === condition);
  useEffect(() => {
    if (records && (!c || items.length < 2)) setOverlay(null);
  });
  if (!records || !c || items.length < 2) return null;
  const last = items.length - 1;
  const a = Math.min(picks?.a ?? 0, last);
  const b = Math.min(picks?.b ?? last, last);

  const figure = (k: 'a' | 'b', at: number) => {
    const x = items[at] as PhotoItem;
    const which = k === 'a' ? (at === 0 ? t('photoFirst') : f.dayMonth(x.event.date)) : at === last ? t('photoLatest') : f.dayMonth(x.event.date);
    const move = (d: -1 | 1) => {
      const next = at + d;
      if (next >= 0 && next <= last) setPicks({ a, b, [k]: next });
    };
    return (
      <figure className="compare__item">
        <FullImage className="compare__img" photo={x.photo} alt={photoCaption(x) || fill(t('photoAlt'), { d: longDate(x.event.date) })} />
        <figcaption className="compare__cap">
          <span>
            <span className="compare__which">{which}</span>
            <br />
            <span className="compare__date">{longDate(x.event.date)}</span>
          </span>
          <span className="compare__steps">
            <button type="button" className="day-btn day-btn--step" aria-label={t('photoPrev')} aria-disabled={at === 0 || undefined} onClick={() => move(-1)}>
              <ChevronIcon dir="left" size={18} />
            </button>
            <button type="button" className="day-btn day-btn--step" aria-label={t('photoNext')} aria-disabled={at === last || undefined} onClick={() => move(1)}>
              <ChevronIcon dir="right" size={18} />
            </button>
          </span>
        </figcaption>
      </figure>
    );
  };

  return (
    <div ref={ref} className="viewer" role="dialog" aria-modal="true" aria-label={`${t('photoCompare')} · ${c.name}`} tabIndex={-1}>
      <div className="viewer__bar">
        <p className="viewer__pos">{`${t('photoCompare')} · ${c.name}`}</p>
        <button type="button" className="sheet__close" onClick={close}>
          {t('close')}
        </button>
      </div>
      <div className="compare__body">
        {figure('a', a)}
        {figure('b', b)}
      </div>
    </div>
  );
}
