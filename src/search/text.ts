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

/** A typed word: normalized, and in Polish also its stem (so every inflected form finds every other). */
export interface Token {
  raw: string;
  /** Polish only: the stem of `raw` (`stemOf`); empty otherwise. */
  stem: string;
}

// Polish endings, longest first, as they read after `norm` (ą, ę, ó lose their marks: ów is ow, ią is ia).
const ENDINGS = ['iem', 'ami', 'ach', 'ow', 'om', 'em', 'ie', 'ia', 'ej', 'ym', 'im', 'a', 'e', 'i', 'o', 'u', 'y'];
const MIN_STEM = 3;
/** A stem this long or longer is compared by prefix (the word may be typed in part); a shorter one must be the whole stem. */
const PREFIX_STEM = 4;

/**
 * A rough Polish stem of a normalized word, the same on both sides of a match: żołądek, żołądka, żołądku, żołądkiem and
 * żołądków all give "zoladk"; lek, leki, leków, lekiem give "lek"; wizyta, wizyty, wizytę, wizytą give "wizyt"; pazur,
 * pazury, pazurów give "pazur". One ending is removed (never below 3 letters) and a fleeting "e" before the final "k"
 * goes. Words with digits or punctuation are left alone.
 */
export function stemOf(word: string): string {
  if (!LETTERS.test(word)) return word;
  let w = word;
  for (const end of ENDINGS) {
    if (w.length - end.length >= MIN_STEM && w.endsWith(end)) {
      w = w.slice(0, -end.length);
      break;
    }
  }
  if (w.length >= 5 && w.endsWith('ek')) w = w.slice(0, -2) + 'k';
  return w;
}

/** The stems of the words of a normalized text, joined by spaces. */
export const stemsOf = (n: string): string => (n.match(/[\p{L}\p{N}]+/gu) ?? []).map(stemOf).join(' ');

const stemMatches = (stemW: string, tok: Token): boolean =>
  tok.stem.length >= PREFIX_STEM ? stemW.startsWith(tok.stem) : stemW === tok.stem;

/**
 * The words typed, normalized. Fewer than 2 characters typed, or only single-character words: no words (nothing is
 * searched). A single-character word next to a longer one is ignored (it would match nearly everything).
 */
export function tokensOf(query: string, lang: Lang): Token[] {
  const q = nfc(query).trim();
  if (Array.from(q).length < 2) return [];
  const words = norm(q).split(/\s+/).filter((w) => Array.from(w).length >= 2);
  return [...new Set(words)].map((raw) => ({ raw, stem: lang === 'pl' && LETTERS.test(raw) ? stemOf(raw) : '' }));
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
function hasRaw(n: string, token: string): boolean {
  if (!token) return false;
  for (let i = n.indexOf(token); i !== -1; i = n.indexOf(token, i + 1)) {
    if (i === 0 || !WORD_CHAR.test(n[i - 1] ?? '')) return true;
  }
  return false;
}

/** A normalized text with the stems of its words (Polish only), as the index keeps it. */
export interface Hay {
  h: string;
  s: string;
}
export const makeHay = (fields: readonly string[], lang: Lang): Hay => {
  const h = norm(fields.filter(Boolean).join(' \n '));
  return { h, s: lang === 'pl' ? stemsOf(h) : '' };
};

function hasStem(stems: string, tok: Token): boolean {
  if (!tok.stem || !stems) return false;
  const whole = tok.stem.length < PREFIX_STEM;
  for (let i = stems.indexOf(tok.stem); i !== -1; i = stems.indexOf(tok.stem, i + 1)) {
    if (i > 0 && WORD_CHAR.test(stems[i - 1] ?? '')) continue;
    if (whole && WORD_CHAR.test(stems[i + tok.stem.length] ?? '')) continue;
    return true;
  }
  return false;
}

/** The one rule: a typed word matches a word of the text by its start, or (Polish) by its stem. */
export const hasStart = (hay: Hay, tok: Token): boolean => hasRaw(hay.h, tok.raw) || hasStem(hay.s, tok);

/** Every typed word matches somewhere in the haystack. */
export const matchesAll = (hay: Hay, tokens: readonly Token[]): boolean => tokens.every((tk) => hasStart(hay, tk));

/** Some typed word matches `text` (not yet normalized): used to decide what a result shows. */
export const hasToken = (text: string, tokens: readonly Token[]): boolean => {
  if (!tokens.length || !text) return false;
  const n = norm(nfc(text));
  const hay: Hay = { h: n, s: tokens.some((t) => t.stem) ? stemsOf(n) : '' };
  return tokens.some((tk) => hasStart(hay, tk));
};

const commonPrefix = (a: string, b: string): number => {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  return i;
};

/** The ranges `[start, end)` of `text` to highlight: every matching word start, merged where they touch. */
export function markRanges(text: string, tokens: readonly Token[]): [number, number][] {
  if (!tokens.length || !text) return [];
  const n = norm(text);
  const ranges: [number, number][] = [];
  for (const tk of tokens) for (const i of starts(n, tk.raw)) ranges.push([i, i + tk.raw.length]);
  if (tokens.some((t) => t.stem)) {
    for (const m of n.matchAll(/[\p{L}\p{N}]+/gu)) {
      const word = m[0];
      const stem = stemOf(word);
      for (const tk of tokens) {
        if (tk.stem && stemMatches(stem, tk)) ranges.push([m.index, m.index + Math.max(1, commonPrefix(word, tk.raw))]);
      }
    }
  }
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
export function highlight(text: string, tokens: readonly Token[]): Piece[] {
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
export function snippet(text: string, tokens: readonly Token[]): string {
  const t = nfc(text);
  if (!tokens.length || t.length <= SNIPPET_LONG) return t;
  const at = markRanges(t, tokens)[0]?.[0];
  if (at === undefined || at < SNIPPET_NEAR) return t; // no match here, or it is near the start already
  const space = t.indexOf(' ', Math.max(0, at - SNIPPET_LEAD));
  return '…' + t.slice(space === -1 || space >= at ? at : space + 1);
}
