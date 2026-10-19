// "Also done" at a vet visit with the dog's own services (JCB-89), on the real data path:
// App → SupabaseRepository → the PostgREST-like fake with every migration. Fictional data only.
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { App } from '../src/App';
import { cleanAlsoDone } from '../src/data';
import { I18nProvider } from '../src/i18n';
import { resolveService } from '../src/log/services';
import { SEED } from './harness/fakeBackend';
import { createFakeSupabase, type FakeSupabase } from './harness/fakeSupabase';

const NOW = () => new Date(2026, 9, 15, 16, 30);
let fake: FakeSupabase | null = null;

async function at(path: string, prep?: string) {
  fake = await createFakeSupabase({ start: '2026-10-01' });
  if (prep) await fake.backend.db.exec(prep);
  window.history.replaceState(null, '', path);
  render(
    <I18nProvider initial="en">
      <App repository={fake.repository(NOW)} />
    </I18nProvider>,
  );
}
const dialog = () => screen.getByRole('dialog');
const rows = (sql: string) => fake!.backend.sql<Record<string, unknown>>(sql);
const VISIT = '50000000-0000-4000-8000-000000000001';
const earlier = `insert into public.event (id, dog_id, date, type, title, also_done)
  values ('${VISIT}', '${SEED.dog}', '2026-10-10', 'vet', 'Clinic A', '{nails,Ear cleaning}');`;

async function newVisit(prep?: string) {
  await at('/day/2026-10-15', prep);
  await screen.findAllByText('Cooked meal');
  fireEvent.click(screen.getByRole('button', { name: 'Add' }));
  fireEvent.click(within(dialog()).getByText('Vet visit'));
}
const addService = (text: string, how: 'enter' | 'button' = 'enter') => {
  const d = within(dialog());
  fireEvent.click(d.getByRole('button', { name: 'Add service' }));
  const input = d.getByLabelText('Service name');
  fireEvent.change(input, { target: { value: text } });
  if (how === 'enter') fireEvent.keyDown(input, { key: 'Enter' });
  else fireEvent.click(d.getByRole('button', { name: 'Add' }));
};
const save = async () => {
  fireEvent.click(within(dialog()).getByRole('button', { name: 'Save' }));
  expect(await screen.findByText('Saved')).toBeTruthy();
};
const alsoDone = async () => (await rows(`select also_done from event where type = 'vet' order by date, created_at`)).map((r) => r.also_done);

afterEach(async () => {
  cleanup();
  window.history.replaceState(null, '', '/');
  await fake?.backend.close();
  fake = null;
});

describe('own "also done" services', () => {
  it('adds a service with Enter, saves it with the visit and shows it on the Day card', async () => {
    await newVisit();
    fireEvent.change(within(dialog()).getByLabelText('Reason and findings'), { target: { value: 'Check-up' } });
    addService('  Ear cleaning ');
    expect(within(dialog()).getByRole('button', { name: 'Ear cleaning', pressed: true })).toBeTruthy();
    expect(within(dialog()).queryByLabelText('Service name')).toBeNull();
    await save();
    expect(await alsoDone()).toEqual([['Ear cleaning']]);
    expect(await screen.findByText('Ear cleaning', { selector: '.day-card__chip' })).toBeTruthy();
  });

  it('the Add button works too; empty or blank text is ignored', async () => {
    await newVisit();
    addService('   ', 'button');
    expect(within(dialog()).getByLabelText('Service name')).toBeTruthy();
    fireEvent.change(within(dialog()).getByLabelText('Service name'), { target: { value: 'Ear cleaning' } });
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Add' }));
    expect(within(dialog()).getByRole('button', { name: 'Ear cleaning', pressed: true })).toBeTruthy();
  });

  it('a built-in name (EN or PL) or an existing chip, in any case, selects that chip instead of adding one', async () => {
    await newVisit(earlier);
    fireEvent.click(await within(dialog()).findByRole('button', { name: 'Ear cleaning' }));
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Ear cleaning', pressed: true }));
    addService(' NAIL TRIMMING ');
    addService('przycięcie pazurów');
    addService('ear CLEANING');
    const d = within(dialog());
    expect(d.getAllByRole('button', { name: 'Ear cleaning' })).toHaveLength(1);
    expect(d.getAllByRole('button', { name: 'Nail trimming' })).toHaveLength(1);
    expect(d.getByRole('button', { name: 'Nail trimming', pressed: true })).toBeTruthy();
    expect(d.getByRole('button', { name: 'Ear cleaning', pressed: true })).toBeTruthy();
  });

  it('an earlier visit offers its own services as chips in a new visit (not selected)', async () => {
    await newVisit(earlier);
    expect(await within(dialog()).findByRole('button', { name: 'Ear cleaning', pressed: false })).toBeTruthy();
    fireEvent.change(within(dialog()).getByLabelText('Reason and findings'), { target: { value: 'Follow-up' } });
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Ear cleaning' }));
    await save();
    expect(await alsoDone()).toEqual([['nails', 'Ear cleaning'], ['Ear cleaning']]);
  });

  it('editing keeps the services; unticking removes it from that visit only, and the chip goes when no visit uses it', async () => {
    await at('/day/2026-10-10', earlier);
    fireEvent.click(await screen.findByText('Ear cleaning', { selector: '.day-card__chip' }));
    expect(within(dialog()).getByRole('button', { name: 'Ear cleaning', pressed: true })).toBeTruthy();
    expect(within(dialog()).getByRole('button', { name: 'Nail trimming', pressed: true })).toBeTruthy();
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Ear cleaning' }));
    await save();
    expect(await alsoDone()).toEqual([['nails']]);
    await waitFor(() => expect(screen.queryByText('Ear cleaning', { selector: '.day-card__chip' })).toBeNull());
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    fireEvent.click(within(dialog()).getByText('Vet visit'));
    expect(within(dialog()).queryByRole('button', { name: 'Ear cleaning' })).toBeNull();
  });

  it('the database refuses what the form never sends', async () => {
    await at('/day/2026-10-15');
    await expect(
      rows(`insert into event (dog_id, date, type, title, also_done) values ('${SEED.dog}', '2026-10-15', 'vet', 'x', '{" padded"}')`),
    ).rejects.toThrow();
  });
});

describe('service helpers', () => {
  it('cleanAlsoDone trims, drops empties and repeats, cuts to 40 characters and keeps 10', () => {
    expect(cleanAlsoDone([' a ', 'A', '', '  ', 'nails'])).toEqual(['a', 'nails']);
    expect(cleanAlsoDone(['x'.repeat(50)])).toEqual(['x'.repeat(40)]);
    expect(cleanAlsoDone(Array.from({ length: 12 }, (_, i) => `s${i}`))).toHaveLength(10);
    expect(cleanAlsoDone(undefined)).toEqual([]);
  });
  it('resolveService maps built-in labels in both languages to their keys', () => {
    expect(resolveService('anal glands expressed', [])).toBe('anal_glands');
    expect(resolveService(' przycięcie PAZURÓW ', [])).toBe('nails');
    expect(resolveService('Dental', ['dental'])).toBe('dental');
    expect(resolveService(' ', [])).toBeNull();
  });
});
