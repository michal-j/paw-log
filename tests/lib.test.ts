import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildCatalogues, buildTokensCss, mergeCatalogues, parseCsv } from '../scripts/lib.mjs';

const csv = readFileSync('docs/copy/pawlog-copy-en-pl.csv', 'utf8');
const authCsv = readFileSync('docs/copy/copy-proposal-auth.csv', 'utf8');
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

describe('draft copy proposals', () => {
  const reviewed = buildCatalogues(csv);
  const draft = buildCatalogues(authCsv);
  it('auth draft has EN and PL for every key, all marked pending review', () => {
    expect(Object.keys(draft.pl)).toEqual(Object.keys(draft.en));
    for (const k of Object.keys(draft.en)) {
      expect(draft.en[k], k).not.toBe('');
      expect(draft.pl[k], k).not.toBe('');
    }
    for (const row of parseCsv(authCsv).slice(1)) expect(row[6]).toMatch(/^DRAFT pending CEO review/);
  });
  it('merges drafts after the reviewed copy', () => {
    const merged = mergeCatalogues(reviewed, draft);
    expect(merged.en['auth.signOut']).toBe('Sign out');
    expect(merged.pl['auth.signOut']).toBe('Wyloguj');
    expect(merged.en.demoBanner).toBe(reviewed.en.demoBanner);
  });
  it('refuses a draft that reuses a reviewed key', () => {
    expect(() => mergeCatalogues(reviewed, { en: { demoBanner: 'x' }, pl: { demoBanner: 'x' } })).toThrow(/demoBanner/);
  });
});
