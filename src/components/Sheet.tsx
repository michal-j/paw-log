import { useEffect, useId, useRef, type ReactNode } from 'react';
import { useI18n } from '../i18n';
import './controls.css';

/**
 * Bottom sheet (docs/design-system/components/Sheet): scrim, grabber, heading with Close, a body that
 * scrolls and an action row that stays. Escape and a tap on the scrim close it. Focus moves into the
 * sheet when it opens and back to where it was when it closes.
 */
export function Sheet({
  title,
  onClose,
  children,
  footer,
  onTitleTap,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  /** A tap on the heading (no visible affordance; the Menu uses it for a hidden switch). */
  onTitleTap?: () => void;
}) {
  const { t } = useI18n();
  const titleId = useId();
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    // preventScroll: the sheet starts below the fold (it rises in), and .app would scroll to it.
    ref.current?.focus({ preventScroll: true });
    return () => before?.focus?.({ preventScroll: true });
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="sheet-root">
      {/* The scrim closes on tap; keyboard and screen-reader users have Close and Escape. */}
      <div className="sheet-scrim" aria-hidden="true" onClick={onClose} />
      <section ref={ref} className="sheet" role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}>
        <div className="sheet__grab" aria-hidden="true">
          <span />
        </div>
        <header className="sheet__head">
          <h2 id={titleId} className="sheet__title" onClick={onTitleTap}>
            {title}
          </h2>
          <button type="button" className="sheet__close" onClick={onClose}>
            {t('close')}
          </button>
        </header>
        <div className="sheet__body">{children}</div>
        {footer && <div className="sheet__foot">{footer}</div>}
      </section>
    </div>
  );
}

/** A labelled block in a sheet: 12px label, optional hint on the right ("optional", "Usual: ½ can"). */
export function Field({
  label,
  hint,
  error,
  children,
  htmlFor,
  action,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
  htmlFor?: string;
  /** A small link button at the right of the label row ("Edit item"). */
  action?: ReactNode;
}) {
  const id = useId();
  return (
    <div className="field" role={htmlFor ? undefined : 'group'} aria-labelledby={htmlFor ? undefined : id}>
      <div className="field__label">
        {htmlFor ? (
          <label id={id} htmlFor={htmlFor}>
            {label}
          </label>
        ) : (
          <span id={id}>{label}</span>
        )}
        {hint && <span className="field__hint">{hint}</span>}
        {action}
      </div>
      {children}
      {error && (
        <p className="field__error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * Chip (docs/design-system/components/Chip). `mode="radio"` for a single choice inside a
 * `role="radiogroup"`, otherwise a toggle with aria-pressed.
 */
export function Chip({
  on,
  onClick,
  children,
  mode = 'radio',
  wide,
  label,
}: {
  on: boolean;
  onClick: () => void;
  children: ReactNode;
  mode?: 'radio' | 'toggle';
  /** Fraction chips: centred, at least 44px wide. */
  wide?: boolean;
  label?: string;
}) {
  const state = mode === 'radio' ? { role: 'radio', 'aria-checked': on } : { 'aria-pressed': on };
  return (
    <button type="button" className={`chip${wide ? ' chip--amount' : ''}`} {...state} aria-label={label} onClick={onClick}>
      {children}
    </button>
  );
}

export function Chips({ label, children, toggles }: { label?: string; children: ReactNode; toggles?: boolean }) {
  return (
    <div className="chips" role={toggles ? 'group' : 'radiogroup'} aria-label={label}>
      {children}
    </div>
  );
}
