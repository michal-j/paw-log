// Reading a picked PDF on the phone (JCB-76): is it one, and how many pages does it say it has.
// The page count is read only when it is cheap: a plain scan of the file's text for the page tree's
// /Count. A PDF that keeps its page tree compressed (object streams) simply has no count: never guessed.

export interface PdfInfo {
  /** null when the file does not show it plainly. */
  pageCount: number | null;
}

/** The file is not a readable PDF (no PDF header). */
export class NotPdfError extends Error {
  constructor() {
    super('not a PDF');
    this.name = 'NotPdfError';
  }
}

const HEADER = /%PDF-\d/;
const PAGES_TYPE = /\/Type\s*\/Pages\b/g;
const COUNT = /\/Count\s+(\d+)/;

/**
 * Pure part: the page count a PDF's text shows, or null. Looks at each page-tree node (an object with
 * /Type /Pages) for its /Count and takes the largest, which is the root's. Cheap: only the few
 * objects around those markers are looked at, never the whole file with a pattern.
 */
export function pageCountOf(text: string): number | null {
  let best = 0;
  for (const m of text.matchAll(PAGES_TYPE)) {
    const at = m.index;
    const from = Math.max(0, text.lastIndexOf('obj', at));
    const end = text.indexOf('endobj', at);
    const dict = text.slice(from, end < 0 ? at + 2000 : end);
    const n = Number(COUNT.exec(dict)?.[1]);
    if (Number.isFinite(n) && n > best) best = n;
  }
  return best >= 1 && best <= 100_000 ? best : null;
}

/** Reads a picked file: throws NotPdfError unless it starts like a PDF. */
export async function readPdf(file: Blob): Promise<PdfInfo> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  // The header sits within the first 1024 bytes.
  const head = new TextDecoder('latin1').decode(bytes.subarray(0, 1024));
  if (!HEADER.test(head)) throw new NotPdfError();
  return { pageCount: pageCountOf(new TextDecoder('latin1').decode(bytes)) };
}
