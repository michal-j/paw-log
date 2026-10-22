A PDF as a row (JCB-76). `FileRow` is one document; `FileList` is the hairline-divided list that holds them. Source: `src/documents/FileRow.tsx`, styles `src/documents/documents.css`.

A row is 56px high (its own tap target) with three parts: a 34 x 42px page tile with a folded corner and the word "PDF" (`surface` gradient, `line-strong` border, `shadow-badge`, `mint-deep` text); the name without ".pdf" (up to two lines, ink); and one meta line ("1,2 MB · 3 pages", or the size alone when the page count is not known; `ink-3`, decimal comma in both languages). Three modes:
- `card`: under the text and photos of an event in the Day view and in a condition's History; tapping opens the PDF in the phone's own viewer (trailing glyph: arrow out).
- `page`: in a condition's Documents section; the same, with the event's date at the right.
- `form`: in an event form; tapping opens the Document sheet (rename, open, remove). The meta line carries the upload state: a 4px progress bar (`line` track, `mint` fill) with "Sending… 62%", or "Not sent." in `danger` text with a Retry link.

Rules: red is never used for the row itself, only the failed text (red stays reserved for refused or skipped). At most 5 rows per event, 10 MB each. The PDF never opens in the app's own window (the installed iPhone app has no back button). Not used on the Timeline: there is no document badge (paperclip idea: JCB-131).
