// Search matching (JCB-138), ported from the approved prototype (design/proposals/search/app.js: norm, starts, tokens, search).
// Pure and free of React: unit-tested in tests/search.test.ts.
//
// The rules: a typed word matches only at the start of a word, ignoring case and diacritics ("sto" finds Stomach, not
// "nieistotna"; "zoladek" finds "żołądek"); every typed word must match; the query needs 2 characters; in Polish a word of
// 6+ letters is matched without its last 2 letters (żołądek, żołądka, żołądkiem). One tokenizer for every field.
import type { Lang } from '../i18n';

const COMBINING = /[̀-ͯ]/g;
const WORD_CHAR = /[\p{L}\p{N}]/u;
const LETTERS = /^\p{L}+$/u;

/** Text as the app shows it: composed characters, so that matching and highlighting see the same string. */
export const nfc = (s: string): string => s.normalize('NFC');

/**
 * Case and diacritics do not matter (zoladek finds żołądek). The result has exactly as many UTF-16 units as the input,
 * so a match position in the normalized text is the position in the shown text. Pass text through `nfc` first.
 */
export function norm(s: string): string {
  let out = '';
  for (const ch of s) {
    if (ch.length > 1) {
      out += ch; // outside the BMP (emoji): kept as it is, two units in and out
    } else if (ch === 'ł' || ch === 'Ł') {
      out += 'l'; // ł has no decomposition
    } else {
      const n = ch.normalize('NFD').replace(COMBINING, '').toLowerCase();
      out += n.length > 0 ? n[0] : ch;
    }
  }
  return out;
}

/**
 * The words typed, normalized. Fewer than 2 characters typed: no words (nothing is searched). In Polish a word of
 * 6+ letters loses its last 2 letters, the same for every searched field, type words and services included.
 */
export function tokensOf(query: string, lang: Lang): string[] {
  const q = nfc(query).trim();
  if (Array.from(q).length < 2) return [];
  const words = norm(q).split(/\s+/).filter(Boolean);
  const out = words.map((w) => (lang === 'pl' && LETTERS.test(w) && Array.from(w).length >= 6 ? Array.from(w).slice(0, -2).join('') : w));
  return [...new Set(out)];
}

/** Every place in the normalized text `n` where a word starts with `token`. */
export function starts(n: string, token: string): number[] {
  const out: number[] = [];
  if (!token) return out;
  for (let i = n.indexOf(token); i !== -1; i = n.indexOf(token, i + 1)) {
    if (i === 0 || !WORD_CHAR.test(n[i - 1] ?? '')) out.push(i);
  }
  return out;
}

/** Whether a word of the normalized text starts with `token` (stops at the first). */
export function hasStart(n: string, token: string): boolean {
  if (!token) return false;
  for (let i = n.indexOf(token); i !== -1; i = n.indexOf(token, i + 1)) {
    if (i === 0 || !WORD_CHAR.test(n[i - 1] ?? '')) return true;
  }
  return false;
}

/** Every typed word starts a word of the normalized haystack. */
export const matchesAll = (hay: string, tokens: readonly string[]): boolean => tokens.every((tk) => hasStart(hay, tk));

/** Some typed word starts a word of `text` (not yet normalized): used to decide what a result shows. */
export const hasToken = (text: string, tokens: readonly string[]): boolean => {
  if (!tokens.length || !text) return false;
  const n = norm(nfc(text));
  return tokens.some((tk) => hasStart(n, tk));
};

/** The ranges `[start, end)` of `text` to highlight: every word start of every typed word, merged where they touch. */
export function markRanges(text: string, tokens: readonly string[]): [number, number][] {
  if (!tokens.length || !text) return [];
  const n = norm(text);
  const ranges: [number, number][] = [];
  for (const tk of tokens) for (const i of starts(n, tk)) ranges.push([i, i + tk.length]);
  ranges.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const merged: [number, number][] = [];
  for (const r of ranges) {
    const last = merged[merged.length - 1];
    if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]);
    else merged.push([r[0], r[1]]);
  }
  return merged;
}

export interface Piece {
  text: string;
  hit: boolean;
}

/** `text` cut into pieces, the matched ones flagged: the one place that decides what is highlighted. */
export function highlight(text: string, tokens: readonly string[]): Piece[] {
  const t = nfc(text);
  const ranges = markRanges(t, tokens);
  if (!ranges.length) return t ? [{ text: t, hit: false }] : [];
  const out: Piece[] = [];
  let at = 0;
  for (const [a, b] of ranges) {
    if (a > at) out.push({ text: t.slice(at, a), hit: false });
    out.push({ text: t.slice(a, b), hit: true });
    at = b;
  }
  if (at < t.length) out.push({ text: t.slice(at), hit: false });
  return out;
}

const SNIPPET_LONG = 110;
const SNIPPET_LEAD = 45;
const SNIPPET_NEAR = 60;

/** A long text cut to start shortly before the first match, so the match is visible in the card's 3 lines. */
export function snippet(text: string, tokens: readonly string[]): string {
  const t = nfc(text);
  if (!tokens.length || t.length <= SNIPPET_LONG) return t;
  const n = norm(t);
  let at = Infinity;
  for (const tk of tokens) {
    const first = starts(n, tk)[0];
    if (first !== undefined && first < at) at = first;
  }
  if (at === Infinity || at < SNIPPET_NEAR) return t; // no match here, or it is near the start already
  const space = t.indexOf(' ', Math.max(0, at - SNIPPET_LEAD));
  return '…' + t.slice(space === -1 || space >= at ? at : space + 1);
}
