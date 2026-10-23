// What Search keeps in memory while the app is open (JCB-138): the text, the filters, how many results were shown and
// the scroll position, so that Back from a Day opened from Search finds everything where it was. Never in the URL.
// Created once by the Shell (a sign-out or a reload of the page starts again).
import { useMemo } from 'react';
import type { Lang, MessageKey } from '../i18n';
import type { Format } from '../log/format';
import { buildIndex, type IndexInput, type SearchIndex } from './index';
import type { Kind } from './kinds';

/** Results shown at first and added by each "Show more". */
export const PAGE = 20;

export interface SearchState {
  q: string;
  kinds: Kind[];
  shown: number;
  scrollTop: number;
}
export interface ItemViewState {
  shown: number;
  scrollTop: number;
}

export interface SearchMemory {
  get: () => SearchState;
  set: (patch: Partial<SearchState>) => void;
  item: (id: string) => ItemViewState;
  setItem: (id: string, patch: Partial<ItemViewState>) => void;
}

export function createSearchMemory(): SearchMemory {
  let state: SearchState = { q: '', kinds: [], shown: PAGE, scrollTop: 0 };
  const items = new Map<string, ItemViewState>();
  return {
    get: () => state,
    set: (patch) => {
      state = { ...state, ...patch };
    },
    item: (id) => items.get(id) ?? { shown: PAGE, scrollTop: 0 },
    setItem: (id, patch) => {
      items.set(id, { shown: PAGE, scrollTop: 0, ...items.get(id), ...patch });
    },
  };
}

// One index per loaded records object and language: the records object changes after every write or reload, so the
// index is rebuilt then and only then. Opening Search again, a Day and Back, or typing never rebuilds it.
const indexes = new WeakMap<object, Map<Lang, SearchIndex>>();

export function indexFor(records: IndexInput, lang: Lang, t: (k: MessageKey) => string, format: Format): SearchIndex {
  let byLang = indexes.get(records);
  if (!byLang) indexes.set(records, (byLang = new Map()));
  let index = byLang.get(lang);
  if (!index) byLang.set(lang, (index = buildIndex(records, { lang, t, format })));
  return index;
}

export function useSearchIndex(records: IndexInput | null, lang: Lang, t: (k: MessageKey) => string, format: Format): SearchIndex | null {
  return useMemo(() => (records ? indexFor(records, lang, t, format) : null), [records, lang, t, format]);
}
