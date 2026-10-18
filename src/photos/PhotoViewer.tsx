import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
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
/** Zoom limits, and the level a double tap jumps to. */
const MAX_ZOOM = 5;
const TAP_ZOOM = 2.5;
/** Two taps within this many ms and px count as a double tap; a press that moves more is not a tap. */
const DOUBLE_TAP_MS = 300;
const TAP_SLOP_PX = 12;

/** The photo's zoom: scale, and its offset (px) from the middle of the stage. */
type Zoom = { s: number; x: number; y: number };
const NO_ZOOM: Zoom = { s: 1, x: 0, y: 0 };
type Pt = { x: number; y: number };

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
    // Capture phase, and stopped: a sheet underneath (the viewer opens over it) must not also close on this Escape.
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || (onStep && (e.key === 'ArrowLeft' || e.key === 'ArrowRight'))) e.stopPropagation();
      onKey(e);
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [onClose, onStep]);
  return ref;
}

/** The full picture; the small copy stands in while it loads. */
function FullImage({ photo, alt, className, style }: { photo: Photo; alt: string; className?: string; style?: CSSProperties }) {
  const full = usePhotoUrl(photo, 'full');
  const thumb = usePhotoUrl(photo, 'thumb');
  const src = full ?? thumb;
  return src ? (
    <img className={className} style={style} src={src} alt={alt} draggable={false} />
  ) : (
    <span className={className ?? 'viewer__placeholder'} style={style} role="img" aria-label={alt} />
  );
}

/**
 * PhotoViewer (design 14/15, JCB-83): full screen, the picture on black. Pinch, double tap or the wheel zoom; one finger pans a zoomed photo. "2 of 3" and Close on top; swipe, the arrow
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
  // The zoom belongs to the photo it was made on (`at`): another photo starts unzoomed.
  const [held, setHeld] = useState<{ z: Zoom; at: number }>({ z: NO_ZOOM, at: i });
  const zoomRef = useRef(held);
  const zoom = held.at === i ? held.z : NO_ZOOM;
  const cur = () => (zoomRef.current.at === i ? zoomRef.current.z : NO_ZOOM);
  const stageRef = useRef<HTMLDivElement>(null);
  const pointers = useRef(new Map<number, Pt>());
  /** What the current gesture started from: a pinch (distance, middle), a pan (finger), or a possible tap. */
  const gesture = useRef<{ d0: number; z0: Zoom; m0: Pt; p0: Pt; moved: boolean } | null>(null);
  const lastTap = useRef<{ t: number; x: number; y: number } | null>(null);
  const setZoom = (z: Zoom) => {
    zoomRef.current = { z, at: i };
    setHeld(zoomRef.current);
  };
  /** Keeps the picture covering the stage: no panning past its edges, no zoom below 1 or above the limit. */
  const clampZoom = (z: Zoom): Zoom => {
    const s = Math.min(MAX_ZOOM, Math.max(1, z.s));
    if (s <= 1.001) return NO_ZOOM;
    const stage = stageRef.current;
    const img = stage?.querySelector<HTMLElement>('[data-current] img');
    if (!stage || !img) return { s, x: 0, y: 0 };
    const mx = Math.max(0, (img.offsetWidth * s - stage.clientWidth) / 2);
    const my = Math.max(0, (img.offsetHeight * s - stage.clientHeight) / 2);
    return { s, x: Math.min(mx, Math.max(-mx, z.x)), y: Math.min(my, Math.max(-my, z.y)) };
  };
  /** A point in the stage, measured from its middle (the zoom's origin). */
  const fromCentre = (p: Pt): Pt => {
    const r = stageRef.current?.getBoundingClientRect();
    return { x: p.x - ((r?.left ?? 0) + (r?.width ?? 0) / 2), y: p.y - ((r?.top ?? 0) + (r?.height ?? 0) / 2) };
  };
  /** Zoom to `s` keeping the picture point under `at` (from the middle) where it is. */
  const zoomAt = (from: Zoom, s: number, at: Pt): Zoom => {
    const k = Math.min(MAX_ZOOM, Math.max(1, s)) / from.s;
    return clampZoom({ s: from.s * k, x: at.x - (at.x - from.x) * k, y: at.y - (at.y - from.y) * k });
  };
  // Trackpad pinch and the mouse wheel zoom on a desktop. Not passive: a pinch must not zoom the page.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const z = cur();
      setZoom(zoomAt(z, z.s * Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.002)), fromCentre({ x: e.clientX, y: e.clientY })));
    };
    stage.addEventListener('wheel', onWheel, { passive: false });
    return () => stage.removeEventListener('wheel', onWheel);
  });
  // A photo deleted while shown (from another phone, say): close when nothing is left.
  useEffect(() => {
    if (records && !items.length) setOverlay(null);
  });
  const item = items[i];
  if (!records || !item) return null;

  const mid = (): Pt => {
    const [a, b] = [...pointers.current.values()] as [Pt, Pt];
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  };
  const gap = () => {
    const [a, b] = [...pointers.current.values()] as [Pt, Pt];
    return Math.hypot(a.x - b.x, a.y - b.y) || 1;
  };
  const begin = (p0: Pt) => {
    const two = pointers.current.size > 1;
    gesture.current = { d0: two ? gap() : 1, z0: cur(), m0: two ? fromCentre(mid()) : p0, p0, moved: false };
  };
  const onDown = (e: ReactPointerEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    begin({ x: e.clientX, y: e.clientY });
    if (pointers.current.size > 1) setDrag(null); // two fingers pinch; they never swipe
    else if (cur().s <= 1) setDrag({ x: e.clientX, dx: 0, id: e.pointerId });
  };
  const onMove = (e: ReactPointerEvent) => {
    const g = gesture.current;
    if (!pointers.current.has(e.pointerId) || !g) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (Math.hypot(e.clientX - g.p0.x, e.clientY - g.p0.y) > TAP_SLOP_PX) g.moved = true;
    if (pointers.current.size > 1) {
      g.moved = true;
      const m = fromCentre(mid());
      const k = Math.min(MAX_ZOOM, Math.max(1, g.z0.s * (gap() / g.d0))) / g.z0.s;
      // The picture point that was between the fingers stays between them.
      setZoom(clampZoom({ s: g.z0.s * k, x: m.x - (g.m0.x - g.z0.x) * k, y: m.y - (g.m0.y - g.z0.y) * k }));
    } else if (g.z0.s > 1) {
      setZoom(clampZoom({ s: g.z0.s, x: g.z0.x + e.clientX - g.p0.x, y: g.z0.y + e.clientY - g.p0.y }));
    } else if (drag && drag.id === e.pointerId) {
      setDrag({ ...drag, dx: e.clientX - drag.x });
    }
  };
  const onUp = (e: ReactPointerEvent) => {
    const g = gesture.current;
    if (!pointers.current.delete(e.pointerId)) return;
    if (pointers.current.size > 0) {
      // One finger left after a pinch: carry on panning from where it is.
      const [p] = [...pointers.current.values()] as [Pt];
      begin(p);
      if (gesture.current) gesture.current.moved = true;
      return;
    }
    gesture.current = null;
    if (g && !g.moved) {
      const now = Date.now();
      const prev = lastTap.current;
      if (prev && now - prev.t < DOUBLE_TAP_MS && Math.hypot(e.clientX - prev.x, e.clientY - prev.y) < TAP_SLOP_PX * 3) {
        lastTap.current = null;
        const z = cur();
        setZoom(z.s > 1 ? NO_ZOOM : zoomAt(z, TAP_ZOOM, fromCentre({ x: e.clientX, y: e.clientY })));
        setDrag(null);
        return;
      }
      lastTap.current = { t: now, x: e.clientX, y: e.clientY };
    }
    if (drag && cur().s <= 1) {
      if (drag.dx < -SWIPE_PX) step(1);
      else if (drag.dx > SWIPE_PX) step(-1);
    }
    setDrag(null);
  };
  const onCancel = (e: ReactPointerEvent) => {
    pointers.current.delete(e.pointerId);
    gesture.current = null;
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
      <div ref={stageRef} className="viewer__stage" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onCancel}>
        <div
          className={`viewer__track${drag ? ' viewer__track--drag' : ''}`}
          style={{ transform: `translateX(calc(${-i * 100}% + ${drag?.dx ?? 0}px))` }}
        >
          {items.map((x, n) => (
            <div key={x.photo.id} className="viewer__slide" data-current={n === i ? '' : undefined} aria-hidden={n === i ? undefined : true}>
              {/* Only the photo shown and its neighbours are loaded. */}
              {Math.abs(n - i) <= 1 && (
                <FullImage
                  photo={x.photo}
                  alt={altOf(x)}
                  style={n === i && zoom.s > 1 ? { transform: `translate(${zoom.x}px, ${zoom.y}px) scale(${zoom.s})` } : undefined}
                />
              )}
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
