// Photos repository contract (JCB-7): the same scenarios against DemoRepository and against the real
// SupabaseRepository + supabase-js on the fake backend (PostgREST and Storage on Postgres with every
// migration, so the attachment RLS and the storage.objects policies apply). Plus storage-only checks:
// the bucket is private, files of another household cannot be read, only JPEG goes in.
import { afterEach, describe, expect, it } from 'vitest';
import { DemoRepository, type HealthEvent, type Photo, type PhotoFiles, type Repository } from '../src/data';
import { photoPath } from '../src/data';
import { deleteEvent, deletePhoto, saveEvent } from '../src/log/actions';
import { SEED } from './harness/fakeBackend';
import { createFakeSupabase, type FakeSupabase } from './harness/fakeSupabase';

const NOW = () => new Date(2026, 9, 15, 16, 30);
const uuid = () => crypto.randomUUID();
const jpeg = (n: number) => new Blob([new Uint8Array([0xff, 0xd8, n, 0xff, 0xd9])], { type: 'image/jpeg' });
const files = (n = 1): PhotoFiles => ({ full: jpeg(n), thumb: jpeg(n + 100) });

interface Subject {
  repo: Repository;
  /** File keys held by storage (Supabase) or the demo, to see what an operation left behind. */
  fileCount: () => Promise<number>;
  close: () => Promise<void>;
}

const subjects: [string, () => Promise<Subject>][] = [
  [
    'DemoRepository',
    async () => {
      const repo = new DemoRepository(null, NOW);
      return {
        repo,
        // The demo's added files are what photoUrls finds beyond the bundled samples.
        fileCount: async () => Object.keys((repo as unknown as { files: Record<string, unknown> }).files).length * 2,
        close: async () => {},
      };
    },
  ],
  [
    'SupabaseRepository',
    async () => {
      const fake = await createFakeSupabase({ start: '2026-10-01' });
      return { repo: fake.repository(NOW), fileCount: async () => fake.backend.files().length, close: () => fake.backend.close() };
    },
  ],
];

describe.each(subjects)('%s photos', (_name, make) => {
  let subject: Subject | null = null;
  afterEach(async () => {
    await subject?.close();
    subject = null;
  });

  async function setup() {
    subject = await make();
    const dog = await subject.repo.getDog();
    const photoEvent = (date = '2026-10-12'): HealthEvent => ({ id: uuid(), dogId: dog.id, date, type: 'photo', title: '', detail: 'Lump, left side', conditionIds: [] });
    const photo = (eventId: string, position = 0): Photo => ({
      id: uuid(),
      dogId: dog.id,
      eventId,
      width: 1600,
      height: 1200,
      takenAt: '2026-10-12T09:41:00',
      caption: '',
      position,
    });
    const before = (await subject.repo.listPhotos()).length;
    const mine = async () => (await subject!.repo.listPhotos()).slice(before);
    return { ...subject, dog, photoEvent, photo, mine, before };
  }

  it('a new photo event: files first, then event and photo; it lists and has URLs', async () => {
    const { repo, photoEvent, photo, mine, fileCount } = await setup();
    const files0 = await fileCount();
    const e = photoEvent();
    const p = photo(e.id);
    await saveEvent(repo, e, null, [], { add: [{ photo: p, files: files() }] });
    expect(await mine()).toEqual([p]);
    expect(await fileCount()).toBe(files0 + 2);
    const thumbs = await repo.photoUrls([p], 'thumb');
    const full = await repo.photoUrls([p], 'full');
    expect(thumbs[p.id]).toBeTruthy();
    expect(full[p.id]).toBeTruthy();
    expect(thumbs[p.id]).not.toBe(full[p.id]);
  });

  it('retrying a save with the same ids writes the same files and row, never copies', async () => {
    const { repo, photoEvent, photo, mine, fileCount } = await setup();
    const files0 = await fileCount();
    const e = photoEvent();
    const p = photo(e.id);
    await repo.uploadPhotoFiles(p, files(1));
    // The first attempt "failed" after the upload; the retry sends everything again.
    await saveEvent(repo, e, null, [], { add: [{ photo: p, files: files(2) }] });
    await saveEvent(repo, e, null, [], { add: [{ photo: p, files: files(3) }] });
    expect(await mine()).toEqual([p]);
    expect(await fileCount()).toBe(files0 + 2);
  });

  it('Undo of a new photo removes the event, the row and its files', async () => {
    const { repo, photoEvent, photo, mine, fileCount } = await setup();
    const files0 = await fileCount();
    const e = photoEvent();
    const p = photo(e.id);
    const undo = await saveEvent(repo, e, null, [], { add: [{ photo: p, files: files() }] });
    await undo();
    expect(await mine()).toEqual([]);
    expect((await repo.listEvents()).some((x) => x.id === e.id)).toBe(false);
    expect(await fileCount()).toBe(files0);
  });

  it('deleting the only photo of a photo event deletes the event; Undo restores both, files stay until commit', async () => {
    const { repo, photoEvent, photo, mine, fileCount } = await setup();
    const e = photoEvent();
    const p = photo(e.id);
    await saveEvent(repo, e, null, [], { add: [{ photo: p, files: files() }] });
    const files1 = await fileCount();
    const undo = await deletePhoto(repo, p, e, [p]);
    expect(await mine()).toEqual([]);
    expect((await repo.listEvents()).some((x) => x.id === e.id)).toBe(false);
    expect(await fileCount()).toBe(files1); // still there for Undo
    await undo();
    expect(await mine()).toEqual([p]);
    expect((await repo.listEvents()).find((x) => x.id === e.id)?.detail).toBe('Lump, left side');
    expect((await repo.photoUrls([p], 'full'))[p.id]).toBeTruthy();
    // Undo used: its commit never runs. Delete again and let the toast go: then the files go.
    const again = await deletePhoto(repo, p, e, [p]);
    await again.commit?.();
    expect(await fileCount()).toBe(files1 - 2);
    expect(await repo.photoUrls([p], 'full')).toEqual({});
  });

  it('a photo on a vet visit: deleting it keeps the visit; files of photos still saved are never purged', async () => {
    const { repo, dog, photo, mine, fileCount } = await setup();
    const visit: HealthEvent = { id: uuid(), dogId: dog.id, date: '2026-10-14', type: 'vet', title: 'Maple Vet', detail: 'Check-up', conditionIds: [] };
    const a = photo(visit.id, 0);
    const b = { ...photo(visit.id, 1), caption: 'Right side' };
    await saveEvent(repo, visit, null, [], { add: [{ photo: a, files: files(1) }, { photo: b, files: files(2) }] });
    expect((await mine()).sort((x, y) => x.position - y.position)).toEqual([a, b]);
    const files2 = await fileCount();
    await repo.purgePhotoFiles([a, b]); // both rows exist: nothing goes
    expect(await fileCount()).toBe(files2);
    const undo = await deletePhoto(repo, a, visit, [a, b]);
    expect(await mine()).toEqual([b]);
    expect((await repo.listEvents()).some((x) => x.id === visit.id)).toBe(true);
    await undo();
    expect((await mine()).length).toBe(2);
  });

  it('deleting an event deletes its photo rows; Undo brings them back', async () => {
    const { repo, dog, photo, mine } = await setup();
    const note: HealthEvent = { id: uuid(), dogId: dog.id, date: '2026-10-13', type: 'note', title: '', detail: 'Itchy', conditionIds: [] };
    const p = photo(note.id);
    await saveEvent(repo, note, null, [], { add: [{ photo: p, files: files() }] });
    const undo = await deleteEvent(repo, note, [p]);
    expect(await mine()).toEqual([]);
    await undo();
    expect(await mine()).toEqual([p]);
  });

  it('a description edit and a replaced picture update in place; Undo restores the old ones', async () => {
    const { repo, dog, photo, mine, fileCount } = await setup();
    const visit: HealthEvent = { id: uuid(), dogId: dog.id, date: '2026-10-14', type: 'vet', title: '', detail: 'Check-up', conditionIds: [] };
    const a = photo(visit.id);
    await saveEvent(repo, visit, null, [], { add: [{ photo: a, files: files() }] });
    const edited = { ...a, caption: 'Left side' };
    const undoEdit = await saveEvent(repo, visit, visit, [], { update: [{ next: edited, prev: a }] });
    expect(await mine()).toEqual([edited]);
    await undoEdit();
    expect(await mine()).toEqual([a]);
    const files1 = await fileCount();
    const replacement = photo(visit.id);
    const undoChange = await saveEvent(repo, visit, visit, [], { add: [{ photo: replacement, files: files(5) }], remove: [a] });
    expect(await mine()).toEqual([replacement]);
    await undoChange();
    expect(await mine()).toEqual([a]);
    expect(await fileCount()).toBe(files1); // the replacement's files went with its Undo
  });

  it('a photo needs its event', async () => {
    const { repo, photo } = await setup();
    await expect(repo.savePhoto(photo(uuid()))).rejects.toThrow();
  });
});

describe('photo storage on the fake Supabase', () => {
  let fake: FakeSupabase | null = null;
  afterEach(async () => {
    await fake?.backend.close();
    fake = null;
  });

  const OTHER_DOG = '20000000-0000-4000-8000-00000000000b';
  const STRANGER = '00000000-0000-4000-8000-0000000000b1';
  async function withPhoto() {
    fake = await createFakeSupabase({ start: '2026-10-01' });
    const repo = fake.repository(NOW);
    const e: HealthEvent = { id: uuid(), dogId: SEED.dog, date: '2026-10-12', type: 'photo', title: '', detail: '', conditionIds: [] };
    const p: Photo = { id: uuid(), dogId: SEED.dog, eventId: e.id, width: 1600, height: 1200, takenAt: '2026-10-12T09:41:00', caption: '', position: 0 };
    await saveEvent(repo, e, null, [], { add: [{ photo: p, files: files(7) }] });
    return { repo, e, p };
  }

  it('stores the row with its path and the photo date; files are private and read through signed URLs', async () => {
    const { repo, p } = await withPhoto();
    const [row] = await fake!.backend.sql<Record<string, unknown>>(`select storage_path, taken_at::text, kind from attachment`);
    expect(row).toEqual({ storage_path: photoPath(p), taken_at: '2026-10-12 09:41:00', kind: 'photo' });
    expect(fake!.backend.files()).toEqual([`photos/${photoPath(p)}`, `photos/${photoPath(p, 'thumb')}`].sort());
    const url = (await repo.photoUrls([p], 'full'))[p.id] as string;
    expect(url).toMatch(/\/storage\/v1\/object\/sign\/photos\/.+\.jpg\?token=/);
    const body = new Uint8Array(await (await fake!.backend.fetch(url)).arrayBuffer());
    expect([...body]).toEqual([0xff, 0xd8, 7, 0xff, 0xd9]);
    // No public URL, ever.
    const pub = await fake!.backend.fetch(url.replace(/\/sign\//, '/public/').replace(/\?.*$/, ''));
    expect(pub.status).toBe(400);
  });

  it('signed URLs are reused while fresh, so the browser can cache the picture', async () => {
    const { repo, p } = await withPhoto();
    const first = await repo.photoUrls([p], 'thumb');
    const signs = () => fake!.backend.log.filter((r) => r.table === 'storage' && r.query.includes('/object/sign/')).length;
    const before = signs();
    expect(await repo.photoUrls([p], 'thumb')).toEqual(first);
    expect(signs()).toBe(before);
  });

  it('another household can neither read, replace nor delete the files', async () => {
    const { p } = await withPhoto();
    await fake!.backend.db.exec(`
      insert into auth.users (id, email) values ('${STRANGER}', 'b1@example.test');
      insert into public.household (id, name) values ('10000000-0000-4000-8000-00000000000b', 'Household B');
      insert into public.member (household_id, user_id) values ('10000000-0000-4000-8000-00000000000b', '${STRANGER}');
      insert into public.dog (id, household_id, name) values ('${OTHER_DOG}', '10000000-0000-4000-8000-00000000000b', 'Dog B');`);
    fake!.backend.setUser(STRANGER);
    const theirs = fake!.repository(NOW);
    expect(await theirs.photoUrls([p], 'full')).toEqual({});
    expect(await theirs.listPhotos()).toEqual([]);
    await expect(theirs.uploadPhotoFiles(p, files(9))).rejects.toMatchObject({ code: '403' });
    await theirs.purgePhotoFiles([p]); // the policy hides household A's files: nothing is removed
    expect(fake!.backend.files()).toHaveLength(2);
    // Their own dog's folder works for them.
    const own: Photo = { ...p, id: uuid(), dogId: OTHER_DOG };
    await theirs.uploadPhotoFiles(own, files(3));
    expect(fake!.backend.files()).toHaveLength(4);
  });

  it('the bucket takes JPEG only', async () => {
    const { p } = await withPhoto();
    const res = await fake!.backend.fetch(`https://fake-project.supabase.test/storage/v1/object/photos/${SEED.dog}/${p.id}.jpg`, {
      method: 'POST',
      headers: { 'content-type': 'image/png', 'x-upsert': 'true' },
      body: new Uint8Array([1, 2, 3]),
    });
    expect(res.status).toBe(415);
  });
});
