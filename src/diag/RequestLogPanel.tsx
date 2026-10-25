import { useState, useSyncExternalStore } from 'react';
import { Field } from '../components/Sheet';
import { useI18n, type MessageKey } from '../i18n';
import { clearDiag, diagRows, subscribeDiag, type AppEvent, type DiagRow, type Outcome } from './requestLog';
import './diag.css';

const APP: Record<AppEvent, MessageKey> = {
  start: 'diagStart',
  hidden: 'diagHidden',
  visible: 'diagVisible',
  online: 'diagOnline',
  offline: 'diagOffline',
};
const OUTCOME: Record<Exclude<Outcome, number>, MessageKey> = {
  timeout: 'diagTimeout',
  background: 'diagBackground',
  aborted: 'diagAborted',
  network: 'diagNetwork',
};

const pad = (n: number, w = 2) => String(n).padStart(w, '0');
const clock = (at: number) => {
  const d = new Date(at);
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`;
};
/** The newest rows show first; the rest on request, so a week of log does not make the Menu heavy. */
const SHOWN = 200;

/**
 * The activity log in the Menu (JCB-71, always on): newest first, one line per request, tap, toast
 * or app event. Copy puts the same lines on the clipboard to send to the developer.
 */
export function RequestLogPanel() {
  const { t } = useI18n();
  const rows = useSyncExternalStore(subscribeDiag, diagRows, diagRows);
  const [copied, setCopied] = useState(false);
  const [all, setAll] = useState(false);

  const line = (r: DiagRow): string => {
    if (r.kind === 'app') return `${clock(r.at)}  · ${t(APP[r.event])}`;
    if (r.kind === 'action') return `${clock(r.at)}  ${r.text}`;
    const outcome =
      r.outcome === undefined ? t('diagRunning') : typeof r.outcome === 'number' ? String(r.outcome) : t(OUTCOME[r.outcome]);
    const parts = [
      clock(r.at),
      `${r.method} ${r.what}`,
      r.attempt > 1 ? t('diagRetry') : '',
      r.ms !== undefined ? `${r.ms} ms` : '',
      outcome,
      r.via ?? '',
    ];
    return parts.filter(Boolean).join('  ');
  };
  const lines = [...rows].reverse().map(line);

  const copy = () => {
    void navigator.clipboard?.writeText(lines.join('\n')).then(
      () => setCopied(true),
      () => setCopied(false),
    );
  };

  return (
    <Field label={t('diagTitle')}>
      <p className="field__note">{t('diagHint')}</p>
      {lines.length ? (
        <ol className="diag-log" aria-label={t('diagTitle')}>
          {(all ? lines : lines.slice(0, SHOWN)).map((l, i) => (
            <li key={`${rows.length - i}-${l}`}>{l}</li>
          ))}
        </ol>
      ) : (
        <p className="field__note">{t('diagEmpty')}</p>
      )}
      {!all && lines.length > SHOWN && (
        <button type="button" className="btn btn--ghost btn--md" onClick={() => setAll(true)}>
          {t('showAll')} ({lines.length})
        </button>
      )}
      <div className="diag-actions">
        <button type="button" className="btn btn--ghost btn--md" onClick={copy} disabled={!lines.length}>
          {t(copied ? 'diagCopied' : 'diagCopy')}
        </button>
        <button
          type="button"
          className="btn btn--ghost btn--md"
          onClick={() => {
            clearDiag();
            setCopied(false);
          }}
          disabled={!lines.length}
        >
          {t('diagClear')}
        </button>
      </div>
    </Field>
  );
}
