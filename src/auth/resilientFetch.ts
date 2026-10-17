/** How long one HTTP request to Supabase may run before it is aborted. */
export const REQUEST_TIMEOUT_MS = 10_000;

type VisibilitySource = Pick<Document, 'visibilityState' | 'addEventListener'>;

interface Running {
  /** The app was in the background (hidden) at some point while this request ran. */
  backgrounded: boolean;
  abort: (reason: DOMException) => void;
}

/**
 * A `fetch` for the Supabase client whose promise always settles (JCB-71).
 *
 * In the installed iPhone PWA, a request that is running when iOS suspends the app can stay pending
 * forever after the app comes back: no answer, no error. supabase-js then waits forever too. Worst
 * case is the token refresh: every later database call waits for that one refresh to finish, so
 * Save never sends anything and only restarting the app helps. This fetch:
 * - aborts a request after `timeoutMs`;
 * - when the app returns to the foreground, aborts every request that was running while it was in
 *   the background (its answer is presumed lost), so supabase-js retries at once instead of waiting;
 * - settles even when the underlying fetch ignores the abort.
 * An aborted request rejects with an AbortError, which supabase-js reports as an ordinary error.
 */
export function resilientFetch(
  base: typeof fetch = (input, init) => fetch(input, init),
  { timeoutMs = REQUEST_TIMEOUT_MS, doc = globalThis.document as VisibilitySource | undefined } = {},
): typeof fetch {
  const running = new Set<Running>();
  doc?.addEventListener('visibilitychange', () => {
    if (doc.visibilityState === 'hidden') {
      for (const r of running) r.backgrounded = true;
      return;
    }
    for (const r of [...running]) {
      if (r.backgrounded) r.abort(new DOMException('Request was running while the app was in the background.', 'AbortError'));
    }
  });

  return async (input, init) => {
    const controller = new AbortController();
    let stop!: (reason: DOMException) => void;
    const stopped = new Promise<never>((_, reject) => (stop = reject));
    const entry: Running = {
      backgrounded: doc?.visibilityState === 'hidden',
      abort: (reason) => {
        controller.abort(reason);
        stop(reason);
      },
    };
    const outer = init?.signal;
    const onOuterAbort = () => entry.abort(new DOMException('Request was aborted.', 'AbortError'));
    if (outer?.aborted) onOuterAbort();
    outer?.addEventListener('abort', onOuterAbort, { once: true });
    const timer = setTimeout(
      () => entry.abort(new DOMException(`No answer within ${timeoutMs / 1000} s.`, 'AbortError')),
      timeoutMs,
    );
    running.add(entry);
    try {
      return await Promise.race([base(input, { ...init, signal: controller.signal }), stopped]);
    } finally {
      clearTimeout(timer);
      running.delete(entry);
      outer?.removeEventListener('abort', onOuterAbort);
    }
  };
}
