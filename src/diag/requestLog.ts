/**
 * On-device request log (JCB-71): the last requests to Supabase with method, table, start, duration
 * and outcome, plus the app going to the background and back, so a stalled save can be traced on the
 * iPhone and sent to the developer. Hidden unless switched on (`?diag=1` in the address bar, or five
 * quick taps on the Menu heading in the installed app); `?diag=0` or the same taps switch it off.
 *
 * Never stored: bodies, query strings, ids, storage paths, headers or tokens. A request is described
 * only by its method and the table, function or service it went to.
 */

export const DIAG_FLAG_KEY = 'pawlog.diag';
const LOG_KEY = 'pawlog.diag.log';
export const DIAG_ROWS = 30;

export type AppEvent = 'start' | 'hidden' | 'visible' | 'online' | 'offline';
/** How a request ended: an HTTP status, or why there was none. */
export type Outcome = number | 'timeout' | 'background' | 'aborted' | 'network';

export type DiagRow =
  | { kind: 'app'; n: number; at: number; event: AppEvent }
  | {
      kind: 'request';
      n: number;
      at: number;
      method: string;
      /** `event`, `rpc restore_pinned_note`, `auth token`, `storage`: never an id or a path. */
      what: string;
      /** 2 for the retry of a stalled write. */
      attempt: number;
      ms?: number;
      outcome?: Outcome;
      /** The protocol of the latest finished request to the same host (h2, h3, http/1.1), when the browser says. */
      via?: string;
    };

type Listener = () => void;

let rows: DiagRow[] = [];
let seq = 0;
let host: string | null = null;
let lastProtocol = '';
const listeners = new Set<Listener>();

function storage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export function diagEnabled(): boolean {
  try {
    return storage()?.getItem(DIAG_FLAG_KEY) === '1';
  } catch {
    return false;
  }
}

export function setDiagEnabled(on: boolean): void {
  try {
    if (on) {
      storage()?.setItem(DIAG_FLAG_KEY, '1');
      persist();
    } else {
      storage()?.removeItem(DIAG_FLAG_KEY);
      storage()?.removeItem(LOG_KEY);
    }
  } catch {
    /* private mode: the flag lasts for this page only */
  }
  emit();
}

/** `?diag=1` switches the log on, `?diag=0` off; anything else leaves it as it was. */
export function applyDiagFlag(search: string): void {
  const value = new URLSearchParams(search).get('diag');
  if (value === '1') setDiagEnabled(true);
  else if (value === '0') setDiagEnabled(false);
}

function persist() {
  if (!diagEnabled()) return;
  try {
    storage()?.setItem(LOG_KEY, JSON.stringify(rows));
  } catch {
    /* full or blocked: the log stays in memory */
  }
}

function emit() {
  for (const l of listeners) l();
}

function push(row: DiagRow) {
  rows = [...rows, row].slice(-DIAG_ROWS);
  persist();
  emit();
}

export function diagRows(): readonly DiagRow[] {
  return rows;
}

export function subscribeDiag(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function clearDiag(): void {
  rows = [];
  persist();
  emit();
}

/**
 * What a Supabase URL is about, without anything that could identify a record: the table for
 * PostgREST, the function for an RPC, the endpoint for auth, and only "storage" for files.
 */
export function describeRequest(url: string): string {
  let path: string;
  try {
    path = new URL(url, 'http://local.invalid').pathname;
  } catch {
    return 'other';
  }
  const parts = path.split('/').filter(Boolean);
  const safe = (s: string | undefined) => (s && /^[a-z_]{1,40}$/.test(s) ? s : '?');
  if (parts[0] === 'rest' && parts[2] === 'rpc') return `rpc ${safe(parts[3])}`;
  if (parts[0] === 'rest') return safe(parts[2]);
  if (parts[0] === 'auth') return `auth ${safe(parts[2])}`;
  if (parts[0] === 'storage') return 'storage';
  return 'other';
}

function hostOf(url: string): string | null {
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
}

/** Remembers which protocol the browser used for the Supabase host (Resource Timing; empty when not exposed). */
function watchProtocol(h: string) {
  if (host) return;
  host = h;
  try {
    new PerformanceObserver((list) => {
      for (const e of list.getEntries() as PerformanceResourceTiming[]) {
        if (e.nextHopProtocol && hostOf(e.name) === host) lastProtocol = e.nextHopProtocol;
      }
    }).observe({ type: 'resource', buffered: true });
  } catch {
    /* no PerformanceObserver (tests, old browsers) */
  }
}

/** Notes a request; call the returned function once with how it ended. */
export function noteRequest(method: string, url: string, attempt = 1): (outcome: Outcome) => void {
  const h = hostOf(url);
  if (h) watchProtocol(h);
  const n = ++seq;
  const at = Date.now();
  const started = performance.now();
  push({ kind: 'request', n, at, method: method.toUpperCase(), what: describeRequest(url), attempt });
  let done = false;
  return (outcome) => {
    if (done) return;
    done = true;
    const ms = Math.round(performance.now() - started);
    rows = rows.map((r) => (r.n === n && r.kind === 'request' ? { ...r, ms, outcome, via: lastProtocol || undefined } : r));
    persist();
    emit();
  };
}

export function noteApp(event: AppEvent): void {
  push({ kind: 'app', n: ++seq, at: Date.now(), event });
}

let started = false;
/** Restores the log kept from before a restart, marks the start, and follows background/foreground and online/offline. */
export function startDiag(win: Window = window): void {
  if (started) return;
  started = true;
  applyDiagFlag(win.location.search);
  if (diagEnabled()) {
    try {
      const kept = JSON.parse(storage()?.getItem(LOG_KEY) ?? '[]') as DiagRow[];
      if (Array.isArray(kept)) {
        rows = kept.slice(-DIAG_ROWS);
        seq = rows.reduce((m, r) => Math.max(m, r.n), 0);
      }
    } catch {
      /* unreadable: start empty */
    }
  }
  noteApp('start');
  win.document.addEventListener('visibilitychange', () => noteApp(win.document.visibilityState === 'hidden' ? 'hidden' : 'visible'));
  win.addEventListener('online', () => noteApp('online'));
  win.addEventListener('offline', () => noteApp('offline'));
}

/** For tests: forget everything. */
export function resetDiagForTests(): void {
  rows = [];
  seq = 0;
  host = null;
  lastProtocol = '';
  started = false;
}
