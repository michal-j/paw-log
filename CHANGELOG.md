# Changelog

Format: [Keep a Changelog](https://keepachangelog.com). "Unreleased" means not yet merged to `main`.

## Unreleased

### Changed
- Deleting an entry in the Day view looks the same for every entry (JCB-60): it disappears from the day and the Timeline with the "Entry deleted" toast and Undo. A usual-day item still keeps its `removed` marker underneath, so Fill and Given do not offer it again, but it is no longer drawn as a "Removed for this day" row; one quiet line at the bottom of the day ("Removed from the usual day: 1 · Restore") puts it back as not logged, with Undo. Draft copy in `docs/copy/copy-proposal-consistent-delete.csv`.

### Fixed
- iPhone PWA: no more empty space above the navbar at the end of the Day view and the Usual day. Their scrolling body added the home-indicator safe area although the navbar under it already does; only the navbar keeps it now.
- iPhone PWA: no more empty space under the day-parts bar on the Timeline (JCB-61). The bar added the home-indicator safe area although the navbar under it already does; only the navbar keeps it now.
- Real-data blockers from the first use on the iPhone PWA and desktop (JCB-43), reproduced on the real data path (SupabaseRepository and supabase-js against a PostgREST-like fake on Postgres), not only `/demo`:
  - Editing an entry (or logging a planned row) as another item or part kept the row but dropped its usual-day slot, so the slot came back as "not logged" and looked like a new entry: the entry now keeps the slot it filled or was opened from (same date), unless its new item has its own open slot.
  - Deleting a usual-day item in the Day view put it back as "not logged" and in Fill: it now stays as "Removed for this day" (an `entry` row with state `removed`, so Fill and the other phone skip it); tap it to log it after all; Undo restores the entry.
  - Day-part times saved on every keystroke or wheel turn, overlapping writes could land out of order and the field was reset while typing: they save on commit (blur, Enter, picker closed); all writes run one after another, so the last one wins.
  - Saving on a day before the first record bounced back to the Timeline while the records reloaded: the Day view waits for the reload.
  - Back to the Timeline (from the Usual day or a day) reloaded everything and showed a blank screen until it arrived, or for good when the load failed: the Timeline renders from the records already loaded; a failed load says so with Try again and retries on its own (also when the app returns to the foreground or online); an unexpected error shows Reload instead of a blank page.
  - Reads never come from the HTTP cache (`cache: 'no-store'`).
  - Date and time inputs on iOS Safari: same 50px height and left-aligned value as the other fields.
  - After Fill, no blank space is reserved any more; the day parts keep their place on screen when they can.
  - QA round: changing only a usual-day item's "Starts on" now saves (and offers the past days); the Fill banner or quiet action is chosen when a day opens and kept while it is open (a removed item counts as worked on), so Given or a delete never makes it jump; Undo closes the past-days question; one-day wording; empty Timeline days read "nothing logged" to screen readers; the dev harness keeps its screen on reload.
- Timeline: no more screen-high empty space below the first day (JCB-62). The list ends 16px after the log-start day; the Key, the rail and the scrub label move from the top row to that first day over the last screen of scrolling, so dragging the rail to the bottom still lands on the first day. The rail moves the Key and its bubble across every day evenly, also when the log fits on one screen and the list cannot scroll.

### Added
- Log starts on (Menu): every day from that date to today is on the Timeline, empty days too, so past days can be opened and filled. Default: the earliest record or usual-day start, else a year back. Long logs render only the rows near the screen. New table `dog_settings` (JCB-43).
- A usual-day item added or changed from a past date asks once to log it as given on the past days where it is still open ("Log … as given on N past days (… – yesterday)? Days already logged for it stay as they are."); Yes fills them and reports how many were already logged; Undo takes them back.
- New food or medication gets the first unused item colour token (cycling when all are used); the colour can be changed with swatches of the item colour tokens, also on an existing usual-day item. Food: Add flavour adds a new flavour to the item.
- A new food or medication entry starts from the last one of its kind (item, amount, unit, flavour).
- + on a Usual day part asks Food or Medication first, then lists only that kind.
- Migration `20261017120000_removed_entries_log_start.sql` (entry state `removed`, table `dog_settings` with RLS); RLS tests 72 checks. Repository: `listRemovedSlots`, `removeFromDay`, `getSettings`, `saveSettings`.
- Test harness `tests/harness/` (fake Supabase backend on PGlite with every migration and RLS) used by contract tests for both repositories (`tests/contract.test.ts`) and real-path app tests (`tests/realpath.test.tsx`); dev-only `harness.html` runs the app on it in the browser. Draft copy `docs/copy/copy-proposal-blockers.csv`.
- Logging, editing and the usual day (JCB-39), after the approved design (JCB-25 round 2): **+ Add** in a new bottom navbar (Food, Medication, Symptom, Vet visit, Note, Other) and **+** on each day part (Food or Medication with that part set). Entry sheet with item picker (Other creates a new item), flavour, structured amount (fraction chips, or a decimal field for ml and g), unit chips, Given / Skipped / Partly eaten (food only), note, "For … · Change" date and part. Tap any entry to edit it, including changing the item; tap a vet, symptom, note or other card to edit it. Delete without confirmation, with Undo in a toast.
- Usual day in the Day view: not-yet-logged items as planned rows (dashed `DoseMark` state `planned`) with **Given** in one tap, **All given** per part, and the "Fill with your usual day: N" banner (today only the parts whose time has passed; never overwrites; Undo). "Add to the usual day from this day on" and "Make this the usual amount from this day on" in the entry sheet. Course days ("day 2 of 7") only for slots marked as a course (`schedule_slot.is_course`, set by "How long"). Writes are guarded against double taps; Partly eaten is the one term for partial food.
- Events: symptoms with per-type properties (Poo: consistency, colour, amount; Vomit: times, when; Leakage: amount; others: intensity) and details; vet visit with clinic chips, reason and also done (anal glands, nails); note; other (Frontline, deworming, anal glands, nails, other with a title). No attachments yet.
- Usual day screen (`/usual`, `/usual/YYYY-MM-DD`): the seven parts with their times, items with amounts, courses and the next change; add an item to a part, change it from a date (amount, flavour, course length or end date), remove it from a date on.
- Menu in the header on every screen: Usual day, editable day-part times (stored per dog), language, Sign out (real app) or Reset demo data (demo).
- Migration `20261016140000_logging_usual_day.sql`: `item.default_unit/flavours/conversion_unit/conversion_size`, `schedule_slot.flavour/amount/unit/position`, `entry.amount/unit/flavour`, `event.props/also_done`, new table `day_part` (dog, part, usual_time) with RLS; removing a slot clears `entry.schedule_slot_id` instead of failing. RLS tests now 64 checks; bootstrap template seeds units, flavours and a usual day with amounts.
- Repository: `nowTime`, `saveItem`, `saveScheduleSlot`, `deleteScheduleSlot`, `getDayPartTimes`, `saveDayPartTime`, `addPlannedEntries` (insert, skipping slots already filled that day), `deleteEntries`; both implementations, with tests.
- Draft copy: `docs/copy/copy-proposal-add-edit.csv` (the design's 103 strings) and `docs/copy/copy-proposal-log-gaps.csv` ("All given", "Menu", unit plural and Polish forms), both pending CEO review. Tests: `tests/amount.test.ts`, `tests/plan.test.ts`, `tests/log.test.tsx`.
- Read-only Day view in demo mode (JCB-30): tap a Timeline row (whole 44px row is a link) to open `/demo/day/YYYY-MM-DD`; date header with Today/Yesterday, previous/next day stopping at the first record and today (disabled state shown and announced), "What happened" cards (vet visits, symptoms, Frontline, deworming, photo) with `EventBadge`, the seven day parts with `DoseMark`, name, dose and Refused / Half eaten tags, empty-day state. Shows everything, including treats and Calmora.
- `src/day/model.ts` (day grouping, bounds, prev/next) and `src/routes.ts` (path router), with unit tests; Day view app tests.
- `npm run check:secrets` also fails on locally blocked words from a git-ignored `.secret-words` file and/or `PAWLOG_BLOCKED_WORDS` (JCB-36).
- Real backend (JCB-35), ready to apply once the CEO creates the Supabase project: versioned migrations for household, member, dog, item, schedule_slot, entry and event, with row-level security on every table (members read and write only their household; no anonymous access; households, members and dogs read-only from the app).
- Schema for the logging design: `schedule_slot` (an item in several day parts, each with its own dose), `entry.schedule_slot_id` with one entry per slot per day, `updated_by` on entry and event, event type `note`, event `intensity` (small, medium, large). `Repository.listScheduleSlots`, `DuplicateSlotEntryError`.
- `npm run test:db`: applies the migrations to PGlite and runs 48 pgTAP-style RLS checks. Not yet in CI: adding the step to `.github/workflows/ci.yml` needs a push with the GitHub `workflow` scope.
- `SupabaseRepository` implementing the whole `Repository` interface (paged reads, upserts, database-set `created_by`/`updated_by`), with unit tests against a mocked client.
- Sign-in with e-mail and password on one screen (Show/Hide toggle, Keychain-friendly `username`/`current-password` autocomplete; no sign-up, no in-app password reset: the CEO manages both accounts in the Supabase dashboard), session kept across app restarts, sign-out (this device only, with a confirmation), a "not connected" screen when the build has no Supabase settings, and a message for an account not yet linked to a dog.
- Runbook `docs/runbooks/supabase-setup.md`, bootstrap template `supabase/bootstrap.example.sql`.
- Draft EN/PL copy for sign-in in `docs/copy/copy-proposal-auth.csv` (pending CEO review), merged into the generated catalogues.

### Changed
- Home-screen icon: the CEO-approved option A (mint gradient, white paw) replaces the flat mint placeholder (JCB-63): `public/apple-touch-icon.png` (180, opaque), `icon-192.png`, `icon-512.png`, `icon.svg`, and a separate `icon-512-maskable.png` for the manifest's `maskable` entry (192 and 512 are `any`). Icon URLs carry `?v=2` so phones fetch the new files; the service worker precache ignores `v` when matching. Sources and generator in `design/proposals/app-icon/`.
- Fill: the prominent banner shows only on a day with nothing logged; otherwise a quiet "Fill with your usual day: N" sits under the day parts.
- The Timeline reads the shared records instead of loading on its own.
- Demo data (fictional) moved to structured amounts: items carry a default unit and flavours ("Farm Fresh" with flavour turkey instead of "Farm Fresh, turkey"), Bellavet a 1 bar = 0,1 ml conversion; `data/demo/schedule.json` is the usual day; entries link to their slot; symptom details became properties. Demo storage key is now `pawlog.demo.v2` (older demo edits are dropped).
- Language switch and Sign out moved from the header into the Menu. Day-part headers: the name is centred on its icon; the Day view's Timeline button keeps icon and label on one line.
- Back from a day (in-app or browser) returns to the Timeline at the same scroll position; reload keeps the day; invalid or out-of-range day URLs fall back to the Timeline.
- `DoseMark`/`EventBadge` styles moved to `src/components/marks.css`, `MealIcon` to `src/components/`, `.sr-only` to `global.css` (shared by Timeline and Day view; no visual change).
- Renamed legacy prototype keys (colour map, lane ids, flags) in `design/prototype/` and the Cover preview to neutral names matching the fictional sample data; no visual or behaviour change (JCB-36).
- `createRepository(demo, client)` needs a Supabase client outside demo mode; the real app is a lazily loaded chunk, so the demo never loads supabase-js or calls a backend.
- Top bar uses new `Brand` and `LangSwitch` components; signed-in users get a "Sign out" button there.
- Secret scan also catches Supabase secret keys (`sb_secret_...`).

## 2026-10-16

### Added
- Read-only Timeline in demo mode (JCB-29): one row per day from today back to the first record, month bands, day-part columns with `DoseMark` circles, Events column with `EventBadge`, Key bar with legend, draggable tick rail with month scrubbing, day-parts bar.
- `src/timeline/model.ts` (pure row, lane, circle, badge and scroll derivation) and `geometry.ts` (named fixed-geometry constants), with unit tests.
- Fictional demo data from the R10 prototype sample: 1 Sep to 15 Oct 2026, nine items, 331 entries, 17 events.
- Timeline QA fixes (JCB-29): the whole tick rail now maps today to the first record (the list tail grows with the viewport so 1 Sep reaches the top); the rail no longer captures swipes over the Events column; Key chevron fits the date column in Polish; screen-reader day summaries use translated symptom names.
- Optional `Item.hiddenByDefault` (treats and Calmora are off in the default filter set).
- Slice 1 scaffold (JCB-28): Vite, React, strict TypeScript, ESLint, Vitest, GitHub Actions CI.
- CSS variables generated from the design-system tokens; EN/PL catalogues generated from the reviewed copy CSV, with a language switch.
- PWA shell: manifest, placeholder icons, service worker caching the app shell.
- Data-access interface with `DemoRepository` (fictional data in `data/demo/`, `localStorage` persistence) and a stub `SupabaseRepository`; demo mode via `/demo` or `VITE_DEMO_MODE`.
- Placeholder home rendering from the repository (replaced by the Timeline in JCB-29).
- Four new copy rows (language switch, demo banner, demo reset, latest entries) appended to the copy CSV, pending PM review.
