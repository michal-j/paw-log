import type { BadgeKind } from '../timeline/model';
import './marks.css';

/**
 * The chip that marks a health event on a day (docs/design-system/components/EventBadge).
 * One component for every place; the consumer gives the kind and the text (count, "!", "F", "D", "+N").
 */
export function EventBadge({ kind, text, mini = false }: { kind: BadgeKind; text: string; mini?: boolean }) {
  return (
    <span className={`event-badge event-badge--${kind}${mini ? ' event-badge--mini' : ''}`} aria-hidden="true">
      {kind === 'vet' && (
        <svg className="event-badge__glyph event-badge__glyph--lg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 12.5h5l2.5-7 4.5 14 2.5-7H22" />
        </svg>
      )}
      {kind === 'note' && (
        <svg className="event-badge__glyph event-badge__glyph--lg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5.5 3h9L19 7.5V21H5.5z" />
          <path d="M9 12h6M9 16h6" />
        </svg>
      )}
      {kind === 'photo' && (
        <svg className="event-badge__glyph event-badge__glyph--photo" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinejoin="round">
          <path d="M3 8h4l2-3h6l2 3h4v12H3z" />
          <circle cx="12" cy="13.5" r="3.5" />
        </svg>
      )}
      {text}
    </span>
  );
}
