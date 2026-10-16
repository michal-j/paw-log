import { useMemo } from 'react';
import type { DayPart, EventType, HealthEvent, Item, PlainDate, Unit } from '../data';
import { useI18n, type Lang, type MessageKey } from '../i18n';
import { parseDate } from '../timeline/model';
import { formatAmount } from './amount';

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

/** Formatting that depends on the UI language: dates, amounts, day parts, event titles. */
export function useFormat() {
  const { lang, t } = useI18n();
  return useMemo(() => {
    const make = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(LOCALE[lang], { timeZone: 'UTC', ...o });
    const short = make({ weekday: 'short', day: 'numeric', month: 'short' });
    const dayMonth = make({ day: 'numeric', month: 'short' });
    return {
      /** "Thu 15 Oct" */
      shortDate: (d: PlainDate) => short.format(parseDate(d)),
      /** "15 Oct" */
      dayMonth: (d: PlainDate) => dayMonth.format(parseDate(d)),
      part: (p: DayPart) => t(PART_NAME[p]),
      /** "½ can", "0,15 ml (1,5 bars)"; falls back to the free-text dose of old rows. */
      amount: (amount: number | null, unit: Unit | null, conversion?: Item['conversion'], doseText = '') =>
        amount !== null && unit ? formatAmount(amount, unit, lang, t, conversion) : doseText,
      /** "Ocean Blend, salmon" */
      name: (name: string, flavour: string) => (flavour ? `${name}, ${flavour}` : name),
      /** The heading of an event card or row. */
      eventTitle: (e: Pick<HealthEvent, 'type' | 'title'>) => {
        if (e.type === 'other') return e.title || t('otherEvent');
        const key = EVENT_LABEL[e.type];
        return key ? t(key) : e.title;
      },
    };
  }, [lang, t]);
}
