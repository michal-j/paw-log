// PawLog proposal: Pinned notes, Tracked conditions, photos. Vanilla JS, no build step at runtime.
// STRINGS (src/strings.json) and CAP (Timeline and Day view markup captured from the running app in
// demo mode, EN and PL) are inlined by build.py. Fictional data only.
/* global STRINGS, CAP, photoSrc */

// ---------- i18n ----------
const DICT = { en: {}, pl: {} };
for (const s of STRINGS) { DICT.en[s.key] = s.en; DICT.pl[s.key] = s.pl; }
const PROTO = { // prototype chrome only, not proposed copy
  en: { notInScope: 'Not part of this proposal', notCaptured: 'This prototype has 3, 10, 12, 14 and 15 Oct', iosNote: 'iPhone shows its own menu here', lib: 'Photo Library', cam: 'Take Photo', file: 'Choose File', cancel: 'Cancel' },
  pl: { notInScope: 'Poza zakresem tej propozycji', notCaptured: 'Ten prototyp ma 3, 10, 12, 14 i 15 paź', iosNote: 'Tu iPhone pokazuje własne menu', lib: 'Biblioteka zdjęć', cam: 'Zrób zdjęcie', file: 'Wybierz plik', cancel: 'Anuluj' },
};
let lang = 'en';
const t = (k, v = {}) => {
  let s = DICT[lang][k] ?? PROTO[lang][k] ?? k;
  for (const [a, b] of Object.entries(v)) s = s.split(`{${a}}`).join(b);
  return s;
};
const plural = (base, n) => {
  let form = 'many';
  if (n === 1) form = 'one';
  else if (lang === 'pl' && [2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100)) form = 'few';
  else if (lang === 'en') form = 'many';
  return t(`${base}_${form}`, { n });
};
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

// ---------- Dates ----------
const TODAY = '2026-10-15';
const MON = { en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'], pl: ['sty', 'lut', 'mar', 'kwi', 'maj', 'cze', 'lip', 'sie', 'wrz', 'paź', 'lis', 'gru'] };
const MONL = { en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'], pl: ['stycznia', 'lutego', 'marca', 'kwietnia', 'maja', 'czerwca', 'lipca', 'sierpnia', 'września', 'października', 'listopada', 'grudnia'] };
const WD = { en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], pl: ['niedz.', 'pon.', 'wt.', 'śr.', 'czw.', 'pt.', 'sob.'] };
const D = (iso) => { const [y, m, d] = iso.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)); };
const dm = (iso) => { const x = D(iso); return `${x.getUTCDate()} ${MON[lang][x.getUTCMonth()]}`; };
const wdm = (iso) => { const x = D(iso); return `${WD[lang][x.getUTCDay()]} ${x.getUTCDate()} ${MON[lang][x.getUTCMonth()]}`; };
const longDate = (iso) => { const x = D(iso); return `${WD[lang][x.getUTCDay()]}, ${x.getUTCDate()} ${MONL[lang][x.getUTCMonth()]} ${x.getUTCFullYear()}`; };
const relDate = (iso) => (iso === TODAY ? t('today') : iso === '2026-10-14' ? t('yesterday') : wdm(iso));

// ---------- Sample data (fictional; docs/PRODUCT.md) ----------
const SYM = {
  Reflux: { en: 'Reflux', pl: 'Refluks' }, Panting: { en: 'Panting', pl: 'Dyszenie' }, Fear: { en: 'Fear', pl: 'Strach' },
  Leakage: { en: 'Leakage', pl: 'Wyciek' }, Poo: { en: 'Poo', pl: 'Kupa' }, Heartburn: { en: 'Heartburn', pl: 'Zgaga' },
  'Stomach rumbling': { en: 'Stomach rumbling', pl: 'Burczenie w brzuchu' }, Restlessness: { en: 'Restlessness', pl: 'Niepokój' }, Vomit: { en: 'Vomit', pl: 'Wymioty' },
};
const ALSO = { anal: { en: 'Anal glands expressed', pl: 'Opróżnienie gruczołów odbytu' }, nails: { en: 'Nail trimming', pl: 'Przycięcie pazurów' } };
function seed() {
  return {
    events: [
      { id: 'e0920r', date: '2026-09-20', type: 'symptom', title: 'Reflux', conds: ['c4'] },
      { id: 'e0920p', date: '2026-09-20', type: 'symptom', title: 'Panting', conds: ['c4'] },
      { id: 'e0928', date: '2026-09-28', type: 'symptom', title: 'Fear', conds: [] },
      { id: 'e1003l', date: '2026-10-03', type: 'symptom', title: 'Leakage', conds: [] },
      { id: 'e1003p', date: '2026-10-03', type: 'photo', title: '', detail: 'About 1 cm, soft, moves under the skin.', conds: ['c1'] },
      { id: 'e1006', date: '2026-10-06', type: 'symptom', title: 'Poo', conds: [] },
      { id: 'e1009', date: '2026-10-09', type: 'symptom', title: 'Heartburn', conds: [] },
      { id: 'e1010p', date: '2026-10-10', type: 'photo', title: '', detail: 'Same size as last week, measured with the ruler.', conds: ['c1'] },
      { id: 'e1012r', date: '2026-10-12', type: 'symptom', title: 'Stomach rumbling', conds: ['c2'] },
      { id: 'e1012p', date: '2026-10-12', type: 'symptom', title: 'Poo', conds: ['c2'] },
      { id: 'e1014m', date: '2026-10-14', type: 'vet', title: 'Maple Vet', detail: 'Symptom consultation, stomach ultrasound, limb check (X-ray of front paws recommended). Gastrelle prescribed.', conds: ['c2'] },
      { id: 'e1014v', date: '2026-10-14', type: 'vet', title: 'Riverside Vet', detail: 'Blood pressure check: high, 150–160. Further consultation.', also: ['anal', 'nails'], conds: ['c3'] },
      { id: 'e1014s', date: '2026-10-14', type: 'symptom', title: 'Restlessness', value: { en: 'a lot · Restless night and day. Refused breakfast. Weak and confused on walks, lay down a few times.', pl: 'duże · Restless night and day. Refused breakfast. Weak and confused on walks, lay down a few times.' }, conds: ['c2', 'c3'] },
      { id: 'e1014x', date: '2026-10-14', type: 'symptom', title: 'Vomit', value: { en: '1× in the morning', pl: '1× rano' }, conds: ['c2'] },
    ],
    photos: [
      { id: 'p1', eventId: 'e1003p', img: 1 },
      { id: 'p2', eventId: 'e1010p', img: 2 },
    ],
    conds: [
      { id: 'c1', name: 'Lump A', start: '2026-10-03', end: null, desc: 'Small soft lump on the left side of the chest. A photo every week, with the ruler.' },
      { id: 'c2', name: 'Stomach trouble', start: '2026-10-12', end: null, desc: 'Rumbling and soft poo, then vomiting on 14 Oct. Gastrelle course 14 to 20 Oct.' },
      { id: 'c3', name: 'Blood pressure', start: '2026-10-14', end: null, desc: 'High at Riverside Vet (150 to 160). Recheck planned.' },
      { id: 'c4', name: 'Reflux', start: '2026-09-20', end: '2026-09-30', desc: 'Reflux and panting at night.' },
    ],
    pins: [
      { id: 'n1', title: 'Allergies', text: 'None known. Watch for itching for two days after any new food.', edited: '2026-09-02' },
      { id: 'n2', title: 'Bellavet dose', text: 'Measured in bars on the syringe: 1 bar = 0,1 ml.\nUsual dose 1,5 bars with every meal.', edited: '2026-09-25' },
      { id: 'n3', title: '', text: 'Gastrelle: mix the sachet into a spoon of wet food, not into the whole bowl.', edited: '2026-10-14' },
      { id: 'n4', title: 'Next deworming', text: 'Due in March (every 6 months).', edited: '2026-09-12' },
    ],
  };
}
let db = seed();
let nextId = 1;
const uid = (p) => `${p}${Date.now().toString(36)}${nextId++}`;
const condById = (id) => db.conds.find((c) => c.id === id);
const eventById = (id) => db.events.find((e) => e.id === id);
const photosOf = (eventId) => db.photos.filter((p) => p.eventId === eventId);
const condEvents = (cid) => db.events.filter((e) => e.conds.includes(cid)).sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
const condPhotos = (cid) => condEvents(cid).slice().reverse().flatMap((e) => photosOf(e.id).map((p) => ({ ...p, date: e.date, caption: e.type === 'photo' ? e.detail : '' })));
const photoInfo = (pid) => { const p = db.photos.find((x) => x.id === pid); const e = eventById(p.eventId); return { ...p, date: e.date, caption: e.type === 'photo' ? e.detail : '', event: e }; };
const openConds = () => db.conds.filter((c) => !c.end).sort((a, b) => (a.start < b.start ? 1 : -1));
const resolvedConds = () => db.conds.filter((c) => c.end).sort((a, b) => (a.end < b.end ? 1 : -1));

// ---------- Glyphs (24px grid, currentColor, round strokes) ----------
const sv = (size, w, body, extra = '') => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${body}</svg>`;
const I = {
  plus: (s = 13) => sv(s, 2.8, '<path d="M12 5v14M5 12h14"/>'),
  chev: (dir = 'right', s = 14) => sv(s, 2.4, `<path d="${{ left: 'M15 6l-6 6 6 6', right: 'M9 6l6 6-6 6', up: 'M6 15l6-6 6 6', down: 'M6 9l6 6 6-6' }[dir]}"/>`),
  menu: () => sv(18, 2.1, '<path d="M4 7h16M4 12h16M4 17h16"/>'),
  timeline: (a) => sv(22, a ? 2.1 : 1.8, '<path d="M9.5 6.5H20M9.5 12H20M9.5 17.5H20"/><circle cx="4.8" cy="6.5" r="1.1"/><circle cx="4.8" cy="12" r="1.1"/><circle cx="4.8" cy="17.5" r="1.1"/>'),
  pin: (a, s = 22) => sv(s, a ? 2.1 : 1.8, '<path d="M9 3.5h6l-1 5.5 3.5 3.5v2h-11v-2L10 9z"/><path d="M12 14.5V21"/>'),
  tracked: (a, s = 22) => sv(s, a ? 2.1 : 1.8, '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="3.5"/><path d="M12 1.5v3M12 19.5v3M1.5 12h3M19.5 12h3"/>'),
  target: () => sv(11, 2.6, '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="2.5" fill="currentColor"/>'),
  camera: (s = 22) => sv(s, 2, '<path d="M3 8h4l2-3h6l2 3h4v12H3z"/><circle cx="12" cy="13.5" r="3.5"/>'),
  note: () => sv(15, 2, '<path d="M5 4h10l4 4v12H5z"/><path d="M9 12h6M9 16h6"/>'),
  bowl: () => sv(15, 2, '<path d="M3 11h18a9 9 0 0 1-18 0z"/><path d="M8 7c0-2 2-2 2-4M13 7c0-2 2-2 2-4"/>'),
  pill: () => sv(15, 2, '<rect x="3" y="8.5" width="18" height="7" rx="3.5" transform="rotate(-35 12 12)"/><path d="M9.5 8.3l5 7.4"/>'),
  dots: () => '<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>',
  routine: () => sv(16, 2, '<path d="M20 12a8 8 0 1 1-2.3-5.7"/><path d="M20 4v4h-4"/><path d="M12 8v4l3 2"/>'),
};
const paw = '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><ellipse cx="6.2" cy="11" rx="2" ry="2.6"/><ellipse cx="10.2" cy="6.6" rx="2" ry="2.6"/><ellipse cx="15" cy="6.6" rx="2" ry="2.6"/><ellipse cx="18.6" cy="11" rx="2" ry="2.6"/><path d="M12.4 11.4c2.6 0 5.2 2.9 5.2 5.4 0 1.8-1.5 2.7-3 2.4-.8-.2-1.4-.5-2.2-.5s-1.4.3-2.2.5c-1.5.3-3-.6-3-2.4 0-2.5 2.6-5.4 5.2-5.4z"/></svg>';
const badge = (kind, text = '') => {
  const glyph = kind === 'vet' ? '<svg class="event-badge__glyph" viewBox="0 0 12 12"><path d="M4.5 1h3v3.5H11v3H7.5V11h-3V7.5H1v-3h3.5z" fill="currentColor"></path></svg>'
    : kind === 'photo' ? '<svg class="event-badge__glyph event-badge__glyph--photo" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"><path d="M3 8h4l2-3h6l2 3h4v12H3z"></path><circle cx="12" cy="13.5" r="3.5"></circle></svg>' : '';
  return `<span class="event-badge event-badge--${kind}" aria-hidden="true">${glyph}${text}</span>`;
};

// ---------- App state ----------
const st = {
  stack: [{ view: 'timeline' }], // screens; nav tabs reset it
  sheet: null, // {kind, ...form}
  viewer: null, // {ids, i}
  compare: null, // {cid, a, b}
  ios: null, // {onPick}
  toast: null,
  reorder: false,
  scroll: {},
};
const cur = () => st.stack[st.stack.length - 1];
const tab = () => st.stack[0].view;
const go = (screen) => { saveScroll(); st.stack.push(screen); st.reorder = false; render(); scrollTopNew(); };
const back = () => { saveScroll(); if (st.stack.length > 1) st.stack.pop(); render(); };
const toTab = (view) => { saveScroll(); st.stack = [{ view }]; st.reorder = false; render(); scrollTopNew(); };
const screenKey = (s) => JSON.stringify(s);
function saveScroll() { const el = document.querySelector('.day__body, .tl-list'); if (el) st.scroll[screenKey(cur())] = el.scrollTop; }
function scrollTopNew() { const el = document.querySelector('.day__body, .tl-list'); if (el) el.scrollTop = st.scroll[screenKey(cur())] ?? 0; }

let toastTimer;
function toast(text, undo) {
  st.toast = { text, undo };
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { st.toast = null; renderToast(); }, 5000);
  renderToast();
}
const snapshot = () => JSON.parse(JSON.stringify(db));
const undoTo = (snap) => () => { db = snap; st.toast = null; render(); };

// ---------- Views ----------
const CAPTURED = ['2026-10-03', '2026-10-10', '2026-10-12', '2026-10-14', '2026-10-15'];

function viewTimeline() {
  return CAP[lang].timeline;
}
function afterTimeline(root) {
  // A photo saved in the prototype shows the existing photo badge in that row (no new mark, same geometry).
  for (const e of db.events) {
    if (!photosOf(e.id).length) continue;
    const ev = root.querySelector(`.tl-row[data-date="${e.date}"] .tl-row__events`);
    if (ev && !ev.querySelector('.event-badge--photo')) ev.insertAdjacentHTML('beforeend', badge('photo'));
  }
}

function condTags(e, row = false) {
  if (!e.conds.length) return '';
  return `<div class="cond-tags${row ? ' cond-tags--row' : ''}">${e.conds.map((cid) => {
    const c = condById(cid); if (!c) return '';
    return `<button type="button" class="cond-tag${c.end ? ' cond-tag--resolved' : ''}" data-act="cond" data-id="${c.id}" aria-label="${esc(t('openX', { x: c.name }))}">${I.target()}${esc(c.name)}</button>`;
  }).join('')}</div>`;
}
function photoRow(e, ctx) {
  const ps = photosOf(e.id);
  if (!ps.length) return '';
  // On the condition page the strip already shows them large: the history repeats them small.
  const size = ctx.startsWith('cond:') ? ' photo-thumb--sm' : '';
  return `<div class="photo-row">${ps.map((p) => `<button type="button" class="photo-thumb${size}" data-act="view" data-ids="${ctx}" data-id="${p.id}" aria-label="${esc(t('photoAlt', { d: wdm(e.date) }))}"><img src="${photoSrc(p.img)}" alt=""></button>`).join('')}</div>`;
}
function eventCard(e, ctx) {
  if (e.type === 'vet') {
    const also = (e.also ?? []).map((a) => `<span class="day-card__chip">${esc(ALSO[a][lang])}</span>`).join('');
    return `<div class="day-card ev-card"><button type="button" class="ev-card__open" data-act="event" data-id="${e.id}"><span class="day-card__head">${badge('vet')}${t('visitWord')} · ${esc(e.title)}</span>${e.detail ? `<span class="day-card__text">${esc(e.detail)}</span>` : ''}${also ? `<span class="day-card__chips">${also}</span>` : ''}</button>${photoRow(e, ctx)}${condTags(e)}</div>`;
  }
  if (e.type === 'photo') {
    return `<div class="day-card ev-card"><button type="button" class="ev-card__open" data-act="photo-edit" data-id="${photosOf(e.id)[0]?.id}"><span class="day-card__head">${badge('photo')}${t('optPhoto')}</span>${e.detail ? `<span class="day-card__text">${esc(e.detail)}</span>` : ''}</button>${photoRow(e, ctx)}${condTags(e)}</div>`;
  }
  if (e.type === 'note') {
    return `<div class="day-card ev-card"><button type="button" class="ev-card__open" data-act="event" data-id="${e.id}"><span class="day-card__head"><span class="day-card__glyph">${I.note()}</span>${t('optNote')}</span><span class="day-card__text">${esc(e.detail)}</span></button>${photoRow(e, ctx)}${condTags(e)}</div>`;
  }
  // a single symptom (condition page)
  return `<div class="day-card ev-card"><button type="button" class="ev-card__open" data-act="event" data-id="${e.id}"><span class="day-card__head">${badge('sym', '!')}${esc(SYM[e.title]?.[lang] ?? e.title)}</span>${e.value || e.detail ? `<span class="day-card__text">${esc(e.value?.[lang] ?? e.detail)}</span>` : ''}</button>${photoRow(e, ctx)}${condTags(e)}</div>`;
}
function happened(date) {
  const evs = db.events.filter((e) => e.date === date);
  if (!evs.length) return '';
  const vets = evs.filter((e) => e.type === 'vet');
  const syms = evs.filter((e) => e.type === 'symptom');
  const rest = evs.filter((e) => e.type === 'photo' || e.type === 'note');
  const ctx = `day:${date}`;
  let html = `<h3 class="day__caption">${t('happened')}</h3>`;
  html += vets.map((e) => eventCard(e, ctx)).join('');
  if (syms.length) {
    html += `<article class="day-card"><h4 class="day-card__head">${badge('sym', '!')}${t('symptoms')}</h4><ul class="day-card__rows">${syms.map((e) => `<li><button type="button" class="day-card__row" data-act="event" data-id="${e.id}"><span class="day-card__row-label">${esc(SYM[e.title]?.[lang] ?? e.title)}</span><span class="day-card__row-value">${esc(e.value?.[lang] ?? e.detail ?? '')}</span></button>${condTags(e, true)}${photoRow(e, ctx)}</li>`).join('')}</ul></article>`;
  }
  html += rest.map((e) => eventCard(e, ctx)).join('');
  return html;
}
function viewDay(date) {
  const cap = CAP[lang].days[date];
  return `<section class="day" aria-labelledby="day-title">${cap.head}<div class="day__body">${happened(date)}${cap.parts}</div></section>`;
}

function listHead(caption, title, hint, newLabel, act, showNew = true) {
  // When the list is empty, the empty state's button is the only "add" on screen.
  return `<div class="usual__head">${caption ? `<p class="usual__asof">${esc(caption)}</p>` : ''}<div class="list__titlerow"><h2 class="usual__title">${esc(title)}</h2>${showNew ? `<button type="button" class="btn btn--ghost btn--md list__new" data-act="${act}" aria-label="${esc(newLabel)}"><span class="btn__icon">${I.plus()}</span>${t('newShort')}</button>` : ''}</div><p class="usual__hint">${esc(hint)}</p></div>`;
}
function emptyCard(icon, text, label, act) {
  return `<article class="day-card day-empty"><span class="day-empty__icon">${icon}</span><div><p class="day-empty__text">${esc(text)}</p><button type="button" class="btn btn--primary btn--md" style="margin-top:var(--space-3)" data-act="${act}"><span>${I.plus()}</span>${esc(label)}</button></div></article>`;
}

function viewPinned() {
  const n = db.pins.length;
  let body;
  if (!n) body = emptyCard(I.pin(true, 16), t('pinEmpty'), t('addPinned'), 'pin-new');
  else {
    body = `<div class="day__section"><h3 class="day__caption">${plural('notes', n)}</h3>${n > 1 ? `<button type="button" class="day__link" data-act="reorder">${st.reorder ? t('done') : t('reorder')}</button>` : ''}</div>`;
    body += db.pins.map((p, i) => {
      const inner = `${p.title ? `<span class="day-card__head">${esc(p.title)}</span>` : ''}<span class="day-card__text">${esc(p.text)}</span><span class="pin-card__meta">${t('editedOn', { d: dm(p.edited) })}</span>`;
      const cls = `day-card pin-card${p.title ? '' : ' pin-card--untitled'}`;
      if (!st.reorder) return `<button type="button" class="${cls} day-card--tap" data-act="pin-edit" data-id="${p.id}">${inner}</button>`;
      const name = p.title || p.text.slice(0, 24);
      return `<div class="pin-row"><article class="${cls}">${inner}</article><div class="pin-move"><button type="button" class="day-btn day-btn--step" data-act="pin-up" data-id="${p.id}" aria-label="${esc(t('moveUp', { x: name }))}" ${i === 0 ? 'aria-disabled="true"' : ''}>${I.chev('up', 18)}</button><button type="button" class="day-btn day-btn--step" data-act="pin-down" data-id="${p.id}" aria-label="${esc(t('moveDown', { x: name }))}" ${i === n - 1 ? 'aria-disabled="true"' : ''}>${I.chev('down', 18)}</button></div></div>`;
    }).join('');
  }
  return `<section class="list" aria-labelledby="pinned-title">${listHead('', t('pinnedTitle'), t('pinnedHint'), t('addPinned'), 'pin-new', n > 0).replace('class="usual__title"', 'class="usual__title" id="pinned-title"')}<div class="day__body">${body}</div></section>`;
}

function condMeta(c) {
  const evs = condEvents(c.id);
  const nPhotos = evs.reduce((s, e) => s + photosOf(e.id).length, 0);
  const nEvents = evs.filter((e) => e.type !== 'photo').length;
  const when = c.end ? `${dm(c.start)} – ${dm(c.end)}` : t('since', { d: dm(c.start) });
  return [when, nPhotos ? plural('photos', nPhotos) : '', nEvents ? plural('events', nEvents) : ''].filter(Boolean).join(' · ');
}
function condCard(c) {
  const ps = condPhotos(c.id);
  const last = ps[ps.length - 1];
  return `<button type="button" class="day-card day-card--tap cond-card${c.end ? ' cond-card--resolved' : ''}" data-act="cond" data-id="${c.id}"><span class="cond-card__text"><span class="day-card__head">${esc(c.name)}</span><span class="cond-card__meta">${esc(condMeta(c))}</span></span>${last ? `<span class="photo-thumb photo-thumb--sm" aria-hidden="true"><img src="${photoSrc(last.img)}" alt=""></span>` : ''}<span class="cond-card__chev">${I.chev('right', 16)}</span></button>`;
}
function viewTracked() {
  const open = openConds(), done = resolvedConds();
  let body;
  if (!open.length && !done.length) body = emptyCard(I.tracked(true, 16), t('trackedEmpty'), t('trackNew'), 'cond-new');
  else {
    body = open.length ? `<h3 class="day__caption">${t('openSection')}</h3>${open.map(condCard).join('')}` : '';
    if (done.length) body += `<h3 class="day__caption">${t('resolvedSection')}</h3>${done.map(condCard).join('')}`;
  }
  return `<section class="list" aria-labelledby="tracked-title">${listHead(open.length ? t('openCount', { n: open.length }) : '', t('trackedTitle'), t('trackedHint'), t('trackNew'), 'cond-new', open.length + done.length > 0).replace('class="usual__title"', 'class="usual__title" id="tracked-title"')}<div class="day__body">${body}</div></section>`;
}

function viewCond(cid) {
  const c = condById(cid);
  if (!c) return viewTracked();
  const ps = condPhotos(cid);
  const evs = condEvents(cid);
  const status = c.end ? t('statusResolved', { a: dm(c.start), b: dm(c.end) }) : t('statusOpen', { d: dm(c.start) });
  const ctx = `cond:${cid}`;
  const strip = `<div class="strip" data-strip>${ps.map((p) => `<div class="strip__item"><button type="button" class="photo-thumb photo-thumb--lg" data-act="view" data-ids="${ctx}" data-id="${p.id}" aria-label="${esc(t('photoAlt', { d: wdm(p.date) }))}"><img src="${photoSrc(p.img)}" alt=""></button><span class="strip__date">${dm(p.date)}</span></div>`).join('')}<div class="strip__item"><button type="button" class="photo-pick photo-pick--tile" data-act="photo-new" data-cond="${cid}"><span class="photo-pick__icon">${I.camera(16)}</span>${t('addPhoto')}</button><span class="strip__date">&nbsp;</span></div></div>`;
  let hist = '';
  let last = '';
  for (const e of evs) {
    if (e.date !== last) { hist += `<p class="cond__group">${relDate(e.date)}</p>`; last = e.date; }
    hist += eventCard({ ...e, conds: e.conds.filter((x) => x !== cid) }, ctx);
  }
  return `<section class="day list" aria-labelledby="cond-title">
  <div class="day__top cond__top"><button type="button" class="day-btn day-btn--back" data-act="back">${I.chev('left', 18)}${t('tracked')}</button><button type="button" class="link-btn" data-act="cond-edit" data-id="${cid}">${t('edit')}</button></div>
  <div class="usual__head"><p class="usual__asof${c.end ? ' usual__asof--resolved' : ''}">${esc(status)}</p><h2 class="usual__title" id="cond-title">${esc(c.name)}</h2>${c.desc ? `<p class="cond__desc">${esc(c.desc)}</p>` : ''}</div>
  <div class="day__body">
    ${!ps.length && c.end ? '' : `<div class="day__section"><h3 class="day__caption">${t('photos')}${ps.length ? ` · ${ps.length}` : ''}</h3>${ps.length > 1 ? `<button type="button" class="day__link" data-act="compare" data-id="${cid}">${t('compare')}${I.chev('right')}</button>` : ''}</div>`}
    ${ps.length ? strip : c.end ? '' : `<div class="strip-empty"><button type="button" class="photo-pick photo-pick--tile" data-act="photo-new" data-cond="${cid}"><span class="photo-pick__icon">${I.camera(16)}</span>${t('addPhoto')}</button><p class="strip-empty__text">${t('noPhotos')}</p></div>`}
    <div class="day__section"><h3 class="day__caption">${t('history')}</h3><button type="button" class="day__link" data-act="cond-add" data-id="${cid}">${I.plus(12)}${t('add')}</button></div>
    ${hist || `<article class="day-card day-empty"><span class="day-empty__icon">${I.tracked(true, 16)}</span><p class="day-empty__text">${t('noEvents')}</p></article>`}
    <div class="cond__end"><button type="button" class="btn btn--ghost btn--lg" data-act="${c.end ? 'reopen' : 'resolve'}" data-id="${cid}">${c.end ? t('reopen') : t('markResolved')}</button></div>
  </div></section>`;
}

// ---------- Shell ----------
function navItem(view, label, icon) {
  const on = tab() === view;
  return `<button type="button" class="nav__item" data-act="tab" data-view="${view}" ${on ? 'aria-current="page"' : ''}>${icon(on)}${label}</button>`;
}
function render() {
  const s = cur();
  const main = s.view === 'timeline' ? viewTimeline() : s.view === 'day' ? viewDay(s.date) : s.view === 'pinned' ? viewPinned() : s.view === 'tracked' ? viewTracked() : viewCond(s.id);
  const app = document.getElementById('app');
  app.innerHTML = `<p class="banner">${lang === 'pl' ? 'Demo z przykładowymi danymi. Zmiany zostają w tej przeglądarce.' : 'Demo with sample data. Changes stay in this browser.'}</p>
  <header class="bar"><div class="brand"><span class="brand__mark" aria-hidden="true">${paw}</span><h1 class="title">PawLog</h1></div><div class="bar__actions"><button type="button" class="btn btn--ghost menu-btn" data-act="menu"><span class="btn__icon">${I.menu()}</span>${t('menu')}</button></div></header>
  ${main}
  <nav class="nav" aria-label="${t('menu')}">${navItem('timeline', t('timeline'), I.timeline)}${navItem('pinned', t('navPinned'), I.pin)}<div class="nav__add-wrap"><button type="button" class="btn btn--primary nav__add" data-act="add">${I.plus()}${t('add')}</button></div>${navItem('tracked', t('navTracked'), I.tracked)}</nav>
  <div id="sheet-host"></div><div id="overlay-host"></div><div class="toast-root" aria-live="polite" id="toast-host"></div>`;
  if (s.view === 'timeline') afterTimeline(app);
  const strip = app.querySelector('[data-strip]');
  if (strip) strip.scrollLeft = strip.scrollWidth;
  const el = app.querySelector('.day__body, .tl-list');
  if (el && st.scroll[screenKey(s)] != null) el.scrollTop = st.scroll[screenKey(s)];
  renderSheet(); renderOverlay(); renderToast();
  document.documentElement.lang = lang;
  for (const b of document.querySelectorAll('.flows [data-flang]')) b.setAttribute('aria-pressed', String(b.dataset.flang === lang));
}
function renderToast() {
  const h = document.getElementById('toast-host');
  if (!h) return;
  const x = st.toast;
  h.innerHTML = x ? `<div class="toast" role="status"><span class="toast__text">${esc(x.text)}</span>${x.undo ? `<button type="button" class="link-btn" data-act="undo">${t('undo')}</button>` : ''}</div>` : '';
}

// ---------- Sheets ----------
function sheetFrame(title, body, foot = '') {
  return `<div class="sheet-root"><button type="button" class="sheet-scrim" aria-label="${t('close')}" data-act="sheet-close" tabindex="-1"></button><div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="sheet__grab"><span></span></div><div class="sheet__head"><h2 class="sheet__title">${esc(title)}</h2><button type="button" class="sheet__close" data-act="sheet-close">${t('close')}</button></div><div class="sheet__body">${body}</div>${foot ? `<div class="sheet__foot">${foot}</div>` : ''}</div></div>`;
}
const field = (label, inner, hint = '', err = '') => `<div class="field"><div class="field__label"><span>${esc(label)}</span>${hint ? `<span class="field__hint">${esc(hint)}</span>` : ''}</div>${inner}${err ? `<p class="field__error">${esc(err)}</p>` : ''}</div>`;
const dateline = (date, extra = '') => `<div class="dateline"><span>${esc(t('forD', { d: wdm(date) }))}${extra ? ` · ${esc(extra)}` : ''}</span><button type="button" class="link-btn" data-act="date-change">${t('change')}</button></div>`;
const saveFoot = (canDelete) => `${canDelete ? `<button type="button" class="btn btn--ghost btn--lg btn--danger" data-act="sheet-delete">${t('delete')}</button>` : ''}<button type="button" class="btn btn--primary btn--lg" data-act="sheet-save">${t('save')}</button>`;

function condPicker(f) {
  const open = openConds();
  const res = resolvedConds();
  const linkedRes = res.filter((c) => f.conds.includes(c.id));
  const otherRes = res.filter((c) => !f.conds.includes(c.id));
  const chip = (c) => `<button type="button" class="chip" aria-pressed="${f.conds.includes(c.id)}" data-act="pick-cond" data-id="${c.id}">${esc(c.end ? t('resolvedTag', { x: c.name }) : c.name)}</button>`;
  let inner = `<div class="chips" role="group" aria-label="${esc(t('condField'))}">${open.map(chip).join('')}${linkedRes.map(chip).join('')}${f.showRes ? otherRes.map(chip).join('') : ''}${!f.showRes && otherRes.length ? `<button type="button" class="chip" data-act="show-res">${t('showResolved', { n: otherRes.length })}</button>` : ''}${f.newOpen ? '' : `<button type="button" class="chip" data-act="new-cond"><span class="chip__mark">${I.plus(12)}</span>${t('newCond')}</button>`}</div>`;
  if (f.newOpen) inner += `<div class="input-row"><input class="input" data-f="newName" placeholder="${esc(t('condPh'))}" aria-label="${esc(t('condName'))}" value="${esc(f.newName ?? '')}"><button type="button" class="btn btn--ghost btn--lg" data-act="new-cond-add">${t('add')}</button></div>`;
  return field(t('condField'), inner, t('optional'));
}
function photosField(f) {
  const thumbs = f.photos.map((p) => `<span class="photo-thumb photo-thumb--sm" aria-hidden="true"><img src="${photoSrc(p.img)}" alt=""></span>`).join('');
  return field(t('photos'), `<div class="photo-row" style="margin-top:0">${thumbs}<button type="button" class="photo-pick photo-pick--sm" data-act="event-photo" aria-label="${esc(t('addPhoto'))}">${I.camera(18)}</button></div>`, t('optional'));
}

function sheetHtml(f) {
  switch (f.kind) {
    case 'menu':
      return sheetFrame(t('menu'), `<ul class="menu-list"><li><button type="button" class="menu-row" data-act="noscope">${I.routine()}<span class="menu-row__text">${lang === 'pl' ? 'Zwykły dzień' : 'Usual day'}</span>${I.chev()}</button></li></ul>${field(t('langSwitch'), `<div class="lang"><button type="button" class="lang-btn" data-act="lang" data-lang="en" aria-pressed="${lang === 'en'}">EN</button><button type="button" class="lang-btn" data-act="lang" data-lang="pl" aria-pressed="${lang === 'pl'}">PL</button></div>`)}`);
    case 'add': {
      const c = f.cond ? condById(f.cond) : null;
      const opts = c
        ? [['photo', 'optPhoto', I.camera(15)], ['symptom', 'optSymptom', '<span style="font-weight:800">!</span>'], ['vet', 'optVet', I.plus(12)], ['note', 'optNote', I.note()]]
        : [['food', 'optFood', I.bowl()], ['med', 'optMed', I.pill()], ['symptom', 'optSymptom', '<span style="font-weight:800">!</span>'], ['vet', 'optVet', I.plus(12)], ['note', 'optNote', I.note()], ['photo', 'optPhoto', I.camera(15)], ['other', 'optOther', I.dots()]];
      const icon = (k, g) => k === 'symptom' ? `<span class="add-opt__icon" style="background:var(--color-badge-sym-top);border-color:var(--color-badge-sym-line);color:var(--color-badge-sym-ink)">${g}</span>`
        : k === 'photo' ? `<span class="add-opt__icon" style="background:var(--color-badge-photo-top);border-color:var(--color-badge-photo-line);color:var(--color-badge-photo-ink)">${g}</span>` : `<span class="add-opt__icon">${g}</span>`;
      return sheetFrame(c ? t('addToX', { x: c.name }) : t('add'), `${dateline(f.date)}<div class="add-grid">${opts.map(([k, l, g]) => `<button type="button" class="btn btn--ghost add-opt" data-act="add-opt" data-k="${k}">${icon(k, g)}<span class="add-opt__text">${t(l)}</span></button>`).join('')}</div>`);
    }
    case 'pin': {
      const body = field(t('pinTitle'), `<input class="input" data-f="title" value="${esc(f.title)}">`, t('optional'))
        + field(t('pinText'), `<textarea class="input" rows="6" data-f="text" placeholder="${esc(t('pinPh'))}">${esc(f.text)}</textarea>`, '', f.err ? t('pinTextErr') : '');
      return sheetFrame(f.id ? t('editPinned') : t('addPinned'), body, saveFoot(!!f.id));
    }
    case 'cond': {
      let body = field(t('condName'), `<input class="input" data-f="name" value="${esc(f.name)}" placeholder="${esc(t('condPh'))}">`, '', f.err ? t('condNameErr') : '')
        + `<div class="two${f.end ? '' : ' two--one'}">${field(t('condStart'), `<input class="input" type="date" data-f="start" value="${f.start}" max="${TODAY}">`)}${f.end ? field(t('resolvedOn'), `<input class="input" type="date" data-f="end" value="${f.end}" max="${TODAY}">`) : ''}</div>`
        + field(t('description'), `<textarea class="input" rows="3" data-f="desc">${esc(f.desc)}</textarea>`, t('optional'));
      if (f.id) body += `<p class="field__note" style="margin-top:-4px">${t('condDeleteNote')}</p>`;
      return sheetFrame(f.id ? t('editCond') : t('trackNew'), body, saveFoot(!!f.id));
    }
    case 'resolve':
      return sheetFrame(t('markResolved'), field(t('resolvedOn'), `<input class="input" type="date" data-f="end" value="${f.end}" max="${TODAY}" min="${condById(f.id).start}">`), saveFoot(false));
    case 'photo': {
      const pick = f.img
        ? `<div class="photo-preview"><img src="${photoSrc(f.img)}" alt=""><button type="button" class="btn btn--ghost photo-preview__change" data-act="photo-pick">${t('change')}</button></div><p class="field__note">${t('photoResized')}</p>`
        : `<button type="button" class="photo-pick" data-act="photo-pick"><span class="photo-pick__icon">${I.camera(22)}</span>${t('pickPhoto')}</button>`;
      let body = dateline(f.date, f.fromPhoto ? t('photoDate') : '') + `<div class="field">${pick}${f.err ? `<p class="field__error">${t('photoErr')}</p>` : ''}</div>`;
      if (!f.attached) body += condPicker(f);
      body += field(t('description'), `<textarea class="input" rows="2" data-f="caption" placeholder="${esc(t('descPh'))}">${esc(f.caption)}</textarea>`, t('optional'));
      return sheetFrame(f.id ? t('editPhoto') : t('addPhoto'), body, saveFoot(!!f.id));
    }
    case 'event': {
      let body = dateline(f.date);
      if (f.type === 'vet') {
        body += field(t('clinic'), `<input class="input" data-f="title" value="${esc(f.title)}" placeholder="e.g. Maple Vet"><div class="chips">${['Maple Vet', 'Riverside Vet'].map((x) => `<button type="button" class="chip" aria-pressed="${f.title === x}" data-act="clinic" data-v="${x}">${x}</button>`).join('')}</div>`)
          + field(t('reason'), `<textarea class="input" rows="3" data-f="detail">${esc(f.detail)}</textarea>`)
          + field(t('alsoDone'), `<div class="chips">${Object.keys(ALSO).map((k) => `<button type="button" class="chip" aria-pressed="${(f.also ?? []).includes(k)}" data-act="also" data-v="${k}">${esc(ALSO[k][lang])}</button>`).join('')}</div>`, t('optional'));
      } else if (f.type === 'symptom') {
        body += field(t('optSymptom'), `<div class="chips">${Object.keys(SYM).map((k) => `<button type="button" class="chip" aria-checked="${f.title === k}" role="radio" data-act="sym" data-v="${esc(k)}">${esc(SYM[k][lang])}</button>`).join('')}</div>`)
          + field(t('details'), `<textarea class="input" rows="2" data-f="detail">${esc(f.detail)}</textarea>`, t('optional'));
      } else {
        body += field(t('optNote'), `<textarea class="input" rows="4" data-f="detail">${esc(f.detail)}</textarea>`);
      }
      body += photosField(f) + condPicker(f);
      const title = f.id ? t('editEvent') : f.type === 'vet' ? t('addVet') : f.type === 'symptom' ? t('addSymptom') : t('addNote');
      return sheetFrame(title, body, saveFoot(!!f.id));
    }
  }
  return '';
}
function renderSheet() {
  const h = document.getElementById('sheet-host');
  if (!h) return;
  const prev = h.querySelector('.sheet__body');
  const top = prev ? prev.scrollTop : 0;
  const same = prev && h.dataset.k === st.sheet?.kind;
  h.innerHTML = st.sheet ? sheetHtml(st.sheet) : '';
  h.dataset.k = st.sheet?.kind ?? '';
  const body = h.querySelector('.sheet__body');
  if (body && same) body.scrollTop = top;
  if (!same && st.sheet) h.querySelector('.sheet')?.focus?.();
}
function openSheet(f) { st.sheet = f; document.getElementById('sheet-host').dataset.k = ''; renderSheet(); }
function closeSheet() { st.sheet = null; renderSheet(); }

// ---------- Viewer and compare ----------
function photoList(ctx) {
  const [kind, id] = ctx.split(':');
  if (kind === 'cond') return condPhotos(id).map((p) => p.id);
  return db.events.filter((e) => e.date === id).flatMap((e) => photosOf(e.id).map((p) => p.id));
}
function renderOverlay() {
  const h = document.getElementById('overlay-host');
  if (!h) return;
  let html = '';
  if (st.viewer) {
    const { ids, i } = st.viewer;
    const p = photoInfo(ids[i]);
    html += `<div class="viewer" role="dialog" aria-modal="true" aria-label="${esc(t('photoAlt', { d: wdm(p.date) }))}">
      <div class="viewer__bar"><p class="viewer__pos">${t('iOfN', { i: i + 1, n: ids.length })}</p><button type="button" class="sheet__close" data-act="viewer-close">${t('close')}</button></div>
      <div class="viewer__stage" data-swipe><div class="viewer__track" style="transform:translateX(${-i * 100}%)">${ids.map((id) => `<div class="viewer__slide"><img src="${photoSrc(photoInfo(id).img)}" alt="${esc(photoInfo(id).caption || t('photoAlt', { d: wdm(photoInfo(id).date) }))}" draggable="false"></div>`).join('')}</div>
        ${ids.length > 1 ? `<button type="button" class="day-btn day-btn--step viewer__step viewer__step--prev" data-act="viewer-step" data-d="-1" aria-label="${t('prevPhoto')}" ${i === 0 ? 'aria-disabled="true"' : ''}>${I.chev('left', 18)}</button><button type="button" class="day-btn day-btn--step viewer__step viewer__step--next" data-act="viewer-step" data-d="1" aria-label="${t('nextPhoto')}" ${i === ids.length - 1 ? 'aria-disabled="true"' : ''}>${I.chev('right', 18)}</button>` : ''}
      </div>
      <div class="viewer__info"><p class="viewer__date">${longDate(p.date)}</p>${p.caption ? `<p class="viewer__caption">${esc(p.caption)}</p>` : ''}${condTags(p.event)}
        <div class="viewer__links"><button type="button" class="link-btn" data-act="viewer-day" data-date="${p.date}">${t('openDay')}</button><button type="button" class="link-btn" data-act="photo-edit" data-id="${p.id}">${t('edit')}</button></div></div>
    </div>`;
  }
  if (st.compare) {
    const ps = condPhotos(st.compare.cid);
    const fig = (k, which) => {
      const p = ps[st.compare[k]];
      return `<figure class="compare__item"><img src="${photoSrc(p.img)}" alt="${esc(t('photoAlt', { d: wdm(p.date) }))}"><figcaption class="compare__cap"><span><span class="compare__which">${which}</span><br><span class="compare__date">${longDate(p.date)}</span></span><span class="compare__steps"><button type="button" class="day-btn day-btn--step" data-act="cmp-step" data-k="${k}" data-d="-1" aria-label="${t('prevPhoto')}" ${st.compare[k] === 0 ? 'aria-disabled="true"' : ''}>${I.chev('left', 18)}</button><button type="button" class="day-btn day-btn--step" data-act="cmp-step" data-k="${k}" data-d="1" aria-label="${t('nextPhoto')}" ${st.compare[k] === ps.length - 1 ? 'aria-disabled="true"' : ''}>${I.chev('right', 18)}</button></span></figcaption></figure>`;
    };
    const isFirst = st.compare.a === 0, isLatest = st.compare.b === ps.length - 1;
    html += `<div class="viewer" role="dialog" aria-modal="true" aria-label="${t('compare')}"><div class="viewer__bar"><p class="viewer__pos">${t('compare')} · ${esc(condById(st.compare.cid).name)}</p><button type="button" class="sheet__close" data-act="compare-close">${t('close')}</button></div><div class="compare__body">${fig('a', isFirst ? t('first') : dm(ps[st.compare.a].date))}${fig('b', isLatest ? t('latest') : dm(ps[st.compare.b].date))}</div></div>`;
  }
  if (st.ios) {
    html += `<div class="ios-menu" data-act="ios-cancel"><div class="ios-menu__group"><p class="ios-menu__note">${t('iosNote')}</p><button type="button" class="ios-menu__btn" data-act="ios-pick" data-src="lib">${t('lib')}</button><button type="button" class="ios-menu__btn" data-act="ios-pick" data-src="cam">${t('cam')}</button><button type="button" class="ios-menu__btn" data-act="ios-pick" data-src="file">${t('file')}</button></div><div class="ios-menu__group ios-menu__cancel"><button type="button" class="ios-menu__btn" data-act="ios-cancel">${t('cancel')}</button></div></div>`;
  }
  h.innerHTML = html;
}

// ---------- Actions ----------
const today = () => TODAY;
function newEventForm(type, date, cond) {
  return { kind: 'event', type, date, title: '', detail: '', photos: [], conds: cond ? [cond] : [], showRes: false, newOpen: false };
}
function newPhotoForm(date, cond) { return { kind: 'photo', date, img: null, caption: '', conds: cond ? [cond] : [], showRes: false, newOpen: false, fromPhoto: false }; }
let imgCounter = 3;

function save() {
  const f = st.sheet;
  const snap = snapshot();
  if (f.kind === 'pin') {
    if (!f.text.trim()) { f.err = true; return renderSheet(); }
    if (f.id) Object.assign(db.pins.find((p) => p.id === f.id), { title: f.title.trim(), text: f.text.trim(), edited: TODAY });
    else db.pins.unshift({ id: uid('n'), title: f.title.trim(), text: f.text.trim(), edited: TODAY });
    closeSheet(); render(); toast(t('toastSaved'), undoTo(snap)); return;
  }
  if (f.kind === 'cond') {
    if (!f.name.trim()) { f.err = true; return renderSheet(); }
    if (f.id) { Object.assign(condById(f.id), { name: f.name.trim(), start: f.start, end: f.end || null, desc: f.desc.trim() }); closeSheet(); render(); }
    else { const id = uid('c'); db.conds.push({ id, name: f.name.trim(), start: f.start, end: null, desc: f.desc.trim() }); closeSheet(); go({ view: 'cond', id }); }
    toast(t('toastSaved'), undoTo(snap)); return;
  }
  if (f.kind === 'resolve') { condById(f.id).end = f.end; closeSheet(); render(); toast(t('toastResolved'), undoTo(snap)); return; }
  if (f.kind === 'photo') {
    if (!f.img) { f.err = true; return renderSheet(); }
    if (f.id) {
      const p = db.photos.find((x) => x.id === f.id); const e = eventById(p.eventId);
      p.img = f.img; e.date = f.date;
      if (e.type === 'photo') { e.detail = f.caption.trim(); e.conds = f.conds; }
    } else {
      const eid = uid('e');
      db.events.push({ id: eid, date: f.date, type: 'photo', title: '', detail: f.caption.trim(), conds: f.conds });
      db.photos.push({ id: uid('p'), eventId: eid, img: f.img });
    }
    closeSheet(); st.viewer = null; afterSaveShow(f); toast(t('toastSaved'), undoTo(snap)); return;
  }
  if (f.kind === 'event') {
    let e = f.id ? eventById(f.id) : null;
    if (!e) { e = { id: uid('e'), date: f.date, type: f.type, title: '', detail: '', conds: [] }; db.events.push(e); }
    Object.assign(e, { title: f.title, detail: f.detail, conds: f.conds, also: f.also ?? [] });
    db.photos = db.photos.filter((p) => p.eventId !== e.id).concat(f.photos.map((p) => ({ ...p, eventId: e.id })));
    closeSheet(); afterSaveShow(f); toast(t('toastSaved'), undoTo(snap));
  }
}
// As in the app: a new entry from + Add shows its day. From a condition page, stay there.
function afterSaveShow(f) {
  if (!f.id && cur().view !== 'cond' && CAPTURED.includes(f.date) && !(cur().view === 'day' && cur().date === f.date)) return openDay(f.date);
  render();
}
function remove() {
  const f = st.sheet;
  const snap = snapshot();
  if (f.kind === 'pin') { db.pins = db.pins.filter((p) => p.id !== f.id); closeSheet(); render(); toast(t('toastPinDeleted'), undoTo(snap)); }
  if (f.kind === 'cond') {
    db.conds = db.conds.filter((c) => c.id !== f.id);
    for (const e of db.events) e.conds = e.conds.filter((x) => x !== f.id);
    closeSheet(); if (cur().view === 'cond') st.stack.pop(); render(); toast(t('toastCondDeleted'), undoTo(snap));
  }
  if (f.kind === 'photo') {
    const p = db.photos.find((x) => x.id === f.id); const e = eventById(p.eventId);
    db.photos = db.photos.filter((x) => x.id !== f.id);
    if (e.type === 'photo' && !photosOf(e.id).length) db.events = db.events.filter((x) => x.id !== e.id);
    closeSheet(); st.viewer = null; render(); toast(t('toastPhotoDeleted'), undoTo(snap));
  }
  if (f.kind === 'event') { db.events = db.events.filter((e) => e.id !== f.id); db.photos = db.photos.filter((p) => p.eventId !== f.id); closeSheet(); render(); toast(t('toastEventDeleted'), undoTo(snap)); }
}
function openDay(date) {
  if (!CAPTURED.includes(date)) return toast(t('notCaptured'));
  st.viewer = null; st.compare = null;
  if (cur().view === 'day') { st.stack[st.stack.length - 1] = { view: 'day', date }; render(); return; }
  go({ view: 'day', date });
}

document.addEventListener('click', (ev) => {
  // Flows panel (prototype chrome): keep the chosen language across flows.
  const flang = ev.target.closest('[data-flang]');
  if (flang) {
    const h = new URLSearchParams(location.hash.slice(1)); h.set('lang', flang.dataset.flang);
    location.hash = h.toString(); return;
  }
  const flow = ev.target.closest('.flows a');
  if (flow) {
    ev.preventDefault();
    const h = new URLSearchParams(flow.getAttribute('href').slice(1)); h.set('lang', lang);
    const next = h.toString();
    if (location.hash.slice(1) === next) applyHash(); else location.hash = next;
    return;
  }
  const link = ev.target.closest('a.tl-row__link');
  if (link) { ev.preventDefault(); const d = link.getAttribute('href').split('/').pop(); return openDay(d); }
  const el = ev.target.closest('[data-act]');
  if (!el) {
    // Captured Day view chrome: back and step buttons.
    const btn = ev.target.closest('.day-btn--back, .day-btn--step, .day__link, .part-add, .day-item__open, .tl-key__toggle');
    if (!btn) return;
    if (btn.classList.contains('day-btn--back')) return back();
    if (btn.classList.contains('day-btn--step') && cur().view === 'day') {
      const i = CAPTURED.indexOf(cur().date);
      const prev = btn.getAttribute('aria-label')?.match(/Previous|Poprzedni/);
      const d = CAPTURED[i + (prev ? -1 : 1)];
      return d ? openDay(d) : toast(t('notCaptured'));
    }
    return toast(t('notInScope'));
  }
  const a = el.dataset.act;
  const id = el.dataset.id;
  const f = st.sheet;
  if (el.getAttribute('aria-disabled') === 'true') return;
  switch (a) {
    case 'tab': return toTab(el.dataset.view);
    case 'back': return back();
    case 'menu': return openSheet({ kind: 'menu' });
    case 'lang': lang = el.dataset.lang; return render();
    case 'noscope': return toast(t('notInScope'));
    case 'add': return openSheet({ kind: 'add', date: cur().view === 'day' ? cur().date : today() });
    case 'add-opt': {
      const k = el.dataset.k; const date = f.date; const cond = f.cond;
      if (k === 'photo') return openSheet(newPhotoForm(date, cond));
      if (k === 'symptom' || k === 'vet' || k === 'note') return openSheet(newEventForm(k, date, cond));
      return toast(t('notInScope'));
    }
    case 'date-change': return toast(t('notInScope'));
    case 'sheet-close': return closeSheet();
    case 'sheet-save': return save();
    case 'sheet-delete': return remove();
    case 'undo': return st.toast?.undo?.();
    case 'pin-new': return openSheet({ kind: 'pin', id: null, title: '', text: '' });
    case 'pin-edit': { const p = db.pins.find((x) => x.id === id); return openSheet({ kind: 'pin', id, title: p.title, text: p.text }); }
    case 'reorder': st.reorder = !st.reorder; return render();
    case 'pin-up': case 'pin-down': {
      const i = db.pins.findIndex((p) => p.id === id); const j = i + (a === 'pin-up' ? -1 : 1);
      [db.pins[i], db.pins[j]] = [db.pins[j], db.pins[i]]; render();
      document.querySelector(`[data-act="${a}"][data-id="${id}"]`)?.focus(); return;
    }
    case 'cond': st.viewer = null; closeSheet(); if (cur().view === 'cond' && cur().id === id) return render(); return go({ view: 'cond', id });
    case 'cond-new': return openSheet({ kind: 'cond', id: null, name: '', start: TODAY, end: null, desc: '' });
    case 'cond-edit': { const c = condById(id); return openSheet({ kind: 'cond', id, name: c.name, start: c.start, end: c.end, desc: c.desc }); }
    case 'cond-add': return openSheet({ kind: 'add', date: TODAY, cond: id });
    case 'resolve': return openSheet({ kind: 'resolve', id, end: TODAY });
    case 'reopen': { const snap = snapshot(); condById(id).end = null; render(); return toast(t('toastReopened'), undoTo(snap)); }
    case 'compare': { const n = condPhotos(id).length; st.compare = { cid: id, a: 0, b: n - 1 }; return renderOverlay(); }
    case 'compare-close': st.compare = null; return renderOverlay();
    case 'cmp-step': st.compare[el.dataset.k] += Number(el.dataset.d); return renderOverlay();
    case 'view': { const ids = photoList(el.dataset.ids); st.viewer = { ids, i: ids.indexOf(id) }; return renderOverlay(); }
    case 'viewer-close': st.viewer = null; return renderOverlay();
    case 'viewer-step': st.viewer.i += Number(el.dataset.d); return renderOverlay();
    case 'viewer-day': return openDay(el.dataset.date);
    case 'photo-new': return openSheet(newPhotoForm(TODAY, el.dataset.cond));
    case 'photo-edit': {
      const p = photoInfo(id);
      return openSheet({ kind: 'photo', id, date: p.date, img: p.img, caption: p.caption, conds: [...p.event.conds], attached: p.event.type !== 'photo', showRes: false, newOpen: false });
    }
    case 'photo-pick': st.ios = { target: 'photo' }; return renderOverlay();
    case 'event-photo': st.ios = { target: 'event' }; return renderOverlay();
    case 'ios-cancel': if (ev.target !== el && a === 'ios-cancel' && el.classList.contains('ios-menu')) return; st.ios = null; return renderOverlay();
    case 'ios-pick': {
      const img = (imgCounter++ % 2) ? 3 : 4;
      if (st.ios.target === 'photo') { Object.assign(f, { img, err: false, fromPhoto: el.dataset.src === 'lib' }); }
      else f.photos.push({ id: uid('p'), img });
      st.ios = null; renderOverlay(); return renderSheet();
    }
    case 'event': {
      const e = eventById(id);
      return openSheet({ kind: 'event', id, type: e.type, date: e.date, title: e.title, detail: e.detail ?? '', also: [...(e.also ?? [])], photos: photosOf(id).map((p) => ({ ...p })), conds: [...e.conds], showRes: false, newOpen: false });
    }
    case 'clinic': f.title = el.dataset.v; return renderSheet();
    case 'also': { const v = el.dataset.v; f.also = (f.also ?? []).includes(v) ? f.also.filter((x) => x !== v) : [...(f.also ?? []), v]; return renderSheet(); }
    case 'sym': f.title = el.dataset.v; return renderSheet();
    case 'pick-cond': f.conds = f.conds.includes(id) ? f.conds.filter((x) => x !== id) : [...f.conds, id]; return renderSheet();
    case 'show-res': f.showRes = true; return renderSheet();
    case 'new-cond': f.newOpen = true; renderSheet(); return document.querySelector('[data-f="newName"]')?.focus();
    case 'new-cond-add': {
      const name = (f.newName ?? '').trim();
      if (!name) return document.querySelector('[data-f="newName"]')?.focus();
      const cid = uid('c'); db.conds.push({ id: cid, name, start: f.date, end: null, desc: '' });
      f.conds = [...f.conds, cid]; f.newOpen = false; f.newName = ''; return renderSheet();
    }
  }
});
document.addEventListener('input', (ev) => {
  const k = ev.target.dataset?.f;
  if (k && st.sheet) { st.sheet[k] = ev.target.value; if (st.sheet.err) { st.sheet.err = false; } }
});
document.addEventListener('keydown', (ev) => {
  if (ev.key === 'Escape') { if (st.ios) { st.ios = null; renderOverlay(); } else if (st.viewer || st.compare) { st.viewer = null; st.compare = null; renderOverlay(); } else if (st.sheet) closeSheet(); }
  if (st.viewer && (ev.key === 'ArrowLeft' || ev.key === 'ArrowRight')) {
    const i = st.viewer.i + (ev.key === 'ArrowLeft' ? -1 : 1);
    if (i >= 0 && i < st.viewer.ids.length) { st.viewer.i = i; renderOverlay(); }
  }
});
// Swipe between photos in the viewer.
let swipe = null;
document.addEventListener('pointerdown', (ev) => { const s = ev.target.closest('[data-swipe]'); if (s && !ev.target.closest('button')) swipe = { x: ev.clientX, track: s.querySelector('.viewer__track'), w: s.clientWidth }; });
document.addEventListener('pointermove', (ev) => { if (!swipe) return; const dx = ev.clientX - swipe.x; swipe.track.style.transition = 'none'; swipe.track.style.transform = `translateX(calc(${-st.viewer.i * 100}% + ${dx}px))`; });
document.addEventListener('pointerup', (ev) => {
  if (!swipe) return;
  const dx = ev.clientX - swipe.x; swipe.track.style.transition = '';
  const i = st.viewer.i + (dx < -50 ? 1 : dx > 50 ? -1 : 0);
  st.viewer.i = Math.max(0, Math.min(st.viewer.ids.length - 1, i)); swipe = null; renderOverlay();
});

// ---------- Deep links (Flows panel and screenshots) ----------
function applyHash() {
  const h = new URLSearchParams(location.hash.slice(1));
  document.body.classList.toggle('shot', h.get('shot') === '1');
  lang = h.get('lang') === 'pl' ? 'pl' : 'en';
  db = seed();
  if (h.get('empty') === '1') { db.pins = []; db.conds = []; for (const e of db.events) e.conds = []; }
  st.sheet = null; st.viewer = null; st.compare = null; st.ios = null; st.toast = null; st.reorder = h.get('reorder') === '1'; st.scroll = {};
  const s = h.get('screen') ?? 'timeline';
  const [name, arg] = s.split(':');
  const stacks = {
    timeline: [{ view: 'timeline' }],
    day: [{ view: 'timeline' }, { view: 'day', date: arg }],
    pinned: [{ view: 'pinned' }],
    tracked: [{ view: 'tracked' }],
    cond: [{ view: 'tracked' }, { view: 'cond', id: arg }],
  };
  st.stack = stacks[name] ?? stacks.timeline;
  render();
  const sheet = h.get('sheet');
  if (sheet) {
    const [k, x] = sheet.split(':');
    if (k === 'add') openSheet({ kind: 'add', date: cur().view === 'day' ? cur().date : TODAY, cond: cur().view === 'cond' ? cur().id : undefined });
    if (k === 'pin') { const p = db.pins.find((y) => y.id === x); openSheet({ kind: 'pin', id: x, title: p.title, text: p.text }); }
    if (k === 'cond') { const c = condById(x); openSheet({ kind: 'cond', id: x, name: c.name, start: c.start, end: c.end, desc: c.desc }); }
    if (k === 'event') document.querySelector(`[data-act="event"][data-id="${x}"]`)?.click();
    if (k === 'photo-new') { openSheet(newPhotoForm(TODAY, x)); if (h.get('picked')) Object.assign(st.sheet, { img: 3, fromPhoto: true, caption: h.get('picked') === '2' ? 'A bit smaller than on 10 Oct?' : '' }), renderSheet(); }
    if (k === 'resolve') openSheet({ kind: 'resolve', id: x, end: TODAY });
  }
  if (h.get('sheetEnd')) { const b = document.querySelector('.sheet__body'); if (b) b.scrollTop = b.scrollHeight; }
  if (h.get('ios')) { st.ios = { target: 'photo' }; renderOverlay(); }
  const v = h.get('viewer');
  if (v) { const [ctx, i] = v.split('@'); const ids = photoList(ctx); st.viewer = { ids, i: Number(i) || 0 }; renderOverlay(); }
  const c = h.get('compare');
  if (c) { st.compare = { cid: c, a: 0, b: condPhotos(c).length - 1 }; renderOverlay(); }
  const sc = h.get('scroll');
  if (sc) { const el = document.querySelector('.day__body, .tl-list'); if (el) el.scrollTop = Number(sc); }
  if (h.get('toast')) toast(t(h.get('toast')), () => {});
}
window.addEventListener('hashchange', applyHash);
applyHash();
