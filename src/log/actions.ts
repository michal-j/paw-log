// Writes through the repository, each returning how to undo it. The UI shows the Undo toast.
import type { Condition, Entry, HealthEvent, RemovedSlot, Repository, ScheduleSlot } from '../data';
import { DuplicateSlotEntryError } from '../data/errors';
import type { SlotChange } from './plan';

export type Undo = () => Promise<void>;

export const newId = () => crypto.randomUUID();

/** Undo several steps, last first. */
export const undoAll =
  (...undos: Undo[]): Undo =>
  async () => {
    for (const u of [...undos].reverse()) await u();
  };

/**
 * Save an entry: an edit updates its row in place (same id). Logging a slot that was removed for the
 * day (`replaces`) takes the marker's id, and Undo puts the marker back.
 */
export async function saveEntry(repo: Repository, next: Entry, prev: Entry | null, replaces?: RemovedSlot | null): Promise<Undo> {
  await repo.saveEntry(next);
  if (prev) return () => repo.saveEntry(prev);
  if (replaces) return () => repo.removeFromDay(next, replaces.scheduleSlotId);
  return () => repo.deleteEntry(next.id);
}

/**
 * Delete an entry. One that filled a usual-day slot (`slot`) leaves that slot removed for the day,
 * so it is not offered as "not logged" again or filled by Fill. Either way the entry is gone from the
 * Day view and the Timeline (the marker is never drawn as a row). Undo brings the entry back.
 */
export async function deleteEntry(repo: Repository, entry: Entry, slot: ScheduleSlot | null = null): Promise<Undo> {
  if (slot) {
    try {
      await repo.removeFromDay(entry, slot.id);
      return () => repo.saveEntry(entry);
    } catch (err) {
      // Someone else's entry fills that slot already: then this one is simply an extra, delete it.
      if (!(err instanceof DuplicateSlotEntryError)) throw err;
    }
  }
  await repo.deleteEntry(entry.id);
  return () => repo.saveEntry(entry);
}

/**
 * Put usual-day items removed for a day back on it: their markers go, so the slots are planned (and
 * fillable) again. Undo removes them again, except a slot someone has logged in the meantime.
 */
export async function restoreRemoved(repo: Repository, markers: RemovedSlot[]): Promise<Undo> {
  await repo.deleteEntries(markers.map((m) => m.id));
  return async () => {
    for (const m of markers) {
      const entry: Entry = {
        id: m.id,
        dogId: m.dogId,
        date: m.date,
        dayPart: m.dayPart,
        itemId: m.itemId,
        scheduleSlotId: m.scheduleSlotId,
        amount: null,
        unit: null,
        flavour: '',
        doseText: '',
        state: 'given',
        note: '',
        createdBy: '',
      };
      try {
        await repo.removeFromDay(entry, m.scheduleSlotId);
      } catch (err) {
        if (!(err instanceof DuplicateSlotEntryError)) throw err;
      }
    }
  };
}

/** Given (one slot) and Fill (all due slots): slots someone already filled are skipped. */
export async function addPlanned(repo: Repository, entries: Entry[]): Promise<{ added: number; undo: Undo }> {
  const ids = await repo.addPlannedEntries(entries);
  return { added: ids.length, undo: () => repo.deleteEntries(ids) };
}

/**
 * Save an event and its condition links. `created`: conditions made with "+ New" in the form, saved
 * first so the event can link to them; Undo removes them again after restoring the event.
 */
export async function saveEvent(repo: Repository, next: HealthEvent, prev: HealthEvent | null, created: Condition[] = []): Promise<Undo> {
  for (const c of created) await repo.saveCondition(c);
  await repo.saveEvent(next);
  return async () => {
    if (prev) await repo.saveEvent(prev);
    else await repo.deleteEvent(next.id);
    for (const c of created) await repo.deleteCondition(c.id);
  };
}

/** Create, edit, resolve or reopen a condition. Undo puts the previous version back (or deletes a new one). */
export async function saveCondition(repo: Repository, next: Condition, prev: Condition | null): Promise<Undo> {
  await repo.saveCondition(next);
  return prev ? () => repo.saveCondition(prev) : () => repo.deleteCondition(next.id);
}

/** Delete a condition; its events stay. Undo brings it back with its links to `eventIds`. */
export async function deleteCondition(repo: Repository, condition: Condition, eventIds: string[]): Promise<Undo> {
  await repo.deleteCondition(condition.id);
  return async () => {
    await repo.saveCondition(condition);
    await repo.linkEvents(condition.id, eventIds);
  };
}

export async function deleteEvent(repo: Repository, event: HealthEvent): Promise<Undo> {
  await repo.deleteEvent(event.id);
  return () => repo.saveEvent(event);
}

/** Apply a usual-day change; `before` is the slot list it was computed from, to restore on undo. */
export async function applySlotChange(
  repo: Repository,
  change: Pick<SlotChange, 'save' | 'remove'>,
  before: ScheduleSlot[],
): Promise<Undo> {
  const prev = new Map(before.map((s) => [s.id, s]));
  for (const s of change.save) await repo.saveScheduleSlot(s);
  for (const id of change.remove) await repo.deleteScheduleSlot(id);
  return async () => {
    for (const id of change.remove) {
      const old = prev.get(id);
      if (old) await repo.saveScheduleSlot(old);
    }
    for (const s of [...change.save].reverse()) {
      const old = prev.get(s.id);
      if (old) await repo.saveScheduleSlot(old);
      else await repo.deleteScheduleSlot(s.id);
    }
  };
}
