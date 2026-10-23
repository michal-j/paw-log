// Fictional log for the Search tests (JCB-138): every one of the 17 kinds has something to find, free text in Polish where the
// Polish stem rule is tested, and a generator for a year and more of meals and medication. Nothing here is real data.
import type { Condition, DayPart, DocFile, Entry, EntryState, HealthEvent, Item, Photo, PinnedNote, Unit } from '../../src/data';
import { translate, type Lang } from '../../src/i18n';
import { makeFormat } from '../../src/log/format';
import { buildIndex, type IndexInput } from '../../src/search';
import { shiftDate } from '../../src/timeline/model';

export const DOG = 'dog-test';

const item = (id: string, kind: Item['kind'], name: string, colour: string, extra: Partial<Item> = {}): Item => ({
  id, dogId: DOG, kind, name, colour, defaultDayPart: 2, activeFrom: '2025-01-01', activeTo: null, ...extra,
});
export const ITEMS: Item[] = [
  item('cooked', 'food', 'Cooked meal', 'food-cooked', { position: 10 }),
  item('farm', 'food', 'Farm Fresh', 'food-farm', { position: 20, flavours: ['turkey'] }),
  item('ocean', 'food', 'Ocean Blend', 'food-ocean', { position: 30, flavours: ['salmon'] }),
  item('arvelin', 'medication', 'Arvelin', 'med-arvelin', { position: 40 }),
  item('bellavet', 'medication', 'Bellavet', 'med-bellavet', { position: 50, conversion: { unit: 'bars', size: 0.1 } }),
  item('biomend', 'supplement', 'Biomend', 'med-biomend', { position: 60 }),
  item('treat', 'treat', 'Treats', 'treat', { position: 70, hiddenByDefault: true, flavours: ['chicken'] }),
  item('ears', 'procedure', 'Ear cleaning', 'mark-neutral', { position: 80 }),
];

let n = 0;
const entry = (date: string, part: DayPart, itemId: string, amount: number | null, unit: Unit | null, state: EntryState = 'given', note = '', flavour = ''): Entry => ({
  id: `en-${++n}`, dogId: DOG, date, dayPart: part, itemId, amount, unit, flavour, state, note, createdBy: 'u',
});
export const ENTRIES: Entry[] = [
  entry('2026-10-14', 2, 'arvelin', 0.5, 'pill'),
  entry('2026-10-14', 2, 'bellavet', 0.15, 'ml'),
  entry('2026-10-14', 4, 'ocean', 1, 'can', 'partial', 'Walked away from the bowl.', 'salmon'),
  entry('2026-10-14', 6, 'farm', 1, 'can', 'given', '', 'turkey'),
  entry('2026-10-13', 4, 'farm', 1, 'can', 'skipped'),
  entry('2026-10-13', 1, 'arvelin', 0.5, 'pill', 'given', 'Spat it out, gave it again in cheese.'),
  entry('2026-10-12', 2, 'biomend', 1, 'pill'),
  entry('2026-10-12', 3, 'treat', 1, 'piece', 'given', '', 'chicken'),
  entry('2026-10-07', 3, 'ears', 1, 'piece'),
  entry('2026-09-30', 3, 'ears', 1, 'piece'),
  entry('2026-09-01', 4, 'cooked', 1, 'tray'),
];

const event = (id: string, date: string, type: HealthEvent['type'], title: string, detail: string, extra: Partial<HealthEvent> = {}): HealthEvent => ({
  id, dogId: DOG, date, type, title, detail, conditionIds: [], ...extra,
});
export const EVENTS: HealthEvent[] = [
  event('frontline', '2026-09-08', 'frontline', '', 'Monthly flea and tick treatment given.'),
  event('deworm', '2026-09-12', 'deworming', '', 'Given every 6 months.'),
  event('reflux', '2026-09-20', 'symptom', 'Reflux', '', { intensity: 'medium', conditionIds: ['stomach'] }),
  event('anal', '2026-09-22', 'anal_glands', '', 'Done at home, nothing unusual.'),
  event('nails', '2026-10-01', 'nails', '', 'Front paws only.'),
  event('photo', '2026-10-03', 'photo', '', 'About 1 cm, soft, moves under the skin.', { conditionIds: ['lump'] }),
  event('poo', '2026-10-06', 'symptom', 'Poo', '', { props: { consistency: 'diarrhea', colour: 'dark', quantity: 'medium' } }),
  event('heartburn', '2026-10-09', 'symptom', 'Heartburn', 'Licked her lips after dinner.', { intensity: 'medium' }),
  event('note', '2026-10-12', 'note', '', 'Sample sent to the lab on 10 Oct.', { conditionIds: ['lump'] }),
  event('bath', '2026-10-13', 'other', 'Bath', 'Oatmeal shampoo.'),
  event('rest', '2026-10-14', 'symptom', 'Restlessness', 'Refused breakfast. Weak on walks.', { intensity: 'large', conditionIds: ['stomach'] }),
  event('maple', '2026-10-14', 'vet', 'Maple Vet', 'Stomach ultrasound, limb check. Gastrelle prescribed.', { conditionIds: ['stomach'] }),
  event('riverside', '2026-10-14', 'vet', 'Riverside Vet', 'Blood pressure check: high.', { alsoDone: ['anal_glands', 'nails', 'Ear cleaning'] }),
  event('zoladek', '2026-10-15', 'note', '', 'Dziś żołądkiem gorzej, nie chciała jeść.', { conditionIds: [] }),
];

export const PHOTOS: Photo[] = [
  { id: 'ph1', dogId: DOG, eventId: 'photo', width: 100, height: 100, takenAt: null, caption: '', position: 0 },
  { id: 'ph2', dogId: DOG, eventId: 'rest', width: 100, height: 100, takenAt: null, caption: 'Ruler next to the lump', position: 0 },
];
const doc = (id: string, eventId: string, name: string, sizeBytes = 41234, pageCount: number | null = 3): DocFile => ({ id, dogId: DOG, eventId, name, sizeBytes, pageCount, position: 0 });
export const DOCUMENTS: DocFile[] = [doc('d1', 'maple', 'Ultrasound report'), doc('d2', 'note', 'Cytology result', 999999, 12)];

export const CONDITIONS: Condition[] = [
  { id: 'lump', dogId: DOG, name: 'Lump A', startedOn: '2026-10-03', description: 'Small soft lump on the left side of the chest.', resolvedOn: null, position: 0 },
  { id: 'stomach', dogId: DOG, name: 'Problemy z żołądkiem', startedOn: '2026-10-12', description: 'Burczenie i miękka kupa.', resolvedOn: null, position: 0 },
  { id: 'reflux', dogId: DOG, name: 'Reflux', startedOn: '2026-09-20', description: 'Reflux and panting at night.', resolvedOn: '2026-09-30', position: 0 },
];
export const PINNED: PinnedNote[] = [
  { id: 'p1', dogId: DOG, title: 'Allergies', body: 'None known. Watch for itching after any new food.', position: 0 },
  { id: 'p2', dogId: DOG, title: 'Bellavet dose', body: 'Measured in bars on the syringe: 1 bar = 0,1 ml.', position: 1 },
  { id: 'p3', dogId: DOG, title: '', body: 'Gastrelle: mix the sachet into a spoon of wet food.', position: 2 },
];

export const input = (): IndexInput => ({
  events: EVENTS, entries: ENTRIES, items: ITEMS, photos: PHOTOS, documents: DOCUMENTS, conditions: CONDITIONS, pinned: PINNED,
});

/** The pure pieces of the UI for a language, so the index can be built without React. */
export const contextFor = (lang: Lang) => {
  const t = (k: Parameters<typeof translate>[1]) => translate(lang, k);
  return { lang, t, format: makeFormat(lang, t, 2026) };
};
export const indexFor = (lang: Lang = 'en', data: IndexInput = input()) => buildIndex(data, contextFor(lang));

/** A year and more of life: every day breakfast, dinner and supper, three medications, now and then an event or a note. */
export function longLog(days = 500, today = '2026-10-15'): IndexInput {
  const entries: Entry[] = [];
  const events: HealthEvent[] = [];
  const parts: DayPart[] = [2, 4, 6];
  for (let d = 0; d < days; d++) {
    const date = shiftDate(today, -d);
    parts.forEach((p, i) => {
      entries.push(entry(date, p, ['cooked', 'farm', 'ocean'][(d + i) % 3]!, 1, 'can', d % 11 === 0 && i === 1 ? 'partial' : 'given', d % 17 === 0 ? 'Ate slowly today.' : ''));
    });
    entries.push(entry(date, 1, 'arvelin', 0.5, 'pill'), entry(date, 2, 'bellavet', 0.15, 'ml'), entry(date, 3, 'biomend', 1, 'pill'));
    if (d % 9 === 0) events.push(event(`lg-s-${d}`, date, 'symptom', 'Heartburn', 'After dinner.', { intensity: 'small' }));
    if (d % 40 === 0) events.push(event(`lg-v-${d}`, date, 'vet', 'Maple Vet', 'Check-up and weight.', { alsoDone: ['nails'] }));
  }
  return { ...input(), entries: [...entries, ...ENTRIES], events: [...events, ...EVENTS] };
}
