// Data migration 20261018120000_item_colours.sql (JCB-59) on PGlite: the migrations before it, then
// fictional items with grey or invalid colours, then the migration (twice). It must give the same
// colours the app shows (`withItemColours`), per dog, and change nothing when run again.
import { afterEach, describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import stubSql from './db/supabase-stub.sql?raw';
import { ITEM_COLOURS, withItemColours } from '../src/log/items';

const files = import.meta.glob('../supabase/migrations/*.sql', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
const TARGET = '20261018120000_item_colours.sql';
const names = Object.keys(files).sort();
const target = names.find((n) => n.endsWith(TARGET)) as string;
const before = names.filter((n) => n < target);

const DOG_A = '20000000-0000-4000-8000-00000000000a';
const DOG_B = '20000000-0000-4000-8000-00000000000b';
const id = (n: number) => `30000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

let db: PGlite | null = null;
afterEach(async () => {
  await db?.close();
  db = null;
});

async function setup(items: { n: number; dog: string; colour: string; position: number; created?: string }[]) {
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
       values ($1, $2, 'food', $3, $4, 2, '2026-10-01', $5, $6)`,
      [id(i.n), i.dog, `Item ${i.n}`, i.colour, i.position, i.created ?? '2026-10-01T08:00:00Z'],
    );
  }
}

const colours = async (dog: string) =>
  (
    await db!.query<{ id: string; colour: string; position: number }>(
      `select id, colour, position from public.item where dog_id = $1 order by position, created_at, id`,
      [dog],
    )
  ).rows;

const migrate = () => db!.exec(files[target] as string);

describe(`migration ${TARGET}`, () => {
  it('uses the same palette as the app (ITEM_COLOURS, tokens.json order)', () => {
    const palette = /array\[([\s\S]*?)\]/.exec(files[target] as string)?.[1] ?? '';
    expect([...palette.matchAll(/'([a-z0-9-]+)'/g)].map((m) => m[1])).toEqual([...ITEM_COLOURS]);
  });

  it('gives grey and invalid colours the first unused item colour, in lane order, per dog', async () => {
    await setup([
      { n: 1, dog: DOG_A, colour: 'food-cooked', position: 10 },
      { n: 2, dog: DOG_A, colour: 'mark-neutral', position: 30 },
      { n: 3, dog: DOG_A, colour: 'mark-neutral', position: 5 },
      { n: 4, dog: DOG_A, colour: 'mint', position: 40 },
      { n: 5, dog: DOG_A, colour: 'food-farm', position: 50 },
      // Same position: created_at decides.
      { n: 6, dog: DOG_A, colour: 'mark-neutral', position: 60, created: '2026-10-02T08:00:00Z' },
      { n: 7, dog: DOG_A, colour: 'mark-neutral', position: 60, created: '2026-10-01T08:00:00Z' },
      { n: 8, dog: DOG_B, colour: 'mark-neutral', position: 10 },
    ]);
    const beforeA = await colours(DOG_A);
    await migrate();
    const a = await colours(DOG_A);
    expect(Object.fromEntries(a.map((r) => [r.id, r.colour]))).toEqual({
      [id(3)]: 'food-ocean',
      [id(1)]: 'food-cooked',
      [id(2)]: 'med-arvelin',
      [id(4)]: 'med-bellavet',
      [id(5)]: 'food-farm',
      [id(7)]: 'med-gastrelle',
      [id(6)]: 'med-biomend',
    });
    // The app shows the same colours before the migration has run.
    expect(withItemColours(beforeA).map((r) => r.colour)).toEqual(a.map((r) => r.colour));
    // Another dog's items do not count.
    expect((await colours(DOG_B)).map((r) => r.colour)).toEqual(['food-cooked']);
  });

  it('is idempotent: a second run changes nothing', async () => {
    await setup([
      { n: 1, dog: DOG_A, colour: 'mark-neutral', position: 10 },
      { n: 2, dog: DOG_A, colour: 'med-calmora', position: 20 },
    ]);
    await migrate();
    const once = await db!.query(`select id, colour, updated_at from public.item order by id`);
    await migrate();
    const twice = await db!.query(`select id, colour, updated_at from public.item order by id`);
    expect(twice.rows).toEqual(once.rows);
    expect(once.rows.map((r) => (r as { colour: string }).colour)).toEqual(['food-cooked', 'med-calmora']);
  });

  it('cycles through the least used colours when there are more items than colours', async () => {
    await setup(Array.from({ length: 11 }, (_, k) => ({ n: k + 1, dog: DOG_A, colour: 'mark-neutral', position: k })));
    await migrate();
    expect((await colours(DOG_A)).map((r) => r.colour)).toEqual([...ITEM_COLOURS, ITEM_COLOURS[0], ITEM_COLOURS[1]]);
  });
});
