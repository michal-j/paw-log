// JCB-77: a date outside the current year shows its year (EN and PL). Fictional dates.
import { describe, expect, it } from 'vitest';
import { makeDateFormat } from '../src/log/format';

describe('date formats and the year', () => {
  const en = makeDateFormat('en', 2026);
  const pl = makeDateFormat('pl', 2026);

  it('keeps the short form in the current year', () => {
    expect(en.dayMonth('2026-04-21')).toBe('21 Apr');
    expect(pl.dayMonth('2026-04-21')).toBe('21 kwi');
    expect(en.shortDate('2026-10-15')).toMatch(/^Thu,? 15 Oct$/);
  });

  it('adds the year to an earlier or later year', () => {
    expect(en.dayMonth('2023-04-21')).toBe('21 Apr 2023');
    expect(pl.dayMonth('2023-04-21')).toBe('21 kwi 2023');
    expect(en.dayMonth('2027-01-02')).toBe('2 Jan 2027');
    expect(en.shortDate('2023-04-21')).toMatch(/^Fri,? 21 Apr 2023$/);
    expect(pl.shortDate('2023-04-21')).toMatch(/^pt\.?,? 21 kwi 2023$/);
  });

  it('judges the year of the date itself at the year boundary', () => {
    expect(en.dayMonth('2025-12-31')).toBe('31 Dec 2025');
    expect(en.dayMonth('2026-01-01')).toBe('1 Jan');
  });
});
