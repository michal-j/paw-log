// The search index (JCB-138): built once per data reload (and language), never per keystroke. Every searchable text is
// stored as it is shown (composed characters) and, normalized, as a haystack; a query only walks the haystacks.
// What is searched, and what is not, is the table in design/proposals/search/README.md.
import type { Condition, DayPart, DocFile, Entry, EntryState, HealthEvent, Item, ItemKind, PlainDate, Photo, PinnedNote } from '../data';
import { EVENT_ORDER } from '../day/model';
import type { Lang, MessageKey } from '../i18n';
import { docsOf } from '../documents/model';
import type { Format } from '../log/format';
import { serviceLabel } from '../log/services';
import { symptomDetail } from '../log/symptoms';
import { photosOf } from '../photos/model';
import { symptomLabel } from '../timeline/labels';
import { openConditions, resolvedConditions } from '../tracked/model';
import { isItemKind, TYPE_ALIAS, TYPE_WORD, type Kind } from './kinds';
import { makeHay, matchesAll, nfc, type Hay, type Token } from './text';

/** The records the index reads (a subset of `Records`). */
export interface IndexInput {
  events: HealthEvent[];
  entries: Entry[];
  items: Item[];
  photos: Photo[];
  documents: DocFile[];
  conditions: Condition[];
  pinned: PinnedNote[];
}

export interface IndexContext {
  lang: Lang;
  t: (key: MessageKey) => string;
  format: Format;
}

export interface KindWords {
  kind: Kind;
  /** The type word, then its alias if it has one. */
  words: string[];
}

export interface EventDoc {
  type: 'event';
  id: string;
  date: PlainDate;
  event: HealthEvent;
  /** Own type, plus Photo and Documents when it carries photos or PDFs. */
  kinds: Kind[];
  kindWords: KindWords[];
  /** The heading the Day view shows (the clinic of a vet visit). */
  title: string;
  /** Symptom properties and the written text, as the Day view shows them. */
  text: string;
  captions: string[];
  /** Vet "also done" services, as labelled; `alias` is the short word that also finds a built-in one ("Nails" for Nail trimming). */
  services: { label: string; alias?: string }[];
  docs: string[];
  conditions: Condition[];
  firstPhoto: Photo | null;
  hay: Hay;
}

export interface EntryDoc {
  type: 'entry';
  id: string;
  date: PlainDate;
  part: DayPart;
  entry: Entry;
  item: Item | null;
  /** Null when the item is gone: such an entry is only found by its note or state. */
  itemKind: ItemKind | null;
  /** Name with the entry's own flavour, as the Day view shows it (the item's other flavours are found on the item card). */
  name: string;
  amount: string;
  partLabel: string;
  state: EntryState;
  /** Refused / Partly eaten, empty for a given entry. */
  stateWord: string;
  /** A second word that also finds the state ("Half eaten" for Partly eaten); shown after the tag when it is why it matched. */
  stateAlias: string;
  note: string;
  /** What is searched with no item kind chosen: the state and the note. */
  hayAlways: Hay;
  /** What is searched inside an item kind or an item: also name, flavours, kind word, amount and day part. */
  hayScoped: Hay;
}

export type DatedDoc = EventDoc | EntryDoc;

export interface ItemDoc {
  type: 'item';
  item: Item;
  kindWord: string;
  /** Item flavours (a flavour was offered for the item). */
  flavours: string[];
  count: number;
  last: PlainDate | null;
  hay: Hay;
}
export interface ConditionDoc {
  type: 'condition';
  condition: Condition;
  hay: Hay;
}
export interface PinnedDoc {
  type: 'pinned';
  note: PinnedNote;
  hay: Hay;
}

export interface SearchIndex {
  lang: Lang;
  /** Events and entries, newest first. */
  dated: DatedDoc[];
  items: ItemDoc[];
  conditions: ConditionDoc[];
  pinned: PinnedDoc[];
  /** One item's entries, newest first. */
  entriesOf: (itemId: string) => EntryDoc[];
  itemDoc: (itemId: string) => ItemDoc | undefined;
}

/** A built-in vet service is stored under the key of its event type (anal_glands, nails). */
const isKind = (a: string): a is 'anal_glands' | 'nails' => a === 'anal_glands' || a === 'nails';

export function buildIndex(input: IndexInput, ctx: IndexContext): SearchIndex {
  const { t, format: f, lang } = ctx;
  const haystack = (fields: readonly string[]) => makeHay(fields, lang);
  const word = (k: Exclude<Kind, 'tracked' | 'pinned'>) => nfc(t(TYPE_WORD[k]));
  const kindWords = (k: Kind): KindWords => {
    const alias = TYPE_ALIAS[k];
    return { kind: k, words: [word(k as Exclude<Kind, 'tracked' | 'pinned'>), ...(alias ? [nfc(t(alias))] : [])] };
  };
  const itemOrder = new Map(input.items.map((i, idx) => [i.id, idx]));
  const itemById = new Map(input.items.map((i) => [i.id, i]));
  const conditionById = new Map(input.conditions.map((c) => [c.id, c]));

  const stateWord = (s: EntryState) => (s === 'skipped' ? nfc(t('tagR')) : s === 'partial' ? nfc(t('name.98')) : '');

  const eventDocs: EventDoc[] = input.events.map((e) => {
    const photos = photosOf(e.id, input.photos);
    const docs = docsOf(e.id, input.documents).map((d) => nfc(d.name));
    const kinds: Kind[] = [e.type, ...(photos.length > 0 && e.type !== 'photo' ? (['photo'] as const) : []), ...(docs.length > 0 ? (['doc'] as const) : [])];
    const title = nfc(e.type === 'symptom' ? symptomLabel(e.title, t) : e.type === 'vet' ? e.title : f.eventTitle(e));
    const text = nfc(e.type === 'symptom' ? symptomDetail(e, t) : e.detail);
    const captions = photos.map((p) => nfc(p.caption)).filter(Boolean);
    const services = (e.alsoDone ?? []).map((a) => {
      const alias = isKind(a) ? TYPE_ALIAS[a] : undefined;
      return { label: nfc(serviceLabel(a, t)), ...(alias ? { alias: nfc(t(alias)) } : {}) };
    });
    const conditions = e.conditionIds.flatMap((id) => conditionById.get(id) ?? []);
    const words = kinds.map(kindWords);
    return {
      type: 'event',
      id: e.id,
      date: e.date,
      event: e,
      kinds,
      kindWords: words,
      title,
      text,
      captions,
      services,
      docs,
      conditions,
      firstPhoto: photos[0] ?? null,
      hay: haystack([title, ...words.flatMap((w) => w.words), text, ...services.flatMap((x) => [x.label, x.alias ?? '']), ...docs, ...conditions.map((c) => nfc(c.name)), ...captions]),
    };
  });

  const entryDocs: EntryDoc[] = input.entries.map((e) => {
    const item = itemById.get(e.itemId) ?? null;
    const name = nfc(f.name(item?.name ?? e.itemId, e.flavour));
    const amount = nfc(f.amount(e.amount, e.unit, item?.conversion, e.doseText ?? ''));
    const partLabel = nfc(f.part(e.dayPart));
    const sw = stateWord(e.state);
    const sa = e.state === 'partial' ? nfc(t('copy.72')) : '';
    const note = nfc(e.note);
    const itemKind = item?.kind ?? null;
    return {
      type: 'entry',
      id: e.id,
      date: e.date,
      part: e.dayPart,
      entry: e,
      item,
      itemKind,
      name,
      amount,
      partLabel,
      state: e.state,
      stateWord: sw,
      stateAlias: sa,
      note,
      hayAlways: haystack([sw, sa, note]),
      hayScoped: haystack([name, itemKind ? word(itemKind) : '', amount, partLabel, sw, sa, note]),
    };
  });

  const byEvent = (a: EventDoc, b: EventDoc) => EVENT_ORDER.indexOf(a.event.type) - EVENT_ORDER.indexOf(b.event.type) || a.id.localeCompare(b.id);
  const byEntry = (a: EntryDoc, b: EntryDoc) => (itemOrder.get(a.entry.itemId) ?? 1e9) - (itemOrder.get(b.entry.itemId) ?? 1e9) || a.id.localeCompare(b.id);
  // Newest day first; within a day the later day part first, and the day's events after its entries.
  const dated: DatedDoc[] = [...eventDocs, ...entryDocs].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    const pa = a.type === 'entry' ? a.part : 0;
    const pb = b.type === 'entry' ? b.part : 0;
    if (pa !== pb) return pb - pa;
    if (a.type === 'event' && b.type === 'event') return byEvent(a, b);
    if (a.type === 'entry' && b.type === 'entry') return byEntry(a, b);
    return 0;
  });

  const byItem = new Map<string, EntryDoc[]>();
  for (const d of dated) {
    if (d.type !== 'entry') continue;
    const list = byItem.get(d.entry.itemId);
    if (list) list.push(d);
    else byItem.set(d.entry.itemId, [d]);
  }

  const items: ItemDoc[] = input.items.map((item) => {
    const list = byItem.get(item.id) ?? [];
    const flavours = (item.flavours ?? []).map(nfc);
    const kindWord = word(item.kind);
    return {
      type: 'item',
      item,
      kindWord,
      flavours,
      count: list.length,
      last: list[0]?.date ?? null,
      hay: haystack([nfc(item.name), kindWord, ...flavours]),
    };
  });

  const conditions: ConditionDoc[] = [...openConditions(input.conditions), ...resolvedConditions(input.conditions)].map((c) => ({
    type: 'condition',
    condition: c,
    hay: haystack([nfc(c.name), nfc(c.description)]),
  }));
  const pinned: PinnedDoc[] = input.pinned.map((n) => ({ type: 'pinned', note: n, hay: haystack([nfc(n.title), nfc(n.body)]) }));

  const itemDocs = new Map(items.map((i) => [i.item.id, i]));
  return {
    lang,
    dated,
    items,
    conditions,
    pinned,
    entriesOf: (id) => byItem.get(id) ?? [],
    itemDoc: (id) => itemDocs.get(id),
  };
}

export interface SearchResult {
  /** Nothing typed (or fewer than 2 characters) and no filter: the idle card, no results. */
  idle: boolean;
  /** An item kind is chosen: entries are listed and their amount and day part are searched. */
  scoped: boolean;
  items: ItemDoc[];
  conditions: ConditionDoc[];
  pinned: PinnedDoc[];
  dated: DatedDoc[];
  total: number;
}

/**
 * Words and filters together: several kinds are a union, kinds and text are an AND. Text alone searches events,
 * item cards, tracked conditions, pinned notes and the entries that have a note or are refused / partly eaten.
 * An item kind lists that kind's entries and searches their amount and day part as well.
 */
export function runSearch(index: SearchIndex, tokens: readonly Token[], kinds: readonly Kind[]): SearchResult {
  const any = tokens.length > 0;
  const empty: SearchResult = { idle: true, scoped: false, items: [], conditions: [], pinned: [], dated: [], total: 0 };
  if (!any && kinds.length === 0) return empty;
  const itemKinds = kinds.filter(isItemKind);
  const scoped = itemKinds.length > 0;
  const wants = (k: Kind) => kinds.length === 0 || kinds.includes(k);

  const dated: DatedDoc[] = [];
  for (const d of index.dated) {
    if (d.type === 'event') {
      if (kinds.length > 0 && !d.kinds.some((k) => kinds.includes(k))) continue;
      if (!matchesAll(d.hay, tokens)) continue;
    } else if (scoped) {
      if (!d.itemKind || !itemKinds.includes(d.itemKind)) continue;
      if (!matchesAll(d.hayScoped, tokens)) continue;
    } else {
      // Without an item kind an entry is a result only for its note or a refused / partly eaten state.
      if (kinds.length > 0 || !any || (!d.stateWord && !d.note)) continue;
      if (!matchesAll(d.hayAlways, tokens)) continue;
    }
    dated.push(d);
  }
  const items = index.items.filter((i) => (kinds.length === 0 || itemKinds.includes(i.item.kind)) && matchesAll(i.hay, tokens));
  const conditions = wants('tracked') && (kinds.includes('tracked') || any) ? index.conditions.filter((c) => matchesAll(c.hay, tokens)) : [];
  const pinned = wants('pinned') && (kinds.includes('pinned') || any) ? index.pinned.filter((p) => matchesAll(p.hay, tokens)) : [];
  return { idle: false, scoped, items, conditions, pinned, dated, total: dated.length + items.length + conditions.length + pinned.length };
}
