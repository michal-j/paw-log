// Items (JCB-43): colours of new items, flavours added while logging, and what a new form starts
// from. Pure; tests in tests/items.test.ts.
import tokens from '../../docs/design-system/tokens.json';
import type { Entry, Item } from '../data';
import { groupOf, type KindGroup } from './amount';
import type { Records } from './LogProvider';

const isItemColour = (name: string) => /^(food|med)-[a-z0-9-]+$/.test(name) || name === 'treat';

/** Colour token names an item can have, in tokens.json order. */
export const ITEM_COLOURS: readonly string[] = tokens.color.tokens.map((t) => t.name).filter(isItemColour);

/**
 * The colour of a new item: the first item colour token (food, medication and treat tokens, in
 * tokens.json order) no item uses; when all are taken, the least used one (earliest on a tie), so
 * colours cycle.
 */
export function nextColour(items: Pick<Item, 'colour'>[]): string {
  const uses = new Map(ITEM_COLOURS.map((c) => [c, 0]));
  for (const i of items) if (uses.has(i.colour)) uses.set(i.colour, (uses.get(i.colour) ?? 0) + 1);
  let best = ITEM_COLOURS[0] ?? 'mark-neutral';
  for (const c of ITEM_COLOURS) if ((uses.get(c) ?? 0) < (uses.get(best) ?? 0)) best = c;
  return best;
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
