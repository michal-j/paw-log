import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { App } from '../src/App';
import { I18nProvider } from '../src/i18n';
import { buildColumns, columnsAvailable, columnsWidth, fitColumns, fitLayout } from '../src/timeline/model';
import { DATE_COL_W, DATE_COL_W_TIGHT, EVENTS_MIN_W, RAIL_W, ROW_INSET } from '../src/timeline/geometry';
import { StressRepository, laneCount, layoutOf, stressEntries, stressItems } from './fixtures/stressLog';

const WIDTHS = [320, 360, 390, 768, 1280];
const SWEEP = [8, 10, 12, 14, 17, 20, 24];
/** The app column is capped at 560 px (global.css); the list is that minus the rail. */
const listWidthAt = (viewport: number) => Math.min(viewport, 560) - RAIL_W;
const cols = (lanes: number, foods = 3) => buildColumns(stressItems, stressEntries(layoutOf(lanes, foods), 3));

describe('fixture', () => {
  it('has the lane counts it says', () => {
    for (const n of SWEEP) expect(laneCount(layoutOf(n))).toBe(n);
  });
});

describe('fitColumns (JCB-86)', () => {
  it('leaves columns alone when they fit', () => {
    const c = cols(17);
    expect(fitColumns(c, columnsWidth(c))).toBe(c);
  });

  it('keeps circles and lanes: a lane is at least circle + 2 px, and every lane sits inside its column', () => {
    for (const n of SWEEP) {
      for (const col of fitColumns(cols(n), 0)) {
        const lanes = col.lanes.reduce((s, l) => s + l.width, 0);
        expect(col.width).toBeGreaterThanOrEqual(lanes);
        for (const l of col.lanes) expect(l.width).toBeGreaterThanOrEqual(l.size === 'food' ? 18 : 14);
        if (col.meal) expect(col.width).toBeGreaterThanOrEqual(22);
      }
    }
  });

  it('takes width back in order: minimums, padding, then lanes', () => {
    const c = cols(17);
    const full = columnsWidth(c);
    // Padding 2 with full lanes: 3 food (20) + 14 small (15) + 2 px in each of 6 columns.
    const tightPad = columnsWidth(fitColumns(c, 3 * 20 + 14 * 15 + 12));
    expect(tightPad).toBe(3 * 20 + 14 * 15 + 12);
    const tightLanes = columnsWidth(fitColumns(c, 0));
    expect(full).toBeGreaterThan(tightPad);
    expect(tightPad).toBeGreaterThan(tightLanes);
    // 3 food (18) + 14 small (14) + 2 px in each of 6 columns.
    expect(tightLanes).toBe(3 * 18 + 14 * 14 + 12);
  });
});

describe('fitLayout (JCB-86)', () => {
  it('17 lanes with 3 food fit at 390 without scrolling, and not at 360', () => {
    const at390 = fitLayout(cols(17), listWidthAt(390));
    expect(at390.scrolls).toBe(false);
    expect(at390.dateW).toBe(DATE_COL_W);
    expect(at390.rowW).toBeLessThanOrEqual(listWidthAt(390));
    const at360 = fitLayout(cols(17), listWidthAt(360));
    expect(at360.scrolls).toBe(true);
    expect(at360.dateW).toBe(DATE_COL_W_TIGHT);
  });

  it('roomy screens keep today\'s look (columns untouched) up to 12 lanes at 390 and 17 at 768', () => {
    expect(fitLayout(cols(12), listWidthAt(390)).columns).toEqual(cols(12));
    expect(fitLayout(cols(17), listWidthAt(768)).columns).toEqual(cols(17));
    expect(fitLayout(cols(24), listWidthAt(1280)).columns).toEqual(cols(24));
  });

  it('scrolls exactly when the row is wider than the list, at every width and lane count', () => {
    for (const w of WIDTHS) {
      for (const n of SWEEP) {
        const f = fitLayout(cols(n), listWidthAt(w));
        expect(f.scrolls).toBe(f.rowW > listWidthAt(w));
        expect(f.rowW).toBe(ROW_INSET + f.dateW + columnsWidth(f.columns) + EVENTS_MIN_W);
        // The date column only narrows when it is needed.
        if (f.dateW === DATE_COL_W_TIGHT) expect(fitColumns(cols(n), columnsAvailable(listWidthAt(w))).length).toBeGreaterThan(0);
      }
    }
  });
});

describe('Timeline layout on the stress log (JCB-86)', () => {
  let original: PropertyDescriptor | undefined;
  beforeEach(() => {
    localStorage.clear();
    original = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth');
  });
  afterEach(() => {
    cleanup();
    if (original) Object.defineProperty(HTMLElement.prototype, 'clientWidth', original);
  });

  const widthOf = (el: Element) => parseFloat((el as HTMLElement).style.width) || 0;
  const CASES = WIDTHS.flatMap((w) => [10, 17, 24].map((lanes) => ({ w, lanes })));

  it.each(CASES)('rows, Key and parts bar share one layout: $lanes lanes at $w px', async ({ w: viewport, lanes }) => {
    const listW = listWidthAt(viewport);
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
      configurable: true,
      get() {
        return (this as HTMLElement).classList.contains('tl-list') ? listW : 0;
      },
    });
    render(
      <I18nProvider initial="en">
        <App repository={new StressRepository(layoutOf(lanes))} />
      </I18nProvider>,
    );
    await screen.findByRole('button', { name: /Key for the day below/ });
    const expected = fitLayout(cols(lanes), listW);
    const rows = [...document.querySelectorAll<HTMLElement>('.tl-row')];
    expect(rows.length).toBeGreaterThan(10);
    const colWidths = (root: Element) => [...root.querySelectorAll('.tl-col')].map(widthOf);
    const key = colWidths(document.querySelector('.tl-key__toggle')!);
    expect(key).toEqual(expected.columns.filter((c) => c.width).map((c) => c.width));
    expect(colWidths(document.querySelector('.tl-parts')!)).toEqual(key);
    for (const row of rows) {
      expect(colWidths(row)).toEqual(key);
      expect(parseFloat(row.style.minWidth)).toBe(expected.rowW);
      expect(widthOf(row.querySelector('.tl-row__date')!)).toBe(expected.dateW);
      // Every row is either inside the list or the list scrolls sideways: never a silent clip.
      expect(expected.scrolls || expected.rowW <= listW).toBe(true);
      for (const col of row.querySelectorAll('.tl-col')) {
        const slots = [...col.querySelectorAll('.tl-slot')].reduce((s, l) => s + widthOf(l), 0);
        expect(widthOf(col)).toBeGreaterThanOrEqual(slots);
      }
    }
  });
});
