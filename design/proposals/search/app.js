'use strict';
/* PawLog Search proposal (JCB-138, revision 2: full coverage of the data model). Fictional data from docs/PRODUCT.md and data/demo
   (sample-data.js is the demo entries). Prototype clock: Thu 15 Oct 2026. Prototype-only additions to the demo data are marked (proto).
   Strings marked (app) already exist in the reviewed copy; the rest are in docs/copy/copy-proposal-search.csv. */

const MONTHS = {
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  pl: ['sty', 'lut', 'mar', 'kwi', 'maj', 'cze', 'lip', 'sie', 'wrz', 'paź', 'lis', 'gru'],
};
const MONTH_NAMES = {
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  pl: ['styczeń', 'luty', 'marzec', 'kwiecień', 'maj', 'czerwiec', 'lipiec', 'sierpień', 'wrzesień', 'październik', 'listopad', 'grudzień'],
};
const DAYS = { en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], pl: ['niedz.', 'pon.', 'wt.', 'śr.', 'czw.', 'pt.', 'sob.'] };
const PAGE = 6; // results shown before "Show more" (20 in the build; 6 here so the demo shows the button)

const L = {
  en: {
    timeline: 'Timeline', pinned: 'Pinned', add: 'Add', tracked: 'Tracked', search: 'Search', menu: 'Menu', back: 'Back', close: 'Close', done: 'Done', clearAll: 'Clear',
    kVet: 'Vet visits', kSym: 'Symptoms', kNotes: 'Notes', kPhotos: 'Photos', kOther: 'Other', kFront: 'Frontline', kWorm: 'Deworming', kFood: 'Food', kMed: 'Medications', kTreat: 'Treats',
    visit: 'Vet visit', loading: 'Loading…', loadFailed: 'Could not load. Check the connection.', retry: 'Try again',
    refused: 'Refused', half: 'Half eaten', condSince: 'Since {d}', happened: 'What happened',
    brk: 'Breakfast', dinner: 'Dinner', supper: 'Supper', before: 'Before breakfast', mid: 'Between breakfast and dinner', mid2: 'Between dinner and supper', after: 'After supper',
    entries_one: '1 entry', entries_few: '{n} entries', entries_many: '{n} entries', anal: 'Anal glands expressed', nails: 'Nail trimming',
    pinnedNote: 'Pinned note', meals: 'Meals and medication',
    // new (S1..)
    fieldLabel: 'Search the log', clear: 'Clear search', hint: 'Search all days at once. Type a word, or use Filters to list everything of one kind.',
    results_one: '1 result', results_few: '{n} results', results_many: '{n} results',
    noneTitle: 'Nothing found for “{q}”', noneHint: 'Check the spelling, try a shorter word or clear the filters.', 
    noneKind: 'No entries of this kind yet.', more: 'Show {n} more', items: 'Items', last: 'Last {d}',
    filters: 'Filters', filtersOn: 'Filters, {n} on', filtersHint: 'Show only these. Nothing picked shows everything.', showResults: 'Show results ({n})', noneAll: 'Clear filters', gEvents: 'Events', gItems: 'Food, medication and care items', gOff: 'Not on a day',
    kDoc: 'Documents', kAnal: 'Anal glands', kNailsK: 'Nails', kSupp: 'Supplements', kProc: 'Procedures',
    tw_vet: 'Vet visit', tw_symptom: 'Symptom', tw_note: 'Note', tw_photo: 'Photo', tw_doc: 'Document PDF', tw_frontline: 'Frontline', tw_deworming: 'Deworming', tw_anal_glands: 'Anal glands expressed', tw_nails: 'Nail trimming', al_nails: 'Nails', tw_other: 'Other',
    tw_food: 'Food', tw_medication: 'Medication', tw_supplement: 'Supplement', tw_treat: 'Treat', tw_procedure: 'Procedure',
    histOf: '{kind} · {n}', histRange: '{a} – {b}', filterOn: 'Kinds: {n}',
    dayNote: 'Day view as built: meals and medication rows are shown in short form here.', condNote: 'The built condition page opens here.', pinnedNoteHint: 'The built Pinned note sheet opens here (edit, delete).',
    kbdNote: 'iPhone keyboard (simulated)',
  },
  pl: {
    timeline: 'Oś czasu', pinned: 'Przypięte', add: 'Dodaj', tracked: 'Śledzone', search: 'Szukaj', menu: 'Menu', back: 'Wstecz', close: 'Zamknij', done: 'Gotowe', clearAll: 'Wyczyść',
    kVet: 'Wizyty u weta', kSym: 'Objawy', kNotes: 'Notatki', kPhotos: 'Zdjęcia', kOther: 'Inne', kFront: 'Frontline', kWorm: 'Odrobaczanie', kFood: 'Jedzenie', kMed: 'Leki', kTreat: 'Przysmaki',
    visit: 'Wizyta u weta', loading: 'Ładowanie…', loadFailed: 'Nie udało się wczytać. Sprawdź połączenie.', retry: 'Spróbuj ponownie',
    refused: 'Odmowa', half: 'Połowa', condSince: 'Od {d}', happened: 'Co się wydarzyło',
    brk: 'Śniadanie', dinner: 'Obiad', supper: 'Kolacja', before: 'Przed śniadaniem', mid: 'Między śniadaniem a obiadem', mid2: 'Między obiadem a kolacją', after: 'Po kolacji',
    entries_one: '1 wpis', entries_few: '{n} wpisy', entries_many: '{n} wpisów', anal: 'Opróżnienie gruczołów odbytu', nails: 'Przycięcie pazurów',
    pinnedNote: 'Przypięta notatka', meals: 'Posiłki i leki',
    fieldLabel: 'Szukaj w dzienniku', clear: 'Wyczyść wyszukiwanie', hint: 'Szukaj we wszystkich dniach naraz. Wpisz słowo albo użyj filtrów, żeby zobaczyć wszystko jednego rodzaju.',
    results_one: '1 wynik', results_few: '{n} wyniki', results_many: '{n} wyników',
    noneTitle: 'Nic nie znaleziono dla „{q}”', noneHint: 'Sprawdź pisownię, spróbuj krótszego słowa albo wyczyść filtry.', 
    noneKind: 'Brak wpisów tego rodzaju.', more: 'Pokaż jeszcze {n}', items: 'Pozycje', last: 'Ostatnio {d}',
    filters: 'Filtry', filtersOn: 'Filtry, włączone: {n}', filtersHint: 'Pokaż tylko te. Bez wyboru pokazujemy wszystko.', showResults: 'Pokaż wyniki ({n})', noneAll: 'Wyczyść filtry', gEvents: 'Zdarzenia', gItems: 'Jedzenie, leki i zabiegi', gOff: 'Bez daty',
    kDoc: 'Dokumenty', kAnal: 'Gruczoły odbytu', kNailsK: 'Pazury', kSupp: 'Suplementy', kProc: 'Zabiegi',
    tw_vet: 'Wizyta u weta', tw_symptom: 'Objaw', tw_note: 'Notatka', tw_photo: 'Zdjęcie', tw_doc: 'Dokument PDF', tw_frontline: 'Frontline', tw_deworming: 'Odrobaczanie', tw_anal_glands: 'Opróżnienie gruczołów odbytu', tw_nails: 'Przycięcie pazurów', al_nails: 'Pazury', tw_other: 'Inne',
    tw_food: 'Jedzenie', tw_medication: 'Lek', tw_supplement: 'Suplement', tw_treat: 'Przysmak', tw_procedure: 'Zabieg',
    histOf: '{kind} · {n}', histRange: '{a} – {b}', filterOn: 'Rodzaje: {n}',
    dayNote: 'Widok dnia jak w aplikacji: wiersze posiłków i leków pokazane tu w skrócie.', condNote: 'Tu otwiera się gotowa strona śledzonej sprawy.', pinnedNoteHint: 'Tu otwiera się gotowy arkusz przypiętej notatki (edycja, usuwanie).',
    kbdNote: 'Klawiatura iPhone’a (symulacja)',
  },
};

/** Every kind a result can belong to (src/data/types.ts: EventType, ItemKind, plus PDFs, tracked conditions, pinned notes). g: ev | it | off. */
const K = {
  vet: { g: 'ev', l: 'kVet' }, symptom: { g: 'ev', l: 'kSym' }, note: { g: 'ev', l: 'kNotes' }, photo: { g: 'ev', l: 'kPhotos' }, doc: { g: 'ev', l: 'kDoc' },
  frontline: { g: 'ev', l: 'kFront' }, deworming: { g: 'ev', l: 'kWorm' }, anal_glands: { g: 'ev', l: 'kAnal' }, nails: { g: 'ev', l: 'kNailsK' }, other: { g: 'ev', l: 'kOther' },
  food: { g: 'it', l: 'kFood' }, medication: { g: 'it', l: 'kMed' }, supplement: { g: 'it', l: 'kSupp' }, treat: { g: 'it', l: 'kTreat' }, procedure: { g: 'it', l: 'kProc' },
  tracked: { g: 'off', l: 'tracked' }, pinned: { g: 'off', l: 'pinned' },
};

// ---------- Fictional data (docs/PRODUCT.md, data/demo). Free text is shown as the household wrote it; the PL column imagines Polish notes. ----------
const SYM = {
  Reflux: { en: 'Reflux', pl: 'Refluks' }, Panting: { en: 'Panting', pl: 'Dyszenie' }, Fear: { en: 'Fear', pl: 'Strach' }, Leakage: { en: 'Leakage', pl: 'Wyciek' },
  Poo: { en: 'Poo', pl: 'Kupa' }, Heartburn: { en: 'Heartburn', pl: 'Zgaga' }, 'Stomach rumbling': { en: 'Stomach rumbling', pl: 'Burczenie w brzuchu' },
  Restlessness: { en: 'Restlessness', pl: 'Niepokój' }, Vomit: { en: 'Vomit', pl: 'Wymioty' },
};
const E0 = { en: '', pl: '' };
const FRONT = { en: 'Monthly flea and tick treatment given. Time of day not tracked.', pl: 'Miesięczna ochrona przeciw pchłom i kleszczom podana. Pora dnia nieistotna.' };
/** attrs: what the card's detail line shows for a symptom (intensity and properties, as labels in the current language). */
const EV = [
  { id: 'e01', date: '2026-09-08', type: 'frontline', detail: FRONT },
  { id: 'e02', date: '2026-09-12', type: 'deworming', detail: { en: 'Given every 6 months. Next one due in March.', pl: 'Podawana co 6 miesięcy. Następna w marcu.' } },
  { id: 'e03', date: '2026-09-20', type: 'symptom', title: 'Reflux', attrs: { en: ['Medium'], pl: ['Średnie'] }, detail: E0, conds: ['c4'] },
  { id: 'e04', date: '2026-09-20', type: 'symptom', title: 'Panting', attrs: { en: ['Small'], pl: ['Małe'] }, detail: E0, conds: ['c4'] },
  { id: 'e19', date: '2026-09-22', type: 'anal_glands', detail: { en: 'Done at home, nothing unusual.', pl: 'Zrobione w domu, nic niepokojącego.' } }, // (proto)
  { id: 'e05', date: '2026-09-28', type: 'symptom', title: 'Fear', attrs: { en: ['Large'], pl: ['Duże'] }, detail: { en: 'Fireworks nearby. Hid under the table.', pl: 'Fajerwerki w pobliżu. Schowała się pod stołem.' } }, // (proto text)
  { id: 'e20', date: '2026-10-01', type: 'nails', detail: { en: 'Front paws only.', pl: 'Tylko łapy przednie.' } }, // (proto)
  { id: 'e06', date: '2026-10-03', type: 'symptom', title: 'Leakage', attrs: { en: ['Small amount'], pl: ['Mała ilość'] }, detail: E0 },
  { id: 'e07', date: '2026-10-03', type: 'photo', detail: { en: 'About 1 cm, soft, moves under the skin.', pl: 'Około 1 cm, miękki, przesuwa się pod skórą.' }, conds: ['c1'], src: '../../../data/demo/photos/lump-a-1.svg' },
  { id: 'e08', date: '2026-10-06', type: 'symptom', title: 'Poo', attrs: { en: ['Diarrhoea', 'Dark', 'Medium amount'], pl: ['Biegunka', 'Ciemna', 'Średnia ilość'] }, detail: E0 },
  { id: 'e09', date: '2026-10-08', type: 'frontline', detail: FRONT },
  { id: 'e10', date: '2026-10-09', type: 'symptom', title: 'Heartburn', attrs: { en: ['Medium'], pl: ['Średnie'] }, detail: { en: 'Licked her lips a lot and swallowed hard after dinner.', pl: 'Dużo oblizywała się i przełykała po obiedzie.' } }, // (proto text)
  { id: 'e11', date: '2026-10-10', type: 'photo', detail: { en: 'Same size as last week, measured with the ruler.', pl: 'Tej samej wielkości co tydzień temu, zmierzony linijką.' }, conds: ['c1'], src: '../../../data/demo/photos/lump-a-2.svg' },
  { id: 'e12', date: '2026-10-12', type: 'symptom', title: 'Stomach rumbling', attrs: { en: ['Small'], pl: ['Małe'] }, detail: E0, conds: ['c2'] },
  { id: 'e13', date: '2026-10-12', type: 'symptom', title: 'Poo', attrs: { en: ['Soft', 'Normal colour', 'Small amount'], pl: ['Miękka', 'Normalny kolor', 'Mała ilość'] }, detail: E0, conds: ['c2'] },
  { id: 'e18', date: '2026-10-12', type: 'note', title: { en: 'Lump A: cytology', pl: 'Guzek A: cytologia' }, detail: { en: 'Sample sent to the lab on 10 Oct.', pl: 'Próbka wysłana do laboratorium 10 paź.' }, conds: ['c1'], docs: [{ en: 'Cytology result', pl: 'Wynik cytologii' }] }, // (proto)
  { id: 'e21', date: '2026-10-13', type: 'other', title: { en: 'Bath', pl: 'Kąpiel' }, detail: { en: 'Oatmeal shampoo, no itching afterwards.', pl: 'Szampon owsiany, bez swędzenia po kąpieli.' } }, // (proto)
  { id: 'e14', date: '2026-10-14', type: 'symptom', title: 'Restlessness', attrs: { en: ['Large'], pl: ['Duże'] }, detail: { en: 'Restless night and day. Refused breakfast. Weak and confused on walks, lay down a few times.', pl: 'Niespokojna noc i dzień. Odmówiła śniadania. Osłabiona i zdezorientowana na spacerach, kilka razy się kładła.' }, conds: ['c2', 'c3'] },
  { id: 'e15', date: '2026-10-14', type: 'symptom', title: 'Vomit', attrs: { en: ['1×', 'Morning'], pl: ['1×', 'Rano'] }, detail: E0, conds: ['c2'] },
  { id: 'e16', date: '2026-10-14', type: 'vet', title: 'Maple Vet', detail: { en: 'Symptom consultation, stomach ultrasound, limb check (X-ray of front paws recommended). Gastrelle prescribed.', pl: 'Konsultacja objawów, USG brzucha, kontrola kończyn (zalecone RTG łap przednich). Przepisany Gastrelle.' }, conds: ['c2'], docs: [{ en: 'Ultrasound report', pl: 'Wynik USG brzucha' }] },
  { id: 'e17', date: '2026-10-14', type: 'vet', title: 'Riverside Vet', detail: { en: 'Blood pressure check: high, 150–160. Further consultation.', pl: 'Pomiar ciśnienia: wysokie, 150–160. Dalsza konsultacja.' }, also: { en: ['Anal glands', 'Nails', 'Ear cleaning'], pl: ['Gruczoły przyodbytowe', 'Pazury', 'Czyszczenie uszu'] }, conds: ['c3'], docs: [{ en: 'Blood pressure check', pl: 'Pomiar ciśnienia' }] },
];
const COND = {
  c1: { id: 'c1', name: { en: 'Lump A', pl: 'Lump A' }, since: '2026-10-03', desc: { en: 'Small soft lump on the left side of the chest. A photo every week, with the ruler.', pl: 'Mały miękki guzek po lewej stronie klatki piersiowej. Zdjęcie co tydzień, z linijką.' } },
  c2: { id: 'c2', name: { en: 'Stomach trouble', pl: 'Problemy z żołądkiem' }, since: '2026-10-12', desc: { en: 'Rumbling and soft poo, then vomiting on 14 Oct. Gastrelle course 14 to 20 Oct.', pl: 'Burczenie i miękka kupa, potem wymioty 14 paź. Kuracja Gastrelle 14–20 paź.' } },
  c3: { id: 'c3', name: { en: 'Blood pressure', pl: 'Ciśnienie krwi' }, since: '2026-10-14', desc: { en: 'High at Riverside Vet (150 to 160). Recheck planned.', pl: 'Wysokie u Riverside Vet (150–160). Planowana kontrola.' } },
  c4: { id: 'c4', name: { en: 'Reflux', pl: 'Refluks' }, since: '2026-09-20', resolved: '2026-09-30', desc: { en: 'Reflux and panting at night.', pl: 'Refluks i dyszenie w nocy.' } },
};
const PIN = [
  { id: 'n1', title: { en: 'Allergies', pl: 'Alergie' }, body: { en: 'None known. Watch for itching for two days after any new food.', pl: 'Brak znanych. Przez dwa dni po każdej nowej karmie obserwować, czy się nie drapie.' } },
  { id: 'n2', title: { en: 'Bellavet dose', pl: 'Dawka Bellavet' }, body: { en: 'Measured in bars on the syringe: 1 bar = 0,1 ml.\nUsual dose 1,5 bars with every meal.', pl: 'Odmierzana w kreskach na strzykawce: 1 kreska = 0,1 ml.\nZwykła dawka 1,5 kreski do każdego posiłku.' } },
  { id: 'n3', title: E0, body: { en: 'Gastrelle: mix the sachet into a spoon of wet food, not into the whole bowl.', pl: 'Gastrelle: wymieszać saszetkę z łyżką mokrej karmy, nie z całą miską.' } },
  { id: 'n4', title: { en: 'Next deworming', pl: 'Następne odrobaczanie' }, body: { en: 'Due in March (every 6 months).', pl: 'W marcu (co 6 miesięcy).' } },
];
const N = (en, pl = en) => ({ en, pl });
/** kind: ItemKind. flav: flavours offered for the item (proto values). */
const ITEM = {
  cooked: { id: 'cooked', name: N('Cooked meal', 'Gotowany posiłek'), colour: 'food-cooked', size: 'food', kind: 'food', flav: [] },
  farm: { id: 'farm', name: N('Farm Fresh'), colour: 'food-farm', size: 'food', kind: 'food', flav: [N('turkey', 'indyk')] },
  ocean: { id: 'ocean', name: N('Ocean Blend'), colour: 'food-ocean', size: 'food', kind: 'food', flav: [N('salmon', 'łosoś')] },
  arvelin: { id: 'arvelin', name: N('Arvelin'), colour: 'med-arvelin', size: 'small', kind: 'medication', flav: [] },
  bellavet: { id: 'bellavet', name: N('Bellavet'), colour: 'med-bellavet', size: 'small', kind: 'medication', flav: [] },
  biomend: { id: 'biomend', name: N('Biomend'), colour: 'med-biomend', size: 'small', kind: 'supplement', flav: [] },
  gastrelle: { id: 'gastrelle', name: N('Gastrelle'), colour: 'med-gastrelle', size: 'small', kind: 'medication', flav: [] },
  calmora: { id: 'calmora', name: N('Calmora'), colour: 'med-calmora', size: 'small', kind: 'medication', flav: [] },
  treat: { id: 'treat', name: N('Treats', 'Przysmaki'), colour: 'treat', size: 'small', kind: 'treat', flav: [N('chicken', 'kurczak')] },
  ears: { id: 'ears', name: N('Ear cleaning', 'Czyszczenie uszu'), colour: 'mark-neutral', size: 'small', kind: 'procedure', flav: [] }, // (proto: the demo has no procedure item)
};
const PARTS = { 1: 'before', 2: 'brk', 3: 'mid', 4: 'dinner', 5: 'mid2', 6: 'supper', 7: 'after' };
const PLDOSE = [[/pill/g, 'tabl.'], [/sachet/g, 'saszetka'], [/capsule/g, 'kaps.'], [/tray/g, 'tacki'], [/can/g, 'puszki'], [/chicken/g, 'kurczak'], [/day (\d) of (\d)/g, 'dzień $1 z $2']];
const NOTES = { '2026-10-13|1|arvelin': N('Spat the pill out, gave it again in a bit of cheese.', 'Wypluła tabletkę, podałam jeszcze raz w kawałku sera.'), '2026-10-14|4|ocean': N('Half eaten, walked away from the bowl.', 'Zjadła połowę, odeszła od miski.') }; // (proto)
const ENTRIES = window.SAMPLE_ENTRIES.concat([['2026-09-30', 3, 'ears', '1×', 'g', ''], ['2026-10-07', 3, 'ears', '1×', 'g', ''], ['2026-10-14', 3, 'ears', '1×', 'p', '']]).map(([date, part, item, dose, st, note]) => ({
  date, part, item, dose, state: st === 'g' ? 'given' : st === 'p' ? 'partial' : 'skipped', note: NOTES[`${date}|${part}|${item}`] || null,
}));

// ---------- State ----------
let S;
function fresh() { return { lang: 'en', screen: 'search', q: '', kinds: [], shown: PAGE, loading: false, failed: false, kbd: false, day: null, hist: null, histShown: 20, pinSheet: null, sheet: false, scroll: 0, preset: 'idle', kbdSim: true }; }
S = fresh();

// ---------- Helpers ----------
const t = (k, v) => fill(L[S.lang][k] ?? k, v);
function fill(s, v) { return s.replace(/\{(\w+)\}/g, (_, k) => (v && v[k] != null ? v[k] : '')); }
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const loc = (x) => (x && typeof x === 'object' ? x[S.lang] : x) ?? '';
function plural(n) {
  if (S.lang === 'en') return n === 1 ? 'one' : 'many';
  if (n === 1) return 'one';
  const a = n % 10, b = n % 100;
  return a >= 2 && a <= 4 && !(b >= 12 && b <= 14) ? 'few' : 'many';
}
const count = (base, n) => t(`${base}_${plural(n)}`, { n });
function dmy(iso) { const [, m, d] = iso.split('-'); return `${+d} ${MONTHS[S.lang][+m - 1]}`; }
function wdmy(iso) { return `${DAYS[S.lang][new Date(iso + 'T12:00:00').getDay()]} ${dmy(iso)}`; }
const monthCaption = (iso) => { const [y, m] = iso.split('-'); return `${MONTH_NAMES[S.lang][+m - 1]} ${y}`; };
const dose = (e) => (S.lang === 'pl' ? PLDOSE.reduce((s, [re, to]) => s.replace(re, to), e.dose) : e.dose);
const kindLabel = (k) => (K[k].g === 'off' ? t(k) : t(K[k].l));

/** Case and diacritics do not matter (zoladek finds żołądek). One character in, one out, so match positions map back to the text. */
function norm(s) {
  let o = '';
  for (const c of s) { const n = c === 'ł' || c === 'Ł' ? 'l' : c.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); o += n[0] ?? c; }
  return o;
}
/** Words typed, from 2 characters. Polish endings change the stem (żołądek, żołądka, żołądkiem): in Polish a word of 6+ letters is searched without its last 2 letters. The same rule applies to every searched field, type words included. */
const tokens = () => (S.q.trim().length < 2 ? '' : norm(S.q.trim())).split(/\s+/).filter((w) => w.length >= 1).map((w) => (S.lang === 'pl' && w.length >= 6 ? w.slice(0, -2) : w));
/** Where a word starts with the token: a match must begin a word ("sto" finds Stomach, not "nieistotna"). */
function starts(n, tk) {
  const out = [];
  for (let i = n.indexOf(tk); i !== -1; i = n.indexOf(tk, i + 1)) if (i === 0 || !/[\p{L}\p{N}]/u.test(n[i - 1])) out.push(i);
  return out;
}
const matches = (hay) => { const h = norm(hay.join(' \n ')); return tokens().every((tk) => starts(h, tk).length > 0); };
const hasToken = (text) => { const n = norm(text); return tokens().some((tk) => starts(n, tk).length > 0); };
function hl(text) {
  const toks = tokens();
  if (!toks.length || !text) return esc(text);
  const n = norm(text);
  const mark = new Array(text.length).fill(false);
  for (const tk of toks) for (const i of starts(n, tk)) for (let j = 0; j < tk.length; j++) mark[i + j] = true;
  let out = '', open = false;
  [...text].forEach((c, i) => { if (mark[i] && !open) { out += '<mark class="hit">'; open = true; } if (!mark[i] && open) { out += '</mark>'; open = false; } out += esc(c); });
  return open ? out + '</mark>' : out;
}
/** A short window of a long text around the first match, so the match is visible in 3 lines. */
function snippet(text) {
  const toks = tokens();
  if (!toks.length || text.length <= 110) return text;
  const n = norm(text);
  const at = Math.min(...toks.flatMap((tk) => starts(n, tk).slice(0, 1)), text.length);
  if (at < 60) return text;
  const start = text.indexOf(' ', Math.max(0, at - 45));
  return '…' + text.slice(start === -1 ? at : start + 1);
}

// ---------- Icons (glyphs from src/components/icons.tsx; Search is the one new glyph) ----------
const sv = (size, sw, body, fillc = 'none') => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="${fillc}" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
const I = {
  plus: (s = 13) => sv(s, 2.8, '<path d="M12 5v14M5 12h14"/>'),
  chev: (dir = 'right', s = 14) => sv(s, 2.4, `<path d="${{ left: 'M15 6l-6 6 6 6', right: 'M9 6l6 6-6 6' }[dir]}"/>`),
  search: (s = 18, w = 2) => sv(s, w, '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>'),
  cross: (s = 10) => sv(s, 2.8, '<path d="M6 6l12 12M18 6L6 18"/>'),
  menu: (s = 18) => sv(s, 2.1, '<path d="M4 7h16M4 12h16M4 17h16"/>'),
  sliders: (s = 15) => sv(s, 2.1, '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>'),
  target: (s = 11) => sv(s, 2.6, '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="2.5" fill="currentColor"/>'),
  dots: (s = 15) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>`,
  timeline: (a) => sv(22, a ? 2.1 : 1.8, '<path d="M9.5 6.5H20M9.5 12H20M9.5 17.5H20"/><circle cx="4.8" cy="6.5" r="1.1"/><circle cx="4.8" cy="12" r="1.1"/><circle cx="4.8" cy="17.5" r="1.1"/>'),
  pin: (a) => sv(22, a ? 2.1 : 1.8, '<path d="M9 3.5h6l-1 5.5 3.5 3.5v2h-11v-2L10 9z"/><path d="M12 14.5V21"/>'),
  tracked: (a) => sv(22, a ? 2.1 : 1.8, '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="3.5"/><path d="M12 1.5v3M12 19.5v3M1.5 12h3M19.5 12h3"/>'),
};
const badge = (kind) => {
  const g = {
    vet: '<svg class="event-badge__glyph event-badge__glyph--lg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12.5h5l2.5-7 4.5 14 2.5-7H22"/></svg>',
    note: '<svg class="event-badge__glyph event-badge__glyph--lg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5.5 3h9L19 7.5V21H5.5z"/><path d="M9 12h6M9 16h6"/></svg>',
    photo: '<svg class="event-badge__glyph event-badge__glyph--photo" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"><path d="M3 8h4l2-3h6l2 3h4v12H3z"/><circle cx="12" cy="13.5" r="3.5"/></svg>',
    sym: '!', front: 'F', worm: 'D',
  }[kind];
  return `<span class="event-badge event-badge--${kind}" aria-hidden="true">${g}</span>`;
};
const mark = (it, state = 'given') => `<span class="dose-mark dose-mark--${it.size} dose-mark--${state}" style="--mark:var(--color-${it.colour})" aria-hidden="true"></span>`;

// ---------- What is searched ----------
const BADGE = { vet: 'vet', symptom: 'sym', note: 'note', photo: 'photo', frontline: 'front', deworming: 'worm' };
const typeWord = (k) => t(`tw_${k}`);
/** A second word that also finds a type ("nails" finds Nail trimming). */
const alias = (k) => (L[S.lang][`al_${k}`] ? [t(`al_${k}`)] : []);
const evTitle = (e) => (e.type === 'symptom' ? loc(SYM[e.title]) : e.type === 'anal_glands' ? t('anal') : e.type === 'nails' ? t('nails') : e.type === 'frontline' ? typeWord('frontline') : e.type === 'deworming' ? typeWord('deworming') : loc(e.title) || (e.type === 'photo' ? typeWord('photo') : ''));
const condNames = (e) => (e.conds || []).map((c) => loc(COND[c].name));
/** Kinds an event belongs to: its own type, plus photo and doc when it carries photos or PDFs. */
const evKinds = (e) => [e.type, ...(e.src && e.type !== 'photo' ? ['photo'] : []), ...(e.docs ? ['doc'] : [])];
const evFields = (e) => [evTitle(e), ...evKinds(e).flatMap((k) => [typeWord(k), ...alias(k)]), ...(e.attrs ? e.attrs[S.lang] : []), loc(e.detail), ...(e.also ? e.also[S.lang] : []), ...(e.docs || []).map(loc), ...condNames(e)];
const stateWord = (e) => (e.state === 'skipped' ? t('refused') : e.state === 'partial' ? t('half') : '');
/** Entry fields. Entry-only fields (amount, day part, kind word) are searched only when an item kind or an item is selected; without it they would match hundreds of entries. */
const entryAlways = (e) => [stateWord(e), e.note ? loc(e.note) : '', ...ITEM[e.item].flav.map(loc)];
const entryScoped = (e) => [loc(ITEM[e.item].name), typeWord(ITEM[e.item].kind), dose(e), t(PARTS[e.part]), ...entryAlways(e)];

function search() {
  const any = tokens().length > 0;
  const kinds = S.kinds;
  const out = { dated: [], items: [], conds: [], pins: [] };
  if (!any && !kinds.length) return out;
  const itemKinds = kinds.filter((k) => K[k].g === 'it');
  const hit = (k) => !kinds.length || kinds.includes(k);
  EV.forEach((e) => {
    if (kinds.length && !evKinds(e).some((k) => kinds.includes(k))) return;
    if (any && !matches(evFields(e))) return;
    out.dated.push({ id: e.id, ev: e, date: e.date, part: 0 });
  });
  ENTRIES.forEach((e) => {
    const it = ITEM[e.item];
    const scoped = itemKinds.length > 0;
    if (scoped ? !itemKinds.includes(it.kind) : kinds.length || !any || !stateWord(e) && !e.note) return;
    if (any && !matches(scoped ? entryScoped(e) : entryAlways(e))) return;
    out.dated.push({ id: `${e.date}|${e.part}|${e.item}`, entry: e, date: e.date, part: e.part });
  });
  Object.values(ITEM).forEach((it) => {
    if (kinds.length && !itemKinds.includes(it.kind)) return;
    if (any && !matches([loc(it.name), typeWord(it.kind), ...it.flav.map(loc)])) return;
    const list = ENTRIES.filter((e) => e.item === it.id);
    out.items.push({ it, n: list.length, last: list.at(-1).date });
  });
  if (hit('tracked') && (kinds.includes('tracked') || any)) Object.values(COND).forEach((c) => { if (!any || matches([loc(c.name), loc(c.desc)])) out.conds.push(c); });
  if (hit('pinned') && (kinds.includes('pinned') || any)) PIN.forEach((p) => { if (!any || matches([loc(p.title), loc(p.body)])) out.pins.push(p); });
  out.dated.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.part - a.part));
  return out;
}

// ---------- Result cards ----------
function eventCard(r) {
  const e = r.ev;
  const title = evTitle(e);
  // The type label is on the card whenever it is why the card matched: a vet visit always carries it ("Vet visit · Maple Vet");
  // any other type shows it muted after the title when the type word matched and the title did not ("Heartburn · Symptom").
  const why = evKinds(e).filter((k) => k !== 'vet' && k !== 'doc').flatMap((k) => [typeWord(k), ...alias(k)]).filter((w) => hasToken(w) && !hasToken(title));
  const suffix = why.length ? ` <span class="res__kind">· ${hl(why[0])}</span>` : '';
  const head = e.type === 'vet' ? `${hl(t('visit'))} · ${hl(title)}` : `${hl(title)}${suffix}`;
  const text = [...(e.attrs ? [e.attrs[S.lang].join(' · ')] : []), loc(e.detail)].filter(Boolean).join(' · ');
  const body = text ? `<span class="day-card__text">${hl(snippet(text))}</span>` : '';
  const showDocs = S.kinds.includes('doc') || hasToken(typeWord('doc'));
  const also = (e.also ? e.also[S.lang] : []).filter((x) => hasToken(x));
  const docs = (e.docs || []).map(loc).filter((x) => showDocs || hasToken(x));
  const chipRow = also.length || docs.length ? `<span class="day-card__chips">${also.map((x) => `<span class="day-card__chip">${hl(x)}</span>`).join('')}${docs.map((x) => `<span class="day-card__chip">${hl(typeWord('doc'))} · ${hl(x)}</span>`).join('')}</span>` : '';
  const tags = (e.conds || []).filter((c) => hasToken(loc(COND[c].name)));
  const tagRow = tags.length ? `<span class="cond-tags">${tags.map((c) => `<span class="cond-tag">${I.target()}<span>${hl(loc(COND[c].name))}</span></span>`).join('')}</span>` : '';
  const glyph = BADGE[e.type] ? badge(BADGE[e.type]) : `<span class="day-card__glyph">${I.dots()}</span>`;
  const thumb = e.src ? `<span class="photo-thumb photo-thumb--sm" aria-hidden="true"><img src="${e.src}" alt="" draggable="false"></span>` : '';
  const main = `<span class="res__top"><span class="day-card__head">${glyph}<span>${head}</span></span><span class="res__date">${wdmy(e.date)}</span></span>${body}${chipRow}${tagRow}`;
  return `<button type="button" class="day-card day-card--tap res" data-act="openDay" data-date="${e.date}" data-ev="${e.id}">${thumb ? `<span class="res__withthumb"><span class="res__main">${main}</span>${thumb}</span>` : main}</button>`;
}
/** Consecutive entries inside one card of rows (like the Day view's list), so 60 doses are not 60 cards. */
function entryRows(list) {
  return `<div class="day-card"><ul class="day-card__rows">${list.map((r) => {
    const e = r.entry, it = ITEM[e.item];
    const val = e.state === 'skipped' ? `<span class="day-tag day-tag--skipped">${hl(t('refused'))}</span>` : e.state === 'partial' ? `<span class="day-tag day-tag--partial">${hl(t('half'))}</span>` : esc(dose(e));
    return `<li class="dose-row"><button type="button" class="day-card__row" data-act="openDay" data-date="${e.date}" data-entry="${r.id}"><span class="day-card__row-label">${mark(it, e.state)}<span>${hl(loc(it.name))} <span class="dose-row__sub">· ${t(PARTS[e.part])} · ${wdmy(e.date)}</span></span></span><span class="day-card__row-value">${val}</span></button>${e.note ? `<p class="day-card__text" style="margin:0 0 8px">${hl(snippet(loc(e.note)))}</p>` : ''}</li>`;
  }).join('')}</ul></div>`;
}
function itemCard(x) {
  const meta = `${hl(typeWord(x.it.kind))} · ${count('entries', x.n)} · ${t('last', { d: dmy(x.last) })}`;
  return `<button type="button" class="day-card day-card--tap cond-card item-card" data-act="hist" data-item="${x.it.id}">
    <span class="item-card__lead">${mark(x.it)}</span>
    <span class="cond-card__text"><span class="day-card__head"><span>${hl(loc(x.it.name))}</span></span><span class="cond-card__meta">${meta}</span></span>
    <span class="cond-card__chev" aria-hidden="true">${I.chev('right', 16)}</span></button>`;
}
function condCard(c) {
  const when = c.resolved ? `${dmy(c.since)} – ${dmy(c.resolved)}` : t('condSince', { d: dmy(c.since) });
  const d = loc(c.desc);
  return `<button type="button" class="day-card day-card--tap cond-card${c.resolved ? ' cond-card--resolved' : ''}" data-act="cond" data-cond="${c.id}">
    <span class="cond-card__text"><span class="day-card__head"><span>${hl(loc(c.name))}</span></span><span class="cond-card__meta">${when}</span>${hasToken(d) ? `<span class="day-card__text">${hl(snippet(d))}</span>` : ''}</span>
    <span class="cond-card__chev" aria-hidden="true">${I.chev('right', 16)}</span></button>`;
}
function pinCard(p) {
  const title = loc(p.title);
  return `<button type="button" class="day-card day-card--tap res" data-act="pin" data-pin="${p.id}">
    <span class="res__top"><span class="day-card__head">${badge('note')}<span>${title ? hl(title) : hl(snippet(loc(p.body)).slice(0, 38) + '…')}</span></span></span>
    ${title ? `<span class="day-card__text">${hl(snippet(loc(p.body)))}</span>` : ''}</button>`;
}

// ---------- Screens ----------
/** Filters: one button with a count (opens the Sheet, no chips in the row) and, when something is on, one short line under the field. */
function filterButton() {
  const n = S.kinds.length;
  return `<button type="button" class="btn btn--ghost filter-btn" aria-haspopup="dialog" data-act="kindsheet" ${n ? `aria-label="${t('filtersOn', { n })}"` : ''}><span class="btn__icon">${I.sliders()}</span>${t('filters')}${n ? `<span class="filter-btn__n">${n}</span>` : ''}</button>`;
}
function filterLine() {
  const n = S.kinds.length;
  if (!n) return '';
  const names = S.kinds.slice(0, 2).map(kindLabel).join(', ') + (n > 2 ? ` +${n - 2}` : '');
  return `<div class="filter-line"><button type="button" class="filter-line__text" data-act="kindsheet">${esc(names)}</button><button type="button" class="link-btn filter-line__clear" data-act="clearkinds">${t('clearAll')}</button></div>`;
}
function kindsSheet() {
  const grp = (g, cap) => `<h3 class="day__caption" style="margin:var(--space-3) 0 var(--space-2)">${t(cap)}</h3><div class="chips">${Object.keys(K).filter((k) => K[k].g === g).map((k) => `<button type="button" class="chip" aria-pressed="${S.kinds.includes(k)}" data-act="kind" data-k="${k}">${kindLabel(k)}</button>`).join('')}</div>`;
  const total = search();
  const n = total.dated.length + total.items.length + total.conds.length + total.pins.length;
  return `<div class="sheet-root"><div class="sheet-scrim" data-act="closesheet"></div><section class="sheet" role="dialog" aria-label="${t('filters')}"><div class="sheet__grab"><span></span></div>
    <div class="sheet__head"><h2 class="sheet__title">${t('filters')}</h2><button type="button" class="sheet__close" data-act="clearkinds">${t('clearAll')}</button></div>
    <div class="sheet__body"><p class="sheet__text">${t('filtersHint')}</p>${grp('ev', 'gEvents')}${grp('it', 'gItems')}${grp('off', 'gOff')}</div>
    <div class="sheet__foot"><button type="button" class="btn btn--primary btn--lg" data-act="closesheet">${t('showResults', { n: tokens().length || S.kinds.length ? n : 0 })}</button></div></section></div>`;
}
function skeleton() {
  return `<div aria-busy="true"><p class="sr-only" role="status">${t('loading')}</p>${[0, 1, 2].map(() => '<div class="skel"><i class="h"></i><i class="s"></i><i></i></div>').join('')}</div>`;
}
function emptyCard(inner, icon = I.search(16)) {
  return `<article class="day-card day-empty"><span class="day-empty__icon" aria-hidden="true">${icon}</span><div>${inner}</div></article>`;
}
function resultsHtml() {
  if (S.failed) return `<div style="margin-top:var(--space-4)">${emptyCard(`<p class="day-empty__text">${t('loadFailed')}</p><button type="button" class="btn btn--ghost btn--md list-empty__btn" data-act="retry">${t('retry')}</button>`)}</div>`;
  if (S.loading) return `<div style="margin-top:var(--space-4)">${skeleton()}</div>`;
  const any = tokens().length > 0;
  if (!any && !S.kinds.length) return `<div style="margin-top:var(--space-4)">${emptyCard(`<p class="day-empty__text">${t('hint')}</p>`)}</div>`;
  const r = search();
  const total = r.dated.length + r.items.length + r.conds.length + r.pins.length;
  if (!total) {
    const inner = any
      ? `<p class="day-card__head" style="margin-bottom:var(--space-1)">${t('noneTitle', { q: esc(S.q.trim()) })}</p><p class="day-empty__text">${t('noneHint')}</p>${S.kinds.length ? `<button type="button" class="btn btn--ghost btn--md list-empty__btn" data-act="allkinds">${t('noneAll')}</button>` : ''}`
      : `<p class="day-empty__text">${t('noneKind')}</p>`;
    return `<div style="margin-top:var(--space-4)">${emptyCard(inner)}</div>`;
  }
  let h = `<p class="search-count" role="status" aria-live="polite">${count('results', total)}</p>`;
  const group = (cap, cards) => (cards.length ? `<h3 class="day__caption">${cap}</h3>${cards.join('')}` : '');
  h += group(t('items'), r.items.map(itemCard));
  h += group(t('tracked'), r.conds.map(condCard));
  h += group(t('pinned'), r.pins.map(pinCard));
  const shown = r.dated.slice(0, S.shown);
  let cur = '', run = [];
  const flush = () => { if (run.length) { h += entryRows(run); run = []; } };
  shown.forEach((x) => {
    const m = monthCaption(x.date);
    if (m !== cur) { flush(); cur = m; h += `<h3 class="day__caption">${m}</h3>`; }
    if (x.entry) run.push(x); else { flush(); h += eventCard(x); }
  });
  flush();
  if (r.dated.length > shown.length) h += `<button type="button" class="btn btn--ghost btn--md search-more" data-act="more">${t('more', { n: Math.min(20, r.dated.length - shown.length) })}</button>`;
  return h;
}
function searchScreen() {
  return `<div class="search-head"><div class="search-row"><div class="search-field">
      <span class="search-field__icon">${I.search(18)}</span>
      <input id="q" class="input" type="search" inputmode="search" enterkeyhint="search" autocomplete="off" autocorrect="off" spellcheck="false" aria-label="${t('fieldLabel')}" placeholder="${esc(t('fieldLabel'))}" value="${esc(S.q)}">
      <button type="button" class="search-field__clear" id="clr" data-act="clear" aria-label="${t('clear')}" ${S.q ? '' : 'hidden'}><span>${I.cross(10)}</span></button>
    </div>${filterButton()}</div></div><div id="fline">${filterLine()}</div>
    <div class="search-body" id="body"><div id="results">${resultsHtml()}</div></div>`;
}
function dayScreen() {
  const d = S.day;
  const evs = EV.filter((e) => e.date === d.date);
  const cards = evs.map((e) => {
    const hit = d.ev === e.id;
    const title = evTitle(e);
    const text = [...(e.attrs ? [e.attrs[S.lang].join(' · ')] : []), loc(e.detail)].filter(Boolean).join(' · ');
    const content = `<span class="day-card__head">${BADGE[e.type] ? badge(BADGE[e.type]) : ''}${e.type === 'vet' ? `${t('visit')} · ` : ''}${esc(title)}</span>${text ? `<span class="day-card__text">${esc(text)}</span>` : ''}${e.also ? `<span class="day-card__chips">${e.also[S.lang].map((a) => `<span class="day-card__chip">${esc(a)}</span>`).join('')}</span>` : ''}`;
    return `<button type="button" class="day-card day-card--tap ${hit ? 'hit-flash' : ''}" ${hit ? 'data-flash="1"' : ''}>${content}</button>`;
  }).join('');
  const rows = ENTRIES.filter((e) => e.date === d.date).map((e) => {
    const it = ITEM[e.item];
    const hit = d.entry === `${e.date}|${e.part}|${e.item}`;
    const state = e.state === 'skipped' ? `<span class="day-tag day-tag--skipped">${t('refused')}</span>` : e.state === 'partial' ? `<span class="day-tag day-tag--partial">${t('half')}</span>` : '';
    return `<li class="${hit ? 'hit-flash' : ''}" ${hit ? 'data-flash="1"' : ''}><button type="button" class="day-card__row"><span class="day-card__row-label" style="display:inline-flex;align-items:center;gap:8px">${mark(it, e.state)}${esc(loc(it.name))}<span class="dose-row__sub">· ${t(PARTS[e.part])}</span></span><span class="day-card__row-value">${state || esc(dose(e))}</span></button>${e.note ? `<p class="day-card__text" style="margin:0 0 8px">${esc(loc(e.note))}</p>` : ''}</li>`;
  }).join('');
  return `<section class="day"><div class="day__top"><button type="button" class="day-btn day-btn--back" data-act="back">${I.chev('left', 18)}${t('back')}</button></div>
    <div class="day__head"><div class="day__titles"><h2 class="day__title">${wdmy(d.date)}</h2></div></div>
    <div class="day__body" id="daybody">${cards ? `<h3 class="day__caption">${t('happened')}</h3>${cards}` : ''}
    ${rows ? `<h3 class="day__caption">${t('meals')}</h3><div class="day-card"><ul class="day-card__rows">${rows}</ul></div>` : ''}
    <p class="inline-note" style="margin-top:var(--space-4)">${t('dayNote')}</p></div></section>`;
}
/** An item's whole history (any ItemKind): the same list a kind chip gives, narrowed to one item. */
function histScreen() {
  const it = ITEM[S.hist];
  const list = ENTRIES.filter((e) => e.item === it.id).slice().reverse();
  const shown = list.slice(0, S.histShown);
  let cur = '', body = '';
  shown.forEach((e) => {
    const m = monthCaption(e.date);
    if (m !== cur) { if (cur) body += '</ul></div>'; cur = m; body += `<h3 class="day__caption">${m}</h3><div class="day-card"><ul class="day-card__rows">`; }
    const val = e.state === 'skipped' ? `<span class="day-tag day-tag--skipped">${t('refused')}</span>` : e.state === 'partial' ? `<span class="day-tag day-tag--partial">${t('half')}</span>` : esc(dose(e));
    body += `<li class="dose-row"><button type="button" class="day-card__row" data-act="openDay" data-date="${e.date}" data-entry="${e.date}|${e.part}|${e.item}"><span class="day-card__row-label">${mark(it, e.state)}<span>${wdmy(e.date)}<span class="dose-row__sub"> · ${t(PARTS[e.part])}</span></span></span><span class="day-card__row-value">${val}</span></button>${e.note ? `<p class="day-card__text" style="margin:0 0 8px">${esc(loc(e.note))}</p>` : ''}</li>`;
  });
  if (cur) body += '</ul></div>';
  const more = list.length > shown.length ? `<button type="button" class="btn btn--ghost btn--md search-more" data-act="morehist">${t('more', { n: Math.min(20, list.length - shown.length) })}</button>` : '';
  return `<section class="day"><div class="day__top"><button type="button" class="day-btn day-btn--back" data-act="backsearch">${I.chev('left', 18)}${t('back')}</button></div>
    <div class="day__head"><div class="day__titles"><h2 class="day__title">${esc(loc(it.name))}</h2><p class="day__sub">${typeWord(it.kind)} · ${count('entries', list.length)}</p></div></div>
    <div class="day__body">${body}${more}</div></section>`;
}
function condScreen() {
  const c = COND[S.cond];
  return `<section class="day"><div class="day__top"><button type="button" class="day-btn day-btn--back" data-act="backsearch">${I.chev('left', 18)}${t('back')}</button></div>
    <div class="day__head"><div class="day__titles"><h2 class="day__title">${esc(loc(c.name))}</h2><p class="day__sub">${c.resolved ? '' : t('condSince', { d: dmy(c.since) })}</p></div></div>
    <div class="day__body"><p class="day-card__text" style="margin-top:var(--space-4)">${esc(loc(c.desc))}</p><p class="inline-note" style="margin-top:var(--space-4)">${t('condNote')}</p></div></section>`;
}
function navHtml() {
  const cur = (k) => (k === 'search' ? 'page' : '');
  const item = (k, icon, label) => `<button type="button" class="nav__item" ${cur(k) ? 'aria-current="page"' : ''}>${icon}${label}</button>`;
  return `<nav class="nav nav--5" aria-label="${t('menu')}">${item('timeline', I.timeline(false), t('timeline'))}${item('pinned', I.pin(false), t('pinned'))}
    <div class="nav__add-wrap"><button type="button" class="btn btn--primary nav__add">${I.plus()}${t('add')}</button></div>
    ${item('tracked', I.tracked(false), t('tracked'))}${item('search', I.search(22, 2.1), t('search'))}</nav>`;
}
function pinSheet() {
  const p = PIN.find((x) => x.id === S.pinSheet);
  return `<div class="sheet-root"><div class="sheet-scrim" data-act="closepin"></div><section class="sheet" role="dialog" aria-label="${t('pinnedNote')}"><div class="sheet__grab"><span></span></div>
    <div class="sheet__head"><h2 class="sheet__title">${esc(loc(p.title)) || t('pinnedNote')}</h2><button type="button" class="sheet__close" data-act="closepin">${t('close')}</button></div>
    <div class="sheet__body"><p class="sheet__text pinned-text">${esc(loc(p.body))}</p><p class="inline-note">${t('pinnedNoteHint')}</p></div></section></div>`;
}
function header() {
  return `<header class="bar"><div class="brand"><span class="brand__mark" aria-hidden="true"><svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><ellipse cx="6.2" cy="11" rx="2" ry="2.6"/><ellipse cx="10.2" cy="6.6" rx="2" ry="2.6"/><ellipse cx="15" cy="6.6" rx="2" ry="2.6"/><ellipse cx="18.6" cy="11" rx="2" ry="2.6"/><path d="M12.4 11.4c2.6 0 5.2 2.9 5.2 5.4 0 1.8-1.5 2.7-3 2.4-.8-.2-1.4-.5-2.2-.5s-1.4.3-2.2.5c-1.5.3-3-.6-3-2.4 0-2.5 2.6-5.4 5.2-5.4z"/></svg></span><h1 class="title">PawLog</h1></div>
    <div class="bar__actions"><button type="button" class="btn btn--ghost menu-btn"><span class="btn__icon">${I.menu()}</span>${t('menu')}</button></div></header>`;
}

// ---------- Render ----------
let flashTimer = null;
function render() {
  const phone = document.getElementById('phone');
  const prevBody = document.getElementById('body');
  if (prevBody && S.screen === 'search') S.scroll = prevBody.scrollTop;
  const main = S.screen === 'day' ? dayScreen() : S.screen === 'hist' ? histScreen() : S.screen === 'cond' ? condScreen() : searchScreen();
  const keyboard = S.screen === 'search' && S.kbd && S.kbdSim && !S.sheet;
  phone.innerHTML = `<div class="screen">${header()}${main}${keyboard ? '' : navHtml()}${S.pinSheet ? pinSheet() : ''}${S.sheet ? kindsSheet() : ''}</div><div class="kbd ${keyboard ? 'kbd--on' : ''}">${keyboard ? t('kbdNote') : ''}</div>`;
  document.documentElement.lang = S.lang;
  const body = document.getElementById('body');
  if (body && S.screen === 'search') body.scrollTop = S.scroll || 0;
  const q = document.getElementById('q');
  if (q && S.refocus) { q.focus(); q.setSelectionRange(q.value.length, q.value.length); }
  if (S.screen === 'day') {
    const f = document.querySelector('[data-flash]');
    const db = document.getElementById('daybody');
    if (f && db) db.scrollTop = Math.max(0, f.offsetTop - db.offsetTop - 70);
    clearTimeout(flashTimer);
    flashTimer = setTimeout(() => document.querySelectorAll('.hit-flash').forEach((x) => x.classList.remove('hit-flash')), 3000);
  }
  renderPanel();
}
function refreshResults() {
  const clr = document.getElementById('clr');
  if (clr) clr.hidden = !S.q;
  S.shown = PAGE;
  const res = document.getElementById('results');
  if (res) res.innerHTML = resultsHtml();
  const body = document.getElementById('body');
  if (body) body.scrollTop = 0;
  const fl = document.getElementById('fline');
  if (fl) fl.innerHTML = filterLine();
  const fb = document.querySelector('.filter-btn');
  if (fb) fb.outerHTML = filterButton();
}
const PRESETS = [
  ['idle', '1  Search tab, nothing typed'], ['typing', '2  Typing: keyboard up'], ['heartburn', '3  “heartburn”: one result, opens its day'],
  ['stomach', '4  “stomach”: tracked + events by month'], ['vet', '5  “maple”: clinic highlighted'], ['vetchip', '6  Filters: 1 on (Vet visits), nothing typed'],
  ['kinds4', '6b  Filters: 4 on'], ['sheet', '7  Filters sheet open (4 on)'], ['typeword', '8  Type word: “deworming”'], ['vetvisit', '9  Type word: “vet visit”'],
  ['nails', '10  “nails”: service + Nail trimming event'], ['docs', '11  Filter Documents'], ['food', '12  Filter Food, nothing typed'],
  ['med', '13  Filter Medications + “bellavet”'], ['supp', '14  Filter Supplements'], ['proc', '15  Filter Procedures'], ['noproc', '16  Kind with nothing logged'],
  ['bellavet', '17  “bellavet”: item card, pinned note'], ['hist', '18  An item’s whole history'], ['refused', '19  “refused”: text and entries'],
  ['pl', '20  Polish: “zoladek” finds “żołądek”'], ['none', '21  No results'], ['nonekind', '22  No results with a kind on'],
  ['loading', '23  Loading'], ['failed', '24  Could not load'], ['day', '25  After tapping a result: Day view'], ['many', '26  Many results (Show more)'],
];
function renderPanel() {
  const p = document.getElementById('panel');
  p.innerHTML = `<h1>Search across the log</h1><p>JCB-138 design proposal, revision 2. Clickable; data is fictional. Prototype clock: Thu 15 Oct. Type in the field, tap chips and results, or jump to a state.</p>
    <h2>Language</h2><div class="row"><button class="go" data-act="lang" data-v="en" aria-current="${S.lang === 'en'}">EN</button><button class="go" data-act="lang" data-v="pl" aria-current="${S.lang === 'pl'}">PL</button></div>
    <h2>States</h2>${PRESETS.map(([k, v]) => `<button class="go" data-act="preset" data-v="${k}" aria-current="${S.preset === k}">${v}</button>`).join('')}
    <h2>Simulate</h2><label style="display:flex;gap:8px;align-items:center;min-height:32px"><input type="checkbox" data-bind="kbdSim" ${S.kbdSim ? 'checked' : ''}> Show an iPhone keyboard while typing</label>`;
}
function preset(k) {
  const lang = S.lang, kbdSim = S.kbdSim;
  S = fresh(); S.lang = lang; S.kbdSim = kbdSim; S.preset = k;
  const pl = S.lang === 'pl';
  switch (k) {
    case 'typing': S.kbd = true; S.refocus = true; S.q = 'sto'; break;
    case 'heartburn': S.q = pl ? 'zgaga' : 'heartburn'; break;
    case 'stomach': S.q = pl ? 'żołądek' : 'stomach'; break;
    case 'vet': S.q = 'maple'; break;
    case 'vetchip': S.kinds = ['vet']; break;
    case 'kinds4': S.kinds = ['vet', 'symptom', 'food', 'doc']; S.q = pl ? 'weta' : 'vet'; break;
    case 'sheet': S.sheet = true; S.kinds = ['vet', 'symptom', 'food', 'doc']; break;
    case 'typeword': S.q = pl ? 'odrobaczanie' : 'deworming'; break;
    case 'vetvisit': S.q = pl ? 'wizyta' : 'vet visit'; break;
    case 'nails': S.q = pl ? 'pazury' : 'nails'; break;
    case 'docs': S.kinds = ['doc']; break;
    case 'food': S.kinds = ['food']; break;
    case 'med': S.kinds = ['medication']; S.q = 'bellavet'; break;
    case 'supp': S.kinds = ['supplement']; break;
    case 'proc': S.kinds = ['procedure']; break;
    case 'noproc': S.kinds = ['anal_glands', 'nails', 'other']; S.q = pl ? 'szczepienie' : 'vaccine'; break;
    case 'bellavet': S.q = 'bellavet'; break;
    case 'hist': S.screen = 'hist'; S.hist = 'ocean'; break;
    case 'refused': S.q = pl ? 'odmow' : 'refus'; break;
    case 'pl': S.lang = 'pl'; S.q = 'zoladek'; break;
    case 'none': S.q = pl ? 'kichanie' : 'sneezing'; break;
    case 'nonekind': S.q = 'gastrelle'; S.kinds = ['photo']; break;
    case 'loading': S.q = pl ? 'zgaga' : 'heartburn'; S.loading = true; break;
    case 'failed': S.q = pl ? 'zgaga' : 'heartburn'; S.failed = true; break;
    case 'day': S.screen = 'day'; S.day = { date: '2026-10-09', ev: 'e10' }; break;
    case 'many': S.q = 'an'; break;
    default: break;
  }
  render();
}

document.addEventListener('click', (ev) => {
  const el = ev.target.closest('[data-act]');
  if (!el) return;
  const a = el.dataset.act;
  switch (a) {
    case 'lang': S.lang = el.dataset.v; S.refocus = false; render(); break;
    case 'preset': preset(el.dataset.v); break;
    case 'kind': { const k = el.dataset.k; S.kinds = S.kinds.includes(k) ? S.kinds.filter((x) => x !== k) : [...S.kinds, k]; if (S.sheet) render(); else refreshResults(); break; }
    case 'kindsheet': S.sheet = true; render(); break;
    case 'closesheet': S.sheet = false; render(); break;
    case 'clearkinds': S.kinds = []; render(); break;
    case 'allkinds': S.kinds = []; refreshResults(); break;
    case 'clear': S.q = ''; document.getElementById('q').value = ''; document.getElementById('q').focus(); refreshResults(); break;
    case 'more': S.shown += 20; { const b = document.getElementById('body').scrollTop; document.getElementById('results').innerHTML = resultsHtml(); document.getElementById('body').scrollTop = b; } break;
    case 'morehist': S.histShown += 20; render(); break;
    case 'retry': S.failed = false; S.loading = true; render(); setTimeout(() => { S.loading = false; render(); }, 900); break;
    case 'openDay': S.day = { date: el.dataset.date, ev: el.dataset.ev, entry: el.dataset.entry }; S.prev = S.screen; S.screen = 'day'; S.kbd = false; render(); break;
    case 'back': S.screen = S.prev || 'search'; S.kbd = false; render(); break;
    case 'backsearch': S.screen = 'search'; render(); break;
    case 'hist': S.hist = el.dataset.item; S.histShown = 20; S.screen = 'hist'; S.kbd = false; render(); break;
    case 'cond': S.cond = el.dataset.cond; S.screen = 'cond'; render(); break;
    case 'pin': S.pinSheet = el.dataset.pin; render(); break;
    case 'closepin': S.pinSheet = null; render(); break;
    default: break;
  }
});
document.addEventListener('input', (ev) => {
  if (ev.target.id !== 'q') return;
  S.q = ev.target.value;
  refreshResults();
});
document.addEventListener('focusin', (ev) => { if (ev.target.id === 'q' && S.kbdSim && !S.kbd) { S.kbd = true; S.refocus = true; render(); } });
document.addEventListener('keydown', (ev) => { if (ev.target.id === 'q' && ev.key === 'Enter') { S.kbd = false; S.refocus = false; ev.target.blur(); render(); } });
document.addEventListener('change', (ev) => { if (ev.target.dataset.bind === 'kbdSim') { S.kbdSim = ev.target.checked; render(); } });
document.addEventListener('click', (ev) => { // tapping outside the field and keyboard closes the simulated keyboard
  if (S.kbd && !ev.target.closest('.search-field') && !ev.target.closest('.kbd')) { S.kbd = false; S.refocus = false; render(); }
}, true);
document.getElementById('phone').insertAdjacentHTML('beforebegin', '<aside class="panel" id="panel"></aside>');
/** Deep links: #lang=pl&state=stomach (state names are the keys in PRESETS). */
function fromHash() {
  const hash = new URLSearchParams(location.hash.slice(1));
  if (hash.get('lang')) S.lang = hash.get('lang');
  render();
  if (hash.get('state')) preset(hash.get('state'));
}
window.addEventListener('hashchange', fromHash);
fromHash();
