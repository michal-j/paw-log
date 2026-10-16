# Test cases

Automated: `npm test` (Vitest, `tests/`). Manual cases below are for the checks automation does not cover. Viewport for manual checks: 390x844 first, then tablet and desktop.

| # | Case | Steps | Expected | Automated |
|---|---|---|---|---|
| 1 | Copy CSV parses | Run `npm test` | EN and PL catalogues have identical keys, no empty strings | `tests/lib.test.ts` |
| 2 | Tokens to CSS | Run `npm test` | A CSS variable exists for every colour, spacing, radius, shadow token | `tests/lib.test.ts` |
| 3 | Demo repository | Run `npm test` | Fictional data served; edits persist across instances; reset restores; corrupt storage tolerated | `tests/data.test.ts` |
| 4 | Demo mode switch | Run `npm test` | `/demo` or `VITE_DEMO_MODE=true` selects the demo repository | `tests/data.test.ts` |
| 5 | Placeholder home | Open `/demo` | Banner, dog "Pip", latest entries listed, no sign-in | `tests/app.test.tsx` |
| 6 | Language switch | On `/demo` tap PL, reload | Strings turn Polish; still Polish after reload; EN returns them | `tests/app.test.tsx` (switch), manual (reload) |
| 7 | Polish fit | `/demo` in PL at 390 wide | Banner wraps to two lines, nothing clipped or overflowing | manual |
| 8 | Install on iPhone | Build, serve over HTTPS, Safari > Share > Add to Home Screen | Installs with the PawLog name and mint icon, opens standalone | manual (needs deployment) |
| 9 | Offline shell | After one visit, go offline, reload `/demo` | App shell loads from the service worker | manual |
| 10 | Demo reset | Edit data via devtools or later screens, tap "Reset demo data" | Sample data restored | `tests/data.test.ts` (logic), manual (button) |
