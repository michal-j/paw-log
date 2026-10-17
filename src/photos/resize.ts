// Photos are made small on the phone before they are stored (JCB-7): a JPEG with the long edge at
// about 1600 px (a few hundred KB instead of several MB) plus a small copy for strips and lists.
// Drawing the picture onto a canvas and encoding it again keeps no metadata at all, so the location
// (GPS) and camera details never leave the phone. The one thing kept is when the photo was taken: it
// is read from the original first and stored with the photo (Photo.takenAt), and the form uses its
// date as the event's date by default.

/** Long edge of the stored photo, px. */
export const FULL_EDGE = 1600;
/** Long edge of the small copy: enough for a 104 px square at 3x. */
export const THUMB_EDGE = 480;
export const FULL_QUALITY = 0.82;
export const THUMB_QUALITY = 0.75;

/** The size that fits `max` on the long edge, keeping the aspect ratio; never larger than the original. */
export function fitWithin(width: number, height: number, max: number): { width: number; height: number } {
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

/** EXIF `YYYY:MM:DD HH:MM:SS` → `YYYY-MM-DDTHH:MM:SS`; null when it is not a real date. */
export function exifDateTime(text: string): string | null {
  const m = /^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/.exec(text.trim());
  if (!m) return null;
  const [, y, mo, d, h, mi, s] = m.map(Number) as [number, number, number, number, number, number, number];
  const date = new Date(Date.UTC(y, mo - 1, d));
  const valid =
    y >= 1990 && date.getUTCMonth() === mo - 1 && date.getUTCDate() === d && h < 24 && mi < 60 && s < 60;
  return valid ? `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}` : null;
}

/**
 * When a JPEG was taken, from its EXIF data: DateTimeOriginal, else DateTimeDigitized, else
 * DateTime. Null for anything else (PNG, no EXIF, a broken file). Reads only the APP1 segment.
 */
export function readTakenAt(buffer: ArrayBuffer): string | null {
  const view = new DataView(buffer);
  if (view.byteLength < 4 || view.getUint16(0) !== 0xffd8) return null;
  let offset = 2;
  while (offset + 4 <= view.byteLength) {
    const marker = view.getUint16(offset);
    if ((marker & 0xff00) !== 0xff00 || marker === 0xffda) return null; // not a marker, or image data starts
    const length = view.getUint16(offset + 2);
    if (marker === 0xffe1 && offset + 10 <= view.byteLength && view.getUint32(offset + 4) === 0x45786966 /* "Exif" */) {
      return readExif(view, offset + 10, Math.min(view.byteLength, offset + 2 + length));
    }
    offset += 2 + length;
  }
  return null;
}

const DATE_TIME = 0x0132;
const EXIF_IFD = 0x8769;
const DATE_TIME_ORIGINAL = 0x9003;
const DATE_TIME_DIGITIZED = 0x9004;

function readExif(view: DataView, tiff: number, end: number): string | null {
  if (tiff + 8 > end) return null;
  const order = view.getUint16(tiff);
  if (order !== 0x4949 && order !== 0x4d4d) return null;
  const little = order === 0x4949;
  const u16 = (at: number) => (at + 2 <= end ? view.getUint16(at, little) : null);
  const u32 = (at: number) => (at + 4 <= end ? view.getUint32(at, little) : null);
  /** Tag → [type, count, value or offset] of one IFD. */
  const ifd = (start: number) => {
    const tags = new Map<number, { type: number; count: number; value: number }>();
    const n = u16(start);
    if (n === null) return tags;
    for (let i = 0; i < n; i++) {
      const at = start + 2 + i * 12;
      const tag = u16(at);
      const type = u16(at + 2);
      const count = u32(at + 4);
      const value = u32(at + 8);
      if (tag === null || type === null || count === null || value === null) break;
      tags.set(tag, { type, count, value });
    }
    return tags;
  };
  const ascii = (entry: { type: number; count: number; value: number } | undefined) => {
    if (!entry || entry.type !== 2 || entry.count < 19) return null;
    const at = tiff + entry.value;
    if (at + 19 > end) return null;
    let text = '';
    for (let i = 0; i < 19; i++) text += String.fromCharCode(view.getUint8(at + i));
    return exifDateTime(text);
  };
  const first = u32(tiff + 4);
  if (first === null) return null;
  const ifd0 = ifd(tiff + first);
  const exifAt = ifd0.get(EXIF_IFD);
  const exif = exifAt ? ifd(tiff + exifAt.value) : new Map<number, { type: number; count: number; value: number }>();
  return ascii(exif.get(DATE_TIME_ORIGINAL)) ?? ascii(exif.get(DATE_TIME_DIGITIZED)) ?? ascii(ifd0.get(DATE_TIME));
}

export interface PreparedPhoto {
  full: Blob;
  thumb: Blob;
  width: number;
  height: number;
  takenAt: string | null;
}

/** The picture could not be decoded (a format this browser cannot read, or a broken file). */
export class UnreadablePhotoError extends Error {
  constructor() {
    super('The photo could not be read.');
    this.name = 'UnreadablePhotoError';
  }
}

type Drawable = { source: CanvasImageSource; width: number; height: number; close: () => void };

/** Decode with the camera's orientation applied (portrait photos stay upright). */
async function decode(file: Blob): Promise<Drawable> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
      return { source: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() };
    } catch {
      /* fall back to an <img> (older Safari) */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    return { source: img, width: img.naturalWidth, height: img.naturalHeight, close: () => URL.revokeObjectURL(url) };
  } catch {
    URL.revokeObjectURL(url);
    throw new UnreadablePhotoError();
  }
}

function encode(image: Drawable, edge: number, quality: number): Promise<{ blob: Blob; width: number; height: number }> {
  const { width, height } = fitWithin(image.width, image.height, edge);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return Promise.reject(new UnreadablePhotoError());
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(image.source, 0, 0, width, height);
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => {
        // Free the canvas memory at once (iOS limits the total canvas size).
        canvas.width = 0;
        canvas.height = 0;
        if (blob) resolve({ blob, width, height });
        else reject(new UnreadablePhotoError());
      },
      'image/jpeg',
      quality,
    ),
  );
}

/** Resize a picked or taken photo: the stored JPEG, its small copy, its size and when it was taken. */
export async function preparePhoto(file: Blob): Promise<PreparedPhoto> {
  const takenAt = readTakenAt(await file.slice(0, 256 * 1024).arrayBuffer());
  const image = await decode(file);
  try {
    if (!image.width || !image.height) throw new UnreadablePhotoError();
    const full = await encode(image, FULL_EDGE, FULL_QUALITY);
    const thumb = await encode(image, THUMB_EDGE, THUMB_QUALITY);
    return { full: full.blob, thumb: thumb.blob, width: full.width, height: full.height, takenAt };
  } finally {
    image.close();
  }
}
