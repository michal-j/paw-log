// Structured amounts: fraction chips, decimal input, unit labels with EN plurals and PL forms.
// Pure; unit-tested in tests/amount.test.ts.
import type { Item, ItemKind, Unit } from '../data';
import type { Lang, MessageKey } from '../i18n';

/** Fraction chips, in order (design proposal JCB-25). */
export const FRACTIONS: readonly { value: number; label: string }[] = [
  { value: 0.25, label: '¼' },
  { value: 1 / 3, label: '⅓' },
  { value: 0.5, label: '½' },
  { value: 2 / 3, label: '⅔' },
  { value: 0.75, label: '¾' },
  { value: 1, label: '1' },
  { value: 1.5, label: '1½' },
  { value: 2, label: '2' },
  { value: 3, label: '3' },
];
/** ml and g take a decimal field instead of fraction chips. */
export const DECIMAL_UNITS: ReadonlySet<Unit> = new Set(['ml', 'g']);
export const FOOD_UNITS: readonly Unit[] = ['can', 'tray', 'g', 'piece'];
export const MED_UNITS: readonly Unit[] = ['pill', 'ml', 'sachet', 'capsule', 'drop'];

/** Food and treats are eaten (big or small circle, "partly eaten" applies); the rest is given. */
export type KindGroup = 'food' | 'med';
export const groupOf = (kind: ItemKind): KindGroup => (kind === 'food' || kind === 'treat' ? 'food' : 'med');
export const unitsFor = (group: KindGroup) => (group === 'food' ? FOOD_UNITS : MED_UNITS);
export const defaultUnitFor = (group: KindGroup): Unit => (group === 'food' ? 'can' : 'pill');

const EPS = 0.005;
export const sameAmount = (a: number | null, b: number | null) =>
  a === b || (a !== null && b !== null && Math.abs(a - b) < EPS);
export const fractionOf = (amount: number) => FRACTIONS.find((f) => Math.abs(f.value - amount) < EPS);

/** "0,15": up to three decimals, comma as the decimal mark in both languages (reviewed copy writes "0,15 ml"). */
export function formatDecimal(n: number): string {
  return String(Number(n.toFixed(3))).replace('.', ',');
}

/** "½", "1½" or "0,15". */
export function formatNumber(amount: number, unit: Unit | null): string {
  const f = unit && DECIMAL_UNITS.has(unit) ? undefined : fractionOf(amount);
  return f ? f.label : formatDecimal(amount);
}

/** "0,15" or "0.15" to 0.15; empty, zero, negative or not a number gives null. */
export function parseAmount(text: string): number | null {
  const t = text.trim().replace(',', '.');
  if (!/^\d*\.?\d+$/.test(t)) return null;
  const n = Number(t);
  return n > 0 ? n : null;
}

/** Which form of a unit label an amount takes. EN: one / other. PL: one / few (2-4) / many / fraction. */
export function unitForm(amount: number, lang: Lang): 'one' | 'few' | 'many' | 'frac' {
  if (lang === 'en') return amount <= 1 ? 'one' : 'few';
  if (!Number.isInteger(amount)) return 'frac';
  if (amount === 1) return 'one';
  const tens = amount % 100;
  return amount % 10 >= 2 && amount % 10 <= 4 && (tens < 12 || tens > 14) ? 'few' : 'many';
}

export function unitKey(unit: Unit, amount: number, lang: Lang): MessageKey {
  const form = unitForm(amount, lang);
  return (form === 'one' ? `u_${unit}` : `u_${unit}_${form}`) as MessageKey;
}

/**
 * "½ can", "2 cans", "1½ puszki", "0,15 ml (1,5 bars)". The bracket appears when the item has a
 * conversion for this unit (Bellavet: 1 bar = 0.1 ml).
 */
export function formatAmount(
  amount: number,
  unit: Unit,
  lang: Lang,
  t: (k: MessageKey) => string,
  conversion?: Item['conversion'],
): string {
  let text = `${formatNumber(amount, unit)} ${t(unitKey(unit, amount, lang))}`;
  if (conversion && unit === 'ml') text += ` (${formatDecimal(amount / conversion.size)} ${t('u_bars')})`;
  return text;
}
