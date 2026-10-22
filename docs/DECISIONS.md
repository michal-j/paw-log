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
- No service worker, so the app does not open offline (CEO, 18 Oct): it most likely stalled saves in the iPhone app (JCB-71). Saving offline and syncing later is a separate idea (JCB-75).
- Saving (JCB-71, 18 Oct): stuck database writes are retried once after 6 s (2.5 s since JCB-74) on a fresh request (safe: every write is idempotent); a hidden request log (tap "Menu" 5 times) is kept for diagnosis. Root cause unproven (likely Safari reusing a dead connection). Kept open for a few days of real use.
- Launch screen (CEO, 18 Oct): mint with a white paw and a white "PawLog". The white name is below 3:1 contrast on mint, accepted as a brief brand splash. Proportions to be revisited by the Designer (JCB-98, low).
- Tracked (18 Oct): dates outside the current year show the year; a condition's history is grouped by year. The Tracked list itself is not grouped by year (it already has Open and Resolved).
- Photo viewer is full screen on black (CEO, 18 Oct).
- Tracked start date (JCB-81, PM 19 Oct): linking an older entry moves the condition's start back to that entry's date; it never moves forward on its own (unlink, delete, a later date or Undo of the save leave it). Set in the app on save, no schema change.
- Own vet services (JCB-89, CEO 19 Oct): saved as text with the visit and offered again as chips like clinic names, no new table; the database check allows up to 10 services of 1–40 characters (applied to production 19 Oct). New copy is a draft in `docs/copy/copy-proposal-vet-services.csv`.
- Timeline width (JCB-86, CEO 19 Oct): columns give up space in steps (column minimums, padding, lanes 20/15 to 18/14 px with circles unchanged, date column 44 to 40), then the Timeline scrolls sideways with the date pinned. Busy days: Option 3 (one line of badges, then "+N"), built with the badge colour pick (JCB-26/69). Column filters later (JCB-100).
- Event badges built (JCB-26, JCB-69, PM 22 Oct): `EVENTS_MIN_W` stays 60 and the Events column has no side padding, so a vet badge with a count plus "+N" fits at the minimum; the refused tag gets its own `tag-skipped-*` tokens (the old symptom red). The per-entry note marker in the Day view and the Calendar and Matrix badges are not built.
- "Couldn't save" sooner (JCB-74, PM 22 Oct): writes have their own 6 s limit (2.5 s to the retry, 3 s for the retry); reads stay at 15 s. The retry is kept, not dropped, because it is what recovers a stuck connection silently.
- PDF upload (JCB-76, CEO 18 and 22 Oct): a PDF is a row (not a thumbnail) under an event's text and photos and opens in the phone's own viewer, no Download button and no in-app viewer; added from a Documents field in the vet and note forms; on a condition, "Add document" saves a Note linked to it, and its PDFs show in a Documents section and in History; limits 10 MB and 5 per entry; upload on Save, one failure blocks the save. No Timeline badge for documents (paperclip idea: JCB-131). The `documents` migration and private bucket were applied to production on 22 Oct (CEO's OK). Opening a PDF from the installed iPhone app was tried by the CEO on 22 Oct and looks good.
- Event badges (JCB-26, JCB-69, CEO 19 Oct): Option B (cyan vet with a heart-line glyph, white outlined page for notes) with Option A's orange "!" for symptoms; a single vet card shows the glyph without a count. Built together with busy-day "+N".
- Way of working, tightened (CEO 19 Oct) to cut plan usage: the PM decides who does each change and does small ones itself; QA agent only for saving, data and schema changes; docs lines in the same PR; Linear holds open and next, this file only what is decided (see `docs/PM.md`).
- Design system upkeep (CEO 22 Oct): a PR that adds or changes a component or token updates `docs/design-system/` in the same PR; the published artifact may lag but each change is logged in Linear (JCB-133) for a later sync.
- Linear is the source of truth (CEO 22 Oct): an issue is taken, built, tested, deployed and then closed; bundles are split into one deliverable per issue, with labels (Feature, Improvement, Bug, Idea, Open question) and sub-issues for epics; the full rules are in `docs/PM.md`. Backlog cleaned up the same day.
- Working rules: short explanations, clarifying questions first, quality over quantity, no unauthorised access (confirm with the CEO).

## Open, next, parked
In Linear (team JCBK, project PawLog): the latest project update says what is live, in progress and waiting on the CEO; issues hold the backlog and priorities. Parked ideas are Backlog issues with low or no priority.
