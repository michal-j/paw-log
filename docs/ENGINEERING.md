# Engineering (stack confirmed by the CEO 16 Oct; details still proposals)

Everything here is a proposal from the PM for the Developer to refine. Items marked DECIDED are decisions the CEO made; the rest need his sign-off before work starts.

## Delivery
- DECIDED: PWA (add to home screen on iPhone), shared data for two users through a cloud database; native stays possible later by wrapping.
- DECIDED: iPhone first, EN and PL, loose data model, do not block several dogs or a native wrapper.

## Public repo and demo mode (DECIDED 16 Oct)
- The repo is public as a concept showcase. Same pattern as the CEO's Movie Shelf and Job Hub: a demo mode with frozen fictional sample data, fully client-side, no backend calls, changes persist only in the visitor's `localStorage`; the demo is served from the same site (for example `/demo`) so every push to `main` deploys both.
- One codebase: a data-access interface with two implementations, `SupabaseRepository` (real) and `DemoRepository` (in-memory plus `localStorage`, seeded from `data/demo/*.json`). A `DEMO_MODE` switch picks one at startup. No feature may call Supabase directly.
- Demo data is fictional and lives in `data/demo/`. The prototype's sample data (`design/prototype/script.js`) is the starting point for it.
- Real data is protected by Supabase, not by repo privacy: row-level security on every table, sign-up disabled (two accounts only), private storage bucket for photos and PDFs, only the anon key in the client.
- CI check: fail the build if the repo contains known real names or a service-role key (list kept outside the repo, in the PM's notes, to avoid publishing it).

## Proposed stack
- Frontend: Vite, React, TypeScript, CSS variables generated from `docs/design-system/tokens.json`; a small i18n layer with EN and PL catalogues seeded from `docs/copy/pawlog-copy-en-pl.csv`.
- Backend: Supabase (Postgres, auth for two users, storage for photos and PDFs, realtime if needed). Row-level security: both household users read and write all rows of their household.
- Hosting: Vercel (static PWA, preview deployments).
- Offline: service worker caching the app shell; queued writes are a later decision (JCB-11).
- Tests: unit tests for date and schedule logic; Playwright for the key flows at 390x844.

## Data model (draft, loose)
- `household`, `member` (auth user, household).
- `dog` (household, name). Every other table carries `dog_id`.
- `item` (dog, kind: food | medication | treat | supplement | procedure, name, colour token, day-part default, active from/to).
- `entry` (dog, date, day_part 1 to 7, item, dose_text free-form, state: given | skipped | partial, note, created_by, created_at).
- `event` (dog, date, type: vet | symptom | photo | frontline | deworming | anal_glands | nails | other, title, detail text, issue optional).
- `issue` (dog, name, status). `attachment` (dog, owner entry/event/issue, file path, kind, caption, date).
- `pinned_note` (dog, text, created_by).
- Dates are plain dates in the household timezone; dose text stays free-form.

## Build slices (proposed order)
1. Scaffold: repo, CI, tokens to CSS, i18n, PWA shell, data-access interface with demo implementation, Supabase project, auth for two users.
2. Read-only timeline in demo mode (fictional data), then the same against Supabase.
3. Day view and logging one entry; edit entry.
4. Calendar and matrix views, filters, jump to date.
5. Events (vet, symptoms, photos) and attachments.
6. Bulk add and backfill (needs design JCB-25).
7. Pinned notes, issues with photo history, search.
8. Later: per-item history, export, tasks and notifications.

## Conventions
- TypeScript strict, no `any`. Components named as in the design system; one component per badge/mark kind variant, not per screen.
- No hard-coded colours, radii or shadows; no hard-coded strings.
- Preserve the fixed timeline geometry; derive scroll maths from named constants.
- Migrations are versioned files; nothing changes the live database schema without PM and CEO approval.
- Secrets never in the repo; environment variables only.

## Scaffold notes (slice 1, JCB-28)
- `npm run generate` writes `src/styles/tokens.css` and `src/i18n/catalogues.generated.json` (both git-ignored). Edit the token JSON or the copy CSV, never the output.
- Catalogue keys: the CSV's "Where (code name)" is not unique. A code is used as the key only if it appears once; otherwise the key is `<code or copy>.<row #>` (for example `name.96`). Row numbers in the CSV are therefore part of the key: do not renumber rows.
- Demo mode is on when the path is `/demo` (or `/demo/...`) or `VITE_DEMO_MODE=true`. `vercel.json` rewrites non-asset paths to `index.html`; the service worker falls back to the shell for navigations.
- Fonts (Onest, Instrument Sans) are named in the tokens but not yet shipped; the system font stack renders until the Designer and PM decide how to host them.
- Placeholder icons are flat mint squares generated for the scaffold; replace with the real mark once designed.
- Vercel project and Supabase project are not created (CEO approval pending); `SupabaseRepository` is a stub.

## Timeline notes (slice 2a, JCB-29)
- `src/timeline/model.ts` derives everything from repository data and is pure: rows (month bands + day rows, newest first, from the first record to `today`), columns and lanes, circle state, badges, rail ticks, scroll lookups. `Timeline.tsx` only renders it. Unit tests: `tests/timeline.test.ts`.
- Geometry lives in `src/timeline/geometry.ts` (day row 44, month band 28, rail 20, tail 120, column minimums, circle sizes). Row `top` offsets and the rail maths come from these constants; change them together with `timeline.css`.
- Lanes come from logged entries: all food items in one day part share one lane (so Farm Fresh and Ocean Blend sit in the same Dinner column), other items get one lane each, in item order. Items with `hiddenByDefault` (treats, Calmora) are left out until the filters sheet exists. The last day part collapses to width 0 when empty.
- Circles: `DoseMark` takes an item's colour token name (validated against `[a-z0-9-]`) and sets `--mark`; the ring is `color-mix(--mark 80%, ink)`. Badges: `EventBadge`, one component, tokens `badge-<kind>-*`. Event types without a designed badge (anal glands, nails, other) are not shown yet.
- Rows are not interactive yet (day view is a later slice); each row carries a visually hidden summary for screen readers. The rail is 20px wide with a 44px hit area that overlaps the Events column edge.
- Months with no records (the prototype's 44px "Backfill" bands) are not shown: backfill is part of the add flow.
