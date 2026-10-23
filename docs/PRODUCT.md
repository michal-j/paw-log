# Product

## What it is
PawLog is a mobile-first web app (PWA) for two household users to keep a health timeline of their dog: what was eaten and given, symptoms, vet visits, photos, on which day. It is used daily to log, and at the vet to answer "what was going on on date X or over the last weeks?".

## Users
Two people in one household, both can edit. One dog now; the data model must not block several dogs later. iPhone Safari first. UI in English and Polish; notes may be written in either.

## Requirements
- Medications with free-form dose text ("0,15 ml (1,5 bars)", "½ pill"); schedules relative to meals.
- Diet with free-form portions (cooked meal ⅓ tray, Farm Fresh turkey ¼ can, Ocean Blend salmon ½ can).
- Vet visits, symptoms, notes; photos and PDFs attachable.
- Named issues (for example "Lump A") with photo history over time, searchable.
- Pinned notes not tied to a date (allergies, standing facts, things that need to happen).
- Past dates can be filled one day at a time and from the usual day. Bulk backfill of several days is not planned (CEO 22 Oct).
- Editing existing entries.
- Loose data model: free-form text over rigid enums where the household's real data is irregular.
- Parked for later: tasks and reminders, notifications, recipes, file sharing, native app, several dogs, per-item history, data export.

## The day, in seven parts (the user's own structure)
1. Before breakfast: Arvelin. 2. Breakfast: cooked meal, Bellavet, Biomend. 3. Between breakfast and dinner: Gastrelle, treats. 4. Dinner: Farm Fresh or Ocean Blend, Bellavet. 5. Between dinner and supper: Arvelin. 6. Supper: Farm Fresh or Ocean Blend, Bellavet. 7. After supper: Calmora (hidden by default).

## Screens in the current prototype (R10)
- **Timeline** (home): one row per day, newest first; columns per day part; circles per item; Events column with badges; month bands; a "Key" bar with legend; a draggable tick rail with month and year scrubbing.
- **Calendar**: monthly, scrolling; each cell shows the day's circles and mini badges; tap opens the day.
- **Matrix**: one week of day columns, items and event rows; scrolls horizontally.
- **Day view**: everything for one date, with previous and next day and add buttons.
- **Filters sheet**: shared across views; Biomend shown by default; Treats and Calmora off by default.
- **Jump to date** sheet, **navbar** (Timeline, Pinned, + Add, Tracked, Search).
Only Timeline, Calendar, Matrix, Day view, Filters and Jump to date were in the original prototype. Pinned, Tracked, the add/edit flows and Search were designed afterwards and are built (Search live since 23 Oct 2026: `design/proposals/search/README.md` is its spec, including what is and is not searched).

## Reading the circles
Big circle (16px) = food; small circle (11px) = medication or treat. Filled = given; hollow = skipped or refused; half-filled from the bottom = partly eaten. Colour identifies the item (see design-system tokens).

## Sample data (FICTIONAL: safe for the public repo; the prototype and the demo mode use it)
Product, food and clinic names are made up. The household's real data lives only in Supabase and never enters the repo.
- Today is 15 Oct 2026; data starts 1 Sep.
- Breakfast: cooked meal ⅓ tray, skipped (refused) on 14 Oct. Dinner and supper: Farm Fresh turkey ¼ can each until 11 Oct; Ocean Blend salmon ½ can each from 12 Oct. 14 Oct dinner half eaten.
- Arvelin ½ pill twice a day from 20 Sep. Bellavet 0,15 ml with every meal from 25 Sep. Gastrelle 1 sachet a day for 7 days, 14 to 20 Oct (day N of 7).
- 14 Oct symptoms: restless, vomited in the morning, refused breakfast, weak and confused on walks, lay down several times. 14 Oct two vet visits (Maple Vet: consultation, ultrasound, limb check, Gastrelle prescribed; Riverside Vet: blood pressure high 150 to 160).
- Lump A photos on 3 and 10 Oct. Frontline on 8 Sep and 8 Oct. Deworming 12 Sep.
- Symptom types: leakage, poo, vomit, panting, stomach rumbling, heartburn, fear, restlessness, reflux. Other event types: Frontline, deworming, anal glands, nail trimming.

## Open product questions
- How dose changes show on the timeline (JCB-10).
- Where per-item history lives (JCB-23).
- Design of editing and logging (JCB-25): done.
- Whether an entry can belong to several issues, and whether an issue can be closed (JCB-6).
- Real-time sync between the two users: how much is needed (JCB-11).
