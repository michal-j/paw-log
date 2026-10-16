// Writes through the repository, each returning how to undo it. The UI shows the Undo toast.
import type { Entry, HealthEvent, Repository, ScheduleSlot } from '../data';
import type { SlotChange } from './plan';

export type Undo = () => Promise<void>;

export const newId = () => crypto.randomUUID();

/** Undo several steps, last first. */
export const undoAll =
  (...undos: Undo[]): Undo =>
  async () => {
    for (const u of [...undos].reverse()) await u();
  };

export async function saveEntry(repo: Repository, next: Entry, prev: Entry | null): Promise<Undo> {
  await repo.saveEntry(next);
  return prev ? () => repo.saveEntry(prev) : () => repo.deleteEntry(next.id);
}

export async function deleteEntry(repo: Repository, entry: Entry): Promise<Undo> {
  await repo.deleteEntry(entry.id);
  return () => repo.saveEntry(entry);
}

/** Given (one slot) and Fill (all due slots): slots someone already filled are skipped. */
export async function addPlanned(repo: Repository, entries: Entry[]): Promise<{ added: number; undo: Undo }> {
  const ids = await repo.addPlannedEntries(entries);
  return { added: ids.length, undo: () => repo.deleteEntries(ids) };
}

export async function saveEvent(repo: Repository, next: HealthEvent, prev: HealthEvent | null): Promise<Undo> {
  await repo.saveEvent(next);
  return prev ? () => repo.saveEvent(prev) : () => repo.deleteEvent(next.id);
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
