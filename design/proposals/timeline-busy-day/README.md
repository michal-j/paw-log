# Timeline: busy days and the sideways scroll (JCB-86)

Proposal for the CEO; nothing is built and `docs/design-system/tokens.json` and the components are untouched. Open `index.html` in a browser (works from disk; fonts load from Google Fonts). Controls at the top: EN/PL, badges (today's or Option A of the event-badges proposal, as reference), phone width 390/360, and columns (sample data, or two extra fictional lanes that stand in for a real log with more items). Every frame is clickable: a row opens its Day view, Back returns, Key opens the legend; hovering or focusing a row shows the screen-reader text for it.

Builds on the unpicked event-badges proposal (branch `michaljaciubek/design-event-badges`, section 4: priority order and "+N"). Its colour options A/B/C stay a separate CEO pick; everything here works with any of them.

Data: fictional sample from `docs/PRODUCT.md` / `data/demo/` (today 15 Oct 2026). 14 Oct (vet x2, symptoms) is sample data. **11 Oct (3 kinds) and 7 Oct (5 kinds) are illustrative busy days**, marked with a grey dot by the date. With Option A the three fictional notes of the badges proposal are added (14, 13, 10 Oct).

## 1. Why the Timeline scrolls sideways (root cause)

Read-only look at `src/timeline/` (Timeline.tsx, model.ts, geometry.ts, timeline.css).

- **The element that is too wide is each day row, `li.tl-row`, inside the scrolling list `.tl-list`.** A row is `ROW_INSET 4 + DATE_COL_W 44 + sum of day-part columns + Events column`; the 20 px rail sits beside the list.
- **Column widths do not know the screen width.** `buildColumns()` (model.ts) gives every day part `max(minimum, lanes + COLUMN_PAD 8)`, with minimums 44 (meals), 36 (after supper), 24 (others), and one lane (15 or 20 px) for every item ever logged in that part. Nothing caps the sum.
- **The Events column is the only flexible part and has a floor.** `.tl-row__events` is `flex: 1` with an inline `min-width: 48px` (`EVENTS_MIN_W`). Once the columns take more than `list width - 96`, it stops shrinking and the row's content runs past the `li`.
- **Why it scrolls sideways and does not clip:** `.tl-list` has `overflow-y: auto`, and CSS then treats `overflow-x` as `auto` too. So the list scrolls sideways. The Key bar (`.tl-key__toggle`) and the day-parts bar (`.tl-parts`) have the same widths but are not in the list; `.app { overflow: hidden }` clips them. When you drag the list sideways, the rows move and the bars do not, so they no longer line up.
- **Numbers.** Sample columns add up to 218 px, so the Events column is 104 px at 390 and 74 px at 360. Overflow starts when the columns go past `viewport - 136`: 254 px at a 390 iPhone, 224 px at 360. One visible after-supper item (a 36 px column) plus one more lane is enough. The prototype's "Today, 360 px" frame scrolls by 24 px. I cannot check the production numbers (real data is only in Supabase). The developer can confirm on the device with `el.scrollWidth - el.clientWidth` on `.tl-list`.
- **The same squeeze causes the "three icons in one column".** At 48 px (44 usable) the Events column fits one badge per line. Three kinds then need three lines (3 x 18 + 2 x 3 = 60 px) inside a 44 px row. The row does not clip, so the badges spill over the hairlines into the rows above and below (prototype, "Today, 390 px", 7 Oct).

## 2. Recommended fix (for the developer, one pass with the busy-day rule)

1. **Measure the list width.** The `ResizeObserver` in Timeline.tsx already measures the list height; measure `clientWidth` too.
2. **Fit the columns, in a pure function** `fitColumns(columns, available)` in model.ts, unit-tested, `available = listWidth - ROW_INSET - DATE_COL_W - EVENTS_MIN_W`. Only when the columns do not fit, take width back in two steps: (a) a column's minimum gives way to `lanes + COLUMN_PAD`; (b) `COLUMN_PAD` shrinks from 8 to 2. Lanes and circles never shrink. Key bar, rows and parts bar already share `columns`, so they stay aligned. The prototype runs exactly this (`fitColumns` in `index.html`).
3. **`EVENTS_MIN_W` 48 -> 60**, so the Events column always holds one badge plus a "+N" chip.
4. **Safety net:** `.tl-list { overflow-x: hidden; }`. If a log ever has so many lanes that step 2 is not enough, the badges get clipped at the edge but the list never scrolls sideways. Tell the PM if that happens; it would need a lane decision, not a CSS one.
5. **Busy day:** a pure `fitBadges(badges, innerWidth)` that returns the visible badges and the hidden count. Badge widths are predictable (padding 8 + border 2 + glyph 10 to 12 + 2 gap + text), so use a width table instead of measuring the DOM: no layout shift, testable. `EventBadge` gets the `more` kind from the badges proposal.

**Fixed timeline geometry:** row height 44, month bands 28/44, rail 20, date column 44 and all scroll maths are unchanged; everything here is horizontal. Two horizontal numbers change, so flagging them: `EVENTS_MIN_W` 48 -> 60, and on narrow screens with many lanes a column can lose its minimum and padding (down to lanes + 2 px). In that case the meal columns' mint wash gets narrower. The 24 px meal icon in the parts bar still fits, because a meal column is never narrower than 37 px.

## 3. Options for a busy day

All three: priority order vet, symptoms, note, photo, Frontline, deworming (badges proposal); 18 px badges; 44 px row; the whole row is the tap target and opens the Day view, which lists every event; the "+N" chip is part of the row, not a separate button.

| | How it looks | Good | Weak |
|---|---|---|---|
| **1. Two lines, then "+N"** (badges proposal section 4) | wraps to at most 2 lines (39 of 44 px); the last slot becomes "+N" | shows the most at a glance on a phone | 2.5 px from the hairlines; busy rows read as a block and break the one-line rhythm of the circles; rows change height visually |
| **2. Overlapping stack** | one line, badges overlap by 7 px with a white ring, first kind on top, at most 4, then "+N" | compact; the number of kinds is visible | counts and letters of the lower badges are partly covered ("!3" under the vet badge); a new visual pattern; 18 px badges are too small to overlap and stay legible |
| **3. One line, then "+N"** (recommended) | one centred line; as many whole badges as fit in priority order; the rest fold into "+N" | every row keeps the same rhythm; vet and symptoms stay visible; nothing overlaps or is cut; simplest rule to build and test | fewer kinds visible on a phone (390 sample: the 5-kind day shows vet, symptoms, "+3") |

Tablet (768) and desktop (1280): the app column is capped at 560 px (`global.css .app`), so the Events column is about 270 px wide and every option shows all kinds on one line. The rule never triggers there.

Tightest case (360 px, two extra lanes, Events 60 px): Option 3 shows the lead badge and "+N". With today's badges, 14 Oct still shows vet and symptoms. With Option A's note it shows vet and "+2". If the CEO wants vet and symptoms always side by side, raise `EVENTS_MIN_W` to 72; the column fit still works at 360 with two extra lanes.

**Screen reader:** unchanged pattern. The row link's hidden summary (`flagsFor` in Timeline.tsx) already names every event whatever is visible, for example "Wednesday 7 October: Vet visit, Reflux, Fear, Panting, Photo, Frontline (monthly), Deworming" / "środa, 7 października: Wizyta u weta, Refluks, Strach, Dyszenie, Zdjęcie, Frontline (co miesiąc), Odrobaczanie". When the note badge lands (JCB-69), add "Note" / "Notatka" after the symptoms. The badges and "+N" stay `aria-hidden`.

## 4. Recommendation: Option 3

- It fixes the actual complaint: a busy day looks like any other row, on the same centre line as the circles, instead of a column of icons spread over the row.
- What matters most is always visible (vet, symptoms). "+N" says "more inside", and one tap on the row shows it all in the Day view. That tap was already the way to read details.
- It is the cheapest and steadiest to build: one line means the rule is "fits or not" on one sum. It needs no new visual pattern, works at every width and does not depend on the colour pick.

**Watch-out (today's badges):** today's vet badge is a mint plus with a number ("✚1"), so a neutral "+3" next to it reads alike. The new vet glyphs in options A, B and C (stethoscope, ECG) remove that. That is why the busy-day rule is best shipped together with the badge pick, while the overflow fix (steps 1 to 4) can ship now.

## 5. Tokens, components, copy

- **No new tokens.** "+N" uses `surface-tint`, `ink-2` and `line-strong`, as in the badges proposal. Option 2 would add a white ring from `surface` (outline). Option A's values are shown only as reference, copied from the badges proposal.
- **Component:** no new component. The `more` kind of `EventBadge` and a `fitBadges` helper are already in the badges proposal (section 6); this proposal uses them in the Timeline only. Calendar and Matrix mini badges are out of scope.
- **Copy (drafts, no reviewed pair yet):** Key legend row for "+N": "More that day (see the day)" / "Więcej tego dnia (zobacz dzień)". "Note" / "Notatka" comes from the badges proposal.

## Decisions for the CEO

1. Busy-day pattern: **Option 3, one line then "+N"** (recommended), or Option 1 (two lines) or Option 2 (stack)?
2. Timing: ship the overflow fix now and the "+N" rule together with the badge colour pick (recommended, avoids "✚1 +3" with today's plus glyph), or both now with today's badges?
