import { useMemo } from 'react';
import type { PlainDate } from '../data';
import { useI18n } from '../i18n';
import { LOCALE } from '../log/format';
import { parseDate } from '../timeline/model';

/** The caption over a month of results: "October 2026", "październik 2026". */
export function useMonthCaption(): (d: PlainDate) => string {
  const { lang } = useI18n();
  return useMemo(() => {
    const fmt = new Intl.DateTimeFormat(LOCALE[lang], { timeZone: 'UTC', month: 'long', year: 'numeric' });
    return (d: PlainDate) => fmt.format(parseDate(d));
  }, [lang]);
}
