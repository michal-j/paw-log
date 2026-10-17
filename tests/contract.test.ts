// Repository contract (JCB-43): the same scenarios against DemoRepository and against the real
// SupabaseRepository + supabase-js talking to a PostgREST-like fake on Postgres with every migration
// (tests/harness). Saving, editing in place, deleting, filling, removing for a day and every Undo
// must behave the same, so a flow that works in /demo works on real data.
import { afterEach, describe, expect, it } from 'vitest';
import { DemoRepository, DuplicateSlotEntryError, type Entry, type Item, type Repository, type ScheduleSlot } from '../src/data';
import { deleteEntry, restoreRemoved } from '../src/log/actions';
import { createFakeSupabase } from './harness/fakeSupabase';

const NOW = () => new Date(2026, 9, 15, 16, 30); // the demo's frozen date, 15 Oct 2026
const uuid = () => crypto.randomUUID();

interface Subject {
  repo: Repository;
  close: () => Promise<void>;
}

const subjects: [string, () => Promise<Subject>][] = [
  ['DemoRepository', async () => ({ repo: new DemoRepository(null, NOW), close: async () => {} })],
  [
    'SupabaseRepository',
    async () => {
      const fake = await createFakeSupabase({ start: '2026-10-01' });
      return { repo: fake.repository(NOW), close: () => fake.backend.close() };
    },
  ],
];

/** What both implementations must agree on (created_by / updated_by are the database's business). */
const shape = (e: Entry) => ({
  id: e.id,
  date: e.date,
  dayPart: e.dayPart,
  itemId: e.itemId,
  scheduleSlotId: e.scheduleSlotId ?? null,
  amount: e.amount,
  unit: e.unit,
  flavour: e.flavour,
  state: e.state,
  note: e.note,
});

describe.each(subjects)('%s', (_name, make) => {
  let subject: Subject | null = null;
  afterEach(async () => {
    await subject?.close();
    subject = null;
  });

  /** A fresh item with a usual-day slot at dinner from 1 Oct, plus helpers. */
  async function setup() {
    subject = await make();
    const { repo } = subject;
    const dog = await repo.getDog();
    const item: Item = {
      id: uuid(),
      dogId: dog.id,
      kind: 'medication',
      name: 'Contract med',
      colour: 'med-biomend',
      defaultDayPart: 4,
      activeFrom: '2026-10-01',
      activeTo: null,
      defaultUnit: 'pill',
      flavours: [],
      position: 500,
    };
    await repo.saveItem(item);
    const slot: ScheduleSlot = {
      id: uuid(),
      dogId: dog.id,
      itemId: item.id,
      dayPart: 4,
      flavour: '',
      amount: 1,
      unit: 'pill',
      activeFrom: '2026-10-01',
      activeTo: null,
      course: false,
    };
    await repo.saveScheduleSlot(slot);
    const entry = (over: Partial<Entry> = {}): Entry => ({
      id: uuid(),
      dogId: dog.id,
      date: '2026-10-10',
      dayPart: 4,
      itemId: item.id,
      scheduleSlotId: slot.id,
      amount: 1,
      unit: 'pill',
      flavour: '',
      doseText: '',
      state: 'given',
      note: '',
      createdBy: '',
      ...over,
    });
    const onDay = async (date = '2026-10-10') => (await repo.listEntries({ from: date, to: date })).filter((e) => e.itemId === item.id);
    return { repo, dog, item, slot, entry, onDay };
  }

  it('saves an entry and reads it back', async () => {
    const { entry, repo, onDay } = await setup();
    const e = entry({ note: 'with food', amount: 0.5 });
    await repo.saveEntry(e);
    expect((await onDay()).map(shape)).toEqual([shape(e)]);
  });

  it('an edit updates the row in place: same id, no second row (15)', async () => {
    const { entry, repo, onDay, dog } = await setup();
    const e = entry();
    await repo.saveEntry(e);
    const other: Item = { ...(await repo.listItems()).find((i) => i.dogId === dog.id && i.id !== e.itemId)! };
    const edited = { ...e, itemId: other.id, amount: 2, state: 'skipped' as const, note: 'edited' };
    await repo.saveEntry(edited);
    const all = (await repo.listEntries({ from: '2026-10-10', to: '2026-10-10' })).filter((x) => x.id === e.id);
    expect(all.map(shape)).toEqual([shape(edited)]);
    expect(await onDay()).toHaveLength(0);
  });

  it('a second entry for the same slot and day is refused', async () => {
    const { entry, repo } = await setup();
    await repo.saveEntry(entry());
    await expect(repo.saveEntry(entry())).rejects.toBeInstanceOf(DuplicateSlotEntryError);
  });

  it('fill inserts once, skips a filled slot, and Undo deletes only what it added', async () => {
    const { entry, repo, onDay } = await setup();
    const first = await repo.addPlannedEntries([entry()]);
    expect(first).toHaveLength(1);
    expect(await repo.addPlannedEntries([entry()])).toEqual([]);
    expect(await onDay()).toHaveLength(1);
    await repo.deleteEntries(first);
    expect(await onDay()).toHaveLength(0);
  });

  it('delete then Undo brings the same entry back', async () => {
    const { entry, repo, onDay } = await setup();
    const e = entry({ note: 'keep me' });
    await repo.saveEntry(e);
    await repo.deleteEntry(e.id);
    expect(await onDay()).toHaveLength(0);
    await repo.saveEntry(e);
    expect((await onDay()).map(shape)).toEqual([shape(e)]);
  });

  it('removing a planned entry for the day keeps its slot taken, and Undo restores it (13)', async () => {
    const { entry, repo, onDay, slot } = await setup();
    const e = entry();
    await repo.saveEntry(e);
    await repo.removeFromDay(e, slot.id);
    expect(await onDay()).toHaveLength(0);
    expect(await repo.listRemovedSlots({ from: '2026-10-10', to: '2026-10-10' })).toEqual([
      { id: e.id, dogId: e.dogId, date: '2026-10-10', dayPart: 4, itemId: e.itemId, scheduleSlotId: slot.id },
    ]);
    // Fill does not bring it back, and a new entry for that slot needs the marker's row.
    expect(await repo.addPlannedEntries([entry()])).toEqual([]);
    await expect(repo.saveEntry(entry())).rejects.toBeInstanceOf(DuplicateSlotEntryError);
    // Undo
    await repo.saveEntry(e);
    expect((await onDay()).map(shape)).toEqual([shape(e)]);
    expect(await repo.listRemovedSlots({ from: '2026-10-10', to: '2026-10-10' })).toEqual([]);
  });

  it('deleting an ad-hoc and a filled entry: both leave the entries list, Undo restores each exactly (JCB-60)', async () => {
    const { entry, repo, onDay, slot } = await setup();
    const filled = entry({ note: 'filled' });
    const adHoc = entry({ scheduleSlotId: null, dayPart: 2, note: 'extra' });
    await repo.saveEntry(filled);
    await repo.saveEntry(adHoc);
    const undoAdHoc = await deleteEntry(repo, adHoc, null);
    const undoFilled = await deleteEntry(repo, filled, slot);
    expect(await onDay()).toEqual([]);
    expect((await repo.listRemovedSlots()).map((r) => r.id)).toEqual([filled.id]);
    await undoFilled();
    await undoAdHoc();
    expect((await onDay()).map(shape).sort((a, b) => a.dayPart - b.dayPart)).toEqual([shape(adHoc), shape(filled)]);
    expect(await repo.listRemovedSlots()).toEqual([]);
  });

  it('restoring a removed slot makes it open again; Undo removes it again unless it was logged (JCB-60)', async () => {
    const { entry, repo, onDay, slot } = await setup();
    const e = entry();
    await repo.saveEntry(e);
    await repo.removeFromDay(e, slot.id);
    const markers = await repo.listRemovedSlots();
    const undo = await restoreRemoved(repo, markers);
    expect(await repo.listRemovedSlots()).toEqual([]);
    expect(await onDay()).toEqual([]);
    await undo();
    expect(await repo.listRemovedSlots()).toEqual(markers);
    expect(await repo.addPlannedEntries([entry()])).toEqual([]);
    // Restore, then Fill logs it; an Undo of the restore now leaves that entry alone.
    const undo2 = await restoreRemoved(repo, markers);
    const fill = entry();
    expect(await repo.addPlannedEntries([fill])).toEqual([fill.id]);
    await undo2();
    expect((await onDay()).map(shape)).toEqual([shape(fill)]);
    expect(await repo.listRemovedSlots()).toEqual([]);
  });

  it('logging a removed slot again takes the marker row', async () => {
    const { entry, repo, onDay, slot } = await setup();
    const e = entry();
    await repo.saveEntry(e);
    await repo.removeFromDay(e, slot.id);
    const again = { ...entry(), id: e.id, amount: 2 };
    await repo.saveEntry(again);
    expect((await onDay()).map(shape)).toEqual([shape(again)]);
    expect(await repo.listRemovedSlots()).toEqual([]);
  });

  it('removing an entry whose slot another entry fills is refused (the caller deletes it instead)', async () => {
    const { entry, repo, slot } = await setup();
    await repo.saveEntry(entry());
    const extra = entry({ scheduleSlotId: null });
    await repo.saveEntry(extra);
    await expect(repo.removeFromDay(extra, slot.id)).rejects.toBeInstanceOf(DuplicateSlotEntryError);
  });

  it('day-part times: the last save wins', async () => {
    const { repo } = await setup();
    await repo.saveDayPartTime(2, '08:00');
    await repo.saveDayPartTime(2, '08:15');
    expect((await repo.getDayPartTimes())[2]).toBe('08:15');
  });

  it('settings: log start is null until set, then reads back', async () => {
    const { repo } = await setup();
    expect(await repo.getSettings()).toEqual({ logStart: null });
    await repo.saveSettings({ logStart: '2026-01-05' });
    expect(await repo.getSettings()).toEqual({ logStart: '2026-01-05' });
    await repo.saveSettings({ logStart: null });
    expect(await repo.getSettings()).toEqual({ logStart: null });
  });

  it('a usual-day slot updates in place, and deleting it keeps its entries unplanned', async () => {
    const { entry, repo, slot } = await setup();
    await repo.saveScheduleSlot({ ...slot, amount: 2 });
    const mine = (await repo.listScheduleSlots()).filter((s) => s.id === slot.id);
    expect(mine.map((s) => s.amount)).toEqual([2]);
    const e = entry();
    await repo.saveEntry(e);
    await repo.deleteScheduleSlot(slot.id);
    expect((await repo.listEntries({ from: '2026-10-10', to: '2026-10-10' })).find((x) => x.id === e.id)?.scheduleSlotId ?? null).toBeNull();
  });

  it('an item updates in place (colour, flavours)', async () => {
    const { repo, item } = await setup();
    const before = (await repo.listItems()).length;
    await repo.saveItem({ ...item, colour: 'treat', flavours: ['duck'] });
    const items = await repo.listItems();
    expect(items).toHaveLength(before);
    expect(items.find((i) => i.id === item.id)).toMatchObject({ colour: 'treat', flavours: ['duck'] });
  });
});
