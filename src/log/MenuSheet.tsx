import { useRef } from 'react';
import type { DayPart, PlainDate } from '../data';
import { ChevronIcon, RoutineIcon } from '../components/icons';
import { LangSwitch } from '../components/LangSwitch';
import { Field, Sheet } from '../components/Sheet';
import { useI18n } from '../i18n';
import { DAY_PARTS } from '../timeline/model';
import { useFormat } from './format';
import { useLog } from './LogProvider';
import { CommitInput } from './CommitInput';
import { isPlainDate } from '../day/model';
import { RequestLogPanel, useDiagEnabled } from '../diag/RequestLogPanel';
import { diagEnabled, setDiagEnabled } from '../diag/requestLog';

/** Taps on the Menu heading, this close together, that switch the request log on or off (JCB-71). */
const DIAG_TAPS = 5;
const DIAG_TAP_WINDOW_MS = 3000;

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * The menu from the header, on every screen: Usual day, the usual time of each day part (they decide
 * what "up to now" means today), the day the log starts on, language, and Sign out (real app) or
 * Reset demo data (demo).
 */
export function MenuSheet({
  onUsualDay,
  onSignOut,
  onResetDemo,
}: {
  onUsualDay: () => void;
  onSignOut?: () => void;
  onResetDemo?: () => void;
}) {
  const { t } = useI18n();
  const f = useFormat();
  const { records, repository, run, close, notify } = useLog();
  const diag = useDiagEnabled();
  const taps = useRef<number[]>([]);
  // The installed app has no address bar for ?diag=1, so five quick taps on the heading switch the log.
  const onTitleTap = () => {
    const now = Date.now();
    taps.current = [...taps.current.filter((at) => now - at < DIAG_TAP_WINDOW_MS), now];
    if (taps.current.length < DIAG_TAPS) return;
    taps.current = [];
    const on = !diagEnabled();
    setDiagEnabled(on);
    notify(t(on ? 'diagOnToast' : 'diagOffToast'));
  };

  // Saved on commit (blur, Enter, picker closed), one write at a time through `run`.
  const saveTime = (part: DayPart, value: string) => {
    const before = records?.times[part];
    if (!before) return false;
    return run(async () => {
      await repository.saveDayPartTime(part, value);
      return () => repository.saveDayPartTime(part, before);
    }, t('toastSaved'));
  };
  const saveLogStart = (value: PlainDate) => {
    if (!records) return false;
    const before = records.settings;
    return run(async () => {
      await repository.saveSettings({ ...before, logStart: value });
      return () => repository.saveSettings(before);
    }, t('toastSaved'));
  };

  return (
    <Sheet title={t('menu')} onClose={close} onTitleTap={onTitleTap}>
      <ul className="menu-list">
        <li>
          <button type="button" className="menu-row" onClick={onUsualDay}>
            <RoutineIcon />
            <span className="menu-row__text">{t('usualDay')}</span>
            <ChevronIcon />
          </button>
        </li>
      </ul>
      <Field label={t('dayPartsTitle')}>
        <ul className="menu-times">
          {DAY_PARTS.map((p) => (
            <li key={p} className="menu-time">
              <label htmlFor={`part-time-${p}`}>{f.part(p)}</label>
              <CommitInput
                id={`part-time-${p}`}
                className="input"
                type="time"
                value={records?.times[p] ?? ''}
                valid={(v) => TIME.test(v)}
                onCommit={(v) => saveTime(p, v)}
              />
            </li>
          ))}
        </ul>
      </Field>
      {records && (
        <Field label={t('logStart')} htmlFor="log-start">
          <CommitInput
            id="log-start"
            className="input"
            type="date"
            max={records.today}
            value={records.logStart}
            valid={(v) => isPlainDate(v) && v <= records.today}
            onCommit={saveLogStart}
          />
          <p className="field__note">{t('logStartHint')}</p>
        </Field>
      )}
      <Field label={t('langSwitch')}>
        <LangSwitch />
      </Field>
      {diag && <RequestLogPanel />}
      {(onSignOut || onResetDemo) && (
        <div className="menu-end">
          <button type="button" className="btn btn--ghost btn--lg menu-end__btn" onClick={onSignOut ?? onResetDemo}>
            {t(onSignOut ? 'auth.signOut' : 'demoReset')}
          </button>
        </div>
      )}
    </Sheet>
  );
}
