import { SERVICE_MAX_LENGTH, type AlsoDone, type HealthEvent } from '../data';
import { translate, type Lang, type MessageKey } from '../i18n';

/** Built-in "also done" services keep their keys and are translated; anything else is an own service, shown as typed. */
export const BUILT_IN_SERVICES: readonly { value: AlsoDone; label: MessageKey }[] = [
  { value: 'anal_glands', label: 'label.117' },
  { value: 'nails', label: 'label.118' },
];

const norm = (s: string) => s.trim().toLowerCase();
const builtIn = (v: string) => BUILT_IN_SERVICES.some((b) => b.value === v);
const LANGS: readonly Lang[] = ['en', 'pl'];

/** Text of a service chip: the translation of a built-in key, an own service as typed. */
export const serviceLabel = (value: AlsoDone, t: (k: MessageKey) => string): string => {
  const known = BUILT_IN_SERVICES.find((b) => b.value === value);
  return known ? t(known.label) : value;
};

/** Own services used in earlier visits of the dog, most recent first, one per name (ignoring case). */
export function ownServices(events: readonly HealthEvent[]): AlsoDone[] {
  const seen = new Set<string>();
  const out: AlsoDone[] = [];
  const visits = events.filter((e) => e.type === 'vet' && e.alsoDone?.length);
  visits.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  for (const v of visits)
    for (const s of v.alsoDone ?? []) {
      if (builtIn(s) || seen.has(norm(s))) continue;
      seen.add(norm(s));
      out.push(s);
    }
  return out;
}

/**
 * What a typed service means: a built-in key when it matches a built-in label (EN or PL), the existing
 * chip when it matches one ignoring case and surrounding spaces, otherwise the new trimmed text.
 * Empty text gives null.
 */
export function resolveService(typed: string, chips: readonly AlsoDone[]): AlsoDone | null {
  const text = typed.trim().slice(0, SERVICE_MAX_LENGTH).trim();
  if (!text) return null;
  const key = norm(text);
  for (const b of BUILT_IN_SERVICES) if (LANGS.some((l) => norm(translate(l, b.label)) === key) || norm(b.value) === key) return b.value;
  return chips.find((c) => norm(c) === key) ?? text;
}
