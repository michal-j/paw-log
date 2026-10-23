# Search across the log (JCB-138, design proposal, revision 2)

For the CEO, through the PM. Placement is decided: Search is the fifth tab. Revision 2 covers the whole data model (`src/data/types.ts`), not the prototype's five chips. Fictional data only (docs/PRODUCT.md, `data/demo`).

## How to open it
`index.html` in a browser. 390x844 frame; on a wide screen a side panel switches EN and PL and jumps to 27 states. Deep link: `index.html#lang=pl&state=food` (state names are the keys in `PRESETS` in `app.js`). It is a working search over the demo data. `proposal.css` is the only new CSS; `build.py` assembles `index.html`.

## Placement (decided)
Navbar: Timeline, Pinned, **+ Add**, Tracked, **Search**. The design system's NavBar already specifies five items, so no change to `docs/design-system`; the build goes from 4 to 5 grid columns, which re-centres + Add. Checked at 390 px in EN and PL.

## What is searchable: everything the data model holds
There are **17 kinds**, from the model: the 9 `EventType`s (vet, symptom, photo, frontline, deworming, anal glands, nails, note, other), **Documents** (PDFs, a property of an event), the 5 `ItemKind`s (food, medication, supplement, treat, procedure), and the two things not on a day (Tracked conditions, Pinned notes). Every kind is reachable by **filter** and by **text**.

### Filters: one button, one summary line, one sheet (recommended)
The filter control is the app's own pattern (one shared filter sheet, as on the Timeline), named in plain words: **Filters** / **Filtry** (the reviewed Timeline labels).
- **Idle:** the field, and to its right a **Filters** button (sliders glyph). No chips in the row.
- **Something on:** the button shows a count pill ("Filters 2"), and **one short line** appears under the field: the first two chosen names and "+N", with **Clear** at the right ("Vet visits, Symptoms +2 · Clear"). The line never grows (ellipsis at worst), so one kind or seventeen cost the same 44 px. Tapping the text reopens the sheet; Clear empties the filters and the line goes away.
- **Sheet** (the existing Sheet): title Filters, "Clear" in the header, all 17 toggles in three captioned groups (**Events**, **Food, medication and care items**, **Not on a day**), and a primary button **Show results (N)** that updates as you toggle (it reads **Done** while no kind is on, and the sheet has no "nothing picked shows everything" line, because nothing picked with nothing typed is the idle screen), so you see the effect before closing. Nothing is shown twice: the chips exist only in the sheet. Fits at 390 px in PL without scrolling.
- Shown at 390 px in EN and PL in the prototype: idle (state 1), one on (6), four on (6b), sheet open (7).
- **Trade-off:** one-tap quick chips are gone; "list all vet visits" is now Filters, Vet visits, Show results (3 taps, no typing).
- Alternatives: (a) filter chips in a scrolling row (rejected by the CEO: long, repeats the sheet); (b) a sheet only, with no summary line: simplest, but you cannot see which filters are on without reopening it.
- Several kinds on = union; kinds and text combine (AND). Food is its own kind, not under Medications.

### What a kind filter lists with nothing typed
- **An event kind** (Vet visits, Symptoms, Notes, Photos, Documents, Frontline, Deworming, Anal glands, Nails, Other): every event of that kind, whole history, newest first under month captions.
- **An item kind** (Food, Medications, Supplements, Treats, Procedures): first the **item cards** of that kind (name, kind, entry count, last date), then **every entry of that kind**, whole history, newest first, as compact rows grouped in one card per run (date, day part, item, amount or state; 20 at a time, "Show more"). Filters, Food, with nothing typed, is every meal ever logged.
- **Tracked / Pinned:** every condition (open and resolved) or every pinned note.
- With a filter on and text typed, the text narrows that list ("Medications" + "bellavet" = every Bellavet entry).

### An item's history, and how it relates to the kind filter
**Tap an item card** (any ItemKind, from a text match or from a kind filter) and you get that item's **whole history**: every entry newest first by month, with amount, day part, state (refused, half eaten) and any note; a row opens its day. It is exactly the kind filter's list narrowed to one item, so the two never disagree: *kind filter = union of its items' histories; item history = one item*. This is in scope now (not deferred to JCB-23).

## What is searched (text)
A word matches only at the **start of a word**, ignoring case and diacritics ("sto" finds Stomach, not "nieistotna"; "zoladek" finds "żołądek"); every typed word must match; from 2 characters. **Polish forms find each other (stem on both sides).** In Polish every word, typed or stored, is also reduced to a rough stem (one inflection ending removed, never below 3 letters, and a fleeting "e" before a final "k" dropped): żołądek, żołądka, żołądku, żołądkiem, żołądków all give "żołądk"; lek, leki, leków, lekiem give "lek"; wizyta, wizyty, wizytę, wizytą give "wizyt"; pazur, pazury, pazurów give "pazur". A typed word matches a stored word when the stored word starts with it (as in English), or when the typed word's stem matches the stored word's stem (by prefix for stems of 4+ letters, so a word typed in part still matches; the whole stem for shorter ones, so "leków" finds lek, leki, lekiem but not "lekarz"). It is one rule for every field below, type words and services included, and it is off in English. A word start is still required, so "sto" does not find "nieistotna". The highlight covers the part both forms share (typing "żołądkiem" marks "żołąd" in "żołądek"). A single-character word next to a longer one is ignored (and not highlighted); a lone single character does nothing.

**Type words** are searched in the current language, so "vet visit", "wizyta", "deworming", "odrobaczanie", "frontline", "nails", "pazury", "symptom", "objaw", "note", "document", "pdf", "food", "supplement", "treat", "procedure" all work as text, not only as chips. A type word finds the events of that type and the item cards of that item kind.

| Field (data model) | Searched? | Reason |
|---|---|---|
| Event title (symptom name in the current language, clinic of a vet visit, note title, "Bath") | Yes | What the card is called |
| Event text (`detail`) | Yes | Where the household writes what happened |
| Event type word (EventType) | Yes | "vet visit", "deworming" must work as text; also lets Frontline and Deworming, which have no title, be found |
| Vet clinic (vet `title`) | Yes | The CEO's own example |
| Vet "also done" services, built-in (Anal glands, Nails) and own (as typed) | Yes | Shown on the card; "ear cleaning" is a real query |
| Symptom intensity and properties (consistency, colour, quantity, times, when) as shown on the card | Yes | "diarrhoea", "dark", "large" are what you remember; labels in the current language |
| Document names (PDF `name`) and the Documents kind | Yes | "ultrasound report" |
| Document size, page count | No | Technical; nobody remembers them |
| Photo caption and the photo event's text | Yes | "ruler", "about 1 cm" |
| Photo image, size, dimensions, `takenAt` | No | Not text; `takenAt` equals the event's day |
| Linked tracked conditions' names (on an event) | Yes | So "Lump A" finds its photos and notes |
| Condition name and description | Yes | A result of its own (Tracked card) |
| Condition start and resolved dates, open/resolved | No | Dates, see below; Tracked already lists open and resolved |
| Pinned note title and text | Yes | Standing facts ("allergies", "dose") |
| Item name (Arvelin, Farm Fresh) | Yes | Gives the item card, one tap to its history |
| Item kind word (food, medication…) | Yes | Same as event type words |
| Item flavours (turkey, salmon, chicken) | Yes | How the household tells foods apart; finds the item card |
| Entry note | Yes | Free text the household wrote |
| Entry state: Refused / skipped, Partly eaten (the app's label; "half" also finds it, shown as "Partly eaten · Half eaten") | Yes | "refused" is a likely question; finds those entries from anywhere |
| Entry state "Given" | No | True of almost every entry: it would list hundreds |
| Entry amount and unit ("½ pill", "0,15 ml") | **Only inside an item-kind filter or an item's history** | Searched there ("0,15" in Bellavet's history); globally "pill" or "ml" would match hundreds of entries and bury everything |
| Entry day part (Breakfast, Dinner…) | **Same: only with an item-kind filter or an item** | Same reason; "dinner" would match every dinner |
| Entry's own item name | Only through the item card, or with an item-kind filter | An entry is a result on its own only for a note or a refused/half-eaten state; otherwise the item card is the entry point |
| Usual day / schedule slots, "course day n of m", removed slots | No | A plan, not what happened; the history is the entries |
| Dates (14 Oct, 2026-10-14) | **No (question 1)** | Jump to date and the Calendar already do it; matching dates in two languages and formats is fragile. Every result shows its date. |
| Who logged it (`createdBy`, `updatedBy`) | No | Not shown anywhere in the app |
| Dog name, household, settings, day-part times | No | One dog; nothing to find |
| Ids, positions, `hiddenByDefault`, default unit, conversion | No | Internal |

## Highlighting (every kind of match)
Whatever matched is highlighted wherever it is shown, including the Polish stem-trimmed part ("Wizy" in "Wizyta", "Pazu" in "Pazury"): title, snippet, symptom properties, services, document names and the type label. A match on a **type word** needs the type label on screen to land on, so: a vet visit always shows "Vet visit · Maple Vet" (the label is highlighted); any other event shows the type muted after its title **only when the type word is why it matched** ("Heartburn · Symptom", "Bath · Other", "Lump A: cytology · Note"); a document match shows its chip as "Document PDF · Ultrasound report"; an item card shows its kind in its meta line ("Food · 45 entries"). A type that is the title already (Frontline, Deworming, Photo, Nail trimming) highlights in the title. The word "nails" also finds Nail trimming through a short alias, shown as "· Nails". **Build rule:** every text rendered from a result passes through the one highlighter; never highlight on the data and render separately. Entry rows in a list do not show the item kind, so a kind-word match there (e.g. "food" with Filters on) is not highlighted; the item card above carries it.

## Result list and tapping
Count line, then groups only when they match (**Items**, **Tracked**, **Pinned**), then **dated results newest first under month captions**. Events are the Day view's tappable card (the same `EventBadge`, date at the right, three-line snippet around the match, matched services, documents and condition tags, a 52 px photo thumbnail for photos); consecutive entries are rows in one card. Matches are highlighted (`mint-bg` behind `ink`). Tapping: event or entry opens its **day**, scrolls to it and rings it for about 2 s; **Back returns to Search with text, kinds and scroll**. Tracked opens the condition page; Pinned opens the existing note sheet; an item card opens the item's history. Idle, none, none-with-a-kind, "no entries of this kind", loading (skeletons) and error states are in the prototype. The text and kinds live in memory, never in the URL.

### Polish fit (checked at 390 px)
Navbar labels fit; the Filters button and summary line fit ("Wizyty u weta, Objawy +2"); the sheet fits ("Gruczoły odbytu", "Odrobaczanie", "Jedzenie, leki i zabiegi" as a caption); a mixed entry row wraps its date line instead of squeezing the amount or the "Odmowa" tag; "Nic nie znaleziono dla „…”" wraps to two lines; count plurals use one/few/many. The reviewed placeholder is cut off in English at 390 px, so the draft is "Search the log" / "Szukaj w dzienniku".

## Alternatives still open
| Question | Recommended | Alternative | Why not |
|---|---|---|---|
| Filter control | Filters button + one summary line + sheet | Chips in a scrolling row | Long with several on, and repeats the sheet |
| | | Sheet only, no summary line | You cannot see what is on without reopening it |
| Result order | One list by date, groups for non-dated things | Grouped by type | "When" is the question; the chips already give by-type |
| Entries | Rows in a card | A card per entry | 136 meals would be 136 cards |
| Matching | Word start, diacritics, Polish stem on both sides | Plain substring | "sto" finds "nieistotna" |

## For the PM
- **Fixed timeline geometry: nothing breaks.** No Timeline, Calendar or Matrix change; no new badge; the Timeline maths does not use the nav size. Only the navbar grid changes (4 to 5 columns).
- **Design system:** no change is made by this proposal. If approved, add in the build PR: `SearchField` (new, used once), `Search` and `Sliders` glyphs in `icons.tsx` (reuse the Timeline Filters glyph if it has one), a count pill on a button (one style, `mint-bg`/`mint-line`/`mint-deep`), and a one-line filter summary; the sheet is the existing Sheet and Chip. Everything else is reused (NavBar, Chip, Card, EventBadge, DoseMark, day-tag, cond-tag, PhotoThumb, Sheet, ghost Button, empty-state card). **No new tokens.**
- **Copy:** `docs/copy/copy-proposal-search.csv`, DRAFT pairs (S1 to S42; S42 is the empty item page; S16 is no longer used). Reused as they are: Search, Filters/Filtry, Vet visits, Symptoms, Notes, Photos, Other, Frontline, Deworming, Food, Medications, Treats, Tracked, Pinned, Loading…, Could not load, Try again, Since, entries, Refused, Half eaten, Back, Done, Clear. Check S21 and S22 against the vet-service labels in the app.
- **Engineering notes (not verified on a device):** all data is already in `LogProvider` records (events, entries, items, photos, documents, conditions, pinned), so search is client-side and instant; the log is about 3 entries a day per item, so even years of data is tens of thousands of rows; build the lowercase haystack once per reload, not per keystroke. Add a `/search` route without the query. Day Back must honour `fromApp` for a Day opened from Search. Pass "ring this card" via `history.state`. The prototype's `norm`, `starts`, `tokens`, `search` in `app.js` are the reference for matching and for which fields are scoped.
- **Prototype only:** a few fictional notes and events were added to the demo data so every kind has something to find (anal glands 22 Sep, nails 1 Oct, Bath 13 Oct as "Other", a PDF on a note, an Ear cleaning procedure item with 3 entries, flavours, two entry notes, symptom texts); the Polish column imagines notes written in Polish; page size is 6 (20 in the build); Day view, condition page and Pinned sheet are stand-ins for the built screens.

## Decided (CEO 23 Oct: build it; PM defaults for the points not answered one by one)
1. Dates are not searched as text (Jump to date and the Calendar exist). PM default.
2. Filters button, summary line and sheet instead of chips; "list all vet visits" is three taps. CEO.
3. Polish stem rule kept for all fields (revised in the build: stems on both sides, so every form finds every form). PM default.
4. Placeholder "Search the log" / "Szukaj w dzienniku" replaces the reviewed one (cut off in EN at 390 px). PM default.
5. Amounts and day parts are searched only inside an item or item kind. As designed.
