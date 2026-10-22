import type { ReactNode } from 'react';
import type { Condition, DocFile, HealthEvent, Photo } from '../data';
import { EventBadge } from '../components/EventBadge';
import { DotsIcon } from '../components/icons';
import { fill, useI18n } from '../i18n';
import { useFormat } from '../log/format';
import { serviceLabel } from '../log/services';
import { symptomDetail } from '../log/symptoms';
import { ConditionTags } from '../tracked/ConditionTag';
import { PhotoThumb } from '../photos/PhotoParts';
import { FileList } from '../documents/FileRow';
import { StoredFileRow } from '../documents/StoredFileRow';
import { symptomLabel } from '../timeline/labels';
import { BADGE_FOR } from './model';

/**
 * One event as a card (Day view "What happened", condition history). Without tags or photos the whole
 * card is the button that opens the event; with condition tags or photos the head and text open it
 * and each tag and photo is its own target (a button cannot hold buttons). `onEdit` null: nothing
 * to edit. Photos show as 72px thumbnails (52px with `smallPhotos`) that open the viewer:
 * below the text, on a vet visit to the right of it. PDFs (JCB-76) are rows under the text and photos,
 * above the tags; a tap on a row opens the PDF in the phone's viewer.
 */
export function EventCard({
  event: e,
  tags = [],
  photos = [],
  docs = [],
  smallPhotos = false,
  onEdit,
  onOpenCondition,
  onViewPhoto,
}: {
  event: HealthEvent;
  tags?: Condition[];
  photos?: Photo[];
  docs?: DocFile[];
  smallPhotos?: boolean;
  onEdit: (() => void) | null;
  onOpenCondition: (id: string) => void;
  onViewPhoto?: (photoId: string) => void;
}) {
  const { t } = useI18n();
  const f = useFormat();
  let content: ReactNode;
  if (e.type === 'vet') {
    content = (
      <>
        <span className="day-card__head">
          <EventBadge kind="vet" text="" />
          {e.title ? `${t('visitWord')} · ${e.title}` : t('copy.101')}
        </span>
        {e.detail && <span className="day-card__text">{e.detail}</span>}
        {e.alsoDone && e.alsoDone.length > 0 && (
          <span className="day-card__chips">
            {e.alsoDone.map((a) => (
              <span key={a} className="day-card__chip">
                {serviceLabel(a, t)}
              </span>
            ))}
          </span>
        )}
      </>
    );
  } else if (e.type === 'symptom') {
    const detail = symptomDetail(e, t);
    content = (
      <>
        <span className="day-card__head">
          <EventBadge kind="sym" text="!" />
          {symptomLabel(e.title, t)}
        </span>
        {detail && <span className="day-card__text">{detail}</span>}
      </>
    );
  } else {
    const kind = BADGE_FOR[e.type];
    content = (
      <>
        <span className="day-card__head">
          {kind ? (
            <EventBadge kind={kind} text={kind === 'front' ? 'F' : kind === 'worm' ? 'D' : ''} />
          ) : (
            <span className="day-card__glyph" aria-hidden="true">
              <DotsIcon />
            </span>
          )}
          {f.eventTitle(e)}
        </span>
        {e.detail && <span className="day-card__text">{e.detail}</span>}
      </>
    );
  }

  if (!tags.length && !photos.length && !docs.length) {
    return onEdit ? (
      <button type="button" className="day-card day-card--tap" onClick={onEdit}>
        {content}
      </button>
    ) : (
      <article className="day-card">{content}</article>
    );
  }
  const side = e.type === 'vet';
  const photoRow = photos.length > 0 && (
    <div className={side ? 'photo-row photo-row--side' : 'photo-row'}>
      {photos.map((p) => (
        <PhotoThumb
          key={p.id}
          photo={p}
          size={smallPhotos ? 'sm' : 'md'}
          label={fill(t('photoAlt'), { d: f.shortDate(e.date) })}
          onOpen={onViewPhoto ? () => onViewPhoto(p.id) : undefined}
        />
      ))}
    </div>
  );
  const open = onEdit ? (
    <button type="button" className="ev-card__open" onClick={onEdit}>
      {content}
    </button>
  ) : (
    <div className="ev-card__static">{content}</div>
  );
  return (
    <div className="day-card ev-card">
      {/* A vet visit's photos sit to the right of its text, so a photo adds no height. */}
      {side && photoRow ? (
        <div className="ev-card__side">
          {open}
          {photoRow}
        </div>
      ) : (
        <>
          {open}
          {photoRow}
        </>
      )}
      {docs.length > 0 && (
        <FileList variant="card">
          {docs.map((d) => (
            <StoredFileRow key={d.id} doc={d} mode="card" />
          ))}
        </FileList>
      )}
      <ConditionTags conditions={tags} onOpen={onOpenCondition} />
    </div>
  );
}
