import { translate, type MessageKey } from '../i18n';

/** Symptom types with reviewed EN/PL copy (copy CSV rows 77 to 85). */
const SYMPTOM_KEYS: readonly MessageKey[] = [
  'sx_leak', 'sx_poo', 'sx_vomit', 'sx_pant', 'sx_rumble', 'sx_heart', 'sx_fear', 'sx_rest', 'sx_reflux',
];

/**
 * A symptom title that matches a known type by its English name is shown in the UI language;
 * anything else (free text typed by the household) is shown as written.
 */
export function symptomLabel(title: string, t: (k: MessageKey) => string): string {
  const needle = title.trim().toLowerCase();
  const key = SYMPTOM_KEYS.find((k) => translate('en', k).toLowerCase() === needle);
  return key ? t(key) : title;
}
