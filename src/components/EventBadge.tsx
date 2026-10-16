import type { BadgeKind } from '../timeline/model';
import './marks.css';

/**
 * The chip that marks a health event on a day (docs/design-system/components/EventBadge).
 * One component for every place; the consumer gives the kind and the text (count, "!", "F", "D").
 */
export function EventBadge({ kind, text, mini = false }: { kind: BadgeKind; text: string; mini?: boolean }) {
  return (
    <span className={`event-badge event-badge--${kind}${mini ? ' event-badge--mini' : ''}`} aria-hidden="true">
      {kind === 'vet' && (
        <svg className="event-badge__glyph" viewBox="0 0 12 12">
          <path d="M4.5 1h3v3.5H11v3H7.5V11h-3V7.5H1v-3h3.5z" fill="currentColor" />
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
