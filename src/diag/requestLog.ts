/**
 * On-device activity log (JCB-71): every request to Supabase with method, table, start, duration and
 * outcome, every tap on a control (by its label, see taps.ts), every toast, and the app going to the
 * background and back, so a stalled save can be traced on the iPhone and sent to the developer.
 * Always on in the real app and visible in the Menu; remove it together with the JCB-71 fix.
 *
 * Never stored: bodies, query strings, ids, storage paths, headers, tokens, or any text that is not
 * one of the app's own interface strings. A request is described only by its method and the table,
 * function or service it went to.
 */

import { describeTap } from './taps';

const LOG_KEY = 'pawlog.diag.log';
/** Rows kept (newest), and for how long: the log must stay small enough for localStorage. */
export const DIAG_MAX_ROWS = 3000;
export const DIAG_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const PERSIST_MS = 500;

export type AppEvent = 'start' | 'hidden' | 'visible' | 'online' | 'offline';
/** How a request ended: an HTTP status, or why there was none. */
export type Outcome = number | 'timeout' | 'background' | 'aborted' | 'network';

export type DiagRow =
  | { kind: 'app'; n: number; at: number; event: AppEvent }
  /** A tap or a toast, described by `describeTap` (interface strings only). */
  | { kind: 'action'; n: number; at: number; text: string }
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

let persistTimer: ReturnType<typeof setTimeout> | null = null;

function writeNow() {
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = null;
  try {
    storage()?.setItem(LOG_KEY, JSON.stringify(rows));
  } catch {
    /* full or blocked: the log stays in memory */
  }
}

/** Writes soon, not on every row: a busy screen makes dozens of rows within a second. */
function persist() {
  if (!started || persistTimer) return;
  persistTimer = setTimeout(writeNow, PERSIST_MS);
}

function emit() {
  for (const l of listeners) l();
}

function push(row: DiagRow) {
  rows = [...rows, row].slice(-DIAG_MAX_ROWS);
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
  writeNow();
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

/** A tap or a toast (see taps.ts); ignored until `startDiag`, so demo mode keeps nothing. */
export function noteAction(text: string): void {
  if (started) push({ kind: 'action', n: ++seq, at: Date.now(), text });
}

let started = false;
/**
 * Restores the log kept from before a restart (dropping rows older than a week), marks the start,
 * and follows taps, background/foreground and online/offline.
 */
export function startDiag(win: Window = window): void {
  if (started) return;
  try {
    const kept = JSON.parse(storage()?.getItem(LOG_KEY) ?? '[]') as DiagRow[];
    if (Array.isArray(kept)) {
      const from = Date.now() - DIAG_MAX_AGE_MS;
      rows = kept.filter((r) => r.at >= from).slice(-DIAG_MAX_ROWS);
      seq = rows.reduce((m, r) => Math.max(m, r.n), 0);
    }
  } catch {
    /* unreadable: start empty */
  }
  started = true;
  noteApp('start');
  win.document.addEventListener(
    'click',
    (e) => {
      noteAction(describeTap(e.target as Element | null, win.location.pathname));
    },
    true,
  );
  win.document.addEventListener('visibilitychange', () => {
    noteApp(win.document.visibilityState === 'hidden' ? 'hidden' : 'visible');
    if (win.document.visibilityState === 'hidden') writeNow();
  });
  win.addEventListener('pagehide', writeNow);
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
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = null;
}
