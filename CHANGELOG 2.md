# Changelog

Format: [Keep a Changelog](https://keepachangelog.com). "Unreleased" means not yet merged to `main`.

## Unreleased

### Added
- Slice 1 scaffold (JCB-28): Vite, React, strict TypeScript, ESLint, Vitest, GitHub Actions CI.
- CSS variables generated from the design-system tokens; EN/PL catalogues generated from the reviewed copy CSV, with a language switch.
- PWA shell: manifest, placeholder icons, service worker caching the app shell.
- Data-access interface with `DemoRepository` (fictional data in `data/demo/`, `localStorage` persistence) and a stub `SupabaseRepository`; demo mode via `/demo` or `VITE_DEMO_MODE`.
- Placeholder home rendering from the repository.
- Four new copy rows (language switch, demo banner, demo reset, latest entries) appended to the copy CSV, pending PM review.
