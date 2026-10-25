import catalogues from '../i18n/catalogues.generated.json';

/**
 * What the activity log may say about a tap or a toast (JCB-71). Only the app's own interface strings
 * (any language) are written down; a button that carries the dog's data (an item, a clinic, a note, a
 * condition) is "(other)", so the log never holds anything about the household.
 */
let known: Set<string> | null = null;
const strings = () => (known ??= new Set([...Object.values(catalogues.en), ...Object.values(catalogues.pl)]));

const clean = (s: string | null | undefined) => (s ?? '').replace(/\s+/g, ' ').trim();

/** The text if it is one of the app's own strings, else null. */
export function uiString(text: string | null | undefined): string | null {
  const t = clean(text);
  return t && strings().has(t) ? t : null;
}

/** `/day/2026-10-15` and `/tracked/<id>` are told apart by their first part only. */
export function routeOf(pathname: string): string {
  const first = pathname.split('/').filter(Boolean).find((p) => p !== 'demo');
  return first ? `/${first}` : '/';
}

const CONTROL = 'button, a, [role="button"], [role="radio"], [role="tab"], [role="switch"], input, textarea, select, label, summary';

/** One line for a tap: which control (by its label, when it is an interface string) and where. */
export function describeTap(target: Element | null, pathname: string): string {
  const control = target?.closest?.(CONTROL) ?? null;
  const dialog = target?.closest?.('[role="dialog"]') ?? null;
  const where = dialog ? `in "${uiString(dialog.querySelector('h2')?.textContent) ?? 'sheet'}"` : `on ${routeOf(pathname)}`;
  if (!control) return `tap (no control) ${where}`;
  const typed = control.matches('input, textarea, select');
  const label = typed ? null : uiString(control.getAttribute('aria-label')) ?? uiString(control.textContent);
  const what = typed ? 'field' : label ? `"${label}"` : '(other)';
  return `tap ${what} ${where}`;
}

/** A toast, by its text when that is an interface string. */
export function describeToast(text: string): string {
  const t = uiString(text);
  return t ? `toast "${t}"` : 'toast';
}
