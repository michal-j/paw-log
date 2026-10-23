// Tiny path router: the Timeline at `<base>/`, a day at `<base>/day/YYYY-MM-DD`, the usual day at
// `<base>/usual` (as of today) or `<base>/usual/YYYY-MM-DD`, the Pinned notes at `<base>/pinned`, the Tracked list
// at `<base>/tracked`, a tracked condition at `<base>/tracked/<id>`, Search at `<base>/search` (the text and filters
// never go in the URL) and one item's whole history at `<base>/search/item/<id>`.
// `base` is `/demo` in demo mode on the /demo path, otherwise empty. Pure, unit-tested in tests/day.test.ts.
import type { PlainDate } from './data';
import { isPlainDate } from './day/model';

export type Route =
  | { base: string; view: 'timeline' }
  | { base: string; view: 'day'; date: PlainDate }
  | { base: string; view: 'usual'; date?: PlainDate }
  | { base: string; view: 'pinned' }
  | { base: string; view: 'tracked' }
  | { base: string; view: 'search' }
  | { base: string; view: 'item'; id: string }
  | { base: string; view: 'condition'; id: string };

const DEMO = '/demo';
/** Condition and item ids: UUIDs, or the demo's `condition-001`. */
const CONDITION_ID = /^[A-Za-z0-9-]{1,64}$/;

export function baseOf(pathname: string): string {
  return pathname === DEMO || pathname.startsWith(`${DEMO}/`) ? DEMO : '';
}

/** Anything that is not a well-formed path (wrong shape, impossible date) is the Timeline. */
export function parseRoute(pathname: string): Route {
  const base = baseOf(pathname);
  const rest = pathname.slice(base.length).replace(/\/+$/, '');
  if (rest === '/usual') return { base, view: 'usual' };
  if (rest === '/pinned') return { base, view: 'pinned' };
  if (rest === '/tracked') return { base, view: 'tracked' };
  if (rest === '/search') return { base, view: 'search' };
  const item = /^\/search\/item\/([^/]+)$/.exec(rest);
  if (item) return item[1] && CONDITION_ID.test(item[1]) ? { base, view: 'item', id: item[1] } : { base, view: 'search' };
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
export const tabPath = (base: string, view: 'pinned' | 'tracked' | 'search') => `${base}/${view}`;
export const itemPath = (base: string, id: string) => `${base}/search/item/${id}`;
export const conditionPath = (base: string, id: string) => `${base}/tracked/${id}`;
export function routePath(r: Route): string {
  switch (r.view) {
    case 'day':
      return dayPath(r.base, r.date);
    case 'usual':
      return usualPath(r.base, r.date);
    case 'pinned':
    case 'tracked':
    case 'search':
      return tabPath(r.base, r.view);
    case 'item':
      return itemPath(r.base, r.id);
    case 'condition':
      return conditionPath(r.base, r.id);
    default:
      return timelinePath(r.base);
  }
}
