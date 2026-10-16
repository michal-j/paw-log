# Logging: add, edit and the usual day (JCB-25, round 2)

This is a proposal for the CEO. Nothing gets built until he approves it. Round 2 follows his review of round 1. The goal is to get real data flowing quickly; he will refine it after that.

## How to open it
- `add-edit-prototype.html` opens straight from disk. You can also serve the repo root on any port except 5173 or 5174, for example `python3 -m http.server 8137`.
- The frame is 390x844. On a wide screen, a **Flows** panel next to the frame jumps to each flow and switches between EN and PL. On a phone, the language switch is in the Timeline header (the same place as in R10).
- The data is fictional and comes from `data/demo`. Today is Thu 15 Oct and the **prototype clock reads 16:30**. Changes reset when you reload. Deep links (for example `#lang=pl&screen=usual`) are listed in `applyHash()`.

## What changed since round 1
1. **The look is R10.** The Day view, header, day-part card (sun icons, uppercase part names, 26px **+**), event cards, sheets (20px title, 12px labels, 50px inputs, 50px Save), chips and navbar all reuse R10's markup and sizes. The new pieces (fill banner, planned rows, toast) follow R10's existing patterns.
2. **Bugs fixed.** A sheet now opens once. Choosing a type, symptom, amount or unit updates only the sheet's content: no reload, and the scroll position is kept. **Change** on the "For …" line opens the date and part-of-day inputs once, and they stay open, even when you switch from + Add to a form.
3. **One way to add.** **+ Add** in the navbar is the single entry point, with six options: Food, Medication, Symptom, Vet visit, Note, Other. Opened from the Day view, it uses that day's date. A day part's **+** opens the same sheet with that part already set, showing only Food and Medication. The top tiles and "Extra item" are gone. Tapping a planned row logs or adjusts that item in its part.
   - **Treats sit under Food.** They are eaten (so "partly eaten" applies), they come in flavours and pieces, and R10's filters already group them with Food.
4. **Structured amounts.** Amount is a fraction chip (¼ ⅓ ½ ⅔ ¾ 1 1½ 2 3, or Other for a free number). ml and g get a decimal field instead. Unit is a set of chips: pill, ml, sachet, capsule or drop for medication; can, tray, g or piece for food. Food also has a **Flavour** selector (Farm Fresh: turkey, salmon or chicken). The note field stays for anything else. Displays stay short: "½ can", "1 sachet". Bellavet keeps "0,15 ml (1,5 bars)" because the item stores a conversion of 1 bar = 0,1 ml.
5. **Symptoms have their own properties** (table below). There are at most three chip rows plus Details, and all of them are optional.
6. **Usual day (the routine).** A new screen opens from **Usual day ›** next to "Parts of the day" in every Day view. It shows the seven parts with their times and items, and each item's amount, flavour and course ("day 2 of 7, until 20 Oct").
   - **+** on a part adds an item.
   - Tapping an item lets you change its amount from a date, set how long it runs (no end, 7 days, 14 days, or an end date), or remove it from a date on.
   - Changes start on the date you pick, so days already logged stay as they were.
   - The Day view banner now says what it does: "Up to now: 3 not logged (16:30) → **Fill with your usual day: 3**".
   - **Today, filling covers only the parts whose time has passed.** Later parts show "Later today" and have no **Given** button.
   - When you log something that is not in the usual day, the form offers "Add to the usual day from this day on". When the amount differs from the usual one, it offers "Make this the usual amount from this day on".
7. **Kept from round 1:** tap any row to edit it, **Given** in one tap, Undo on fill and delete, and the dashed "planned" circle.

## Properties per symptom (please confirm)
| Symptom | Properties (chips, all optional) | Shown as |
|---|---|---|
| Poo | Consistency: normal, soft, diarrhea · Colour: normal, dark, light, with blood · Amount: small, medium, a lot | "diarrhea · dark · medium amount" |
| Vomit | How many times: 1×, 2×, 3×+ · When: in the morning, at midday, in the evening, at night | "1× in the morning" |
| Leakage | Amount: small, medium, a lot | "small amount" |
| Panting, Stomach rumbling, Heartburn, Fear, Restlessness, Reflux, Other | Intensity: small, medium, a lot | "a lot" |

Every symptom also has an optional Details field (free text).

## Decisions needed from the CEO
1. **Times for each part of the day** (proposed: 07:00, 07:30, 12:00, 15:00, 18:00, 20:00, 22:00). They decide what "up to now" means today. Should they be editable on the Usual day screen? (They are not editable yet.)
2. **Where the Usual day lives:** the **Usual day ›** link in the Day view (my recommendation) and/or Pinned or a settings screen.
3. **The symptom property table above:** are the values right? Should colour include "with blood"?
4. **Unit lists, the fraction chips and the comma decimal in English** ("0,15 ml"). The reviewed copy uses a comma in EN too.
5. **Treats under Food**, and new items typed under "Other" getting the neutral colour until the PM assigns a colour token.
6. **Delete has no confirmation**, only Undo, as in round 1.

## New components and tokens (need PM approval)
- **DoseMark state `planned`:** a dashed `ink-3` ring. It is used only in the Day view, never on the Timeline, Calendar or Matrix.
- **Toast with Undo.**
- **Planned row with a Given button.**
- **Amount picker:** fraction chips plus a unit chip row, built from the existing Chip component in single-select (`role="radio"`) mode.
- **Usual day screen:** built from the existing Day view part card.
- **No new tokens.** State tags use the `badge-sym-*` tokens (refused) and the `badge-worm-*` tokens (half eaten), in place of R10's hard-coded hex values.

## Data-model impact (`docs/ENGINEERING.md` draft)
- **Routine = `schedule_slot`** (dog, day_part, item, flavour, amount, unit, active_from, active_to, sort).
  - Changing a slot from a date closes the old row the day before and opens a new one.
  - A course is just `active_to`.
  - "Day N of M" is derived from the slot's dates and is no longer typed into the dose.
  - It replaces `item.defaultDayPart`.
- **`day_part`** (dog, part 1–7, time): the usual time of each part.
- **`item`:** add `default_unit`, the list of flavours (or a small `item_variant` table), and an optional `unit_conversion` (Bellavet: 1 bar = 0,1 ml).
- **`entry`:** replace `dose_text` with `amount` (numeric), `unit` (text) and `flavour` (text, nullable). Keep `note`. Add `schedule_slot_id` (nullable), with a unique index on (date, schedule_slot_id), so that two people filling the same day cannot create duplicates. Add `updated_by` and `updated_at`.
- **`event`:** add type `note`, `props` (jsonb, the symptom properties above) and `also_done` (text[], for the vet visit chips). The symptom name stays in `title`.
- **Migrating the demo data:** the free-text doses in `data/demo` convert cleanly. The prototype parses them: "½ can" becomes 0.5 can, and "chicken · 2" becomes a chicken treat, 2 pieces.

## Timeline geometry
Nothing changes. Planned items, the banner and the Usual day screen do not touch the Timeline, Calendar or Matrix. The "Timeline" in the prototype is only a list for getting around.

## How this was checked
- 390x844, EN and PL, 18 screenshots in `screens/`.
- Flows clicked through in the browser:
  - Change stays open.
  - Switching type keeps the same sheet.
  - A Poo symptom with properties saves.
  - Food at ¼ can, partly eaten, offers "make usual".
  - Fill, then Undo.
  - Changing a usual-day amount.
- Touch targets: rows 44px; **Given** 28px visible with a 44px hit area; chips 36px with an extended hit area; **+** 44px; Save 50px.
- Polish fits. Known wraps: long Polish dose lines next to **Podane** wrap to two lines, and the date line stays on one line.
- `copy-proposal.csv`: 103 new EN/PL pairs, numbered 186+. It replaces round 1's list. The reviewed CSV is unchanged.
