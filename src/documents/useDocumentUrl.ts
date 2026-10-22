import { useEffect, useState } from 'react';
import type { DocFile, Repository } from '../data';
import { useLog } from '../log/LogProvider';

type Key = Pick<DocFile, 'id' | 'dogId'>;
interface Pending {
  doc: Key;
  resolve: (url: string | null) => void;
}

/**
 * Asks for document links in batches: every row on a screen asks in the same tick, so they share one
 * signing request. The repository keeps links while they are valid.
 */
class UrlLoader {
  private queue: Pending[] | null = null;

  constructor(private readonly repository: Repository) {}

  load(doc: Key): Promise<string | null> {
    return new Promise((resolve) => {
      if (this.queue) {
        this.queue.push({ doc, resolve });
        return;
      }
      this.queue = [{ doc, resolve }];
      setTimeout(() => void this.flush(), 0);
    });
  }

  private async flush() {
    const batch = this.queue ?? [];
    this.queue = null;
    let urls: Record<string, string> = {};
    try {
      urls = await this.repository.documentUrls(batch.map((b) => b.doc));
    } catch {
      /* offline or no answer: a tap asks again */
    }
    for (const b of batch) b.resolve(urls[b.doc.id] ?? null);
  }
}

const loaders = new WeakMap<Repository, UrlLoader>();
export function documentUrlLoader(repository: Repository): UrlLoader {
  let loader = loaders.get(repository);
  if (!loader) {
    loader = new UrlLoader(repository);
    loaders.set(repository, loader);
  }
  return loader;
}

/** A link made ahead of the tap is used for this long (signed links last 10 minutes). */
export const LINK_FRESH_MS = 5 * 60 * 1000;

export interface DocumentLink {
  url: string;
  /** When it was made (ms since epoch), to tell whether it is still fresh at the tap. */
  at: number;
}

/**
 * A link for a stored document, made ahead so that the tap can open it at once (iPhone lets a window
 * open only from the tap itself, not after waiting for a link). Made again after every reload of the
 * records. null while it loads or when it cannot be had; the tap then asks for one (see openPdf).
 */
export function useDocumentLink(doc: Key | null): DocumentLink | null {
  const { repository, version } = useLog();
  const [state, setState] = useState<{ key: string; link: DocumentLink | null } | null>(null);
  const key = doc ? `${doc.dogId}/${doc.id}` : '';
  const dogId = doc?.dogId;
  const id = doc?.id;
  useEffect(() => {
    if (!dogId || !id) return;
    let live = true;
    void documentUrlLoader(repository)
      .load({ id, dogId })
      .then((url) => {
        if (live) setState({ key: `${dogId}/${id}`, link: url ? { url, at: Date.now() } : null });
      });
    return () => {
      live = false;
    };
  }, [repository, dogId, id, version]);
  return state?.key === key ? state.link : null;
}
