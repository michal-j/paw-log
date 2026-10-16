import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildCatalogues, buildTokensCss, parseCsv } from '../scripts/lib.mjs';

const csv = readFileSync('docs/copy/pawlog-copy-en-pl.csv', 'utf8');
const tokens = JSON.parse(readFileSync('docs/design-system/tokens.json', 'utf8'));

describe('parseCsv', () => {
  it('handles quotes, doubled quotes, commas, newlines and BOM', () => {
    const rows = parseCsv('﻿a,b\n1,"x, ""y""\nz"\n');
    expect(rows).toEqual([['a', 'b'], ['1', 'x, "y"\nz']]);
  });
});

describe('buildCatalogues', () => {
  const { en, pl } = buildCatalogues(csv);
  it('has the same keys in EN and PL and no empty strings', () => {
    expect(Object.keys(pl)).toEqual(Object.keys(en));
    for (const k of Object.keys(en)) {
      expect(en[k], k).not.toBe('');
      expect(pl[k], k).not.toBe('');
    }
  });
  it('seeds known strings and keeps keys unique for repeated code names', () => {
    expect(en.jump).toBe('Jump to date');
    expect(pl.jump).toBe('Przejdź do daty');
    expect(en['name.96']).toBe('Given');
    expect(Object.keys(en).length).toBe(parseCsv(csv).length - 1);
  });
});

describe('buildTokensCss', () => {
  const css = buildTokensCss(tokens);
  it('emits a variable for every colour, spacing, radius and shadow token', () => {
    for (const t of tokens.color.tokens) expect(css).toContain(`--color-${t.name}: ${t.value};`);
    for (const g of ['spacing', 'radius', 'shadow'] as const)
      for (const t of tokens[g].tokens) expect(css).toContain(`--${t.name}: ${t.value};`);
  });
  it('emits type styles', () => {
    expect(css).toContain('--type-title-size: 22px;');
  });
});
