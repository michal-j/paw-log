// Photos (JCB-7): pure derivations for the Day view, the condition page, the viewer and the Timeline.
// No React, no I/O: unit-tested in tests/photos.test.ts.
import type { HealthEvent, Photo, PlainDate } from '../data';
import { EVENT_ORDER } from '../day/model';

/** A photo with the event it belongs to (its date, links and, for a standalone photo, its description). */
export interface PhotoItem {
  photo: Photo;
  event: HealthEvent;
}

const byPosition = (a: Photo, b: Photo) => a.position - b.position || a.id.localeCompare(b.id);

/** An event's photos in their order. */
export function photosOf(eventId: string, photos: Photo[]): Photo[] {
  return photos.filter((p) => p.eventId === eventId).sort(byPosition);
}

/** Events that have at least one photo (the Timeline shows its camera badge on their days). */
export function eventsWithPhotos(photos: Photo[]): Set<string> {
  return new Set(photos.map((p) => p.eventId));
}

/** Oldest first: by event date, then the Day view's card order, then position. */
function ordered(events: HealthEvent[], photos: Photo[]): PhotoItem[] {
  const sorted = [...events].sort(
    (a, b) => a.date.localeCompare(b.date) || EVENT_ORDER.indexOf(a.type) - EVENT_ORDER.indexOf(b.type) || a.id.localeCompare(b.id),
  );
  return sorted.flatMap((event) => photosOf(event.id, photos).map((photo) => ({ photo, event })));
}

/**
 * A condition's photos: those of the events linked to it, oldest first (the strip runs left to right
 * in time and the viewer pages through them in the same order).
 */
export function conditionPhotos(conditionId: string, events: HealthEvent[], photos: Photo[]): PhotoItem[] {
  return ordered(
    events.filter((e) => e.conditionIds.includes(conditionId)),
    photos,
  );
}

/** One day's photos, in the order of the Day view's cards. */
export function dayPhotos(date: PlainDate, events: HealthEvent[], photos: Photo[]): PhotoItem[] {
  return ordered(
    events.filter((e) => e.date === date),
    photos,
  );
}

/** What a photo shows, as typed: its own description, or its standalone photo event's. */
export function photoCaption({ photo, event }: PhotoItem): string {
  return photo.caption || (event.type === 'photo' ? event.detail : '');
}

/** The date a picked photo suggests for its event: the day it was taken, never after today. */
export function photoDate(takenAt: string | null, today: PlainDate): PlainDate | null {
  const date = takenAt?.slice(0, 10) ?? null;
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  return date > today ? today : date;
}

/** Position for a photo added after `existing`. */
export const nextPosition = (existing: Photo[]) => existing.reduce((max, p) => Math.max(max, p.position + 1), 0);
