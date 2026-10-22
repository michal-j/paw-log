// Writes through the repository, each returning how to undo it. The UI shows the Undo toast.
import type { Condition, DocFile, Entry, HealthEvent, Photo, PhotoFiles, PinnedNote, RemovedSlot, Repository, ScheduleSlot } from '../data';
import { DuplicateSlotEntryError } from '../data/errors';
import type { SlotChange } from './plan';

/**
 * Puts a write back. `commit`, when there is one, finishes the write once Undo is no longer offered
 * (the toast went away without Undo): deleted photos' files are removed only then (JCB-7).
 */
export type Undo = (() => Promise<void>) & { commit?: () => Promise<void> };

export const newId = () => crypto.randomUUID();

const withCommit = (undo: () => Promise<void>, commit: () => Promise<void>): Undo => Object.assign(undo, { commit });

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

/** Photo changes saved together with an event (JCB-7). */
export interface PhotoChanges {
  /** New photos and their files; their ids come from useDraftIds, so a retry uploads to the same paths. */
  add?: { photo: Photo; files: PhotoFiles }[];
  /** Photos changed in place (description). */
  update?: { next: Photo; prev: Photo }[];
  /** Photos taken off the event; their files are removed once Undo is no longer offered. */
  remove?: Photo[];
}

/** A PDF to send with an event (JCB-76): its row, the file, and what the form wants to know while it goes. */
export interface DocumentUpload {
  doc: DocFile;
  file: Blob;
  /** Already sent by an earlier attempt of this Save: not sent again, its row is still saved. */
  skip?: boolean;
  /** 0 to 1 while it is sent. */
  onProgress?: (fraction: number) => void;
  onSent?: () => void;
  /** This one did not go: the form marks its row (Not sent. Retry). */
  onFail?: () => void;
}

/** PDF changes saved together with an event (JCB-76). */
export interface DocumentChanges {
  /** New PDFs and their files; their ids come from useDraftIds, so a retry uploads to the same paths. */
  add?: DocumentUpload[];
  /** PDFs renamed in place. */
  update?: { next: DocFile; prev: DocFile }[];
  /** PDFs taken off the event; their files are removed once Undo is no longer offered. */
  remove?: DocFile[];
}

/**
 * Save an event, its condition links, its photo changes and its PDF changes. `created`: conditions
 * made with "+ New" in the form, saved first so the event can link to them; Undo removes them again
 * after restoring the event. New photos' and PDFs' files are uploaded before anything else, so a slow
 * or failed upload leaves nothing half-saved (one failed PDF stops the whole save), and a retry writes
 * the same files and rows again.
 */
export async function saveEvent(
  repo: Repository,
  next: HealthEvent,
  prev: HealthEvent | null,
  created: Condition[] = [],
  photos: PhotoChanges = {},
  documents: DocumentChanges = {},
): Promise<Undo> {
  const { add = [], update = [], remove = [] } = photos;
  const { add: docAdd = [], update: docUpdate = [], remove: docRemove = [] } = documents;
  for (const a of add) await repo.uploadPhotoFiles(a.photo, a.files);
  for (const u of docAdd) {
    if (u.skip) continue;
    try {
      await repo.uploadDocumentFile(u.doc, u.file, u.onProgress);
    } catch (err) {
      u.onFail?.();
      throw err;
    }
    u.onSent?.();
  }
  for (const c of created) await repo.saveCondition(c);
  await repo.saveEvent(next);
  for (const a of add) await repo.savePhoto(a.photo);
  for (const u of update) await repo.savePhoto(u.next);
  for (const r of remove) await repo.deletePhoto(r.id);
  for (const u of docAdd) await repo.saveDocument(u.doc);
  for (const u of docUpdate) await repo.saveDocument(u.next);
  for (const r of docRemove) await repo.deleteDocument(r.id);
  const undo = async () => {
    if (prev) await repo.saveEvent(prev);
    else await repo.deleteEvent(next.id); // its photo and document rows go with it
    if (prev) for (const a of add) await repo.deletePhoto(a.photo.id);
    for (const u of update) await repo.savePhoto(u.prev);
    for (const r of remove) await repo.savePhoto(r);
    if (prev) for (const u of docAdd) await repo.deleteDocument(u.doc.id);
    for (const u of docUpdate) await repo.saveDocument(u.prev);
    for (const r of docRemove) await repo.saveDocument(r);
    for (const c of created) await repo.deleteCondition(c.id);
    if (add.length) await repo.purgePhotoFiles(add.map((a) => a.photo));
    if (docAdd.length) await repo.purgeDocumentFiles(docAdd.map((u) => u.doc));
  };
  return remove.length || docRemove.length ? withCommit(undo, () => purgeFiles(repo, remove, docRemove)) : undo;
}

/** Remove the files of photos and PDFs whose rows are gone. */
async function purgeFiles(repo: Repository, photos: Photo[], docs: DocFile[]) {
  if (photos.length) await repo.purgePhotoFiles(photos);
  if (docs.length) await repo.purgeDocumentFiles(docs);
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

/** Delete an event with its photos and PDFs (`photos`, `docs`: their rows, which go with it). Undo brings all back. */
export async function deleteEvent(repo: Repository, event: HealthEvent, photos: Photo[] = [], docs: DocFile[] = []): Promise<Undo> {
  await repo.deleteEvent(event.id);
  const undo = async () => {
    await repo.saveEvent(event);
    for (const p of photos) await repo.savePhoto(p);
    for (const d of docs) await repo.saveDocument(d);
  };
  return photos.length || docs.length ? withCommit(undo, () => purgeFiles(repo, photos, docs)) : undo;
}

/**
 * Delete one photo. A standalone photo event without other photos goes with it (an empty photo event
 * would mean nothing); a photo on a vet visit, symptom or note leaves the event as it is.
 */
export async function deletePhoto(repo: Repository, photo: Photo, event: HealthEvent, eventPhotos: Photo[]): Promise<Undo> {
  if (event.type === 'photo' && eventPhotos.every((p) => p.id === photo.id)) return deleteEvent(repo, event, [photo]);
  await repo.deletePhoto(photo.id);
  return withCommit(
    () => repo.savePhoto(photo),
    () => repo.purgePhotoFiles([photo]),
  );
}

/** Delete one PDF from an event (the event stays). Undo brings it back; its file goes once Undo is no longer offered. */
export async function deleteDocument(repo: Repository, doc: DocFile): Promise<Undo> {
  await repo.deleteDocument(doc.id);
  return withCommit(
    () => repo.saveDocument(doc),
    () => repo.purgeDocumentFiles([doc]),
  );
}

/** Rename a stored PDF. Undo puts the previous name back. */
export async function renameDocument(repo: Repository, next: DocFile, prev: DocFile): Promise<Undo> {
  await repo.saveDocument(next);
  return () => repo.saveDocument(prev);
}

/** Save a pinned note (new or edited). Undo puts back the previous text, or deletes the new note. */
export async function savePinnedNote(repo: Repository, next: PinnedNote, prev: PinnedNote | null): Promise<Undo> {
  await repo.savePinnedNote(next);
  return prev ? () => repo.restorePinnedNote(prev) : () => repo.deletePinnedNote(next.id);
}

export async function deletePinnedNote(repo: Repository, note: PinnedNote): Promise<Undo> {
  await repo.deletePinnedNote(note.id);
  return () => repo.restorePinnedNote(note);
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
