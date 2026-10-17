// Tracked conditions (JCB-6): list order, history, counts, plural forms, routes, and the migration's
// guard on event.issue_id. Fictional data only.
import { afterEach, describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import stubSql from './db/supabase-stub.sql?raw';
import type { Condition, EventType, HealthEvent } from '../src/data';
import { parseRoute, routePath } from '../src/routes';
import {
  conditionsOf,
  eventCount,
  historyGroups,
  normaliseDates,
  openConditions,
  orderConditions,
  pluralForm,
  resolvedConditions,
} from '../src/tracked/model';

const cond = (id: string, startedOn: string, resolvedOn: string | null = null): Condition => ({
  id, dogId: 'd', name: id, startedOn, description: '', resolvedOn, position: 0,
});
const ev = (id: string, date: string, type: EventType, conditionIds: string[]): HealthEvent => ({
  id, dogId: 'd', date, type, title: id, detail: '', conditionIds,
});

const all = [cond('lump', '2026-10-03'), cond('reflux', '2026-09-20', '2026-09-30'), cond('stomach', '2026-10-12'), cond('old', '2026-08-01', '2026-08-20')];

describe('condition lists', () => {
  it('open: newest start first; resolved: latest resolved first; tags and chips: open then resolved', () => {
    expect(openConditions(all).map((c) => c.id)).toEqual(['stomach', 'lump']);
    expect(resolvedConditions(all).map((c) => c.id)).toEqual(['reflux', 'old']);
    expect(orderConditions(all).map((c) => c.id)).toEqual(['stomach', 'lump', 'reflux', 'old']);
    expect(conditionsOf({ conditionIds: ['old', 'lump', 'gone'] }, all).map((c) => c.id)).toEqual(['lump', 'old']);
  });

  it('history: linked events only, newest day first, the Day view order within a day', () => {
    const events = [
      ev('a', '2026-10-12', 'symptom', ['stomach']),
      ev('b', '2026-10-14', 'symptom', ['stomach', 'lump']),
      ev('c', '2026-10-14', 'vet', ['stomach']),
      ev('d', '2026-10-14', 'note', ['lump']),
      ev('e', '2026-10-13', 'photo', ['stomach']),
    ];
    expect(historyGroups('stomach', events).map((g) => [g.date, g.events.map((e) => e.id)])).toEqual([
      ['2026-10-14', ['c', 'b']],
      ['2026-10-13', ['e']],
      ['2026-10-12', ['a']],
    ]);
    expect(eventCount('stomach', events)).toBe(3); // photos are counted separately (JCB-7)
    expect(historyGroups('nothing', events)).toEqual([]);
  });

  it('plural forms: EN one/many, PL one/few/many', () => {
    expect([1, 2, 5].map((n) => pluralForm(n, 'en'))).toEqual(['one', 'many', 'many']);
    expect([1, 2, 4, 5, 12, 14, 22, 25].map((n) => pluralForm(n, 'pl'))).toEqual(['one', 'few', 'few', 'many', 'many', 'many', 'few', 'many']);
  });

  it('a resolved date before the start becomes the start', () => {
    expect(normaliseDates(cond('x', '2026-10-05', '2026-10-01')).resolvedOn).toBe('2026-10-05');
    expect(normaliseDates(cond('x', '2026-10-05', '2026-10-07')).resolvedOn).toBe('2026-10-07');
    expect(normaliseDates(cond('x', '2026-10-05')).resolvedOn).toBeNull();
  });
});

describe('routes', () => {
  it('parses the Tracked list and a condition, in and out of demo mode', () => {
    expect(parseRoute('/tracked')).toEqual({ base: '', view: 'tracked' });
    expect(parseRoute('/demo/tracked/condition-001')).toEqual({ base: '/demo', view: 'condition', id: 'condition-001' });
    const id = '5ff42b38-06b9-4eb0-bda3-af77b77b4a37';
    expect(routePath(parseRoute(`/tracked/${id}/`))).toBe(`/tracked/${id}`);
    expect(parseRoute('/tracked/bad%20id')).toEqual({ base: '', view: 'tracked' });
  });
});

describe('migration 20261019130600_tracked_conditions', () => {
  const files = import.meta.glob('../supabase/migrations/*.sql', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
  const names = Object.keys(files).sort();
  const target = names.find((n) => n.endsWith('_tracked_conditions.sql')) as string;
  let db: PGlite | null = null;
  afterEach(async () => {
    await db?.close();
    db = null;
  });

  async function upTo(withIssue: boolean) {
    db = new PGlite();
    await db.exec(stubSql);
    for (const f of names.filter((n) => n < target)) await db.exec(files[f] as string);
    await db.exec(`
      insert into public.household (id, name) values ('10000000-0000-4000-8000-00000000000a', 'Test household');
      insert into public.dog (id, household_id, name) values ('20000000-0000-4000-8000-00000000000a', '10000000-0000-4000-8000-00000000000a', 'Pip');
      insert into public.event (dog_id, date, type, title, issue_id) values
        ('20000000-0000-4000-8000-00000000000a', '2026-10-01', 'note', 'x', ${withIssue ? "'90000000-0000-4000-8000-000000000001'" : 'null'});
    `);
    return db;
  }

  it('drops event.issue_id when it was never used', async () => {
    const d = await upTo(false);
    await d.exec(files[target] as string);
    const cols = await d.query(`select 1 from information_schema.columns where table_name = 'event' and column_name = 'issue_id'`);
    expect(cols.rows).toHaveLength(0);
  });

  it('stops, dropping nothing, if any event has an issue_id', async () => {
    const d = await upTo(true);
    await expect(d.exec(files[target] as string)).rejects.toThrow(/issue_id/);
  });
});
