// Tiny path router: the Timeline at `<base>/`, a day at `<base>/day/YYYY-MM-DD`, the usual day at
// `<base>/usual` (as of today) or `<base>/usual/YYYY-MM-DD`, the Tracked list at `<base>/tracked` and a
// tracked condition at `<base>/tracked/<id>`.
// `base` is `/demo` in demo mode on the /demo path, otherwise empty. Pure, unit-tested in tests/day.test.ts.
import type { PlainDate } from './data';
import { isPlainDate } from './day/model';

export type Route =
  | { base: string; view: 'timeline' }
  | { base: string; view: 'day'; date: PlainDate }
  | { base: string; view: 'usual'; date?: PlainDate }
  | { base: string; view: 'tracked' }
  | { base: string; view: 'condition'; id: string };

const DEMO = '/demo';
/** Condition ids: UUIDs, or the demo's `condition-001`. */
const CONDITION_ID = /^[A-Za-z0-9-]{1,64}$/;

export function baseOf(pathname: string): string {
  return pathname === DEMO || pathname.startsWith(`${DEMO}/`) ? DEMO : '';
}

/** Anything that is not a well-formed path (wrong shape, impossible date) is the Timeline. */
export function parseRoute(pathname: string): Route {
  const base = baseOf(pathname);
  const rest = pathname.slice(base.length).replace(/\/+$/, '');
  if (rest === '/usual') return { base, view: 'usual' };
  if (rest === '/tracked') return { base, view: 'tracked' };
  const cond = /^\/tracked\/([^/]+)$/.exec(rest);
  if (cond) return cond[1] && CONDITION_ID.test(cond[1]) ? { base, view: 'condition', id: cond[1] } : { base, view: 'tracked' };
  const m = /^\/(day|usual)\/([^/]+)$/.exec(rest);
  const date = m?.[2];
  if (!m || !date || !isPlainDate(date)) return { base, view: 'timeline' };
  return m[1] === 'day' ? { base, view: 'day', date } : { base, view: 'usual', date };
}

export const timelinePath = (base: string) => base || '/';
export const dayPath = (base: string, date: PlainDate) => `${base}/day/${date}`;
export const usualPath = (base: string, date?: PlainDate) => `${base}/usual${date ? `/${date}` : ''}`;
export const trackedPath = (base: string) => `${base}/tracked`;
export const conditionPath = (base: string, id: string) => `${base}/tracked/${id}`;
export function routePath(r: Route): string {
  switch (r.view) {
    case 'day':
      return dayPath(r.base, r.date);
    case 'usual':
      return usualPath(r.base, r.date);
    case 'tracked':
      return trackedPath(r.base);
    case 'condition':
      return conditionPath(r.base, r.id);
    default:
      return timelinePath(r.base);
  }
}
