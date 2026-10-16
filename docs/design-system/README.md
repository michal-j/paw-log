PawLog is a light, bright, mint-green app for logging a dog's meals, medication and health events on a timeline. Build every screen from these tokens; never type a hex value, radius or shadow that has a token.

## Content fundamentals
- Write plainly, in short phrases: "Given", "Skipped / refused", "Partly eaten", "Vet visit (number)". No exclamation marks, no emoji, no jokes.
- Every string exists in English and Polish. Labels must fit the Polish version, which runs about 20% longer; check Polish first.
- Name things the way the household does: Breakfast, Dinner, Supper, Treats, the medication's own name (Arvelin, Bellavet, Biomend, Gastrelle, Calmora). Doses read as "½ pill", "0,15 ml (1,5 bars)", "⅓ tray".
- Sentence case everywhere. Uppercase only for the `caption` style (month bands, section labels).

## Visual foundations
- **Light only.** No dark theme. Page ground is `ground`, working surfaces are `surface`; sticky bars use `surface-tint`.
- **Primary is mint.** Fills use `mint` (primary button uses a `mint-top` to `mint` gradient with `on-mint` text). Wherever mint is text, an icon or the keyboard focus ring, use `mint-deep`: `mint` on white fails contrast.
- **Depth is subtle.** Controls and cards lift by at most the `shadow-*` tokens plus a vertical gradient of a few percent (white to `surface-tint`). No heavy 3D, no glass, no coloured glows except the primary button's `shadow-primary`.
- **Borders are hairlines.** 1px `line` for structure, `line-strong` for controls. Radii: `radius-md` for controls, `radius-lg` for cards, `radius-sheet` for sheets, `radius-sm` for badges.
- **Data colours are pastel.** Food and medication use the `food-*`, `med-*` and `treat` tokens. Meaning is carried by shape, not colour alone: big circle = food, small circle = medication or treat; filled = given, hollow = skipped or refused, half-filled from the bottom = partly eaten.
- **Spacing** uses `space-1` to `space-6`; screen gutter is `space-4`. Touch targets are at least 44px: small controls extend their hit area with an invisible `::after`.
- **Motion** is short (150 to 220ms, ease `cubic-bezier(.2,.7,.2,1)`): the tab underline slides, sheets rise, scrims fade. Respect `prefers-reduced-motion`.
- **Fixed geometry in the timeline** (do not change without re-deriving the scroll maths): day rows 44px, month bands 28/44px, calendar cells 66px high, matrix rows 30px with 34px day columns, tick rail 20px wide.

## Iconography
- Glyphs are inline SVG, 1.9 to 2.4px round strokes, drawn on a 24px grid, coloured with `currentColor` and a token. Event glyphs: vet is a plus cross, photo is a camera, symptoms is the text "!", Frontline "F", deworming "D".
- Event badges come only from the `EventBadge` component. The timeline, calendar, matrix, key legend and day view must all render the same badge; a new place copies the component, it does not restyle it.
- No logo or brand mark exists yet. The app name "PawLog" is set in `title`, beside a mint rounded square holding a paw glyph.

## Components
`Button`, `ViewTabs`, `Chip`, `Card`, `EventBadge`, `DoseMark`, `NavBar` and `Sheet` cover the current prototype. New flows (edit, bulk add, history, export) reuse them; add a component here before using a new pattern twice.

## Open items
- Event icons still differ slightly between screens (JCB-26): audit each placement against `EventBadge`.
- The prototype's focus ring uses `mint`; change it to `mint-deep`.
