// Search (JCB-138): the matcher, the index and what is searched, as unit tests. The UI flows are in tests/searchApp.test.tsx.
import { describe, expect, it } from 'vitest';
import type { Lang } from '../src/i18n';
import { runSearch, type SearchIndex } from '../src/search';
import { ALL_KINDS, KIND_GROUPS, KIND_LABEL, TYPE_WORD, type Kind } from '../src/search/kinds';
import { highlight, markRanges, nfc, norm, snippet, starts, tokensOf } from '../src/search/text';
import { indexFor as indexForMemo } from '../src/search/memory';
import { translate } from '../src/i18n';
import { ENTRIES, EVENTS, contextFor, indexFor, input, longLog } from './fixtures/searchLog';

const find = (index: SearchIndex, q: string, kinds: Kind[] = [], lang: Lang = 'en') => runSearch(index, tokensOf(q, lang), kinds);
const eventIds = (r: ReturnType<typeof runSearch>) => r.dated.filter((d) => d.type === 'event').map((d) => d.id);
const entryCount = (r: ReturnType<typeof runSearch>) => r.dated.filter((d) => d.type === 'entry').length;
const shown = (text: string, q: string, lang: Lang = 'en') => highlight(text, tokensOf(q, lang)).filter((p) => p.hit).map((p) => p.text);

const en = indexFor('en');
const pl = indexFor('pl');

describe('norm', () => {
  it('ignores case and diacritics, ł included, one unit in and one out', () => {
    expect(norm('Żołądek')).toBe('zoladek');
    expect(norm('ŁÓDŹ ąęćńśźż')).toBe('lodz aecnszz');
    expect(norm('Maple Vet')).toBe('maple vet');
    for (const s of ['Żołądek', 'a😀b', 'Zażółć gęślą jaźń', 'İstanbul']) expect(norm(s).length).toBe(s.length);
  });
  it('keeps characters outside the BMP as they are, so positions stay in step', () => {
    expect(norm('😀 Stomach')).toBe('😀 stomach');
  });
  it('composes decomposed text first (a + combining ogonek is ą)', () => {
    const decomposed = 'zołądek'.normalize('NFD');
    expect(norm(nfc(decomposed))).toBe('zoladek');
  });
});

describe('tokensOf', () => {
  it('needs 2 characters in all and then splits into words', () => {
    expect(tokensOf('', 'en')).toEqual([]);
    expect(tokensOf(' a ', 'en')).toEqual([]);
    expect(tokensOf('ab', 'en')).toEqual(['ab']);
    expect(tokensOf('  Vet   VISIT ', 'en')).toEqual(['vet', 'visit']);
    expect(tokensOf('a b', 'en')).toEqual(['a', 'b']);
  });
  it('Polish: a word of 6 or more letters loses its last 2; shorter ones, digits and English stay whole', () => {
    expect(tokensOf('żołądkiem', 'pl')).toEqual(['zoladki']);
    expect(tokensOf('żołądek', 'pl')).toEqual(['zolad']);
    expect(tokensOf('wizyta', 'pl')).toEqual(['wizy']);
    expect(tokensOf('pazury', 'pl')).toEqual(['pazu']);
    expect(tokensOf('weta', 'pl')).toEqual(['weta']);
    expect(tokensOf('żołąd', 'pl')).toEqual(['zolad']);
    expect(tokensOf('150-160', 'pl')).toEqual(['150-160']);
    expect(tokensOf('stomach', 'en')).toEqual(['stomach']);
    expect(tokensOf('wizyta', 'en')).toEqual(['wizyta']);
  });
});

describe('starts', () => {
  it('only at the start of a word', () => {
    expect(starts(norm('Stomach trouble'), 'sto')).toEqual([0]);
    expect(starts(norm('nieistotna'), 'sto')).toEqual([]);
    expect(starts(norm('a stomach, a sto'), 'sto')).toEqual([2, 13]);
    expect(starts(norm('Poo (soft)'), 'soft')).toEqual([5]);
    expect(starts(norm('11,5 bars'), '1,5')).toEqual([]);
    expect(starts(norm('1,5 bars'), '1,5')).toEqual([0]);
  });
});

describe('highlight', () => {
  it('marks exactly the matched word starts, also the Polish stem', () => {
    expect(shown('Wizyta u weta', 'wizyta', 'pl')).toEqual(['Wizy']);
    expect(shown('Pazury', 'pazury', 'pl')).toEqual(['Pazu']);
    expect(shown('Problemy z żołądkiem', 'zoladek', 'pl')).toEqual(['żołąd']);
    expect(shown('Problemy z żołądkiem', 'żołądka', 'pl')).toEqual(['żołąd']);
  });
  it('marks every occurrence of every word and merges neighbours', () => {
    expect(shown('Stomach rumbling, stomach again', 'stomach')).toEqual(['Stomach', 'stomach']);
    expect(shown('Maple Vet visit', 'vet vi')).toEqual(['Vet', 'vi']);
    expect(highlight('stomach', tokensOf('sto stom', 'en'))).toEqual([{ text: 'stom', hit: true }, { text: 'ach', hit: false }]);
  });
  it('keeps the text intact and the ranges right behind an emoji or a decomposed letter', () => {
    const text = '😀 Zażółć żołądek';
    const pieces = highlight(text, tokensOf('zoladek', 'en'));
    expect(pieces.map((p) => p.text).join('')).toBe(text);
    expect(pieces.filter((p) => p.hit).map((p) => p.text)).toEqual(['żołądek']);
    expect(highlight('zołądek'.normalize('NFD'), tokensOf('zoladek', 'en')).filter((p) => p.hit).map((p) => p.text)).toEqual(['zołądek']);
  });
  it('is blind to case and diacritics', () => {
    expect(shown('ŻOŁĄDEK', 'zoladek')).toEqual(['ŻOŁĄDEK']);
    expect(markRanges('Żołądek', tokensOf('ZOLA', 'en'))).toEqual([[0, 4]]);
  });
  it('nothing typed, nothing marked', () => {
    expect(highlight('Maple Vet', [])).toEqual([{ text: 'Maple Vet', hit: false }]);
    expect(highlight('', ['a'])).toEqual([]);
  });
});

describe('snippet', () => {
  const long = `${'Ate slowly and then walked about. '.repeat(5)}The stomach was rumbling after dinner. ${'More text follows here. '.repeat(4)}`;
  it('starts shortly before the first match and keeps the match', () => {
    const s = snippet(long, tokensOf('stomach', 'en'));
    expect(s.startsWith('…')).toBe(true);
    expect(s).toContain('stomach was rumbling');
    expect(s.length).toBeLessThan(long.length);
  });
  it('leaves a short text, a match near the start and a text without a match alone', () => {
    expect(snippet('Short text', tokensOf('text', 'en'))).toBe('Short text');
    expect(snippet(long, tokensOf('ate', 'en'))).toBe(long);
    expect(snippet(long, tokensOf('zzz', 'en'))).toBe(long);
    expect(snippet(long, [])).toBe(long);
  });
  it('never cuts the match off when there is no space before it', () => {
    const t = `${'x'.repeat(100)}stomach${' y'.repeat(20)}`;
    expect(snippet(t, tokensOf('stomach', 'en'))).toContain('stomach');
  });
});

describe('what text finds', () => {
  it('matches at word start, every word, from 2 characters', () => {
    expect(eventIds(find(en, 'sto'))).toContain('maple'); // Stomach ultrasound
    expect(find(en, 'toma').total).toBe(0); // inside a word
    expect(find(en, 'stomach ultra').dated.map((d) => d.id)).toContain('maple');
    expect(find(en, 'stomach zzz').total).toBe(0);
    expect(find(en, 's').idle).toBe(true);
  });

  it('is blind to case and diacritics, in Polish and English alike', () => {
    expect(find(pl, 'ZOLADEK', [], 'pl').conditions.map((c) => c.condition.id)).toEqual(['stomach']);
    expect(find(en, 'zoladk', [], 'en').conditions.map((c) => c.condition.id)).toEqual(['stomach']);
    expect(find(en, 'ŻOŁĄDK').conditions.length).toBe(1);
  });

  it('Polish stems: żołądek, żołądka and żołądkiem find the same things', () => {
    for (const q of ['żołądek', 'żołądka', 'żołądkiem', 'zoladkiem', 'ŻOŁĄDKU']) {
      const r = find(pl, q, [], 'pl');
      expect(r.conditions.map((c) => c.condition.id), q).toEqual(['stomach']);
      expect(eventIds(r), q).toContain('zoladek'); // "żołądkiem" in a note
    }
  });
  it('the stem is off in English', () => {
    expect(find(en, 'żołądkiem', [], 'en').conditions.map((c) => c.condition.id)).toEqual(['stomach']);
    expect(find(en, 'żołądk', [], 'en').conditions.length).toBe(1);
    expect(find(en, 'żołądkow', [], 'en').total).toBe(0);
  });

  it('finds an item by its name or flavour, and gives the item card', () => {
    expect(find(en, 'bellavet').items.map((i) => i.item.id)).toEqual(['bellavet']);
    expect(find(en, 'turkey').items.map((i) => i.item.id)).toEqual(['farm']);
    expect(find(en, 'salmon').items.map((i) => i.item.id)).toEqual(['ocean']);
    expect(find(en, 'ear clean').items.map((i) => i.item.id)).toEqual(['ears']);
  });

  it('finds vet clinics, services (built-in and own), symptom properties, captions, linked conditions and document names', () => {
    expect(eventIds(find(en, 'riverside'))).toEqual(['riverside']);
    expect(eventIds(find(en, 'ear cleaning'))).toContain('riverside'); // an own service
    expect(eventIds(find(en, 'anal glands'))).toEqual(expect.arrayContaining(['riverside', 'anal']));
    expect(eventIds(find(en, 'diarrhoea'))).toEqual([]); // the app writes "diarrhea"
    expect(eventIds(find(en, 'diarrhea'))).toEqual(['poo']);
    expect(eventIds(find(en, 'dark'))).toEqual(['poo']);
    expect(eventIds(find(en, 'ruler'))).toEqual(['rest']); // a photo caption on another event
    expect(eventIds(find(en, 'lump a'))).toEqual(expect.arrayContaining(['photo', 'note']));
    expect(eventIds(find(en, 'ultrasound report'))).toEqual(['maple']);
    expect(eventIds(find(en, 'cytology'))).toEqual(['note']);
  });

  it('finds a tracked condition by name or description, a pinned note by title or text', () => {
    expect(find(en, 'lump').conditions.map((c) => c.condition.id)).toEqual(['lump']);
    expect(find(en, 'panting').conditions.map((c) => c.condition.id)).toEqual(['reflux']); // resolved, still found
    expect(find(en, 'allergies').pinned.map((p) => p.note.id)).toEqual(['p1']);
    expect(find(en, 'syringe').pinned.map((p) => p.note.id)).toEqual(['p2']);
    expect(find(en, 'sachet').pinned.map((p) => p.note.id)).toEqual(['p3']); // a note without a title
  });

  it('finds the entries that have a note or are refused / partly eaten, from anywhere', () => {
    const refused = find(en, 'refused');
    expect(refused.dated.filter((d) => d.type === 'entry').map((d) => d.id)).toEqual([ENTRIES[4]!.id]);
    expect(eventIds(refused)).toContain('rest'); // "Refused breakfast" in a symptom
    expect(find(en, 'partly').dated.filter((d) => d.type === 'entry').length).toBe(1);
    expect(find(en, 'spat').dated.map((d) => d.id)).toEqual([ENTRIES[5]!.id]);
  });
});

describe('type words', () => {
  it('are searched as text in the current language', () => {
    for (const [q, kind] of [['vet visit', 'vet'], ['symptom', 'symptom'], ['deworming', 'deworming'], ['frontline', 'frontline'], ['photo', 'photo'], ['note', 'note'], ['anal glands expressed', 'anal_glands'], ['nail trimming', 'nails']] as const) {
      const r = find(en, q);
      expect(r.dated.some((d) => d.type === 'event' && d.event.type === kind), q).toBe(true);
    }
    for (const [q, kind] of [['wizyta u weta', 'vet'], ['objaw', 'symptom'], ['odrobaczanie', 'deworming'], ['zdjęcie', 'photo'], ['notatka', 'note'], ['pazury', 'nails']] as const) {
      const r = find(pl, q, [], 'pl');
      expect(r.dated.some((d) => d.type === 'event' && d.event.type === kind), q).toBe(true);
    }
  });
  it('"vet visit" finds the visits and only them; "visit" alone too', () => {
    expect(eventIds(find(en, 'vet visit')).sort()).toEqual(['maple', 'riverside']);
    expect(eventIds(find(en, 'visit')).sort()).toEqual(['maple', 'riverside']);
  });
  it('"nails" also finds the Nail trimming event through its short word, and the visits that did nails', () => {
    expect(eventIds(find(en, 'nails')).sort()).toEqual(['nails', 'riverside']);
    expect(eventIds(find(pl, 'pazury', [], 'pl')).sort()).toEqual(['nails', 'riverside']);
  });
  it('"pdf" and "document" find the events that carry a PDF; photo finds events with photos', () => {
    expect(eventIds(find(en, 'pdf')).sort()).toEqual(['maple', 'note']);
    expect(eventIds(find(en, 'document')).sort()).toEqual(['maple', 'note']);
    expect(eventIds(find(en, 'photo')).sort()).toEqual(['photo', 'rest']);
  });
  it('item kind words find the item cards of that kind', () => {
    expect(find(en, 'food').items.map((i) => i.item.id).sort()).toEqual(['cooked', 'farm', 'ocean']);
    expect(find(en, 'supplement').items.map((i) => i.item.id)).toEqual(['biomend']);
    expect(find(en, 'procedure').items.map((i) => i.item.id)).toEqual(['ears']);
    expect(find(en, 'treat').items.map((i) => i.item.id)).toEqual(['treat']);
    expect(find(pl, 'jedzenie', [], 'pl').items.length).toBe(3);
  });
  it('the Polish stem trims the type words too (wizyta finds on "wizy")', () => {
    expect(eventIds(find(pl, 'wizyta', [], 'pl')).sort()).toEqual(['maple', 'riverside']);
  });
});

describe('scoping (README table)', () => {
  it('amounts and day parts are not searched globally ...', () => {
    expect(find(en, 'pill').total).toBe(0);
    expect(find(en, '0,15').total).toBe(0);
    expect(find(en, 'dinner').dated.filter((d) => d.type === 'entry')).toEqual([]);
    expect(find(en, 'breakfast').dated.filter((d) => d.type === 'entry')).toEqual([]);
    expect(find(en, 'can').total).toBe(0);
  });
  it('... but inside an item kind', () => {
    expect(entryCount(find(en, 'pill', ['medication']))).toBe(2);
    expect(entryCount(find(en, '0,15', ['medication']))).toBe(1);
    expect(entryCount(find(en, 'dinner', ['food']))).toBe(3); // the part-4 entries of food
    expect(entryCount(find(en, 'breakfast', ['medication']))).toBeGreaterThan(0);
    expect(entryCount(find(en, 'dinner', ['medication']))).toBe(0);
  });
  it('the entry\'s own item name only through the item card, or with an item kind', () => {
    expect(entryCount(find(en, 'arvelin'))).toBe(0); // the entry with a note does not carry its item's name
    expect(find(en, 'arvelin').items.length).toBe(1);
    expect(entryCount(find(en, 'arvelin', ['medication']))).toBe(2);
  });
  it('the state "Given" is not searched; Refused and Partly eaten are', () => {
    expect(entryCount(find(en, 'given'))).toBe(0);
    expect(entryCount(find(en, 'given', ['medication']))).toBe(0);
    expect(entryCount(find(en, 'refused', ['food']))).toBe(1);
  });
  it('dates are not searched', () => {
    for (const q of ['14 Oct', '2026-10-14', 'Wed', 'October', '2026']) expect(find(en, q).total, q).toBe(0);
  });
  it('document size and page count, usual-day plans and technical fields are not searched', () => {
    expect(find(en, '41 KB').total).toBe(0);
    expect(find(en, '12 pages').total).toBe(0);
    expect(find(en, 'dog-test').total).toBe(0);
    expect(find(en, 'ph1').total).toBe(0);
  });
  it('item flavours find the item card; an entry carries only the flavour it was logged with', () => {
    expect(find(en, 'turkey', ['food']).items.map((i) => i.item.id)).toEqual(['farm']);
    expect(entryCount(find(en, 'turkey', ['food']))).toBe(1); // the one logged as turkey
    expect(entryCount(find(en, 'salmon', ['food']))).toBe(1);
    expect(entryCount(find(en, 'turkey'))).toBe(0);
  });
  it('the Timeline filters do not apply: treats are found', () => {
    expect(find(en, 'treats').items.map((i) => i.item.id)).toEqual(['treat']);
    expect(entryCount(find(en, 'chicken', ['treat']))).toBe(1);
  });
});

describe('filters', () => {
  it('has 17 kinds, each with a label, in three groups', () => {
    expect(ALL_KINDS.length).toBe(17);
    expect(new Set(ALL_KINDS).size).toBe(17);
    expect(KIND_GROUPS.events.length + KIND_GROUPS.items.length + KIND_GROUPS.off.length).toBe(17);
    for (const k of ALL_KINDS) expect(translate('en', KIND_LABEL[k]) && translate('pl', KIND_LABEL[k])).toBeTruthy();
    for (const k of Object.keys(TYPE_WORD)) expect(translate('en', TYPE_WORD[k as keyof typeof TYPE_WORD])).not.toMatch(/^typeWord_/);
  });

  it('every kind lists its whole history with nothing typed', () => {
    const events: Partial<Record<Kind, number>> = { vet: 2, symptom: 4, note: 2, photo: 2, doc: 2, frontline: 1, deworming: 1, anal_glands: 1, nails: 1, other: 1 };
    for (const [k, count] of Object.entries(events)) {
      const r = find(en, '', [k as Kind]);
      expect(r.idle, k).toBe(false);
      expect(eventIds(r).length, k).toBe(count);
    }
    expect(find(en, '', ['tracked']).conditions.length).toBe(3); // open and resolved
    expect(find(en, '', ['pinned']).pinned.length).toBe(3);
    expect(find(en, '', ['food']).items.length).toBe(3);
    expect(find(en, '', ['medication']).items.length).toBe(2);
    expect(find(en, '', ['supplement']).items.length).toBe(1);
    expect(find(en, '', ['treat']).items.length).toBe(1);
    expect(find(en, '', ['procedure']).items.length).toBe(1);
  });

  it('an item kind with nothing typed lists the item cards and every entry of that kind, newest first', () => {
    const r = find(en, '', ['food']);
    expect(r.scoped).toBe(true);
    expect(r.items.length).toBe(3);
    const entries = r.dated.filter((d) => d.type === 'entry');
    expect(entries.length).toBe(ENTRIES.filter((e) => ['cooked', 'farm', 'ocean'].includes(e.itemId)).length);
    const dates = entries.map((d) => d.date);
    expect(dates).toEqual([...dates].sort().reverse());
    expect(eventIds(r)).toEqual([]);
  });

  it('kind filter = union of its items\' histories; an item history = one item', () => {
    const kind = find(en, '', ['food']).dated.filter((d) => d.type === 'entry').map((d) => d.id).sort();
    const union = ['cooked', 'farm', 'ocean'].flatMap((id) => en.entriesOf(id).map((d) => d.id)).sort();
    expect(kind).toEqual(union);
    expect(en.entriesOf('farm').map((d) => d.entry.itemId)).toEqual(['farm', 'farm']);
    const dates = en.entriesOf('farm').map((d) => d.date);
    expect(dates).toEqual([...dates].sort().reverse());
  });

  it('several kinds are a union', () => {
    const r = find(en, '', ['vet', 'frontline']);
    expect(eventIds(r).sort()).toEqual(['frontline', 'maple', 'riverside']);
    const mixed = find(en, '', ['vet', 'food', 'tracked']);
    expect(eventIds(mixed).sort()).toEqual(['maple', 'riverside']);
    expect(mixed.items.length).toBe(3);
    expect(mixed.conditions.length).toBe(3);
    expect(entryCount(mixed)).toBeGreaterThan(0);
  });

  it('kinds and text are an AND', () => {
    expect(eventIds(find(en, 'stomach', ['vet'])).sort()).toEqual(['maple']);
    expect(eventIds(find(en, 'stomach', ['symptom']))).toEqual([]);
    expect(find(en, 'lump', ['note']).conditions).toEqual([]); // Tracked is not among the kinds
    expect(find(en, 'lump', ['note', 'tracked']).conditions.length).toBe(1);
    expect(eventIds(find(en, 'lump', ['note', 'tracked']))).toEqual(['note']);
    expect(entryCount(find(en, 'bellavet', ['medication']))).toBe(1);
    expect(find(en, 'bellavet', ['medication']).items.length).toBe(1);
    expect(find(en, 'bellavet', ['food']).total).toBe(0);
  });

  it('Documents and Photos are the events that carry them, whatever their own type', () => {
    expect(eventIds(find(en, '', ['doc'])).sort()).toEqual(['maple', 'note']);
    expect(eventIds(find(en, '', ['photo'])).sort()).toEqual(['photo', 'rest']);
    expect(eventIds(find(en, 'ruler', ['photo']))).toEqual(['rest']);
  });

  it('a kind with nothing logged is an empty result, not the idle state', () => {
    const r = find(en, 'vaccine', ['other']);
    expect(r.idle).toBe(false);
    expect(r.total).toBe(0);
    expect(find(en, '', ['other']).total).toBe(1);
  });

  it('nothing typed and no kind is idle', () => {
    expect(find(en, '').idle).toBe(true);
    expect(find(en, ' x ').idle).toBe(true);
    expect(find(en, '', []).total).toBe(0);
  });
});

describe('order and counts', () => {
  it('dated results are newest first; within a day the later day part first, events after the entries', () => {
    const r = find(en, '', ['vet', 'food']);
    const dates = r.dated.map((d) => d.date);
    expect(dates).toEqual([...dates].sort().reverse());
    const day = r.dated.filter((d) => d.date === '2026-10-14');
    const kinds = day.map((d) => (d.type === 'entry' ? `p${d.part}` : 'event'));
    expect(kinds).toEqual(['p6', 'p4', 'event', 'event']);
  });
  it('the total counts every result: items, tracked, pinned and dated', () => {
    const r = find(en, 'stomach');
    expect(r.total).toBe(r.items.length + r.conditions.length + r.pinned.length + r.dated.length);
  });
});

describe('index', () => {
  it('is built once per loaded records object and language, not per search', () => {
    const records = input();
    const ctx = contextFor('en');
    const a = indexForMemo(records, 'en', ctx.t, ctx.format);
    for (let i = 0; i < 25; i++) runSearch(a, tokensOf('stomach', 'en'), []);
    expect(indexForMemo(records, 'en', ctx.t, ctx.format)).toBe(a);
    expect(indexForMemo(records, 'pl', contextFor('pl').t, contextFor('pl').format)).not.toBe(a);
    expect(indexForMemo({ ...records }, 'en', ctx.t, ctx.format)).not.toBe(a); // a reload gives new records
  });
  it('type words follow the language', () => {
    expect(eventIds(find(en, 'wizyta'))).toEqual([]);
    expect(eventIds(find(pl, 'vet visit', [], 'pl'))).toEqual([]);
  });
});

describe('a year and more of data', () => {
  const data = longLog(520);
  it('builds the index in reasonable time and searches it fast', () => {
    const t0 = performance.now();
    const index = indexFor('en', data);
    const built = performance.now() - t0;
    expect(index.dated.length).toBeGreaterThan(3000);
    expect(built).toBeLessThan(3000);
    const t1 = performance.now();
    for (const q of ['stomach', 'ate slowly', 'maple vet', 'heartburn', 'sto']) find(index, q);
    for (const q of ['pill', 'dinner', '0,15']) find(index, q, ['medication', 'food']);
    expect((performance.now() - t1) / 8).toBeLessThan(150);
  });
  it('lists the whole history of a kind, every meal ever logged', () => {
    const index = indexFor('en', data);
    const r = find(index, '', ['food']);
    expect(entryCount(r)).toBe(data.entries.filter((e) => ['cooked', 'farm', 'ocean'].includes(e.itemId)).length);
    expect(entryCount(r)).toBeGreaterThan(1500);
    expect(find(index, 'ate slowly').dated.length).toBe(data.entries.filter((e) => e.note.startsWith('Ate slowly')).length);
  });
  it('sorts a long log newest first', () => {
    const r = find(indexFor('en', data), '', ['food']);
    const dates = r.dated.map((d) => d.date);
    expect(dates).toEqual([...dates].sort().reverse());
  });
});

it('EVENTS fixture covers all nine event types', () => {
  expect(new Set(EVENTS.map((e) => e.type)).size).toBe(9);
});
