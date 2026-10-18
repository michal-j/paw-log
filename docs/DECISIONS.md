# Decisions and open items

## Decided
- App renamed to PawLog (16 Oct). Repo: michal-j/paw-log.
- Repo is public as a showcase (16 Oct). Demo mode with fictional data, client-side, like Movie Shelf and Job Hub. Real data only in Supabase. Prototype and docs data made fictional.
- Stack confirmed (16 Oct): Vite, React, TypeScript; Supabase; Vercel. Code on GitHub.
- Product: health timeline for the household dog, two users, iPhone first, EN and PL, loose data model. (discovery)
- Delivery: PWA with shared cloud database (JCB-22). Supabase is the candidate.
- Layout: vertical lanes timeline is home; Calendar and Matrix are secondary views; one shared filter sheet.
- Items are circles: big = food, small = medication or treat; filled / hollow / half = given / skipped / partly eaten.
- Look: R10 Mint Clean. Light only, mint primary, pastel data colours, subtle depth. Design system published.
- Copy: reviewed EN/PL pairs in `docs/copy/pawlog-copy-en-pl.csv`; the CEO reviews copy outside the app.
- Process: function first, then UI and copy polish, then spec and backlog, then build. PM agent keeps full context; separate agents for design, code, QA.
- Slice 1 scaffold (JCB-28) and slice 2a read-only Timeline in demo mode (JCB-29, PR #2) merged (16 Oct). Slice 2b (Supabase) split out as JCB-35; Supabase project still needs the CEO's OK.
- Timeline rail touch area is 20px wide, below the 44px rule, so swipes over the Events column scroll normally (CEO, 16 Oct; Designer to revisit in JCB-37).
- `Item.hiddenByDefault` added to the data model so treats and Calmora start hidden, per the default filters (16 Oct).
- PM working agreement (16 Oct): the PM talks to the CEO in outcomes and recommendations, runs the subagents, Linear and docs; one CEO "go" per outcome covers commit, PR, QA fixes and merge (see `docs/PM.md`).
- Production is live on Supabase (16 Oct, CEO's OK): one household, two members, private storage bucket for photos. Real data stays out of the repo.
- First real use (16–17 Oct): the CEO's blockers were fixed before any new feature (JCB-43, then JCB-59–66, JCB-71, JCB-72).
- Delete is the same for every entry: it disappears with Undo; a removed usual-day item leaves only a quiet "Removed from the usual day · Restore" line (JCB-60, 17 Oct).
- Built after the approved designs (JCB-68): Pinned notes (JCB-5), Tracked conditions (JCB-6), photos on events and conditions, no PDFs yet (JCB-7). Four-tab navbar.
- PWA icon: option A, paw glyph in brand colour (JCB-63).
- Toasts: dark background with white text and mint Undo (JCB-64); Undo toasts stay 8 s, plain ones 5 s (JCB-42).
- Lean way of working (17 Oct): QA in proportion to risk, `docs/DEV-CHECKLIST.md` for developers, the PM owns CHANGELOG and TEST-CASES, cheaper model for QA and small fixes (see `docs/PM.md`).
- JCB-38 (demo data: missing breakfast item) closed as intentional (18 Oct).
- Working rules: short explanations, clarifying questions first, quality over quantity, no unauthorised access (confirm with the CEO).

## Open
- Waiting on the CEO's iPhone check: save after the app was in the background (JCB-71), Usual day "Starts on" (JCB-72), photos from camera and library on mobile data (JCB-7).
- Waiting on the CEO's pick: event badges on the Timeline (JCB-26 event icons, JCB-69 note badges); proposal on branch `michaljaciubek/design-event-badges`.
- JCB-37 Design follow-ups from the Timeline: column headers, sticky month label, tablet/desktop layout, rail hit area, mini badge type token.
- JCB-25 Design for bulk adding (editing is designed and built); build is JCB-33 slice 6.
- JCB-10 Dose changes on the timeline. JCB-11 Real-time sync need. JCB-73 idea: swipe between views.
- Slice 4 (calendar, matrix, filters, jump to date, JCB-31) and search (part of JCB-34) not started.
- Copy review of the draft EN/PL lines in `docs/copy/` is parked as low priority until the CEO raises it.

## Parked
JCB-12 tasks and notifications, JCB-13 recipes, JCB-14 file sharing, native app and several dogs, JCB-23 per-item history, JCB-24 data export.
