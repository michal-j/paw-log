// Item helpers (JCB-43): colour of a new item, flavours added while logging, last used.
import { describe, expect, it } from 'vitest';
import tokens from '../docs/design-system/tokens.json';
import type { Entry, Item } from '../src/data';
import { AUTO_COLOURS, AUTO_EXCLUDED, ITEM_COLOURS, isItemColour, lastUsed, nextColour, withFlavour, withItemColours } from '../src/log/items';
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

  it('a new item takes the first unused colour of its own kind, then of the rest (6)', () => {
    expect(nextColour([], 'food')).toBe('food-cooked');
    expect(nextColour([], 'medication')).toBe('med-arvelin');
    expect(nextColour([], 'treat')).toBe('treat');
    expect(nextColour([{ colour: 'food-cooked' }, { colour: 'food-ocean' }], 'food')).toBe('food-farm');
    expect(nextColour([{ colour: 'mark-neutral' }], 'supplement')).toBe('med-arvelin');
    // Own kind used up: the first unused colour of the rest, in tokens.json order.
    expect(nextColour(['food-cooked', 'food-farm', 'food-ocean'].map((colour) => ({ colour })), 'food')).toBe('med-arvelin');
  });

  it('never picks a colour that reads as grey (med-calmora), though it stays a valid item colour', () => {
    expect(AUTO_EXCLUDED).toEqual(['med-calmora']);
    expect(isItemColour('med-calmora')).toBe(true);
    const meds = ['med-arvelin', 'med-bellavet', 'med-gastrelle', 'med-biomend'].map((colour) => ({ colour }));
    expect(nextColour(meds, 'medication')).toBe('food-cooked');
    // Every auto colour is clearly apart from mark-neutral; the excluded one is not.
    const hex = (name: string) => tokens.color.tokens.find((t) => t.name === name)!.value;
    const rgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
    const dist = (a: string, b: string) => Math.hypot(...rgb(hex(a)).map((v, i) => v - rgb(hex(b))[i]!));
    for (const c of AUTO_COLOURS) expect(dist(c, 'mark-neutral')).toBeGreaterThan(40);
    for (const c of AUTO_EXCLUDED) expect(dist(c, 'mark-neutral')).toBeLessThan(40);
  });

  it('cycles when every colour is used: the least used, own kind first, then tokens.json order', () => {
    const all = AUTO_COLOURS.map((colour) => ({ colour }));
    expect(nextColour(all, 'food')).toBe('food-cooked');
    expect(nextColour(all, 'medication')).toBe('med-arvelin');
    expect(nextColour([...all, { colour: 'food-cooked' }], 'food')).toBe('food-farm');
  });
});

describe('items without an item colour (JCB-59)', () => {
  const at = (id: string, colour: string, position: number, kind: Item['kind'] = 'food') => ({ ...item(id, kind, colour), position });

  it('get an unused colour in lane order (position, then list order); unknown tokens count as none', () => {
    const items = [
      at('a', 'food-cooked', 10),
      at('b', 'mark-neutral', 30, 'medication'),
      at('c', 'mark-neutral', 5),
      at('d', 'food-old', 30),
      at('e', 'food-farm', 40),
    ];
    expect(withItemColours(items).map((i) => [i.id, i.colour])).toEqual([
      ['a', 'food-cooked'],
      ['b', 'med-arvelin'],
      ['c', 'food-ocean'],
      ['d', 'med-bellavet'],
      ['e', 'food-farm'],
    ]);
  });

  it('keep the colour they showed before, so saving one item never changes another', () => {
    const items = [at('a', 'mark-neutral', 10), at('b', 'mark-neutral', 20), at('c', 'mark-neutral', 30)];
    const first = withItemColours(items);
    expect(first.map((i) => i.colour)).toEqual(['food-cooked', 'food-farm', 'food-ocean']);
    const shown = new Map(first.map((i) => [i.id, i.colour]));
    // a is saved with b's colour: b and c keep what they showed.
    const after = withItemColours([{ ...items[0]!, colour: 'food-farm' }, items[1]!, items[2]!], shown);
    expect(after.map((i) => i.colour)).toEqual(['food-farm', 'food-farm', 'food-ocean']);
    // A new grey item takes a colour nobody shows.
    const more = withItemColours([...items, at('d', 'mark-neutral', 5)], shown);
    expect(more.map((i) => i.colour)).toEqual(['food-cooked', 'food-farm', 'food-ocean', 'med-arvelin']);
  });

  it('change nothing when every item has an item colour (same array)', () => {
    const items = [at('a', 'food-cooked', 10), at('b', 'treat', 20)];
    expect(withItemColours(items)).toBe(items);
  });

  it('only the item colour tokens count as item colours', () => {
    expect(ITEM_COLOURS.every(isItemColour)).toBe(true);
    for (const c of ['mark-neutral', 'mint', 'ink', 'badge-vet-top', 'food-old', 'med-', '']) expect(isItemColour(c)).toBe(false);
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
