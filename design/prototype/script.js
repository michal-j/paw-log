class Component extends DCLogic {
  state = { screen: 'timeline', view: 'timeline', back: 'timeline', sel: '2026-10-14', topDate: '2026-10-15', topOff: 0, keyOpen: false, partsOpen: false,  lang: 'en', sheet: null, form: null, addDate: '2026-10-15', addPart: 0, scrub: null, issueBack: 'tracked', off: { treat: true, calmora: true } };

  componentDidUpdate(prevProps, prevState) {
    try {
      const st = this.state;
      const inMx = st.view === 'matrix' && st.screen === 'timeline';
      const wasMx = prevState.view === 'matrix' && prevState.screen === 'timeline';
      if (inMx && !wasMx) {
        [30, 150, 400].forEach((ms) => setTimeout(() => { const el = document.getElementById('r6-mx'); if (el) el.scrollLeft = el.scrollWidth; }, ms));
      }
      const back = st.screen === 'timeline' && prevState.screen !== 'timeline';
      if (back && st.view === 'timeline' && this._dateOff) {
        const list = document.getElementById('r5-list');
        const o = this._dateOff[st.sel];
        if (list && o !== undefined) { this._list = list; list.scrollTop = Math.max(0, o - 70); }
      }
    } catch (err) { /* lo-fi: scrolling is a convenience */ }
  }

  renderVals() {
    const st = this.state;
    const lang = st.lang;
    const loc = lang === 'pl' ? 'pl-PL' : 'en-GB';
    const tr = (en, pl) => (lang === 'pl' ? pl : en);
    const TODAY = '2026-10-15';
    const START = '2026-09-01';
    const FIRSTMONTH = '2025-10';
    const CALFROM = '2026-07';
    const pad = (n) => String(n).padStart(2, '0');
    const parse = (s) => { const p = s.split('-').map(Number); return new Date(Date.UTC(p[0], p[1] - 1, p[2])); };
    const iso = (d) => d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate());
    const shift = (s, n) => { const d = parse(s); d.setUTCDate(d.getUTCDate() + n); return iso(d); };
    const fmt = (s, o) => parse(s).toLocaleDateString(loc, Object.assign({ timeZone: 'UTC' }, o));
    const C = { cook: '#BFE04A', farm: '#C99D6C', ocean: '#FF9585', arvelin: '#86B1F7', bellavet: '#FFB85C', gastrelle: '#B59BF2', biomend: '#5DCFC8', treat: '#F486C3', calmora: '#A8B3C0', ink: '#0E1512' };
    const ACC = '#0A7A52';
    const MEALBG = 'rgba(31,211,138,0.06)';
    const MEALSH = 'inset 1px 0 0 #E3EBE7, inset -1px 0 0 #E3EBE7';
    const hx = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
    const mixc = (h, t, p) => { const a = hx(h), b = hx(t); return '#' + a.map((v, i) => Math.round(v + (b[i] - v) * p).toString(16).padStart(2, '0')).join(''); };
    const lt = (h, p) => mixc(h, '#ffffff', p);
    const dk = (h, p) => mixc(h, '#000000', p);
    const on = (fid) => !st.off[fid];

    const t = {
      
      jump: tr('Jump to date', 'Wybierz datę'), langBtn: lang === 'pl' ? 'PL | EN' : 'EN | PL',
      filters: tr('Filters', 'Filtry'), filterHint: tr('Choose what the timeline, calendar and matrix show. The day view always shows everything.', 'Wybierz, co pokazują oś czasu, kalendarz i macierz. Widok dnia zawsze pokazuje wszystko.'),
      reset: tr('Default', 'Domyślne'), showAll: tr('Show all', 'Pokaż wszystko'), mxHint: tr('Item', 'Pozycja'),
      key: tr('Key', 'Klucz'), keyAria: tr('Key for the day below. Tap to expand or collapse.', 'Klucz dla dnia poniżej. Dotknij, aby rozwinąć lub zwinąć.'),
      events: tr('Events', 'Wydarzenia'), marks: tr('Marks', 'Oznaczenia'),
      kVet: tr('Vet visit (number)', 'Wizyta u weta (liczba)'), kSym: tr('Symptoms', 'Objawy'), kPhoto: tr('Photo of tracked issue', 'Zdjęcie śledzonej sprawy'),
      kFront: tr('Frontline (monthly)', 'Frontline (co miesiąc)'), kWorm: tr('Deworming pill', 'Tabletka odrobaczająca'),
      parts: tr('Day', 'Dzień'), partsAria: tr('Parts of the day. Tap to expand or collapse.', 'Pory dnia. Dotknij, aby rozwinąć lub zwinąć.'),
      railAria: tr('Scroll through weeks, months and years', 'Przewijanie tygodni, miesięcy i lat'),
      backfill: tr('Backfill ›', 'Uzupełnij ›'),
      back: tr('Back', 'Wstecz'), prevDay: tr('Previous day', 'Poprzedni dzień'), nextDay: tr('Next day', 'Następny dzień'),
      happened: tr('What happened', 'Co się wydarzyło'), visitWord: tr('Vet visit', 'Wizyta u weta'), photoWord: tr('photo', 'zdjęcie'),
      dayPartsTitle: tr('Parts of the day', 'Pory dnia'), noData: tr('Nothing logged for this date yet. Use the buttons above or + on a day part to backfill.', 'Brak wpisów z tego dnia. Użyj przycisków powyżej lub + przy porze dnia, aby uzupełnić.'),
      nothingSched: tr('Nothing scheduled', 'Nic nie zaplanowano'), attachments: tr('Attachments', 'Załączniki'), attachBtn: tr('Attach photo or PDF to this day', 'Dodaj zdjęcie lub PDF do tego dnia'),
      pinned: tr('Pinned notes', 'Przypięte notatki'), pinnedHint: tr('Standing facts that are not tied to a day.', 'Stałe informacje niezwiązane z konkretnym dniem.'), addPinned: tr('Add pinned note', 'Dodaj przypiętą notatkę'),
      trackedTitle: tr('Tracked issues', 'Śledzone sprawy'), trackedHint: tr('Things you follow over time, with photos and notes.', 'Rzeczy pod obserwacją, ze zdjęciami i notatkami.'),
      trackedMeta: tr('2 photos · 3 Oct, 10 Oct', '2 zdjęcia · 3 paź, 10 paź'), trackNew: tr('Track something new', 'Śledź nową sprawę'),
      trackedOne: tr('Tracked issue', 'Śledzona sprawa'), openDay: tr('open day', 'otwórz dzień'), photoPh: tr('[Photo placeholder]', '[Miejsce na zdjęcie]'), addPhoto: tr('Add photo', 'Dodaj zdjęcie'),
      search: tr('Search', 'Szukaj'), searchPh: tr('Search entries, vet visits, medications…', 'Szukaj wpisów, wizyt, leków…'),
      searchNote: tr('Not built yet (MVP placeholder). Planned: quickly list all vet visits, symptoms, every dose of one medication, photos and notes.', 'Jeszcze niezbudowane (miejsce na MVP). Planowane: szybka lista wszystkich wizyt u weta, objawów, wszystkich dawek jednego leku, zdjęć i notatek.'),
      close: tr('Close', 'Zamknij'), save: tr('Save', 'Zapisz'),
      pickDate: tr('Or pick any date (backfill works the same)', 'Albo wybierz dowolną datę (uzupełnianie działa tak samo)')
    };

    // ---------- Day parts and lanes ----------
    const PNAMES = [
      tr('Before breakfast', 'Przed śniadaniem'), tr('Breakfast', 'Śniadanie'), tr('Between breakfast and dinner', 'Między śniadaniem a obiadem'), tr('Dinner', 'Obiad'),
      tr('Between dinner and supper', 'Między obiadem a kolacją'), tr('Supper', 'Kolacja'), tr('After supper', 'Po kolacji')
    ];
    const PVERT = [tr('Before bkf.', 'Przed śn.'), tr('Breakfast', 'Śniadanie'), tr('Bkf → dinner', 'Śn. → obiad'), tr('Dinner', 'Obiad'), tr('Dinner → sup.', 'Obiad → kol.'), tr('Supper', 'Kolacja'), tr('After supper', 'Po kolacji')];
    const MEAL = [false, true, false, true, false, true, false];
    const LANES = [
      ['p1arvelin', 1, 'arvelin', C.arvelin, 11, 'Arvelin'], ['p2cook', 2, 'meals', C.cook, 16, tr('Breakfast', 'Śniadanie')], ['p2bellavet', 2, 'bellavet', C.bellavet, 11, 'Bellavet'], ['p2biomend', 2, 'biomend', C.biomend, 11, 'Biomend'],
      ['p3gastrelle', 3, 'gastrelle', C.gastrelle, 11, 'Gastrelle'], ['p3treat', 3, 'treat', C.treat, 11, tr('Treats', 'Smaczki')], ['p4food', 4, 'meals', null, 16, tr('Dinner', 'Obiad')], ['p4bellavet', 4, 'bellavet', C.bellavet, 11, 'Bellavet'],
      ['p5arvelin', 5, 'arvelin', C.arvelin, 11, 'Arvelin'], ['p6food', 6, 'meals', null, 16, tr('Supper', 'Kolacja')], ['p6bellavet', 6, 'bellavet', C.bellavet, 11, 'Bellavet'], ['p7calmora', 7, 'calmora', C.calmora, 11, 'Calmora']
    ].map((a) => ({ key: a[0], part: a[1], fid: a[2], color: a[3], size: a[4], w: a[4] + 4, name: a[5] }));
    const partLanes = [0, 1, 2, 3, 4, 5, 6].map((pi) => LANES.filter((l) => l.part === pi + 1 && on(l.fid)));
    const COLW = partLanes.map((ls, pi) => (pi === 6 && !ls.length) ? 0 : Math.max(MEAL[pi] ? 44 : (pi === 6 ? 36 : 24), ls.reduce((a, l) => a + l.w, 0) + 8));

    const items = (s) => {
      const out = [];
      if (s < START || s > TODAY) return out;
      const isT = s === TODAY;
      const farm = s <= '2026-10-11';
      const fc = farm ? C.farm : C.ocean;
      const fn = farm ? tr('Farm Fresh, turkey', 'Farm Fresh, indyk') : tr('Ocean Blend, salmon', 'Ocean Blend, łosoś');
      const fs = farm ? 'Farm Fresh' : 'Ocean Blend';
      const fp = farm ? tr('¼ can', '¼ puszki') : tr('½ can', '½ puszki');
      const tagR = tr('Refused', 'Nie chciała');
      const add = (part, id, name, short, dose, color, state, tag) => out.push({ part: part, lane: 'p' + part + id, name: name, short: short, dose: dose, color: color, state: state, tag: state === 'skipped' || state === 'half' ? tag : '' });
      const arvelin = s >= '2026-09-20', bellavet = s >= '2026-09-25', gastrelle = s >= '2026-10-15' && s <= '2026-10-20';
      const gastrelleN = Math.round((parse(s) - parse('2026-10-14')) / 86400000) + 1;
      const half = tr('½ pill', '½ tabl.');
      const pd = '0,15 ml (1,5 bars)';
      if (arvelin) add(1, 'arvelin', 'Arvelin', 'Arvelin', half, C.arvelin, 'given', '');
      add(2, 'cook', tr('Cooked meal', 'Gotowany posiłek'), tr('Breakfast', 'Śniadanie'), tr('⅓ tray', '⅓ tacki'), C.cook, s === '2026-10-14' ? 'skipped' : 'given', tagR);
      if (bellavet && !isT) add(2, 'bellavet', 'Bellavet', 'Bellavet', pd, C.bellavet, 'given', '');
      add(2, 'biomend', 'Biomend', 'Biomend', tr('1 pill', '1 tabl.'), C.biomend, 'given', '');
      if (gastrelle) add(3, 'gastrelle', 'Gastrelle', 'Gastrelle', tr('1 sachet · day ', '1 saszetka · dzień ') + gastrelleN + tr(' of 7', ' z 7'), C.gastrelle, 'given', '');
      if (Number(s.slice(8)) % 3 === 0 || s === '2026-10-14') add(3, 'treat', tr('Treat', 'Smaczek'), tr('Treats', 'Smaczki'), tr('chicken · 2', 'kurczak · 2'), C.treat, 'given', '');
      add(4, 'food', fn, tr('Dinner', 'Obiad'), fp, fc, s === '2026-10-14' ? 'half' : 'given', tr('Half eaten', 'Zjadła pół'));
      if (bellavet) add(4, 'bellavet', 'Bellavet', 'Bellavet', pd, C.bellavet, 'given', '');
      if (arvelin) add(5, 'arvelin', 'Arvelin', 'Arvelin', half, C.arvelin, 'given', '');
      add(6, 'food', fn, tr('Supper', 'Kolacja'), fp, fc, 'given', '');
      if (bellavet) add(6, 'bellavet', 'Bellavet', 'Bellavet', pd, C.bellavet, 'given', '');
      if (s <= '2026-09-19') add(7, 'calmora', 'Calmora', 'Calmora', tr('1 capsule', '1 kaps.'), C.calmora, 'given', '');
      return out;
    };

    // ---------- Symptoms and events ----------
    const lvl = (n) => (n === 1 ? tr('a little', 'mało') : n === 2 ? tr('medium', 'średnio') : tr('a lot', 'dużo'));
    const SYMNAME = { sx_leak: tr('Leakage', 'Przeciek'), sx_poo: tr('Poo', 'Kupa'), sx_vomit: tr('Vomit', 'Wymioty'), sx_pant: tr('Panting', 'Dyszenie'), sx_rumble: tr('Stomach rumbling', 'Przelewanie w brzuchu'), sx_heart: tr('Heartburn', 'Zgaga'), sx_fear: tr('Fear', 'Strach'), sx_rest: tr('Restlessness', 'Niepokój'), sx_reflux: tr('Reflux', 'Refluks') };
    const SYMIDS = ['sx_leak', 'sx_poo', 'sx_vomit', 'sx_pant', 'sx_rumble', 'sx_heart', 'sx_fear', 'sx_rest', 'sx_reflux'];
    const SD = {
      '2026-10-14': [['sx_rest', lvl(3)], ['sx_vomit', tr('1× in the morning', '1× rano')]],
      '2026-10-12': [['sx_rumble', lvl(1)], ['sx_poo', tr('soft · normal colour · small', 'miękka · normalny kolor · mało')]],
      '2026-10-09': [['sx_heart', lvl(2)]],
      '2026-10-06': [['sx_poo', tr('diarrhea · dark · medium amount', 'biegunka · ciemna · średnio')]],
      '2026-10-03': [['sx_leak', tr('small amount · ', 'mała ilość · ') + lvl(1)]],
      '2026-09-28': [['sx_fear', lvl(3)]],
      '2026-09-20': [['sx_reflux', lvl(2)], ['sx_pant', lvl(1)]]
    };
    const symsOf = (s) => (SD[s] || []).map((a) => ({ id: a[0], name: SYMNAME[a[0]], detail: a[1] }));
    const events = (s) => ({ vet: s === '2026-10-14' ? 2 : 0, photo: s === '2026-10-03' || s === '2026-10-10', front: s === '2026-09-08' || s === '2026-10-08', worm: s === '2026-09-12', syms: symsOf(s) });
    const fev = (s) => { const e = events(s); return { vet: on('vet') ? e.vet : 0, photo: on('photo') && e.photo, front: on('frontline') && e.front, worm: on('deworm') && e.worm, nsym: e.syms.filter((x) => on(x.id)).length }; };

    const lvlBg = (c, rg) => 'linear-gradient(0deg,' + c + ' 50%,' + rg + ' 50%)';
    const sq = (color, state, size) => {
      const z = size || 14;
      const base = 'width:' + z + 'px;height:' + z + 'px;box-sizing:border-box;flex:none;border-radius:50%;';
      const ring = dk(color, 0.2);
      if (state === 'skipped') return base + 'background:#fff;border:' + (z >= 14 ? 1.75 : 1.5) + 'px solid ' + ring;
      if (state === 'half') return base + 'background:' + lvlBg(color, '#fff') + ';border:1.25px solid ' + ring;
      return base + 'background:' + color + ';border:1.25px solid ' + ring;
    };
    const msq = (color, state, size) => {
      const base = 'width:' + size + 'px;height:' + size + 'px;box-sizing:border-box;flex:none;border-radius:50%;';
      const ring = dk(color, 0.2);
      if (state === 'skipped') return base + 'background:#fff;border:1.5px solid ' + ring;
      if (state === 'half') return base + 'background:' + lvlBg(color, '#fff') + ';border:1px solid ' + ring;
      return base + 'background:' + color + ';border:1px solid ' + ring;
    };
    const FOODBG = 'linear-gradient(90deg,' + C.farm + ' 50%,' + C.ocean + ' 50%)';
    // ---- shared event badge system (timeline, calendar, matrix, key) ----
    const BTONE = {
      vet: 'background:linear-gradient(180deg,#E9FAF2,#D3F3E4);color:#0A7A52;border:1px solid #A8E6CB',
      sym: 'background:linear-gradient(180deg,#FFEEEC,#FFDCD8);color:#B3282F;border:1px solid #F4B5AF',
      photo: 'background:linear-gradient(180deg,#F3EFFF,#E5DEFF);color:#5B3FB0;border:1px solid #C9BCF2',
      front: 'background:linear-gradient(180deg,#EAF3FF,#D8E8FF);color:#2455A6;border:1px solid #B1CDF3',
      worm: 'background:linear-gradient(180deg,#FFF6E0,#FFEBC2);color:#8A5A00;border:1px solid #F0D08C'
    };
    const BSH = ';box-shadow:0 1px 1.5px rgba(14,21,18,.10),inset 0 1px 0 rgba(255,255,255,.7)';
    const BB = 'display:inline-flex;align-items:center;justify-content:center;gap:2px;height:18px;min-width:18px;box-sizing:border-box;padding:0 4px;border-radius:6px;font-size:11px;font-weight:800;line-height:16px;';
    const MB = 'display:inline-flex;align-items:center;justify-content:center;gap:1px;height:13px;min-width:13px;box-sizing:border-box;padding:0 2px;border-radius:4px;font-size:9px;font-weight:800;line-height:11px;';
    const bst = (k, base) => base + BTONE[k] + BSH;
    const bdg = (k, text, base, extra) => Object.assign({ vet: k === 'vet', photo: k === 'photo', chg: false, text: text, t: text, ic: k === 'vet' || k === 'photo', st: bst(k, base || BB) }, extra || {});
    const evBadges = (s) => {
      const e = fev(s); const out = [];
      if (e.vet) out.push(bdg('vet', String(e.vet)));
      if (e.nsym) out.push(bdg('sym', e.nsym > 1 ? '!' + e.nsym : '!'));
      if (e.photo) out.push(bdg('photo', ''));
      if (e.front) out.push(bdg('front', 'F'));
      if (e.worm) out.push(bdg('worm', 'D'));
      return out;
    };
    const miniBadges = (s) => {
      const e = fev(s); const out = [];
      if (e.vet) out.push(bdg('vet', '', MB));
      if (e.nsym) out.push(bdg('sym', '!', MB));
      if (e.photo) out.push(bdg('photo', '', MB));
      if (e.front) out.push(bdg('front', 'F', MB));
      if (e.worm) out.push(bdg('worm', 'D', MB));
      return out;
    };
    const keyBadges = [
      Object.assign(bdg('vet', '2'), { name: tr('Vet visit (number)', 'Wizyta u weta (liczba)') }),
      Object.assign(bdg('sym', '!'), { name: tr('Symptoms', 'Objawy') }),
      Object.assign(bdg('photo', ''), { name: tr('Photo of tracked issue', 'Zdjęcie śledzonej sprawy') }),
      Object.assign(bdg('front', 'F'), { name: tr('Frontline', 'Frontline') }),
      Object.assign(bdg('worm', 'D'), { name: tr('Deworming', 'Odrobaczanie') })
    ];
    const flagsText = (s) => {
      const e = events(s); const f = [];
      if (e.vet) f.push(e.vet + tr(' vet visits', ' wizyty u weta'));
      if (e.syms.length) f.push(e.syms.map((x) => x.name).join(', '));
      if (e.photo) f.push(tr('Lump A photo', 'zdjęcie Lump A'));
      if (e.front) f.push('Frontline');
      if (e.worm) f.push(tr('deworming pill', 'tabletka odrobaczająca'));
      if (items(s).some((i) => i.state === 'skipped')) f.push(tr('something refused', 'nie chciała'));
      return f;
    };
    const openDay = (s) => () => this.setState({ sel: s, screen: 'day', back: 'timeline', sheet: null });
    const view = st.view;
    if (view === 'matrix') {
      if (!this._mxShown) { this._mxShown = true; [60, 200, 500].forEach((ms) => setTimeout(() => { try { const el = document.getElementById('r6-mx'); if (el) el.scrollLeft = el.scrollWidth; } catch (err) { /* ignore */ } }, ms)); }
    } else { this._mxShown = false; }

    // ---------- Timeline: one continuous list, newest first ----------
    const prevMonth = (m) => { const p = m.split('-').map(Number); const d = new Date(Date.UTC(p[0], p[1] - 2, 1)); return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1); };
    const rows = [];
    const dateOff = {};
    const ticks = [];
    let y = 0;
    if (view === 'timeline') {
      let m = TODAY.slice(0, 7);
      while (m >= FIRSTMONTH) {
        const my = m.split('-').map(Number);
        let last = new Date(Date.UTC(my[0], my[1], 0)).getUTCDate();
        if (m === TODAY.slice(0, 7)) last = Number(TODAY.slice(8, 10));
        const hasData = m >= START.slice(0, 7);
        const dayRows = [];
        if (hasData) for (let dd = last; dd >= 1; dd--) { const s = m + '-' + pad(dd); if (s >= START && s <= TODAY) dayRows.push(s); }
        rows.push({ isBand: true, isDay: false, h: hasData ? 28 : 44, top: y, title: fmt(m + '-01', { month: 'long', year: 'numeric' }), backfill: !hasData });
        ticks.push({ off: y, kind: m.endsWith('-01') ? 'y' : 'm' });
        y += hasData ? 28 : 44;
        dayRows.forEach((s) => {
          const its = items(s);
          const isToday = s === TODAY;
          const fl = flagsText(s);
          const cells = partLanes.map((lanes, pi) => {
            const pitems = its.filter((i) => i.part === pi + 1);
            const skip = lanes.some((l) => { const it = pitems.find((i) => i.lane === l.key); return it && it.state === 'skipped'; });
            return {
              w: COLW[pi],
              bg: MEAL[pi] ? MEALBG : 'transparent', sh: MEAL[pi] ? MEALSH : 'none',
              slots: lanes.map((l) => { const it = pitems.find((i) => i.lane === l.key); return { w: l.w, st: it ? sq(it.color, it.state, l.size) : 'width:0;height:0' }; })
            };
          });
          dateOff[s] = y;
          if (parse(s).getUTCDay() === 0 || isToday) ticks.push({ off: y, kind: 'w' });
          rows.push({
            isBand: false, isDay: true, h: 44, top: y, date: s,
            num: Number(s.slice(8, 10)),
            wd: isToday ? tr('Today', 'Dziś') : fmt(s, { weekday: 'short' }),
            wdc: isToday ? ACC : '#6B756F', wdw: isToday ? 700 : 500,
            today: isToday, nw: isToday ? 700 : 600, nc: '#0E1512',
            cells: cells, events: evBadges(s),
            aria: fmt(s, { weekday: 'long', day: 'numeric', month: 'long' }) + (fl.length ? ': ' + fl.join(', ') : ': ' + tr('as usual', 'jak zwykle')),
            open: openDay(s)
          });
          y += 44;
        });
        m = prevMonth(m);
      }
    }
    const total = y + 120;
    this._dateOff = dateOff;
    let actOff = -1;
    ticks.forEach((k) => { if (k.off <= st.topOff && k.off > actOff) actOff = k.off; });
    const tickOut = ticks.map((k) => {
      const act = k.off === actOff;
      return { top: (k.off / total * 100).toFixed(3), w: act ? 16 : (k.kind === 'y' ? 14 : (k.kind === 'm' ? 11 : 7)), right: act ? 2 : (k.kind === 'y' ? 3 : 4), bg: act ? '#1FD38A' : (k.kind === 'w' ? '#CBD3CE' : '#A3AEA8') };
    });

    // ---------- Key (top of timeline) ----------
    const kd = st.topDate;
    const kits = kd ? items(kd) : [];
    const keyCols = partLanes.map((lanes, pi) => {
      const pitems = kits.filter((i) => i.part === pi + 1);
      return { w: COLW[pi], bg: MEAL[pi] ? MEALBG : 'transparent', sh: MEAL[pi] ? MEALSH : 'none', slots: lanes.map((l) => { const it = pitems.find((i) => i.lane === l.key); return { w: l.w, label: it ? it.short : '', color: it ? it.color : 'transparent' }; }) };
    });
    const keyMarks = [
      { name: tr('Given', 'Podane'), st: sq(C.cook, 'given', 14) },
      { name: tr('Skipped / refused', 'Pominięte / nie chciała'), st: sq(C.cook, 'skipped', 14) },
      { name: tr('Partly eaten', 'Zjedzone częściowo'), st: sq(C.cook, 'half', 14) },
      { name: tr('Big circle = food', 'Duże kółko = jedzenie'), st: sq('#A3AEA8', 'given', 16) },
      { name: tr('Small circle = medication', 'Małe kółko = lek'), st: sq('#A3AEA8', 'given', 10) }
    ];
    const keyDate = kd ? fmt(kd, { day: 'numeric', month: 'short' }) : '—';
    const partCols = partLanes.map((ls, pi) => ({
      w: COLW[pi], bg: MEAL[pi] ? MEALBG : 'transparent', sh: MEAL[pi] ? MEALSH : 'none', fw: MEAL[pi] ? 700 : 500, fg: MEAL[pi] ? '#0E1512' : '#6B756F',
      vlabel: MEAL[pi] ? PVERT[pi] : '', vh: MEAL[pi] ? 60 : 0, ico1: pi === 1, ico2: pi === 3, ico3: pi === 5, tw: MEAL[pi] ? Math.min(30, COLW[pi] - 14) : 0, tick: MEAL[pi] ? '#0E1512' : 'transparent'
    }));

    const onListScroll = (e) => {
      const el = e.currentTarget; this._list = el;
      const sc = el.scrollTop;
      let lo = 0, hi = rows.length - 1;
      while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (rows[mid].top <= sc + 1) lo = mid; else hi = mid - 1; }
      let i = lo; while (i < rows.length && !rows[i].isDay) i++;
      const d = i < rows.length ? rows[i].date : null;
      if (d !== st.topDate || rows[lo].top !== st.topOff) this.setState({ topDate: d, topOff: rows[lo].top });
    };
    const railTo = (e) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const f = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
      const list = e.currentTarget.parentElement.firstElementChild;
      this._list = list;
      list.scrollTop = Math.min(f * total, list.scrollHeight - list.clientHeight);
      this.setState({ scrub: { y: e.clientY - rect.top } });
    };
    const topRow = rows.find((r) => r.top === st.topOff) || rows[0];
    const scrubLabel = topRow ? (topRow.isDay ? fmt(topRow.date, { day: 'numeric', month: 'short', year: 'numeric' }) : topRow.title) : '';

    // ---------- Calendar ----------
    const calHead = (lang === 'pl' ? ['P', 'W', 'Ś', 'C', 'P', 'S', 'N'] : ['M', 'T', 'W', 'T', 'F', 'S', 'S']).map((l) => ({ l: l }));
    const calMonths = [];
    if (view === 'calendar') {
      let m = TODAY.slice(0, 7);
      while (m >= CALFROM) {
        const my = m.split('-').map(Number);
        const dim = new Date(Date.UTC(my[0], my[1], 0)).getUTCDate();
        const off = (parse(m + '-01').getUTCDay() + 6) % 7;
        const cells = [];
        for (let i = 0; i < off; i++) cells.push({ blank: true });
        for (let dd = 1; dd <= dim; dd++) cells.push({ s: m + '-' + pad(dd) });
        while (cells.length % 7) cells.push({ blank: true });
        const weeks = [];
        for (let i = 0; i < cells.length; i += 7) {
          weeks.push({
            cells: cells.slice(i, i + 7).map((c) => {
              if (c.blank) return { h: 66, num: '', nw: 400, nc: '#0E1512', nbg: 'transparent', bg: 'transparent', op: 1, sqs: [], badges: [], aria: '', open: () => {} };
              const s = c.s; const fut = s > TODAY; const isT = s === TODAY;
              const its = items(s).filter((i) => { const l = LANES.find((x) => x.key === i.lane); return l && on(l.fid); }).sort((a, b) => a.part - b.part);
              return {
                h: 66, num: Number(s.slice(8)), nw: isT ? 700 : 600, nc: isT ? '#04251A' : '#0E1512', nbg: isT ? '#1FD38A' : 'transparent',
                bg: 'transparent', op: fut ? 0.3 : (s < START ? 0.6 : 1),
                sqs: its.map((i) => { const l = LANES.find((x) => x.key === i.lane); return { st: msq(i.color, i.state, l.size === 16 ? 9 : 7) }; }),
                badges: fut ? [] : miniBadges(s),
                aria: fmt(s, { weekday: 'long', day: 'numeric', month: 'long' }),
                open: fut ? () => {} : openDay(s)
              };
            })
          });
        }
        calMonths.push({ title: fmt(m + '-01', { month: 'long', year: 'numeric' }), weeks: weeks });
        m = prevMonth(m);
      }
    }

    // ---------- Week matrix ----------
    const mxDates = [];
    for (let s = START; s <= TODAY; s = shift(s, 1)) mxDates.push(s);
    const mxHeads = [], mxRows = [];
    if (view === 'matrix') {
      mxDates.forEach((s, i) => {
        const isT = s === TODAY; const mon = parse(s).getUTCDay() === 1;
        mxHeads.push({ top: (i === 0 || s.slice(8) === '01') ? fmt(s, { month: 'short' }) : '', wd: fmt(s, { weekday: 'narrow' }), num: Number(s.slice(8)), nc: isT ? ACC : '#0E1512', nw: isT ? 700 : 600, bg: 'transparent', bl: mon ? '1px solid #C9D2CD' : '1px solid #EEF2F0', aria: fmt(s, { weekday: 'long', day: 'numeric', month: 'long' }), open: openDay(s) });
      });
      const dayItems = {}; mxDates.forEach((s) => { dayItems[s] = items(s); });
      partLanes.forEach((lanes, pi) => {
        lanes.forEach((l, li) => {
          mxRows.push({
            bt: li === 0 ? '1px solid #D5DCD8' : '1px solid #EEF2F0', name: l.name,
            i1: li === 0 && pi === 1, i2: li === 0 && pi === 3, i3: li === 0 && pi === 5,
            key: 'width:9px;height:9px;flex:none;display:inline-block;border-radius:50%;background:' + (l.color || FOODBG),
            cells: mxDates.map((s) => {
              const it = dayItems[s].find((i) => i.lane === l.key);
              const mon = parse(s).getUTCDay() === 1;
              return { t: '', bl: mon ? '1px solid #C9D2CD' : '1px solid #EEF2F0', bg: MEAL[pi] ? MEALBG : 'transparent', sh: 'none', st: it ? sq(it.color, it.state, l.size === 16 ? 14 : 10) : 'width:0;height:0', aria: fmt(s, { day: 'numeric', month: 'long' }) + ' · ' + l.name, open: openDay(s) };
            })
          });
        });
      });
      const evRows = [
        ['vet', tr('Vet visit', 'Wizyta u weta'), '#0A7A52', (e) => (e.vet ? bdg('vet', String(e.vet)) : null)],
        ['symptoms', tr('Symptoms', 'Objawy'), '#B3282F', (e) => (e.nsym ? bdg('sym', e.nsym > 1 ? '!' + e.nsym : '!') : null)],
        ['frontline', 'Frontline', '#2455A6', (e) => (e.front ? bdg('front', 'F') : null)],
        ['deworm', tr('Deworming', 'Odrobaczanie'), '#8A5A00', (e) => (e.worm ? bdg('worm', 'D') : null)],
        ['photo', tr('Photo', 'Zdjęcie'), '#5B3FB0', (e) => (e.photo ? bdg('photo', '') : null)]
      ];
      const evOn = { vet: on('vet'), symptoms: SYMIDS.some((id) => on(id)), frontline: on('frontline'), deworm: on('deworm'), photo: on('photo') };
      let firstEv = true;
      evRows.forEach((r) => {
        if (!evOn[r[0]]) return;
        mxRows.push({
          bt: firstEv ? '2px solid #C9D2CD' : '1px solid #EEF2F0', name: r[1], i1: false, i2: false, i3: false,
          key: 'width:9px;height:9px;flex:none;display:inline-block;border-radius:2px;background:' + r[2],
          cells: mxDates.map((s) => {
            const b = r[3](fev(s)); const mon = parse(s).getUTCDay() === 1;
            return { t: b ? b.t : '', vet: !!(b && b.vet), photo: !!(b && b.photo), bl: mon ? '1px solid #C9D2CD' : '1px solid #EEF2F0', bg: 'transparent', sh: 'none', st: b ? b.st : 'width:0;height:0', aria: fmt(s, { day: 'numeric', month: 'long' }) + ' · ' + r[1], open: openDay(s) };
          })
        });
        firstEv = false;
      });
    }

    // ---------- Filters ----------
    const DEFOFF = ['treat', 'calmora'];
    const offKeys = Object.keys(st.off).filter((k) => st.off[k]).sort();
    const filtersActive = offKeys.join(',') !== DEFOFF.slice().sort().join(',');
    const toggle = (fid) => () => { const o = Object.assign({}, st.off); if (o[fid]) delete o[fid]; else o[fid] = true; this.setState({ off: o }); };
    const chip = (fid, label, color) => {
      const isOn = on(fid);
      return { label: label, on: isOn, pick: toggle(fid), bg: isOn ? '#E8FAF2' : '#FFFFFF', fg: isOn ? '#0A6B48' : '#46504B', bd: isOn ? '1px solid #8EDDBB' : '1px solid #D5DCD8', sh: 'none', st: color ? ('width:11px;height:11px;box-sizing:border-box;flex:none;border-radius:50%;' + (isOn ? 'background:' + color + ';border:1.25px solid ' + dk(color, 0.2) : 'background:#fff;border:1.5px solid ' + dk(color, 0.15))) : 'display:none' };
    };
    const filterGroups = [
      { title: tr('Food', 'Jedzenie'), chips: [chip('meals', tr('Meals', 'Posiłki'), C.cook), chip('treat', tr('Treats', 'Smaczki'), C.treat)] },
      { title: tr('Medication', 'Leki'), chips: [chip('arvelin', 'Arvelin', C.arvelin), chip('bellavet', 'Bellavet', C.bellavet), chip('gastrelle', 'Gastrelle', C.gastrelle), chip('biomend', 'Biomend', C.biomend), chip('calmora', 'Calmora', C.calmora), chip('frontline', 'Frontline', '#1F2328'), chip('deworm', tr('Deworming pill', 'Odrobaczanie'), '#1F2328')] },
      { title: tr('Symptoms', 'Objawy'), chips: SYMIDS.map((id) => chip(id, SYMNAME[id], '#D93B4A')) },
      { title: tr('Events', 'Wydarzenia'), chips: [chip('vet', tr('Vet visits', 'Wizyty u weta'), '#1F2328'), chip('photo', tr('Photos', 'Zdjęcia'), '#1F2328')] }
    ];

    // ---------- Day view ----------
    const sel = st.sel;
    const its = items(sel);
    const ev = events(sel);
    const tagStyle = (s) => (s === 'skipped' ? ['#FFF0F1', '#B4182F', '#F6C7CC'] : ['#FFF6E0', '#8A5200', '#F3E0A8']);
    const partsDay = PNAMES.map((nm, pi) => {
      const pitems = its.filter((i) => i.part === pi + 1);
      const any = pitems.length > 0;
      return {
        ico1: pi === 1, ico2: pi === 3, ico3: pi === 5, ico0: !MEAL[pi], dotBg: any ? '#6B756F' : '#D5DCD8', name: nm, empty: !any,
        bg: MEAL[pi] ? 'rgba(31,211,138,0.06)' : '#FFFFFF',
        items: pitems.map((x) => { const ts = tagStyle(x.state); const l = LANES.find((q) => q.key === x.lane); return { st: sq(x.color, x.state, l ? l.size : 11), name: x.name, dose: x.dose, deco: x.state === 'skipped' ? 'line-through' : 'none', hasTag: !!x.tag, tag: x.tag, tagBg: ts[0], tagFg: ts[1], tagBd: ts[2] }; }),
        add: () => this.setState({ sheet: 'add', addDate: sel, addPart: pi + 1 }),
        addAria: tr('Add to ', 'Dodaj do: ') + nm
      };
    });
    const evcards = [];
    if (ev.front) evcards.push({ letter: 'F', title: 'Frontline', text: tr('Monthly flea and tick treatment given. Time of day not tracked.', 'Miesięczna ochrona przeciw pchłom i kleszczom podana. Pora dnia nieistotna.') });
    if (ev.worm) evcards.push({ letter: 'D', title: tr('Deworming pill', 'Tabletka odrobaczająca'), text: tr('Given every 6 months. Next one due in March.', 'Podawana co 6 miesięcy. Następna w marcu.') });
    const day = {
      title: fmt(sel, { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' }),
      sub: sel === TODAY ? tr('Today', 'Dzisiaj') : sel === shift(TODAY, -1) ? tr('Yesterday', 'Wczoraj') : (sel < START ? tr('Before records start', 'Przed początkiem zapisów') : ''),
      nextOp: sel >= TODAY ? 0.35 : 1,
      noData: its.length === 0,
      hasEvents: !!(ev.vet || ev.syms.length || ev.photo || ev.front || ev.worm),
      visits: ev.vet ? [
        { clinic: 'Maple Vet', chips: [], text: tr('Symptom consultation, stomach ultrasound, limb check (X-ray of front paws recommended). Gastrelle prescribed.', 'Konsultacja objawów, USG brzucha, kontrola kończyn (zalecane RTG przednich łap). Przepisano Gastrelle.') },
        { clinic: 'Riverside Vet', chips: [{ label: tr('Anal glands expressed', 'Opróżnienie gruczołów') }, { label: tr('Nail trimming', 'Przycięcie pazurów') }], text: tr('Blood pressure check: high, 150–160. Further consultation.', 'Pomiar ciśnienia: wysokie, 150–160. Dalsza konsultacja.') }
      ] : [],
      hasSyms: ev.syms.length > 0, syms: ev.syms,
      hasNote: sel === '2026-10-14',
      note: tr('Restless night and day. Refused breakfast. Weak and confused on walks, lay down a few times.', 'Niespokojna w nocy i w dzień. Odmówiła śniadania. Osłabiona i zdezorientowana na spacerach, kilka razy się położyła.'),
      evcards: evcards,
      hasIssue: ev.photo,
      parts: partsDay
    };

    // ---------- Add flow ----------
    const FORMS = {
      meal: [tr('Add meal', 'Dodaj posiłek'), [[tr('Food', 'Jedzenie'), tr('e.g. Ocean Blend, salmon', 'np. Ocean Blend, łosoś')], [tr('Portion', 'Porcja'), tr('e.g. ½ can', 'np. ½ puszki')], [tr('Eaten?', 'Zjedzone?'), tr('Eaten / refused / partly', 'Zjedzone / nie chciała / częściowo')]]],
      treat: [tr('Add treat', 'Dodaj smaczek'), [[tr('Taste', 'Smak'), tr('e.g. chicken', 'np. kurczak')], [tr('Number', 'Liczba'), tr('e.g. 2', 'np. 2')]]],
      dose: [tr('Add dose', 'Dodaj dawkę'), [[tr('Medication', 'Lek'), tr('e.g. Bellavet', 'np. Bellavet')], [tr('Dose', 'Dawka'), tr('e.g. 0,15 ml (1,5 bars)', 'np. 0,15 ml (1,5 bars)')], [tr('Given?', 'Podane?'), tr('Given / skipped', 'Podane / pominięte')]]],
      symptom: [tr('Add symptom', 'Dodaj objaw'), [[tr('Symptom', 'Objaw'), tr('e.g. Heartburn, Poo, Vomit', 'np. Zgaga, Kupa, Wymioty')], [tr('Intensity', 'Nasilenie'), tr('a little / medium / a lot', 'mało / średnio / dużo')], [tr('Details', 'Szczegóły'), tr('e.g. firmness, colour, quantity', 'np. konsystencja, kolor, ilość')]]],
      visit: [tr('Add vet visit', 'Dodaj wizytę u weta'), [[tr('Clinic', 'Klinika'), tr('e.g. Maple Vet', 'np. Maple Vet')], [tr('Reason and findings', 'Powód i wyniki'), ''], [tr('Also done', 'Dodatkowo'), tr('e.g. anal glands, nail trimming', 'np. gruczoły odbytu, pazury')], [tr('Recommendations', 'Zalecenia'), '']]],
      note: [tr('Add note', 'Dodaj notatkę'), [[tr('Note', 'Notatka'), tr('What did you notice?', 'Co zauważono?')]]],
      photo: [tr('Add photo or PDF', 'Dodaj zdjęcie lub PDF'), [[tr('Description', 'Opis'), tr('What does it show?', 'Co widać?')], [tr('Tracked issue (optional)', 'Śledzona sprawa (opcjonalnie)'), tr('e.g. Lump A', 'np. Lump A')]]],
      pinned: [tr('Add pinned note', 'Dodaj przypiętą notatkę'), [[tr('Note', 'Notatka'), tr('e.g. allergic to …', 'np. alergia na …')]]]
    };
    const partName = st.addPart ? PNAMES[st.addPart - 1] : '';
    const fk = st.form;
    const form = fk ? {
      dateLine: fk === 'pinned' ? tr('Not tied to a date.', 'Niezwiązane z datą.') : tr('For ', 'Dla: ') + fmt(st.addDate, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) + (partName && (fk === 'meal' || fk === 'dose' || fk === 'treat') ? ' · ' + partName : ''),
      fields: FORMS[fk][1].map((f) => ({ label: f[0], ph: f[1], val: '' }))
    } : { dateLine: '', fields: [] };
    const openForm = (k, dte, part) => () => this.setState({ sheet: 'form', form: k, addDate: dte, addPart: part || 0 });
    const addOptions = ['meal', 'treat', 'dose', 'symptom', 'visit', 'note', 'photo'].concat(st.addPart ? [] : ['pinned']).map((k) => ({ label: FORMS[k][0], pick: openForm(k, st.addDate, st.addPart) }));
    const addBar = [['meal', tr('Meal', 'Posiłek')], ['treat', tr('Treat', 'Smaczek')], ['dose', tr('Dose', 'Dawka')], ['symptom', tr('Symptom', 'Objaw')], ['visit', tr('Visit', 'Wizyta')], ['note', tr('Note', 'Notatka')]].map((a) => ({ label: a[1], pick: openForm(a[0], sel, 0) }));
    const sheetTitles = { jump: tr('Jump to date', 'Wybierz datę'), add: st.addPart ? tr('Add to ', 'Dodaj do: ') + partName : tr('Add entry', 'Dodaj wpis'), form: fk ? FORMS[fk][0] : '', filter: tr('Filters', 'Filtry') };

    // ---------- Navigation ----------
    const scr = st.screen;
    const VT = { timeline: tr('Timeline', 'Oś czasu'), calendar: tr('Calendar', 'Kalendarz'), matrix: tr('Matrix', 'Macierz') };
    const viewTitle = { timeline: tr('Timeline', 'Oś czasu'), calendar: tr('Calendar', 'Kalendarz'), matrix: tr('Week matrix', 'Macierz tygodni') }[view];
    const tabX = (['timeline', 'calendar', 'matrix'].indexOf(view) * 100) + '%';
    const viewTabs = ['timeline', 'calendar', 'matrix'].map((k) => ({ label: VT[k], sel: view === k, fg: view === k ? '#0E1512' : '#6B756F', w: view === k ? 650 : 500, pick: () => this.setState({ view: k, screen: 'timeline', sheet: null }) }));
    const mk = (label, active, pick, ic) => Object.assign({ label: label, pick: pick, isAdd: false, notAdd: true, fg: active ? '#0A7A52' : '#6B756F', w: active ? 700 : 500, sw: active ? 2 : 1.7, iTL: false, iCal: false, iMx: false, iPin: false, iTrk: false, iSea: false }, ic);
    const navItems = [
      mk(VT[view], scr === 'timeline', () => this.setState({ screen: 'timeline', sheet: null }), view === 'timeline' ? { iTL: true } : view === 'calendar' ? { iCal: true } : { iMx: true }),
      mk(tr('Pinned', 'Przypięte'), scr === 'pinned', () => this.setState({ screen: 'pinned' }), { iPin: true }),
      { label: '+ ' + tr('Add', 'Dodaj'), pick: () => this.setState({ sheet: 'add', addDate: TODAY, addPart: 0 }), isAdd: true, notAdd: false },
      mk(tr('Tracked', 'Śledzone'), scr === 'tracked' || scr === 'issue', () => this.setState({ screen: 'tracked' }), { iTrk: true }),
      mk(tr('Search', 'Szukaj'), scr === 'search', () => this.setState({ screen: 'search' }), { iSea: true })
    ];
    const navIdx = scr === 'timeline' ? 0 : scr === 'pinned' ? 1 : (scr === 'tracked' || scr === 'issue') ? 3 : scr === 'search' ? 4 : -1;
    const goDay = (s) => () => this.setState({ sel: s, screen: 'day', back: 'timeline', sheet: null });
    const jumpQuick = [
      { label: tr('Today', 'Dzisiaj'), pick: goDay(TODAY) }, { label: tr('Yesterday', 'Wczoraj'), pick: goDay(shift(TODAY, -1)) },
      { label: tr('Last vet visit · 14 Oct', 'Ostatnia wizyta · 14 paź'), pick: goDay('2026-10-14') }, { label: tr('Food change · 12 Oct', 'Zmiana karmy · 12 paź'), pick: goDay('2026-10-12') }
    ];
    const searchChips = [{ label: tr('Vet visits', 'Wizyty u weta') }, { label: tr('Symptoms', 'Objawy') }, { label: tr('Medications', 'Leki') }, { label: tr('Photos', 'Zdjęcia') }, { label: tr('Notes', 'Notatki') }];
    const showNav = scr === 'timeline' || scr === 'pinned' || scr === 'tracked' || scr === 'search' || scr === 'issue';

    return {
      t: t, viewTitle: viewTitle, viewTabs: viewTabs, tabX: tabX, navX: (Math.max(navIdx, 0) * 100) + '%', navOp: navIdx < 0 ? 0 : 1, filtersActive: filtersActive,
      isTL: view === 'timeline', isCal: view === 'calendar', isMx: view === 'matrix',
      overlayOpen: scr !== 'timeline', overlayBottom: showNav ? 68 : 0,
      isDay: scr === 'day', isPinned: scr === 'pinned', isTracked: scr === 'tracked', isSearch: scr === 'search', isIssue: scr === 'issue',
      showNav: showNav,
      keyOpen: st.keyOpen, keyChev: st.keyOpen ? '▴' : '▾', keyCols: keyCols, keyMarks: keyMarks, keyBadges: keyBadges, keyDate: keyDate,
      partsOpen: st.partsOpen, partsClosed: !st.partsOpen, partsChev: st.partsOpen ? '▾' : '▴', partCols: partCols,
      rows: rows, ticks: tickOut,
      scrubbing: !!st.scrub, scrubTop: st.scrub ? Math.max(0, st.scrub.y - 18) : 0, scrubLabel: scrubLabel,
      calHead: calHead, calMonths: calMonths, mxHeads: mxHeads, mxRows: mxRows,
      day: day, addBar: addBar,
      backLabel: st.back === 'issue' ? 'Lump A' : viewTitle,
      pinnedNotes: [
        { kind: tr('Allergy (example)', 'Alergia (przykład)'), text: tr('[Medication name]: allergic reaction. Replace with the real one.', '[Nazwa leku]: reakcja alergiczna. Zastąp prawdziwą informacją.') },
        { kind: tr('Needs to happen', 'Do zrobienia'), text: tr('X-ray of front paws (recommended at Maple Vet, 14 Oct).', 'RTG przednich łap (zalecenie, Maple Vet, 14 paź).') }
      ],
      issueEntries: ['2026-10-10', '2026-10-03'].map((s) => ({ date: fmt(s, { day: 'numeric', month: 'short', year: 'numeric' }), open: () => this.setState({ sel: s, screen: 'day', back: 'issue', sheet: null }) })),
      navItems: navItems, jumpQuick: jumpQuick, addOptions: addOptions, form: form, searchChips: searchChips, filterGroups: filterGroups,
      sheetOpen: !!st.sheet,
      sheetJump: st.sheet === 'jump', sheetAdd: st.sheet === 'add', sheetForm: st.sheet === 'form', sheetFilter: st.sheet === 'filter',
      sheetTitle: sheetTitles[st.sheet] || '',
      addDateLabel: tr('For ', 'Dla: ') + fmt(st.addDate, { weekday: 'short', day: 'numeric', month: 'short' }) + (partName ? ' · ' + partName : ''),
      toggleLang: () => this.setState({ lang: lang === 'en' ? 'pl' : 'en' }),
      toggleKey: () => this.setState({ keyOpen: !st.keyOpen }),
      togglePartsBar: () => this.setState({ partsOpen: !st.partsOpen }),
      onListScroll: onListScroll,
      railDown: (e) => { try { e.currentTarget.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ } this._drag = true; railTo(e); },
      railMove: (e) => { if (this._drag) railTo(e); },
      railUp: () => { this._drag = false; this.setState({ scrub: null }); },
      openJump: () => this.setState({ sheet: 'jump' }),
      openFilter: () => this.setState({ sheet: 'filter' }),
      filterReset: () => this.setState({ off: { treat: true, calmora: true } }),
      filterAll: () => this.setState({ off: {} }),
      closeSheets: () => this.setState({ sheet: null, form: null }),
      openIssueFromDay: () => this.setState({ screen: 'issue', issueBack: 'day' }),
      openIssueFromTracked: () => this.setState({ screen: 'issue', issueBack: 'tracked' }),
      goBack: () => this.setState(scr === 'issue' ? { screen: st.issueBack === 'day' ? 'day' : 'tracked' } : { screen: st.back === 'issue' ? 'issue' : 'timeline' }),
      prevDay: () => { const p = shift(sel, -1); if (p >= '2025-01-01') this.setState({ sel: p }); },
      nextDay: () => { if (sel < TODAY) this.setState({ sel: shift(sel, 1) }); },
      addPhoto: openForm('photo', scr === 'day' ? sel : TODAY, 0),
      addPinned: openForm('pinned', TODAY, 0),
      onJumpDate: (e) => { const v = e && e.target ? e.target.value : ''; if (v && v <= TODAY) goDay(v)(); }
    };
  }
}
