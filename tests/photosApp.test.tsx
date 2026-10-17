// Photos (JCB-7) on the real data path: App → LogProvider → time-limited SupabaseRepository →
// supabase-js → the fake backend (PostgREST + Storage on Postgres with every migration, RLS and the
// storage policies). The resize step is replaced (jsdom has no canvas); everything after it is real.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { App } from '../src/App';
import { I18nProvider } from '../src/i18n';
import { SEED } from './harness/fakeBackend';
import { createFakeSupabase, fakeUploader, type FakeSupabase } from './harness/fakeSupabase';

vi.mock('../src/photos/resize', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../src/photos/resize')>()),
  preparePhoto: async (file: Blob) => {
    if (file.type === 'image/heic') throw new Error('cannot decode');
    return {
      full: new Blob([new Uint8Array([0xff, 0xd8, 1, 0xff, 0xd9])], { type: 'image/jpeg' }),
      thumb: new Blob([new Uint8Array([0xff, 0xd8, 2, 0xff, 0xd9])], { type: 'image/jpeg' }),
      width: 1600,
      height: 1200,
      takenAt: '2026-10-03T09:12:00',
    };
  },
}));

const NOW = () => new Date(2026, 9, 15, 16, 30); // Thu 15 Oct 2026
let fake: FakeSupabase | null = null;

const LUMP = '70000000-0000-4000-8000-000000000001';
const withLump = `insert into public.condition (id, dog_id, name, started_on) values ('${LUMP}', '${SEED.dog}', 'Lump A', '2026-10-03');`;
const E1 = '50000000-0000-4000-8000-000000000001';
const E2 = '50000000-0000-4000-8000-000000000002';
const P1 = '80000000-0000-4000-8000-000000000001';
const P2 = '80000000-0000-4000-8000-000000000002';
const twoPhotos = `${withLump}
  insert into public.event (id, dog_id, date, type, title, detail) values
    ('${E1}', '${SEED.dog}', '2026-10-03', 'photo', '', 'About 1 cm'),
    ('${E2}', '${SEED.dog}', '2026-10-10', 'photo', '', 'Same size');
  insert into public.event_condition (event_id, condition_id, dog_id) values
    ('${E1}', '${LUMP}', '${SEED.dog}'), ('${E2}', '${LUMP}', '${SEED.dog}');
  insert into public.attachment (id, dog_id, event_id, storage_path, width, height) values
    ('${P1}', '${SEED.dog}', '${E1}', '${SEED.dog}/${P1}.jpg', 1600, 1200),
    ('${P2}', '${SEED.dog}', '${E2}', '${SEED.dog}/${P2}.jpg', 1600, 1200);`;

async function at(path: string, prep?: string, opts: { timeoutMs?: number; requestTimeoutMs?: number; uploadLimitMs?: number } = {}) {
  fake = await createFakeSupabase({ start: '2026-10-01', client: { requestTimeoutMs: opts.requestTimeoutMs ?? 60_000 } });
  if (prep) await fake.backend.db.exec(prep);
  window.history.replaceState(null, '', path);
  const limit = opts.uploadLimitMs;
  const upload = limit ? fakeUploader(fake.backend, () => limit) : undefined;
  render(
    <I18nProvider initial="en">
      <App repository={fake.repository(NOW, opts.timeoutMs, upload ? { upload } : {})} />
    </I18nProvider>,
  );
}
const dialog = () => screen.getByRole('dialog');
const rows = (sql: string) => fake!.backend.sql<Record<string, unknown>>(sql);
const pick = (type = 'image/jpeg') =>
  fireEvent.change(within(dialog()).getByTestId('photo-input'), { target: { files: [new File(['x'], 'IMG_0001.JPG', { type })] } });

afterEach(async () => {
  cleanup();
  window.history.replaceState(null, '', '/');
  fake?.backend.release();
  await fake?.backend.close();
  fake = null;
});

describe('photos, real data path', () => {
  it('+ Add → Photo: picks, dates from the photo, links a condition, uploads and shows it on its day and the Timeline', async () => {
    await at('/', withLump);
    fireEvent.click(await screen.findByRole('button', { name: 'Add' }));
    fireEvent.click(within(dialog()).getByText('Photo'));
    expect(within(dialog()).getByRole('heading', { name: 'Add photo' })).toBeTruthy();
    // Save without a photo: asked for one first.
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Save' }));
    expect(await within(dialog()).findByText('Add a photo first.')).toBeTruthy();
    pick();
    expect(await within(dialog()).findByText(/For Sat 3 Oct · date from the photo/)).toBeTruthy();
    expect(within(dialog()).getByText('Saved smaller (about 1600 px) so the app stays quick.')).toBeTruthy();
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Lump A' }));
    fireEvent.change(within(dialog()).getByLabelText('Description'), { target: { value: 'About 1 cm, soft' } });
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Saved')).toBeTruthy();
    await waitFor(() => expect(window.location.pathname).toBe('/day/2026-10-03'));

    const [event] = await rows(`select id, type, date::text, detail from event`);
    expect(event).toMatchObject({ type: 'photo', date: '2026-10-03', detail: 'About 1 cm, soft' });
    const [photo] = await rows(`select id, event_id, width, height, taken_at::text, caption from attachment`);
    expect(photo).toMatchObject({ event_id: event!.id, width: 1600, height: 1200, taken_at: '2026-10-03 09:12:00', caption: '' });
    expect(await rows(`select condition_id from event_condition`)).toEqual([{ condition_id: LUMP }]);
    expect(fake!.backend.files()).toEqual([`photos/${SEED.dog}/${photo!.id}.jpg`, `photos/${SEED.dog}/${photo!.id}.thumb.jpg`]);

    // The Day view: a Photo card with its description, the thumbnail and the condition tag.
    expect(await screen.findByText('About 1 cm, soft')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Photo, Sat 3 Oct' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Open Lump A' })).toBeTruthy();
    // The Timeline: the 3 Oct row says it has a photo (the camera badge), once.
    fireEvent.click(within(screen.getByRole('navigation')).getByRole('button', { name: 'Timeline' }));
    const row = await screen.findByRole('link', { name: /(^|[^0-9])3 Oct/ });
    expect(row.textContent?.match(/Photo/g)).toHaveLength(1);
  });

  it('a photo the browser cannot read says so and saves nothing', async () => {
    await at('/day/2026-10-15');
    await screen.findAllByText('Cooked meal');
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    fireEvent.click(within(dialog()).getByText('Photo'));
    pick('image/heic');
    expect(await within(dialog()).findByText("This photo can't be opened. Try another one.")).toBeTruthy();
    expect(fake!.backend.files()).toEqual([]);
  });

  const addPhoto = async () => {
    await screen.findAllByText('Cooked meal');
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    fireEvent.click(within(dialog()).getByText('Photo'));
    pick();
    await within(dialog()).findByText(/date from the photo/);
  };
  const isUpload = (method: string, table: string) => method === 'PUT' && table === 'storage';

  it('a slow upload on mobile data is not cut off by the 10 s request or 15 s call limits', async () => {
    // Both general limits are tiny here; the upload takes longer than either and still goes through.
    await at('/day/2026-10-15', undefined, { timeoutMs: 1500, requestTimeoutMs: 1500 });
    await addPhoto();
    fake!.backend.setLatency((method, table) => (isUpload(method, table) ? 2000 : 0));
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Saved')).toBeTruthy();
    expect(screen.queryByText("Couldn't save · Try again")).toBeNull();
    expect(fake!.backend.files()).toHaveLength(2);
    expect(await rows(`select count(*)::int as n from attachment`)).toEqual([{ n: 1 }]);
  });

  it('a stalled upload gives up and releases Save; trying again uploads to the same paths, one photo', async () => {
    await at('/day/2026-10-15', undefined, { uploadLimitMs: 400 });
    await addPhoto();
    fake!.backend.hangNext(1, isUpload);
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Save' }));
    expect(await screen.findByText("Couldn't save · Try again")).toBeTruthy();
    const save = within(dialog()).getByRole('button', { name: 'Save' }) as HTMLButtonElement;
    await waitFor(() => expect(save.disabled).toBe(false));
    expect(await rows(`select count(*)::int as n from attachment`)).toEqual([{ n: 0 }]);
    fake!.backend.release(); // the lost upload reaches the server after all
    fireEvent.click(save);
    expect(await screen.findByText('Saved')).toBeTruthy();
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(await rows(`select count(*)::int as n from attachment`)).toEqual([{ n: 1 }]);
    expect(await rows(`select count(*)::int as n from event`)).toEqual([{ n: 1 }]);
    expect(fake!.backend.files()).toHaveLength(2);
  });

  it('condition page: the strip, the viewer (step, Open day) and Compare', async () => {
    await at(`/tracked/${LUMP}`, twoPhotos);
    expect(await screen.findByText('Photos · 2')).toBeTruthy();
    const thumbs = screen.getAllByRole('button', { name: /^Photo, / });
    // Strip (oldest first) plus the two history cards.
    expect(thumbs.map((b) => b.getAttribute('aria-label')).slice(0, 2)).toEqual(['Photo, Sat 3 Oct', 'Photo, Sat 10 Oct']);
    fireEvent.click(thumbs[0]!);
    expect(await screen.findByText('1 of 2')).toBeTruthy();
    expect(within(dialog()).getByText('About 1 cm')).toBeTruthy();
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Next photo' }));
    expect(within(dialog()).getByText('2 of 2')).toBeTruthy();
    expect(within(dialog()).getByText('Sat, 10 October 2026')).toBeTruthy();
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(screen.getByText('1 of 2')).toBeTruthy();
    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByText('1 of 2')).toBeNull());

    fireEvent.click(screen.getByRole('button', { name: 'Compare' }));
    expect(await screen.findByText('Compare · Lump A')).toBeTruthy();
    expect(screen.getByText('First')).toBeTruthy();
    expect(screen.getByText('Latest')).toBeTruthy();
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Close' }));

    fireEvent.click(screen.getAllByRole('button', { name: 'Photo, Sat 10 Oct' })[0]!);
    fireEvent.click(await within(dialog()).findByRole('button', { name: 'Open day' }));
    await waitFor(() => expect(window.location.pathname).toBe('/day/2026-10-10'));
    expect(screen.queryByText('1 of 2')).toBeNull();
  });

  it('delete a photo from the viewer: Undo brings it back; once the toast is gone its files go too', async () => {
    await at(`/tracked/${LUMP}`, twoPhotos);
    // Files for the first photo, as an upload would have left them.
    const repo = fake!.repository(NOW);
    const [p1] = (await repo.listPhotos()).filter((p) => p.id === P1);
    const blob = new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], { type: 'image/jpeg' });
    await repo.uploadPhotoFiles(p1!, { full: blob, thumb: blob });

    fireEvent.click((await screen.findAllByRole('button', { name: 'Photo, Sat 3 Oct' }))[0]!);
    fireEvent.click(await within(dialog()).findByRole('button', { name: 'Edit' }));
    expect(within(dialog()).getByRole('heading', { name: 'Edit photo' })).toBeTruthy();
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Delete' }));
    expect(await screen.findByText('Photo deleted')).toBeTruthy();
    expect(await screen.findByText('Photos · 1')).toBeTruthy();
    // The only photo of a photo event: the event went too.
    expect(await rows(`select id from event where id = '${E1}'`)).toEqual([]);
    expect(fake!.backend.files()).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(await screen.findByText('Photos · 2')).toBeTruthy();
    expect(await rows(`select id from attachment where id = '${P1}'`)).toEqual([{ id: P1 }]);

    // Delete again; another change replaces the toast, so Undo is gone and the files are removed.
    fireEvent.click((await screen.findAllByRole('button', { name: 'Photo, Sat 3 Oct' }))[0]!);
    fireEvent.click(await within(dialog()).findByRole('button', { name: 'Edit' }));
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Delete' }));
    expect(await screen.findByText('Photo deleted')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Mark as resolved' }));
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Moved to Resolved')).toBeTruthy();
    await waitFor(() => expect(fake!.backend.files()).toEqual([]));
  });

  it('a vet visit takes photos in its form; they are saved with it', async () => {
    await at('/day/2026-10-15');
    await screen.findAllByText('Cooked meal');
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    fireEvent.click(within(dialog()).getByText('Vet visit'));
    fireEvent.change(within(dialog()).getByLabelText('Reason and findings'), { target: { value: 'Check-up' } });
    pick();
    pick();
    await waitFor(() => expect(within(dialog()).getByRole('button', { name: 'Save' }).hasAttribute('disabled')).toBe(false));
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Saved')).toBeTruthy();
    const saved = await rows(`select a.position, e.type, e.date::text from attachment a join event e on e.id = a.event_id order by a.position`);
    expect(saved).toEqual([
      { position: 0, type: 'vet', date: '2026-10-15' },
      { position: 1, type: 'vet', date: '2026-10-15' },
    ]);
    expect(fake!.backend.files()).toHaveLength(4);
    expect(await screen.findAllByRole('button', { name: 'Photo, Thu 15 Oct' })).toHaveLength(2);
  });
});
