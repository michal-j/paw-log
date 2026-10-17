// Item helpers (JCB-43): colour of a new item, flavours added while logging, last used.
import { describe, expect, it } from 'vitest';
import tokens from '../docs/design-system/tokens.json';
import type { Entry, Item } from '../src/data';
import { ITEM_COLOURS, isItemColour, lastUsed, nextColour, withFlavour, withItemColours } from '../src/log/items';
import { editedItem } from '../src/log/ItemSheet';
import type { Records } from '../src/log/LogProvider';

const item = (id: string, kind: Item['kind'], colour: string, flavours: string[] = []): Item => ({
  id,
  dogId: 'd',
  kind,
  name: id,
  colour,
  defaultDayPart: 2,
  activeFrom: '2026-10-01',
  activeTo: null,
  flavours,
});
const entry = (id: string, itemId: string, date: string, dayPart: Entry['dayPart']): Entry => ({
  id,
  dogId: 'd',
  date,
  dayPart,
  itemId,
  amount: 1,
  unit: 'can',
  flavour: '',
  state: 'given',
  note: '',
  createdBy: '',
});

describe('item colours', () => {
  it('are the food, medication and treat tokens of tokens.json, in its order', () => {
    const names = tokens.color.tokens.map((t) => t.name);
    expect(ITEM_COLOURS.length).toBeGreaterThan(5);
    for (const c of ITEM_COLOURS) expect(names).toContain(c);
    expect(ITEM_COLOURS).toContain('treat');
    expect(ITEM_COLOURS).not.toContain('mark-neutral');
    expect([...ITEM_COLOURS]).toEqual(names.filter((n) => ITEM_COLOURS.includes(n)));
  });

  it('a new item takes the first unused colour (6)', () => {
    expect(nextColour([])).toBe(ITEM_COLOURS[0]);
    expect(nextColour([{ colour: ITEM_COLOURS[0]! }, { colour: ITEM_COLOURS[2]! }])).toBe(ITEM_COLOURS[1]);
    expect(nextColour([{ colour: 'mark-neutral' }])).toBe(ITEM_COLOURS[0]);
  });

  it('cycles when every colour is used: the least used, earliest first', () => {
    const all = ITEM_COLOURS.map((colour) => ({ colour }));
    expect(nextColour(all)).toBe(ITEM_COLOURS[0]);
    expect(nextColour([...all, { colour: ITEM_COLOURS[0]! }])).toBe(ITEM_COLOURS[1]);
  });
});

describe('items without an item colour (JCB-59)', () => {
  const at = (id: string, colour: string, position: number) => ({ ...item(id, 'food', colour), position });

  it('get the first unused colour in lane order (position, then list order); others keep theirs', () => {
    const items = [at('a', 'food-cooked', 10), at('b', 'mark-neutral', 30), at('c', 'mark-neutral', 5), at('d', 'mint', 30), at('e', 'food-farm', 40)];
    expect(withItemColours(items).map((i) => [i.id, i.colour])).toEqual([
      ['a', 'food-cooked'],
      ['b', 'med-arvelin'],
      ['c', 'food-ocean'],
      ['d', 'med-bellavet'],
      ['e', 'food-farm'],
    ]);
  });

  it('change nothing when every item has an item colour (same array)', () => {
    const items = [at('a', 'food-cooked', 10), at('b', 'treat', 20)];
    expect(withItemColours(items)).toBe(items);
  });

  it('only food-*, med-* and treat count as item colours', () => {
    expect(ITEM_COLOURS.every(isItemColour)).toBe(true);
    for (const c of ['mark-neutral', 'mint', 'ink', 'badge-vet-top', '']) expect(isItemColour(c)).toBe(false);
  });
});

describe('item editor', () => {
  const farm = { ...item('farm', 'food', 'food-farm', ['turkey', 'salmon']), defaultUnit: 'can' as const };

  it('saves name, colour, default unit and flavours (trimmed, no blanks or doubles)', () => {
    expect(editedItem(farm, { name: ' Farm Fresh Plus ', colour: 'treat', defaultUnit: 'tray', flavours: ['turkey', ' duck ', '', 'turkey'] })).toEqual({
      ...farm,
      name: 'Farm Fresh Plus',
      colour: 'treat',
      defaultUnit: 'tray',
      flavours: ['turkey', 'duck'],
    });
  });

  it('returns null when nothing changed', () => {
    expect(editedItem(farm, { name: 'farm', colour: 'food-farm', defaultUnit: 'can', flavours: ['turkey', 'salmon'] })).toBeNull();
  });
});

describe('flavours and last used', () => {
  it('a new flavour joins the item; a known or empty one changes nothing (7)', () => {
    const farm = item('farm', 'food', 'food-farm', ['turkey']);
    expect(withFlavour(farm, 'duck')?.flavours).toEqual(['turkey', 'duck']);
    expect(withFlavour(farm, 'turkey')).toBeNull();
    expect(withFlavour(farm, '')).toBeNull();
    expect(withFlavour(null, 'duck')).toBeNull();
  });

  it('last used is the latest entry of the kind, by date then part (9)', () => {
    const records = {
      items: [item('farm', 'food', 'food-farm'), item('treat', 'treat', 'treat'), item('pill', 'medication', 'med-arvelin')],
      entries: [entry('a', 'farm', '2026-10-10', 4), entry('b', 'treat', '2026-10-10', 6), entry('c', 'pill', '2026-10-12', 1), entry('d', 'farm', '2026-10-09', 7)],
    } as unknown as Records;
    expect(lastUsed(records, 'food')?.id).toBe('b'); // treats are food
    expect(lastUsed(records, 'med')?.id).toBe('c');
    expect(lastUsed({ ...records, entries: [] }, 'food')).toBeNull();
  });
});
