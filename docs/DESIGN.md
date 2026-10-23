# Design

## Direction (decided, R10 "Mint Clean")
Light and bright only; no dark theme. Mint-green primary, pastel colours for food and medication, white surfaces with hairlines, very subtle gradients and soft shadows for depth (not 3D, not glassy). Small, squarish controls (radius 8), underline tab switcher, circles for items.

The source of truth is the Design System artifact (tokens, components, README) and its exported copy in `docs/design-system/`; they must match, and both are updated whenever a component or token changes. Read `docs/design-system/README.md` before any UI work.

## How we got here (short)
- R1 to R4: explored layouts. The vertical lanes timeline won; calendar was first rejected, later added back as a second view; the week matrix became the third view.
- R5 to R6: combined timeline, view switcher (Timeline, Calendar, Matrix), filters, extended data model, circles instead of squares.
- R7 colour swaps were rejected as "just colour changes". R8 explored Aurora (glass), Clay (tactile), Precision (crisp); Aurora and Clay were too much, Precision was good but too 3D. R9 produced three mint variants; Mint Clean won. R10 unified event badges, centred the Events column and added subtle depth.

## Fixed geometry in the timeline
Do not change without re-deriving scroll positions: day rows 44px; month bands 28/44px; calendar cells 66px high; matrix rows 30px, day columns 34px; tick rail 20px wide. Touch targets 44px minimum (small controls extend their hit area).

## Event badges
Vet (cyan, heart-line glyph, with a count on the Timeline row and in the Key), symptoms (orange "!" or "!N"), note (white outlined page, once a day for any note, never a count), photo (camera), Frontline "F", deworming "D", plus the neutral "+N" chip. One component (`EventBadge`), pastel kinds, two sizes (18px, mini 13px). The glyph is identical everywhere; a number appears only where the badge stands for several events (Timeline row, Key sample). A single vet card shows the glyph alone. Decided 19 Oct (JCB-26, JCB-69): Option B's cyan vet and white note with Option A's orange symptoms; red is only for refused or skipped (`tag-skipped-*` tokens).
Busy days: the Timeline row is one line. Badges show whole, in priority order (vet, symptoms, note, photo, F, D); those that do not fit fold into one "+N" chip (`fitBadges`, `src/timeline/model.ts`, widths from a table, not measured). The Events column is never narrower than 60px: a vet badge with a count plus "+N". The row still opens the Day view, which lists everything, and its screen-reader summary names every kind.
Watch on device: orange symptoms next to amber deworming. Not built: the note badge on each food or medication note in the Day view, Calendar and Matrix mini badges.

## Known gaps and deviations
- Prototype focus ring uses `mint`; the system says `mint-deep` (contrast).
- `ink-3` text is for white surfaces only.
- Fonts: Onest (body) and Instrument Sans (display) from Google Fonts; they could not be checked in the sandbox renderer, verify on device.
- No logo yet; the header uses a mint rounded square with a paw glyph.
- Designed and built since the prototype: Pinned notes, Tracked conditions, add and edit flows, photos, PDFs, event badges and Search (proposals in `design/proposals/`, specs in their READMEs). Still not designed: bulk add (not planned), onboarding.

## Prototype
`design/prototype/` holds the R10 source: `head.html` (markup), `script.js` (logic and sample data), `build.py` (assembles `R10-Mint-Clean.dc.html`). It uses Claude Design's x-dc format; it is a reference for behaviour and layout, not production code. Copy lives in `docs/copy/pawlog-copy-en-pl.csv` (181 reviewed EN/PL pairs).
