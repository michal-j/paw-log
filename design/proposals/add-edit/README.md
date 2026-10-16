# Add and edit: logging proposal (JCB-25)

This is a proposal for the CEO to review. Nothing is built from it until he approves it.

Following the CEO's priority change, flows a, b, c and e are worked out in detail, with one recommended way each. Flow d (backfilling a date range) is only a sketch.

## Open it
- `add-edit-prototype.html` opens straight from disk. You can also serve the repo root on any free port, for example `python3 -m http.server 8137`, and open `/design/proposals/add-edit/add-edit-prototype.html`.
- The phone frame is 390x844. On a wide screen a **Flows** panel next to it jumps to each flow and switches between EN and PL. On a phone, use the `EN | PL` button in the header.
- All data is fictional and comes from `data/demo` via `sample-data.js`. Today is 15 Oct, and that day is cut after day part 3 so it shows a day still in progress. Changes reset when you reload.
- Deep links (used for the screenshots) look like `#lang=pl&date=2026-10-14&open=edit:4:ocean`. See `applyHash()` in the file.

## The idea
Most days follow the **usual schedule** (the seven day parts). The Day view shows each scheduled item as **planned** (a dashed circle and "Not logged yet") until someone logs it. You confirm the usual and correct the exceptions. You do not type a day from scratch.

## Flows (recommended version)
| | Flow | How it works | Taps |
|---|---|---|---|
| a | Log from the Day view | A planned row has a **Given** button: one tap logs it with the usual dose. If a day part has 2 or more planned items, its header shows **All given**. Tapping the row itself, or **+** on a day part, opens the Entry sheet: item chips (scheduled ones first), dose prefilled with the usual dose plus recent doses as chips, Given / Skipped / Partly eaten (partly is for food only), and an optional note. | 1 |
| a | Log from **+ Add** | The sheet has date chips (Today, Yesterday, Other date). Below them is **Next up**: the first day part that still has planned items, with **Log as given** and **Open day**. The rest is a list: Extra item (a treat, an extra dose, anything off schedule), Symptom, Vet visit, Note, Other event, and Fill several days. | 2 |
| b | Edit or delete | Tap any logged row. The same Entry sheet opens with the dose, state and note editable, and **Change** to move the entry to another date or day part. If you change the dose, a checkbox appears: "Make this the usual dose from this day on". **Delete** acts at once and shows an **Undo** toast; there is no confirm dialog. Events edit the same way: tap the card or the symptom row. | 2 to 3 |
| c | Fill a day | The Day view has a banner, "N not logged yet", with **Fill day as usual** (or **Fill the rest as usual** if part of the day is logged). It logs every planned item as given, never overwrites what is already logged, and shows **Undo**. Then you fix the exceptions as in b. | 1 + fixes |
| e | Log an event | The Day view has four tiles (Symptom, Vet visit, Note, Other event), and + Add has the same entries. **Symptom**: pick one of the 9 types or Other with free text, an optional intensity (small, medium, a lot) and optional details. **Vet visit**: clinic as free text with past clinics as chips, plus reason and findings. **Note**: free text. **Other event**: Frontline, Deworming, Anal glands, Nail trimming or Other (with a title), plus optional details. No attachments. | 3 to 4 |
| d | Backfill a range (sketch) | **+ Add → Fill several days**: choose From and To. A summary reads "7 days · 28 entries as usual". Days that already have entries stay as they are. Then correct single days in the Day view. Build it last, if at all: for a few missed days, the Day view's previous-day arrow plus **Fill day** is almost as fast. | 3 |

## Decisions needed from the CEO
1. **Usual schedule as the basis for logging.** For launch, the developer seeds it once from the household's real schedule in Supabase. After that, dose changes go through "Make this the usual dose". A screen for editing the usual day (adding or ending a medication course) comes later. Until it exists, starting or stopping a medicine needs the developer. **Recommend: accept this for launch.**
2. **Filling today also fills day parts that have not happened yet** (for example supper, if you fill at noon). **Recommend: accept it.** Undo and per-part **All given** cover the daily routine; fill is mainly an evening action and a backfill action.
3. **Treats and Calmora are not in the usual schedule.** They are logged as an Extra item. Please confirm.
4. **Delete without a confirm dialog, with Undo for about 5 seconds.** Please confirm.
5. **Items typed under "Other"** become a new item with the neutral colour (`mark-neutral`) until the PM gives them a colour token. Please confirm, or limit the list to known items.
6. **Notes and other non-badge events** (anal glands, nails, other) show on the Day view but have **no badge on the Timeline**: the EventBadge component has five kinds only. **Recommend: leave it for now** and revisit with JCB-26/JCB-37.

## New components and tokens (need PM approval before build)
- **DoseMark, new state `planned`**: a dashed `ink-3` ring with a `surface` fill, sized like the item (16 or 11px). It appears only in the Day view and the sheets, never on the Timeline, Calendar or Matrix.
- **Toast** (new): a `surface` card with `radius-lg` and `shadow-sheet`, sitting above the navbar. It holds one message and an optional **Undo** text button in `mint-deep`, and stays about 5s.
- **Entry row** (the Day view row): a 44px row with a mark, name, dose and an optional state/note line. A planned row adds a ghost **Given** button (34px, with a 44px hit area).
- **Chip** used as single select (`role="radio"`): this extends how Chip is used; it is not a new style. Context row in Sheet: one line with the date and day part, and **Change** to expand the inputs.
- **No new tokens.** The scrim and the input focus glow use `color-mix` on existing tokens (`ink`, `mint`).

## Data-model impact (`docs/ENGINEERING.md` draft)
- **New `schedule_slot`** (dog, day_part, item, dose_text, sort, active_from, active_to). It replaces `item.defaultDayPart`, because one item can sit in several parts (Bellavet in 2, 4 and 6). "Make this the usual dose" ends the current slot the day before and opens a new one from that date.
- **`entry`**: add `schedule_slot_id` (nullable), `updated_by` and `updated_at`. Add a unique index on (date, schedule_slot_id) where the slot is set. With that, Fill is an insert that does nothing on conflict, so two people filling the same day cannot create duplicates. Repeated extra items such as treats stay allowed.
- **`event`**: add type `note` and a nullable `intensity` (small, medium, a lot) for symptoms. The symptom name stays free text in `title`; the 9 known names map to translated labels.
- "Day 2 of 7" for Gastrelle is typed into the dose text today. **Recommend: derive it from the slot's active dates** (relates to JCB-10). Fill uses the plain usual dose.

## Timeline geometry
**Nothing changes on the Timeline**: no new rows, no new columns, and planned items are not drawn. The banner, planned rows and tiles are in the Day view, which has no fixed geometry. The "Timeline" screen in the prototype is a stand-in list for navigation only.

## Checked
- 390x844 in EN and PL; screenshots are in `screens/`.
- Touch targets: rows and the **+** button are 44px. **Given** and **All given** are 34px with a 44px hit area. Chips are 36px with an extended hit area. Tiles are 56px. Sheet buttons are 48px.
- Polish fits. Known trims: the context row cuts long Polish day parts ("Między śniadaniem a obiad…"); the full name shows under **Change**. Two Day view tiles wrap to two lines in Polish ("Wizyta u weta", "Inne zdarzenie").
- New strings: `copy-proposal.csv` (57 EN/PL pairs). Its numbering continues from the reviewed CSV (186+). The reviewed CSV is unchanged.
