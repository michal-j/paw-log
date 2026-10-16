# Test cases

Automated: `npm test` (Vitest, `tests/`) and `npm run test:db` (row-level security, `supabase/tests/database/`). Manual cases below are for the checks automation does not cover. Viewport for manual checks: 390x844 first, then tablet and desktop.

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
| 17 | Open a day | On `/demo` scroll down, tap anywhere on the 20 Sep row | URL `/demo/day/2026-09-20`; Day view with "Sun, 20 September 2026", Symptoms card (Reflux, Panting), seven day parts | `tests/app.test.tsx`, manual (tap) |
| 18 | Back keeps the scroll | From case 17 tap "Timeline"; repeat and use the browser Back instead | Timeline at the same scroll position as before the tap, both ways | `tests/app.test.tsx` (back), manual (scroll position) |
| 19 | Day content | Open `/demo/day/2026-10-14` | Two vet cards and one Symptoms card with badges; Breakfast cooked meal hollow circle, struck through, "Refused"; Dinner half-filled circle, "Half eaten"; Treat shown (hidden on the Timeline); After supper "Nothing scheduled"; sub-line "Yesterday" | `tests/day.test.ts`, `tests/app.test.tsx` |
| 20 | Calmora on the Day view | Open `/demo/day/2026-09-10` | After supper lists Calmora (hidden on the Timeline) | `tests/day.test.ts` |
| 21 | Prev/next bounds | Open `/demo/day/2026-10-15`, tap next; open `/demo/day/2026-09-01`, tap previous | Next on 15 Oct and previous on 1 Sep are dimmed, do nothing, and a screen reader announces them as unavailable; the other direction works | `tests/day.test.ts`, `tests/app.test.tsx` |
| 22 | Day URLs | Reload `/demo/day/2026-10-14`; open `/demo/day/2026-02-30`, `/demo/day/2026-10-16`, `/demo/day/banana` | Reload shows the same day; the invalid ones land on the Timeline at `/demo` | `tests/day.test.ts`, `tests/app.test.tsx`, manual (reload) |
| 23 | Empty day | Delete all entries of a day (devtools or a later edit flow), open it | Clock card "Nothing logged for this date yet…" and "Nothing scheduled" in all seven parts | `tests/app.test.tsx` |
| 24 | Day view widths and Polish | `/demo/day/2026-10-14` at 390x844, 768 and desktop, EN and PL | No horizontal page scroll; "śr., 14 października 2026" on one line between the arrows; part names and tags fit; Back and arrows have 44px hit areas | manual |
| 25 | Row-level security | Run `npm run test:db` | 48 checks pass: anon reads and writes nothing; a member sees and edits only their household; cannot join another household, create households or dogs, or move rows across dogs; one entry per slot per day; created_by/updated_by set by the database | `supabase/tests/database/rls.test.sql` |
| 26 | Repository mapping | Run `npm test` | Rows map to app types and back, date range and dog filters applied, all pages read, errors carry the database code, slot conflicts become `DuplicateSlotEntryError`, non-UUID ids refused | `tests/supabaseRepository.test.ts` |
| 27 | Sign-in flow | Open `/` with Supabase settings; enter e-mail and password; tap Sign in | Timeline shows the household's data; on iPhone, Keychain offers to save the login and fills it next time | `tests/auth.test.tsx` (flow with a fake), manual (real account, Keychain, after the runbook) |
| 28 | Sign-in errors | Bad address; empty password; wrong password; airplane mode; many wrong tries quickly | "Enter a valid e-mail address."; "Enter your password."; "Wrong e-mail or password."; "No connection..."; "Too many tries..." | `tests/auth.test.tsx`, manual (rate limit) |
| 29 | No sign-up, show/hide | Look for a sign-up or reset link; tap Show, then Hide | Neither exists (only the "ask the person who set up PawLog" hint); the password becomes readable and hidden again | `tests/auth.test.tsx` (toggle), manual |
| 30 | Session persists | Sign in on the installed iPhone PWA, close it from the app switcher, reopen | Timeline opens without signing in again | manual |
| 31 | Sign out | Tap Sign out, confirm; on another try, Cancel | Back to sign-in on this device; the other phone stays signed in; Cancel keeps the session | `tests/auth.test.tsx` (confirm), manual (other device) |
| 32 | Not connected | Build without `VITE_SUPABASE_URL`, open `/` | "PawLog is not connected" with an Open the demo button; no crash | `tests/auth.test.tsx` |
| 33 | Demo unchanged | Open `/demo`, watch the network panel | Timeline as before; no request leaves the site; no Sign out button | manual |
| 34 | Account without household | Sign in with an account that has no `member` row | "This account is not linked to a dog yet..." and Sign out | `tests/auth.test.tsx` |
| 35 | Sign-in widths and Polish | Sign-in screen (with an error showing) and the signed-in top bar at 390x844, 768, desktop, EN and PL | Nothing clipped; Show/Pokaż stays inside the field; buttons at least 44px; "Wyloguj" fits beside EN/PL at 390 | manual |
