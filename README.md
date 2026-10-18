# PawLog

A health timeline for a dog: meals, medication, symptoms and vet events, day by day. Mobile-first PWA for a two-person household, English and Polish. Concept project in progress; it includes a demo mode with fictional data.

Start with [CLAUDE.md](CLAUDE.md) and [docs/](docs/).

## Develop
Node 22+.

```bash
npm ci
npm run dev        # http://localhost:5173/demo  (demo mode, no backend): the Timeline; tap a row for its Day view (/demo/day/2026-10-14)
```

The root path `/` is the real app: sign-in with e-mail and password (accounts are created by the CEO in Supabase, no sign-up), then the household's data in Supabase. It needs `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (see `.env.example`); without them it shows "PawLog is not connected". Setting up the Supabase project is a one-time job for the CEO: [docs/runbooks/supabase-setup.md](docs/runbooks/supabase-setup.md).

| Command | What it does |
|---|---|
| `npm run generate` | Builds `src/styles/tokens.css` from `docs/design-system/tokens.json` and the EN/PL catalogues from `docs/copy/pawlog-copy-en-pl.csv` plus draft `docs/copy/copy-proposal-*.csv` files (git-ignored; runs before dev, build, test, typecheck) |
| `npm run lint` / `npm run typecheck` / `npm test` | ESLint, `tsc --noEmit`, Vitest |
| `npm run test:db` | Applies `supabase/migrations/` to an in-process Postgres (PGlite, no Docker) and runs the row-level-security tests in `supabase/tests/database/` |
| `npm run dev`, then `/harness.html` | Dev only: the real app (sign-in gate, SupabaseRepository, supabase-js) against an in-browser fake Supabase on PGlite with every migration; no project or account needed (`tests/harness/`, see docs/ENGINEERING.md) |
| `npm run build` | Type-check, then production build (manifest, plus a self-removing `sw.js` for old installs) |
| `npm run check:secrets` | Fails on service-key or real-project-URL patterns, and on locally blocked words (the repo is public) |

**Blocked words.** To stop real names (products, clinics, people) from ever being committed, list them locally and the secret scan fails on any tracked file or path that contains one (case-insensitive; the word itself is never printed):
- a `.secret-words` file in the repo root, one word or phrase per line, `#` for comments. It is git-ignored; never commit it.
- and/or the `PAWLOG_BLOCKED_WORDS` environment variable, comma-separated (e.g. as a CI secret).

Keep the list out of the repo, issues, PRs and commit messages.

Logging (JCB-39): **+ Add** in the bottom bar (Food, Medication, Symptom, Vet visit, Note, Other), **+** on a day part, tap any row or event card to edit or delete it (Undo in the toast). Planned items of the usual day show as dashed circles with **Given**; **Fill with your usual day** logs everything due (today only up to now). **Menu** in the header (every screen): Usual day (`/demo/usual`), the usual time of each day part, language, Sign out / Reset demo data.

Copy `.env.example` to `.env` for local settings. `VITE_DEMO_MODE=true` forces demo mode; otherwise demo mode is on whenever the path is `/demo`. Demo data lives in `data/demo/` (items, `schedule.json` = the usual day, entries, events) and is fictional (1 Sep to 15 Oct 2026, "today" frozen at 15 Oct, the time of day is the device clock); visitor changes stay in `localStorage` (`pawlog.demo.v2`).

Code map: `src/data/` (repository interface and implementations), `src/auth/` (sign-in, session, Supabase client wiring; loaded only outside demo mode), `src/i18n/`, `src/timeline/` (Timeline screen: pure model, geometry constants, component, CSS), `src/day/` (Day view: pure model, component, CSS), `src/log/` (logging: amounts, usual-day logic, symptoms, writes with undo, the sheets and their shared state), `src/usual/` (Usual day screen), `src/routes.ts` (path router), `src/components/` (design-system components: `DoseMark`, `EventBadge`, `MealIcon`, `Sheet`/`Field`/`Chip`, icons, shared `marks.css` and `controls.css`; plus `Brand`, `LangSwitch`), `supabase/` (migrations, RLS tests, bootstrap template, local CLI config).

App icon: `public/apple-touch-icon.png`, `icon-192.png`, `icon-512.png`, `icon-512-maskable.png`, `icon.svg` (sources and generator in `design/proposals/app-icon/`). When they change, bump `ICON_VERSION` in `vite.config.ts` and the `?v=` in `index.html`. On iPhone the home-screen icon is cached: remove the app from the home screen and add it again to see the new icon.

Manual test cases: [docs/TEST-CASES.md](docs/TEST-CASES.md). Architecture notes: [docs/ENGINEERING.md](docs/ENGINEERING.md).
