// Opening a PDF (JCB-76). The signed link opens in the phone's own PDF viewer in a new browsing
// context, from the tap itself. It never replaces the app's own window: the installed iPhone app has
// no back button, so the user would be stuck on the PDF. iPhone blocks a window opened after the tap
// has been waiting for something (a pop-up), so:
// - a link made ahead and still fresh opens straight away;
// - otherwise the window is opened first, empty, in the tap, and pointed at the link when it arrives.
import { LINK_FRESH_MS, type DocumentLink } from './useDocumentUrl';

export interface OpenPdfOptions {
  /** A link made ahead of the tap, if there is one. */
  link: DocumentLink | null;
  /** Asks for a new link (a signing request); null when it cannot be made. */
  load: () => Promise<string | null>;
  /** The document could not be opened: say so. */
  onFail: () => void;
  now?: number;
  win?: Pick<Window, 'open'>;
}

/** Call this directly from the tap's handler, before any await. */
export function openPdf({ link, load, onFail, now = Date.now(), win = window }: OpenPdfOptions): void {
  if (link && now - link.at < LINK_FRESH_MS) {
    win.open(link.url, '_blank', 'noopener');
    return;
  }
  const target = win.open('', '_blank');
  if (!target) {
    // Pop-ups are blocked: nothing can open from here.
    onFail();
    return;
  }
  try {
    target.opener = null;
  } catch {
    /* read-only in some browsers */
  }
  load().then(
    (url) => {
      if (url) target.location.href = url;
      else {
        target.close();
        onFail();
      }
    },
    () => {
      target.close();
      onFail();
    },
  );
}
