import { useState } from 'react';
import type { DayPart } from '../data';
import { ChevronIcon, RoutineIcon } from '../components/icons';
import { LangSwitch } from '../components/LangSwitch';
import { Field, Sheet } from '../components/Sheet';
import { useI18n } from '../i18n';
import { DAY_PARTS } from '../timeline/model';
import { useFormat } from './format';
import { useLog } from './LogProvider';

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * The menu from the header, on every screen: Usual day, the usual time of each day part (they decide
 * what "up to now" means today), language, and Sign out (real app) or Reset demo data (demo).
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
  const { records, repository, run, close } = useLog();
  const [times, setTimes] = useState<Partial<Record<DayPart, string>>>({});

  const commit = (part: DayPart) => {
    const value = times[part];
    const before = records?.times[part];
    if (!value || !before || value === before || !TIME.test(value)) return;
    void run(async () => {
      await repository.saveDayPartTime(part, value);
      return () => repository.saveDayPartTime(part, before);
    }, t('toastSaved'));
  };

  return (
    <Sheet title={t('menu')} onClose={close}>
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
              <input
                id={`part-time-${p}`}
                className="input"
                type="time"
                value={times[p] ?? records?.times[p] ?? ''}
                onChange={(e) => setTimes((x) => ({ ...x, [p]: e.target.value }))}
                onBlur={() => commit(p)}
              />
            </li>
          ))}
        </ul>
      </Field>
      <Field label={t('langSwitch')}>
        <LangSwitch />
      </Field>
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
