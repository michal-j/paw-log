# Pinned notes, Tracked conditions, photos (design proposal)

This is a proposal for the CEO. Nothing gets built until he approves it. Linear: "Design: Pinned notes, Tracked conditions, photos".

## How to open it
- `pinned-tracked-prototype.html` opens straight from disk.
  - The frame is 390x844.
  - On a wide screen, a **Flows** panel jumps to each state and switches EN/PL. On a phone, EN/PL is in **Menu**.
- The data is fictional, from `docs/PRODUCT.md`. Today is Thu 15 Oct. Changes reset when you reload.
- **The Timeline and the Day parts are the real app.** They are markup captured from the running demo (`npm run dev`, `/demo`, EN and PL) and use the app's own CSS. Only the new pieces are drawn by the prototype.
  - You can open 3, 10, 12, 14 and 15 Oct.
  - Food, Medication and Other are out of scope here.
- `screens/` has 30 screenshots, EN and PL.
- To rebuild after editing `src/`, run `npm run generate` once, then `python3 design/proposals/pinned-tracked/build.py`.

## Flows
1. **Navbar:** Timeline, Pinned, **+ Add**, Tracked, in four equal columns. Search stays out.
2. **Pinned** (`Przypięte notatki`). It uses the Usual day header: title, hint and a **+ New** button.
   - Notes are cards with an optional title, the text and "Edited 14 Oct". Tap a card to edit it in a sheet (Title optional, Note). The sheet has Delete and Save. Delete has no confirmation, only Undo, as elsewhere in the app.
   - **Reorder** turns on up/down buttons (36px visible, 44px target) and becomes **Done**. I chose buttons over drag handles because they work in an iPhone PWA, with VoiceOver and with one thumb. New notes go on top.
3. **Tracked** (`Śledzone sprawy`). The list has two sections: **Open** (newest start first) and **Resolved**.
   - Each card shows the name and "Since 3 Oct · 2 photos · 5 events", with the latest photo as a 52px thumbnail.
   - The **condition page** has, from top to bottom:
     - A caption ("Open · since 3 Oct" or "Resolved · 20 Sep – 30 Sep"), the name and the description. **Edit** is top right.
     - **Photos**: a strip with the oldest photo on the left, so time runs to the right. It ends with an **Add photo** tile and opens scrolled to the newest. **Compare ›** shows the first and the latest photo one above the other; each has steppers to pick another photo.
     - **History**: the linked events, newest first, grouped under date captions. **+ Add** is next to the caption.
     - At the end, **Mark as resolved** (opens a sheet with a "Resolved on" date) or **Reopen**. Both show a toast with Undo.
   - The Edit sheet has Name, Started on, Resolved on (only when resolved), Description and Delete. Deleting a condition keeps its events and photos in the log.
4. **Linking.**
   - Every event sheet (symptom, vet visit, note, photo) gets a **Tracked conditions** field with multi-select chips. Open conditions are shown first, and the chip "Resolved (1)" shows the resolved ones.
   - A **+ New** chip creates a condition inline, starting on the event's date.
   - From a condition page, **+ Add** opens the + Add sheet titled "Add to Lump A", with Photo, Symptom, Vet visit and Note. The new event comes back already linked.
5. **Photos.**
   - **+ Add → Photo** opens a sheet with one large "Take or choose a photo" tile. A plain `<input type="file" accept="image/*">` makes iPhone show its own menu (Photo Library, Take Photo, Choose File), so we need one button, not two. The prototype only mimics that system menu.
   - After picking, the sheet shows the preview (with **Change**), the date line and, when the photo has a date in it, "date from the photo". Then come Tracked conditions and Description (`Opis`).
   - Vet visits, symptoms and notes also get a **Photos** field (optional) with a small add tile.
   - **Viewer:**
     - It is full screen and **light** (light-only rule). It shows "2 of 3" and Close.
     - You swipe, use the arrow buttons or use the keyboard arrows.
     - Below the photo: the full date, the description, the condition tags, **Open day** and **Edit**.
     - Opened from a condition, it pages through that condition's photos. Opened from a day, it pages through that day's photos.
6. **Timeline and Day view.**
   - **The Timeline does not change.** A photo, standalone or attached to another event, shows only as the existing camera badge, at most one per day.
   - Linked conditions are not shown on the Timeline.
   - In the Day view:
     - The photo card shows its thumbnail(s) (72px) and description.
     - Any event card can carry condition tags (lavender, with a small target glyph). Tapping a tag opens the condition.
     - In the Symptoms card, the tags sit under their own row.
7. **Empty states.**
   - Pinned and Tracked use the existing empty-card pattern with one primary button. The header **New** is hidden while the list is empty, so there is only one "add" on screen.
   - A condition without photos shows the add tile with one line of text. A resolved one without photos hides the Photos section.
   - A condition with nothing linked says how to link.

## Fixed timeline geometry
Nothing changes: 44px rows, 28/44 bands, rail and columns are untouched. Two points to watch:
- **Badge count per row.** The Events column wraps at most two lines of 18px badges inside the 44px row.
  - At 390px it is about 108px wide, enough for vet, symptoms, photo and F on one line.
  - When more lanes are on (treats, Calmora), it can shrink to its 48px minimum. A day with all five kinds would then need three lines and overflow.
  - That risk exists today. Photos add at most one badge per day, because we never add one per photo or per condition.
- **Do not put condition marks on the Timeline** (colour stripes, extra badges) without re-deriving the scroll maths. If the CEO wants "show Lump A on the Timeline", the geometry-safe way is to dim rows that are not linked (opacity only), not to add marks. That is not in this proposal.

## Decisions for the CEO
1. **Word.** The reviewed copy says "Tracked issues / Śledzone sprawy". You call them conditions. I propose "Tracked conditions" in EN and keeping "Śledzone sprawy" in PL. The nav stays "Tracked / Śledzone".
2. **Navbar with four tabs:**
   - **+ Add** sits in column 3 of 4, not in the centre.
   - When Search comes back, it becomes five columns and + Add is centred again.
   - The alternative is to leave an empty fifth slot now, which looks broken.
3. **Light photo viewer:**
   - The rest of the app is light only, so the viewer is too.
   - Photos are usually viewed on black, so this is the one place a dark ground could be argued.
4. **Photo date:** use the date stored in the photo when picking from the library (recommended, because backfilling Lump A photos is common), or always use the day you are on.
5. **One photo per photo event:** the recommendation is to keep this simple for now and add several in a row. Choosing several at once from the library is a later step.
6. **Photos attached to a vet visit** belong to the visit's conditions.
   - If the visit is linked to Stomach trouble and Lump A, a lump photo would show in both photo strips.
   - Recommended: accept this. The alternative is a per-photo condition link, a second link table.
7. **Condition tag colour:** it reuses the photo badge tokens (lavender) so tags read as "tracked", not as the mint "also done" chips. Is lavender right, or should tags be mint?

## New components and tokens (need PM approval)
- **PhotoThumb:** a square photo at 52, 72 or 104px, with `radius-md` (`radius-lg` at 104), a `line` border and `shadow-card`.
- **PhotoStrip:** a horizontal scroller of PhotoThumbs with the date below each and an add tile at the end.
- **PhotoPick:** a dashed `line-strong` tile with a mint camera icon, in three sizes (full width, 104, 52). The dashed edge follows the existing `planned` DoseMark.
- **PhotoViewer** (with a Compare mode): a full-screen overlay on `ground`, with the bar in `surface-tint` and the info panel in `surface`. It reuses the 36px step buttons.
- **ConditionTag:** the Card chip shape in the `badge-photo-*` tokens, with a target glyph and a 44px hit area. A resolved condition uses the neutral `line-strong`/`ink-2`.
- **NavBar:** two new glyphs, Pin and Tracked (a target). Four columns.
- **Reused as they are:** Card, Sheet, Field, Chip (multi-select with `aria-pressed`), ghost and primary Button, the Usual day header, the Day view captions and `day__link`, the empty-card pattern, Toast with Undo.
- **No new tokens.**
- Thumbnail sizes are fixed px. If they repeat outside these screens, the PM may want size tokens.

## Data-model impact (for `docs/ENGINEERING.md`)
- **`pinned_note`:**
  - Columns: `id`, `dog_id`, `title` (text, null), `body` (text), `position` (int), and `created_by`, `updated_by`, `updated_at` set by triggers.
  - Reordering rewrites `position` for the moved pair.
  - It replaces the draft `pinned_note (dog, text, created_by)`.
- **`condition`** (renames the draft `issue`):
  - Columns: `id`, `dog_id`, `name`, `description`, `started_on` (date), `resolved_on` (date, null). Open means `resolved_on is null`, so reopening clears it. Plus `created_by`, `updated_by`, `updated_at`.
  - It replaces `event.issue_id`, which must go, because an event can now belong to several conditions.
- **`event_condition`** (link table):
  - Columns: `event_id`, `condition_id` and `dog_id`.
  - Primary key (`event_id`, `condition_id`).
  - Composite foreign keys with `dog_id` stop links across dogs or households, following the existing `entry` → `item` pattern.
  - Deleting an event or a condition deletes its links only.
- **`attachment`** (photos now, PDFs later):
  - Columns: `id`, `dog_id`, `event_id` (not null), `kind` (`photo`), `storage_path`, `width`, `height`, `taken_at` (null, from the photo's EXIF), `position`, `created_by`.
  - The caption stays on the event (`event.detail`) for a photo event. A per-attachment `caption` column is optional if photos on a vet visit need their own.
  - A standalone photo is an `event` of type `photo` with one attachment. So it has a date, shows the existing camera badge, and is linked to conditions through `event_condition`. One link table covers photos and events alike.
  - A condition's photo history is "attachments of events linked to it, ordered by event date".
- **Storage:**
  - A **private** Supabase bucket, with the path `household/{household_id}/dog/{dog_id}/{attachment_id}.jpg`.
  - RLS on `storage.objects` uses the same `private.can_access_dog` check. The client reads through short-lived signed URLs, never public URLs.
  - Resize on the phone before upload: a canvas to JPEG, longest side about 1600px, quality about 0.8, EXIF stripped except the date, which is read first. That makes each photo about 300 to 500 KB.
  - Also make a 320px thumbnail for strips and lists.
  - Demo mode keeps the bundled fictional images and stores added ones as data URLs in `localStorage`, with a size cap.
- **RLS:** the same household policies on `pinned_note`, `condition`, `event_condition` and `attachment` (select, insert, update, delete with USING and WITH CHECK).

## Copy
- `copy-proposal.csv` has 65 new EN/PL pairs, P1 to P65, all marked DRAFT. The reviewed CSV is unchanged.
- Reused reviewed strings are listed in `src/strings.json` with their reviewed number.
- iPhone system menu words are not ours and are not in the CSV.
- Note text and condition names are data and are shown as stored (the demo data is English), as in the app.
- **Polish fit:**
  - "Edytuj przypiętą notatkę" fits the sheet head on one line.
  - "Opróżnienie gruczołów odbytu" is a full-width chip, as in the app today.
  - The PL demo banner wraps to two lines, as in the app today.

## How this was checked
- 390x844, EN and PL, with the 30 screenshots in `screens/`.
- Clicked through in the browser:
  - + Add → Photo → iPhone menu → link Lump A → Save. The 15 Oct row gets the camera badge and stays 44px.
  - A photo added from the condition page. Then the viewer: swipe, arrows, Open day.
  - Compare. Resolve, then Undo, then Reopen.
  - Linking from the 14 Oct Vomit sheet, including creating a condition inline.
  - Pinned: reorder, delete then Undo, the empty-note error.
- No console errors.
- Touch targets: chips 36px with a 44px hit area, tags 24px with a 44px hit area, step buttons 36px with a 44px hit area, cards and rows 44px or more.
- Not checked: tablet and desktop widths of the real app (the new screens use the same 560px column as the Day view), and the Onest and Instrument Sans fonts (the app does not load them yet either).
