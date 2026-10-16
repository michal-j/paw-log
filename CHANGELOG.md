# Changelog

Format: [Keep a Changelog](https://keepachangelog.com). "Unreleased" means not yet merged to `main`.

## Unreleased

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
