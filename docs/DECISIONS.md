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
- Working rules: short explanations, clarifying questions first, quality over quantity, no unauthorised access (confirm with the CEO).

## Open
- JCB-36 Public repo: old product names in the design-system Cover preview (and git history).
- JCB-37 Design follow-ups from the Timeline: column headers, sticky month label, tablet/desktop layout, rail hit area, mini badge type token.
- JCB-26 Event icons: remaining inconsistencies between screens (fix after the first build slice).
- JCB-25 Design editing and bulk adding.
- JCB-10 Dose changes on the timeline. JCB-11 Real-time sync need. JCB-6 Issues model.
- Repo: github.com/michal-j/paw-log (public, created 16 Oct). Claude GitHub App must be installed on it before agents can push.

## Parked
JCB-12 tasks and notifications, JCB-13 recipes, JCB-14 file sharing, native app and several dogs, JCB-23 per-item history, JCB-24 data export.
