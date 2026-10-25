import { noteRequest, type Outcome } from '../diag/requestLog';
import { probeStall } from '../diag/probe';

/** How long one HTTP request to Supabase may run before it is aborted. */
export const REQUEST_TIMEOUT_MS = 10_000;
/**
 * A write with no answer after this long is presumed stuck and sent again (JCB-71). A healthy write
 * answers in well under a second, even on mobile data.
 */
export const WRITE_STALL_MS = 2_500;
/** The limit for that second try. Both together (5.5 s) stay under the 6 s limit of a repository write (JCB-74). */
export const WRITE_RETRY_MS = 3_000;

type VisibilitySource = Pick<Document, 'visibilityState' | 'addEventListener'>;
type Why = 'timeout' | 'background' | 'aborted';

interface Running {
  /** The app was in the background (hidden) at some point while this request ran. */
  backgrounded: boolean;
  abort: (reason: Stopped) => void;
}

interface Options {
  timeoutMs?: number;
  stallMs?: number;
  retryMs?: number;
  doc?: VisibilitySource;
  /** Notes each attempt for the on-device request log (src/diag/requestLog.ts). */
  log?: typeof noteRequest;
  /** Called with the URL of a request that got no answer: checks which hosts still answer (src/diag/probe.ts). */
  probe?: (url: string) => void;
}

/** Why an attempt ended without an answer, carried on its error. */
class Stopped extends DOMException {
  constructor(
    message: string,
    readonly why: Why,
  ) {
    super(message, 'AbortError');
  }
}

const urlOf = (input: RequestInfo | URL): string | null =>
  typeof input === 'string' ? input : input instanceof URL ? input.href : null;

/**
 * Writes to the database (PostgREST) can be sent a second time: every write the app makes is an
 * upsert by id, a delete by id, an update to a fixed value or an upsert-like function, so sending one
 * twice leaves the same result. Auth calls are never repeated (a refresh token is single-use), nor
 * storage calls, nor requests whose body cannot be sent again.
 */
function retryable(input: RequestInfo | URL, init: RequestInit | undefined): boolean {
  const url = urlOf(input);
  const method = (init?.method ?? 'GET').toUpperCase();
  if (!url || method === 'GET' || method === 'HEAD') return false;
  const body = init?.body;
  if (body != null && typeof body !== 'string') return false;
  try {
    return new URL(url, 'http://local.invalid').pathname.includes('/rest/v1/');
  } catch {
    return false;
  }
}

/**
 * A `fetch` for the Supabase client whose promise always settles, and whose writes recover from a
 * stuck connection (JCB-71).
 *
 * In the installed iPhone PWA, a request can stay pending forever: no answer, no error, and it never
 * reaches the server. This fetch:
 * - aborts a request after `timeoutMs`;
 * - when the app returns to the foreground, aborts every request that was running while it was in
 *   the background (its answer is presumed lost);
 * - settles even when the underlying fetch ignores the abort;
 * - sends a database write that got no answer within `stallMs` (or was lost in the background, or
 *   failed at the network level) once more, at once, as a new request with high priority and
 *   nothing reused from the first one, limited to `retryMs`. See `retryable` for why that is safe.
 * Every attempt is noted in the on-device request log.
 */
export function resilientFetch(
  base: typeof fetch = (input, init) => fetch(input, init),
  {
    timeoutMs = REQUEST_TIMEOUT_MS,
    stallMs = WRITE_STALL_MS,
    retryMs = WRITE_RETRY_MS,
    doc = globalThis.document as VisibilitySource | undefined,
    log = noteRequest,
    probe = probeStall,
  }: Options = {},
): typeof fetch {
  const running = new Set<Running>();
  doc?.addEventListener('visibilitychange', () => {
    if (doc.visibilityState === 'hidden') {
      for (const r of running) r.backgrounded = true;
      return;
    }
    for (const r of [...running]) {
      if (r.backgrounded) r.abort(new Stopped('Request was running while the app was in the background.', 'background'));
    }
  });

  const attempt = async (input: RequestInfo | URL, init: RequestInit | undefined, limitMs: number, n: number): Promise<Response> => {
    const controller = new AbortController();
    let stop!: (reason: DOMException) => void;
    const stopped = new Promise<never>((_, reject) => (stop = reject));
    const done = log((init?.method ?? 'GET').toUpperCase(), urlOf(input) ?? '', n);
    const entry: Running = {
      backgrounded: doc?.visibilityState === 'hidden',
      abort: (reason) => {
        controller.abort(reason);
        stop(reason);
      },
    };
    const outer = init?.signal;
    const onOuterAbort = () => entry.abort(new Stopped('Request was aborted.', 'aborted'));
    if (outer?.aborted) onOuterAbort();
    outer?.addEventListener('abort', onOuterAbort, { once: true });
    const timer = setTimeout(
      () => entry.abort(new Stopped(`No answer within ${limitMs / 1000} s.`, 'timeout')),
      limitMs,
    );
    running.add(entry);
    try {
      const response = await Promise.race([base(input, { ...init, signal: controller.signal }), stopped]);
      done(response.status);
      return response;
    } catch (err) {
      done(err instanceof Stopped ? err.why : ('network' satisfies Outcome));
      if (err instanceof Stopped && err.why === 'timeout') probe(urlOf(input) ?? '');
      throw err;
    } finally {
      clearTimeout(timer);
      running.delete(entry);
      outer?.removeEventListener('abort', onOuterAbort);
    }
  };

  return async (input, init) => {
    if (!retryable(input, init)) return attempt(input, init, timeoutMs, 1);
    try {
      return await attempt(input, init, Math.min(stallMs, timeoutMs), 1);
    } catch (err) {
      // The caller gave up: nothing to retry. Anything else (stuck, lost in the background, a network
      // error) may mean the request never left the phone, so try once more.
      if (err instanceof Stopped && err.why === 'aborted') throw err;
      if (init?.signal?.aborted) throw err;
      // A new request that shares nothing with the stuck one: its own abort signal, never answered
      // from or kept for a cache, not held back for page unload, and ahead of any reads on the same
      // connection (Safari shares one connection per host among all requests).
      return attempt(input, { ...init, cache: 'no-store', keepalive: false, priority: 'high' }, retryMs, 2);
    }
  };
}
