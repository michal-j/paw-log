// PDF documents repository contract (JCB-76): the same scenarios against DemoRepository and against the
// real SupabaseRepository + supabase-js on the fake backend (PostgREST and Storage on Postgres with
// every migration, so the attachment constraints, RLS and the storage.objects policies apply). Plus
// storage-only checks: the bucket is private, PDF only, 10 MB, and other households are kept out.
import { afterEach, describe, expect, it } from 'vitest';
import { DemoRepository, documentPath, type DocFile, type HealthEvent, type Photo, type Repository } from '../src/data';
import { deleteDocument, deleteEvent, renameDocument, saveEvent, type DocumentUpload } from '../src/log/actions';
import { SEED } from './harness/fakeBackend';
import { createFakeSupabase, type FakeSupabase } from './harness/fakeSupabase';

const NOW = () => new Date(2026, 9, 15, 16, 30);
const uuid = () => crypto.randomUUID();
const pdf = (n = 1) => new Blob([`%PDF-1.4\n% ${n}\n%%EOF`], { type: 'application/pdf' });

interface Subject {
  repo: Repository;
  /** Document files held by storage (Supabase) or the demo, to see what an operation left behind. */
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
        fileCount: async () => Object.keys((repo as unknown as { docFiles: Record<string, unknown> }).docFiles).length,
        close: async () => {},
      };
    },
  ],
  [
    'SupabaseRepository',
    async () => {
      const fake = await createFakeSupabase({ start: '2026-10-01' });
      return {
        repo: fake.repository(NOW),
        fileCount: async () => fake.backend.files().filter((f) => f.startsWith('documents/')).length,
        close: () => fake.backend.close(),
      };
    },
  ],
];

describe.each(subjects)('%s documents', (_name, make) => {
  let subject: Subject | null = null;
  afterEach(async () => {
    await subject?.close();
    subject = null;
  });

  async function setup() {
    subject = await make();
    const dog = await subject.repo.getDog();
    const visit = (): HealthEvent => ({ id: uuid(), dogId: dog.id, date: '2026-10-14', type: 'vet', title: 'Maple Vet', detail: 'Check-up', conditionIds: [] });
    const document = (eventId: string, position = 0): DocFile => ({ id: uuid(), dogId: dog.id, eventId, name: 'Ultrasound report', sizeBytes: 1_258_291, pageCount: 3, position });
    const up = (d: DocFile, n = 1, extra: Partial<DocumentUpload> = {}): DocumentUpload => ({ doc: d, file: pdf(n), ...extra });
    const before = (await subject.repo.listDocuments()).length;
    const mine = async () => (await subject!.repo.listDocuments()).slice(before);
    return { ...subject, dog, visit, document, up, mine };
  }

  it('a new document: file first, then event and row; it lists and has a URL', async () => {
    const { repo, visit, document, up, mine, fileCount } = await setup();
    const files0 = await fileCount();
    const e = visit();
    const d = document(e.id);
    await saveEvent(repo, e, null, [], {}, { add: [up(d)] });
    expect(await mine()).toEqual([d]);
    expect(await fileCount()).toBe(files0 + 1);
    expect((await repo.documentUrls([d]))[d.id]).toBeTruthy();
    // Photos are not documents.
    expect((await repo.listPhotos()).some((p: Photo) => p.id === d.id)).toBe(false);
  });

  it('progress is reported while a file goes', async () => {
    const { repo, visit, document, up } = await setup();
    const e = visit();
    const seen: number[] = [];
    await saveEvent(repo, e, null, [], {}, { add: [up(document(e.id), 1, { onProgress: (f) => seen.push(f) })] });
    expect(seen.length).toBeGreaterThan(0);
    expect(seen.at(-1)).toBe(1);
  });

  it('retrying a save with the same ids writes the same file and row, never copies', async () => {
    const { repo, visit, document, up, mine, fileCount } = await setup();
    const files0 = await fileCount();
    const e = visit();
    const d = document(e.id);
    await repo.uploadDocumentFile(d, pdf(1)); // the first attempt "failed" after the upload
    await saveEvent(repo, e, null, [], {}, { add: [up(d, 2)] });
    await saveEvent(repo, e, null, [], {}, { add: [up(d, 3)] });
    expect(await mine()).toEqual([d]);
    expect(await fileCount()).toBe(files0 + 1);
  });

  it('a document already sent by an earlier attempt is not sent again, but its row is saved', async () => {
    const { repo, visit, document, up, mine } = await setup();
    const e = visit();
    const d = document(e.id);
    await repo.uploadDocumentFile(d, pdf(1));
    let sends = 0;
    const orig = repo.uploadDocumentFile.bind(repo);
    repo.uploadDocumentFile = async (...a) => ((sends += 1), orig(...a));
    await saveEvent(repo, e, null, [], {}, { add: [up(d, 1, { skip: true })] });
    expect(sends).toBe(0);
    expect(await mine()).toEqual([d]);
  });

  it('one failed upload stops the whole save: no event, no rows; the others stay uploaded for the retry', async () => {
    const { repo, visit, document, up, mine } = await setup();
    const e = visit();
    const a = document(e.id, 0);
    const b = document(e.id, 1);
    const orig = repo.uploadDocumentFile.bind(repo);
    repo.uploadDocumentFile = async (d, f, p) => {
      if (d.id === b.id) throw new Error('offline');
      return orig(d, f, p);
    };
    const events: string[] = [];
    await expect(
      saveEvent(repo, e, null, [], {}, { add: [up(a, 1, { onSent: () => events.push('sent a') }), up(b, 2, { onFail: () => events.push('failed b') })] }),
    ).rejects.toThrow('offline');
    expect(events).toEqual(['sent a', 'failed b']);
    expect(await mine()).toEqual([]);
    expect((await repo.listEvents()).some((x) => x.id === e.id)).toBe(false);
  });

  it('Undo of a new visit with a document removes the event, the row and its file', async () => {
    const { repo, visit, document, up, mine, fileCount } = await setup();
    const files0 = await fileCount();
    const e = visit();
    const undo = await saveEvent(repo, e, null, [], {}, { add: [up(document(e.id))] });
    await undo();
    expect(await mine()).toEqual([]);
    expect(await fileCount()).toBe(files0);
  });

  it('adding to a saved visit: Undo removes just the new document', async () => {
    const { repo, visit, document, up, mine } = await setup();
    const e = visit();
    const first = document(e.id, 0);
    await saveEvent(repo, e, null, [], {}, { add: [up(first)] });
    const second = document(e.id, 1);
    const undo = await saveEvent(repo, e, e, [], {}, { add: [up(second)] });
    expect((await mine()).map((d) => d.id).sort()).toEqual([first.id, second.id].sort());
    await undo();
    expect(await mine()).toEqual([first]);
    expect((await repo.listEvents()).some((x) => x.id === e.id)).toBe(true);
  });

  it('removing a document: the row goes at once, the file waits for the end of Undo; Undo brings it back', async () => {
    const { repo, visit, document, up, mine, fileCount } = await setup();
    const e = visit();
    const d = document(e.id);
    await saveEvent(repo, e, null, [], {}, { add: [up(d)] });
    const files1 = await fileCount();
    const undo = await deleteDocument(repo, d);
    expect(await mine()).toEqual([]);
    expect(await fileCount()).toBe(files1);
    await undo();
    expect(await mine()).toEqual([d]);
    expect((await repo.documentUrls([d]))[d.id]).toBeTruthy();
    // Undo not used: the toast ends, the commit removes the file.
    const again = await deleteDocument(repo, d);
    await again.commit?.();
    expect(await fileCount()).toBe(files1 - 1);
    expect(await repo.documentUrls([d])).toEqual({});
  });

  it('files of documents still saved are never purged', async () => {
    const { repo, visit, document, up, fileCount } = await setup();
    const e = visit();
    const d = document(e.id);
    await saveEvent(repo, e, null, [], {}, { add: [up(d)] });
    const files1 = await fileCount();
    await repo.purgeDocumentFiles([d]);
    expect(await fileCount()).toBe(files1);
  });

  it('renaming updates in place; Undo puts the old name back', async () => {
    const { repo, visit, document, up, mine } = await setup();
    const e = visit();
    const d = document(e.id);
    await saveEvent(repo, e, null, [], {}, { add: [up(d)] });
    const renamed = { ...d, name: 'Blood count' };
    const undo = await renameDocument(repo, renamed, d);
    expect(await mine()).toEqual([renamed]);
    await undo();
    expect(await mine()).toEqual([d]);
  });

  it('deleting a visit deletes its documents; Undo brings them back; the commit removes the files', async () => {
    const { repo, visit, document, up, mine, fileCount } = await setup();
    const e = visit();
    const d = document(e.id);
    await saveEvent(repo, e, null, [], {}, { add: [up(d)] });
    const files1 = await fileCount();
    const undo = await deleteEvent(repo, e, [], [d]);
    expect(await mine()).toEqual([]);
    expect(await fileCount()).toBe(files1);
    await undo();
    expect(await mine()).toEqual([d]);
    const again = await deleteEvent(repo, e, [], [d]);
    await again.commit?.();
    expect(await fileCount()).toBe(files1 - 1);
  });

  it('a document needs its event', async () => {
    const { repo, document } = await setup();
    await expect(repo.saveDocument(document(uuid()))).rejects.toThrow();
  });
});

describe('document storage on the fake Supabase', () => {
  let fake: FakeSupabase | null = null;
  afterEach(async () => {
    await fake?.backend.close();
    fake = null;
  });

  const OTHER_DOG = '20000000-0000-4000-8000-00000000000b';
  const STRANGER = '00000000-0000-4000-8000-0000000000b1';
  async function withDocument() {
    fake = await createFakeSupabase({ start: '2026-10-01' });
    const repo = fake.repository(NOW);
    const e: HealthEvent = { id: uuid(), dogId: SEED.dog, date: '2026-10-14', type: 'vet', title: 'Maple Vet', detail: '', conditionIds: [] };
    const d: DocFile = { id: uuid(), dogId: SEED.dog, eventId: e.id, name: 'Ultrasound report', sizeBytes: 1_258_291, pageCount: 3, position: 0 };
    await saveEvent(repo, e, null, [], {}, { add: [{ doc: d, file: pdf(7) }] });
    return { repo, e, d };
  }

  it('stores the row with its kind, name, size, pages and path; the file is private and read through a signed URL', async () => {
    const { repo, d } = await withDocument();
    const [row] = await fake!.backend.sql<Record<string, unknown>>(
      `select kind, storage_path, name, size_bytes::int, page_count, width, height from attachment`,
    );
    expect(row).toEqual({ kind: 'pdf', storage_path: documentPath(d), name: 'Ultrasound report', size_bytes: 1_258_291, page_count: 3, width: null, height: null });
    expect(fake!.backend.files()).toEqual([`documents/${documentPath(d)}`]);
    const url = (await repo.documentUrls([d]))[d.id] as string;
    expect(url).toMatch(/\/storage\/v1\/object\/sign\/documents\/.+\.pdf\?token=/);
    const body = await (await fake!.backend.fetch(url)).text();
    expect(body).toContain('%PDF-1.4');
    const pub = await fake!.backend.fetch(url.replace(/\/sign\//, '/public/').replace(/\?.*$/, ''));
    expect(pub.status).toBe(400);
  });

  it('a page count that is not known is stored as null, not as zero', async () => {
    fake = await createFakeSupabase({ start: '2026-10-01' });
    const repo = fake.repository(NOW);
    const e: HealthEvent = { id: uuid(), dogId: SEED.dog, date: '2026-10-14', type: 'vet', title: '', detail: 'x', conditionIds: [] };
    const d: DocFile = { id: uuid(), dogId: SEED.dog, eventId: e.id, name: 'Scan', sizeBytes: 1000, pageCount: null, position: 0 };
    await saveEvent(repo, e, null, [], {}, { add: [{ doc: d, file: pdf() }] });
    expect((await repo.listDocuments()).find((x) => x.id === d.id)?.pageCount).toBeNull();
  });

  it('a sixth document on one event is refused by the database', async () => {
    const { repo, e, d } = await withDocument();
    for (let i = 1; i < 5; i++) await repo.saveDocument({ ...d, id: uuid(), name: `Doc ${i}`, position: i });
    await expect(repo.saveDocument({ ...d, id: uuid(), name: 'Sixth', position: 5 })).rejects.toMatchObject({ code: '23514' });
    expect((await repo.listDocuments()).filter((x) => x.eventId === e.id)).toHaveLength(5);
  });

  it('another household can neither read, replace nor delete the file', async () => {
    const { d } = await withDocument();
    await fake!.backend.db.exec(`
      insert into auth.users (id, email) values ('${STRANGER}', 'b1@example.test');
      insert into public.household (id, name) values ('10000000-0000-4000-8000-00000000000b', 'Household B');
      insert into public.member (household_id, user_id) values ('10000000-0000-4000-8000-00000000000b', '${STRANGER}');
      insert into public.dog (id, household_id, name) values ('${OTHER_DOG}', '10000000-0000-4000-8000-00000000000b', 'Dog B');`);
    fake!.backend.setUser(STRANGER);
    const theirs = fake!.repository(NOW);
    expect(await theirs.documentUrls([d])).toEqual({});
    expect(await theirs.listDocuments()).toEqual([]);
    await expect(theirs.uploadDocumentFile(d, pdf(9))).rejects.toMatchObject({ code: '403' });
    await theirs.purgeDocumentFiles([d]); // the policy hides household A's files: nothing is removed
    expect(fake!.backend.files()).toHaveLength(1);
    const own: DocFile = { ...d, id: uuid(), dogId: OTHER_DOG };
    await theirs.uploadDocumentFile(own, pdf(3));
    expect(fake!.backend.files()).toHaveLength(2);
  });

  it('the bucket takes PDF only, and at most 10 MB', async () => {
    const { d } = await withDocument();
    const url = `https://fake-project.supabase.test/storage/v1/object/documents/${SEED.dog}/${d.id}.pdf`;
    const png = await fake!.backend.fetch(url, { method: 'POST', headers: { 'content-type': 'image/png', 'x-upsert': 'true' }, body: new Uint8Array([1, 2, 3]) });
    expect(png.status).toBe(415);
    const big = await fake!.backend.fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/pdf', 'x-upsert': 'true' },
      body: new Uint8Array(10 * 1024 * 1024 + 1),
    });
    expect(big.status).toBe(413);
  });
});
