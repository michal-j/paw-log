// A fake Supabase backend for tests and the dev harness (JCB-43): the real supabase-js client and
// the real SupabaseRepository talk to it through a custom `fetch`, and it answers like PostgREST
// would, on a real Postgres (PGlite, WASM) with every migration in supabase/migrations applied,
// row-level security on and the request's user as `auth.uid()`.
//
// Covered: GET with select, eq/neq/gt/gte/lt/lte/is/in filters, or=(...), order, limit/offset;
// POST insert and upsert (resolution=merge-duplicates / ignore-duplicates, on_conflict, columns),
// return=representation; PATCH; DELETE. Errors come back as PostgREST error bodies with the
// Postgres code (23505 unique violation → 409, 42501 → 403, other constraint errors → 400).
// Auth: only the token refresh (POST /auth/v1/token), answering a new session for the seed user
// (JCB-71); the harness signs in with a fake AuthService. Not covered: embedded resources, RPC.
//
// Nothing here ever reaches a network: the fetch never calls the real one. All data is fictional.
import { PGlite } from '@electric-sql/pglite';
import stubSql from '../db/supabase-stub.sql?raw';

const migrationFiles = import.meta.glob('../../supabase/migrations/*.sql', { query: '?raw', import: 'default', eager: true }) as Record<
  string,
  string
>;

export const FAKE_URL = 'https://fake-project.supabase.test';
export const FAKE_ANON_KEY = 'fake-anon-key-for-tests';

/** Fictional ids of the seeded household. */
export const SEED = {
  user: '00000000-0000-4000-8000-0000000000a1',
  otherUser: '00000000-0000-4000-8000-0000000000a2',
  household: '10000000-0000-4000-8000-00000000000a',
  dog: '20000000-0000-4000-8000-00000000000a',
  items: {
    cooked: '30000000-0000-4000-8000-000000000001',
    farm: '30000000-0000-4000-8000-000000000002',
    arvelin: '30000000-0000-4000-8000-000000000003',
    bellavet: '30000000-0000-4000-8000-000000000004',
    treat: '30000000-0000-4000-8000-000000000005',
  },
} as const;

export interface RequestLog {
  method: string;
  table: string;
  status: number;
  query: string;
}

export interface FakeBackend {
  /** Pass as `global.fetch` to createClient. */
  fetch: typeof fetch;
  db: PGlite;
  /** Every request answered, in order. */
  log: RequestLog[];
  /** Run SQL as the postgres role (bypasses RLS), for fixtures and checks. */
  sql<T = Record<string, unknown>>(query: string, params?: unknown[]): Promise<T[]>;
  /** Make the next `n` requests fail like a network error (offline). */
  failNext(n: number): void;
  /**
   * Hold the next `n` requests (those `which` picks; default all): they get no answer and ignore
   * aborts, like a request iOS lost while the PWA was in the background (JCB-71), until `release()`
   * lets them through. Then they run as usual: the server did get them, the app just never heard back.
   */
  hangNext(n: number, which?: (method: string, path: string) => boolean): void;
  /** Let every held request through. */
  release(): void;
  /** Delay every answer by `ms`, so requests can overlap and land out of order. */
  setLatency(ms: number | ((method: string, table: string) => number)): void;
  close(): Promise<void>;
}

const IDENT = /^[a-z_][a-z0-9_]*$/;
const q = (name: string) => {
  if (!IDENT.test(name)) throw new HttpError(400, 'PGRST100', `bad identifier "${name}"`);
  return `"${name}"`;
};

class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

/** Apply the stub and every migration in file-name order (as `supabase db push` would). */
async function migrate(db: PGlite) {
  await db.exec(stubSql);
  for (const file of Object.keys(migrationFiles).sort()) await db.exec(migrationFiles[file] as string);
}

/**
 * A household like the one the bootstrap SQL creates: two members, a dog, a few fictional items and
 * a usual day starting `start`. Day-part times stay at the app defaults.
 */
export async function seedHousehold(db: PGlite, start: string) {
  const i = SEED.items;
  await db.exec(`
    insert into auth.users (id, email) values ('${SEED.user}', 'one@example.test'), ('${SEED.otherUser}', 'two@example.test');
    insert into public.household (id, name) values ('${SEED.household}', 'Test household');
    insert into public.member (household_id, user_id) values ('${SEED.household}', '${SEED.user}'), ('${SEED.household}', '${SEED.otherUser}');
    insert into public.dog (id, household_id, name) values ('${SEED.dog}', '${SEED.household}', 'Pip');
    insert into public.item (id, dog_id, kind, name, colour, default_day_part, active_from, hidden_by_default, position, default_unit, flavours, conversion_unit, conversion_size) values
      ('${i.cooked}', '${SEED.dog}', 'food', 'Cooked meal', 'food-cooked', 2, '${start}', false, 10, 'tray', '{}', null, null),
      ('${i.farm}', '${SEED.dog}', 'food', 'Farm Fresh', 'food-farm', 4, '${start}', false, 20, 'can', '{turkey,salmon}', null, null),
      ('${i.arvelin}', '${SEED.dog}', 'medication', 'Arvelin', 'med-arvelin', 2, '${start}', false, 30, 'pill', '{}', null, null),
      ('${i.bellavet}', '${SEED.dog}', 'medication', 'Bellavet', 'med-bellavet', 4, '${start}', false, 40, 'ml', '{}', 'bars', 0.1),
      ('${i.treat}', '${SEED.dog}', 'treat', 'Treat', 'treat', 6, '${start}', true, 90, 'piece', '{}', null, null);
    insert into public.schedule_slot (dog_id, item_id, day_part, flavour, amount, unit, active_from, position)
      select dog_id, id, default_day_part, '', case when default_unit = 'ml' then 0.15 else 1 end, default_unit, active_from, position
      from public.item where dog_id = '${SEED.dog}' and kind <> 'treat';
  `);
}

/** Split `a,b,(c,d)` at top-level commas. */
function splitTop(s: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = '';
  let quoted = false;
  for (const ch of s) {
    if (ch === '"') quoted = !quoted;
    if (!quoted && ch === '(') depth++;
    if (!quoted && ch === ')') depth--;
    if (!quoted && depth === 0 && ch === ',') {
      out.push(cur);
      cur = '';
    } else cur += ch;
  }
  if (cur) out.push(cur);
  return out;
}

const unquote = (s: string) => (s.startsWith('"') && s.endsWith('"') ? s.slice(1, -1) : s);

/** One PostgREST filter (`op.value`) on `col`, as SQL with $n parameters. */
function filterSql(col: string, expr: string, params: unknown[], prefix = ''): string {
  const dot = expr.indexOf('.');
  let op = expr.slice(0, dot);
  let value = expr.slice(dot + 1);
  let not = false;
  if (op === 'not') {
    not = true;
    const d2 = value.indexOf('.');
    op = value.slice(0, d2);
    value = value.slice(d2 + 1);
  }
  const c = prefix + q(col);
  const p = (v: unknown) => {
    params.push(v);
    return `$${params.length}`;
  };
  let sql: string;
  switch (op) {
    case 'eq':
      sql = `${c} = ${p(value)}`;
      break;
    case 'neq':
      sql = `${c} <> ${p(value)}`;
      break;
    case 'gt':
      sql = `${c} > ${p(value)}`;
      break;
    case 'gte':
      sql = `${c} >= ${p(value)}`;
      break;
    case 'lt':
      sql = `${c} < ${p(value)}`;
      break;
    case 'lte':
      sql = `${c} <= ${p(value)}`;
      break;
    case 'is':
      if (!['null', 'true', 'false'].includes(value)) throw new HttpError(400, 'PGRST100', `bad is.${value}`);
      sql = `${c} is ${value}`;
      break;
    case 'in': {
      const list = splitTop(value.replace(/^\(|\)$/g, '')).map(unquote);
      sql = list.length ? `${c} in (${list.map((v) => p(v)).join(', ')})` : 'false';
      break;
    }
    default:
      throw new HttpError(400, 'PGRST100', `operator ${op} not supported by the fake`);
  }
  return not ? `not (${sql})` : sql;
}

const RESERVED = new Set(['select', 'order', 'limit', 'offset', 'on_conflict', 'columns', 'or', 'and']);

function whereSql(params: URLSearchParams, values: unknown[], prefix = ''): string {
  const parts: string[] = [];
  for (const [key, val] of params) {
    if (key === 'or' || key === 'and') {
      const inner = splitTop(val.replace(/^\(|\)$/g, '')).map((cond) => {
        const d = cond.indexOf('.');
        return filterSql(cond.slice(0, d), cond.slice(d + 1), values, prefix);
      });
      parts.push(`(${inner.join(key === 'or' ? ' or ' : ' and ')})`);
    } else if (!RESERVED.has(key)) {
      parts.push(filterSql(key, val, values, prefix));
    }
  }
  return parts.length ? ` where ${parts.join(' and ')}` : '';
}

function selectList(params: URLSearchParams, prefix = ''): string {
  const sel = params.get('select') ?? '*';
  if (sel === '*') return `${prefix}*`;
  return sel
    .split(',')
    .map((c) => prefix + q(c.trim()))
    .join(', ');
}

function orderSql(params: URLSearchParams): string {
  const o = params.get('order');
  if (!o) return '';
  const terms = o.split(',').map((term) => {
    const [col = '', dir = 'asc', nulls] = term.split('.');
    const d = dir === 'desc' ? 'desc' : 'asc';
    const n = nulls === 'nullsfirst' ? ' nulls first' : nulls === 'nullslast' ? ' nulls last' : '';
    return `${q(col)} ${d}${n}`;
  });
  return ` order by ${terms.join(', ')}`;
}

function preferOf(headers: Headers) {
  const all = (headers.get('Prefer') ?? '').split(/,\s*/);
  return {
    representation: all.includes('return=representation'),
    merge: all.includes('resolution=merge-duplicates'),
    ignore: all.includes('resolution=ignore-duplicates'),
    missingDefault: all.includes('missing=default'),
  };
}

async function primaryKey(db: PGlite, table: string): Promise<string[]> {
  const res = await db.query<{ col: string }>(
    `select a.attname as col from pg_index i join pg_attribute a on a.attrelid = i.indrelid and a.attnum = any(i.indkey)
     where i.indrelid = $1::regclass and i.indisprimary order by array_position(i.indkey, a.attnum)`,
    [`public.${table}`],
  );
  return res.rows.map((r) => r.col);
}

function statusOf(code: string | undefined): number {
  if (code === '23505' || code === '23503') return 409;
  if (code === '42501') return 403;
  if (code === '42P01') return 404;
  return 400;
}

export async function createFakeBackend(options: { start?: string; seed?: boolean; userId?: string } = {}): Promise<FakeBackend> {
  const db = new PGlite();
  await migrate(db);
  if (options.seed !== false) await seedHousehold(db, options.start ?? '2026-10-01');
  const userId = options.userId ?? SEED.user;
  const log: RequestLog[] = [];
  let failures = 0;
  let hangs = 0;
  let hangWhich: (method: string, path: string) => boolean = () => true;
  const held: (() => void)[] = [];
  let latency: (method: string, table: string) => number = () => 0;

  async function asUser<T>(work: (tx: Pick<PGlite, 'query' | 'exec'>) => Promise<T>): Promise<T> {
    return db.transaction(async (tx) => {
      await tx.exec('set local role authenticated');
      await tx.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: userId, role: 'authenticated' })]);
      return work(tx);
    });
  }

  async function answer(method: string, table: string, params: URLSearchParams, headers: Headers, body: unknown): Promise<[number, string]> {
    const t = `public.${q(table)}`;
    const values: unknown[] = [];
    const prefer = preferOf(headers);
    const returning = prefer.representation ? ` returning ${selectList(params)}` : '';
    const wrap = (stmt: string) => `with r as (${stmt}) select coalesce(json_agg(r), '[]'::json)::text as json from r`;
    if (method === 'GET') {
      const limit = params.get('limit');
      const offset = params.get('offset');
      const stmt =
        `select ${selectList(params)} from ${t}${whereSql(params, values)}${orderSql(params)}` +
        (limit ? ` limit ${Number(limit)}` : '') +
        (offset ? ` offset ${Number(offset)}` : '');
      const res = await asUser((tx) => tx.query<{ json: string }>(wrap(stmt), values));
      return [200, res.rows[0]?.json ?? '[]'];
    }
    if (method === 'POST') {
      const rows = Array.isArray(body) ? body : [body];
      const listed = params.get('columns');
      const cols = listed ? splitTop(listed).map(unquote) : Object.keys((rows[0] ?? {}) as object);
      cols.forEach(q);
      values.push(JSON.stringify(rows));
      const colList = cols.map(q).join(', ');
      let stmt = `insert into ${t} (${colList}) select ${colList} from json_populate_recordset(null::${t}, $1::json)`;
      if (prefer.merge || prefer.ignore) {
        const target = params.get('on_conflict')?.split(',') ?? (await primaryKey(db, table));
        const conflict = ` on conflict (${target.map(q).join(', ')})`;
        stmt += prefer.ignore
          ? `${conflict} do nothing`
          : `${conflict} do update set ${cols.map((c) => `${q(c)} = excluded.${q(c)}`).join(', ')}`;
      }
      const res = await asUser((tx) => tx.query<{ json: string }>(wrap(stmt + (returning || ' returning 1')), values));
      return [201, prefer.representation ? (res.rows[0]?.json ?? '[]') : ''];
    }
    if (method === 'PATCH') {
      values.push(JSON.stringify(body));
      const cols = Object.keys(body as object);
      const sets = cols.map((c) => `${q(c)} = p.${q(c)}`).join(', ');
      const stmt = `update ${t} as t0 set ${sets} from json_populate_record(null::${t}, $1::json) p${whereSql(params, values, 't0.')}`;
      const ret = prefer.representation ? ` returning ${selectList(params, 't0.')}` : ' returning 1';
      const res = await asUser((tx) => tx.query<{ json: string }>(wrap(stmt + ret), values));
      return [prefer.representation ? 200 : 204, prefer.representation ? (res.rows[0]?.json ?? '[]') : ''];
    }
    if (method === 'DELETE') {
      const stmt = `delete from ${t}${whereSql(params, values)}`;
      const res = await asUser((tx) => tx.query<{ json: string }>(wrap(stmt + (returning || ' returning 1')), values));
      return [prefer.representation ? 200 : 204, prefer.representation ? (res.rows[0]?.json ?? '[]') : ''];
    }
    throw new HttpError(405, 'PGRST000', `${method} not supported by the fake`);
  }

  const fakeFetch: typeof fetch = async (input, init) => {
    const request = new Request(input, init);
    const url = new URL(request.url);
    if (url.origin !== FAKE_URL) throw new TypeError(`fake backend: refusing to call ${url.origin}`);
    const match = /^\/rest\/v1\/([a-z_]+)$/.exec(url.pathname);
    const table = match?.[1] ?? url.pathname;
    if (hangs > 0 && hangWhich(request.method, table)) {
      hangs--;
      await new Promise<void>((resolve) => held.push(resolve));
    }
    if (url.pathname === '/auth/v1/token' && request.method === 'POST') {
      log.push({ method: request.method, table, status: 200, query: url.search });
      return new Response(JSON.stringify(fakeSession(userId, 3600)), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    const delay = latency(request.method, table);
    if (delay) await new Promise((r) => setTimeout(r, delay));
    if (failures > 0) {
      failures--;
      throw new TypeError('Failed to fetch');
    }
    if (!match) return new Response(JSON.stringify({ message: 'not found' }), { status: 404 });
    const text = request.method === 'GET' || request.method === 'DELETE' ? '' : await request.text();
    let status: number;
    let payload: string;
    try {
      [status, payload] = await answer(request.method, table, url.searchParams, request.headers, text ? JSON.parse(text) : null);
    } catch (err) {
      const e = err as { status?: number; code?: string; message?: string; detail?: string };
      status = e.status ?? statusOf(e.code);
      payload = JSON.stringify({ code: e.code ?? '', message: e.message ?? String(err), details: e.detail ?? null, hint: null });
    }
    log.push({ method: request.method, table, status, query: url.search });
    return new Response(status === 204 || payload === '' ? null : payload, {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  return {
    fetch: fakeFetch,
    db,
    log,
    sql: async <T,>(query: string, params?: unknown[]) => (await db.query<T>(query, params)).rows,
    failNext: (n) => {
      failures = n;
    },
    hangNext: (n, which = () => true) => {
      hangs = n;
      hangWhich = which;
    },
    release: () => held.splice(0).forEach((go) => go()),
    setLatency: (ms) => {
      latency = typeof ms === 'number' ? () => ms : ms;
    },
    close: () => db.close(),
  };
}

/**
 * A signed-in session for `userId`, as supabase-js stores it, expiring in `expiresIn` seconds.
 * The tokens are fake (unsigned); the fake backend never checks them.
 */
export function fakeSession(userId: string = SEED.user, expiresIn = 3600) {
  const b64 = (o: object) => btoa(JSON.stringify(o)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
  const expiresAt = Math.floor(Date.now() / 1000) + expiresIn;
  const accessToken = `${b64({ alg: 'none', typ: 'JWT' })}.${b64({ sub: userId, role: 'authenticated', exp: expiresAt })}.fake`;
  return {
    access_token: accessToken,
    refresh_token: `fake-refresh-${crypto.randomUUID()}`,
    token_type: 'bearer',
    expires_in: expiresIn,
    expires_at: expiresAt,
    user: { id: userId, aud: 'authenticated', role: 'authenticated', email: 'one@example.test', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' },
  };
}
