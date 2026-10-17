import { useEffect, useState } from 'react';
import type { Photo, PhotoSize, Repository } from '../data';
import { useLog } from '../log/LogProvider';

type Key = Pick<Photo, 'id' | 'dogId'>;
interface Pending {
  photo: Key;
  resolve: (url: string | null) => void;
}

/**
 * Asks for photo URLs in batches: every thumbnail on a screen asks in the same tick, so they share
 * one signing request instead of one each. The repository keeps URLs while they are valid.
 */
class UrlLoader {
  private queue = new Map<PhotoSize, Pending[]>();

  constructor(private readonly repository: Repository) {}

  load(photo: Key, size: PhotoSize): Promise<string | null> {
    return new Promise((resolve) => {
      const list = this.queue.get(size);
      if (list) {
        list.push({ photo, resolve });
        return;
      }
      this.queue.set(size, [{ photo, resolve }]);
      setTimeout(() => void this.flush(size), 0);
    });
  }

  private async flush(size: PhotoSize) {
    const batch = this.queue.get(size) ?? [];
    this.queue.delete(size);
    let urls: Record<string, string> = {};
    try {
      urls = await this.repository.photoUrls(
        batch.map((b) => b.photo),
        size,
      );
    } catch {
      /* offline or no answer: the tiles stay empty; the next render asks again */
    }
    for (const b of batch) b.resolve(urls[b.photo.id] ?? null);
  }
}

const loaders = new WeakMap<Repository, UrlLoader>();
function loaderFor(repository: Repository): UrlLoader {
  let loader = loaders.get(repository);
  if (!loader) {
    loader = new UrlLoader(repository);
    loaders.set(repository, loader);
  }
  return loader;
}

/**
 * The URL to show a photo at (null while it loads or when it cannot be had). Asks again after every
 * reload of the records, which keeps a short-lived URL fresh without the screen noticing.
 */
export function usePhotoUrl(photo: Key | null, size: PhotoSize): string | null {
  const { repository, version } = useLog();
  const [state, setState] = useState<{ key: string; url: string | null } | null>(null);
  const key = photo ? `${photo.dogId}/${photo.id}/${size}` : '';
  const dogId = photo?.dogId;
  const id = photo?.id;
  useEffect(() => {
    if (!dogId || !id) return;
    let live = true;
    void loaderFor(repository)
      .load({ id, dogId }, size)
      .then((url) => {
        if (live) setState((s) => (s?.key === `${dogId}/${id}/${size}` && s.url === url ? s : { key: `${dogId}/${id}/${size}`, url }));
      });
    return () => {
      live = false;
    };
  }, [repository, dogId, id, size, version]);
  return state?.key === key ? state.url : null;
}
