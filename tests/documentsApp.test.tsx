// PDF documents (JCB-76) on the real data path: App → LogProvider → time-limited SupabaseRepository →
// supabase-js → the fake backend (PostgREST + Storage on Postgres with every migration, RLS and the
// storage policies). Plus demo mode (two bundled fictional PDFs, no backend). Window.open is stubbed:
// what a tap opens is what the phone's own PDF viewer would be given.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { App } from '../src/App';
import { DemoRepository } from '../src/data';
import { I18nProvider, type Lang } from '../src/i18n';
import { SEED } from './harness/fakeBackend';
import { createFakeSupabase, fakeUploader, type FakeSupabase } from './harness/fakeSupabase';

const NOW = () => new Date(2026, 9, 15, 16, 30); // Thu 15 Oct 2026
let fake: FakeSupabase | null = null;

const LUMP = '70000000-0000-4000-8000-000000000001';
const E1 = '50000000-0000-4000-8000-000000000001';
const D1 = '90000000-0000-4000-8000-000000000001';
const withLump = `insert into public.condition (id, dog_id, name, started_on) values ('${LUMP}', '${SEED.dog}', 'Lump A', '2026-10-03');`;
const withDoc = `${withLump}
  insert into public.event (id, dog_id, date, type, title, detail) values ('${E1}', '${SEED.dog}', '2026-10-14', 'vet', 'Maple Vet', 'Ultrasound');
  insert into public.event_condition (event_id, condition_id, dog_id) values ('${E1}', '${LUMP}', '${SEED.dog}');
  insert into public.attachment (id, dog_id, event_id, kind, storage_path, name, size_bytes, page_count) values
    ('${D1}', '${SEED.dog}', '${E1}', 'pdf', '${SEED.dog}/${D1}.pdf', 'Ultrasound report', 1258291, 3);`;

async function at(path: string, prep?: string, opts: { lang?: Lang; uploadLimitMs?: number } = {}) {
  fake = await createFakeSupabase({ start: '2026-10-01', client: { requestTimeoutMs: 60_000 } });
  if (prep) await fake.backend.db.exec(prep);
  window.history.replaceState(null, '', path);
  const limit = opts.uploadLimitMs;
  const upload = limit ? fakeUploader(fake.backend, () => limit) : undefined;
  render(
    <I18nProvider initial={opts.lang ?? 'en'}>
      <App repository={fake.repository(NOW, undefined, upload ? { upload } : {})} />
    </I18nProvider>,
  );
}
const dialog = () => screen.getAllByRole('dialog').at(-1) as HTMLElement;
const rows = (sql: string) => fake!.backend.sql<Record<string, unknown>>(sql);

/** A PDF of `size` bytes (the header is all the app reads, plus the page tree for the count). */
const pdfFile = (name = 'Scan 0042.pdf', size = 900, type = 'application/pdf') => {
  const bytes = new Uint8Array(size);
  const text = '%PDF-1.4\n2 0 obj\n<< /Type /Pages /Count 3 >>\nendobj\n';
  for (let i = 0; i < text.length; i++) bytes[i] = text.charCodeAt(i);
  return new File([bytes], name, { type });
};
const pick = (file: File) => fireEvent.change(within(dialog()).getByTestId('doc-input'), { target: { files: [file] } });

let open: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  localStorage.clear();
  open = vi.spyOn(window, 'open').mockReturnValue(null);
});
afterEach(async () => {
  cleanup();
  open.mockRestore();
  window.history.replaceState(null, '', '/');
  fake?.backend.release();
  await fake?.backend.close();
  fake = null;
});

const signed = () => fake!.backend.log.filter((r) => r.table === 'storage' && r.query.includes('/object/sign/documents')).length;
const tick = (ms = 50) => new Promise((r) => setTimeout(r, ms));

describe('documents, real data path', () => {
  it('a vet visit takes a PDF in its form: the row shows at once, it is sent on Save, and the Day view row opens it', async () => {
    await at('/day/2026-10-15');
    await screen.findAllByText('Cooked meal');
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    fireEvent.click(within(dialog()).getByText('Vet visit'));
    fireEvent.change(within(dialog()).getByLabelText('Reason and findings'), { target: { value: 'Check-up' } });
    expect(within(dialog()).getByText('Documents')).toBeTruthy();
    expect(within(dialog()).getByText('PDF, up to 10 MB each, up to 5 for one entry.')).toBeTruthy();
    pick(pdfFile());
    // The row: name without .pdf, size, pages read from the file.
    const row = await within(dialog()).findByRole('button', { name: /Scan 0042/ });
    expect(row.textContent).toContain('1 KB · 3 pages');
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Saved')).toBeTruthy();

    const saved = await rows(`select kind, name, size_bytes::int, page_count, storage_path, e.type from attachment a join event e on e.id = a.event_id`);
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({ kind: 'pdf', name: 'Scan 0042', size_bytes: 900, page_count: 3, type: 'vet' });
    expect(fake!.backend.files()).toEqual([`documents/${saved[0]!.storage_path}`]);

    // The Day view card: a row under the text; one tap opens the signed link in a new context.
    const card = await screen.findByRole('button', { name: 'Open PDF Scan 0042, 1 KB' });
    await waitFor(() => expect(signed()).toBeGreaterThan(0));
    await tick();
    fireEvent.click(card);
    expect(open).toHaveBeenCalledTimes(1);
    expect(open.mock.calls[0]![0]).toMatch(/\/object\/sign\/documents\/.+\.pdf\?token=/);
    expect(open.mock.calls[0]![1]).toBe('_blank');
    expect(open.mock.calls[0]![2]).toBe('noopener');
  });

  it('a tap before the link is ready opens the window first and points it at the link when it arrives', async () => {
    await at('/day/2026-10-14', withDoc);
    const repo = fake!.repository(NOW);
    const [d] = (await repo.listDocuments()).filter((x) => x.id === D1);
    await repo.uploadDocumentFile(d!, pdfFile());
    const target = { location: { href: '' }, close: vi.fn(), opener: 'app' as unknown };
    open.mockReturnValue(target as never);
    const row = await screen.findByRole('button', { name: 'Open PDF Ultrasound report, 1,2 MB' });
    // Make the ahead-of-time link unusable (it is older than the fresh window), as after a long stay on the screen.
    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 6 * 60 * 1000);
    fireEvent.click(row);
    expect(open).toHaveBeenCalledWith('', '_blank');
    await waitFor(() => expect(target.location.href).toMatch(/\/object\/sign\/documents\/.+\.pdf\?token=/));
    expect(target.opener).toBeNull();
    vi.restoreAllMocks();
  });

  it('a link that cannot be made says so', async () => {
    await at('/day/2026-10-14', withDoc); // no file was uploaded: nothing to sign
    const target = { location: { href: '' }, close: vi.fn(), opener: null };
    open.mockReturnValue(target as never);
    fireEvent.click(await screen.findByRole('button', { name: 'Open PDF Ultrasound report, 1,2 MB' }));
    expect(await screen.findByText('Can’t open the document. Try again.')).toBeTruthy();
    expect(target.close).toHaveBeenCalled();
  });

  it('a file over 10 MB, or not a PDF, is not added and the message names it', async () => {
    await at('/day/2026-10-15');
    await screen.findAllByText('Cooked meal');
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    fireEvent.click(within(dialog()).getByText('Vet visit'));
    pick(pdfFile('Scan 0042.pdf', 14 * 1024 * 1024));
    expect(await within(dialog()).findByText('Scan 0042.pdf is 14 MB. The limit is 10 MB.')).toBeTruthy();
    expect(within(dialog()).queryByRole('button', { name: /Scan 0042/ })).toBeNull();
    pick(new File(['hello'], 'notes.txt', { type: 'text/plain' }));
    expect(await within(dialog()).findByText('This file can’t be read as a PDF.')).toBeTruthy();
    // A .pdf that is not one inside.
    pick(new File(['hello, not a pdf at all'], 'fake.pdf', { type: 'application/pdf' }));
    await waitFor(() => expect(within(dialog()).getByText('This file can’t be read as a PDF.')).toBeTruthy());
    expect(fake!.backend.files()).toEqual([]);
  });

  it('five documents fill an entry: the button goes and the note says so', async () => {
    await at('/day/2026-10-15');
    await screen.findAllByText('Cooked meal');
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    fireEvent.click(within(dialog()).getByText('Vet visit'));
    for (let i = 1; i <= 5; i++) {
      pick(pdfFile(`Report ${i}.pdf`));
      await within(dialog()).findByRole('button', { name: new RegExp(`Report ${i}`) });
    }
    expect(within(dialog()).queryByRole('button', { name: 'Add PDF' })).toBeNull();
    expect(within(dialog()).getByText('Up to 5 documents for one entry.')).toBeTruthy();
  });

  it('a failed upload blocks the whole save: its row says Not sent. with Retry, nothing is saved, and Retry saves it', async () => {
    await at('/day/2026-10-15', undefined, { uploadLimitMs: 400 });
    await screen.findAllByText('Cooked meal');
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    fireEvent.click(within(dialog()).getByText('Vet visit'));
    fireEvent.change(within(dialog()).getByLabelText('Reason and findings'), { target: { value: 'Check-up' } });
    pick(pdfFile('Scan 0042.pdf'));
    await within(dialog()).findByRole('button', { name: /Scan 0042/ });
    fake!.backend.hangNext(1, (method, table) => method === 'PUT' && table === 'storage');
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Save' }));
    expect(await within(dialog()).findByText('Not sent.')).toBeTruthy();
    expect(within(dialog()).getByText('A document was not sent. Retry it or remove it.')).toBeTruthy();
    expect(await rows(`select count(*)::int as n from attachment`)).toEqual([{ n: 0 }]);
    expect(await rows(`select count(*)::int as n from event`)).toEqual([{ n: 0 }]);
    const save = within(dialog()).getByRole('button', { name: 'Save' }) as HTMLButtonElement;
    await waitFor(() => expect(save.disabled).toBe(false));
    fake!.backend.release();
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('Saved')).toBeTruthy();
    expect(await rows(`select count(*)::int as n from attachment`)).toEqual([{ n: 1 }]);
    expect(await rows(`select count(*)::int as n from event`)).toEqual([{ n: 1 }]);
    expect(fake!.backend.files()).toHaveLength(1);
  });

  it('closing the form after a failed save removes the PDFs already sent, so nothing is left in storage (JCB-132)', async () => {
    await at('/day/2026-10-15', undefined, { uploadLimitMs: 400 });
    await screen.findAllByText('Cooked meal');
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    fireEvent.click(within(dialog()).getByText('Vet visit'));
    fireEvent.change(within(dialog()).getByLabelText('Reason and findings'), { target: { value: 'Check-up' } });
    pick(pdfFile('First.pdf'));
    await within(dialog()).findByRole('button', { name: /First/ });
    pick(pdfFile('Second.pdf'));
    await within(dialog()).findByRole('button', { name: /Second/ });
    let puts = 0;
    fake!.backend.hangNext(1, (method, table) => method === 'PUT' && table === 'storage' && ++puts === 2);
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Save' }));
    expect(await within(dialog()).findByText('Not sent.')).toBeTruthy();
    expect(fake!.backend.files()).toHaveLength(1); // the first one went; the second is held and never lands
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(fake!.backend.files()).toHaveLength(0));
    expect(await rows(`select count(*)::int as n from attachment`)).toEqual([{ n: 0 }]);
  });

  it('the Document sheet renames a saved document; Remove has Undo and the file goes once the toast is gone', async () => {
    await at('/day/2026-10-14', withDoc);
    const repo = fake!.repository(NOW);
    await repo.uploadDocumentFile((await repo.listDocuments())[0]!, pdfFile());
    fireEvent.click(await screen.findByRole('button', { name: 'Maple Vet' }).catch(() => screen.findByText(/Maple Vet/)));
    fireEvent.click(await within(dialog()).findByRole('button', { name: /Ultrasound report/ }));
    expect(within(dialog()).getByRole('heading', { name: 'Document' })).toBeTruthy();
    expect(within(dialog()).getByText('PDF · 1,2 MB · 3 pages')).toBeTruthy();
    fireEvent.change(within(dialog()).getByLabelText('Name'), { target: { value: 'Abdomen ultrasound' } });
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(rows(`select name from attachment`)).resolves.toEqual([{ name: 'Abdomen ultrasound' }]));
    // Remove.
    fireEvent.click(await within(dialog()).findByRole('button', { name: /Abdomen ultrasound/ }));
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Remove document' }));
    expect(await screen.findByText('Document removed')).toBeTruthy();
    expect(await rows(`select id from attachment`)).toEqual([]);
    expect(fake!.backend.files()).toHaveLength(1); // still there for Undo
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(rows(`select id from attachment`)).resolves.toEqual([{ id: D1 }]));
    // Remove again and let another change replace the toast: Undo is gone, so the file is removed.
    fireEvent.click(await within(dialog()).findByRole('button', { name: /Abdomen ultrasound/ }));
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Remove document' }));
    expect(await screen.findByText('Document removed')).toBeTruthy();
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(fake!.backend.files()).toEqual([]));
  });

  it('a condition page: Documents sits between Photos and History, lists the PDFs of its events, newest first', async () => {
    await at(`/tracked/${LUMP}`, withDoc);
    expect(await screen.findByText('Documents · 1')).toBeTruthy();
    const heads = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
    expect(heads.indexOf('Photos')).toBeLessThan(heads.indexOf('Documents · 1'));
    expect(heads.indexOf('Documents · 1')).toBeLessThan(heads.indexOf('History'));
    // The Documents card row has the event's date; the History card has the same PDF under its text.
    const rowsOnPage = screen.getAllByRole('button', { name: 'Open PDF Ultrasound report, 1,2 MB' });
    expect(rowsOnPage).toHaveLength(2);
    expect(rowsOnPage[0]!.textContent).toContain('14 Oct');
    expect(rowsOnPage[0]!.textContent).toContain('1,2 MB · 3 pages');
  });

  it('Add document on a condition saves a Note on that date linked to it, with the PDF', async () => {
    await at(`/tracked/${LUMP}`, withLump);
    expect(await screen.findByText('No documents yet. Add vet results and reports.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Add PDF' }));
    expect(within(dialog()).getByRole('heading', { name: 'Add document' })).toBeTruthy();
    expect(within(dialog()).getByText('PDF, up to 10 MB.')).toBeTruthy();
    expect((within(dialog()).getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(true);
    pick(pdfFile('Cytology result.pdf'));
    expect(await within(dialog()).findByText('Saved as a note and linked to Lump A.')).toBeTruthy();
    expect((within(dialog()).getByLabelText('Name') as HTMLInputElement).value).toBe('Cytology result');
    fireEvent.change(within(dialog()).getByLabelText('Name'), { target: { value: 'Cytology 10 Oct' } });
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Saved')).toBeTruthy();
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    const [event] = await rows(`select id, type, date::text, title, detail from event`);
    expect(event).toMatchObject({ type: 'note', date: '2026-10-15', title: '', detail: '' });
    expect(await rows(`select condition_id from event_condition where event_id = '${event!.id}'`)).toEqual([{ condition_id: LUMP }]);
    expect(await rows(`select name, kind, event_id from attachment`)).toEqual([{ name: 'Cytology 10 Oct', kind: 'pdf', event_id: event!.id }]);
    // The page stays on the condition and now lists it.
    expect(await screen.findByText('Documents · 1')).toBeTruthy();
    expect(window.location.pathname).toBe(`/tracked/${LUMP}`);
    // The note opens in its own form, where the PDF can be managed; saving it without text is fine.
    fireEvent.click(screen.getAllByText('Note').at(-1)!);
    expect(await within(dialog()).findByRole('button', { name: /Cytology 10 Oct/ })).toBeTruthy();
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(await rows(`select count(*)::int as n from attachment`)).toEqual([{ n: 1 }]);
  });

  it('Polish: labels, the decimal comma and the page count forms', async () => {
    await at(`/tracked/${LUMP}`, withDoc, { lang: 'pl' });
    expect(await screen.findByText('Dokumenty · 1')).toBeTruthy();
    expect(screen.getAllByRole('button', { name: 'Otwórz PDF Ultrasound report, 1,2 MB' })).toHaveLength(2);
    expect(screen.getAllByText('1,2 MB · 3 strony')).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: 'Dodaj dokument' }));
    expect(within(dialog()).getByRole('heading', { name: 'Dodaj dokument' })).toBeTruthy();
    expect(within(dialog()).getByText('PDF, do 10 MB.')).toBeTruthy();
  });
});

describe('documents, demo mode', () => {
  const mount = (path: string, lang: Lang = 'en', repo = new DemoRepository(localStorage)) => {
    window.history.replaceState(null, '', path);
    render(
      <I18nProvider initial={lang}>
        <App repository={repo} />
      </I18nProvider>,
    );
    return repo;
  };

  it('two bundled fictional PDFs sit on the 14 Oct vet visits and open from the app with no backend', async () => {
    mount('/day/2026-10-14');
    const row = await screen.findByRole('button', { name: 'Open PDF Ultrasound report, 2 KB' });
    expect(row.textContent).toContain('2 pages');
    expect(screen.getByRole('button', { name: 'Open PDF Blood pressure check, 1 KB' }).textContent).toContain('1 page');
    await tick();
    fireEvent.click(row);
    expect(open).toHaveBeenCalledWith(expect.stringMatching(/ultrasound-report.*\.pdf(\?no-inline)?$/), '_blank', 'noopener');
  });

  it('the condition page lists them; Add document works offline and the change stays in this browser', async () => {
    URL.createObjectURL = vi.fn(() => 'blob:demo-pdf');
    mount('/tracked/condition-002');
    expect(await screen.findByText('Documents · 1')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Add document' }));
    expect(within(dialog()).getByRole('heading', { name: 'Add document' })).toBeTruthy();
    pick(pdfFile('Lab results.pdf', 2000));
    expect(await within(dialog()).findByText(/Demo: documents you add stay in this browser/)).toBeTruthy();
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Documents · 2')).toBeTruthy();
    const saved = JSON.parse(localStorage.getItem('pawlog.demo.v2') as string) as { documents: { name: string }[] };
    expect(saved.documents.map((d) => d.name).sort()).toEqual(['Blood pressure check', 'Lab results', 'Ultrasound report']);
    expect(Object.keys(JSON.parse(localStorage.getItem('pawlog.demo.doc-files.v1') as string))).toHaveLength(1);
    // A visitor's own PDF opens from a blob: link, not a data: one (iPhone does not open those in a new tab).
    await tick();
    fireEvent.click(screen.getAllByRole('button', { name: 'Open PDF Lab results, 2 KB' })[0]!);
    expect(open).toHaveBeenCalledWith('blob:demo-pdf', '_blank', 'noopener');
  });

  it('a demo that was saved before PDFs existed gets the sample ones', async () => {
    const old = new DemoRepository(null);
    localStorage.setItem('pawlog.demo.v2', JSON.stringify({ ...(old as unknown as { data: object }).data, documents: undefined }));
    mount('/day/2026-10-14', 'en', new DemoRepository(localStorage));
    expect(await screen.findByRole('button', { name: 'Open PDF Ultrasound report, 2 KB' })).toBeTruthy();
  });
});
