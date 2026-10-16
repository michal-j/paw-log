# Changelog

Format: [Keep a Changelog](https://keepachangelog.com). "Unreleased" means not yet merged to `main`.

## Unreleased

### Added
- Read-only Day view in demo mode (JCB-30): tap a Timeline row (whole 44px row is a link) to open `/demo/day/YYYY-MM-DD`; date header with Today/Yesterday, previous/next day stopping at the first record and today (disabled state shown and announced), "What happened" cards (vet visits, symptoms, Frontline, deworming, photo) with `EventBadge`, the seven day parts with `DoseMark`, name, dose and Refused / Half eaten tags, empty-day state. Shows everything, including treats and Calmora.
- `src/day/model.ts` (day grouping, bounds, prev/next) and `src/routes.ts` (path router), with unit tests; Day view app tests.
- `npm run check:secrets` also fails on locally blocked words from a git-ignored `.secret-words` file and/or `PAWLOG_BLOCKED_WORDS` (JCB-36).
- Real backend (JCB-35), ready to apply once the CEO creates the Supabase project: versioned migrations for household, member, dog, item, schedule_slot, entry and event, with row-level security on every table (members read and write only their household; no anonymous access; households, members and dogs read-only from the app).
- Schema for the logging design: `schedule_slot` (an item in several day parts, each with its own dose), `entry.schedule_slot_id` with one entry per slot per day, `updated_by` on entry and event, event type `note`, event `intensity` (small, medium, large). `Repository.listScheduleSlots`, `DuplicateSlotEntryError`.
- `npm run test:db`: applies the migrations to PGlite and runs 48 pgTAP-style RLS checks. Not yet in CI: adding the step to `.github/workflows/ci.yml` needs a push with the GitHub `workflow` scope.
- `SupabaseRepository` implementing the whole `Repository` interface (paged reads, upserts, database-set `created_by`/`updated_by`), with unit tests against a mocked client.
- Sign-in with e-mail and a 6-digit code (no magic link, no sign-up), session kept across app restarts, sign-out (this device only, with a confirmation), a "not connected" screen when the build has no Supabase settings, and a message for an account not yet linked to a dog.
- Runbook `docs/runbooks/supabase-setup.md`, bootstrap template `supabase/bootstrap.example.sql`, sign-in e-mail template.
- Draft EN/PL copy for sign-in in `docs/copy/copy-proposal-auth.csv` (pending CEO review), merged into the generated catalogues.

### Changed
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
