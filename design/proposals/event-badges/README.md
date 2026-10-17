# Event badges: one badge everywhere, new colours, note badge, "+N" (JCB-26, JCB-69)

Proposal for the CEO. Nothing is built and `docs/design-system/tokens.json` is untouched. Open `index.html` in a browser (it opens from disk; fonts load from Google Fonts). Every frame is 390 x 844 and clickable (Key, day rows, Day view arrows). EN/PL switch and a 390 / 360 px phone-width switch sit in the top bar. Data is the fictional sample in `docs/PRODUCT.md`; it has no notes, so three **fictional notes** were added (14, 13, 10 Oct) and the dashed rows in the third frame are **illustrative busy days**.

## 1. Same badge everywhere (JCB-26)
The CSS and component are already one. What differs is the **text**: the Timeline shows "+2" / "!2", the Key sample shows "2" / "!", the Day view and the + Add sheet show the glyph alone, and notes are not a badge at all (grey document glyph in the Day view). Rule for all options: the **glyph is always identical**; a number is added only where the badge stands for several events (Timeline row, Key sample, Symptoms card heading). A single vet card keeps the glyph alone. The Key shows "+2" and "!2" with the labels "Vet visit (number)" and "Symptoms (number)".

## 2. Options (vet / symptoms / note)
| | Vet | Symptoms | Note |
|---|---|---|---|
| **A, recommended** | rose, stethoscope | orange "!" | slate, page glyph |
| B | cyan, heart-line (ECG) | slate "!" (most neutral) | white, outlined page |
| C | dark ink chip, white stethoscope | gold "!" | slate, page glyph |

**Recommendation: A.** Rose is the furthest hue from mint and from the other kinds; the stethoscope cannot read as "add" (the plus also sat beside the mint "+ Add" button in the Add sheet). Orange says "look here" without "danger"; red stays only for refused / skipped. Slate is the quietest chip, right for a note. Watch-outs: (a) orange is close to Deworming amber, check on a device; (b) the stethoscope is mush at the 9 px glyph of the 13 px mini badge (Calendar, Matrix): use a plain filled dot or the rose chip without glyph there; (c) B's slate "!" is the weakest signal on a busy row; (d) C's gold is almost Deworming's amber, and its solid dark chip breaks the pastel family.

## 3. Note badge
Shown on a Timeline row when the day has **any** note: a note event or a note on a food / medication entry. One badge per day, never a count, priority after symptoms. In the Day view the same badge heads the Note card and marks each entry note (today a plain grey glyph, and entry notes have no marker). The Key lists it as "Note on the day" / "Notatka z dnia". Data side (for the developer): derive from `events.type = 'note'` or a non-empty `entry.note`; `BadgeKind` gains `'note'` in `src/timeline/model.ts`.

## 4. Busy days and a third line
Rows stay 44 px; two lines of 18 px badges plus the 3 px gap are 39 px. Measured: at a 390 px phone the Events column is 104 px (usable 100) and the six real kinds (vet, symptoms, note, photo, F, D) always fit in two lines. At **360 px** the column is 74 px and the full six already overflow. Rule: priority order (vet, symptoms, note, photo, F, D); if the badges do not fit in two lines, drop from the end and show a neutral **"+N"** chip (N = number hidden). The row still opens the Day view, which lists everything; the sr-only row summary must name every kind. Implementation note: this needs a measure or a fixed per-line capacity; a fixed rule "max 3 badges per line at width below 100 px" is cheaper than measuring and avoids layout shifts. No change to row height, month bands or scroll maths.

## 5. Proposed tokens (propose only; hex per option are in `index.html`)
- **New**: `badge-note-top / -bottom / -ink / -line`.
- **Changed values** (Option A): `badge-vet-*` rose `#ffeaf2 / #ffd6e6 / ink #a01d55 / line #f2afcb`; `badge-sym-*` orange `#fff0e2 / #ffddbd / ink #9a3d00 / line #f2b889`; `badge-note-*` slate `#f1f4f3 / #e0e6e3 / ink #364039 / line #c3ccc8`. All ink/background pairs are at least 5:1 (WCAG AA 4.5:1).
- **Needed side effect**: the Day view's "refused" tag reuses `badge-sym-*` (`day.css`); if symptoms stop being red, refused needs its own red tokens, for example `tag-skipped-*` taking today's `badge-sym-*` values.
- **No new tokens for "+N"**: `surface-tint`, `ink-2`, `line-strong`.
- Option C only: a `shadow-badge-solid` without the white inset highlight.
- New glyphs (stethoscope, ECG, note page) are inline SVG on the 24 px grid, 2.6 px round stroke, `currentColor`, like the camera.

## 6. Components touched if approved
`EventBadge` (kinds `vet` glyph, `sym` colour, new `note`, new `more`), Key legend list, Day view cards (note badge, glyph-only vet), + Add sheet vet option, Calendar and Matrix mini badges (glyph at 9 px), copy (EN/PL drafts, `kSymN`, `kNote`, `kMore`; no reviewed pair exists yet for them).

## Decisions for the CEO
1. Pick A, B or C (or mix: for example B's cyan vet with A's orange symptoms).
2. OK that a single vet card shows the glyph without a count?
3. Note badge on any note, including entry notes: confirmed as briefed. Should it also appear in the Calendar and Matrix?
4. "+N" rule as proposed, or cap at three badges and always show "+N" on the fourth?
