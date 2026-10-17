// Pinned notes (JCB-5): the repository contract on both implementations, the screen and its sheet in
// the demo, and the real data path (App → SupabaseRepository → supabase-js → Postgres with every migration).
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { App } from '../src/App';
import { DemoRepository, type PinnedNote, type Repository } from '../src/data';
import { I18nProvider, translate } from '../src/i18n';
import { pluralForm } from '../src/i18n/plural';
import { parseRoute, routePath, tabPath } from '../src/routes';
import { createFakeSupabase, type FakeSupabase } from './harness/fakeSupabase';

const NOW = () => new Date(2026, 9, 15, 16, 30);
const uuid = () => crypto.randomUUID();

const subjects: [string, () => Promise<{ repo: Repository; close: () => Promise<void> }>][] = [
  ['DemoRepository', async () => ({ repo: new DemoRepository(null, NOW), close: async () => {} })],
  [
    'SupabaseRepository',
    async () => {
      const fake = await createFakeSupabase({ start: '2026-10-01' });
      return { repo: fake.repository(NOW), close: () => fake.backend.close() };
    },
  ],
];

describe.each(subjects)('pinned notes on %s', (_name, make) => {
  let close: (() => Promise<void>) | null = null;
  afterEach(async () => {
    await close?.();
    close = null;
  });
  async function setup() {
    const s = await make();
    close = s.close;
    const dog = await s.repo.getDog();
    const note = (extra: Partial<PinnedNote> = {}): PinnedNote => ({ id: uuid(), dogId: dog.id, title: '', body: 'Text', position: 0, ...extra });
    // Start from a known list: the real database is empty, the demo has sample notes.
    for (const n of await s.repo.listPinnedNotes()) await s.repo.deletePinnedNote(n.id);
    return { repo: s.repo, note };
  }

  it('lists notes by position, then saves, edits in place and deletes', async () => {
    const { repo, note } = await setup();
    const a = note({ title: 'Allergies', body: 'None known', position: 2 });
    const b = note({ body: 'Second line\nthird line', position: 1 });
    await repo.savePinnedNote(a);
    await repo.savePinnedNote(b);
    expect((await repo.listPinnedNotes()).map((n) => [n.id, n.title, n.body])).toEqual([
      [b.id, '', 'Second line\nthird line'],
      [a.id, 'Allergies', 'None known'],
    ]);
    await repo.savePinnedNote({ ...a, body: 'None known, ever' });
    const after = await repo.listPinnedNotes();
    expect(after).toHaveLength(2);
    expect(after.find((n) => n.id === a.id)?.body).toBe('None known, ever');
    await repo.deletePinnedNote(b.id);
    expect((await repo.listPinnedNotes()).map((n) => n.id)).toEqual([a.id]);
  });

  it('stamps the day of the last edit, and a move does not count as an edit', async () => {
    const { repo, note } = await setup();
    const a = note({ position: 0 });
    const b = note({ position: 1 });
    await repo.savePinnedNote(a);
    await repo.savePinnedNote(b);
    const [first] = await repo.listPinnedNotes();
    expect(first?.updatedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const before = Object.fromEntries((await repo.listPinnedNotes()).map((n) => [n.id, n.updatedOn]));
    await repo.reorderPinnedNotes([b.id, a.id]);
    const moved = await repo.listPinnedNotes();
    expect(moved.map((n) => n.id)).toEqual([b.id, a.id]);
    expect(Object.fromEntries(moved.map((n) => [n.id, n.updatedOn]))).toEqual(before);
  });

  it('restore puts a note back with its original edit stamp, not the day of the undo', async () => {
    const { repo, note } = await setup();
    const a = note({ title: 'Old', body: 'Original text' });
    await repo.savePinnedNote(a);
    const [saved] = await repo.listPinnedNotes();
    // As the Undo of an edit sees it: the note as it was before, from an older day.
    const before = { ...(saved as PinnedNote), updatedOn: '2026-09-01', updatedAt: '2026-09-01T10:00:00.000Z' };
    await repo.savePinnedNote({ ...a, body: 'Edited text' });
    await repo.restorePinnedNote(before);
    const [back] = await repo.listPinnedNotes();
    expect(back?.body).toBe('Original text');
    expect(back?.updatedOn).toBe('2026-09-01');
    // The same after an undone delete: a note that is gone comes back with its stamp.
    await repo.deletePinnedNote(a.id);
    await repo.restorePinnedNote(before);
    const [again] = await repo.listPinnedNotes();
    expect([again?.id, again?.body, again?.updatedOn]).toEqual([a.id, 'Original text', '2026-09-01']);
    // A real edit afterwards is stamped as an edit again.
    await repo.savePinnedNote({ ...(again as PinnedNote), body: 'Newer' });
    expect((await repo.listPinnedNotes())[0]?.updatedOn).not.toBe('2026-09-01');
  });

  it('reorder sets the order from the ids and ignores ids that are gone', async () => {
    const { repo, note } = await setup();
    const [a, b, c] = [note({ position: 5 }), note({ position: 6 }), note({ position: 7 })];
    for (const n of [a, b, c]) await repo.savePinnedNote(n);
    await repo.reorderPinnedNotes([c.id, a.id, b.id]);
    expect((await repo.listPinnedNotes()).map((n) => n.id)).toEqual([c.id, a.id, b.id]);
    await repo.deletePinnedNote(a.id);
    await repo.reorderPinnedNotes([b.id, a.id, c.id]);
    expect((await repo.listPinnedNotes()).map((n) => n.id)).toEqual([b.id, c.id]);
  });
});

describe('plural forms and routes', () => {
  it('picks one / few / many for English and Polish counts', () => {
    expect([1, 2, 5].map((n) => pluralForm('en', n))).toEqual(['one', 'many', 'many']);
    expect([1, 2, 4, 5, 12, 22, 25].map((n) => pluralForm('pl', n))).toEqual(['one', 'few', 'few', 'many', 'many', 'few', 'many']);
  });
  it('parses and builds the Pinned and Tracked paths', () => {
    expect(parseRoute('/demo/pinned')).toEqual({ base: '/demo', view: 'pinned' });
    expect(parseRoute('/tracked/')).toEqual({ base: '', view: 'tracked' });
    expect(tabPath('/demo', 'pinned')).toBe('/demo/pinned');
    expect(routePath(parseRoute('/tracked'))).toBe('/tracked');
  });
});

const mount = (repository: Repository, lang: 'en' | 'pl' = 'en') =>
  render(
    <I18nProvider initial={lang}>
      <App repository={repository} />
    </I18nProvider>,
  );
const click = (name: string | RegExp) => fireEvent.click(screen.getByRole('button', { name }));
const dialog = () => screen.getByRole('dialog');
const cardTitles = () => [...document.querySelectorAll('.pin-card')].map((c) => c.querySelector('.day-card__head')?.textContent ?? c.querySelector('.day-card__text')?.textContent);

describe('Pinned screen (demo)', () => {
  beforeEach(() => {
    localStorage.clear();
    window.history.replaceState(null, '', '/demo/pinned');
  });
  afterEach(() => {
    cleanup();
    window.history.replaceState(null, '', '/');
  });

  it('lists the notes with their edit day, and the nav marks Pinned as the current page', async () => {
    mount(new DemoRepository(null));
    expect(await screen.findByRole('heading', { name: 'Pinned notes' })).toBeTruthy();
    expect(screen.getByText('4 notes')).toBeTruthy();
    expect(cardTitles()).toEqual(['Allergies', 'Bellavet dose', 'Gastrelle: mix the sachet into a spoon of wet food, not into the whole bowl.', 'Next deworming']);
    expect(screen.getByText('Edited 25 Sept')).toBeTruthy();
    const nav = within(screen.getByRole('navigation'));
    expect(nav.getAllByRole('button').map((b) => b.textContent)).toEqual(['Timeline', 'Pinned', 'Add', 'Tracked']);
    expect(nav.getByRole('button', { name: 'Pinned' }).getAttribute('aria-current')).toBe('page');
    expect(nav.getByRole('button', { name: 'Timeline' }).getAttribute('aria-current')).toBeNull();
  });

  it('adds a note on top, and rejects an empty text', async () => {
    mount(new DemoRepository(null));
    await screen.findByText('4 notes');
    click('Add pinned note');
    fireEvent.change(within(dialog()).getByLabelText('Title'), { target: { value: 'Vet phone' } });
    click('Save');
    expect(await within(dialog()).findByText('Write the note.')).toBeTruthy();
    fireEvent.change(within(dialog()).getByLabelText('Note'), { target: { value: 'Ask for Dr. Example' } });
    expect(within(dialog()).queryByText('Write the note.')).toBeNull();
    click('Save');
    expect(await screen.findByText('5 notes')).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(cardTitles()[0]).toBe('Vet phone');
    expect(screen.getByText('Edited 15 Oct')).toBeTruthy();
  });

  it('edits a note in place and keeps the sheet and what was typed while the list reloads (no re-draw)', async () => {
    const repo = new DemoRepository(null);
    mount(repo);
    fireEvent.click(await screen.findByText('Next deworming'));
    const sheet = dialog();
    const input = within(sheet).getByLabelText('Note') as HTMLTextAreaElement;
    const title = within(sheet).getByLabelText('Title') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Due in March, then September' } });
    fireEvent.change(title, { target: { value: 'Deworming' } });
    // Someone else's change reloads the list behind the sheet.
    await repo.savePinnedNote({ ...(await repo.listPinnedNotes())[0]!, body: 'Changed elsewhere' });
    fireEvent.change(input, { target: { value: 'Due in March, then September!' } });
    expect(dialog()).toBe(sheet); // same DOM node: nothing was re-created
    expect(within(sheet).getByLabelText('Note')).toBe(input);
    expect(within(sheet).getByLabelText('Title')).toBe(title);
    expect(input.value).toBe('Due in March, then September!');
    click('Save');
    expect(await screen.findByText('Saved')).toBeTruthy();
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.getByText('Deworming')).toBeTruthy();
    expect(screen.getByText('Due in March, then September!')).toBeTruthy();
    expect(screen.getAllByText(/^Edited/)).toHaveLength(4);
  });

  it('deletes without a question and Undo brings the note back where it was', async () => {
    mount(new DemoRepository(null));
    fireEvent.click(await screen.findByText('Bellavet dose'));
    click('Delete');
    expect(await screen.findByText('Note deleted')).toBeTruthy();
    expect(await screen.findByText('3 notes')).toBeTruthy();
    expect(screen.queryByText('Bellavet dose')).toBeNull();
    click('Undo');
    expect(await screen.findByText('4 notes')).toBeTruthy();
    expect(cardTitles()[1]).toBe('Bellavet dose');
  });

  it('reorders with the up and down buttons, and Done ends it', async () => {
    const repo = new DemoRepository(null);
    mount(repo);
    await screen.findByText('4 notes');
    click('Reorder');
    expect(screen.getByRole('button', { name: 'Done' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Move up: Allergies' }).getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'Move down: Allergies' }));
    fireEvent.click(screen.getByRole('button', { name: 'Move down: Allergies' })); // a quick second tap builds on the first
    expect(cardTitles().slice(0, 3)).toEqual(['Bellavet dose', 'Gastrelle: mix the sachet into a spoon of wet food, not into the whole bowl.', 'Allergies']);
    await waitFor(async () => expect((await repo.listPinnedNotes()).map((n) => n.title)).toEqual(['Bellavet dose', '', 'Allergies', 'Next deworming']));
    click('Done');
    expect(screen.queryByRole('button', { name: /^Move up/ })).toBeNull();
    expect(screen.getByRole('button', { name: 'Reorder' })).toBeTruthy();
  });

  it('shows the empty state with one Add button and no header New', async () => {
    const repo = new DemoRepository(null);
    for (const n of await repo.listPinnedNotes()) await repo.deletePinnedNote(n.id);
    mount(repo);
    expect(await screen.findByText(/Nothing pinned yet/)).toBeTruthy();
    expect(screen.getAllByRole('button', { name: 'Add pinned note' })).toHaveLength(1);
    expect(screen.queryByText('New')).toBeNull();
    click('Add pinned note');
    expect(dialog()).toBeTruthy();
  });

  it('Polish: the count follows the Polish plural forms and the labels fit the copy', async () => {
    mount(new DemoRepository(null), 'pl');
    expect(await screen.findByText('4 notatki')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Przypięte notatki' })).toBeTruthy();
    expect(screen.getByText('Zmieniono 25 wrz')).toBeTruthy();
    fireEvent.click(screen.getByText('Next deworming'));
    expect(within(dialog()).getByRole('heading', { name: 'Edytuj przypiętą notatkę' })).toBeTruthy();
  });

  it('the Tracked tab shows the Tracked list (JCB-6), and the tabs switch screens', async () => {
    mount(new DemoRepository(null));
    await screen.findByText('4 notes');
    const nav = within(screen.getByRole('navigation'));
    fireEvent.click(nav.getByRole('button', { name: 'Tracked' }));
    expect(await screen.findByRole('heading', { name: 'Tracked conditions' })).toBeTruthy();
    expect(window.location.pathname).toBe('/demo/tracked');
    fireEvent.click(nav.getByRole('button', { name: 'Timeline' }));
    expect(await screen.findByText('October 2026')).toBeTruthy();
    expect(window.location.pathname).toBe('/demo');
    fireEvent.click(nav.getByRole('button', { name: 'Pinned' }));
    expect(await screen.findByText('4 notes')).toBeTruthy();
  });

  it('has the reviewed and draft strings in EN and PL', () => {
    for (const key of ['newShort', 'reorder', 'done', 'moveUp', 'moveDown', 'notes_one', 'notes_few', 'notes_many', 'editPinned', 'pinTitle', 'pinText', 'pinTextErr', 'toastPinDeleted', 'pinEmpty', 'editedOn']) {
      expect(translate('en', key)).not.toBe(key);
      expect(translate('pl', key)).not.toBe(key);
    }
  });
});

describe('Pinned notes on the real data path', () => {
  let fake: FakeSupabase | null = null;
  afterEach(async () => {
    cleanup();
    window.history.replaceState(null, '', '/');
    await fake?.backend.close();
    fake = null;
  });
  const rows = (sql: string) => fake!.backend.sql<Record<string, unknown>>(sql);

  it('saves, edits, moves and deletes against Postgres; a move is not an edit', async () => {
    fake = await createFakeSupabase({ start: '2026-10-01' });
    window.history.replaceState(null, '', '/pinned');
    mount(fake.repository(NOW));
    expect(await screen.findByText(/Nothing pinned yet/)).toBeTruthy();

    click('Add pinned note');
    fireEvent.change(within(dialog()).getByLabelText('Note'), { target: { value: 'Second' } });
    click('Save');
    expect(await screen.findByText('1 note')).toBeTruthy();
    click('Add pinned note');
    fireEvent.change(within(dialog()).getByLabelText('Title'), { target: { value: 'Top' } });
    fireEvent.change(within(dialog()).getByLabelText('Note'), { target: { value: 'First' } });
    click('Save');
    expect(await screen.findByText('2 notes')).toBeTruthy();
    expect(cardTitles()).toEqual(['Top', 'Second']);
    const saved = await rows(`select title, body, position, created_by, updated_by from pinned_note order by position`);
    expect(saved.map((r) => [r.title, r.body, r.position])).toEqual([['Top', 'First', -1], ['', 'Second', 0]]);
    expect(saved[0]?.created_by).toBeTruthy();

    // An old edit by someone else (the stamp trigger would ignore this, so switch it off for the setup).
    await rows(`alter table pinned_note disable trigger pinned_note_stamp`);
    await rows(`update pinned_note set updated_at = '2026-09-01T10:00:00Z', updated_by = null`);
    await rows(`alter table pinned_note enable trigger pinned_note_stamp`);
    click('Reorder');
    fireEvent.click(screen.getByRole('button', { name: 'Move down: Top' }));
    await waitFor(async () => expect((await rows(`select body from pinned_note order by position`)).map((r) => r.body)).toEqual(['Second', 'First']));
    const [stamp] = await rows(`select updated_at::text as at, updated_by from pinned_note limit 1`);
    expect(stamp?.at).toContain('2026-09-01');
    expect(stamp?.updated_by).toBeNull();
    click('Done');

    fireEvent.click(screen.getByText('Second'));
    click('Delete');
    expect(await screen.findByText('Note deleted')).toBeTruthy();
    await waitFor(async () => expect(await rows(`select 1 from pinned_note`)).toHaveLength(1));
    click('Undo');
    await waitFor(async () => expect(await rows(`select 1 from pinned_note`)).toHaveLength(2));
  });
});
