// Fictional stress log for the Timeline (JCB-86): a sweep of lane counts (8 to 24, mixed food and small
// circles), short and long item names, days with 1 to 6 events. Nothing here is real data.
// Used by tests/timelineFit.test.tsx and the dev page stress.html (?lanes=17).
import { DemoRepository } from '../../src/data';
import type { DayPart, Entry, EntryState, EventType, HealthEvent, Item, ScheduleSlot } from '../../src/data';

export const STRESS_TODAY = '2026-10-15';

const NAMES = [
  'Arvelin', 'Bellavet with a very long name', 'Biomend', 'Gastrelle forte extra strength', 'Omega', 'Probiotic', 'Calm',
  'Joint chew (green-lipped mussel)', 'Vit D', 'Thyroid tablet twice daily', 'Enzymes', 'Skin and coat complex', 'Iron', 'Zinc',
  'Magnesium', 'Fish oil', 'Charcoal', 'Antacid', 'Eye drops', 'Ear cleaner', 'Pain relief', 'Appetite aid', 'Tonic', 'Kelp',
];
const small = (n: number): Item => ({
  id: `s-${n}`, dogId: 'dog-stress', kind: n % 2 ? 'medication' : 'supplement', name: NAMES[n % NAMES.length] ?? 'Item',
  colour: ['med-arvelin', 'med-bellavet', 'med-biomend', 'med-gastrelle', 'med-calmora', 'treat'][n % 6] ?? 'treat',
  defaultDayPart: 1, activeFrom: '2026-01-01', activeTo: null, position: 10 + n,
});
const food = (id: string, name: string, colour: string, position: number): Item => ({
  id, dogId: 'dog-stress', kind: 'food', name, colour, defaultDayPart: 2, activeFrom: '2026-01-01', activeTo: null, position,
});
/** 2 foods and 24 small items; an item can be a lane in several day parts. */
export const stressItems: Item[] = [
  food('f-1', 'Cooked', 'food-cooked', 1),
  food('f-2', 'Slow-cooked chicken, rice and pumpkin mash', 'food-farm', 2),
  ...Array.from({ length: 24 }, (_, n) => small(n)),
];

/** Lanes by day part: item ids. A food item is one lane however many are logged in the part. */
export type LaneLayout = Partial<Record<DayPart, string[]>>;

/**
 * `lanes` lanes in all: a food lane in each meal part when `foods` is 3 (breakfast, dinner, supper), the rest small,
 * spread over parts 1 to 6 (dinner and breakfast first, as on a busy day).
 */
export function layoutOf(lanes: number, foods = 3): LaneLayout {
  const layout: LaneLayout = { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
  const meals: DayPart[] = [4, 2, 6];
  meals.slice(0, foods).forEach((p, i) => layout[p]!.push(i % 2 ? 'f-2' : 'f-1'));
  const order: DayPart[] = [4, 2, 6, 1, 3, 5];
  for (let n = 0; n < lanes - foods; n++) layout[order[n % order.length]!]!.push(`s-${n}`);
  return layout;
}
export const laneCount = (layout: LaneLayout) => Object.values(layout).reduce((s, ids) => s + ids.length, 0);

const STATES: EntryState[] = ['given', 'given', 'given', 'skipped', 'partial'];

/** `days` days back from STRESS_TODAY, every lane every day (the worst case for lane count). */
export function stressEntries(layout: LaneLayout, days = 40): Entry[] {
  const out: Entry[] = [];
  for (let d = 0; d < days; d++) {
    const date = shift(STRESS_TODAY, -d);
    let i = 0;
    for (const [part, ids] of Object.entries(layout)) {
      for (const itemId of ids) {
        out.push({
          id: `e-${date}-${part}-${itemId}`, dogId: 'dog-stress', date, dayPart: Number(part) as DayPart, itemId,
          amount: 1, unit: 'pill', flavour: '', state: STATES[(d + i++) % STATES.length] ?? 'given', note: '', createdBy: 'member-stress',
        });
      }
    }
  }
  return out;
}

const KINDS: EventType[] = ['vet', 'symptom', 'photo', 'frontline', 'deworming', 'symptom'];

/** 1 to 6 events a day (up to 5 badge kinds). */
export function stressEvents(days = 40): HealthEvent[] {
  const out: HealthEvent[] = [];
  for (let d = 0; d < days; d++) {
    const date = shift(STRESS_TODAY, -d);
    const count = 1 + (d % 6);
    for (let n = 0; n < count; n++) {
      const type = KINDS[n % KINDS.length] ?? 'symptom';
      out.push({ id: `v-${date}-${n}`, dogId: 'dog-stress', date, type, title: type === 'symptom' ? 'Reflux' : type, detail: '', conditionIds: [] });
    }
  }
  return out;
}

function shift(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** A repository holding only the stress log (no storage, no backend). */
export class StressRepository extends DemoRepository {
  constructor(private readonly layout: LaneLayout = layoutOf(17)) {
    super(null);
  }
  override today() {
    return STRESS_TODAY;
  }
  override async listItems() {
    return structuredClone(stressItems);
  }
  override async listScheduleSlots(): Promise<ScheduleSlot[]> {
    return [];
  }
  override async listEntries() {
    return stressEntries(this.layout);
  }
  override async listEvents() {
    return stressEvents();
  }
}
