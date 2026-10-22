# PDF on events and conditions (JCB-76, design proposal)

For the CEO. Nothing gets built until he approves it. Vet visits first, then tracked conditions. Same private storage and signed-URL approach as photos (JCB-7).

## How to open it
`index.html` opens straight from disk. 390x844 frame; on a wide screen a side panel jumps to each state, switches EN and PL, and has a switch "Uploads fail at 60%". Deep links: `#lang=pl&screen=failed` (names are in the panel's list). The data is fictional (docs/PRODUCT.md and `data/demo`), the PDFs do not exist: opening one shows a simulated iPhone viewer. Today is Thu 15 Oct.

## Recommendation (one option)
**A PDF is a row, not a thumbnail.** Name, one meta line (size, and page count only when it is known cheaply), tile with "PDF".
- **Day view card (vet visit):** the card keeps its text, photos and condition tags exactly as built. PDF rows sit under the text and photos, divided by hairlines, above the condition tags. A vet visit with photos AND PDFs: photos stay in the right column, rows take the full width below. Each row is its own 56px target; the card's open button still covers the rest.
- **Open:** one tap on a row opens the PDF in the iPhone's own PDF viewer (new context with a Done button, from the signed link). Share in that viewer covers Save to Files and Print, so there is no separate Download button. No in-app viewer.
- **Add, vet visit form:** a new **Documents** field under Photos: a ghost "Add PDF" button opens iPhone's Files browser (PDF only). The picked file appears as a row at once (name = file name without .pdf, size, pages if cheap). Note under the button: "PDF, up to 10 MB each, up to 5 for one entry."
- **Add, condition:** the condition page gets a **Documents** section between Photos and History (caption with count, "+ Add document" link, empty state with an Add PDF button). Add document opens a small sheet: choose a PDF, Name, Date (today), Save. It is saved as a **Note** on that date linked to the condition, with the PDF attached. So documents of a condition are the PDFs of its linked events, exactly how its photos work, and they also show in History and in the Day view.
- **Rename and remove:** tapping a row inside a form opens a **Document** sheet: Name, Open, Remove document, Save. Remove is immediate with the usual toast "Document removed" and Undo (8 s; the file is deleted when the toast ends, as for photos). A file picked but not saved yet is simply dropped.
- **Upload progress and failure:** files upload when the user taps Save (like photos), one row each with a 4px progress bar and "Sending… 62%"; Save shows "Saving…" and is disabled. If one fails: that row says "Not sent." with **Retry**, a field error says what to do, and nothing is saved until every upload succeeds (so there is never half an entry). Retry uploads to the same path.
- **Limits:** 10 MB per PDF and 5 per entry. A phone-scanned report is usually 1 to 5 MB; a 10 MB cap keeps a 1 GB storage plan to about 100 worst-case files (check the real plan). Too big: the file is not added and the error names it ("Scan 0042.pdf is 14 MB. The limit is 10 MB.").
- **Unknowns kept honest:** page count is read only when it is cheap (a plain scan of the PDF's page tree); if not, the meta line shows the size only. It is never guessed.

## Alternatives (not recommended)
| Question | Recommended | Alternative | Why not |
|---|---|---|---|
| How it shows in a card | Rows with name and size | One chip "2 documents" opening a sheet | Hides names; two taps to open a result at the vet |
| | | First-page thumbnails like photos | Needs a PDF renderer on the phone (heavy, slow); a thumbnail of a text page tells nothing |
| Opening | iPhone's own viewer | In-app viewer (PDF.js) | Big dependency, poor zoom and search compared with the system one |
| From a condition | Note with a PDF, linked | PDF attached to the condition directly | Needs a new link table, no date on the timeline, shows nowhere else |
| Upload time | On Save, like photos | Upload on pick | Leaves orphan files when the form is cancelled; the cleanup is extra work |

## Decisions needed from the CEO
1. **Documents from a condition are saved as a Note** (note badge on that day, nothing new on the Timeline). OK, or should a PDF attach to the condition itself?
2. **Limits:** 10 MB per PDF, 5 per entry. Right for your real reports?
3. **No Download button:** open in the iPhone viewer and use its Share (Save to Files). OK?
4. **Documents repeat** on the condition page (Documents section) and in History cards, like photos do. Keep both?
5. **Name:** the file name is the starting name, editable later. Show it without ".pdf" (the tile says PDF). OK?
6. **Sizes with a decimal comma** in both languages ("1,2 MB"), like the reviewed doses. OK?

## For the PM
- **New component (proposed, one name, three places):** `FileRow` (tile, name, meta, trailing glyph; with the progress bar and Retry states) inside `FileList` (hairline-divided rows). Used in the Day/History EventCard, the condition Documents section and the event forms. Add it to `docs/design-system/components` before the build. The Add PDF button is the existing ghost Button; the dashed pick tile is the existing `PhotoPick` look; the document sheet is the existing Sheet; the toast is the existing Toast.
- **No new tokens.** The tile uses `surface`, `line-strong`, `mint-deep`; the bar `line` and `mint`; errors `danger` text only (red stays reserved for refused or skipped).
- **Copy:** `docs/copy/copy-proposal-pdf.csv`, 30 pairs D1 to D30, all DRAFT. Reused as they are: Save, Close, Undo, Photos, Clinic, Notes, History, Back. The prototype also assumes Cancel, Saved and Date exist in the app: check the keys.
- **Fixed geometry: nothing breaks.** No new Timeline, Calendar or Matrix badge, so the 44px day rows, the 60px minimum Events column and `fitBadges` widths are untouched. (A "paperclip" badge would change those widths and the Key: not proposed.) Day view cards and the condition page have no fixed heights; each PDF row adds about 56px to a card, at most 5 per entry.
- **Optional, cheap:** Tracked list card meta "1 photo · 2 documents" (D28 to D30).
- **Engineering notes (not verified on a device):** `attachment.kind = 'pdf'` plus `name`, `size_bytes`, `page_count` (nullable); private bucket `documents` (PDF only, 10 MB), path `<dog_id>/<attachment_id>.pdf`, same policies and TTL as photos. On iPhone the signed link must be opened from the tap itself (`<a target="_blank" rel="noopener">` with a link made ahead, or open the window synchronously and set its address after): a link made after an await can be blocked as a pop-up. Never navigate the installed app's own window to the PDF (no back button, the user is stuck). Check on a real iPhone, standalone PWA, before the build.
- **Demo mode:** PDFs in the demo would be two bundled fictional files served with the app, like the photo drawings.
