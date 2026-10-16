// Tiny path router: the Timeline at `<base>/`, a day at `<base>/day/YYYY-MM-DD`, the usual day at
// `<base>/usual` (as of today) or `<base>/usual/YYYY-MM-DD`.
// `base` is `/demo` in demo mode on the /demo path, otherwise empty. Pure, unit-tested in tests/day.test.ts.
import type { PlainDate } from './data';
import { isPlainDate } from './day/model';

export type Route =
  | { base: string; view: 'timeline' }
  | { base: string; view: 'day'; date: PlainDate }
  | { base: string; view: 'usual'; date?: PlainDate };

const DEMO = '/demo';

export function baseOf(pathname: string): string {
  return pathname === DEMO || pathname.startsWith(`${DEMO}/`) ? DEMO : '';
}

/** Anything that is not a well-formed path (wrong shape, impossible date) is the Timeline. */
export function parseRoute(pathname: string): Route {
  const base = baseOf(pathname);
  const rest = pathname.slice(base.length).replace(/\/+$/, '');
  if (rest === '/usual') return { base, view: 'usual' };
  const m = /^\/(day|usual)\/([^/]+)$/.exec(rest);
  const date = m?.[2];
  if (!m || !date || !isPlainDate(date)) return { base, view: 'timeline' };
  return m[1] === 'day' ? { base, view: 'day', date } : { base, view: 'usual', date };
}

export const timelinePath = (base: string) => base || '/';
export const dayPath = (base: string, date: PlainDate) => `${base}/day/${date}`;
export const usualPath = (base: string, date?: PlainDate) => `${base}/usual${date ? `/${date}` : ''}`;
export const routePath = (r: Route) =>
  r.view === 'day' ? dayPath(r.base, r.date) : r.view === 'usual' ? usualPath(r.base, r.date) : timelinePath(r.base);
