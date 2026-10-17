import type { ReactNode } from 'react';
import type { Condition, HealthEvent } from '../data';
import { EventBadge } from '../components/EventBadge';
import { DotsIcon, NoteIcon } from '../components/icons';
import { useI18n, type MessageKey } from '../i18n';
import { useFormat } from '../log/format';
import { symptomDetail } from '../log/symptoms';
import { ConditionTags } from '../tracked/ConditionTag';
import { symptomLabel } from '../timeline/labels';
import { BADGE_FOR } from './model';

const ALSO_LABEL: Record<string, MessageKey> = { anal_glands: 'label.117', nails: 'label.118' };

/**
 * One event as a card (Day view "What happened", condition history). Without tags the whole card is
 * the button that opens the event; with condition tags the head and text open it and each tag is its
 * own target (a button cannot hold buttons). `onEdit` null: the event has no form yet (photos).
 */
export function EventCard({
  event: e,
  tags = [],
  onEdit,
  onOpenCondition,
}: {
  event: HealthEvent;
  tags?: Condition[];
  onEdit: (() => void) | null;
  onOpenCondition: (id: string) => void;
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
                {t(ALSO_LABEL[a] ?? 'other')}
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
              {e.type === 'note' ? <NoteIcon /> : <DotsIcon />}
            </span>
          )}
          {f.eventTitle(e)}
        </span>
        {e.detail && <span className="day-card__text">{e.detail}</span>}
      </>
    );
  }

  if (!tags.length) {
    return onEdit ? (
      <button type="button" className="day-card day-card--tap" onClick={onEdit}>
        {content}
      </button>
    ) : (
      <article className="day-card">{content}</article>
    );
  }
  return (
    <div className="day-card ev-card">
      {onEdit ? (
        <button type="button" className="ev-card__open" onClick={onEdit}>
          {content}
        </button>
      ) : (
        <div className="ev-card__static">{content}</div>
      )}
      <ConditionTags conditions={tags} onOpen={onOpenCondition} />
    </div>
  );
}
