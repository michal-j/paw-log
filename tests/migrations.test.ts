// Data migration 20261018120000_item_colours.sql (JCB-59) on PGlite: the migrations before it, then
// fictional items with grey or invalid colours, then the migration (twice). It must give exactly the
// colours the app shows (`withItemColours`), per dog, and change nothing when run again.
import { afterEach, describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import stubSql from './db/supabase-stub.sql?raw';
import type { ItemKind } from '../src/data';
import { AUTO_EXCLUDED, ITEM_COLOURS, withItemColours } from '../src/log/items';

const files = import.meta.glob('../supabase/migrations/*.sql', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
const TARGET = '20261018120000_item_colours.sql';
const names = Object.keys(files).sort();
const target = names.find((n) => n.endsWith(TARGET)) as string;
const sql = files[target] as string;
const before = names.filter((n) => n < target);

const DOG_A = '20000000-0000-4000-8000-00000000000a';
const DOG_B = '20000000-0000-4000-8000-00000000000b';
const id = (n: number) => `30000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

interface Row {
  n: number;
  dog: string;
  kind?: ItemKind;
  colour: string;
  position: number;
  created?: string;
}

let db: PGlite | null = null;
afterEach(async () => {
  await db?.close();
  db = null;
});

async function setup(items: Row[]) {
  db = new PGlite();
  await db.exec(stubSql);
  for (const f of before) await db.exec(files[f] as string);
  await db.exec(`
    insert into public.household (id, name) values ('10000000-0000-4000-8000-00000000000a', 'Test household');
    insert into public.dog (id, household_id, name) values
      ('${DOG_A}', '10000000-0000-4000-8000-00000000000a', 'Pip'),
      ('${DOG_B}', '10000000-0000-4000-8000-00000000000a', 'Dot');
  `);
  for (const i of items) {
    await db.query(
      `insert into public.item (id, dog_id, kind, name, colour, default_day_part, active_from, position, created_at)
       values ($1, $2, $3, $4, $5, 2, '2026-10-01', $6, $7)`,
      [id(i.n), i.dog, i.kind ?? 'food', `Item ${i.n}`, i.colour, i.position, i.created ?? '2026-10-01T08:00:00Z'],
    );
  }
}

/** The dog's items in the app's order (the items query: position, created_at, id). */
const rowsOf = async (dog: string) =>
  (
    await db!.query<{ id: string; kind: ItemKind; colour: string; position: number }>(
      `select id, kind, colour, position from public.item where dog_id = $1 order by position, created_at, id`,
      [dog],
    )
  ).rows;

const migrate = () => db!.exec(sql);
const arrayIn = (name: string) =>
  [...(new RegExp(`${name} constant text\\[\\] := array\\[([\\s\\S]*?)\\]`).exec(sql)?.[1] ?? '').matchAll(/'([a-z0-9-]+)'/g)].map((m) => m[1]);

describe(`migration ${TARGET}`, () => {
  it('uses the app palette (ITEM_COLOURS, tokens.json order) and the same auto exclusions', () => {
    expect(arrayIn('palette')).toEqual([...ITEM_COLOURS]);
    expect(arrayIn('auto_excluded')).toEqual([...AUTO_EXCLUDED]);
  });

  it('gives grey and invalid colours an unused colour of their own kind first, in lane order, per dog', async () => {
    await setup([
      { n: 1, dog: DOG_A, colour: 'food-cooked', position: 10 },
      { n: 2, dog: DOG_A, kind: 'medication', colour: 'mark-neutral', position: 30 },
      { n: 3, dog: DOG_A, colour: 'mark-neutral', position: 5 },
      { n: 4, dog: DOG_A, kind: 'treat', colour: 'food-old', position: 40 },
      { n: 5, dog: DOG_A, kind: 'medication', colour: 'med-arvelin', position: 50 },
      // Same position: created_at decides.
      { n: 6, dog: DOG_A, colour: 'mark-neutral', position: 60, created: '2026-10-02T08:00:00Z' },
      { n: 7, dog: DOG_A, colour: 'mark-neutral', position: 60, created: '2026-10-01T08:00:00Z' },
      { n: 8, dog: DOG_B, kind: 'medication', colour: 'mark-neutral', position: 10 },
    ]);
    const beforeA = await rowsOf(DOG_A);
    await migrate();
    const a = await rowsOf(DOG_A);
    expect(Object.fromEntries(a.map((r) => [r.id, r.colour]))).toEqual({
      [id(3)]: 'food-farm', // food: food-cooked is taken
      [id(1)]: 'food-cooked',
      [id(2)]: 'med-bellavet', // medication: med-arvelin is taken
      [id(4)]: 'treat', // 'food-old' is not a token
      [id(5)]: 'med-arvelin',
      [id(7)]: 'food-ocean', // last unused food colour
      [id(6)]: 'med-gastrelle', // food colours used up: the first unused one of the rest
    });
    expect(withItemColours(beforeA).map((r) => r.colour)).toEqual(a.map((r) => r.colour));
    // Another dog's items do not count.
    expect((await rowsOf(DOG_B)).map((r) => r.colour)).toEqual(['med-arvelin']);
  });

  it('is idempotent: a second run changes nothing', async () => {
    await setup([
      { n: 1, dog: DOG_A, colour: 'mark-neutral', position: 10 },
      { n: 2, dog: DOG_A, kind: 'medication', colour: 'med-calmora', position: 20 },
    ]);
    await migrate();
    const once = await db!.query(`select id, colour, updated_at from public.item order by id`);
    await migrate();
    const twice = await db!.query(`select id, colour, updated_at from public.item order by id`);
    expect(twice.rows).toEqual(once.rows);
    // A chosen med-calmora stays.
    expect(once.rows.map((r) => (r as { colour: string }).colour)).toEqual(['food-cooked', 'med-calmora']);
  });

  it('never picks med-calmora, and cycles through the least used colours when there are more items than colours', async () => {
    await setup(Array.from({ length: 10 }, (_, k) => ({ n: k + 1, dog: DOG_A, kind: 'medication' as const, colour: 'mark-neutral', position: k })));
    await migrate();
    expect((await rowsOf(DOG_A)).map((r) => r.colour)).toEqual([
      'med-arvelin',
      'med-bellavet',
      'med-gastrelle',
      'med-biomend',
      'food-cooked',
      'food-farm',
      'food-ocean',
      'treat',
      'med-arvelin',
      'med-bellavet',
    ]);
  });

  it('matches the app exactly on mixed data with ties (position, created_at, id)', async () => {
    // A fixed pseudo-random mix: kinds, grey/invalid/real colours, many equal positions and times.
    let seed = 7;
    const rand = (k: number) => ((seed = (seed * 1103515245 + 12345) % 2147483648), seed % k);
    const kinds: ItemKind[] = ['food', 'medication', 'treat', 'supplement', 'procedure'];
    const colours = ['mark-neutral', 'mark-neutral', 'food-old', 'mint', ...ITEM_COLOURS];
    const rows: Row[] = Array.from({ length: 24 }, (_, k) => ({
      n: 100 - k, // ids run against insertion order, so the id tie-break matters
      dog: k % 5 === 0 ? DOG_B : DOG_A,
      kind: kinds[rand(kinds.length)],
      colour: colours[rand(colours.length)] as string,
      position: rand(3) * 10,
      created: `2026-10-0${1 + rand(2)}T08:00:00Z`,
    }));
    await setup(rows);
    const app = [...withItemColours(await rowsOf(DOG_A)), ...withItemColours(await rowsOf(DOG_B))].map((r) => [r.id, r.colour]);
    await migrate();
    const db = [...(await rowsOf(DOG_A)), ...(await rowsOf(DOG_B))].map((r) => [r.id, r.colour]);
    expect(db).toEqual(app);
  });
});
