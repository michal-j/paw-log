import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { readSupabaseConfig } from '../src/auth/config';
import { AuthFailure, cleanCode, isValidEmail, type AuthService, type AuthUser } from '../src/auth/authService';
import { classifyAuthError, createSupabaseAuth } from '../src/auth/supabaseAuth';
import { AuthGate } from '../src/auth/AuthGate';
import { ConfigError } from '../src/auth/ConfigError';
import { DemoRepository, NoDogError, type Repository } from '../src/data';
import { I18nProvider, type Lang } from '../src/i18n';

const createClient = vi.fn<(...args: unknown[]) => unknown>(() => ({}));
vi.mock('@supabase/supabase-js', () => ({ createClient: (...args: unknown[]) => createClient(...args) }));

beforeEach(() => localStorage.clear());
afterEach(cleanup);

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
    });
  });
});

describe('helpers', () => {
  it('validates e-mail and cleans codes', () => {
    expect(isValidEmail(' a@b.co ')).toBe(true);
    expect(isValidEmail('a@b')).toBe(false);
    expect(cleanCode('12 34-56 7')).toBe('123456');
  });
  it('classifies Supabase auth errors', () => {
    expect(classifyAuthError({ code: 'otp_disabled', status: 422 }, 'send')).toBe('no_account');
    expect(classifyAuthError({ code: 'over_email_send_rate_limit', status: 429 }, 'send')).toBe('rate_limited');
    expect(classifyAuthError({ name: 'AuthRetryableFetchError', status: 0 }, 'send')).toBe('network');
    expect(classifyAuthError({ code: 'otp_expired', status: 403 }, 'verify')).toBe('invalid_code');
    expect(classifyAuthError({ code: 'email_address_invalid', status: 400 }, 'send')).toBe('invalid_email');
    expect(classifyAuthError({ code: 'unexpected_failure', status: 500 }, 'verify')).toBe('unknown');
  });
});

describe('createSupabaseAuth', () => {
  const setup = () => {
    let emit: (event: string, session: { user: { id: string; email?: string } } | null) => void = () => {};
    const unsubscribe = vi.fn();
    const auth = {
      signInWithOtp: vi.fn<(args: unknown) => Promise<{ error: unknown }>>(async () => ({ error: null })),
      verifyOtp: vi.fn<(args: unknown) => Promise<{ error: unknown }>>(async () => ({ error: null })),
      signOut: vi.fn<(args: unknown) => Promise<{ error: null }>>(async () => ({ error: null })),
      onAuthStateChange: vi.fn((cb: typeof emit) => {
        emit = cb;
        return { data: { subscription: { unsubscribe } } };
      }),
    };
    const service = createSupabaseAuth({ auth } as unknown as SupabaseClient);
    return { auth, service, unsubscribe, emit: (...a: Parameters<typeof emit>) => emit(...a) };
  };

  it('sends a code without creating accounts and verifies it as an e-mail OTP', async () => {
    const { auth, service } = setup();
    await service.sendCode(' Someone@Example.test ');
    expect(auth.signInWithOtp).toHaveBeenCalledWith({ email: 'someone@example.test', options: { shouldCreateUser: false } });
    await service.verifyCode('someone@example.test', '123456');
    expect(auth.verifyOtp).toHaveBeenCalledWith({ email: 'someone@example.test', token: '123456', type: 'email' });
  });

  it('throws AuthFailure with the right kind', async () => {
    const { auth, service } = setup();
    auth.signInWithOtp.mockResolvedValueOnce({ error: { code: 'otp_disabled', status: 422, message: 'Signups not allowed for otp' } });
    await expect(service.sendCode('x@example.test')).rejects.toMatchObject({ kind: 'no_account' });
    auth.verifyOtp.mockResolvedValueOnce({ error: { code: 'otp_expired', status: 403, message: 'Token has expired or is invalid' } });
    await expect(service.verifyCode('x@example.test', '000000')).rejects.toMatchObject({ kind: 'invalid_code' });
  });

  it('reports session changes and signs out this device only', async () => {
    const { auth, service, emit, unsubscribe } = setup();
    const seen: (AuthUser | null)[] = [];
    const stop = service.subscribe((u) => seen.push(u));
    emit('INITIAL_SESSION', null);
    emit('SIGNED_IN', { user: { id: 'u1', email: 'a@example.test' } });
    expect(seen).toEqual([null, { id: 'u1', email: 'a@example.test' }]);
    stop();
    expect(unsubscribe).toHaveBeenCalled();
    await service.signOut();
    expect(auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
  });
});

/** In-memory AuthService: code 123456 works for a1@example.test only. */
class FakeAuth implements AuthService {
  private listeners = new Set<(u: AuthUser | null) => void>();
  sent: string[] = [];
  /** 'restoring' = the stored session is not known yet (no event until emit). */
  constructor(private user: AuthUser | null | 'restoring' = null) {}
  subscribe(listener: (u: AuthUser | null) => void) {
    this.listeners.add(listener);
    if (this.user !== 'restoring') listener(this.user);
    return () => void this.listeners.delete(listener);
  }
  emit(user: AuthUser | null) {
    this.user = user;
    this.listeners.forEach((l) => l(user));
  }
  async sendCode(email: string) {
    if (email.trim() !== 'a1@example.test') throw new AuthFailure('no_account');
    this.sent.push(email);
  }
  async verifyCode(email: string, code: string) {
    if (code !== '123456') throw new AuthFailure('invalid_code');
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

describe('sign-in flow', () => {
  it('shows loading until the stored session is known, then the timeline for a restored session', async () => {
    const auth = new FakeAuth('restoring');
    mount(auth);
    expect(screen.getByRole('status').textContent).toBe('Loading…');
    act(() => auth.emit({ id: 'u1', email: 'a1@example.test' }));
    expect(await screen.findByText('October 2026')).toBeTruthy();
  });

  it('goes from e-mail to code to the timeline, then signs out', async () => {
    const auth = new FakeAuth();
    mount(auth);
    expect(screen.getByRole('heading', { name: 'Sign in' })).toBeTruthy();

    type(/E-mail/, 'nope');
    fireEvent.click(screen.getByRole('button', { name: 'Send code' }));
    expect(screen.getByRole('alert').textContent).toBe('Enter a valid e-mail address.');

    type(/E-mail/, 'b2@example.test');
    fireEvent.click(screen.getByRole('button', { name: 'Send code' }));
    expect((await screen.findByRole('alert')).textContent).toBe('This e-mail has no PawLog account.');

    type(/E-mail/, 'a1@example.test');
    fireEvent.click(screen.getByRole('button', { name: 'Send code' }));
    expect(await screen.findByText('Enter the code we sent to a1@example.test.')).toBeTruthy();
    expect(auth.sent).toEqual(['a1@example.test']);

    const code = screen.getByLabelText(/6-digit code/) as HTMLInputElement;
    expect(code.getAttribute('autocomplete')).toBe('one-time-code');
    expect(code.getAttribute('inputmode')).toBe('numeric');

    type(/6-digit code/, '12');
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(screen.getByRole('alert').textContent).toBe('The code has 6 digits.');

    type(/6-digit code/, '000 000');
    expect((await screen.findByRole('alert')).textContent).toMatch(/Wrong or expired code/);

    fireEvent.click(screen.getByRole('button', { name: 'Send a new code' }));
    expect(await screen.findByText('New code sent.')).toBeTruthy();

    type(/6-digit code/, '123456'); // a full code signs in without pressing the button
    expect(await screen.findByText('October 2026')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeTruthy();
  });

  it('keeps the session when sign-out is not confirmed', async () => {
    const auth = new FakeAuth({ id: 'u1', email: 'a1@example.test' });
    const signOut = vi.spyOn(auth, 'signOut');
    mount(auth, { confirm: () => false });
    fireEvent.click(await screen.findByRole('button', { name: 'Sign out' }));
    expect(signOut).not.toHaveBeenCalled();
  });

  it('can switch back to another e-mail', async () => {
    mount(new FakeAuth());
    type(/E-mail/, 'a1@example.test');
    fireEvent.click(screen.getByRole('button', { name: 'Send code' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Use another e-mail' }));
    expect(screen.getByRole('button', { name: 'Send code' })).toBeTruthy();
  });

  it('explains an account that sees no dog instead of an empty timeline', async () => {
    const repo = new DemoRepository(null);
    repo.getDog = () => Promise.reject(new NoDogError());
    mount(new FakeAuth({ id: 'u1', email: 'a1@example.test' }), { repo: () => repo });
    expect(await screen.findByText(/not linked to a dog yet/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeTruthy();
  });

  it('renders in Polish', () => {
    mount(new FakeAuth(), { lang: 'pl' });
    expect(screen.getByRole('heading', { name: 'Zaloguj się' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Wyślij kod' })).toBeTruthy();
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
