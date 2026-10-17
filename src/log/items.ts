// Items (JCB-43): colours of new items, flavours added while logging, and what a new form starts
// from. Pure; tests in tests/items.test.ts.
import tokens from '../../docs/design-system/tokens.json';
import type { Entry, Item, ItemKind } from '../data';
import { groupOf, type KindGroup } from './amount';
import type { Records } from './LogProvider';

/** Colour token names an item can have (food-*, med-*, treat), in tokens.json order. */
export const ITEM_COLOURS: readonly string[] = tokens.color.tokens
  .map((t) => t.name)
  .filter((name) => /^(food|med)-[a-z0-9-]+$/.test(name) || name === 'treat');

/** A real item colour token; anything else (mark-neutral, a UI colour, an unknown 'food-old') needs one. */
export const isItemColour = (name: string) => ITEM_COLOURS.includes(name);

/**
 * Item colours never picked automatically because they read as grey next to `mark-neutral`
 * (med-calmora #a8b3c0 vs #a3aea8). Still offered in the swatches. Keep in step with the migration.
 */
export const AUTO_EXCLUDED: readonly string[] = ['med-calmora'];

/** The colours picked automatically, in tokens.json order. */
export const AUTO_COLOURS: readonly string[] = ITEM_COLOURS.filter((c) => !AUTO_EXCLUDED.includes(c));

/** Tokens of the item's own kind come first on a tie: food-* for food, med-* for medication, treat for treats. */
const ownKind = (kind: ItemKind, colour: string) =>
  kind === 'food' ? colour.startsWith('food-') : kind === 'treat' ? colour === 'treat' : colour.startsWith('med-');

/**
 * The colour of a new item of `kind`: the least used auto colour among `items` (so an unused one
 * while there are any, cycling after), on a tie one of the item's own kind first, then tokens.json
 * order. Same rule as migration 20261018120000_item_colours.sql.
 */
export function nextColour(items: Pick<Item, 'colour'>[], kind: ItemKind): string {
  const uses = new Map(AUTO_COLOURS.map((c) => [c, 0]));
  for (const i of items) if (uses.has(i.colour)) uses.set(i.colour, (uses.get(i.colour) ?? 0) + 1);
  const rank = (c: string) => [uses.get(c) ?? 0, ownKind(kind, c) ? 0 : 1] as const;
  let best = AUTO_COLOURS[0] ?? 'mark-neutral';
  for (const c of AUTO_COLOURS) {
    const [u, k] = rank(c);
    const [bu, bk] = rank(best);
    if (u < bu || (u === bu && k < bk)) best = c;
  }
  return best;
}

/** The new-item colour for a form's kind group (entry and usual-day forms create food or medication). */
export const nextColourFor = (items: Pick<Item, 'colour'>[], group: KindGroup) => nextColour(items, group === 'food' ? 'food' : 'medication');

/**
 * Items without a real item colour (`mark-neutral` from before JCB-43, or an unknown token) get
 * one, in lane order (position, then the list order, which is created_at and id): each takes
 * `nextColour` of every colour shown so far, so they stay distinct. Without `shown` this is exactly
 * what migration 20261018120000_item_colours.sql stores. `shown` (the colours shown before this
 * reload, by item id) keeps an item that is still grey on the colour it already showed, so saving
 * one item never changes the colour shown for another. Returns the same array when nothing changes.
 */
export function withItemColours<T extends Pick<Item, 'id' | 'kind' | 'colour' | 'position'>>(
  items: T[],
  shown: ReadonlyMap<string, string> = new Map(),
): T[] {
  if (items.every((i) => isItemColour(i.colour))) return items;
  const out = [...items];
  const grey = items
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => !isItemColour(item.colour))
    .sort((a, b) => (a.item.position ?? 0) - (b.item.position ?? 0) || a.index - b.index);
  const taken: Pick<Item, 'colour'>[] = items.filter((i) => isItemColour(i.colour));
  // Colours already shown for still-grey items are kept, and count as taken for the rest.
  const rest = [];
  for (const g of grey) {
    const before = shown.get(g.item.id);
    if (before && isItemColour(before)) {
      out[g.index] = { ...g.item, colour: before };
      taken.push({ colour: before });
    } else rest.push(g);
  }
  for (const { item, index } of rest) {
    const colour = nextColour(taken, item.kind);
    taken.push({ colour });
    out[index] = { ...item, colour };
  }
  return out;
}

/** The latest entry of the group (by date, then part): a new form starts from its item, amount and flavour. */
export function lastUsed(records: Records, group: KindGroup): Entry | null {
  const kinds = new Map(records.items.map((i) => [i.id, groupOf(i.kind)]));
  let last: Entry | null = null;
  for (const e of records.entries) {
    if (kinds.get(e.itemId) !== group) continue;
    if (!last || e.date > last.date || (e.date === last.date && e.dayPart >= last.dayPart)) last = e;
  }
  return last;
}

/**
 * A flavour not in the item's list yet is added to it (food: "Add flavour"); returns the item to
 * save, or null when nothing changes.
 */
export function withFlavour(item: Item | null, flavour: string): Item | null {
  if (!item || !flavour || (item.flavours ?? []).includes(flavour)) return null;
  return { ...item, flavours: [...(item.flavours ?? []), flavour] };
}
