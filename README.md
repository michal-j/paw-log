# PawLog

A health timeline for a dog: meals, medication, symptoms and vet events, day by day. Mobile-first PWA for a two-person household, English and Polish. Concept project in progress; it includes a demo mode with fictional data.

Start with [CLAUDE.md](CLAUDE.md) and [docs/](docs/).

## Develop
Node 22+.

```bash
npm ci
npm run dev        # http://localhost:5173/demo  (demo mode, no backend)
```

| Command | What it does |
|---|---|
| `npm run generate` | Builds `src/styles/tokens.css` from `docs/design-system/tokens.json` and the EN/PL catalogues from `docs/copy/pawlog-copy-en-pl.csv` (git-ignored; runs before dev, build, test, typecheck) |
| `npm run lint` / `npm run typecheck` / `npm test` | ESLint, `tsc --noEmit`, Vitest |
| `npm run build` | Type-check, then production build with the service worker |
| `npm run check:secrets` | Fails on service-key or real-project-URL patterns (the repo is public) |

Copy `.env.example` to `.env` for local settings. `VITE_DEMO_MODE=true` forces demo mode; otherwise demo mode is on whenever the path is `/demo`. Demo data lives in `data/demo/` and is fictional; visitor changes stay in `localStorage`.

Manual test cases: [docs/TEST-CASES.md](docs/TEST-CASES.md). Architecture notes: [docs/ENGINEERING.md](docs/ENGINEERING.md).
