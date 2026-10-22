import type { ReactNode } from 'react';
import { ChevronIcon, OpenOutIcon } from '../components/icons';
import { fill, useI18n, type MessageKey } from '../i18n';
import { pluralForm } from '../i18n/plural';
import { formatSize } from './model';
import './documents.css';

const PAGES: Record<'one' | 'few' | 'many', MessageKey> = { one: 'pages_one', few: 'pages_few', many: 'pages_many' };

/** "1,2 MB · 3 pages", or the size alone when the page count is not known. */
export function useDocMeta() {
  const { t, lang } = useI18n();
  return (sizeBytes: number, pageCount: number | null) => {
    const size = formatSize(sizeBytes);
    return pageCount ? `${size} · ${fill(t(PAGES[pluralForm(lang, pageCount)]), { n: pageCount })}` : size;
  };
}

export type FileState = 'ready' | 'uploading' | 'failed';

/**
 * FileRow: a PDF as a row (tile, name without ".pdf", one meta line, trailing glyph), its own 56px
 * target. `card`: under an event's text in the Day view and the condition history; `page`: in the
 * condition's Documents section, with the event's date at the right; `form`: in an event form, where
 * tapping edits the document and the meta line carries the upload state (progress bar, "Not sent." and
 * Retry). A tap on `card` and `page` rows opens the PDF in the phone's viewer (glyph: arrow out).
 */
export function FileRow({
  name,
  sizeBytes,
  pageCount,
  mode,
  date,
  state = 'ready',
  progress = 0,
  label,
  onPress,
  onRetry,
}: {
  name: string;
  sizeBytes: number;
  pageCount: number | null;
  mode: 'card' | 'page' | 'form';
  /** `page`: the date of the event the document is on ("14 Oct"). */
  date?: string;
  state?: FileState;
  /** 0 to 100 while `uploading`. */
  progress?: number;
  /** Accessible name of the button ("Open PDF Ultrasound report, 1,2 MB"). */
  label?: string;
  /** Absent: the row is only shown (the Add document sheet), not a button. */
  onPress?: () => void;
  onRetry?: () => void;
}) {
  const { t } = useI18n();
  const metaOf = useDocMeta();
  const pct = Math.max(0, Math.min(100, Math.round(progress)));
  let meta: ReactNode = <span className="file-row__meta">{metaOf(sizeBytes, pageCount)}</span>;
  if (state === 'uploading') {
    meta = (
      <>
        <span className="file-row__meta">{fill(t('docUploading'), { p: pct })}</span>
        <span className="file-bar" role="progressbar" aria-label={name} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
          <i style={{ ['--p' as string]: `${pct}%` }} />
        </span>
      </>
    );
  } else if (state === 'failed') {
    meta = <span className="file-row__meta file-row__meta--error">{t('docFailed')}</span>;
  }
  const glyph = !onPress || state !== 'ready' ? null : mode === 'form' ? <ChevronIcon size={16} /> : <OpenOutIcon />;
  const inside = (
    <>
      <span className="file-tile" aria-hidden="true">
        PDF
      </span>
      <span className="file-row__text">
        <span className="file-row__name">{name}</span>
        {meta}
      </span>
      {mode === 'page' && date && <span className="file-row__date">{date}</span>}
      {glyph && (
        <span className="file-row__go" aria-hidden="true">
          {glyph}
        </span>
      )}
    </>
  );
  return (
    <li>
      <div className="file">
        {onPress ? (
          <button type="button" className="file-row" aria-label={label} disabled={state === 'uploading'} onClick={onPress}>
            {inside}
          </button>
        ) : (
          <div className="file-row file-row--static">{inside}</div>
        )}
        {state === 'failed' && onRetry && (
          <button type="button" className="link-btn file__retry" onClick={onRetry}>
            {t('docRetry')}
          </button>
        )}
      </div>
    </li>
  );
}

/** FileList: FileRows divided by hairlines. `variant`: under a card's text, the Documents section's card, or a form field. */
export function FileList({ variant, label, children }: { variant: 'card' | 'page' | 'form'; label?: string; children: ReactNode }) {
  const cls = variant === 'card' ? 'file-list' : `file-list file-list--${variant}`;
  return (
    <ul className={cls} aria-label={label}>
      {children}
    </ul>
  );
}
