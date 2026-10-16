import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { readSupabaseConfig } from '../src/auth/config';
import { AuthFailure, isValidEmail, type AuthService, type AuthUser } from '../src/auth/authService';
import { classifyAuthError, createSupabaseAuth } from '../src/auth/supabaseAuth';
import { AuthGate } from '../src/auth/AuthGate';
import { ConfigError } from '../src/auth/ConfigError';
import { DemoRepository, NoDogError, type Repository } from '../src/data';
import { I18nProvider, type Lang } from '../src/i18n';

const createClient = vi.fn<(...args: unknown[]) => unknown>(() => ({}));
vi.mock('@supabase/supabase-js', () => ({ createClient: (...args: unknown[]) => createClient(...args) }));

beforeEach(() => localStorage.clear());
afterEach(cleanup);

// Fictional test values only.
const EMAIL = 'a1@example.test';
const PASSWORD = 'test-password-1';

describe('config', () => {
  it('accepts an https URL and a key', () => {
    expect(readSupabaseConfig({ VITE_SUPABASE_URL: 'https://abc.supabase.co/', VITE_SUPABASE_ANON_KEY: 'k' })).toEqual({
      url: 'https://abc.supabase.co',
      anonKey: 'k',
    });
    expect(readSupabaseConfig({ VITE_SUPABASE_URL: 'http://127.0.0.1:54321', VITE_SUPABASE_ANON_KEY: 'k' })?.url).toBe(
      'http://127.0.0.1:54321',
    );
  });
  it('rejects missing, placeholder or insecure settings', () => {
    expect(readSupabaseConfig({})).toBeNull();
    expect(readSupabaseConfig({ VITE_SUPABASE_URL: 'https://abc.supabase.co', VITE_SUPABASE_ANON_KEY: '' })).toBeNull();
    expect(
      readSupabaseConfig({ VITE_SUPABASE_URL: 'https://your-project-ref.supabase.co', VITE_SUPABASE_ANON_KEY: 'your-anon-key' }),
    ).toBeNull();
    expect(readSupabaseConfig({ VITE_SUPABASE_URL: 'http://abc.supabase.co', VITE_SUPABASE_ANON_KEY: 'k' })).toBeNull();
    expect(readSupabaseConfig({ VITE_SUPABASE_URL: 'not a url', VITE_SUPABASE_ANON_KEY: 'k' })).toBeNull();
  });
});

describe('Supabase client', () => {
  it('persists the session in localStorage and never reads it from the URL', async () => {
    const { createSupabaseClient, AUTH_STORAGE_KEY } = await import('../src/auth/supabaseClient');
    createSupabaseClient({ url: 'https://abc.supabase.co', anonKey: 'k' });
    expect(createClient).toHaveBeenCalledWith('https://abc.supabase.co', 'k', {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: AUTH_STORAGE_KEY },
      global: { fetch: expect.any(Function) },
    });
  });

  it('reads past the HTTP cache, so a reload after a write sees it (JCB-43)', async () => {
    const { createSupabaseClient } = await import('../src/auth/supabaseClient');
    createSupabaseClient({ url: 'https://abc.supabase.co', anonKey: 'k' });
    const options = vi.mocked(createClient).mock.calls.at(-1)?.[2] as { global: { fetch: typeof fetch } };
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('[]'));
    await options.global.fetch('https://abc.supabase.co/rest/v1/entry', { method: 'GET' });
    expect(spy).toHaveBeenCalledWith('https://abc.supabase.co/rest/v1/entry', { method: 'GET', cache: 'no-store' });
    spy.mockRestore();
  });
});

describe('helpers', () => {
  it('validates e-mail', () => {
    expect(isValidEmail(' a@b.co ')).toBe(true);
    expect(isValidEmail('a@b')).toBe(false);
  });
  it('classifies Supabase auth errors', () => {
    expect(classifyAuthError({ code: 'invalid_credentials', status: 400 })).toBe('invalid_credentials');
    expect(classifyAuthError({ status: 400 })).toBe('invalid_credentials');
    expect(classifyAuthError({ code: 'over_request_rate_limit', status: 429 })).toBe('rate_limited');
    expect(classifyAuthError({ name: 'AuthRetryableFetchError', status: 0 })).toBe('network');
    expect(classifyAuthError({ code: 'email_address_invalid', status: 422 })).toBe('invalid_email');
    expect(classifyAuthError({ code: 'unexpected_failure', status: 500 })).toBe('unknown');
  });
});

describe('createSupabaseAuth', () => {
  const setup = () => {
    let emit: (event: string, session: { user: { id: string; email?: string } } | null) => void = () => {};
    const unsubscribe = vi.fn();
    const auth = {
      signInWithPassword: vi.fn<(args: unknown) => Promise<{ error: unknown }>>(async () => ({ error: null })),
      signOut: vi.fn<(args: unknown) => Promise<{ error: null }>>(async () => ({ error: null })),
      onAuthStateChange: vi.fn((cb: typeof emit) => {
        emit = cb;
        return { data: { subscription: { unsubscribe } } };
      }),
    };
    const service = createSupabaseAuth({ auth } as unknown as SupabaseClient);
    return { auth, service, unsubscribe, emit: (...a: Parameters<typeof emit>) => emit(...a) };
  };

  it('signs in with e-mail and password', async () => {
    const { auth, service } = setup();
    await service.signIn(' A1@Example.test ', PASSWORD);
    expect(auth.signInWithPassword).toHaveBeenCalledWith({ email: EMAIL, password: PASSWORD });
  });

  it('throws AuthFailure with the right kind', async () => {
    const { auth, service } = setup();
    auth.signInWithPassword.mockResolvedValueOnce({ error: { code: 'invalid_credentials', status: 400, message: 'Invalid login credentials' } });
    await expect(service.signIn(EMAIL, 'wrong')).rejects.toMatchObject({ kind: 'invalid_credentials' });
    auth.signInWithPassword.mockResolvedValueOnce({ error: { name: 'AuthRetryableFetchError', status: 0, message: 'Failed to fetch' } });
    await expect(service.signIn(EMAIL, PASSWORD)).rejects.toMatchObject({ kind: 'network' });
  });

  it('reports session changes and signs out this device only', async () => {
    const { auth, service, emit, unsubscribe } = setup();
    const seen: (AuthUser | null)[] = [];
    const stop = service.subscribe((u) => seen.push(u));
    emit('INITIAL_SESSION', null);
    emit('SIGNED_IN', { user: { id: 'u1', email: EMAIL } });
    expect(seen).toEqual([null, { id: 'u1', email: EMAIL }]);
    stop();
    expect(unsubscribe).toHaveBeenCalled();
    await service.signOut();
    expect(auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
  });
});

/** In-memory AuthService: only EMAIL with PASSWORD signs in. */
class FakeAuth implements AuthService {
  private listeners = new Set<(u: AuthUser | null) => void>();
  attempts = 0;
  /** 'restoring' = the stored session is not known yet (no event until emit). */
  constructor(
    private user: AuthUser | null | 'restoring' = null,
    private failWith: AuthFailure | null = null,
  ) {}
  subscribe(listener: (u: AuthUser | null) => void) {
    this.listeners.add(listener);
    if (this.user !== 'restoring') listener(this.user);
    return () => void this.listeners.delete(listener);
  }
  emit(user: AuthUser | null) {
    this.user = user;
    this.listeners.forEach((l) => l(user));
  }
  async signIn(email: string, password: string) {
    this.attempts++;
    if (this.failWith) throw this.failWith;
    if (email.trim() !== EMAIL || password !== PASSWORD) throw new AuthFailure('invalid_credentials');
    this.emit({ id: 'u1', email });
  }
  async signOut() {
    this.emit(null);
  }
}

const mount = (auth: AuthService, opts: { lang?: Lang; repo?: () => Repository; confirm?: () => boolean } = {}) =>
  render(
    <I18nProvider initial={opts.lang ?? 'en'}>
      <AuthGate auth={auth} createRepository={opts.repo ?? (() => new DemoRepository(null))} confirm={opts.confirm ?? (() => true)} />
    </I18nProvider>,
  );

const type = (label: RegExp, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
const submit = () => fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));

describe('sign-in flow', () => {
  it('shows loading until the stored session is known, then the timeline for a restored session', async () => {
    const auth = new FakeAuth('restoring');
    mount(auth);
    expect(screen.getByRole('status').textContent).toBe('Loading…');
    act(() => auth.emit({ id: 'u1', email: EMAIL }));
    expect(await screen.findByText('October 2026')).toBeTruthy();
  });

  it('has Keychain-friendly fields and a show/hide toggle', () => {
    mount(new FakeAuth());
    const email = screen.getByLabelText(/E-mail/);
    const password = screen.getByLabelText('Password') as HTMLInputElement;
    expect(email.getAttribute('autocomplete')).toBe('username');
    expect(password.getAttribute('autocomplete')).toBe('current-password');
    expect(password.type).toBe('password');
    const toggle = screen.getByRole('button', { name: 'Show password' });
    expect(toggle.textContent).toBe('Show');
    fireEvent.click(toggle);
    expect(password.type).toBe('text');
    expect(toggle.getAttribute('aria-label')).toBe('Hide password');
    expect(toggle.textContent).toBe('Hide');
    expect(toggle.hasAttribute('aria-pressed')).toBe(false);
  });

  it('checks the fields, explains wrong credentials, then signs in and out', async () => {
    const auth = new FakeAuth();
    mount(auth);
    expect(screen.getByRole('heading', { name: 'Sign in' })).toBeTruthy();

    type(/E-mail/, 'nope');
    submit();
    expect(screen.getByRole('alert').textContent).toBe('Enter a valid e-mail address.');

    type(/E-mail/, EMAIL);
    submit();
    expect(screen.getByRole('alert').textContent).toBe('Enter your password.');
    expect(auth.attempts).toBe(0);

    type(/^Password$/, 'wrong');
    submit();
    expect((await screen.findByRole('alert')).textContent).toBe('Wrong e-mail or password.');
    expect(screen.getByLabelText(/^Password$/).getAttribute('aria-invalid')).toBe('true');

    type(/^Password$/, 'wrong!'); // editing a field clears the error and the red border
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByLabelText(/^Password$/).getAttribute('aria-invalid')).toBe('false');

    type(/^Password$/, PASSWORD);
    submit();
    expect(await screen.findByText('October 2026')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Menu' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Sign out' }));
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeTruthy();
  });

  it('explains a network failure', async () => {
    mount(new FakeAuth(null, new AuthFailure('network')));
    type(/E-mail/, EMAIL);
    type(/^Password$/, PASSWORD);
    submit();
    expect((await screen.findByRole('alert')).textContent).toBe('No connection. Check the internet and try again.');
  });

  it('keeps the session when sign-out is not confirmed', async () => {
    const auth = new FakeAuth({ id: 'u1', email: EMAIL });
    const signOut = vi.spyOn(auth, 'signOut');
    mount(auth, { confirm: () => false });
    fireEvent.click(await screen.findByRole('button', { name: 'Menu' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Sign out' }));
    expect(signOut).not.toHaveBeenCalled();
  });

  it('explains an account that sees no dog instead of an empty timeline', async () => {
    const repo = new DemoRepository(null);
    repo.getDog = () => Promise.reject(new NoDogError());
    mount(new FakeAuth({ id: 'u1', email: EMAIL }), { repo: () => repo });
    expect(await screen.findByText(/not linked to a dog yet/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeTruthy();
  });

  it('renders in Polish', () => {
    mount(new FakeAuth(), { lang: 'pl' });
    expect(screen.getByRole('heading', { name: 'Zaloguj się' })).toBeTruthy();
    expect(screen.getByLabelText('Hasło')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Pokaż hasło' }).textContent).toBe('Pokaż');
  });
});

describe('missing configuration', () => {
  it('explains and links to the demo instead of crashing', () => {
    render(
      <I18nProvider initial="en">
        <ConfigError />
      </I18nProvider>,
    );
    expect(screen.getByRole('heading', { name: 'PawLog is not connected' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Open the demo' }).getAttribute('href')).toBe('/demo');
  });
});
