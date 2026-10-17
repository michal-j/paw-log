// Photos (JCB-7): the resize helpers (EXIF date, sizes) and the pure model (strip order, day order,
// captions, the Timeline's one camera badge per day). The canvas work itself needs a browser and is
// checked in the harness and on the iPhone (TEST-CASES).
import { describe, expect, it } from 'vitest';
import type { HealthEvent, Photo } from '../src/data';
import { photoPath } from '../src/data';
import { conditionPhotos, dayPhotos, eventsWithPhotos, nextPosition, photoCaption, photoDate, photosOf } from '../src/photos/model';
import { FULL_EDGE, THUMB_EDGE, exifDateTime, fitWithin, readTakenAt } from '../src/photos/resize';
import { badgesFor, buildTimeline } from '../src/timeline/model';

/** A minimal JPEG: SOI, an APP1 Exif segment with the given IFD0 / Exif IFD dates (and a GPS IFD), SOS. */
function jpegWithExif({ original, dateTime, little = true }: { original?: string; dateTime?: string; little?: boolean }): ArrayBuffer {
  const tiff: number[] = [];
  const u16 = (n: number) => (little ? [n & 0xff, n >> 8] : [n >> 8, n & 0xff]);
  const u32 = (n: number) => (little ? [n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, n >>> 24] : [n >>> 24, (n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff]);
  const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0)).concat(0);
  // Layout: header (8) | IFD0 at 8 with 3 entries (2 + 36 + 4 = 42) | Exif IFD at 50 with 1 entry (18) | GPS IFD at 68 (6) | strings at 74
  const strings: number[] = [];
  const at = (s: string) => {
    const off = 74 + strings.length;
    strings.push(...ascii(s));
    return off;
  };
  const dtOff = dateTime ? at(dateTime) : 0;
  const origOff = original ? at(original) : 0;
  tiff.push(...(little ? [0x49, 0x49] : [0x4d, 0x4d]), ...u16(42), ...u32(8));
  tiff.push(...u16(3));
  tiff.push(...u16(0x0132), ...u16(dateTime ? 2 : 4), ...u32(20), ...u32(dtOff)); // DateTime
  tiff.push(...u16(0x8769), ...u16(4), ...u32(1), ...u32(50)); // Exif IFD
  tiff.push(...u16(0x8825), ...u16(4), ...u32(1), ...u32(68)); // GPS IFD (location: never read, never kept)
  tiff.push(...u32(0));
  tiff.push(...u16(1), ...u16(0x9003), ...u16(original ? 2 : 4), ...u32(20), ...u32(origOff), ...u32(0));
  tiff.push(...u16(0), ...u32(0));
  tiff.push(...strings);
  const app1 = [0x45, 0x78, 0x69, 0x66, 0, 0, ...tiff];
  const len = app1.length + 2;
  const bytes = [0xff, 0xd8, 0xff, 0xe1, len >> 8, len & 0xff, ...app1, 0xff, 0xda, 0, 2];
  return new Uint8Array(bytes).buffer;
}

describe('resize helpers', () => {
  it('fits the long edge, keeps the ratio and never enlarges', () => {
    expect(fitWithin(4032, 3024, FULL_EDGE)).toEqual({ width: 1600, height: 1200 });
    expect(fitWithin(3024, 4032, FULL_EDGE)).toEqual({ width: 1200, height: 1600 });
    expect(fitWithin(8064, 6048, THUMB_EDGE)).toEqual({ width: 480, height: 360 });
    expect(fitWithin(800, 600, FULL_EDGE)).toEqual({ width: 800, height: 600 });
    expect(fitWithin(5000, 10, FULL_EDGE)).toEqual({ width: 1600, height: 3 });
  });

  it('reads EXIF date-times and refuses impossible ones', () => {
    expect(exifDateTime('2026:10:10 09:05:31')).toBe('2026-10-10T09:05:31');
    expect(exifDateTime('0000:00:00 00:00:00')).toBeNull();
    expect(exifDateTime('2026:02:30 10:00:00')).toBeNull();
    expect(exifDateTime('2026:10:10 25:00:00')).toBeNull();
    expect(exifDateTime('')).toBeNull();
  });

  it('takes the date the photo was taken from DateTimeOriginal, in either byte order', () => {
    expect(readTakenAt(jpegWithExif({ original: '2026:10:03 09:12:40', dateTime: '2026:10:14 18:00:00' }))).toBe('2026-10-03T09:12:40');
    expect(readTakenAt(jpegWithExif({ original: '2026:10:03 09:12:40', little: false }))).toBe('2026-10-03T09:12:40');
  });

  it('falls back to DateTime, and gives null without EXIF or for other formats', () => {
    expect(readTakenAt(jpegWithExif({ dateTime: '2026:10:14 18:00:00' }))).toBe('2026-10-14T18:00:00');
    expect(readTakenAt(jpegWithExif({}))).toBeNull();
    expect(readTakenAt(new Uint8Array([0xff, 0xd8, 0xff, 0xda, 0, 2]).buffer)).toBeNull();
    expect(readTakenAt(new Uint8Array([0x89, 0x50, 0x4e, 0x47]).buffer)).toBeNull(); // PNG
    expect(readTakenAt(new Uint8Array(jpegWithExif({ original: '2026:10:03 09:12:40' })).slice(0, 30).buffer)).toBeNull(); // cut off
  });

  it('uses the photo date for the event, never after today', () => {
    expect(photoDate('2026-10-03T09:12:40', '2026-10-15')).toBe('2026-10-03');
    expect(photoDate('2027-01-01T00:00:00', '2026-10-15')).toBe('2026-10-15');
    expect(photoDate(null, '2026-10-15')).toBeNull();
  });

  it('stores files under <dog>/<id>.jpg and <dog>/<id>.thumb.jpg', () => {
    expect(photoPath({ id: 'p1', dogId: 'd1' })).toBe('d1/p1.jpg');
    expect(photoPath({ id: 'p1', dogId: 'd1' }, 'thumb')).toBe('d1/p1.thumb.jpg');
  });
});

const ev = (id: string, date: string, type: HealthEvent['type'], conditionIds: string[] = [], detail = ''): HealthEvent => ({
  id,
  dogId: 'd',
  date,
  type,
  title: '',
  detail,
  conditionIds,
});
const ph = (id: string, eventId: string, position = 0, caption = ''): Photo => ({
  id,
  dogId: 'd',
  eventId,
  width: 1600,
  height: 1200,
  takenAt: null,
  caption,
  position,
});

describe('photo model', () => {
  const events = [
    ev('vet', '2026-10-14', 'vet', ['lump']),
    ev('p10', '2026-10-10', 'photo', ['lump'], 'Same size'),
    ev('p03', '2026-10-03', 'photo', ['lump'], 'About 1 cm'),
    ev('sym', '2026-10-14', 'symptom', []),
    ev('p14', '2026-10-14', 'photo', []),
  ];
  const photos = [ph('a', 'p10'), ph('b', 'p03'), ph('c2', 'vet', 1, 'Right side'), ph('c1', 'vet', 0), ph('d', 'p14'), ph('e', 'sym')];

  it("a condition's photos run oldest first, an event's by position", () => {
    expect(conditionPhotos('lump', events, photos).map((x) => x.photo.id)).toEqual(['b', 'a', 'c1', 'c2']);
    expect(photosOf('vet', photos).map((p) => p.id)).toEqual(['c1', 'c2']);
    expect(conditionPhotos('none', events, photos)).toEqual([]);
  });

  it("a day's photos follow the Day view's card order (vet, symptoms, photo)", () => {
    expect(dayPhotos('2026-10-14', events, photos).map((x) => x.photo.id)).toEqual(['c1', 'c2', 'e', 'd']);
  });

  it('a standalone photo shows its event description; an attached one its own', () => {
    const items = conditionPhotos('lump', events, photos);
    expect(items.map(photoCaption)).toEqual(['About 1 cm', 'Same size', '', 'Right side']);
  });

  it('new photos go after the existing ones', () => {
    expect(nextPosition([])).toBe(0);
    expect(nextPosition(photosOf('vet', photos))).toBe(2);
  });

  it('the Timeline shows one camera badge on a day with photos, however many', () => {
    const withPhotos = eventsWithPhotos(photos);
    const day14 = events.filter((e) => e.date === '2026-10-14');
    expect(badgesFor(day14, withPhotos).filter((b) => b.kind === 'photo')).toHaveLength(1);
    // A vet visit with photos and no photo event still gets the badge.
    expect(badgesFor([ev('v', '2026-10-01', 'vet')], new Set(['v'])).map((b) => b.kind)).toEqual(['vet', 'photo']);
    expect(badgesFor([ev('v', '2026-10-01', 'vet')]).map((b) => b.kind)).toEqual(['vet']);
    const timeline = buildTimeline({ today: '2026-10-15', items: [], entries: [], events, withPhotos });
    const row = timeline.rows.find((r) => r.kind === 'day' && r.date === '2026-10-14');
    expect(row && row.kind === 'day' && row.badges.map((b) => b.kind)).toEqual(['vet', 'sym', 'photo']);
    expect(row?.height).toBe(44);
  });
});
