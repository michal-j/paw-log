import { beforeEach, describe, expect, it } from 'vitest';
import { DemoRepository, DEMO_STORAGE_KEY } from '../src/data/demoRepository';
import { DuplicateSlotEntryError, createRepository, isDemoMode } from '../src/data';
import { SupabaseRepository } from '../src/data/supabaseRepository';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Entry, Item } from '../src/data';

const memory = () => {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
  };
};

describe('DemoRepository', () => {
  let storage: ReturnType<typeof memory>;
  beforeEach(() => {
    storage = memory();
  });

  it('serves fictional frozen data', async () => {
    const repo = new DemoRepository(storage);
    expect(repo.today()).toBe('2026-10-15');
    expect((await repo.getDog()).name).toBe('Pip');
    expect((await repo.listItems()).length).toBeGreaterThan(0);
    expect((await repo.listEntries()).length).toBeGreaterThan(0);
  });

  it('filters by date range', async () => {
    const repo = new DemoRepository(storage);
    const day = await repo.listEntries({ from: '2026-10-10', to: '2026-10-10' });
    expect(day.length).toBeGreaterThan(0);
    expect(day.every((e) => e.date === '2026-10-10')).toBe(true);
  });

  it('persists changes in storage and restores them in a new instance', async () => {
    const repo = new DemoRepository(storage);
    const [first] = await repo.listEntries();
    const edited: Entry = { ...(first as Entry), note: 'changed' };
    await repo.saveEntry(edited);
    await repo.deleteEvent('event-001');
    expect(storage.getItem(DEMO_STORAGE_KEY)).not.toBeNull();
    const again = new DemoRepository(storage);
    expect((await again.listEntries()).find((e) => e.id === edited.id)?.note).toBe('changed');
    expect((await again.listEvents()).some((e) => e.id === 'event-001')).toBe(false);
  });

  it('serves the fictional usual day and filters it by active range', async () => {
    const repo = new DemoRepository(storage);
    const all = await repo.listScheduleSlots();
    expect(all).toHaveLength(13);
    const farm = all.find((s) => s.itemId === 'item-farm');
    expect(farm).toMatchObject({ dayPart: 4, flavour: 'turkey', amount: 0.25, unit: 'can' });
    const later = await repo.listScheduleSlots({ from: '2026-10-12', to: '2026-10-15' });
    expect(later.some((s) => s.itemId === 'item-farm')).toBe(false); // ended 11 October
    expect(later.some((s) => s.itemId === 'item-ocean')).toBe(true);
  });

  it('refuses a second entry for the same slot and date, like the database', async () => {
    const repo = new DemoRepository(storage);
    const base: Entry = { id: 'x1', dogId: 'dog-demo', date: '2026-10-16', dayPart: 4, itemId: 'item-ocean', scheduleSlotId: 'slot-ocean-4', amount: 0.5, unit: 'can', flavour: 'salmon', state: 'given', note: '', createdBy: '' };
    await repo.saveEntry(base);
    await repo.saveEntry({ ...base, note: 'edit of the same entry is fine' });
    await expect(repo.saveEntry({ ...base, id: 'x2' })).rejects.toBeInstanceOf(DuplicateSlotEntryError);
  });

  it('adds planned entries but skips slots already filled that day (fill never overwrites)', async () => {
    const repo = new DemoRepository(storage);
    const mk = (id: string, date: string): Entry => ({ id, dogId: 'dog-demo', date, dayPart: 2, itemId: 'item-bellavet', scheduleSlotId: 'slot-bellavet-2', amount: 0.15, unit: 'ml', flavour: '', state: 'given', note: '', createdBy: '' });
    const added = await repo.addPlannedEntries([mk('p1', '2026-10-15'), mk('p2', '2026-10-15'), mk('p3', '2026-10-14')]);
    expect(added).toEqual(['p1']); // 14 Oct already has its breakfast Bellavet; p2 repeats p1's slot
    await repo.deleteEntries(added);
    expect((await repo.listEntries()).some((e) => e.id === 'p1')).toBe(false);
  });

  it('removing a usual-day slot keeps the entries that filled it, unplanned', async () => {
    const repo = new DemoRepository(storage);
    await repo.deleteScheduleSlot('slot-cooked-2');
    expect((await repo.listScheduleSlots()).some((s) => s.id === 'slot-cooked-2')).toBe(false);
    const cooked = (await repo.listEntries()).filter((e) => e.itemId === 'item-cooked');
    expect(cooked.length).toBeGreaterThan(40);
    expect(cooked.every((e) => e.scheduleSlotId === null)).toBe(true);
  });

  it('stores day-part times, items and slots, and keeps them across instances', async () => {
    const repo = new DemoRepository(storage);
    expect((await repo.getDayPartTimes())[2]).toBe('07:30');
    await repo.saveDayPartTime(2, '08:15');
    const [first] = await repo.listItems();
    await repo.saveItem({ ...(first as Item), name: 'Renamed' });
    const again = new DemoRepository(storage);
    expect((await again.getDayPartTimes())[2]).toBe('08:15');
    expect((await again.listItems())[0]?.name).toBe('Renamed');
    again.reset();
    expect((await again.getDayPartTimes())[2]).toBe('07:30');
  });

  it('reports the device clock as HH:MM next to the frozen date', () => {
    const repo = new DemoRepository(storage, () => new Date(2030, 0, 1, 9, 5));
    expect(repo.nowTime()).toBe('09:05');
    expect(repo.today()).toBe('2026-10-15');
  });

  it('reset returns to the sample data', async () => {
    const repo = new DemoRepository(storage);
    await repo.deleteEvent('event-001');
    repo.reset();
    expect((await repo.listEvents()).some((e) => e.id === 'event-001')).toBe(true);
    expect(storage.getItem(DEMO_STORAGE_KEY)).toBeNull();
  });

  it('survives corrupt or unavailable storage', async () => {
    storage.setItem(DEMO_STORAGE_KEY, '{nope');
    expect((await new DemoRepository(storage).listEntries()).length).toBeGreaterThan(0);
    expect((await new DemoRepository(null).listEntries()).length).toBeGreaterThan(0);
  });
});

describe('repository selection', () => {
  it('uses demo mode for the flag or the /demo path only', () => {
    expect(isDemoMode('/', 'true')).toBe(true);
    expect(isDemoMode('/demo', undefined)).toBe(true);
    expect(isDemoMode('/demo/', undefined)).toBe(true);
    expect(isDemoMode('/', undefined)).toBe(false);
    expect(isDemoMode('/demonstration', undefined)).toBe(false);
  });
  it('creates the matching implementation', () => {
    expect(createRepository(true)).toBeInstanceOf(DemoRepository);
    expect(createRepository(false, {} as SupabaseClient)).toBeInstanceOf(SupabaseRepository);
    expect(() => createRepository(false)).toThrow(/Supabase client is required/);
  });
});
