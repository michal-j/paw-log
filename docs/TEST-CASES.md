# Test cases

Automated: `npm test` (Vitest, `tests/`). Manual cases below are for the checks automation does not cover. Viewport for manual checks: 390x844 first, then tablet and desktop.

| # | Case | Steps | Expected | Automated |
|---|---|---|---|---|
| 1 | Copy CSV parses | Run `npm test` | EN and PL catalogues have identical keys, no empty strings | `tests/lib.test.ts` |
| 2 | Tokens to CSS | Run `npm test` | A CSS variable exists for every colour, spacing, radius, shadow token | `tests/lib.test.ts` |
| 3 | Demo repository | Run `npm test` | Fictional data served; edits persist across instances; reset restores; corrupt storage tolerated | `tests/data.test.ts` |
| 4 | Demo mode switch | Run `npm test` | `/demo` or `VITE_DEMO_MODE=true` selects the demo repository | `tests/data.test.ts` |
| 5 | Timeline home | Open `/demo` | Banner, Key bar, October 2026 band on top, 15 Oct marked Today, no sign-in | `tests/app.test.tsx` |
| 6 | Language switch | On `/demo` tap PL, reload | Strings turn Polish; still Polish after reload; EN returns them | `tests/app.test.tsx` (switch), manual (reload) |
| 7 | Polish fit | `/demo` in PL at 390 wide | Banner wraps to two lines, nothing clipped or overflowing | manual |
| 8 | Install on iPhone | Build, serve over HTTPS, Safari > Share > Add to Home Screen | Installs with the PawLog name and mint icon, opens standalone | manual (needs deployment) |
| 9 | Offline shell | After one visit, go offline, reload `/demo` | App shell loads from the service worker | manual |
| 10 | Demo reset | Edit data via devtools or later screens, tap "Reset demo data" | Sample data restored | `tests/data.test.ts` (logic), manual (button) |
| 11 | Timeline rows | Open `/demo`, scroll to the bottom | One row per day, 15 Oct (Today) down to 1 Sep; bands October 2026 and September 2026; no gaps or repeats | `tests/timeline.test.ts` |
| 12 | Circles | On `/demo` look at 14 Oct | Breakfast big circle hollow; Dinner big circle half-filled from the bottom; Gastrelle small purple circle filled; small circles are medication, big are food | `tests/timeline.test.ts` (data), manual (look) |
| 13 | Event badges | On `/demo` look at 14 Oct, 8 Oct, 12 Sep, 8 Sep | 14 Oct: "+2" vet and "!2" symptoms; 8 Oct and 8 Sep: "F"; 12 Sep: "D"; 3 and 10 Oct: camera | `tests/timeline.test.ts` (data), manual (look) |
| 14 | Key bar | Scroll the list; tap the Key bar; tap again | Key date and lane labels follow the top row; legend opens with Marks and badge names; closes again | `tests/app.test.tsx` (toggle), manual (follow) |
| 15 | Tick rail | Drag down the rail on the right, all the way to the bottom; then swipe vertically over the Events column next to it | List scrubs; a dark bubble shows the top date or month; the mint tick is the nearest tick at or above the finger; at the bottom the Key shows 1 Sep; release hides the bubble; swiping over the Events column scrolls normally | `tests/timeline.test.ts` (maths), manual (drag, swipe) |
| 16 | Widths and Polish | `/demo` at 390x844, 768 and desktop, EN and PL | No horizontal page scroll; Polish Key labels, "KLUCZ" with its chevron and band titles fit; EN/PL and Key bar at least 44px high | manual |
