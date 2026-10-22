// PDF documents (JCB-76): the pure parts. Row order and the condition's list, sizes with a decimal
// comma, names, what may be picked, the page count read from a PDF's text, and how a tap opens a PDF.
import { describe, expect, it, vi } from 'vitest';
import type { DocFile, HealthEvent } from '../src/data';
import { DOCS_MAX, documentPath } from '../src/data';
import { canAddDoc, checkPick, cleanDocName, conditionDocs, docsOf, formatSize, nameFromFile, nextDocPosition } from '../src/documents/model';
import { NotPdfError, pageCountOf, readPdf } from '../src/documents/pdf';
import { openPdf } from '../src/documents/open';
import { LINK_FRESH_MS } from '../src/documents/useDocumentUrl';

const doc = (id: string, eventId: string, position = 0): DocFile => ({ id, dogId: 'dog', eventId, name: id, sizeBytes: 1000, pageCount: null, position });
const event = (id: string, date: string, conditionIds: string[] = [], type: HealthEvent['type'] = 'vet'): HealthEvent => ({
  id,
  dogId: 'dog',
  date,
  type,
  title: '',
  detail: '',
  conditionIds,
});

describe('document lists', () => {
  it('an event keeps its documents in position order', () => {
    const docs = [doc('c', 'e1', 1), doc('a', 'e1', 0), doc('x', 'e2', 0), doc('b', 'e1', 0)];
    expect(docsOf('e1', docs).map((d) => d.id)).toEqual(['a', 'b', 'c']);
    expect(nextDocPosition(docsOf('e1', docs))).toBe(2);
    expect(nextDocPosition([])).toBe(0);
  });

  it("a condition's documents are those of its linked events, newest first", () => {
    const events = [event('e1', '2026-10-03', ['c1']), event('e2', '2026-10-14', ['c1']), event('e3', '2026-10-20', ['c2']), event('e4', '2026-10-14', ['c1'], 'note')];
    const docs = [doc('d1', 'e1'), doc('d2', 'e2'), doc('d3', 'e3'), doc('d4', 'e4'), doc('d5', 'e2', 1)];
    expect(conditionDocs('c1', events, docs).map((x) => x.doc.id)).toEqual(['d2', 'd5', 'd4', 'd1']);
    expect(conditionDocs('none', events, docs)).toEqual([]);
  });

  it('five documents fit on one entry', () => {
    expect(canAddDoc(DOCS_MAX - 1)).toBe(true);
    expect(canAddDoc(DOCS_MAX)).toBe(false);
  });

  it('the file lives at <dog>/<id>.pdf', () => {
    expect(documentPath({ id: 'abc', dogId: 'dog' })).toBe('dog/abc.pdf');
  });
});

describe('size and name', () => {
  it('sizes: KB below a megabyte, then MB with a decimal comma', () => {
    expect(formatSize(1)).toBe('1 KB');
    expect(formatSize(340 * 1024)).toBe('340 KB');
    expect(formatSize(999 * 1024)).toBe('999 KB');
    expect(formatSize(1229 * 1024)).toBe('1,2 MB');
    expect(formatSize(2 * 1024 * 1024)).toBe('2 MB');
    expect(formatSize(14336 * 1024)).toBe('14 MB');
  });

  it('the starting name is the file name without .pdf', () => {
    expect(nameFromFile('Scan 0042.pdf')).toBe('Scan 0042');
    expect(nameFromFile('Wyniki z laboratorium.PDF')).toBe('Wyniki z laboratorium');
    expect(nameFromFile('report.v2.pdf')).toBe('report.v2');
    expect(nameFromFile('x'.repeat(200) + '.pdf')).toHaveLength(120);
  });

  it('a stored name is trimmed and limited; an emptied name keeps the old one', () => {
    expect(cleanDocName('  Blood count  ', 'old')).toBe('Blood count');
    expect(cleanDocName('   ', 'old')).toBe('old');
    expect(cleanDocName('y'.repeat(300), 'old')).toHaveLength(120);
  });
});

describe('what may be picked', () => {
  const file = (name: string, size: number, type = 'application/pdf') => ({ name, size, type });
  it('a PDF within 10 MB is fine; the type or the name says PDF', () => {
    expect(checkPick(file('a.pdf', 1000))).toBeNull();
    expect(checkPick(file('a', 1000, ''))).toBe('notPdf');
    expect(checkPick(file('a.pdf', 1000, ''))).toBeNull();
    expect(checkPick(file('a', 1000, 'application/pdf'))).toBeNull();
    expect(checkPick(file('photo.jpg', 1000, 'image/jpeg'))).toBe('notPdf');
    expect(checkPick(file('empty.pdf', 0))).toBe('notPdf');
  });
  it('over 10 MB is refused, exactly 10 MB is not', () => {
    expect(checkPick(file('a.pdf', 10 * 1024 * 1024))).toBeNull();
    expect(checkPick(file('a.pdf', 10 * 1024 * 1024 + 1))).toBe('tooBig');
  });
});

describe('reading a PDF', () => {
  const plain = (count: number) =>
    `%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count ${count} >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R >>\nendobj\n`;
  it('takes the page count from a plain page tree', () => {
    expect(pageCountOf(plain(3))).toBe(3);
  });
  it('takes the root of a nested tree (the largest count)', () => {
    const nested = `${plain(5)}\n9 0 obj\n<< /Type /Pages /Count 2 /Parent 2 0 R >>\nendobj\n`;
    expect(pageCountOf(nested)).toBe(5);
    expect(pageCountOf('4 0 obj\n<< /Count 7 /Type /Pages >>\nendobj')).toBe(7);
  });
  it('is not fooled by outline counts or single pages', () => {
    expect(pageCountOf('5 0 obj\n<< /Type /Outlines /Count 12 >>\nendobj\n6 0 obj\n<< /Type /Page /Count 99 >>\nendobj')).toBeNull();
  });
  it('has no count when the page tree is compressed or missing: never a guess', () => {
    expect(pageCountOf('%PDF-1.5\n1 0 obj\n<< /Type /ObjStm /N 5 >>\nstream\n...\nendstream\nendobj')).toBeNull();
    expect(pageCountOf('')).toBeNull();
  });
  it('a file that does not start like a PDF is refused; a PDF gives its info', async () => {
    await expect(readPdf(new Blob(['hello, not a pdf']))).rejects.toBeInstanceOf(NotPdfError);
    await expect(readPdf(new Blob([plain(4)]))).resolves.toEqual({ pageCount: 4 });
    await expect(readPdf(new Blob(['%PDF-1.7\n']))).resolves.toEqual({ pageCount: null });
  });
});

describe('opening a PDF from the tap', () => {
  const NOW = 1_000_000;
  it('a link made ahead and still fresh opens at once in a new context, without opener', () => {
    const win = { open: vi.fn() };
    const load = vi.fn();
    openPdf({ link: { url: 'https://signed/x', at: NOW - 1000 }, load, onFail: vi.fn(), now: NOW, win: win as never });
    expect(win.open).toHaveBeenCalledOnce();
    expect(win.open).toHaveBeenCalledWith('https://signed/x', '_blank', 'noopener');
    expect(load).not.toHaveBeenCalled();
  });

  it('with no link, or an old one, the window opens first (in the tap) and is pointed at the new link when it arrives', async () => {
    const target = { location: { href: '' }, close: vi.fn(), opener: 'app' as unknown };
    const win = { open: vi.fn(() => target) };
    let resolve!: (u: string | null) => void;
    const load = vi.fn(() => new Promise<string | null>((r) => (resolve = r)));
    openPdf({ link: { url: 'https://old', at: NOW - LINK_FRESH_MS }, load, onFail: vi.fn(), now: NOW, win: win as never });
    expect(win.open).toHaveBeenCalledWith('', '_blank'); // synchronously, before the link is known
    expect(target.opener).toBeNull();
    expect(target.location.href).toBe('');
    resolve('https://signed/new');
    await Promise.resolve();
    await Promise.resolve();
    expect(target.location.href).toBe('https://signed/new');
  });

  it('a link that cannot be made closes the empty window and says so', async () => {
    const target = { location: { href: '' }, close: vi.fn(), opener: null };
    const win = { open: vi.fn(() => target) };
    const onFail = vi.fn();
    openPdf({ link: null, load: async () => null, onFail, win: win as never });
    await Promise.resolve();
    await Promise.resolve();
    expect(target.close).toHaveBeenCalled();
    expect(onFail).toHaveBeenCalledOnce();
    const onFail2 = vi.fn();
    openPdf({ link: null, load: () => Promise.reject(new Error('offline')), onFail: onFail2, win: { open: () => target } as never });
    await Promise.resolve();
    await Promise.resolve();
    expect(onFail2).toHaveBeenCalledOnce();
  });

  it('pop-ups blocked: nothing opens and it says so', () => {
    const onFail = vi.fn();
    const load = vi.fn();
    openPdf({ link: null, load, onFail, win: { open: () => null } as never });
    expect(onFail).toHaveBeenCalledOnce();
    expect(load).not.toHaveBeenCalled();
  });
});
