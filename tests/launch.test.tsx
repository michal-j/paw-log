// The launch cover (JCB-82): plain HTML in index.html, removed once the first load has finished or failed.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { App } from '../src/App';
import { DemoRepository } from '../src/data';
import { I18nProvider } from '../src/i18n';
import { LAUNCH_MAX_MS, armLaunchTimeout, resetLaunchForTests } from '../src/launch';

const cover = () => document.getElementById('launch');

beforeEach(() => {
  localStorage.clear();
  resetLaunchForTests();
  document.documentElement.classList.add('launching');
  document.body.insertAdjacentHTML('beforeend', '<div id="launch"></div>');
});
afterEach(() => {
  cleanup();
  cover()?.remove();
  vi.useRealTimers();
});

const mount = (repository: DemoRepository) =>
  render(
    <I18nProvider initial="en">
      <App repository={repository} />
    </I18nProvider>,
  );

describe('launch cover', () => {
  it('stays until the first data has loaded, then fades out and is removed', async () => {
    expect(cover()).not.toBeNull();
    mount(new DemoRepository(null));
    await screen.findByText('October 2026');
    // The class is removed in an effect after the first render with data, so wait for it, do not assume it.
    await vi.waitFor(() => expect(document.documentElement.classList.contains('launching')).toBe(false));
    await vi.waitFor(() => expect(cover()).toBeNull());
  });

  it('is removed after a failed load too, so the Try again screen shows', async () => {
    const repo = new DemoRepository(null);
    repo.getDog = () => Promise.reject(new Error('offline'));
    mount(repo);
    expect(await screen.findByRole('button', { name: /try again/i })).toBeTruthy();
    await vi.waitFor(() => expect(cover()).toBeNull());
  });

  it('never stays forever: a safety timer removes it if nothing loads', () => {
    vi.useFakeTimers();
    armLaunchTimeout();
    vi.advanceTimersByTime(LAUNCH_MAX_MS - 1);
    expect(cover()).not.toBeNull();
    vi.advanceTimersByTime(1);
    vi.advanceTimersByTime(300);
    expect(cover()).toBeNull();
  });

  it('is removed at once with reduced motion', () => {
    vi.useFakeTimers();
    vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('reduce') }));
    armLaunchTimeout();
    act(() => void vi.advanceTimersByTime(LAUNCH_MAX_MS));
    expect(cover()).toBeNull();
    vi.unstubAllGlobals();
  });
});
