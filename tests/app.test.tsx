import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import { App } from '../src/App';
import { DemoRepository } from '../src/data';
import { I18nProvider, detectLang, translate } from '../src/i18n';

const mount = () =>
  render(
    <I18nProvider initial="en">
      <App repository={new DemoRepository(null)} />
    </I18nProvider>,
  );

beforeEach(() => localStorage.clear());
afterEach(cleanup);

describe('timeline home', () => {
  it('renders the timeline from the demo repository without sign-in', async () => {
    mount();
    expect(await screen.findByText('October 2026')).toBeTruthy();
    expect(screen.getByText('September 2026')).toBeTruthy();
    expect(screen.getByText(/Wednesday 14 October: Vet visit ×2/)).toBeTruthy();
    expect(screen.getByText('Demo with sample data. Changes stay in this browser.')).toBeTruthy();
  });

  it('switches language EN to PL and remembers it', async () => {
    mount();
    await screen.findByText('October 2026');
    fireEvent.click(screen.getByRole('button', { name: 'PL' }));
    expect(screen.getByText(/Demo z przykładowymi danymi/)).toBeTruthy();
    expect(screen.getByText('październik 2026')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Klucz dla dnia poniżej/ })).toBeTruthy();
    expect(localStorage.getItem('pawlog.lang')).toBe('pl');
  });

  it('opens the Key legend', async () => {
    mount();
    const key = await screen.findByRole('button', { name: /Key for the day below/ });
    expect(key.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(key);
    expect(key.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByText('Skipped / refused')).toBeTruthy();
    expect(screen.getByText('Frontline (monthly)')).toBeTruthy();
  });
});

describe('i18n helpers', () => {
  it('detects the language', () => {
    expect(detectLang(null, 'pl-PL')).toBe('pl');
    expect(detectLang(null, 'en-GB')).toBe('en');
    expect(detectLang('en', 'pl-PL')).toBe('en');
  });
  it('falls back to the key for unknown strings', () => {
    expect(translate('pl', 'does.not.exist')).toBe('does.not.exist');
  });
});
