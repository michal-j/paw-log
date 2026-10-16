# Design

## Direction (decided, R10 "Mint Clean")
Light and bright only; no dark theme. Mint-green primary, pastel colours for food and medication, white surfaces with hairlines, very subtle gradients and soft shadows for depth (not 3D, not glassy). Small, squarish controls (radius 8), underline tab switcher, circles for items.

The single source of truth is the Design System artifact (tokens, components, README) and its exported copy in `docs/design-system/`. Read `docs/design-system/README.md` before any UI work.

## How we got here (short)
- R1 to R4: explored layouts. The vertical lanes timeline won; calendar was first rejected, later added back as a second view; the week matrix became the third view.
- R5 to R6: combined timeline, view switcher (Timeline, Calendar, Matrix), filters, extended data model, circles instead of squares.
- R7 colour swaps were rejected as "just colour changes". R8 explored Aurora (glass), Clay (tactile), Precision (crisp); Aurora and Clay were too much, Precision was good but too 3D. R9 produced three mint variants; Mint Clean won. R10 unified event badges, centred the Events column and added subtle depth.

## Fixed geometry in the timeline
Do not change without re-deriving scroll positions: day rows 44px; month bands 28/44px; calendar cells 66px high; matrix rows 30px, day columns 34px; tick rail 20px wide. Touch targets 44px minimum (small controls extend their hit area).

## Event badges
Vet "+N", symptoms "!N", photo (camera), Frontline "F", deworming "D". One component, five pastel kinds, two sizes (18px, mini 13px). Known issue: the badges still differ slightly between places (JCB-26). The prototype generates them from one shared style set in `design/prototype/script.js` (`BTONE`, `bdg`); the build should do the same with one component.

## Known gaps and deviations
- Prototype focus ring uses `mint`; the system says `mint-deep` (contrast).
- `ink-3` text is for white surfaces only.
- Fonts: Onest (body) and Instrument Sans (display) from Google Fonts; they could not be checked in the sandbox renderer, verify on device.
- No logo yet; the header uses a mint rounded square with a paw glyph.
- Not yet designed: Pinned notes, Tracked issues, Search, add and edit flows, bulk add, empty states, loading and error states, onboarding.

## Prototype
`design/prototype/` holds the R10 source: `head.html` (markup), `script.js` (logic and sample data), `build.py` (assembles `R10-Mint-Clean.dc.html`). It uses Claude Design's x-dc format; it is a reference for behaviour and layout, not production code. Copy lives in `docs/copy/pawlog-copy-en-pl.csv` (181 reviewed EN/PL pairs).
