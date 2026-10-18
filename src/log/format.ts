import { useMemo } from 'react';
import type { DayPart, EventType, HealthEvent, Item, PlainDate, Unit } from '../data';
import { useI18n, type Lang, type MessageKey } from '../i18n';
import { parseDate } from '../timeline/model';
import { formatAmount } from './amount';
import { useToday } from './LogProvider';

export const LOCALE: Record<Lang, string> = { en: 'en-GB', pl: 'pl-PL' };

/** Day-part names, copy CSV rows 48 to 54. */
export const PART_NAME: Record<DayPart, MessageKey> = {
  1: 'copy.48', 2: 'copy.49', 3: 'copy.50', 4: 'copy.51', 5: 'copy.52', 6: 'copy.53', 7: 'copy.54',
};

/** Labels of event types that have no free-text title of their own. */
export const EVENT_LABEL: Partial<Record<EventType, MessageKey>> = {
  frontline: 'kFront',
  deworming: 'copy.102',
  anal_glands: 'label.117',
  nails: 'label.118',
  note: 'note.154',
};

/**
 * Date formatters for a language. A date outside `currentYear` also shows its year ("21 Apr 2023",
 * "21 kwi 2023"); one in the current year stays short ("21 Apr").
 */
export function makeDateFormat(lang: Lang, currentYear: number) {
  const make = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(LOCALE[lang], { timeZone: 'UTC', ...o });
  const short = make({ weekday: 'short', day: 'numeric', month: 'short' });
  const shortYear = make({ weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  const dayMonth = make({ day: 'numeric', month: 'short' });
  const dayMonthYear = make({ day: 'numeric', month: 'short', year: 'numeric' });
  const past = (d: PlainDate) => parseDate(d).getUTCFullYear() !== currentYear;
  return {
    /** "Thu 15 Oct", or "Fri 21 Apr 2023" in another year */
    shortDate: (d: PlainDate) => (past(d) ? shortYear : short).format(parseDate(d)),
    /** "15 Oct", or "21 Apr 2023" in another year */
    dayMonth: (d: PlainDate) => (past(d) ? dayMonthYear : dayMonth).format(parseDate(d)),
  };
}

/** Formatting that depends on the UI language: dates, amounts, day parts, event titles. */
export function useFormat() {
  const { lang, t } = useI18n();
  const today = useToday();
  const year = today ? Number(today.slice(0, 4)) : new Date().getFullYear();
  return useMemo(() => {
    return {
      ...makeDateFormat(lang, year),
      part: (p: DayPart) => t(PART_NAME[p]),
      /** "½ can", "0,15 ml (1,5 bars)"; falls back to the free-text dose of old rows. */
      amount: (amount: number | null, unit: Unit | null, conversion?: Item['conversion'], doseText = '') =>
        amount !== null && unit ? formatAmount(amount, unit, lang, t, conversion) : doseText,
      /** "Ocean Blend, salmon" */
      name: (name: string, flavour: string) => (flavour ? `${name}, ${flavour}` : name),
      /** The heading of an event card or row. */
      eventTitle: (e: Pick<HealthEvent, 'type' | 'title'>) => {
        if (e.type === 'other') return e.title || t('otherEvent');
        if (e.type === 'photo') return e.title || t('copy.103');
        const key = EVENT_LABEL[e.type];
        return key ? t(key) : e.title;
      },
    };
  }, [lang, t, year]);
}
