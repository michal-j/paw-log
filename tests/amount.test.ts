import { describe, expect, it } from 'vitest';
import { translate, type MessageKey } from '../src/i18n';
import { formatAmount, formatDecimal, formatNumber, groupOf, parseAmount, unitForm, unitKey } from '../src/log/amount';
import { UNITS } from '../src/data';

const en = (k: MessageKey) => translate('en', k);
const pl = (k: MessageKey) => translate('pl', k);

describe('amount formatting', () => {
  it('shows fraction chips as fractions and anything else as a comma decimal', () => {
    expect(formatNumber(0.5, 'can')).toBe('½');
    expect(formatNumber(1 / 3, 'tray')).toBe('⅓');
    expect(formatNumber(1.5, 'pill')).toBe('1½');
    expect(formatNumber(0.15, 'ml')).toBe('0,15');
    expect(formatNumber(0.5, 'ml')).toBe('0,5'); // ml and g are always decimals
    expect(formatNumber(1.25, 'pill')).toBe('1,25');
    expect(formatDecimal(1 / 3)).toBe('0,333');
  });

  it('reads EN and PL decimal input', () => {
    expect(parseAmount('0,15')).toBe(0.15);
    expect(parseAmount(' 2.5 ')).toBe(2.5);
    expect(parseAmount('.5')).toBe(0.5);
    for (const bad of ['', '0', '-1', 'abc', '1,2,3', '1e3']) expect(parseAmount(bad)).toBeNull();
  });

  it('picks the unit form: EN one/other, PL one/few/many/fraction', () => {
    expect(unitForm(0.5, 'en')).toBe('one');
    expect(unitForm(1, 'en')).toBe('one');
    expect(unitForm(1.5, 'en')).toBe('few');
    expect(unitForm(1, 'pl')).toBe('one');
    expect(unitForm(0.25, 'pl')).toBe('frac');
    expect(unitForm(3, 'pl')).toBe('few');
    expect(unitForm(5, 'pl')).toBe('many');
    expect(unitForm(12, 'pl')).toBe('many');
    expect(unitForm(22, 'pl')).toBe('few');
  });

  it('formats amounts as the reviewed copy writes them', () => {
    expect(formatAmount(0.25, 'can', 'en', en)).toBe('¼ can');
    expect(formatAmount(2, 'can', 'en', en)).toBe('2 cans');
    expect(formatAmount(0.25, 'can', 'pl', pl)).toBe('¼ puszki');
    expect(formatAmount(1, 'sachet', 'pl', pl)).toBe('1 saszetka');
    expect(formatAmount(5, 'sachet', 'pl', pl)).toBe('5 saszetek');
    expect(formatAmount(1 / 3, 'tray', 'pl', pl)).toBe('⅓ tacki');
    expect(formatAmount(0.5, 'pill', 'pl', pl)).toBe('½ tabl.');
    expect(formatAmount(1, 'capsule', 'pl', pl)).toBe('1 kaps.');
    expect(formatAmount(0.15, 'ml', 'en', en, { unit: 'bars', size: 0.1 })).toBe('0,15 ml (1,5 bars)');
    expect(formatAmount(2, 'piece', 'en', en)).toBe('2 pieces');
  });

  it('has a label for every unit form in both languages', () => {
    for (const u of UNITS) {
      for (const n of [1, 0.5, 2, 3, 5]) {
        for (const lang of ['en', 'pl'] as const) {
          const key = unitKey(u, n, lang);
          expect(translate(lang, key), `${lang} ${key}`).not.toBe(key);
        }
      }
    }
  });

  it('groups treats with food and supplements with medication', () => {
    expect(groupOf('treat')).toBe('food');
    expect(groupOf('food')).toBe('food');
    expect(groupOf('supplement')).toBe('med');
    expect(groupOf('procedure')).toBe('med');
  });
});
