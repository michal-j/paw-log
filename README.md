# PawLog

A health timeline for a dog: meals, medication, symptoms and vet events, day by day. Mobile-first PWA for a two-person household, English and Polish. Concept project in progress; it includes a demo mode with fictional data.

Start with [CLAUDE.md](CLAUDE.md) and [docs/](docs/).

## Develop
Node 22+.

```bash
npm ci
npm run dev        # http://localhost:5173/demo  (demo mode, no backend): the read-only Timeline
```

The root path `/` is the real app: sign-in with an e-mailed 6-digit code, then the household's data in Supabase. It needs `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (see `.env.example`); without them it shows "PawLog is not connected". Setting up the Supabase project is a one-time job for the CEO: [docs/runbooks/supabase-setup.md](docs/runbooks/supabase-setup.md).

| Command | What it does |
|---|---|
| `npm run generate` | Builds `src/styles/tokens.css` from `docs/design-system/tokens.json` and the EN/PL catalogues from `docs/copy/pawlog-copy-en-pl.csv` plus draft `docs/copy/copy-proposal-*.csv` files (git-ignored; runs before dev, build, test, typecheck) |
| `npm run lint` / `npm run typecheck` / `npm test` | ESLint, `tsc --noEmit`, Vitest |
| `npm run test:db` | Applies `supabase/migrations/` to an in-process Postgres (PGlite, no Docker) and runs the row-level-security tests in `supabase/tests/database/` |
| `npm run build` | Type-check, then production build with the service worker |
| `npm run check:secrets` | Fails on service-key or real-project-URL patterns (the repo is public) |

Copy `.env.example` to `.env` for local settings. `VITE_DEMO_MODE=true` forces demo mode; otherwise demo mode is on whenever the path is `/demo`. Demo data lives in `data/demo/` and is fictional (1 Sep to 15 Oct 2026, "today" frozen at 15 Oct); visitor changes stay in `localStorage`.

Code map: `src/data/` (repository interface and implementations), `src/auth/` (sign-in, session, Supabase client wiring; loaded only outside demo mode), `src/i18n/`, `src/timeline/` (Timeline screen: pure model, geometry constants, component, CSS), `src/components/` (`DoseMark`, `EventBadge`, `Brand`, `LangSwitch`), `supabase/` (migrations, RLS tests, bootstrap template, e-mail template, local CLI config).

Manual test cases: [docs/TEST-CASES.md](docs/TEST-CASES.md). Architecture notes: [docs/ENGINEERING.md](docs/ENGINEERING.md).
